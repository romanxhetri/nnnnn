import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
    MenuItem,
    CartItem,
    User,
    Badge,
    PromoCode,
    Order,
    Page,
    ModalType,
    Customization,
    CustomizationOption,
    DailyChallenge,
} from './types';
import {
    MENU_ITEMS,
    DAILY_SPECIAL_ID,
    BADGES,
    USERS,
    PROMO_CODES,
    LEADERBOARD_DATA,
    SPUD_POINT_VALUE,
    AVATAR_ACCESSORIES,
    DAILY_CHALLENGE,
    CATEGORIES,
} from './constants';
import * as GeminiService from './services/geminiService';
import { Chat, LiveServerMessage, LiveSession, Blob as GenAiBlob, FunctionCall, OperationsGetVideosOperationResponse } from '@google/genai';

// UTILITY FUNCTIONS

// AUDIO UTILITY FUNCTIONS
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): GenAiBlob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}


const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };
  return [storedValue, setValue];
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

// ICONS
const StarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);

const SpicyIcon: React.FC<{ level: number, className?: string }> = ({ level, className }) => {
    if (level === 0) return null;
    const peppers = '🌶️'.repeat(level);
    return <span className={`text-sm bg-white/20 backdrop-blur-sm rounded-full px-2 py-1 ${className}`}>{peppers}</span>;
}

const ShoppingCartIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
);

const UserCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0012 11z" clipRule="evenodd" /></svg>
);

const LogoutIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
);

const LoginIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
);

const TrophyIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976-2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
);

// Fix: Moved component definitions before the main App component to resolve "Cannot find name" errors due to declaration order.
// SUB-COMPONENTS (Defined outside main App to prevent re-renders)

const Header: React.FC<{
    user: User | null;
    onLoginClick: () => void;
    onLogout: () => void;
    cartItemCount: number;
    onCartClick: () => void;
    onNavigate: (page: Page) => void;
}> = ({ user, onLoginClick, onLogout, cartItemCount, onCartClick, onNavigate }) => (
    <header className="bg-white shadow-md sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
                <span className="text-3xl">🥔</span>
                <span className="text-2xl font-black text-brand-dark tracking-tighter">Potato & Friends</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
                 <button onClick={() => onNavigate('home')} className="text-gray-600 hover:text-brand-orange font-semibold">Menu</button>
                 <button onClick={() => onNavigate('leaderboard')} className="text-gray-600 hover:text-brand-orange font-semibold">Leaderboard</button>
                 {user?.isAdmin && <button onClick={() => onNavigate('admin')} className="text-gray-600 hover:text-brand-orange font-semibold">Admin</button>}
            </nav>
            <div className="flex items-center gap-4">
                <button onClick={onCartClick} className="relative">
                    <ShoppingCartIcon className="w-7 h-7 text-gray-600 hover:text-brand-orange" />
                    {cartItemCount > 0 && <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{cartItemCount}</span>}
                </button>
                {user ? (
                    <div className="flex items-center gap-2">
                        <button onClick={() => onNavigate('profile')} className="flex items-center gap-2">
                            <span className="text-3xl relative">
                                {user.avatar.base}
                                {user.avatar.accessories.map(acc => {
                                    const accessory = AVATAR_ACCESSORIES[acc];
                                    return accessory ? <span key={acc} className="absolute" style={accessory.style}>{accessory.icon}</span> : null;
                                })}
                            </span>
                            <span className="font-semibold hidden sm:inline">{user.name}</span>
                        </button>
                        <button onClick={onLogout}><LogoutIcon className="w-6 h-6 text-gray-600 hover:text-red-500" /></button>
                    </div>
                ) : (
                    <button onClick={onLoginClick} className="flex items-center gap-2 bg-brand-orange text-white font-bold py-2 px-4 rounded-full">
                        <LoginIcon className="w-5 h-5" />
                        <span>Login</span>
                    </button>
                )}
            </div>
        </div>
    </header>
);

const Footer: React.FC<{ onNavigate: (page: Page) => void }> = ({ onNavigate }) => (
    <footer className="bg-brand-dark text-white">
        <div className="container mx-auto px-4 py-8 text-center">
            <p>&copy; {new Date().getFullYear()} Potato & Friends. All rights reserved.</p>
            <div className="flex justify-center gap-4 mt-2">
                <button onClick={() => onNavigate('home')} className="hover:underline">Home</button>
                <span>|</span>
                <button onClick={() => onNavigate('profile')} className="hover:underline">Profile</button>
            </div>
        </div>
    </footer>
);

const ToastContainer: React.FC<{ toasts: { id: number; message: string; icon: string }[] }> = ({ toasts }) => (
    <div className="fixed top-20 right-4 z-50 space-y-2">
        {toasts.map(toast => (
            <div key={toast.id} className="bg-white shadow-lg rounded-lg p-3 flex items-center gap-3 animate-fade-in-out">
                <span className="text-xl">{toast.icon}</span>
                <p className="font-semibold">{toast.message}</p>
            </div>
        ))}
    </div>
);

const Modal: React.FC<{ onClose: () => void, children: React.ReactNode }> = ({ onClose, children }) => (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const CartSidebar: React.FC<{
    show: boolean;
    onClose: () => void;
    cart: CartItem[];
    total: number;
    onUpdateQuantity: (id: string, newQuantity: number) => void;
    onRemove: (id: string) => void;
    onCheckout: () => void;
}> = ({ show, onClose, cart, total, onUpdateQuantity, onRemove, onCheckout }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose}>
            <div className={`fixed top-0 right-0 h-full bg-white w-full max-w-sm shadow-2xl transform transition-transform ${show ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
                <div className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-black">Your Cart</h2>
                        <button onClick={onClose} className="text-2xl">&times;</button>
                    </div>
                    {cart.length === 0 ? (
                        <div className="flex-grow flex items-center justify-center text-gray-500">Your cart is empty.</div>
                    ) : (
                        <div className="flex-grow overflow-y-auto -mr-6 pr-6 space-y-4">
                            {cart.map(item => (
                                <div key={item.cartItemId} className="flex gap-4">
                                    <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
                                    <div className="flex-grow">
                                        <h3 className="font-bold">{item.name}</h3>
                                        <p className="text-sm text-gray-500">{formatCurrency(item.finalPrice)}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <button onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)} className="w-6 h-6 border rounded-full">-</button>
                                            <span>{item.quantity}</span>
                                            <button onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)} className="w-6 h-6 border rounded-full">+</button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end justify-between">
                                        <span className="font-bold">{formatCurrency(item.finalPrice * item.quantity)}</span>
                                        <button onClick={() => onRemove(item.cartItemId)} className="text-red-500 text-sm">Remove</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="border-t pt-6 mt-6">
                        <div className="flex justify-between font-bold text-xl mb-4">
                            <span>Total</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                        <button onClick={onCheckout} disabled={cart.length === 0} className="w-full bg-brand-green text-white font-bold py-3 rounded-full disabled:bg-gray-300">Checkout</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AuthModal: React.FC<{
    allUsers: User[];
    onLogin: (user: User) => void;
    onClose: () => void;
}> = ({ allUsers, onLogin, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const user = allUsers.find(u => u.email === email && u.password === password);
        if (user) {
            onLogin(user);
            onClose();
        } else {
            setError('Invalid email or password.');
        }
    };
    
    return (
        <form onSubmit={handleLogin}>
            <h2 className="text-2xl font-bold mb-4">Login</h2>
            {error && <p className="text-red-500 mb-2">{error}</p>}
            <div className="space-y-4">
                 <div>
                    <label className="block font-semibold">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded" required />
                </div>
                <div>
                    <label className="block font-semibold">Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded" required />
                </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Hint: admin@potato.com / admin, or fan@potato.com / password</p>
            <button type="submit" className="w-full mt-4 bg-brand-orange text-white font-bold py-2 px-4 rounded-lg">Login</button>
        </form>
    );
};

const ItemDetailModal: React.FC<{
    item: MenuItem;
    onAddToCart: (item: MenuItem, quantity: number, customizations: Record<string, CustomizationOption | CustomizationOption[]>) => void;
}> = ({ item, onAddToCart }) => {
    const [quantity, setQuantity] = useState(1);
    const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, CustomizationOption | CustomizationOption[]>>({});
    const [nutritionalInfo, setNutritionalInfo] = useState<{ calories: number, protein: number, carbs: number, fat: number } | null>(null);
    const [loadingNutrition, setLoadingNutrition] = useState(false);

    const handleCustomizationChange = (cust: Customization, option: CustomizationOption, checked?: boolean) => {
        setSelectedCustomizations(prev => {
            const newSelections = { ...prev };
            if (cust.type === 'single') {
                newSelections[cust.title] = option;
            } else { // multiple
                const current = (newSelections[cust.title] as CustomizationOption[]) || [];
                if (checked) {
                    newSelections[cust.title] = [...current, option];
                } else {
                    newSelections[cust.title] = current.filter(o => o.name !== option.name);
                }
            }
            return newSelections;
        });
    };
    
    const fetchNutritionalInfo = async () => {
        setLoadingNutrition(true);
        const info = await GeminiService.getNutritionalInfo(item);
        setNutritionalInfo(info);
        setLoadingNutrition(false);
    };

    const calculateFinalPrice = () => {
        let price = item.price;
        Object.values(selectedCustomizations).forEach(val => {
            if (Array.isArray(val)) {
                val.forEach(opt => price += opt.priceModifier);
            } else if (val) {
                price += (val as CustomizationOption).priceModifier;
            }
        });
        return price * quantity;
    }

    return (
        <div>
            <img src={item.image} alt={item.name} className="w-full h-64 object-cover rounded-lg mb-4" />
            <h2 className="text-3xl font-black mb-2">{item.name}</h2>
            <p className="text-gray-600 mb-4">{item.description}</p>
            {item.customizations?.map(cust => (
                <div key={cust.title} className="mb-4">
                    <h4 className="font-bold text-lg mb-2">{cust.title}</h4>
                    {cust.options.map(opt => (
                        <div key={opt.name} className="flex items-center gap-2">
                             <input 
                                type={cust.type === 'single' ? 'radio' : 'checkbox'}
                                name={cust.title}
                                onChange={(e) => handleCustomizationChange(cust, opt, e.target.checked)}
                             />
                             <label>{opt.name} (+{formatCurrency(opt.priceModifier)})</label>
                        </div>
                    ))}
                </div>
            ))}
            
             <div className="mt-4 p-4 border rounded-lg">
                <button onClick={fetchNutritionalInfo} className="text-brand-orange font-semibold">
                    {loadingNutrition ? 'Loading...' : 'Get Estimated Nutritional Info ✨'}
                </button>
                {nutritionalInfo && (
                    <div className="mt-2 text-sm grid grid-cols-2 gap-1">
                        <span>Calories: {nutritionalInfo.calories}</span>
                        <span>Protein: {nutritionalInfo.protein}g</span>
                        <span>Carbs: {nutritionalInfo.carbs}g</span>
                        <span>Fat: {nutritionalInfo.fat}g</span>
                    </div>
                )}
            </div>
            
            <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 border rounded-full font-bold">-</button>
                    <span className="text-xl font-bold">{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} className="w-8 h-8 border rounded-full font-bold">+</button>
                </div>
                <button onClick={() => onAddToCart(item, quantity, selectedCustomizations)} className="bg-brand-orange text-white font-bold py-3 px-6 rounded-full">
                    Add for {formatCurrency(calculateFinalPrice())}
                </button>
            </div>
        </div>
    );
};

const OrderConfirmation: React.FC<{ order: Order, onTrack: () => void }> = ({ order, onTrack }) => (
    <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold">Order Confirmed!</h2>
        <p className="text-gray-600">Your order #{order.id.slice(-6)} is being prepared.</p>
        <button onClick={onTrack} className="w-full mt-4 bg-brand-green text-white font-bold py-2 px-4 rounded-lg">Track Order</button>
    </div>
);

const AiAssistantModal: React.FC<{
    menuItems: MenuItem[];
    cart: CartItem[];
    cartTotal: number;
    findItemAndAddToCart: (itemName: string, quantity: number) => boolean;
}> = ({ menuItems, cart, cartTotal, findItemAndAddToCart }) => {
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<{ role: 'user' | 'model'; parts: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    useEffect(() => {
        setChatSession(GeminiService.createChatSession());
        setMessages([{ role: 'model', parts: "Hi! I'm Sathi, your personal spud-dy. How can I help you order today?" }]);
    }, []);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleFunctionCall = (functionCall: FunctionCall) => {
        switch (functionCall.name) {
            case 'addToCart':
                const items = functionCall.args.items as { itemName: string; quantity: number }[];
                let addedItems: string[] = [];
                items.forEach(item => {
                    if (findItemAndAddToCart(item.itemName, item.quantity)) {
                        addedItems.push(`${item.quantity}x ${item.itemName}`);
                    }
                });
                return { functionResponse: { name: 'addToCart', response: { result: addedItems.length > 0 ? `Added: ${addedItems.join(', ')}` : 'Could not find the item(s).' } } };
            case 'viewCart':
                const cartContents = cart.map(item => `${item.quantity}x ${item.name}`).join(', ');
                return { functionResponse: { name: 'viewCart', response: { result: cart.length > 0 ? `Your cart has: ${cartContents}. The total is ${formatCurrency(cartTotal)}.` : 'Your cart is empty.' } } };
            case 'getRecommendations':
                // For simplicity, we'll let the model handle this based on its context.
                return null;
            default:
                return null;
        }
    };
    
    const sendMessage = async () => {
        if (!input.trim() || !chatSession) return;
        const userMessage = { role: 'user' as const, parts: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            let result = await chatSession.sendMessage({ message: userMessage.parts });
            let response = result.response;
            
            const functionCalls = response.functionCalls;
            if (functionCalls) {
                const functionResponses: any[] = [];
                for(const call of functionCalls) {
                    const functionResponse = handleFunctionCall(call);
                    if (functionResponse) {
                        functionResponses.push(functionResponse);
                    }
                }
                
                if (functionResponses.length > 0) {
                     result = await chatSession.sendMessage({ tools: functionResponses });
                     response = result.response;
                }
            }
            
            const modelMessage = { role: 'model' as const, parts: response.text };
            setMessages(prev => [...prev, modelMessage]);

        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { role: 'model', parts: "I'm sorry, I seem to be having a potato-tly bad connection. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[70vh]">
            <h2 className="text-2xl font-bold mb-4">Chat with Sathi 🤖</h2>
            <div className="flex-grow overflow-y-auto bg-gray-100 p-4 rounded-lg space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-3 rounded-2xl max-w-xs ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white'}`}>
                            {msg.parts}
                        </div>
                    </div>
                ))}
                {isLoading && <div className="flex justify-start"><div className="p-3 rounded-2xl bg-white">...</div></div>}
                 <div ref={messagesEndRef} />
            </div>
            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    className="w-full p-2 border rounded-lg"
                    placeholder="Ask me anything..."
                    disabled={isLoading}
                />
                <button onClick={sendMessage} disabled={isLoading} className="bg-brand-orange text-white p-2 rounded-lg font-bold">Send</button>
            </div>
        </div>
    );
};

const VoiceAssistantModal: React.FC<{
    findItemAndAddToCart: (itemName: string, quantity: number) => boolean;
}> = ({ findItemAndAddToCart }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcription, setTranscription] = useState<{user: string, model: string}[]>([]);
    const sessionRef = useRef<LiveSession | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const handleFunctionCall = (functionCalls: FunctionCall[]) => {
        let response = 'Function call failed';
        for (const fc of functionCalls) {
            if (fc.name === 'addToCart') {
                const items = fc.args.items as { itemName: string, quantity: number }[];
                const added = items.map(i => findItemAndAddToCart(i.itemName, i.quantity)).some(Boolean);
                response = added ? 'I\'ve added that to your cart.' : 'I couldn\'t find that item.';
            }
        }
        return response;
    };
    
    const startListening = async () => {
        try {
            setIsListening(true);
            setTranscription([]);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            const sessionPromise = GeminiService.createLiveSession({
                 onOpen: () => {
                    console.log("Live session opened.");
                    mediaStreamSourceRef.current = audioContextRef.current!.createMediaStreamSource(stream);
                    scriptProcessorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                    };
                    mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(audioContextRef.current!.destination);
                },
                onMessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.outputTranscription?.text) {
                        setTranscription(prev => {
                            const last = prev[prev.length - 1];
                            if (last) {
                                return [...prev.slice(0, -1), {...last, model: last.model + message.serverContent!.outputTranscription!.text}];
                            }
                            return prev;
                        });
                    }
                     if (message.serverContent?.inputTranscription?.text) {
                        setTranscription(prev => {
                            const last = prev[prev.length - 1];
                             if (last && last.user !== '' && message.serverContent?.turnComplete) {
                               return [...prev, {user: message.serverContent!.inputTranscription!.text, model: ''}];
                             }
                            if (last) {
                                return [...prev.slice(0, -1), {...last, user: last.user + message.serverContent!.inputTranscription!.text}];
                            }
                            return [{user: message.serverContent!.inputTranscription!.text, model: ''}];
                        });
                    }
                     if (message.toolCall) {
                        const result = handleFunctionCall(message.toolCall.functionCalls);
                        sessionPromise.then(session => session.sendToolResponse({
                          functionResponses: {
                            id: message.toolCall.functionCalls[0].id,
                            name: message.toolCall.functionCalls[0].name,
                            response: { result: result },
                          }
                        }));
                    }
                },
                onError: (e) => console.error("Live session error:", e),
                onClose: () => console.log("Live session closed."),
            });
            sessionRef.current = await sessionPromise;

        } catch (error) {
            console.error("Error starting voice session:", error);
            setIsListening(false);
        }
    };
    
    const stopListening = () => {
        setIsListening(false);
        sessionRef.current?.close();
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        audioContextRef.current?.close();
        sessionRef.current = null;
    };
    
    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Voice Order</h2>
            <p className="text-gray-600 mb-4">Press the button and say something like "Add two Classic Cheesy Fries to my cart."</p>
            <button
                onClick={isListening ? stopListening : startListening}
                className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center transition-colors ${isListening ? 'bg-red-500' : 'bg-green-500'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
            </button>
            <p className="mt-2 text-sm font-semibold">{isListening ? "Listening..." : "Tap to start"}</p>
            
            <div className="mt-4 text-left bg-gray-100 p-2 rounded-lg min-h-[100px]">
                {transcription.map((t, i) => (
                    <div key={i}>
                        <p><span className="font-bold">You:</span> {t.user}</p>
                        <p><span className="font-bold">Sathi:</span> {t.model}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AskTheChefModal: React.FC<{ menuItems: MenuItem[] }> = ({ menuItems }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState<{text: string; mapLinks: {title: string; uri: string}[]} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const handleAsk = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        const res = await GeminiService.getChefRecommendation(menuItems, query);
        setResponse(res);
        setIsLoading(false);
    };
    
    return (
        <div>
            <h2 className="text-2xl font-bold mb-2">Ask Chef Spud 👨‍🍳</h2>
            <p className="text-gray-600 mb-4">What are you in the mood for? Looking for directions?</p>
            <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full p-2 border rounded-lg"
                placeholder="e.g., 'What's the spiciest thing you have?' or 'Where is the nearest store?'"
                rows={3}
            />
            <button onClick={handleAsk} disabled={isLoading} className="w-full mt-2 bg-brand-orange text-white p-2 rounded-lg font-bold">
                {isLoading ? 'Thinking...' : 'Ask'}
            </button>
            {response && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                    <p className="font-semibold">Chef Spud says:</p>
                    <p>{response.text}</p>
                    {response.mapLinks.length > 0 && (
                        <div className="mt-2">
                            <p className="font-semibold">Relevant Locations:</p>
                            {response.mapLinks.map(link => (
                                <a key={link.uri} href={link.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">{link.title}</a>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const AvatarCustomizationModal: React.FC<{
    user: User;
    badges: Badge[];
    onSave: (user: User) => void;
}> = ({ user, badges, onSave }) => {
    const [selectedAccessories, setSelectedAccessories] = useState(user.avatar.accessories);

    const unlockedAccessories = badges
        .filter(b => user.badges.includes(b.id) && b.unlocks)
        .map(b => b.unlocks!);

    const handleToggleAccessory = (accessoryName: string) => {
        setSelectedAccessories(prev =>
            prev.includes(accessoryName)
                ? prev.filter(a => a !== accessoryName)
                : [...prev, accessoryName]
        );
    };
    
    const handleSave = () => {
        onSave({ ...user, avatar: { ...user.avatar, accessories: selectedAccessories } });
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Customize Your Avatar</h2>
            <div className="flex justify-center my-8">
                <div className="text-8xl relative">
                    {user.avatar.base}
                     {selectedAccessories.map(acc => {
                        const accessory = AVATAR_ACCESSORIES[acc];
                        return accessory ? <span key={acc} className="absolute" style={accessory.style}>{accessory.icon}</span> : null;
                    })}
                </div>
            </div>
            
            <h3 className="font-bold mb-2">Unlocked Accessories:</h3>
            <div className="grid grid-cols-3 gap-4">
                {unlockedAccessories.map(accName => (
                    <button key={accName} onClick={() => handleToggleAccessory(accName)} className={`p-2 border-2 rounded-lg text-center ${selectedAccessories.includes(accName) ? 'border-brand-orange' : ''}`}>
                         <span className="text-4xl">{AVATAR_ACCESSORIES[accName].icon}</span>
                         <p className="text-sm">{accName}</p>
                    </button>
                ))}
            </div>
            {unlockedAccessories.length === 0 && <p className="text-gray-500">No accessories unlocked yet. Keep earning badges!</p>}
            
            <button onClick={handleSave} className="w-full mt-6 bg-brand-green text-white font-bold py-2 px-4 rounded-lg">Save</button>
        </div>
    );
};

const AdminPromoModal: React.FC<{
    promo: PromoCode | null;
    onSave: (promo: PromoCode) => void;
    onAdd: (promo: PromoCode) => void;
}> = ({ promo, onSave, onAdd }) => {
    const [code, setCode] = useState(promo?.code ?? '');
    const [discount, setDiscount] = useState(promo?.discountPercentage ?? 10);
    const [isActive, setIsActive] = useState(promo?.isActive ?? true);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const promoData = { code: code.toUpperCase(), discountPercentage: discount, isActive };
        if (promo) {
            onSave(promoData);
        } else {
            onAdd(promoData);
        }
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4">{promo ? 'Edit' : 'Add'} Promo Code</h2>
            <div className="space-y-4">
                 <div>
                    <label className="block font-semibold">Code</label>
                    <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full p-2 border rounded" required disabled={!!promo} />
                </div>
                <div>
                    <label className="block font-semibold">Discount Percentage</label>
                    <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-full p-2 border rounded" required />
                </div>
                <div>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                        Active
                    </label>
                </div>
            </div>
            <button type="submit" className="w-full mt-4 bg-brand-green text-white font-bold py-2 px-4 rounded-lg">Save</button>
        </form>
    );
};

// Fix: Moved the AIStudio interface into `declare global` to resolve the "subsequent property declarations" error.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }

    interface Window {
        aistudio?: AIStudio;
    }
}

const GenerateAdModal: React.FC<{ item: MenuItem, showToast: (msg: string, icon?: string) => void }> = ({ item, showToast }) => {
    const [prompt, setPrompt] = useState('');
    const [videoOperation, setVideoOperation] = useState<OperationsGetVideosOperationResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeySelected, setApiKeySelected] = useState(false);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setApiKeySelected(true);
            }
        };
        checkKey();
    }, []);

    const generatePrompt = async () => {
        setIsLoading(true);
        const newPrompt = await GeminiService.generateVideoPrompt(item);
        setPrompt(newPrompt);
        setIsLoading(false);
    };

    const generateVideo = async () => {
        if (!prompt) {
            showToast('Please generate a prompt first', '❗');
            return;
        }

        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
        }

        setIsLoading(true);
        setVideoOperation(null);
        try {
            const result = await GeminiService.generateVideoAd(prompt);
            setVideoOperation(result);
            if (result) {
                showToast('Video generated successfully!', '🎉');
            } else {
                 showToast('Video generation failed.', '❌');
            }
        } catch (error: any) {
            showToast(error.message || 'An unknown error occurred.', '❌');
            if (error.message.includes("API key error")) {
                setApiKeySelected(false);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
     const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setApiKeySelected(true);
        }
    };

    if (!apiKeySelected) {
        return (
             <div>
                <h2 className="text-2xl font-bold mb-4">Select API Key</h2>
                <p className="mb-4">Video generation with Veo requires a personal API key. Please select one to continue.</p>
                <p className="text-sm text-gray-500 mb-4">Note: This may incur charges. Please see <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">billing documentation</a> for details.</p>
                <button onClick={handleSelectKey} className="w-full bg-brand-orange text-white font-bold py-2 px-4 rounded-lg">Select API Key</button>
            </div>
        )
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Generate Ad for "{item.name}"</h2>
            
            <div className="mb-4">
                <label className="font-semibold">Video Prompt</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full p-2 border rounded h-28"
                    placeholder="Enter a prompt or generate one..."
                />
                <button onClick={generatePrompt} disabled={isLoading} className="w-full mt-1 bg-gray-200 text-gray-800 p-2 rounded-lg font-semibold">
                    ✨ Generate Prompt with AI
                </button>
            </div>
            
            <button onClick={generateVideo} disabled={isLoading || !prompt} className="w-full bg-brand-green text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400">
                {isLoading ? 'Generating Video...' : 'Generate Video Ad'}
            </button>
            
            {isLoading && <p className="text-center mt-2 text-sm text-gray-500">This can take a few minutes...</p>}
            
            {videoOperation?.response?.generatedVideos?.[0] && (
                <div className="mt-4">
                    <h3 className="font-bold">Generated Video:</h3>
                     <video
                        controls
                        src={`${videoOperation.response.generatedVideos[0].video.uri}&key=${process.env.API_KEY}`}
                        className="w-full rounded-lg"
                     />
                </div>
            )}
        </div>
    );
};

const UserProfile: React.FC<{
    user: User;
    badges: Badge[];
    orders: Order[];
    onReorder: (items: CartItem[]) => void;
    onCustomizeClick: () => void;
}> = ({ user, badges, orders, onReorder, onCustomizeClick }) => {
    const userBadges = user.badges.map(badgeId => badges.find(b => b.id === badgeId)).filter(Boolean) as Badge[];

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-center gap-8 bg-white p-8 rounded-2xl shadow-lg">
                <div className="relative">
                    <div className="w-32 h-32 bg-yellow-100 rounded-full flex items-center justify-center text-8xl">
                         {user.avatar.base}
                    </div>
                     {user.avatar.accessories.map(acc => {
                        const accessory = AVATAR_ACCESSORIES[acc];
                        return accessory ? <span key={acc} className="absolute" style={accessory.style}>{accessory.icon}</span> : null;
                    })}
                     <button onClick={onCustomizeClick} className="absolute bottom-0 right-0 bg-white shadow-md w-10 h-10 rounded-full flex items-center justify-center text-xl">🎨</button>
                </div>
                <div>
                    <h1 className="text-4xl font-black">{user.name}</h1>
                    <p className="text-gray-600">{user.email}</p>
                    <div className="mt-4 bg-yellow-400 text-yellow-900 font-bold p-2 rounded-lg inline-flex items-center gap-2">
                        <TrophyIcon className="w-5 h-5" />
                        <span>{user.spudPoints} Spud Points</span>
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-4">My Badges</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {userBadges.map(badge => (
                        <div key={badge.id} className="bg-white p-4 rounded-lg shadow text-center">
                            <span className="text-4xl">{badge.icon}</span>
                            <h3 className="font-bold mt-2">{badge.name}</h3>
                            <p className="text-sm text-gray-500">{badge.description}</p>
                        </div>
                    ))}
                </div>
                 {userBadges.length === 0 && <p className="text-gray-500 bg-white p-4 rounded-lg">No badges yet. Place an order to earn your first one!</p>}
            </div>
            
            <div>
                <h2 className="text-2xl font-bold mb-4">Order History</h2>
                <div className="space-y-4">
                    {orders.slice(0, 5).map(order => (
                        <div key={order.id} className="bg-white p-4 rounded-lg shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold">Order #{order.id.slice(-6)} - {formatCurrency(order.total)}</p>
                                    <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                                    <p className="text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'Delivered' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{order.status}</span></p>
                                </div>
                                <button onClick={() => onReorder(order.items)} className="bg-brand-orange text-white text-sm font-bold py-1 px-3 rounded-full">Reorder</button>
                            </div>
                        </div>
                    ))}
                </div>
                {orders.length === 0 && <p className="text-gray-500 bg-white p-4 rounded-lg">No past orders found.</p>}
            </div>
        </div>
    );
};

const OrderTrackingPage: React.FC<{ order: Order }> = ({ order }) => {
    const statuses = ['Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
    const currentStatusIndex = statuses.indexOf(order.status);
    
    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
            <h1 className="text-3xl font-black text-center mb-2">Tracking Order #{order.id.slice(-6)}</h1>
            <p className="text-center text-gray-500 mb-8">Estimated Arrival: 15-20 minutes</p>
            
            <div className="flex justify-between items-center px-4">
                {statuses.map((status, index) => (
                    <React.Fragment key={status}>
                        <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${index <= currentStatusIndex ? 'bg-brand-green' : 'bg-gray-300'}`}>
                                {index <= currentStatusIndex ? '✓' : ''}
                            </div>
                            <p className={`mt-2 font-semibold ${index <= currentStatusIndex ? 'text-brand-green' : 'text-gray-500'}`}>{status}</p>
                        </div>
                         {index < statuses.length - 1 && (
                            <div className={`flex-grow h-1 ${index < currentStatusIndex ? 'bg-brand-green' : 'bg-gray-300'}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>

            <div className="mt-8 border-t pt-4">
                <h3 className="font-bold">Order Summary</h3>
                {order.items.map(item => (
                    <p key={item.cartItemId}>{item.quantity}x {item.name}</p>
                ))}
            </div>
        </div>
    );
};

const Leaderboard: React.FC = () => {
    return (
         <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
            <h1 className="text-3xl font-black text-center mb-6">Spud Points Leaderboard</h1>
             <div className="space-y-3">
                {LEADERBOARD_DATA.map((user, index) => (
                    <div key={user.name} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-4">
                             <span className="font-bold text-lg w-6">{index + 1}{index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}</span>
                            <span className="font-semibold">{user.name}</span>
                        </div>
                         <span className="font-bold text-brand-orange">{user.spudPoints} pts</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Add AdminMenuModal component
const AdminMenuModal: React.FC<{
    item: MenuItem | null;
    onSave: (item: MenuItem) => void;
    onAdd: (item: Omit<MenuItem, 'id' | 'rating' | 'reviews'>) => void;
}> = ({ item, onSave, onAdd }) => {
    const isEditing = item !== null;
    const initialFormState: Omit<MenuItem, 'id' | 'rating' | 'reviews'> = {
        name: item?.name ?? '',
        description: item?.description ?? '',
        price: item?.price ?? 0,
        image: item?.image ?? '',
        category: item?.category ?? CATEGORIES[0].name,
        spicyLevel: item?.spicyLevel ?? 0,
        dietaryTags: item?.dietaryTags ?? [],
        customizations: item?.customizations ?? [],
    };
    const [formState, setFormState] = useState(initialFormState);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: name === 'price' || name === 'spicyLevel' ? parseFloat(value) : value }));
    };
    
    const handleDietaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const tag = value as 'Vegetarian' | 'Vegan' | 'Gluten-Free';
        setFormState(prev => {
            const newTags = checked ? [...prev.dietaryTags, tag] : prev.dietaryTags.filter(t => t !== tag);
            return { ...prev, dietaryTags: newTags };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing && item) {
            onSave({ ...item, ...formState });
        } else {
            onAdd(formState);
        }
    };
    
    const dietaryOptions: ('Vegetarian' | 'Vegan' | 'Gluten-Free')[] = ['Vegetarian', 'Vegan', 'Gluten-Free'];

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-2xl font-bold">{isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
            
            <div>
                <label className="block font-semibold">Name</label>
                <input type="text" name="name" value={formState.name} onChange={handleChange} className="w-full p-2 border rounded" required />
            </div>
            
            <div>
                <label className="block font-semibold">Description</label>
                <textarea name="description" value={formState.description} onChange={handleChange} className="w-full p-2 border rounded" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block font-semibold">Price</label>
                    <input type="number" name="price" value={formState.price} onChange={handleChange} step="0.01" className="w-full p-2 border rounded" required />
                </div>
                 <div>
                    <label className="block font-semibold">Category</label>
                    <select name="category" value={formState.category} onChange={handleChange} className="w-full p-2 border rounded">
                        {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
            </div>
            
            <div>
                <label className="block font-semibold">Image URL</label>
                <input type="text" name="image" value={formState.image} onChange={handleChange} className="w-full p-2 border rounded" required />
                {formState.image && <img src={formState.image} alt="Preview" className="mt-2 rounded-lg max-h-40 w-full object-cover" />}
            </div>

            <div>
                <label className="block font-semibold">Spicy Level: {formState.spicyLevel}</label>
                <input type="range" name="spicyLevel" min="0" max="3" value={formState.spicyLevel} onChange={handleChange} className="w-full" />
            </div>
            
            <div>
                 <label className="block font-semibold">Dietary Tags</label>
                 <div className="flex gap-4">
                    {dietaryOptions.map(tag => (
                        <label key={tag} className="flex items-center gap-2">
                           <input 
                             type="checkbox" 
                             value={tag} 
                             checked={formState.dietaryTags.includes(tag)}
                             onChange={handleDietaryChange}
                           /> 
                           {tag}
                        </label>
                    ))}
                 </div>
            </div>

            <button type="submit" className="w-full bg-brand-green text-white font-bold py-2 px-4 rounded-lg">{isEditing ? 'Save Changes' : 'Add Item'}</button>
        </form>
    );
};

// Revamp AdminDashboard
const AdminDashboard: React.FC<{
    users: User[];
    orders: Order[];
    menu: MenuItem[];
    promos: PromoCode[];
    setPromos: React.Dispatch<React.SetStateAction<PromoCode[]>>;
    dailySpecialId: string;
    setDailySpecialId: React.Dispatch<React.SetStateAction<string>>;
    setActiveModal: (modal: ModalType | null) => void;
    setModalData: (data: any) => void;
    onDeleteItem: (id: string) => void;
}> = ({ users, orders, menu, promos, setPromos, dailySpecialId, setDailySpecialId, setActiveModal, setModalData, onDeleteItem }) => {
    const [activeTab, setActiveTab] = useState('menu');

    const tabs = [
        { id: 'menu', label: 'Menu' },
        { id: 'orders', label: 'Orders' },
        { id: 'users', label: 'Users' },
        { id: 'promos', label: 'Promotions' },
        { id: 'settings', label: 'Settings' }
    ];

    const handleEditItem = (item: MenuItem) => {
        setModalData(item);
        setActiveModal('adminMenu');
    };

    const handleAddItem = () => {
        setModalData(null); // No item data means it's a new item
        setActiveModal('adminMenu');
    };

    const handleEditPromo = (promo: PromoCode) => {
        setModalData(promo);
        setActiveModal('adminPromo');
    };
    
    const handleAddPromo = () => {
        setModalData(null);
        setActiveModal('adminPromo');
    };
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg">
            <h1 className="text-3xl font-black mb-4">Admin Dashboard</h1>
            <div className="border-b mb-4">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? 'border-brand-orange text-brand-orange' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            
            {/* Menu Management */}
            {activeTab === 'menu' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Menu Management</h2>
                        <button onClick={handleAddItem} className="bg-brand-green text-white font-bold py-2 px-4 rounded-lg">Add New Item</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {menu.map(item => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><img className="h-10 w-10 rounded-full mr-4 object-cover" src={item.image} alt="" /><span>{item.name}</span></div></td>
                                        <td className="px-6 py-4 whitespace-nowrap">{item.category}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(item.price)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleEditItem(item)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                            <button onClick={() => onDeleteItem(item.id)} className="text-red-600 hover:text-red-900 ml-4">Delete</button>
                                            <button onClick={() => { setModalData(item); setActiveModal('generateAd'); }} className="text-purple-600 hover:text-purple-900 ml-4">Generate Ad ✨</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {/* Order Management */}
            {activeTab === 'orders' && (
                 <div>
                    <h2 className="text-2xl font-bold mb-4">Order History</h2>
                     <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                </tr>
                            </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                {orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(order => (
                                    <tr key={order.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{order.id.slice(-6)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{users.find(u => u.id === order.userId)?.name ?? 'Guest'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(order.total)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'Delivered' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{order.status}</span></td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* User Management */}
            {activeTab === 'users' && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">User Management</h2>
                     <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spud Points</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                </tr>
                            </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                {users.map(user => (
                                    <tr key={user.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{user.spudPoints}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{user.isAdmin ? 'Admin' : 'Customer'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

             {/* Promotions Management */}
            {activeTab === 'promos' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold">Promo Codes</h2>
                        <button onClick={handleAddPromo} className="bg-brand-green text-white font-bold py-2 px-4 rounded-lg">Add New Promo</button>
                    </div>
                    {promos.map(promo => (
                        <div key={promo.code} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center mb-2">
                            <div>
                                <span className="font-bold">{promo.code}</span> ({promo.discountPercentage}%)
                            </div>
                            <div>
                                <span className={`text-sm font-semibold ${promo.isActive ? 'text-green-600' : 'text-red-600'}`}>{promo.isActive ? 'Active' : 'Inactive'}</span>
                                <button onClick={() => handleEditPromo(promo)} className="text-indigo-600 hover:text-indigo-900 ml-4">Edit</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Settings */}
            {activeTab === 'settings' && (
                 <div>
                    <h2 className="text-2xl font-bold mb-4">App Settings</h2>
                    <div className="space-y-4">
                        <div>
                             <label className="block font-semibold">Daily Special</label>
                             <select value={dailySpecialId} onChange={(e) => setDailySpecialId(e.target.value)} className="w-full p-2 border rounded">
                                {menu.map(item => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}


const MenuItemCard: React.FC<{ item: MenuItem; onOrderClick: () => void; }> = ({ item, onOrderClick }) => (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col group">
        <div className="relative">
            <img src={item.image} alt={item.name} className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute top-3 right-3 flex flex-col gap-2">
                 <SpicyIcon level={item.spicyLevel} />
            </div>
             <div className="absolute bottom-3 left-3 flex gap-2">
                {item.dietaryTags.map(tag => (
                    <span key={tag} className="text-xs bg-white/80 backdrop-blur-sm rounded-full px-2 py-1 font-semibold text-brand-dark">{tag}</span>
                ))}
            </div>
        </div>
        <div className="p-4 flex flex-col flex-grow">
            <h3 className="text-xl font-black mb-1">{item.name}</h3>
            <div className="flex items-center gap-1 mb-2 text-yellow-500">
                <StarIcon className="w-5 h-5" /> <span className="font-bold">{item.rating}</span>
            </div>
            <p className="text-gray-600 text-sm flex-grow mb-4">{item.description}</p>
            <div className="flex justify-between items-center">
                <span className="text-2xl font-black">{formatCurrency(item.price)}</span>
                <button onClick={onOrderClick} className="bg-brand-orange text-white font-bold py-2 px-5 rounded-full hover:bg-brand-orange/90 transition-transform transform hover:scale-105">Order</button>
            </div>
        </div>
    </div>
);

const HomePage: React.FC<{
    dailySpecial: MenuItem | undefined;
    menuItems: MenuItem[];
    onOrderItem: (item: MenuItem) => void;
    dailyChallenge: DailyChallenge;
    currentUser: User | null;
    setActiveModal: (modal: ModalType | null) => void;
}> = ({ dailySpecial, menuItems, onOrderItem, dailyChallenge, currentUser, setActiveModal }) => {

    const menuByCategory = CATEGORIES.map(category => ({
        ...category,
        items: menuItems.filter(item => item.category === category.name)
    }));

    return (
        <div className="space-y-16">
            {/* Hero Section */}
            <div className="text-center rounded-3xl bg-gradient-to-br from-yellow-100 to-orange-200 p-12 relative overflow-hidden">
                <div className="absolute -bottom-12 -right-12 text-[10rem] opacity-10">🥔</div>
                <h1 className="text-5xl md:text-7xl font-black text-brand-dark tracking-tighter mb-4">Taste the Spudtacular!</h1>
                <p className="max-w-2xl mx-auto text-lg text-brand-dark/80 mb-8">Welcome to Potato & Friends, where every fry is a high-five for your taste buds. Explore our loaded creations and find your new favorite comfort food.</p>
                <a href="#menu" className="bg-brand-orange text-white font-bold py-4 px-10 rounded-full text-xl hover:bg-brand-orange/90 transition-all transform hover:scale-105 shadow-lg inline-block">Explore Menu</a>
            </div>

            {/* Daily Special */}
            {dailySpecial && (
                <div>
                    <h2 className="text-4xl font-black text-center mb-8">Daily Special ✨</h2>
                     <div className="grid md:grid-cols-2 gap-8 items-center bg-white rounded-2xl shadow-lg p-8">
                        <img src={dailySpecial.image} alt={dailySpecial.name} className="w-full h-80 object-cover rounded-xl"/>
                        <div>
                            <h3 className="text-3xl font-black mb-2">{dailySpecial.name}</h3>
                            <div className="flex items-center gap-2 mb-2 text-yellow-500">
                                <StarIcon className="w-6 h-6" /> <span className="font-bold text-lg">{dailySpecial.rating}</span>
                            </div>
                            <p className="text-gray-600 mb-4">{dailySpecial.description}</p>
                            <p className="text-3xl font-black mb-6">{formatCurrency(dailySpecial.price)}</p>
                            <button onClick={() => onOrderItem(dailySpecial)} className="w-full bg-brand-green text-white font-bold py-3 rounded-full text-lg">Order Now</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Ask the Chef */}
            <div className="text-center bg-white rounded-2xl shadow-lg p-8">
                <h3 className="text-3xl font-black mb-2">Can't Decide?</h3>
                <p className="text-gray-600 mb-4">Let our AI Chef Spud help you find the perfect dish!</p>
                <button onClick={() => setActiveModal('askChef')} className="bg-brand-dark text-white font-bold py-3 px-8 rounded-full">
                   Ask Chef Spud 👨‍🍳
                </button>
            </div>


            {/* Menu Section */}
            <div id="menu">
                <h2 className="text-4xl font-black text-center mb-8">Our Menu</h2>
                {menuByCategory.map(category => (
                    <div key={category.name} className="mb-12">
                         <div className="mb-6">
                            <h3 className="text-3xl font-black">{category.name}</h3>
                            <p className="text-gray-500">{category.description}</p>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {category.items.map(item => (
                                <MenuItemCard key={item.id} item={item} onOrderClick={() => onOrderItem(item)} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Daily Challenge */}
            <div className="bg-gradient-to-r from-brand-green to-teal-500 text-white rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
                <div className="text-6xl">🏆</div>
                <div className="flex-grow">
                    <h3 className="text-2xl font-black">{dailyChallenge.title}</h3>
                    <p>{dailyChallenge.description}</p>
                </div>
                <div>
                    <p className="text-lg font-bold">Reward: {dailyChallenge.pointBonus} Spud Points!</p>
                    <button onClick={() => {
                        const challengeItem = menuItems.find(i => i.id === dailyChallenge.menuItemId);
                        if (challengeItem) onOrderItem(challengeItem);
                    }} className="mt-2 bg-white text-brand-green font-bold py-2 px-6 rounded-full">Order Now</button>
                </div>
            </div>

        </div>
    );
};

const CheckoutPage: React.FC<{
    cart: CartItem[];
    cartTotal: number;
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;
    allUsers: User[];
    setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
    showToast: (message: string, icon?: string) => void;
    handleNavigation: (page: Page) => void;
    setActiveModal: (modal: ModalType | null) => void;
    setModalData: (data: any) => void;
    promoCodes: PromoCode[];
}> = ({ cart, cartTotal, currentUser, setCurrentUser, allUsers, setAllUsers, setOrders, setCart, showToast, handleNavigation, setActiveModal, setModalData, promoCodes }) => {
    const [orderType, setOrderType] = useState<'Delivery' | 'Pickup'>('Delivery');
    const [address, setAddress] = useState('123 Fry Lane, Spudsville');
    const [promoCode, setPromoCode] = useState('');
    const [discount, setDiscount] = useState(0);
    const [usePoints, setUsePoints] = useState(false);
    
    const tax = cartTotal * 0.08;
    const deliveryFee = orderType === 'Delivery' ? 3.99 : 0;
    const pointsDiscount = usePoints && currentUser ? Math.min(currentUser.spudPoints * SPUD_POINT_VALUE, cartTotal) : 0;
    const total = cartTotal + tax + deliveryFee - discount - pointsDiscount;

    const handleApplyPromo = () => {
        const code = promoCodes.find(p => p.code === promoCode && p.isActive);
        if (code) {
            setDiscount(cartTotal * (code.discountPercentage / 100));
            showToast(`Applied ${code.discountPercentage}% discount!`, '🏷️');
        } else {
            showToast('Invalid or expired promo code.', '❌');
        }
    };

    const handlePlaceOrder = () => {
        if (cart.length === 0) {
            showToast('Your cart is empty!', '🛒');
            return;
        }

        const newOrder: Order = {
            id: `order-${Date.now()}`,
            userId: currentUser?.id ?? 'guest',
            items: cart,
            subtotal: cartTotal,
            tax,
            deliveryFee,
            discount,
            total: Math.max(0, total),
            status: 'Confirmed',
            orderType,
            address: orderType === 'Delivery' ? address : undefined,
            pickupTime: orderType === 'Pickup' ? '15-20 mins' : undefined,
            createdAt: new Date().toISOString(),
        };
        
        setOrders(prev => [...prev, newOrder]);
        
        if (currentUser) {
            const pointsEarned = Math.floor(cartTotal);
            const pointsSpent = usePoints ? Math.round(pointsDiscount / SPUD_POINT_VALUE) : 0;
            const updatedUser = { ...currentUser, spudPoints: currentUser.spudPoints + pointsEarned - pointsSpent };
            setCurrentUser(updatedUser);
            setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        }

        setCart([]);
        setModalData(newOrder);
        setActiveModal('confirm');
    };

    if (cart.length === 0) {
        return (
            <div className="text-center">
                <h1 className="text-2xl font-bold">Your cart is empty!</h1>
                <button onClick={() => handleNavigation('home')} className="mt-4 bg-brand-orange text-white font-bold py-2 px-6 rounded-full">Go to Menu</button>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            {/* Left side: Form */}
            <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h1 className="text-3xl font-black mb-6">Checkout</h1>
                
                {/* Order Type */}
                <div className="mb-4">
                    <h3 className="font-bold text-lg mb-2">Order Type</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setOrderType('Delivery')} className={`w-full p-3 rounded-lg border-2 ${orderType === 'Delivery' ? 'border-brand-orange bg-orange-50' : ''}`}>Delivery</button>
                        <button onClick={() => setOrderType('Pickup')} className={`w-full p-3 rounded-lg border-2 ${orderType === 'Pickup' ? 'border-brand-orange bg-orange-50' : ''}`}>Pickup</button>
                    </div>
                </div>

                {orderType === 'Delivery' && (
                     <div className="mb-4">
                        <label className="font-bold text-lg mb-2 block">Delivery Address</label>
                        <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-3 border-2 rounded-lg" />
                    </div>
                )}
                
                {/* Payment (Mock) */}
                <div className="mb-4">
                     <h3 className="font-bold text-lg mb-2">Payment Details</h3>
                     <div className="p-4 bg-gray-100 rounded-lg text-gray-500">Mock payment details. No real card needed.</div>
                </div>

                <button onClick={handlePlaceOrder} className="w-full bg-brand-green text-white font-bold py-4 rounded-full text-xl mt-4">Place Order ({formatCurrency(Math.max(0, total))})</button>
            </div>

            {/* Right side: Summary */}
            <div className="bg-white p-8 rounded-2xl shadow-lg">
                 <h2 className="text-2xl font-black mb-4">Order Summary</h2>
                 <div className="space-y-2 mb-4">
                    {cart.map(item => (
                        <div key={item.cartItemId} className="flex justify-between items-center">
                            <span>{item.quantity}x {item.name}</span>
                            <span className="font-semibold">{formatCurrency(item.finalPrice * item.quantity)}</span>
                        </div>
                    ))}
                 </div>
                 <div className="border-t pt-4 space-y-1">
                     <p className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(cartTotal)}</span></p>
                     <p className="flex justify-between"><span>Tax (8%):</span><span>{formatCurrency(tax)}</span></p>
                    {orderType === 'Delivery' && <p className="flex justify-between"><span>Delivery Fee:</span><span>{formatCurrency(deliveryFee)}</span></p>}
                    {discount > 0 && <p className="flex justify-between text-green-600"><span>Discount:</span><span>-{formatCurrency(discount)}</span></p>}
                    {pointsDiscount > 0 && <p className="flex justify-between text-green-600"><span>Spud Points:</span><span>-{formatCurrency(pointsDiscount)}</span></p>}
                     <p className="flex justify-between font-bold text-xl border-t pt-2 mt-2"><span>Total:</span><span>{formatCurrency(Math.max(0, total))}</span></p>
                </div>

                {/* Promo Code */}
                <div className="flex gap-2 mt-4">
                    <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="Promo Code" className="w-full p-2 border-2 rounded-lg" />
                    <button onClick={handleApplyPromo} className="bg-brand-orange text-white font-bold px-4 rounded-lg">Apply</button>
                </div>

                 {/* Use Points */}
                {currentUser && currentUser.spudPoints > 0 && (
                    <div className="mt-4">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={usePoints} onChange={e => setUsePoints(e.target.checked)} />
                            Use {currentUser.spudPoints} Spud Points (worth {formatCurrency(currentUser.spudPoints * SPUD_POINT_VALUE)})
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
};

// MAIN APP COMPONENT
export default function App() {
    // STATE MANAGEMENT
    const [currentUser, setCurrentUser] = useLocalStorage<User | null>('currentUser', null);
    const [allUsers, setAllUsers] = useLocalStorage<User[]>('allUsers', USERS);
    const [cart, setCart] = useLocalStorage<CartItem[]>('cart', []);
    const [orders, setOrders] = useLocalStorage<Order[]>('orders', []);
    const [menuItems, setMenuItems] = useLocalStorage<MenuItem[]>('menuItems', MENU_ITEMS);
    const [promoCodes, setPromoCodes] = useLocalStorage<PromoCode[]>('promoCodes', PROMO_CODES);
    const [dailySpecialId, setDailySpecialId] = useLocalStorage<string>('dailySpecialId', DAILY_SPECIAL_ID);

    const [currentPage, setCurrentPage] = useState<Page>('home');
    const [activeModal, setActiveModal] = useState<ModalType | null>(null);
    const [modalData, setModalData] = useState<any>(null);
    const [toasts, setToasts] = useState<{ id: number; message: string; icon: string }[]>([]);

    // DERIVED STATE
    const dailySpecial = useMemo(() => menuItems.find(item => item.id === dailySpecialId), [menuItems, dailySpecialId]);
    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0), [cart]);

    // EFFECT TO SYNC CURRENT USER STATE IF ALLUSERS CHANGES (E.G. ADMIN EDITS)
    useEffect(() => {
        if (currentUser) {
            const updatedUser = allUsers.find(u => u.id === currentUser.id);
            if (updatedUser) {
                setCurrentUser(updatedUser);
            }
        }
    }, [allUsers, currentUser?.id]);


    // HANDLERS & LOGIC
    const showToast = useCallback((message: string, icon: string = '✅') => {
        const id = Date.now();
        setToasts(prev => [...prev.slice(-4), { id, message, icon }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const handleNavigation = (page: Page) => {
        setCurrentPage(page);
        window.scrollTo(0, 0);
    };
    
    const handleOpenItemModal = useCallback((item: MenuItem) => {
        setModalData(item);
        setActiveModal('itemDetail');
    }, []);

    const handleLogout = () => {
        setCurrentUser(null);
        handleNavigation('home');
    };

    const addToCart = useCallback((item: MenuItem, quantity: number, selectedCustomizations: Record<string, CustomizationOption | CustomizationOption[]>) => {
        let finalPrice = item.price;
        for (const key in selectedCustomizations) {
            const selection = selectedCustomizations[key];
            if (Array.isArray(selection)) {
                selection.forEach(opt => finalPrice += opt.priceModifier);
            } else if (selection) {
                finalPrice += (selection as CustomizationOption).priceModifier;
            }
        }

        const newCartItem: CartItem = {
            ...item,
            quantity,
            selectedCustomizations,
            finalPrice,
            cartItemId: Date.now().toString()
        };

        setCart(prev => [...prev, newCartItem]);
        showToast(`${item.name} added to cart!`, '🛒');
        setActiveModal(null);
    }, [setCart, showToast]);

    const findItemAndAddToCart = useCallback((itemName: string, quantity: number) => {
        const itemToAdd = menuItems.find(mi => mi.name.toLowerCase() === itemName.toLowerCase());
        if (itemToAdd) {
            addToCart(itemToAdd, quantity, {});
            return true;
        }
        return false;
    }, [menuItems, addToCart]);

    const removeFromCart = (cartItemId: string) => {
        setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    };

    const updateCartQuantity = (cartItemId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            removeFromCart(cartItemId);
        } else {
            setCart(prev => prev.map(item => item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item));
        }
    };
    
    // ADMIN HANDLERS
    const handleAddMenuItem = (newItem: Omit<MenuItem, 'id' | 'rating' | 'reviews'>) => {
        const fullNewItem: MenuItem = {
            ...newItem,
            id: `menu-${Date.now()}`,
            rating: 0, // New items start with 0 rating
            reviews: [],
        };
        setMenuItems(prev => [...prev, fullNewItem]);
        showToast('Menu item added!', '🍴');
        setActiveModal(null);
    };
    
    const handleUpdateMenuItem = (updatedItem: MenuItem) => {
        setMenuItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        showToast('Menu item updated!', '👍');
        setActiveModal(null);
    };

    const handleDeleteMenuItem = (itemId: string) => {
        if (window.confirm('Are you sure you want to delete this menu item?')) {
            setMenuItems(prev => prev.filter(item => item.id !== itemId));
            showToast('Menu item deleted.', '🗑️');
        }
    };
    
    // RENDER LOGIC
    const renderPage = () => {
        switch (currentPage) {
            case 'home': return <HomePage dailySpecial={dailySpecial} menuItems={menuItems} onOrderItem={handleOpenItemModal} dailyChallenge={DAILY_CHALLENGE} currentUser={currentUser} setActiveModal={setActiveModal} />;
            case 'checkout': return <CheckoutPage cart={cart} cartTotal={cartTotal} currentUser={currentUser} setCurrentUser={setCurrentUser} allUsers={allUsers} setAllUsers={setAllUsers} setOrders={setOrders} setCart={setCart} showToast={showToast} handleNavigation={handleNavigation} setActiveModal={setActiveModal} setModalData={setModalData} promoCodes={promoCodes} />;
            case 'profile': return currentUser ? <UserProfile 
                user={currentUser} 
                badges={BADGES} 
                orders={orders.filter(o => o.userId === currentUser.id)}
                onReorder={(items) => {
                    setCart(prev => [...prev, ...items.map(item => ({...item, cartItemId: `${Date.now()}-${item.id}-${Math.random()}`}))]);
                    showToast('Items from past order added to cart!', '🛒');
                    setModalData({ show: true });
                }}
                onCustomizeClick={() => {
                    setModalData(currentUser);
                    setActiveModal('avatarCustomization');
                }}
            /> : <HomePage dailySpecial={dailySpecial} menuItems={menuItems} onOrderItem={handleOpenItemModal} dailyChallenge={DAILY_CHALLENGE} currentUser={currentUser} setActiveModal={setActiveModal} />;
            case 'admin': return currentUser?.isAdmin ? <AdminDashboard 
                users={allUsers} 
                orders={orders} 
                menu={menuItems} 
                promos={promoCodes} 
                setPromos={setPromoCodes} 
                dailySpecialId={dailySpecialId} 
                setDailySpecialId={setDailySpecialId} 
                setActiveModal={setActiveModal} 
                setModalData={setModalData}
                onDeleteItem={handleDeleteMenuItem}
            /> : <h1 className="text-center text-red-500 text-2xl">Access Denied</h1>;
            case 'tracking': return <OrderTrackingPage order={modalData as Order} />;
            case 'leaderboard': return <Leaderboard />;
            default: return <HomePage dailySpecial={dailySpecial} menuItems={menuItems} onOrderItem={handleOpenItemModal} dailyChallenge={DAILY_CHALLENGE} currentUser={currentUser} setActiveModal={setActiveModal} />;
        }
    };

    const handleUpdateUser = (updatedUser: User) => {
        setCurrentUser(updatedUser);
        setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Header
                user={currentUser}
                onLoginClick={() => setActiveModal('login')}
                onLogout={handleLogout}
                cartItemCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
                onCartClick={() => setModalData({ show: true })}
                onNavigate={handleNavigation}
            />
            <main className="flex-grow container mx-auto px-4 py-8">
                {renderPage()}
            </main>
            <Footer onNavigate={handleNavigation} />
            <CartSidebar 
              show={modalData?.show} 
              onClose={() => setModalData({ show: false })} 
              cart={cart} 
              total={cartTotal} 
              onUpdateQuantity={updateCartQuantity}
              onRemove={removeFromCart}
              onCheckout={() => { setModalData({show: false}); handleNavigation('checkout');}}
             />

            {activeModal && (
                <Modal onClose={() => {setActiveModal(null); setModalData(null);}}>
                    {activeModal === 'login' && <AuthModal allUsers={allUsers} onLogin={setCurrentUser} onClose={() => setActiveModal(null)} />}
                    {activeModal === 'itemDetail' && <ItemDetailModal item={modalData as MenuItem} onAddToCart={addToCart} />}
                    {activeModal === 'confirm' && <OrderConfirmation order={modalData as Order} onTrack={() => { setActiveModal(null); setModalData(modalData); handleNavigation('tracking'); }} />}
                    {activeModal === 'aiChat' && <AiAssistantModal menuItems={menuItems} cart={cart} cartTotal={cartTotal} findItemAndAddToCart={findItemAndAddToCart} />}
                    {activeModal === 'aiVoice' && <VoiceAssistantModal findItemAndAddToCart={findItemAndAddToCart} />}
                    {activeModal === 'askChef' && <AskTheChefModal menuItems={menuItems} />}
                     {activeModal === 'avatarCustomization' && <AvatarCustomizationModal 
                        user={modalData as User} 
                        badges={BADGES}
                        onSave={(updatedUser) => {
                            handleUpdateUser(updatedUser);
                            showToast("Avatar updated!", '😎');
                            setActiveModal(null);
                        }}
                     />}
                    {activeModal === 'adminMenu' && <AdminMenuModal 
                        item={modalData as MenuItem | null} 
                        onSave={handleUpdateMenuItem} 
                        onAdd={handleAddMenuItem}
                    />}
                    {activeModal === 'adminPromo' && <AdminPromoModal promo={modalData as PromoCode | null} onSave={(updatedPromo) => {
                        setPromoCodes(prev => prev.map(p => p.code === updatedPromo.code ? updatedPromo : p));
                        setActiveModal(null);
                    }} onAdd={(newPromo) => {
                        setPromoCodes(prev => [...prev, newPromo]);
                        setActiveModal(null);
                    }}/>}
                    {activeModal === 'generateAd' && <GenerateAdModal item={modalData as MenuItem} showToast={showToast} />}
                </Modal>
            )}

            <ToastContainer toasts={toasts} />

            <div className="fixed bottom-4 right-4 flex flex-col gap-3 z-40">
                <button onClick={() => setActiveModal('aiVoice')} className="bg-brand-green text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-brand-green/90 transition-transform transform hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                </button>
                 <button onClick={() => setActiveModal('aiChat')} className="bg-brand-orange text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-brand-orange/90 transition-transform transform hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9.7 12.3c-.39.39-1.02.39-1.41 0L6 10.01l-2.29 2.29c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41l2.29-2.29-2.29-2.29c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0l2.29 2.29 2.29-2.29c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L8.41 9l2.29 2.29c.39.39.39 1.03 0 1.42zM18 11h-6c-.55 0-1-.45-1-1s.45-1 1-1h6c.55 0 1 .45 1 1s-.45 1-1 1zm0-4h-6c-.55 0-1-.45-1-1s.45-1 1-1h6c.55 0 1 .45 1 1s-.45 1-1 1z"/></svg>
                </button>
            </div>
        </div>
    );
}