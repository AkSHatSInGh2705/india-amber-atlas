export type FoodItem = {
  name: string
  quantity: string
  veg: boolean
  bestBefore: string
}

export type Vendor = {
  name: string
  area: string
  image: string
  /** Offset from the Gurugram hotspot, in map units */
  dx: number
  dy: number
  pickupWindow: string
  items: FoodItem[]
  tint: [string, string]
}

const item = (name: string, quantity: string, veg: boolean, bestBefore: string): FoodItem => ({
  name,
  quantity,
  veg,
  bestBefore,
})

export const VENDORS: Vendor[] = [
  {
    name: 'Annapurna Kitchen',
    area: 'Sector 29',
    image: '/vendors/annapurna-kitchen.webp',
    dx: 2.2,
    dy: -1.6,
    pickupWindow: '7:30 – 9:00 pm',
    items: [
      item('Dal makhani', '24 servings', true, '10:30 pm'),
      item('Jeera rice', '18 servings', true, '10:00 pm'),
      item('Butter chicken', '12 servings', false, '9:45 pm'),
    ],
    tint: ['#F3C9A5', '#D96B43'],
  },
  {
    name: 'Saffron Bakehouse',
    area: 'DLF Phase 2',
    image: '/vendors/saffron-bakehouse.webp',
    dx: -3.4,
    dy: -2.6,
    pickupWindow: '8:00 – 9:30 pm',
    items: [
      item('Butter croissants', '30 pieces', true, 'Tomorrow 10 am'),
      item('Sourdough loaves', '8 loaves', true, 'Tomorrow 9 am'),
      item('Chicken puffs', '14 pieces', false, '9:00 pm'),
    ],
    tint: ['#F6DFA9', '#C9893A'],
  },
  {
    name: 'Green Leaf Café',
    area: 'Sushant Lok',
    image: '/vendors/green-leaf-cafe.webp',
    dx: 4.6,
    dy: 1.8,
    pickupWindow: '6:45 – 8:15 pm',
    items: [
      item('Quinoa salad bowls', '16 bowls', true, '9:00 pm'),
      item('Veg wraps', '22 wraps', true, '9:30 pm'),
      item('Fruit cups', '20 cups', true, '8:45 pm'),
    ],
    tint: ['#CFE0B8', '#5E8A4B'],
  },
  {
    name: 'Tandoor Junction',
    area: 'Sohna Road',
    image: '/vendors/tandoor-junction.webp',
    dx: -1.2,
    dy: 3.2,
    pickupWindow: '9:00 – 10:30 pm',
    items: [
      item('Tandoori roti', '60 pieces', true, '11:00 pm'),
      item('Paneer tikka masala', '15 servings', true, '11:00 pm'),
      item('Chicken biryani', '20 servings', false, '10:45 pm'),
    ],
    tint: ['#EAC3A8', '#B3402A'],
  },
  {
    name: 'Udyog Kitchens',
    area: 'Udyog Vihar',
    image: '/vendors/udyog-kitchens.webp',
    dx: -5.8,
    dy: 0.8,
    pickupWindow: '8:30 – 10:00 pm',
    items: [
      item('Rajma chawal', '40 servings', true, '10:30 pm'),
      item('Veg pulao', '25 servings', true, '10:30 pm'),
      item('Egg curry', '12 servings', false, '10:00 pm'),
    ],
    tint: ['#E7D8BC', '#8A6A3B'],
  },
  {
    name: 'MG Road Deli',
    area: 'MG Road',
    image: '/vendors/mg-road-deli.webp',
    dx: 1,
    dy: -4.2,
    pickupWindow: '7:00 – 8:30 pm',
    items: [
      item('Sandwich platters', '12 platters', true, '9:00 pm'),
      item('Pasta bake', '10 trays', true, '9:15 pm'),
      item('Grilled chicken', '9 portions', false, '8:45 pm'),
    ],
    tint: ['#D9DEC5', '#1E3F20'],
  },
]

/** Copy from the capstone deck, slide 5 */
export const STEPS: [title: string, description: string, tech: string][] = [
  ['Post', 'Donor lists surplus with pickup window.', 'React web app'],
  ['Store', 'Saved with location and expiry.', 'Firebase'],
  ['Notify', 'Nearby receivers get a push alert.', 'Firebase · Flutter app'],
  ['Claim', 'First valid claim locks it.', 'No double claims'],
  ['Pickup', 'Receiver collects, donor confirms, impact logged.', 'Flutter · OpenStreetMap'],
]
