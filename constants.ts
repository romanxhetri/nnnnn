
import { MenuItem, Badge, User, PromoCode } from './types';

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'lf-01',
    name: 'Classic Cheesy Fries',
    description: 'Crispy golden fries smothered in our signature three-cheese sauce and topped with fresh chives.',
    price: 8.99,
    image: 'https://picsum.photos/seed/classicfries/400/300',
    category: 'Loaded Fries',
    rating: 4.8,
    spicyLevel: 0,
    dietaryTags: ['Vegetarian'],
    customizations: [
      {
        title: 'Extra Toppings',
        type: 'multiple',
        options: [
          { name: 'Bacon Bits', priceModifier: 1.50 },
          { name: 'Jalapeños', priceModifier: 0.75 },
          { name: 'Sour Cream', priceModifier: 0.50 },
        ],
      },
    ],
  },
  {
    id: 'lf-02',
    name: 'Spicy Volcano Fries',
    description: 'A fiery eruption of flavor! Fries topped with spicy chili, jalapeños, and a drizzle of sriracha aioli.',
    price: 10.99,
    image: 'https://picsum.photos/seed/volcanofries/400/300',
    category: 'Loaded Fries',
    rating: 4.6,
    spicyLevel: 3,
    dietaryTags: [],
  },
    {
    id: 'lf-03',
    name: 'Vegan Delight Fries',
    description: 'Perfectly seasoned fries with vegan cheese, black beans, corn salsa, and avocado crema.',
    price: 11.99,
    image: 'https://picsum.photos/seed/veganfries/400/300',
    category: 'Loaded Fries',
    rating: 4.9,
    spicyLevel: 1,
    dietaryTags: ['Vegetarian', 'Vegan'],
    customizations: [
      {
        title: 'Protein Boost',
        type: 'single',
        options: [
          { name: 'None', priceModifier: 0 },
          { name: 'Grilled Tofu', priceModifier: 2.00 },
          { name: 'Plant-based "Beef"', priceModifier: 2.50 },
        ],
      },
    ],
  },
  {
    id: 'sd-01',
    name: 'Golden Potato Tots',
    description: 'Crispy, fluffy, and perfectly golden potato tots. A classic for a reason.',
    price: 4.50,
    image: 'https://picsum.photos/seed/tots/400/300',
    category: 'Sides',
    rating: 4.5,
    spicyLevel: 0,
    dietaryTags: ['Vegetarian', 'Vegan', 'Gluten-Free'],
  },
  {
    id: 'sd-02',
    name: 'Onion Rings Tower',
    description: 'A towering stack of beer-battered onion rings, served with our zesty dipping sauce.',
    price: 6.99,
    image: 'https://picsum.photos/seed/onionrings/400/300',
    category: 'Sides',
    rating: 4.7,
    spicyLevel: 0,
    dietaryTags: ['Vegetarian'],
  },
  {
    id: 'dr-01',
    name: 'Fresh Lemonade',
    description: 'House-made lemonade, perfectly sweet and tart.',
    price: 3.50,
    image: 'https://picsum.photos/seed/lemonade/400/300',
    category: 'Drinks',
    rating: 4.9,
    spicyLevel: 0,
    dietaryTags: ['Vegetarian', 'Vegan', 'Gluten-Free'],
  },
];

export const DAILY_SPECIAL_ID = 'lf-02';

export const BADGES: Badge[] = [
    { id: 'b01', name: 'First Fry', description: 'Placed your very first order!', icon: '🍟', unlocks: 'Chef Hat' },
    { id: 'b02', name: 'Loaded Legend', description: 'Tried all loaded fry varieties.', icon: '👑', unlocks: 'Crown' },
    { id: 'b03', name: 'Spud Saver', description: 'Redeemed points for the first time.', icon: '💰' },
    { id: 'b04', name: 'Night Owl', description: 'Placed an order after 10 PM.', icon: '🦉' },
];

export const USERS: User[] = [
    {
        id: 'user-01',
        name: 'Admin',
        email: 'admin@potato.com',
        password: 'admin',
        spudPoints: 1337,
        badges: ['b01', 'b02'],
        avatar: { base: '🥔', accessories: ['Chef Hat', 'Crown'] },
        isAdmin: true,
    },
    {
        id: 'user-02',
        name: 'FryFanatic',
        email: 'fan@potato.com',
        password: 'password',
        spudPoints: 850,
        badges: ['b01', 'b03'],
        avatar: { base: '🥔', accessories: ['Chef Hat'] },
        isAdmin: false,
    },
];

export const PROMO_CODES: PromoCode[] = [
    { code: 'SPUDTASTIC', discountPercentage: 15, isActive: true },
    { code: 'FRIDAYFRIES', discountPercentage: 10, isActive: true },
    { code: 'INACTIVE', discountPercentage: 20, isActive: false },
];

export const LEADERBOARD_DATA: Partial<User>[] = [
    { name: 'Admin', spudPoints: 1337 },
    { name: 'FryFanatic', spudPoints: 850 },
    { name: 'SpudQueen', spudPoints: 720 },
    { name: 'Lord of the Fries', spudPoints: 680 },
    { name: 'PotatoPete', spudPoints: 510 },
]

export const SPUD_POINT_VALUE = 0.01; // 100 points = $1
