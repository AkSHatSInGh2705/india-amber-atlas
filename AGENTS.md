<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- The FoodBridge landing is an imperative GSAP engine (`src/lib/foodbridge-engine.ts`) driving static markup; keep scene logic there rather than in React state, because it was ported as-is from the original Next.js app.
- The 3D India map (`src/components/foodbridge/india-globe.tsx`, R3F) talks to the engine only through the plain `globe` object in `src/lib/india3d.ts`; the engine animates `globe.state`, the scene reads it per frame, so neither imports the other.
- 3D world units equal the SVG map units of `src/lib/map-data.json` (equirectangular: x = 31.5164·lon − 2127.208, y = 1274.27 − 33.966·lat), so the flat 3D pose lines up pixel-for-pixel with the 2D map for the crossfade.
- Terrain and night-light textures are pre-baked offline (AWS Terrarium elevation, sqrt-encoded to `HMAX` metres; NASA Black Marble 2016) into that same map space and served as Lovable assets; rebake both if the map projection changes.
- Dev builds expose `window.__globe` (state + `debug()`) and `window.__gsap` for scripted checks; the sandbox renders WebGL at ~1 fps, so call `__gsap.ticker.lagSmoothing(0)` before timing anything.
- tsconfig turns off `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature` because the ported engine relies on plain indexed access.
- Volunteer listings live in Lovable Cloud (`volunteer_listings` public-read/owner-write, phone in owner-only `volunteer_contacts`); React publishes them to the engine via `publishListings` in `src/lib/listings.ts` and the engine diffs pins by listing id, so the map never imports the backend client.
- The ink-smear clip-path reveal lives in `src/lib/ink.ts` and is shared by the engine and React (`useInkSwap`), so every panel and view swap uses the same wet-ink edge.
- The pickup directions window (`src/components/foodbridge/directions-window.tsx`) draws a keyless Leaflet/OpenStreetMap map with an OSRM driving route (`directions-map.tsx`, lazy-loaded behind `<ClientOnly>` because Leaflet needs `window` at import); the engine opens it only through `openDirections` in `src/lib/directions.ts`, so the engine stays free of React and map code.
- Dark mode is `html.dark` overrides in `src/foodbridge-dark.css` (light rules in `foodbridge.css` stay untouched); the toggle (`src/components/theme/theme-toggle.tsx`) shows only when `window.__fbLive`, persists to localStorage, and an inline head script applies it before paint. Engine colours set via GSAP read CSS vars through `cssVar()` so they follow the theme.
