



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
} from './types';
import {
    MENU_ITEMS,
    DAILY_SPECIAL_ID,
    BADGES,
    USERS,
    PROMO_CODES,
    LEADERBOARD_DATA,
    SPUD_POINT_VALUE,
} from './constants';
import * as GeminiService from './services/geminiService';
import { Chat, LiveServerMessage, LiveSession, Blob as GenAiBlob, FunctionCall } from '@google/genai';

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
    
    // RENDER LOGIC
    const renderPage = () => {
        switch (currentPage) {
            case 'home': return <HomePage dailySpecial={dailySpecial} menuItems={menuItems} setActiveModal={setActiveModal} setModalData={setModalData} />;
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
            /> : <HomePage dailySpecial={dailySpecial} menuItems={menuItems} setActiveModal={setActiveModal} setModalData={setModalData} />;
            // FIX: Pass setPromoCodes instead of undefined setPromos to AdminDashboard
            case 'admin': return currentUser?.isAdmin ? <AdminDashboard users={allUsers} setUsers={setAllUsers} orders={orders} menu={menuItems} setMenu={setMenuItems} promos={promoCodes} setPromos={setPromoCodes} dailySpecialId={dailySpecialId} setDailySpecialId={setDailySpecialId} setActiveModal={setActiveModal} setModalData={setModalData} /> : <h1 className="text-center text-red-500 text-2xl">Access Denied</h1>;
            case 'tracking': return <OrderTracking order={modalData as Order} />;
            case 'leaderboard': return <Leaderboard />;
            default: return <HomePage dailySpecial={dailySpecial} menuItems={menuItems} setActiveModal={setActiveModal} setModalData={setModalData} />;
        }
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
            <Footer />
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
                    {activeModal === 'adminMenu' && <AdminMenuModal item={modalData as MenuItem | null} onSave={(updatedItem) => {
                        setMenuItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
                        setActiveModal(null);
                    }} onAdd={(newItem) => {
                        setMenuItems(prev => [...prev, {...newItem, id: `menu-${Date.now()}`}]);
                        setActiveModal(null);
                    }}/>}
                    {activeModal === 'adminPromo' && <AdminPromoModal promo={modalData as PromoCode | null} onSave={(updatedPromo) => {
                        setPromoCodes(prev => prev.map(p => p.code === updatedPromo.code ? updatedPromo : p));
                        setActiveModal(null);
                    }} onAdd={(newPromo) => {
                        setPromoCodes(prev => [...prev, newPromo]);
                        setActiveModal(null);
                    }}/>}
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

// SUB-COMPONENTS (Defined outside main App to prevent re-renders)

const Header: React.FC<{ user: User | null; onLoginClick: () => void; onLogout: () => void; cartItemCount: number; onCartClick: () => void; onNavigate: (page: Page) => void; }> = ({ user, onLoginClick, onLogout, cartItemCount, onCartClick, onNavigate }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="bg-brand-cream/80 backdrop-blur-md sticky top-0 z-50 shadow-md h-16">
            <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
                    <span className="text-4xl">🥔</span>
                    <h1 className="text-2xl font-extrabold text-brand-dark">Potato & Friends</h1>
                </div>
                <nav className="hidden md:flex items-center gap-6 text-lg font-bold">
                    <a href="#menu" onClick={(e) => { e.preventDefault(); onNavigate('home'); setTimeout(() => document.getElementById('menu')?.scrollIntoView({behavior: 'smooth'}), 0); }} className="hover:text-brand-orange transition-colors">Menu</a>
                    <span onClick={() => onNavigate('leaderboard')} className="cursor-pointer hover:text-brand-orange transition-colors">Leaderboard</span>
                    {user?.isAdmin && <span onClick={() => onNavigate('admin')} className="cursor-pointer hover:text-brand-orange transition-colors">Admin</span>}
                </nav>
                <div className="flex items-center gap-4">
                    <button onClick={onCartClick} className="relative p-2 rounded-full hover:bg-brand-orange-light transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        {cartItemCount > 0 && <span className="absolute top-0 right-0 bg-brand-orange text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">{cartItemCount}</span>}
                    </button>
                    {user ? (
                        <div className="relative">
                            <button onClick={() => setMenuOpen(!menuOpen)} onBlur={() => setTimeout(() => setMenuOpen(false), 200)} className="flex items-center gap-2 p-2 rounded-full hover:bg-brand-orange-light transition-colors">
                                <span className="text-2xl">{user.avatar.base}</span>
                                <span className="hidden sm:inline font-bold">{user.name}</span>
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                                        <p className="font-bold">{user.spudPoints} Spud Points</p>
                                    </div>
                                    <span onClick={() => { onNavigate('profile'); setMenuOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Profile</span>
                                    <span onClick={() => { onLogout(); setMenuOpen(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Logout</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button onClick={onLoginClick} className="bg-brand-orange text-white font-bold py-2 px-4 rounded-full hover:bg-brand-orange/90 transition-all">
                            Log In
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

// --- PAGES ---

interface CheckoutPageProps {
    cart: CartItem[];
    cartTotal: number;
    currentUser: User | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    allUsers: User[];
    setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
    showToast: (message: string, icon?: string) => void;
    handleNavigation: (page: Page) => void;
    setActiveModal: (modal: ModalType | null) => void;
    setModalData: (data: any) => void;
    promoCodes: PromoCode[];
}
const CheckoutPage: React.FC<CheckoutPageProps> = ({ cart, cartTotal, currentUser, setCurrentUser, allUsers, setAllUsers, setOrders, setCart, showToast, handleNavigation, setActiveModal, setModalData, promoCodes }) => {
    const [orderType, setOrderType] = useState<'Delivery' | 'Pickup'>('Delivery');
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
    const [pointsInput, setPointsInput] = useState(0);
    const [redeemedPoints, setRedeemedPoints] = useState(0);
    const [address, setAddress] = useState('123 Fry Lane');
    
    const subtotal = cartTotal;
    const tax = subtotal * 0.08;
    const deliveryFee = orderType === 'Delivery' ? 5.00 : 0;
    const promoDiscount = appliedPromo ? subtotal * (appliedPromo.discountPercentage / 100) : 0;
    const pointsDiscount = redeemedPoints * SPUD_POINT_VALUE;

    const finalTotal = subtotal + tax + deliveryFee - promoDiscount - pointsDiscount;

    const handleApplyPromo = () => {
        const promo = promoCodes.find(p => p.code.toUpperCase() === promoInput.toUpperCase() && p.isActive);
        if (promo) {
            setAppliedPromo(promo);
            showToast(`Applied ${promo.discountPercentage}% discount!`, '🎉');
        } else {
            showToast('Invalid or inactive promo code.', '❌');
        }
    };

    const handleRedeemPoints = () => {
        if (currentUser && pointsInput > 0) {
            if (pointsInput > currentUser.spudPoints) {
                showToast("You don't have enough points!", '😟');
                return;
            }
            if (pointsInput * SPUD_POINT_VALUE > subtotal) {
                showToast("You can't redeem more points than your subtotal.", 'ℹ️');
                return;
            }
            setRedeemedPoints(pointsInput);
            showToast(`Redeemed ${pointsInput} points!`, '💰');
        }
    };

    const handlePlaceOrder = () => {
        const newOrder: Order = {
            id: `order-${Date.now()}`,
            userId: currentUser?.id ?? 'guest',
            items: cart,
            subtotal, tax, deliveryFee,
            discount: promoDiscount + pointsDiscount,
            total: finalTotal > 0 ? finalTotal : 0,
            status: orderType === 'Delivery' ? 'Confirmed' : 'Ready for Pickup',
            orderType,
            address: orderType === 'Delivery' ? address : undefined,
            createdAt: new Date().toISOString(),
        };
        setOrders(prev => [...prev, newOrder]);
        setCart([]);

        if (currentUser) {
            let pointsEarned = Math.floor(finalTotal);
            let updatedBadges = [...currentUser.badges];
            let badgeUnlocked = false;

            if (!updatedBadges.includes('b01')) {
                updatedBadges.push('b01');
                showToast("Badge Unlocked: First Fry!", '🍟');
                badgeUnlocked = true;
            }
            if(redeemedPoints > 0 && !updatedBadges.includes('b03')) {
                updatedBadges.push('b03');
                showToast("Badge Unlocked: Spud Saver!", '💰');
                badgeUnlocked = true;
            }

            const updatedUser = {
                ...currentUser,
                spudPoints: currentUser.spudPoints - redeemedPoints + pointsEarned,
                badges: updatedBadges,
            };
            
            setCurrentUser(updatedUser);
            setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        }

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
            {/* Order Form */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">Order Details</h2>
                {/* Order Type */}
                <div className="mb-4">
                    <h3 className="font-semibold mb-2">Order Type</h3>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 p-3 border rounded-lg flex-1 cursor-pointer"><input type="radio" name="orderType" checked={orderType === 'Delivery'} onChange={() => setOrderType('Delivery')} /> Delivery</label>
                        <label className="flex items-center gap-2 p-3 border rounded-lg flex-1 cursor-pointer"><input type="radio" name="orderType" checked={orderType === 'Pickup'} onChange={() => setOrderType('Pickup')} /> Pickup</label>
                    </div>
                </div>
                {orderType === 'Delivery' && (
                    <div className="mb-4">
                        <label className="font-semibold mb-1 block">Delivery Address</label>
                        <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2 border rounded-lg"/>
                    </div>
                )}
                 {/* Promo Code */}
                <div className="mb-4">
                    <label className="font-semibold mb-1 block">Promo Code</label>
                    <div className="flex gap-2">
                        <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="SPUDTASTIC"/>
                        <button onClick={handleApplyPromo} className="bg-brand-orange-light text-brand-dark font-bold px-4 rounded-lg">Apply</button>
                    </div>
                </div>
                 {/* Spud Points */}
                {currentUser && (
                    <div className="mb-4">
                        <label className="font-semibold mb-1 block">Redeem Spud Points (You have {currentUser.spudPoints})</label>
                        <div className="flex gap-2">
                            <input type="number" max={currentUser.spudPoints} value={pointsInput} onChange={e => setPointsInput(parseInt(e.target.value) || 0)} className="w-full p-2 border rounded-lg"/>
                            <button onClick={handleRedeemPoints} className="bg-brand-orange-light text-brand-dark font-bold px-4 rounded-lg">Redeem</button>
                        </div>
                    </div>
                )}
            </div>
            {/* Summary */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">Summary</h2>
                {cart.map(item => (
                    <div key={item.cartItemId} className="flex justify-between items-center mb-2 text-sm">
                        <span>{item.name} x {item.quantity}</span>
                        <span className="font-semibold">{formatCurrency(item.finalPrice * item.quantity)}</span>
                    </div>
                ))}
                <hr className="my-3"/>
                <div className="space-y-2">
                    <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                    <div className="flex justify-between"><span>Tax (8%)</span><span>{formatCurrency(tax)}</span></div>
                    <div className="flex justify-between"><span>Delivery Fee</span><span>{formatCurrency(deliveryFee)}</span></div>
                    {promoDiscount > 0 && <div className="flex justify-between text-green-600"><span>Promo Discount</span><span>-{formatCurrency(promoDiscount)}</span></div>}
                    {pointsDiscount > 0 && <div className="flex justify-between text-green-600"><span>Points Redeemed</span><span>-{formatCurrency(pointsDiscount)}</span></div>}
                </div>
                <hr className="my-3"/>
                <div className="flex justify-between font-bold text-xl">
                    <span>Total</span>
                    <span>{formatCurrency(finalTotal > 0 ? finalTotal : 0)}</span>
                </div>
                <button onClick={handlePlaceOrder} className="mt-6 w-full bg-brand-green text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-green/90 transition-colors">
                    Place Order
                </button>
            </div>
        </div>
    );
};

interface UserProfileProps {
    user: User;
    badges: Badge[];
    orders: Order[];
    onReorder: (items: CartItem[]) => void;
}
const UserProfile: React.FC<UserProfileProps> = ({ user, badges, orders, onReorder }) => {
    const sortedOrders = useMemo(() => orders.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [orders]);

    return (
        <div className="max-w-2xl mx-auto animate-fadeInUp">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <div className="relative inline-block">
                    <span className="text-8xl">{user.avatar.base}</span>
                    {user.avatar.accessories.map(acc => {
                        const accessory = badges.find(b => b.unlocks === acc);
                        if(accessory) return <span key={acc} className="text-4xl absolute -top-2 -right-2">{accessory.icon}</span>
                        return null;
                    })}
                </div>
                <h1 className="text-3xl font-bold mt-4">{user.name}</h1>
                <p className="text-gray-500">{user.email}</p>
                <div className="mt-4 bg-brand-orange-light p-3 rounded-lg inline-block">
                    <p className="text-lg font-bold text-brand-orange">{user.spudPoints} Spud Points</p>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                <h2 className="text-2xl font-bold mb-4">My Badges</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {user.badges.map(badgeId => {
                    const badge = badges.find(b => b.id === badgeId);
                    return badge ? (
                        <div key={badgeId} className="text-center p-4 border rounded-lg transform transition-transform hover:scale-105">
                            <span className="text-4xl">{badge.icon}</span>
                            <p className="font-bold mt-2">{badge.name}</p>
                            <p className="text-xs text-gray-500">{badge.description}</p>
                        </div>
                    ) : null;
                })}
                </div>
            </div>
             {/* Order History Section */}
            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                <h2 className="text-2xl font-bold mb-4">Order History</h2>
                {sortedOrders.length > 0 ? (
                    <div className="space-y-4">
                        {sortedOrders.map(order => (
                            <div key={order.id} className="border p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="font-bold">Order #{order.id.slice(-6)}</p>
                                    <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                                </div>
                                <ul className="list-disc pl-5 text-sm text-gray-700 my-2">
                                    {order.items.map(item => <li key={item.cartItemId}>{item.name} x {item.quantity}</li>)}
                                </ul>
                                <div className="flex justify-between items-center mt-3">
                                    <p className="font-bold">{formatCurrency(order.total)}</p>
                                    <button onClick={() => onReorder(order.items)} className="bg-brand-orange text-white font-bold py-1 px-3 rounded-full text-sm hover:bg-brand-orange/90 transition-colors">
                                        Re-order
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500">You haven't placed any orders yet.</p>
                )}
            </div>
        </div>
    );
};

interface AdminDashboardProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    orders: Order[];
    menu: MenuItem[];
    setMenu: React.Dispatch<React.SetStateAction<MenuItem[]>>;
    promos: PromoCode[];
    setPromos: React.Dispatch<React.SetStateAction<PromoCode[]>>;
    dailySpecialId: string;
    setDailySpecialId: React.Dispatch<React.SetStateAction<string>>;
    setActiveModal: (modal: ModalType | null) => void;
    setModalData: (data: any) => void;
}
const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, setUsers, orders, menu, setMenu, promos, setPromos, dailySpecialId, setDailySpecialId, setActiveModal, setModalData }) => {
    const [activeTab, setActiveTab] = useState('Analytics');
    
    const salesData = useMemo(() => orders.reduce((acc, order) => {
        order.items.forEach(item => {
            acc[item.name] = (acc[item.name] || 0) + item.quantity;
        });
        return acc;
    }, {} as Record<string, number>), [orders]);

    const chartData = useMemo(() => Object.entries(salesData).map(([name, quantity]) => ({ name, quantity })).sort((a,b) => b.quantity - a.quantity).slice(0, 10), [salesData]);

    const TABS = ['Analytics', 'Orders', 'Kitchen Display', 'Menu', 'Users', 'Promotions', 'Settings'];

    const handleDeleteMenuItem = (id: string) => {
        if (window.confirm("Are you sure you want to delete this menu item?")) {
            setMenu(prev => prev.filter(item => item.id !== id));
        }
    };
    const handleDeletePromo = (code: string) => {
        if(window.confirm("Are you sure you want to delete this promo code?")) {
            setPromos(prev => prev.filter(p => p.code !== code));
        }
    }

    return (
        <div className="animate-fadeInUp">
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
            <div className="flex border-b mb-6">
                {TABS.map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 px-4 font-semibold ${activeTab === tab ? 'border-b-2 border-brand-orange text-brand-orange' : 'text-gray-500'}`}>
                        {tab}
                    </button>
                ))}
            </div>

            {/* Analytics */}
            {activeTab === 'Analytics' && (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow"><h3 className="font-bold">Total Revenue</h3><p className="text-3xl">{formatCurrency(orders.reduce((sum, o) => sum + o.total, 0))}</p></div>
                    <div className="bg-white p-4 rounded-lg shadow"><h3 className="font-bold">Total Orders</h3><p className="text-3xl">{orders.length}</p></div>
                    <div className="bg-white p-4 rounded-lg shadow"><h3 className="font-bold">Total Users</h3><p className="text-3xl">{users.length}</p></div>
                    <div className="bg-white p-4 rounded-lg shadow"><h3 className="font-bold">Menu Items</h3><p className="text-3xl">{menu.length}</p></div>
                    <div className="bg-white p-6 rounded-lg shadow col-span-full">
                        <h2 className="text-2xl font-bold mb-4">Top Selling Items</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value) => `${value} units`} />
                                <Legend />
                                <Bar dataKey="quantity" fill="#FF7A00" name="Units Sold" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
            
            {/* Orders */}
            {activeTab === 'Orders' && <div className="bg-white p-4 rounded-lg shadow"><h2 className="text-2xl font-bold mb-4">All Orders</h2><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>ID</th><th>User</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.slice().reverse().map(o => <tr key={o.id} className="border-t"><td>{o.id.slice(-6)}</td><td>{users.find(u=>u.id === o.userId)?.name || 'Guest'}</td><td>{formatCurrency(o.total)}</td><td>{o.status}</td><td>{new Date(o.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>}

            {/* Kitchen Display */}
            {activeTab === 'Kitchen Display' && (
                <div>
                    <h2 className="text-2xl font-bold mb-4">Kitchen Display</h2>
                    <div className="grid grid-cols-3 gap-4">
                        {['Confirmed', 'Preparing', 'Ready for Pickup'].map(status => (
                            <div key={status} className="bg-gray-100 rounded-lg p-2">
                                <h3 className="font-bold text-center mb-2">{status}</h3>
                                <div className="space-y-2">
                                    {orders.filter(o => o.status === status).map(o => (
                                        <div key={o.id} className="bg-white p-2 rounded shadow text-sm">
                                            <p className="font-bold">Order #{o.id.slice(-6)}</p>
                                            <ul className="list-disc pl-4">{o.items.map(i => <li key={i.cartItemId}>{i.name} x{i.quantity}</li>)}</ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Menu */}
            {activeTab === 'Menu' && <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">Menu Management</h2><button onClick={() => {setModalData(null); setActiveModal('adminMenu')}} className="bg-brand-green text-white font-bold py-2 px-4 rounded-lg">+ Add Item</button></div>
                <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Actions</th></tr></thead><tbody>
                    {menu.map(item => <tr key={item.id} className="border-t"><td>{item.name}</td><td>{item.category}</td><td>{formatCurrency(item.price)}</td><td><button onClick={() => {setModalData(item); setActiveModal('adminMenu')}} className="text-blue-500 mr-2">Edit</button><button onClick={() => handleDeleteMenuItem(item.id)} className="text-red-500">Delete</button></td></tr>)}
                </tbody></table></div>
            </div>}

            {/* Users */}
            {activeTab === 'Users' && <div className="bg-white p-4 rounded-lg shadow"><h2 className="text-2xl font-bold mb-4">User Management</h2><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Name</th><th>Email</th><th>Spud Points</th></tr></thead><tbody>
                {users.map(user => <tr key={user.id} className="border-t"><td>{user.name}</td><td>{user.email}</td><td>{user.spudPoints}</td></tr>)}
            </tbody></table></div></div>}

            {/* Promotions */}
            {activeTab === 'Promotions' && <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">Promo Codes</h2><button onClick={() => {setModalData(null); setActiveModal('adminPromo')}} className="bg-brand-green text-white font-bold py-2 px-4 rounded-lg">+ Add Promo</button></div>
                <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Code</th><th>Discount</th><th>Active</th><th>Actions</th></tr></thead><tbody>
                    {promos.map(p => <tr key={p.code} className="border-t"><td>{p.code}</td><td>{p.discountPercentage}%</td><td>{p.isActive ? 'Yes' : 'No'}</td><td><button onClick={() => {setModalData(p); setActiveModal('adminPromo')}} className="text-blue-500 mr-2">Edit</button><button onClick={() => handleDeletePromo(p.code)} className="text-red-500">Delete</button></td></tr>)}
                </tbody></table></div>
            </div>}
            
            {/* Settings */}
            {activeTab === 'Settings' && <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-2xl font-bold mb-4">Site Settings</h2>
                <div className="max-w-xs">
                    <label className="font-semibold mb-1 block">Daily Special Item</label>
                    <select value={dailySpecialId} onChange={e => setDailySpecialId(e.target.value)} className="w-full p-2 border rounded-lg">
                        {menu.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                </div>
            </div>}
        </div>
    );
};

interface OrderTrackingProps {
    order: Order;
}
const OrderTracking: React.FC<OrderTrackingProps> = ({ order }) => {
    if (!order) return <div className="text-center"><h1 className="text-2xl font-bold">No order selected for tracking.</h1></div>;
    const statuses = ['Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
    const currentStatusIndex = statuses.indexOf(order.status);
    
    // Add a simple keyframe animation for the driver
    const driverAnimation = `
        @keyframes drive {
            from { left: 5%; }
            to { left: ${25 * (currentStatusIndex + 1)}%; }
        }
    `;

    return (
        <div className="max-w-2xl mx-auto animate-fadeInUp">
            <style>{driverAnimation}</style>
            <h1 className="text-3xl font-bold mb-6 text-center">Tracking Order #{order.id.slice(-6)}</h1>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="relative pt-8">
                    <div className="absolute top-10 left-[5%] right-[5%] h-1 bg-gray-300 rounded-full"></div>
                    <div className="absolute top-10 left-[5%] h-1 bg-brand-green rounded-full" style={{width: `${(currentStatusIndex / (statuses.length - 1)) * 90}%`, transition: 'width 1s ease-in-out'}}></div>
                    <div className="flex justify-between items-start text-center">
                        {statuses.map((status, index) => (
                            <div key={status} className={`w-1/4 ${index <= currentStatusIndex ? 'text-brand-green font-bold' : 'text-gray-400'}`}>
                                <div className={`w-4 h-4 rounded-full mx-auto ${index <= currentStatusIndex ? 'bg-brand-green' : 'bg-gray-300'}`}></div>
                                <p className="text-sm mt-1">{status}</p>
                            </div>
                        ))}
                    </div>
                </div>
                {order.orderType === 'Delivery' && (
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-center mb-4">Live Tracking</h3>
                    <div className="relative w-full h-16 bg-brand-orange-light rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
                        <div className="absolute top-1/2 left-4 text-2xl -translate-y-1/2">🏠</div>
                        <div className="absolute top-1/2 right-4 text-2xl -translate-y-1/2">🥔</div>
                        <div className="absolute top-1/2 -translate-y-1/2 text-3xl" style={{ animation: `drive 1s ease-in-out forwards` }}>
                            🚚
                        </div>
                    </div>
                </div>
                )}
                <div className="mt-6 text-center bg-gray-50 p-4 rounded-lg">
                    <p className="text-lg">Current Status:</p>
                    <p className="text-2xl font-bold text-brand-dark">{order.status}</p>
                </div>
            </div>
        </div>
    );
};

const Leaderboard: React.FC = () => {
    return (
        <div className="max-w-2xl mx-auto animate-fadeInUp">
            <h1 className="text-3xl font-bold mb-6 text-center">Spud Points Leaderboard</h1>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* FIX: The `spudPoints` property can be undefined for items in `LEADERBOARD_DATA`. Added a fallback value of 0 to prevent a runtime error during the sort comparison. */}
                {[...LEADERBOARD_DATA].sort((a,b) => (b.spudPoints ?? 0) - (a.spudPoints ?? 0)).map((user, index) => (
                    <div key={index} className={`flex items-center p-4 gap-4 ${index % 2 !== 0 ? 'bg-brand-cream/50' : ''}`}>
                        <span className={`font-bold text-lg w-10 text-center ${index < 3 ? 'text-brand-orange' : ''}`}>{['🥇', '🥈', '🥉'][index] || `${index + 1}.`}</span>
                        {/* FIX: Handle potentially undefined name and spudPoints to avoid rendering issues and provide sensible defaults. */}
                        <span className="flex-grow font-semibold">{user.name ?? 'Unknown User'}</span>
                        <span className="font-bold text-brand-orange">{user.spudPoints ?? 0} pts</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface HomePageProps {
    dailySpecial?: MenuItem;
    menuItems: MenuItem[];
    setActiveModal: (modal: ModalType | null) => void;
    setModalData: (data: any) => void;
}
const HomePage: React.FC<HomePageProps> = ({ dailySpecial, menuItems, setActiveModal, setModalData }) => {
    const [filters, setFilters] = useState({ search: '', category: 'All', dietary: [] as string[] });

    const filteredMenu = useMemo(() => {
        return menuItems.filter(item => {
            const searchMatch = item.name.toLowerCase().includes(filters.search.toLowerCase()) || item.description.toLowerCase().includes(filters.search.toLowerCase());
            const categoryMatch = filters.category === 'All' || item.category === filters.category;
            const dietaryMatch = filters.dietary.every(tag => item.dietaryTags.includes(tag as any));
            return searchMatch && categoryMatch && dietaryMatch;
        });
    }, [menuItems, filters]);
    
    const handleDietaryChange = (tag: string) => {
        setFilters(prev => ({
            ...prev,
            dietary: prev.dietary.includes(tag) ? prev.dietary.filter(t => t !== tag) : [...prev.dietary, tag]
        }));
    };
    
    const categories = ['All', ...new Set(menuItems.map(item => item.category))];
    const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten-Free'];

    return (
        <div>
            {/* Hero Section */}
            <div className="relative text-center h-[60vh] rounded-2xl overflow-hidden mb-12 bg-cover bg-center" style={{ backgroundImage: `url(https://picsum.photos/seed/hero/1200/800)` }}>
                <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center p-4">
                    <h1 className="text-5xl md:text-7xl font-extrabold text-white animate-fadeInUp">Life is better with fries.</h1>
                    <p className="text-xl text-brand-orange-light mt-4 animate-fadeInUp" style={{animationDelay: '0.2s'}}>Fresh, hot, and loaded with love.</p>
                    <button onClick={() => { document.getElementById('menu')?.scrollIntoView({behavior: 'smooth'})}} className="mt-8 bg-brand-orange text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-brand-orange/90 transition-all transform hover:scale-105 animate-fadeInUp" style={{animationDelay: '0.4s'}}>
                        Explore Menu
                    </button>
                </div>
            </div>

            {/* Daily Special */}
            {dailySpecial && (
                <div className="mb-12">
                     <h2 className="text-4xl font-bold text-center text-brand-dark mb-4">Today's Special</h2>
                    <DailySpecialCard item={dailySpecial} onOrderClick={() => { setModalData(dailySpecial); setActiveModal('itemDetail'); }} />
                </div>
            )}

            {/* Menu Section */}
            <section id="menu" className="py-12">
                <h2 className="text-4xl font-bold text-center text-brand-dark mb-8">Our Menu</h2>
                
                {/* Filters */}
                <div className="mb-8 p-4 bg-brand-cream rounded-lg shadow-sm sticky top-16 z-30">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <input type="text" placeholder="Search for fries..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="p-3 border rounded-lg md:col-span-2"/>
                        <button onClick={() => setActiveModal('askChef')} className="bg-brand-green text-white font-bold rounded-lg hover:bg-brand-green/90">🧑‍🍳 Ask The Chef</button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {categories.map(cat => <button key={cat} onClick={() => setFilters({...filters, category: cat})} className={`px-4 py-2 rounded-full font-semibold ${filters.category === cat ? 'bg-brand-dark text-white' : 'bg-white'}`}>{cat}</button>)}
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {dietaryOptions.map(tag => <label key={tag} className="flex items-center gap-2"><input type="checkbox" checked={filters.dietary.includes(tag)} onChange={() => handleDietaryChange(tag)}/>{tag}</label>)}
                    </div>
                </div>

                {/* Menu Grid */}
                {filteredMenu.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredMenu.map((item, index) => (
                            <MenuItemCard key={item.id} item={item} onOrderClick={() => { setModalData(item); setActiveModal('itemDetail'); }} style={{ animationDelay: `${index * 50}ms` }} />
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-500 py-8">No menu items match your search. Try different filters!</p>
                )}
            </section>
        </div>
    );
};


// --- UI COMPONENTS ---
const Footer: React.FC = () => (
    <footer className="bg-brand-dark text-white p-8 mt-12">
        <div className="container mx-auto text-center">
            <p>&copy; {new Date().getFullYear()} Potato & Friends. All rights reserved.</p>
            <p className="text-sm text-gray-400">Made with ❤️ and lots of potatoes.</p>
        </div>
    </footer>
);

const ToastContainer: React.FC<{ toasts: { id: number; message: string; icon: string }[] }> = ({ toasts }) => (
    <div className="fixed bottom-24 right-4 z-[60] flex flex-col items-end">
        {toasts.map(toast => (
            <div key={toast.id} className="bg-brand-dark text-white rounded-lg shadow-lg p-4 mb-2 flex items-center animate-fadeInUp">
                <span className="mr-3 text-2xl">{toast.icon}</span>
                <span>{toast.message}</span>
            </div>
        ))}
    </div>
);

const DailySpecialCard: React.FC<{ item: MenuItem, onOrderClick: () => void }> = ({ item, onOrderClick }) => (
    <div className="bg-gradient-to-br from-brand-orange-light to-brand-cream rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row items-center p-6 md:p-0 animate-fadeInUp">
        <img src={item.image} alt={item.name} className="w-full md:w-1/2 h-64 md:h-96 object-cover rounded-xl md:rounded-none md:rounded-l-2xl"/>
        <div className="p-6 md:p-10 flex flex-col justify-center text-center md:text-left">
            <h3 className="text-4xl font-extrabold text-brand-dark">{item.name}</h3>
            <p className="text-gray-700 my-4 text-lg">{item.description}</p>
            <div className="flex items-center justify-center md:justify-start gap-4 my-4">
                <span className="font-bold text-3xl text-brand-orange">{formatCurrency(item.price * 0.8)}</span>
                <span className="line-through text-xl text-gray-500">{formatCurrency(item.price)}</span>
                <span className="text-2xl">{item.spicyLevel > 0 && '🌶️'.repeat(item.spicyLevel)}</span>
            </div>
            <button onClick={onOrderClick} className="bg-brand-dark text-white font-bold py-3 px-8 rounded-full self-center md:self-start hover:bg-gray-800 transition-all transform hover:scale-105">
                Order Special
            </button>
        </div>
    </div>
);

const MenuItemCard: React.FC<{ item: MenuItem, onOrderClick: () => void, style?: React.CSSProperties }> = ({ item, onOrderClick, style }) => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 group animate-fadeInUp" style={style}>
        <div className="relative">
            <img src={item.image} alt={item.name} className="w-full h-56 object-cover" />
            <div className="absolute top-2 right-2 bg-brand-cream/80 backdrop-blur-sm rounded-full p-2 flex items-center gap-1">
                <StarIcon className="w-5 h-5 text-yellow-500" />
                <span className="font-bold">{item.rating}</span>
            </div>
        </div>
        <div className="p-5">
            <h3 className="text-xl font-bold text-brand-dark truncate">{item.name}</h3>
            <p className="text-gray-600 text-sm my-2 h-10 overflow-hidden">{item.description}</p>
            <div className="flex justify-between items-center mt-4">
                <span className="font-extrabold text-xl text-brand-dark">{formatCurrency(item.price)}</span>
                <button onClick={onOrderClick} className="bg-brand-green text-white font-bold py-2 px-5 rounded-full hover:bg-brand-green/90 transition-transform transform group-hover:scale-105">
                    Order
                </button>
            </div>
        </div>
    </div>
);

const Modal: React.FC<{ children: React.ReactNode, onClose: () => void }> = ({ children, onClose }) => {
    // Add animation for modal closing
    const [isClosing, setIsClosing] = useState(false);
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 300); // match animation duration
    }
    return (
        <div className={`fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`} onClick={handleClose}>
            <div className={`bg-brand-cream rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transition-transform duration-300 ${isClosing ? 'scale-95' : 'scale-100'}`} onClick={e => e.stopPropagation()}>
                <div className="p-6 relative">
                    <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    {children}
                </div>
            </div>
        </div>
    );
};


// --- FEATURE COMPONENTS ---

const CartSidebar: React.FC<{show: boolean; onClose: () => void; cart: CartItem[]; total: number; onUpdateQuantity: (id: string, qty: number) => void; onRemove: (id: string) => void; onCheckout: () => void;}> = ({ show, onClose, cart, total, onUpdateQuantity, onRemove, onCheckout }) => {
    return (
        <div className={`fixed inset-0 bg-black/50 z-[90] transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-brand-cream shadow-2xl z-50 flex flex-col transition-transform duration-300 ${show ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Your Cart</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                </div>
                {cart.length > 0 ? (
                    <>
                        <div className="flex-grow p-6 overflow-y-auto">
                            {cart.map(item => (
                                <div key={item.cartItemId} className="flex gap-4 mb-4">
                                    <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-lg"/>
                                    <div className="flex-grow">
                                        <h3 className="font-bold">{item.name}</h3>
                                        <p className="text-sm text-gray-600">{formatCurrency(item.finalPrice)}</p>
                                        <div className="flex items-center mt-2">
                                            <button onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)} className="border w-6 h-6 rounded-l-md">-</button>
                                            <span className="w-8 text-center border-t border-b">{item.quantity}</span>
                                            <button onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)} className="border w-6 h-6 rounded-r-md">+</button>
                                        </div>
                                    </div>
                                    <button onClick={() => onRemove(item.cartItemId)} className="text-red-500 text-sm self-start">Remove</button>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t bg-white">
                            <div className="flex justify-between font-bold text-lg mb-4">
                                <span>Subtotal</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                            <button onClick={onCheckout} className="w-full bg-brand-green text-white font-bold py-3 rounded-lg hover:bg-brand-green/90">Go to Checkout</button>
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex flex-col justify-center items-center text-gray-500">
                        <span className="text-4xl mb-4">🛒</span>
                        <p>Your cart is empty.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface AuthModalProps {
    allUsers: User[];
    onLogin: (user: User) => void;
    onClose: () => void;
}
const AuthModal: React.FC<AuthModalProps> = ({ allUsers, onLogin, onClose }) => {
    const handleLogin = (user: User) => {
        onLogin(user);
        onClose();
    };
    return (
        <div>
            <h2 className="text-3xl font-bold mb-6 text-center">Welcome Back!</h2>
            <div className="flex flex-col gap-4">
            {allUsers.map(user => (
                <button key={user.id} onClick={() => handleLogin(user)} className={`w-full text-white font-bold py-3 px-4 rounded-lg transition-colors ${user.isAdmin ? 'bg-brand-orange hover:bg-brand-orange/90' : 'bg-brand-green hover:bg-brand-green/90'}`}>
                    Log In as {user.name}
                </button>
            ))}
            <button onClick={onClose} className="mt-2 w-full text-gray-600 hover:underline">
                Continue as Guest
            </button>
            </div>
        </div>
    );
};

interface ItemDetailModalProps {
    item: MenuItem;
    onAddToCart: (item: MenuItem, quantity: number, selectedCustomizations: Record<string, CustomizationOption | CustomizationOption[]>) => void;
}
const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onAddToCart }) => {
    const [quantity, setQuantity] = useState(1);
    const [selectedCustomizations, setSelectedCustomizations] = useState<Record<string, CustomizationOption | CustomizationOption[]>>({});
    const [nutritionalInfo, setNutritionalInfo] = useState<any>(null);
    const [isFetchingNutrition, setIsFetchingNutrition] = useState(false);

    const handleGetNutrition = async () => {
        setIsFetchingNutrition(true);
        const info = await GeminiService.getNutritionalInfo(item);
        setNutritionalInfo(info);
        setIsFetchingNutrition(false);
    }

    const handleCustomizationChange = (customization: Customization, option: CustomizationOption) => {
        setSelectedCustomizations(prev => {
            const newSelections = {...prev};
            const currentSelection = newSelections[customization.title];
            if (customization.type === 'single') {
                newSelections[customization.title] = option;
            } else {
                const currentArray = (Array.isArray(currentSelection) ? currentSelection : []) as CustomizationOption[];
                const optionIndex = currentArray.findIndex(o => o.name === option.name);
                if (optionIndex > -1) {
                    newSelections[customization.title] = currentArray.filter(o => o.name !== option.name);
                } else {
                    newSelections[customization.title] = [...currentArray, option];
                }
            }
            return newSelections;
        });
    };
    
    const handleAddToCart = () => {
        onAddToCart(item, quantity, selectedCustomizations);
    };

    return (
        <div>
            <img src={item.image} alt={item.name} className="w-full h-64 object-cover rounded-t-2xl -mt-6 -mx-6"/>
            <div className="p-2">
                <h2 className="text-3xl font-bold mt-4">{item.name}</h2>
                <p className="text-gray-600 my-2">{item.description}</p>
                <p className="font-bold text-2xl">{formatCurrency(item.price)}</p>
                
                {item.customizations?.map(cust => (
                    <div key={cust.title} className="mt-4">
                        <h4 className="font-bold">{cust.title}</h4>
                        {cust.options.map(opt => (
                             <div key={opt.name} className="flex items-center gap-2">
                                <input type={cust.type === 'single' ? 'radio' : 'checkbox'} id={`${cust.title}-${opt.name}`} name={cust.title} onChange={() => handleCustomizationChange(cust, opt)} />
                                <label htmlFor={`${cust.title}-${opt.name}`}>{opt.name} (+{formatCurrency(opt.priceModifier)})</label>
                            </div>
                        ))}
                    </div>
                ))}

                 <div className="my-4">
                    <button onClick={handleGetNutrition} disabled={isFetchingNutrition} className="text-sm text-brand-green font-semibold disabled:text-gray-400">
                        {isFetchingNutrition ? 'Generating...' : '🔬 Generate Nutritional Info (AI)'}
                    </button>
                    {nutritionalInfo && (
                        <div className="grid grid-cols-2 gap-2 text-sm mt-2 p-2 bg-white rounded-lg border">
                            <span>Calories: {nutritionalInfo.calories}</span>
                            <span>Protein: {nutritionalInfo.protein}g</span>
                            <span>Carbs: {nutritionalInfo.carbs}g</span>
                            <span>Fat: {nutritionalInfo.fat}g</span>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-4 my-6 justify-center">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 border rounded-full font-bold text-lg">-</button>
                    <span className="text-2xl font-bold">{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 border rounded-full font-bold text-lg">+</button>
                </div>
                <button onClick={handleAddToCart} className="w-full bg-brand-green text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-green/90 transition-colors">
                    Add to Cart
                </button>
            </div>
        </div>
    );
};

interface OrderConfirmationProps {
    order: Order;
    onTrack: () => void;
}
const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ order, onTrack }) => {
    return (
         <div className="text-center p-4">
            <span className="text-7xl">🎉</span>
            <h2 className="text-3xl font-bold my-4">Order Confirmed!</h2>
            <p className="text-gray-600">Your order <span className="font-bold">#{order.id.slice(-6)}</span> is being prepared by our top spuds.</p>
            <button onClick={onTrack} className="mt-6 w-full bg-brand-orange text-white font-bold py-3 px-4 rounded-lg hover:bg-brand-orange/90 transition-colors">
                Track Your Order
            </button>
        </div>
    );
};

const AskTheChefModal: React.FC<{ menuItems: MenuItem[] }> = ({ menuItems }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState<{ text: string, mapLinks: { title: string, uri: string }[] } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAsk = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResponse(null);
        const result = await GeminiService.getChefRecommendation(menuItems, query);
        setResponse(result);
        setLoading(false);
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-2 text-center">Ask The Chef 🧑‍🍳</h2>
            <p className="text-gray-600 mb-6 text-center">Have a question about our menu or need a recommendation? Ask away!</p>
            <div className="flex gap-2">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAsk()}
                    className="flex-grow p-3 border rounded-lg focus:ring-2 focus:ring-brand-orange outline-none"
                    placeholder="e.g., What's a good vegetarian option?"
                    autoFocus
                />
                <button onClick={handleAsk} disabled={loading} className="bg-brand-orange text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400 hover:bg-brand-orange/90 transition-colors">
                    {loading ? '...' : 'Ask'}
                </button>
            </div>
            {loading && <div className="mt-4 text-center">Thinking...</div>}
            {response && (
                <div className="mt-4 p-4 bg-white rounded-lg border">
                    <p className="whitespace-pre-wrap">{response.text}</p>
                    {response.mapLinks && response.mapLinks.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-bold">Relevant Locations:</h4>
                            <ul className="list-disc pl-5">
                                {response.mapLinks.map((link, index) => (
                                    <li key={index}>
                                        <a href={link.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{link.title}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface AiAssistantModalProps {
    menuItems: MenuItem[];
    cart: CartItem[];
    cartTotal: number;
    findItemAndAddToCart: (itemName: string, quantity: number) => boolean;
}
interface ChatPart {
  text?: string;
  functionCall?: FunctionCall;
}
const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ menuItems, cart, cartTotal, findItemAndAddToCart }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [history, setHistory] = useState<{ role: 'user' | 'model'; parts: ChatPart[] }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setChat(GeminiService.createChatSession());
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleSend = async () => {
        if (!input.trim() || !chat || loading) return;
        const userMessage = input;
        setInput('');
        setLoading(true);

        const newHistory = [...history, { role: 'user' as const, parts: [{ text: userMessage }] }];
        setHistory(newHistory);

        try {
            let result = await chat.sendMessage({ message: userMessage });

            if (result.functionCalls && result.functionCalls.length > 0) {
                setHistory(prev => [...prev, { role: 'model', parts: [{ functionCall: result.functionCalls[0] }] }]);
                
                const fc = result.functionCalls[0];
                const functionResponses = [];

                if (fc.name === 'addToCart') {
                    const { items } = fc.args as { items: { itemName: string; quantity: number }[] };
                    let addedItems: string[] = [];
                    items.forEach(item => {
                        if (findItemAndAddToCart(item.itemName, item.quantity)) {
                           addedItems.push(`${item.quantity}x ${item.itemName}`);
                        }
                    });
                    functionResponses.push({
                        functionName: 'addToCart',
                        response: { success: true, message: `Added ${addedItems.join(', ')} to your cart.` }
                    });
                } else if (fc.name === 'viewCart') {
                    const cartContent = cart.map(item => `${item.quantity}x ${item.name}`).join(', ');
                    functionResponses.push({
                        functionName: 'viewCart',
                        response: { content: cart.length > 0 ? `Your cart has: ${cartContent}. The total is ${formatCurrency(cartTotal)}.` : "Your cart is empty." }
                    });
                } else if (fc.name === 'getRecommendations') {
                     const { preferences } = fc.args as { preferences: string };
                     const recommendations = menuItems
                        .filter(item => item.description.toLowerCase().includes(preferences.toLowerCase()) || item.name.toLowerCase().includes(preferences.toLowerCase()))
                        .map(item => item.name)
                        .slice(0, 3);
                     functionResponses.push({
                        functionName: 'getRecommendations',
                        response: { recommendations: recommendations.length > 0 ? recommendations : ["I couldn't find a specific match, but our Classic Cheesy Fries are always a hit!"] }
                     });
                }

                result = await chat.sendMessage({
                    functionResponses
                });
            }

            setHistory(prev => [...prev, { role: 'model', parts: [{text: result.text}] }]);
        } catch (error) {
            console.error("AI Assistant error:", error);
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: "Spud-oh! I'm having a little trouble right now. Please try again." }] }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-2 text-center">Sathi AI 🤖</h2>
            <p className="text-gray-600 mb-4 text-center">Your personal potato-powered assistant.</p>
            <div className="h-96 bg-white rounded-lg p-4 flex flex-col gap-4 overflow-y-auto border">
                {history.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-brand-orange text-white' : 'bg-gray-200'}`}>
                           {msg.parts.map((part, i) => {
                               if (part.text) {
                                   return <p key={i}>{part.text}</p>;
                               } else if (part.functionCall) {
                                   return (
                                       <div key={i} className="text-xs italic text-gray-600 bg-white/50 p-2 rounded">
                                            <p>Calling tool: <code>{part.functionCall.name}</code></p>
                                       </div>
                                   );
                               }
                               return null;
                           })}
                        </div>
                    </div>
                ))}
                {loading && <div className="flex justify-start"><div className="bg-gray-200 p-3 rounded-lg">...</div></div>}
                <div ref={messagesEndRef} />
            </div>
            <div className="mt-4 flex gap-2">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleSend()}
                    className="flex-grow p-3 border rounded-lg"
                    placeholder="e.g., Add two classic fries"
                    disabled={loading}
                />
                <button onClick={handleSend} disabled={loading} className="bg-brand-orange text-white font-bold p-3 rounded-lg">Send</button>
            </div>
        </div>
    );
};

const VoiceAssistantModal: React.FC<{ findItemAndAddToCart: (itemName: string, quantity: number) => boolean; }> = ({ findItemAndAddToCart }) => {
    const [isListening, setIsListening] = useState(false);
    const [status, setStatus] = useState('Click the mic to start');
    const [inputTranscription, setInputTranscription] = useState('');
    const [outputTranscription, setOutputTranscription] = useState('');
    
    const sessionPromise = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContext = useRef<AudioContext | null>(null);
    const outputAudioContext = useRef<AudioContext | null>(null);
    const mediaStream = useRef<MediaStream | null>(null);
    const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSource = useRef<MediaStreamAudioSourceNode | null>(null);
    
    // Audio playback queue state
    const nextStartTime = useRef(0);
    const sources = useRef(new Set<AudioBufferSourceNode>());

    const handleFunctionCall = (fc: FunctionCall) => {
        if (fc.name === 'addToCart') {
            const { items } = fc.args as { items: { itemName: string; quantity: number }[] };
            items.forEach(item => {
                findItemAndAddToCart(item.itemName, item.quantity)
            });
        }
    }

    const startSession = async () => {
        if (isListening) return;
        setIsListening(true);
        setStatus('Connecting...');
        setInputTranscription('');
        setOutputTranscription('');
        
        inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        try {
            mediaStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStatus('Listening...');

            sessionPromise.current = GeminiService.createLiveSession({
                onOpen: () => {
                    console.log('Live session opened.');
                    if (!mediaStream.current || !inputAudioContext.current) return;
                    mediaStreamSource.current = inputAudioContext.current.createMediaStreamSource(mediaStream.current);
                    scriptProcessor.current = inputAudioContext.current.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    mediaStreamSource.current.connect(scriptProcessor.current);
                    scriptProcessor.current.connect(inputAudioContext.current.destination);
                },
                onMessage: async (message) => {
                    if (message.serverContent?.inputTranscription) {
                        setInputTranscription(prev => prev + message.serverContent.inputTranscription.text);
                    }
                    if (message.serverContent?.outputTranscription) {
                        setOutputTranscription(prev => prev + message.serverContent.outputTranscription.text);
                    }

                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContext.current) {
                        nextStartTime.current = Math.max(nextStartTime.current, outputAudioContext.current.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext.current, 24000, 1);
                        const source = outputAudioContext.current.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.current.destination);
                        source.addEventListener('ended', () => { sources.current.delete(source); });
                        source.start(nextStartTime.current);
                        nextStartTime.current += audioBuffer.duration;
                        sources.current.add(source);
                    }

                    if (message.toolCall?.functionCalls) {
                        for (const fc of message.toolCall.functionCalls) {
                            handleFunctionCall(fc);
                            const session = await sessionPromise.current;
                            session?.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: "ok, the items were added to the cart." }
                                }
                            });
                        }
                    }

                    if (message.serverContent?.turnComplete) {
                        setInputTranscription('');
                        setOutputTranscription('');
                    }
                },
                onError: (e) => {
                    console.error('Live session error:', e);
                    setStatus('Error. Please try again.');
                    stopSession();
                },
                onClose: () => {
                    console.log('Live session closed.');
                }
            });

        } catch (error) {
            console.error('Error starting voice session:', error);
            setStatus('Mic access denied.');
            setIsListening(false);
        }
    };
    
    const stopSession = async () => {
        if (!isListening) return;
        setIsListening(false);
        setStatus('Click the mic to start');
        
        mediaStream.current?.getTracks().forEach(track => track.stop());
        scriptProcessor.current?.disconnect();
        mediaStreamSource.current?.disconnect();
        await inputAudioContext.current?.close();
        
        sources.current.forEach(source => source.stop());
        sources.current.clear();
        nextStartTime.current = 0;
        await outputAudioContext.current?.close();
        
        const session = await sessionPromise.current;
        session?.close();

        sessionPromise.current = null;
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-2 text-center">Voice Assistant 🎙️</h2>
            <div className="flex flex-col items-center justify-center h-96">
                <button onClick={isListening ? stopSession : startSession} className={`w-32 h-32 rounded-full flex items-center justify-center transition-colors ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-green hover:bg-brand-green/90'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                </button>
                <p className="mt-4 font-semibold text-lg">{status}</p>
                <div className="mt-4 p-4 bg-white rounded-lg w-full text-center min-h-[6rem]">
                    <p className="text-gray-500">You said:</p>
                    <p className="font-medium">{inputTranscription || '...'}</p>
                    <p className="text-gray-500 mt-2">Sathi said:</p>
                    <p className="font-medium">{outputTranscription || '...'}</p>
                </div>
            </div>
        </div>
    );
};

interface AdminMenuModalProps {
    item: MenuItem | null;
    onSave: (item: MenuItem) => void;
    onAdd: (item: Omit<MenuItem, 'id'>) => void;
}
const AdminMenuModal: React.FC<AdminMenuModalProps> = ({ item, onSave, onAdd }) => {
    const [formData, setFormData] = useState<Omit<MenuItem, 'id' | 'rating'>>(() => {
        if (item) {
            const { id, rating, ...rest } = item;
            return rest;
        }
        return {
            name: '', description: '', price: 0, image: 'https://picsum.photos/seed/newitem/400/300', category: 'Loaded Fries',
            spicyLevel: 0, dietaryTags: [],
        }
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: name === 'price' || name === 'spicyLevel' ? parseFloat(value) : value }));
    };

    const handleDietaryChange = (tag: 'Vegetarian' | 'Vegan' | 'Gluten-Free') => {
        setFormData(prev => {
            const newTags = prev.dietaryTags.includes(tag) ? prev.dietaryTags.filter(t => t !== tag) : [...prev.dietaryTags, tag];
            return {...prev, dietaryTags: newTags};
        });
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const itemWithRating = { ...formData, rating: item?.rating || 4.5 };
        if(item) {
            onSave({ ...itemWithRating, id: item.id });
        } else {
            onAdd(itemWithRating);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4">{item ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
            <div className="space-y-4">
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Name" className="w-full p-2 border rounded" required />
                <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description" className="w-full p-2 border rounded" required />
                <input name="price" type="number" step="0.01" value={formData.price} onChange={handleChange} placeholder="Price" className="w-full p-2 border rounded" required />
                <input name="image" value={formData.image} onChange={handleChange} placeholder="Image URL" className="w-full p-2 border rounded" />
                <select name="category" value={formData.category} onChange={handleChange} className="w-full p-2 border rounded">
                    <option>Loaded Fries</option>
                    <option>Sides</option>
                    <option>Drinks</option>
                </select>
                <div>
                    <label>Spicy Level: {formData.spicyLevel}</label>
                    <input name="spicyLevel" type="range" min="0" max="3" value={formData.spicyLevel} onChange={handleChange} className="w-full" />
                </div>
                 <div>
                    <label className="font-semibold">Dietary Tags:</label>
                    <div className="flex gap-4 mt-1">
                        {(['Vegetarian', 'Vegan', 'Gluten-Free'] as const).map(tag => (
                             <label key={tag} className="flex items-center gap-2"><input type="checkbox" checked={formData.dietaryTags.includes(tag)} onChange={() => handleDietaryChange(tag)}/> {tag}</label>
                        ))}
                    </div>
                </div>
            </div>
            <button type="submit" className="mt-6 w-full bg-brand-green text-white font-bold py-2 px-4 rounded-lg">Save</button>
        </form>
    );
};

interface AdminPromoModalProps {
    promo: PromoCode | null;
    onSave: (promo: PromoCode) => void;
    onAdd: (promo: PromoCode) => void;
}
const AdminPromoModal: React.FC<AdminPromoModalProps> = ({ promo, onSave, onAdd }) => {
     const [formData, setFormData] = useState<PromoCode>(() => promo || {
        code: '', discountPercentage: 10, isActive: true
     });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        if (name === 'code') {
             setFormData(prev => ({...prev, [name]: value.toUpperCase()}));
        } else {
            setFormData(prev => ({...prev, [name]: type === 'checkbox' ? checked : parseInt(value)}));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(promo) {
            onSave(formData);
        } else {
            onAdd(formData);
        }
    };

     return (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold mb-4">{promo ? 'Edit Promo Code' : 'Add New Promo Code'}</h2>
            <div className="space-y-4">
                <input name="code" value={formData.code} onChange={handleChange} placeholder="PROMOCODE" className="w-full p-2 border rounded" required disabled={!!promo} />
                <input name="discountPercentage" type="number" value={formData.discountPercentage} onChange={handleChange} placeholder="Discount %" className="w-full p-2 border rounded" required />
                <label className="flex items-center gap-2">
                    <input name="isActive" type="checkbox" checked={formData.isActive} onChange={handleChange} />
                    Active
                </label>
            </div>
            <button type="submit" className="mt-6 w-full bg-brand-green text-white font-bold py-2 px-4 rounded-lg">Save</button>
        </form>
    );
};