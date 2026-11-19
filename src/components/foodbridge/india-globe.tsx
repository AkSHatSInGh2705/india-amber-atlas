import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import MAP_DATA from '@/lib/map-data.json'
import { globe, MAP } from '@/lib/india3d'

type MapData = { states: { n: string; d: string }[]; hot: [number, number]; size: [number, number]; outline: number[] }
const D = MAP_DATA as unknown as MapData
const [SW, SH] = D.size
const [HX, HY] = D.hot
/** world units per metre of elevation (exaggerated) */
const H_SCALE = (MAP.UNITS_PER_KM / 1000) * MAP.EXAG
const DEG = Math.PI / 180
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

type Assets = {
  height: THREE.Texture
  lights: THREE.Texture
  mask: THREE.Texture
  /** metres at map-space point */
  heightAt: (x: number, y: number) => number
  inside: (x: number, y: number) => boolean
}

function loadImg(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('image failed: ' + url))
    i.src = url
  })
}

function dataTex(src: TexImageSource, mip: boolean) {
  const t = new THREE.Texture(src as HTMLImageElement)
  t.flipY = false
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
  t.generateMipmaps = mip
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

async function loadAssets(): Promise<Assets> {
  const [hi, li] = await Promise.all([loadImg('/india-height.png'), loadImg('/india-lights.jpg')])
  const hc = document.createElement('canvas')
  hc.width = hi.naturalWidth
  hc.height = hi.naturalHeight
  const hx = hc.getContext('2d', { willReadFrequently: true })!
  hx.drawImage(hi, 0, 0)
  const hd = hx.getImageData(0, 0, hc.width, hc.height).data
  const hW = hc.width,
    hH = hc.height
  const px = (i: number, j: number) => {
    const v = hd[(clamp(j, 0, hH - 1) * hW + clamp(i, 0, hW - 1)) * 4] / 255
    return v * v * MAP.HMAX
  }
  const heightAt = (x: number, y: number) => {
    const fx = (x / SW) * hW - 0.5,
      fy = (y / SH) * hH - 0.5,
      i = Math.floor(fx),
      j = Math.floor(fy),
      tx = fx - i,
      ty = fy - j
    return lerp(lerp(px(i, j), px(i + 1, j), tx), lerp(px(i, j + 1), px(i + 1, j + 1), tx), ty)
  }

  // Land mask (red) + state borders (green), rasterised from the same outline the walls use
  const mW = 2048,
    mH = Math.round((mW * SH) / SW),
    s = mW / SW
  const mc = document.createElement('canvas')
  mc.width = mW
  mc.height = mH
  const mx = mc.getContext('2d', { willReadFrequently: true })!
  mx.fillStyle = '#000'
  mx.fillRect(0, 0, mW, mH)
  mx.setTransform(s, 0, 0, s, 0, 0)
  const P = D.outline
  const ol = new Path2D()
  for (let i = 0; i < P.length; i += 2) i ? ol.lineTo(P[i], P[i + 1]) : ol.moveTo(P[i], P[i + 1])
  ol.closePath()
  mx.fillStyle = '#f00'
  mx.fill(ol)
  for (const st of D.states) if (st.n === 'Andaman and Nicobar Islands' && st.d) mx.fill(new Path2D(st.d))
  mx.globalCompositeOperation = 'lighter'
  mx.strokeStyle = '#0f0'
  mx.lineWidth = 1.1
  mx.lineJoin = 'round'
  for (const st of D.states) if (st.d) mx.stroke(new Path2D(st.d))
  mx.setTransform(1, 0, 0, 1, 0, 0)
  const md = mx.getImageData(0, 0, mW, mH).data
  const inside = (x: number, y: number) => {
    const i = clamp(Math.round((x / SW) * mW), 0, mW - 1),
      j = clamp(Math.round((y / SH) * mH), 0, mH - 1)
    return md[(j * mW + i) * 4] > 127
  }

  return { height: dataTex(hc, false), lights: dataTex(li, true), mask: dataTex(mc, false), heightAt, inside }
}

const GLSL_H = /* glsl */ `
  uniform sampler2D uH;
  float hgt(vec2 uv) { float v = texture2D(uH, uv).r; return v * v * ${MAP.HMAX.toFixed(1)}; }
`

function terrainGeometry(a: Assets) {
  const NX = 400,
    NY = Math.round((NX * SH) / SW),
    pos = new Float32Array((NX + 1) * (NY + 1) * 3),
    uv = new Float32Array((NX + 1) * (NY + 1) * 2)
  for (let j = 0, k = 0; j <= NY; j++)
    for (let i = 0; i <= NX; i++, k++) {
      pos[k * 3] = (i / NX) * SW - SW / 2
      pos[k * 3 + 2] = (j / NY) * SH - SH / 2
      uv[k * 2] = i / NX
      uv[k * 2 + 1] = j / NY
    }
  // Keep only cells near land (dilated by one cell) so the ocean costs nothing
  const cw = SW / NX,
    ch = SH / NY,
    keep = new Uint8Array(NX * NY)
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const x = i * cw,
        y = j * ch
      if (
        a.inside(x, y) ||
        a.inside(x + cw, y) ||
        a.inside(x, y + ch) ||
        a.inside(x + cw, y + ch) ||
        a.inside(x + cw / 2, y + ch / 2)
      )
        keep[j * NX + i] = 1
    }
  const idx: number[] = []
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      let on = 0
      for (let dj = -1; dj <= 1 && !on; dj++)
        for (let di = -1; di <= 1 && !on; di++) {
          const ii = i + di,
            jj = j + dj
          if (ii >= 0 && jj >= 0 && ii < NX && jj < NY && keep[jj * NX + ii]) on = 1
        }
      if (!on) continue
      const A = j * (NX + 1) + i,
        B = A + 1,
        C = A + NX + 1,
        E = C + 1
      idx.push(A, C, B, B, C, E)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(SW, SH))
  return g
}

function wallGeometry(a: Assets) {
  const P = D.outline,
    n = P.length / 2
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += P[i * 2] * P[j * 2 + 1] - P[j * 2] * P[i * 2 + 1]
  }
  const sgn = area > 0 ? 1 : -1
  const pos: number[] = [],
    nor: number[] = [],
    top: number[] = [],
    hm: number[] = []
  const H = Array.from({ length: n }, (_, i) => a.heightAt(P[i * 2], P[i * 2 + 1]))
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      x0 = P[i * 2],
      y0 = P[i * 2 + 1],
      x1 = P[j * 2],
      y1 = P[j * 2 + 1],
      dx = x1 - x0,
      dy = y1 - y0,
      L = Math.hypot(dx, dy) || 1,
      nx = (-dy / L) * sgn,
      nz = (dx / L) * sgn
    const v = (x: number, y: number, t: number, h: number) => {
      pos.push(x - SW / 2, 0, y - SH / 2)
      nor.push(nx, 0, nz)
      top.push(t)
      hm.push(h)
    }
    v(x0, y0, 1, H[i]), v(x0, y0, 0, 0), v(x1, y1, 1, H[j])
    v(x1, y1, 1, H[j]), v(x0, y0, 0, 0), v(x1, y1, 0, 0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1))
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hm, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.hypot(SW, SH))
  return g
}

const SUN = new THREE.Vector3(-0.55, 0.62, -0.56).normalize()

function India({ a }: { a: Assets }) {
  const tGeo = useMemo(() => terrainGeometry(a), [a])
  const wGeo = useMemo(() => wallGeometry(a), [a])
  const uniforms = useMemo(
    () => ({
      uH: { value: a.height },
      uL: { value: a.lights },
      uM: { value: a.mask },
      uTex: { value: new THREE.Vector2(1 / (a.height.image as HTMLCanvasElement).width, 1 / (a.height.image as HTMLCanvasElement).height) },
      uScale: { value: H_SCALE },
      uRise: { value: 0 },
      uLights: { value: 0 },
      uSun: { value: SUN },
      uBase: { value: MAP.BASE },
      uTime: { value: 0 },
    }),
    [a],
  )
  const tMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          ${GLSL_H}
          uniform float uScale, uRise;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.y = hgt(uv) * uScale * uRise;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          ${GLSL_H}
          uniform sampler2D uL, uM;
          uniform vec2 uTex;
          uniform float uScale, uRise, uLights, uTime;
          uniform vec3 uSun;
          varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
          void main() {
            vec4 m = texture2D(uM, vUv);
            if (m.r < 0.5) discard;
            float s = uScale * uRise;
            float hl = hgt(vUv - vec2(uTex.x, 0.0)), hr = hgt(vUv + vec2(uTex.x, 0.0));
            float hu = hgt(vUv - vec2(0.0, uTex.y)), hd = hgt(vUv + vec2(0.0, uTex.y));
            vec3 n = normalize(vec3(-(hr - hl) * s / (2.0 * uTex.x * ${SW.toFixed(2)}), 1.0,
                                    -(hd - hu) * s / (2.0 * uTex.y * ${SH.toFixed(2)})));
            float v = texture2D(uH, vUv).r;                 // sqrt-encoded elevation 0..1
            float diff = max(dot(n, uSun), 0.0);
            float slope = 1.0 - n.y;
            // Monochrome relief: dark plains, lighter rock and snow up high
            float alb = mix(0.02, 0.062, smoothstep(0.05, 0.45, v));
            alb = mix(alb, 0.30, smoothstep(0.62, 0.9, v));
            vec3 col = vec3(alb * (0.32 + 1.25 * diff) - slope * 0.01);
            col *= 0.92 + 0.08 * hash(floor(vUv * 2048.0));
            col = mix(col, vec3(0.052), m.g * 0.55);          // faint state borders
            vec3 flatC = mix(vec3(0.0103), vec3(0.0232), m.g); // matches the 2D map's #1A1A1A / #2A2A2A
            col = mix(flatC, col, uRise);
            // City lights, amber, with paler cores
            float L = texture2D(uL, vUv).r;
            L = pow(smoothstep(0.05, 1.0, L), 1.25);
            float flick = 0.94 + 0.06 * sin(uTime * 1.7 + hash(floor(vUv * 900.0)) * 30.0);
            vec3 glow = vec3(1.0, 0.42, 0.075) * L + vec3(0.0, 0.17, 0.08) * pow(L, 3.0);
            col += glow * uLights * flick;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [uniforms],
  )
  const wMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          attribute float aTop;
          attribute float aH;
          uniform float uScale, uRise, uBase;
          varying float vTop;
          varying vec3 vN;
          void main() {
            vTop = aTop;
            vN = normal;
            vec3 p = position;
            p.y = aTop > 0.5 ? aH * uScale * uRise : -uBase * uRise;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun;
          uniform float uLights;
          varying float vTop;
          varying vec3 vN;
          void main() {
            float d = 0.45 + 0.55 * max(dot(normalize(vN), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
            vec3 col = vec3(mix(0.0015, 0.016, vTop * vTop) * d);
            col += vec3(1.0, 0.55, 0.18) * smoothstep(0.93, 1.0, vTop) * 0.05 * uLights; // warm rim
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [uniforms],
  )
  useEffect(() => () => {
    tGeo.dispose()
    wGeo.dispose()
    tMat.dispose()
    wMat.dispose()
  }, [tGeo, wGeo, tMat, wMat])

  useFrame((st) => {
    const r = globe.state.rise
    uniforms.uRise.value = r
    uniforms.uLights.value = clamp((r - 0.25) / 0.75)
    uniforms.uTime.value = st.clock.elapsedTime
  })

  return (
    <group>
      <mesh geometry={tGeo} material={tMat} frustumCulled={false} />
      <mesh geometry={wGeo} material={wMat} frustumCulled={false} />
    </group>
  )
}

type Pose = { target: THREE.Vector3; r: number; phi: number; theta: number }

function Rig({ a }: { a: Assets }) {
  const { camera, size } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const free = useRef<Pose>({ target: new THREE.Vector3(), r: 1, phi: 0.9, theta: 0 })
  const tween = useRef<{ from: Pose; to: Pose; t0: number; dur: number } | null>(null)
  const frames = useRef(0)
  const wasFree = useRef(false)
  const hot = useMemo(() => new THREE.Vector3(), [])
  const hGur = useMemo(() => a.heightAt(HX, HY), [a])
  const tmp = useMemo(() => new THREE.Spherical(), [])

  const r0 = () => {
    const v = globe.view
    return v.H / v.k / 2 / Math.tan((MAP.FOV * DEG) / 2)
  }
  const defaultPose = (): Pose => {
    const portrait = globe.view.W < globe.view.H
    return {
      target: new THREE.Vector3(0, 0, portrait ? 0 : 40),
      r: r0() * (portrait ? 0.9 : 0.74),
      phi: (portrait ? 46 : 52) * DEG,
      theta: (portrait ? -8 : -14) * DEG,
    }
  }
  const current = (): Pose => {
    const t = controls.current?.target.clone() ?? new THREE.Vector3()
    tmp.setFromVector3(camera.position.clone().sub(t))
    return { target: t, r: tmp.radius, phi: tmp.phi, theta: tmp.theta }
  }
  const apply = (p: Pose) => {
    camera.position.setFromSphericalCoords(p.r, p.phi, p.theta).add(p.target)
    camera.lookAt(p.target)
    controls.current?.target.copy(p.target)
  }
  const mix = (A: Pose, B: Pose, t: number): Pose => {
    let dt = B.theta - A.theta
    dt = Math.atan2(Math.sin(dt), Math.cos(dt))
    return {
      target: A.target.clone().lerp(B.target, t),
      r: lerp(A.r, B.r, t),
      phi: lerp(A.phi, B.phi, t),
      theta: A.theta + dt * t,
    }
  }

  useEffect(() => {
    globe.resetFree = () => {
      free.current = defaultPose()
    }
    globe.capture = () => {
      tween.current = null
      free.current = current()
    }
    globe.recenter = () => {
      if (!globe.state.interact) return
      tween.current = { from: current(), to: defaultPose(), t0: performance.now(), dur: 1300 }
    }
    if (import.meta.env.DEV) (globe as unknown as { debug: () => unknown }).debug = () => ({ cam: camera.position.toArray(), free: free.current, state: { ...globe.state } })
    const c = controls.current
    const onStart = () => {
      tween.current = null
      globe.onInteract?.()
    }
    c?.addEventListener('start', onStart)
    return () => c?.removeEventListener('start', onStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => {
    const s = globe.state,
      c = controls.current
    const R0 = r0()
    if (c) {
      c.enabled = s.interact && !tween.current
      c.minDistance = R0 * 0.22
      c.maxDistance = R0 * 1.5
    }
    if (tween.current) {
      const tw = tween.current,
        t = clamp((performance.now() - tw.t0) / tw.dur)
      apply(mix(tw.from, tw.to, ease(t)))
      if (t >= 1) tween.current = null
    } else if (!s.interact) {
      const aligned: Pose = { target: new THREE.Vector3(), r: R0, phi: 1e-4, theta: 0 }
      apply(mix(aligned, free.current, s.cam))
      wasFree.current = false
    } else if (!wasFree.current) {
      // hand over to the orbit controls from the exact end pose, even if the last tween frame was skipped
      wasFree.current = true
      apply(free.current)
    } else if (c) {
      // keep panning on the map
      c.target.x = clamp(c.target.x, -SW * 0.45, SW * 0.45)
      c.target.z = clamp(c.target.z, -SH * 0.45, SH * 0.45)
      c.target.y = 0
    }
    if (globe.hotEl && s.on) {
      hot.set(HX - SW / 2, hGur * H_SCALE * s.rise, HY - SH / 2).project(camera)
      const x = ((hot.x + 1) / 2) * size.width,
        y = ((1 - hot.y) / 2) * size.height
      globe.hotEl.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
    }
    if (++frames.current === 3) globe.settle(true)
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      panSpeed={0.8}
      screenSpacePanning={false}
      maxPolarAngle={74 * DEG}
    />
  )
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

export default function IndiaGlobe() {
  const [a, setA] = useState<Assets | null>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    let dead = false
    if (!hasWebGL()) {
      globe.settle(false)
      return
    }
    loadAssets()
      .then((x) => !dead && setA(x))
      .catch((e) => {
        console.warn('3D map unavailable', e)
        globe.settle(false)
      })
    globe.onToggle = (v) => setOn(v)
    return () => {
      dead = true
      globe.onToggle = null
    }
  }, [])

  if (!a) return null
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      frameloop={on || !globe.ready ? 'always' : 'never'}
      camera={{ fov: MAP.FOV, near: 2, far: 20000, position: [0, 2000, 0.01] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', () => globe.settle(false))
      }}
    >
      <color attach="background" args={['#0A0A0A']} />
      <India a={a} />
      <Rig a={a} />
      <EffectComposer multisampling={2}>
        <Bloom mipmapBlur luminanceThreshold={0.22} luminanceSmoothing={0.2} intensity={1.35} radius={0.72} />
      </EffectComposer>
    </Canvas>
  )
}
