

export interface CustomizationOption {
  name: string;
  priceModifier: number;
}

export interface Customization {
  title: string;
  type: 'single' | 'multiple';
  options: CustomizationOption[];
}

export interface Review {
  userName: string;
  rating: number; // 1-5
  comment: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  reviews?: Review[];
  spicyLevel: 0 | 1 | 2 | 3;
  dietaryTags: ('Vegetarian' | 'Vegan' | 'Gluten-Free')[];
  customizations?: Customization[];
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedCustomizations: Record<string, CustomizationOption | CustomizationOption[]>;
  finalPrice: number;
  cartItemId: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocks?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Should be hashed in a real app
  spudPoints: number;
  badges: string[]; // Array of badge IDs
  avatar: {
    base: string;
    accessories: string[];
  };
  isAdmin: boolean;
  completedChallenges?: string[]; // Array of challenge IDs
}

export interface Order {
  id:string;
  userId: string | 'guest';
  items: CartItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: 'Confirmed' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Ready for Pickup';
  orderType: 'Delivery' | 'Pickup';
  address?: string;
  pickupTime?: string;
  createdAt: string;
}

export interface PromoCode {
  code: string;
  discountPercentage: number;
  isActive: boolean;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  menuItemId: string; // ID of the required menu item
  pointBonus: number;
}


export type Page = 'home' | 'checkout' | 'profile' | 'admin' | 'tracking' | 'leaderboard';
export type ModalType = 'login' | 'itemDetail' | 'aiChat' | 'aiVoice' | 'askChef' | 'confirm' | 'adminMenu' | 'adminPromo' | 'avatarCustomization' | 'generateAd';