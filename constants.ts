import React from 'react';
import { MenuItem, Badge, User, PromoCode, DailyChallenge } from './types';

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'lf-01',
    name: 'Classic Cheesy Fries',
    description: 'Crispy golden fries smothered in our signature three-cheese sauce and topped with fresh chives.',
    price: 8.99,
    image: 'https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'Loaded Fries',
    rating: 4.8,
    reviews: [
        { userName: 'FryFanatic', rating: 5, comment: 'The cheese sauce is heavenly! A must-try.' },
        { userName: 'SpudQueen', rating: 4, comment: 'A bit salty for my taste, but still delicious and very cheesy.' },
        { userName: 'PotatoPete', rating: 5, comment: 'Perfect comfort food. I order this every time.' },
    ],
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
    image: 'https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'Loaded Fries',
    rating: 4.6,
    reviews: [
        { userName: 'Lord of the Fries', rating: 5, comment: 'Finally, something with a real kick! The spice level is perfect.' },
        { userName: 'Admin', rating: 4, comment: 'Very tasty, but have a drink ready!' },
    ],
    spicyLevel: 3,
    dietaryTags: [],
  },
    {
    id: 'lf-03',
    name: 'Vegan Delight Fries',
    description: 'Perfectly seasoned fries with vegan cheese, black beans, corn salsa, and avocado crema.',
    price: 11.99,
    image: 'https://images.pexels.com/photos/10790638/pexels-photo-10790638.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'Loaded Fries',
    rating: 4.9,
    reviews: [
        { userName: 'SpudQueen', rating: 5, comment: 'Best vegan fries in town. The avocado crema is amazing.' },
    ],
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
    image: 'https://images.pexels.com/photos/6813636/pexels-photo-6813636.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
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
    image: 'https://images.pexels.com/photos/1556410/pexels-photo-1556410.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
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
    image: 'https://images.pexels.com/photos/1293268/pexels-photo-1293268.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    category: 'Drinks',
    rating: 4.9,
    spicyLevel: 0,
    dietaryTags: ['Vegetarian', 'Vegan', 'Gluten-Free'],
  },
];

export const CATEGORIES = [
  {
    name: 'Loaded Fries',
    image: 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    description: 'Our signature creations, piled high with delicious toppings.'
  },
  {
    name: 'Sides',
    image: 'https://images.pexels.com/photos/2741458/pexels-photo-2741458.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    description: 'The perfect companions for your potato adventure.'
  },
  {
    name: 'Drinks',
    image: 'https://images.pexels.com/photos/338713/pexels-photo-338713.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    description: 'Quench your thirst with our refreshing beverages.'
  }
];

export const DAILY_SPECIAL_ID = 'lf-01'; // Changed to Classic Cheesy Fries for variety

export const DAILY_CHALLENGE: DailyChallenge = {
    id: 'dc-volcano',
    title: 'Volcano Voyager',
    description: 'Brave the heat! Order the Spicy Volcano Fries today to earn a fiery bonus.',
    menuItemId: 'lf-02',
    pointBonus: 100,
};

export const BADGES: Badge[] = [
    { id: 'b01', name: 'First Fry', description: 'Placed your very first order!', icon: '🍟', unlocks: 'Chef Hat' },
    { id: 'b02', name: 'Loaded Legend', description: 'Tried all loaded fry varieties.', icon: '👑', unlocks: 'Crown' },
    { id: 'b03', name: 'Spud Saver', description: 'Redeemed points for the first time.', icon: '💰' },
    { id: 'b04', name: 'Night Owl', description: 'Placed an order after 10 PM.', icon: '🦉', unlocks: 'Cool Shades' },
];

export const AVATAR_ACCESSORIES: Record<string, { icon: string; style: React.CSSProperties }> = {
    'Chef Hat': {
        icon: '👨‍🍳',
        style: { fontSize: '3rem', top: '-2rem', left: '0.5rem' }
    },
    'Crown': {
        icon: '👑',
        style: { fontSize: '2.5rem', top: '-1.8rem', left: '0.8rem', transform: 'rotate(-15deg)' }
    },
    'Cool Shades': {
        icon: '😎',
        style: { fontSize: '3.5rem', top: '0.8rem', left: '0.2rem', transform: 'rotate(0deg)' }
    }
};

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
        completedChallenges: [],
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
        completedChallenges: [],
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