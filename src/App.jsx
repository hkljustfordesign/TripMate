import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  CreditCard, 
  Users, 
  Plus, 
  Trash2, 
  Plane, 
  Train, 
  Camera, 
  Calculator, 
  ArrowRightLeft, 
  Share2, 
  Navigation, 
  Utensils, 
  ShoppingBag, 
  Ticket, 
  AlertCircle, 
  CheckCircle2, 
  Palmtree, 
  Wallet, 
  Settings, 
  ChevronRight, 
  BedDouble, 
  Bus, 
  Store, 
  Pill, 
  Bell, 
  Menu, 
  X, 
  Languages, 
  PieChart, 
  Luggage, 
  ClipboardList, 
  Heart, 
  NotebookPen, 
  Volume2, 
  Coffee, 
  Gamepad2, 
  Smile, 
  Home, 
  MinusCircle,
  Car,
  Footprints,
  Anchor,
  Gift,
  Map,
  Armchair
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBh0YDP353os0h_CwjJ04K4U9NTVDa2nn4",
  authDomain: "tripmate-c8148.firebaseapp.com",
  projectId: "tripmate-c8148",
  storageBucket: "tripmate-c8148.firebasestorage.app",
  messagingSenderId: "1051971323186",
  appId: "1:1051971323186:web:c6596264c4de9fe9ad032b",
  measurementId: "G-SKXY7CYE3T"
};
const appId = "my-trip-mate"; // TripMate
const initialAuthToken = null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Global Font Style ---
const fontStyle = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500;600;700&display=swap');
body {
  font-family: 'GenRyuMin', 'Noto Serif TC', serif;
}
/* Custom Scrollbar for Menu */
.menu-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.menu-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}
.menu-scrollbar::-webkit-scrollbar-thumb {
  background: #d1d5db; 
  border-radius: 4px;
}
.menu-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #9ca3af; 
}
`;

// --- Audio Helpers for TTS ---
const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const pcmToWav = (pcm16, sampleRate) => {
    const numChannels = 1;
    const bytesPerSample = 2; 
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcm16.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    view.setUint32(0, 0x46464952, false); 
    view.setUint32(4, 36 + dataSize, true); 
    view.setUint32(8, 0x45564157, false); 
    view.setUint32(12, 0x20746d66, false); 
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true); 
    view.setUint16(22, numChannels, true); 
    view.setUint32(24, sampleRate, true); 
    view.setUint32(28, byteRate, true); 
    view.setUint16(32, blockAlign, true); 
    view.setUint16(34, 16, true); 
    view.setUint32(36, 0x61746164, false); 
    view.setUint32(40, dataSize, true); 

    let offset = 44;
    for (let i = 0; i < pcm16.length; i++, offset += 2) {
        view.setInt16(offset, pcm16[i], true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
};

// --- Helper: Google Maps Link ---
const getGoogleMapsLink = (location) => {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(localStorage.getItem('last_trip_id') || '');
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = fontStyle;
    document.head.appendChild(style);

    const initAuth = async () => {
      if (initialAuthToken) {
        await signInWithCustomToken(auth, initialAuthToken);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const handleJoinTrip = (id) => {
    if (!id.trim()) return;
    setTripId(id);
    localStorage.setItem('last_trip_id', id);
    setIsJoined(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 font-serif">
        <div className="animate-pulse text-emerald-600 font-bold text-xl flex items-center gap-2">
          <Palmtree size={24} />
          正在載入旅伴 TripMate...
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return <Onboarding onJoin={handleJoinTrip} initialId={tripId} />;
  }

  return <TripDashboard tripId={tripId} userId={user.uid} onLeave={() => setIsJoined(false)} />;
}

// --- Onboarding Component ---
function Onboarding({ onJoin, initialId }) {
  const [input, setInput] = useState(initialId);
  return (
    <div className="min-h-screen bg-[#E8F5E9] flex flex-col items-center justify-center p-6 relative overflow-hidden font-serif">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 w-full max-w-md text-center relative z-10 border border-white/50">
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-5 rounded-2xl text-white shadow-lg transform -rotate-6">
            <Plane size={56} strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-emerald-900 mb-2 tracking-tight">旅伴 TripMate</h1>
        <p className="text-stone-600 mb-8 font-medium">你的智能旅遊規劃助手</p>
        <div className="space-y-5">
          <div className="text-left">
            <label className="block text-sm font-bold text-emerald-800 mb-2 ml-1">旅遊代碼 (Trip ID)</label>
            <div className="relative">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="例如: Toyko2024" className="w-full px-5 py-4 bg-stone-50 border-2 border-stone-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition text-lg font-medium text-emerald-900 placeholder:text-stone-400"/>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-emerald-500 pointer-events-none"><Share2 size={20} /></div>
            </div>
          </div>
          <button onClick={() => onJoin(input)} className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-emerald-200/50 active:transform active:scale-[0.98] text-lg flex items-center justify-center gap-2">開始旅程 <ChevronRight size={20} /></button>
          <p className="text-xs text-stone-500 mt-4 bg-emerald-50/50 py-2 rounded-lg"><Users size={14} className="inline mr-1 relative -top-[1px]" /> 與朋友輸入相同代碼即可多人連動</p>
        </div>
      </div>
    </div>
  );
}

// --- Dashboard & Navigation ---
function TripDashboard({ tripId, userId, onLeave }) {
  const [activeTab, setActiveTab] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Data States
  const [items, setItems] = useState([]); // Combined trip items
  const [expenses, setExpenses] = useState([]);
  const [packingItems, setPackingItems] = useState([]);
  const [todoItems, setTodoItems] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);

  useEffect(() => {
    if (!tripId) return;
    
    const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'trip_items');
    const unsubItems = onSnapshot(itemsRef, (snap) => {
      const list = snap.docs.map(d => ({id:d.id, ...d.data()}))
        .filter(item => item.tripId === tripId)
        .sort((a,b)=>{
           const tA = a.datetime || a.checkInTime || '9999-99-99';
           const tB = b.datetime || b.checkInTime || '9999-99-99';
           return tA.localeCompare(tB);
        });
      setItems(list);
    });
    
    const expRef = collection(db, 'artifacts', appId, 'public', 'data', 'trip_expenses');
    const unsubExp = onSnapshot(expRef, (snap) => setExpenses(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>b.createdAt-a.createdAt)));

    const packRef = collection(db, 'artifacts', appId, 'public', 'data', 'trip_packing');
    const unsubPack = onSnapshot(packRef, (snap) => setPackingItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));

    const todoRef = collection(db, 'artifacts', appId, 'public', 'data', 'trip_todo');
    const unsubTodo = onSnapshot(todoRef, (snap) => setTodoItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));

    const wishRef = collection(db, 'artifacts', appId, 'public', 'data', 'trip_wishlist');
    const unsubWish = onSnapshot(wishRef, (snap) => setWishlistItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));

    return () => { unsubItems(); unsubExp(); unsubPack(); unsubTodo(); unsubWish(); };
  }, [tripId]);

  return (
    <div className="min-h-screen bg-[#F5F7F4] flex flex-col max-w-[1600px] mx-auto shadow-2xl overflow-hidden font-serif">
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#F5F7F4] relative">
        <div className="sticky top-0 z-10 bg-white shadow-md p-4 flex justify-between items-center md:hidden border-b border-stone-100">
            <h1 className="text-xl font-bold text-emerald-900 flex items-center gap-2"><Palmtree size={24} className="text-emerald-500" /> TripMate</h1>
            <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-full">{tripId}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-0 pb-24">
          {activeTab === 'home' && <UnifiedHomeView items={items} wishlistItems={wishlistItems} />}
          {activeTab === 'itinerary' && <ItineraryView tripId={tripId} items={items} />}
          {activeTab === 'transport' && <TransportView tripId={tripId} items={items} />}
          {activeTab === 'accommodation' && <AccommodationView tripId={tripId} items={items} />}
          {activeTab === 'expense' && <ExpenseView tripId={tripId} expenses={expenses} />}
          {activeTab === 'packing' && <PackingListView tripId={tripId} items={packingItems} />}
          {activeTab === 'todo' && <TodoListView tripId={tripId} items={todoItems} />}
          {activeTab === 'wishlist' && <WishListView tripId={tripId} items={wishlistItems} />}
          {activeTab === 'tools' && <ToolsView />}
        </div>
      </main>
      <MobileFabMenu activeTab={activeTab} onNavClick={(id)=>{setActiveTab(id);setIsMenuOpen(false)}} onLeave={onLeave} tripId={tripId} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
    </div>
  );
}

// --- Modified FAB Menu Component ---
function MobileFabMenu({ activeTab, onNavClick, onLeave, tripId, isMenuOpen, setIsMenuOpen }) {
  const menuItems = [
    { id: 'home', label: '首頁', icon: <Home size={20} /> },
    { id: 'itinerary', label: '行程總覽', icon: <Calendar size={20} /> },
    { id: 'transport', label: '交通情報', icon: <Train size={20} /> },
    { id: 'accommodation', label: '住宿登錄', icon: <BedDouble size={20} /> },
    { id: 'expense', label: '記帳分帳', icon: <Wallet size={20} /> },
    { id: 'packing', label: '行李清單', icon: <Luggage size={20} /> },
    { id: 'todo', label: '代辦事項', icon: <ClipboardList size={20} /> },
    { id: 'wishlist', label: '願望清單', icon: <Heart size={20} /> },
    { id: 'tools', label: '旅遊工具', icon: <Settings size={20} /> },
  ];

  return (
    <>
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white p-4 rounded-full shadow-xl shadow-emerald-400/50 hover:bg-emerald-700 transition duration-150 active:scale-95 transform md:bottom-8 md:right-8">
        {isMenuOpen ? <X size={28} strokeWidth={2.5} /> : <Menu size={28} strokeWidth={2.5} />}
      </button>
      <div className={`fixed inset-0 bg-emerald-900/95 backdrop-blur-sm z-40 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} onClick={() => setIsMenuOpen(false)}>
        <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-[32px] shadow-2xl p-6 transform transition-transform duration-300 ease-out flex flex-col max-h-[85vh]" style={{ transform: isMenuOpen ? 'translateY(0)' : 'translateY(100%)' }} onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4 border-b pb-4 border-stone-100 shrink-0">
            <h3 className="text-2xl font-bold text-emerald-900">旅程導航</h3>
            <button onClick={() => setIsMenuOpen(false)} className="text-stone-400 hover:text-stone-600 bg-stone-100 p-2 rounded-full transition"><X size={20} /></button>
          </div>
          <div className="overflow-y-auto menu-scrollbar pr-1 pb-2 flex-1">
             <div className="grid grid-cols-3 gap-4 mb-8">
               {menuItems.map(item => (
                 <button key={item.id} onClick={() => onNavClick(item.id)} className={`flex flex-col items-center justify-center p-4 transition-all w-full rounded-2xl aspect-square shadow-sm ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-stone-50 text-stone-600 hover:bg-emerald-100'}`}>
                   <div className={`transition-transform duration-300 mb-2 ${activeTab === item.id ? 'scale-110' : ''}`}>{item.icon}</div>
                   <span className="text-xs font-bold text-center mt-1 leading-tight">{item.label}</span>
                 </button>
               ))}
             </div>
          </div>
          <div className="mt-4 pt-4 border-t border-stone-100 shrink-0">
            <button onClick={onLeave} className="w-full flex items-center justify-center gap-3 text-red-500 hover:bg-red-50 p-3 rounded-xl transition font-medium border border-red-200"><ArrowRightLeft size={20} /> 離開行程 / 切換代碼</button>
          </div>
        </div>
      </div>
    </>
  );
}

// --- 1. UNIFIED HOME VIEW (With Maps Link) ---
function UnifiedHomeView({ items, wishlistItems }) {
  const timelineItems = items.sort((a, b) => {
    const timeA = a.datetime || a.checkInTime || '9999';
    const timeB = b.datetime || b.checkInTime || '9999';
    return timeA.localeCompare(timeB);
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="mb-6"><h2 className="text-3xl font-bold text-emerald-900 tracking-tight flex items-center gap-3"><Home className="text-emerald-600" size={32}/> 旅程首頁</h2><p className="text-stone-500 font-medium mt-1">您的完整旅程時間軸與願望清單</p></div>
      <div className="space-y-6 relative">
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-emerald-200/50"></div>
        {timelineItems.length === 0 ? (<div className="ml-10 p-6 bg-white rounded-2xl border border-stone-100 text-stone-400 text-center">尚無行程資料，請至各分頁新增。</div>) : (
           timelineItems.map((item, index) => {
             let Icon = MapPin, bgColor = 'bg-white', borderColor = 'border-stone-100', timeDisplay = item.datetime ? new Date(item.datetime).toLocaleString('zh-TW', {year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '未定時間';
             let categoryLabel = '一般行程';
             
             // Dynamic Icons & Colors based on type
             if (item.type === 'flight') { Icon = Plane; bgColor = 'bg-blue-50'; borderColor = 'border-blue-100'; categoryLabel='機票'; }
             else if (item.type === 'train') { Icon = Train; bgColor = 'bg-emerald-50'; borderColor = 'border-emerald-100'; categoryLabel='火車'; }
             else if (item.type === 'ship') { Icon = Anchor; bgColor = 'bg-cyan-50'; borderColor = 'border-cyan-100'; categoryLabel='船票'; }
             else if (item.type === 'bus') { Icon = Bus; bgColor = 'bg-yellow-50'; borderColor = 'border-yellow-100'; categoryLabel='巴士'; }
             else if (item.type === 'accommodation') { Icon = BedDouble; bgColor = 'bg-orange-50'; borderColor = 'border-orange-100'; timeDisplay = `入住: ${item.checkInTime} / 退房: ${item.checkOutTime}`; categoryLabel='住宿'; }
             else if (item.type === 'shopping') { Icon = ShoppingBag; bgColor = 'bg-pink-50'; borderColor = 'border-pink-100'; categoryLabel='購物'; }
             else if (item.type === 'food') { Icon = Utensils; bgColor = 'bg-red-50'; borderColor = 'border-red-100'; categoryLabel='餐廳'; }
             else if (item.type === 'gift') { Icon = Gift; bgColor = 'bg-purple-50'; borderColor = 'border-purple-100'; categoryLabel='禮品'; }
             else if (item.type === 'sight') { Icon = Camera; bgColor = 'bg-emerald-50'; borderColor = 'border-emerald-100'; categoryLabel='景點'; }

             return (
               <div key={item.id} className="relative ml-10 animate-fade-in-up" style={{animationDelay: `${index * 50}ms`}}>
                 <div className="absolute -left-[42px] top-4 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white shadow-sm z-10"></div>
                 <div className={`p-5 rounded-2xl shadow-sm border ${borderColor} ${bgColor} flex flex-col gap-3`}>
                    <div className="flex justify-between items-start">
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon size={18} className="text-emerald-600" />
                            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{categoryLabel}</span>
                          </div>
                          <h3 className="text-xl font-bold text-stone-800">{item.title}</h3>
                          <div className="text-sm font-medium text-emerald-700 mt-1 flex items-center gap-1"><Clock size={14}/> {timeDisplay}</div>
                       </div>
                    </div>
                    {/* Location & Map Link */}
                    {item.location && (
                       <div className="text-sm text-stone-600 flex items-center gap-1">
                          <MapPin size={14} className="shrink-0"/> 
                          {item.location}
                          <a href={getGoogleMapsLink(item.location)} target="_blank" rel="noreferrer" className="ml-2 bg-white/80 p-1.5 rounded-lg border border-stone-200 text-blue-600 hover:text-blue-800 hover:border-blue-300 transition shadow-sm flex items-center gap-1 text-xs font-bold">
                            <Map size={12}/> 地圖
                          </a>
                       </div>
                    )}
                    
                    {/* Transport Specific Info */}
                    {item.originDest && (
                        <div className="flex items-center gap-2 bg-white/60 p-2 rounded-lg text-sm text-stone-700">
                             <ArrowRightLeft size={14} className="text-stone-400"/>
                             <span className="font-bold">{item.originDest}</span>
                        </div>
                    )}
                     {item.seatInfo && (
                        <div className="flex items-center gap-2 text-sm text-stone-500 ml-1">
                             <Armchair size={14} />
                             <span>座位/班次: {item.seatInfo}</span>
                        </div>
                    )}

                    {/* Itinerary Specific Info (Transport Method) */}
                    {item.transportMethod && (
                        <div className="flex items-center gap-2 text-sm text-stone-500 ml-1 mt-1">
                             {item.transportMethod === 'subway' && <Train size={14} />}
                             {item.transportMethod === 'bus' && <Bus size={14} />}
                             {item.transportMethod === 'walk' && <Footprints size={14} />}
                             {item.transportMethod === 'car' && <Car size={14} />}
                             <span>交通: {item.transportMethod === 'subway' ? '地鐵' : item.transportMethod === 'bus' ? '公車' : item.transportMethod === 'walk' ? '步行' : '開車'}</span>
                        </div>
                    )}

                    {item.imageUrl && <div className="mt-2 rounded-xl overflow-hidden shadow-sm h-48 w-full"><img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transform hover:scale-105 transition duration-500" onError={(e)=>{e.target.style.display='none'}}/></div>}
                 </div>
               </div>
             )
           })
        )}
      </div>
      <div className="mt-12 pt-8 border-t border-stone-200">
         <h3 className="text-2xl font-bold text-emerald-900 mb-6 flex items-center gap-2"><Heart className="text-pink-500" size={24}/> 願望清單 (待探索)</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wishlistItems.length === 0 ? <div className="col-span-full text-stone-400 text-center py-4 bg-stone-50 rounded-xl">尚無願望清單項目</div> : wishlistItems.map(item => (
                  <a key={item.id} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}`} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition">
                    <div className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-2xl shrink-0">{item.category === '吃' ? '🍜' : item.category === '喝' ? '☕' : item.category === '玩' ? '🎡' : '🛍️'}</span>
                            <span className="font-bold text-stone-700 truncate">{item.name}</span>
                        </div>
                        <div className="p-2 text-emerald-500 bg-emerald-50 rounded-full shrink-0"><MapPin size={18}/></div>
                    </div>
                  </a>
            ))}
         </div>
      </div>
    </div>
  );
}

// --- 4. EXPENSE VIEW (Merged Split Calculator) ---
function ExpenseView({ tripId, expenses }) {
  const [showAdd, setShowAdd] = useState(false);

  const totalTWD = expenses.reduce((sum, item) => {
      let rate = 1;
      if (item.currency === 'JPY') rate = 0.22;
      if (item.currency === 'USD') rate = 32;
      if (item.currency === 'EUR') rate = 35;
      if (item.currency === 'KRW') rate = 0.024;
      return sum + (Number(item.amount) * rate);
  }, 0);

  return (
    <div className="space-y-8 pb-20 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8 flex-wrap gap-2">
        <div><h2 className="text-3xl font-bold text-emerald-900 tracking-tight flex gap-2 items-center"><Wallet className="text-emerald-600" size={32}/> 記帳分帳</h2><div className="mt-2 text-stone-500 font-bold">總支出約 <span className="text-emerald-600 text-2xl font-mono">NT$ {Math.round(totalTWD).toLocaleString()}</span></div></div>
        <button onClick={() => setShowAdd(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl flex items-center gap-2 shadow-lg font-bold transition"><Plus size={20} /> 加一筆 / 分帳</button>
      </div>
      <div className="bg-white rounded-[32px] shadow-sm border border-stone-100 overflow-hidden">
        {expenses.length === 0 ? <div className="p-16 text-center text-stone-400 font-bold">目前沒有支出紀錄</div> : <div className="divide-y divide-stone-100">{expenses.map(exp => (
          <div key={exp.id} className="p-5 flex justify-between items-center">
            <div><h4 className="font-bold text-stone-800 text-lg">{exp.title}</h4><div className="text-sm text-stone-500">{exp.payer} 付款</div></div>
            <div className="flex items-center gap-4"><div className="text-right"><div className="font-mono font-bold text-stone-800 text-lg">{exp.currency} {Number(exp.amount).toLocaleString()}</div></div><button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_expenses', exp.id))} className="text-stone-300 hover:text-red-500"><Trash2 size={20}/></button></div>
          </div>
        ))}</div>}
      </div>
      {showAdd && <AddExpenseModal tripId={tripId} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddExpenseModal({ tripId, onClose }) {
  const [activeTab, setActiveTab] = useState('add');
  const [f, setF] = useState({ title: '', amount: '', payer: '', currency: 'TWD' });
  const [splitMode, setSplitMode] = useState('equal');
  const [count, setCount] = useState(2);
  const [people, setPeople] = useState([{id: 1, name: '', amount: ''}, {id: 2, name: '', amount: ''}]);

  const sub = async (e) => { 
      e.preventDefault(); 
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_expenses'), { ...f, tripId, createdAt: serverTimestamp() }); 
      onClose(); 
  };

  const perPerson = f.amount && count ? (parseFloat(f.amount) / parseInt(count)).toFixed(1) : 0;
  const currentSum = people.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const remaining = (parseFloat(f.amount) || 0) - currentSum;

  const addPerson = () => setPeople([...people, {id: Date.now(), name: '', amount: ''}]);
  const removePerson = (id) => setPeople(people.filter(p => p.id !== id));
  const updatePerson = (id, field, val) => setPeople(people.map(p => p.id === id ? {...p, [field]: val} : p));

  const inputStyle = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none";

  return (
    <div className="fixed inset-0 bg-emerald-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl text-emerald-900">{activeTab === 'add' ? '新增支出' : '分帳計算機'}</h3><button onClick={onClose}><X size={20} className="text-stone-400"/></button></div>
        <div className="flex bg-stone-100 p-1 rounded-xl mb-4 shrink-0"><button onClick={()=>setActiveTab('add')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab==='add' ? 'bg-white shadow text-emerald-700' : 'text-stone-500'}`}>一般記帳</button><button onClick={()=>setActiveTab('split')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab==='split' ? 'bg-white shadow text-emerald-700' : 'text-stone-500'}`}>分帳計算</button></div>
        <form onSubmit={sub} className="space-y-4 flex-1 overflow-y-auto menu-scrollbar pr-1">
            {/* Currency and Amount are shared now */}
            <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">項目名稱</label><input type="text" required={activeTab === 'add'} placeholder="例如: 晚餐" className={inputStyle} value={f.title} onChange={e=>setF({...f, title:e.target.value})}/></div>
            <div className="flex gap-2">
                <div className="w-1/3"><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">幣別</label><select className={inputStyle} value={f.currency} onChange={e=>setF({...f, currency:e.target.value})}><option>TWD</option><option>JPY</option><option>USD</option><option>EUR</option><option>KRW</option></select></div>
                <div className="w-2/3"><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">總金額</label><input type="number" required placeholder="0.00" className={inputStyle} value={f.amount} onChange={e=>setF({...f, amount:e.target.value})}/></div>
            </div>

            {activeTab === 'add' ? (
                <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">付款人</label><input type="text" placeholder="誰付的錢?" className={inputStyle} value={f.payer} onChange={e=>setF({...f, payer:e.target.value})}/></div>
            ) : (
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-4">
                    <div className="flex gap-2 bg-white/60 p-1 rounded-lg"><button type="button" onClick={()=>setSplitMode('equal')} className={`flex-1 py-1 rounded text-xs font-bold ${splitMode==='equal' ? 'bg-white shadow text-emerald-600' : 'text-stone-400'}`}>平均分攤</button><button type="button" onClick={()=>setSplitMode('manual')} className={`flex-1 py-1 rounded text-xs font-bold ${splitMode==='manual' ? 'bg-white shadow text-emerald-600' : 'text-stone-400'}`}>手動輸入</button></div>
                    {splitMode === 'equal' ? (
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-4 mb-2">
                                <button type="button" onClick={()=>setCount(Math.max(1, count-1))} className="w-8 h-8 rounded-full bg-white shadow text-stone-600 font-bold">-</button>
                                <span className="font-mono text-xl font-bold">{count} 人</span>
                                <button type="button" onClick={()=>setCount(count+1)} className="w-8 h-8 rounded-full bg-white shadow text-stone-600 font-bold">+</button>
                            </div>
                            <div className="text-emerald-600 font-bold text-lg">每人 {f.currency} {Number(perPerson).toLocaleString()}</div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {people.map((p, i) => (
                                <div key={p.id} className="flex gap-2 items-center">
                                    <input type="text" placeholder={`成員 ${i+1}`} className="flex-1 p-2 bg-white rounded-lg text-sm border border-stone-200 outline-none" value={p.name} onChange={e=>updatePerson(p.id, 'name', e.target.value)} />
                                    <input type="number" placeholder="0" className="w-20 p-2 bg-white rounded-lg text-sm font-mono text-right border border-stone-200 outline-none" value={p.amount} onChange={e=>updatePerson(p.id, 'amount', e.target.value)} />
                                    <button type="button" onClick={()=>removePerson(p.id)} className="text-stone-400 hover:text-red-400"><MinusCircle size={16}/></button>
                                </div>
                            ))}
                            <button type="button" onClick={addPerson} className="w-full py-2 text-xs border border-dashed border-stone-300 rounded-lg text-stone-400 hover:bg-stone-50">+ 增加成員</button>
                            <div className={`text-xs font-bold text-right ${remaining===0?'text-green-500':'text-red-500'}`}>剩餘: {remaining.toLocaleString()}</div>
                        </div>
                    )}
                    <div className="text-xs text-stone-400 text-center pt-2 border-t border-emerald-100">* 點擊下方按鈕可直接將「總金額」存入記帳</div>
                </div>
            )}
            <button className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl mt-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-200/50">{activeTab === 'add' ? '確認記帳' : '確認分帳並儲存'}</button>
        </form>
      </div>
    </div>
  );
}

// --- Tools ---
function ToolsView() { const [tab, setTab] = useState('phrases'); return <div className="space-y-6 max-w-4xl mx-auto"><h2 className="text-3xl font-bold text-emerald-900 tracking-tight mb-2 flex items-center gap-3"><Settings size={32}/> 旅遊工具</h2><div className="flex gap-4 border-b border-stone-200">{['phrases', 'gojuon'].map(t => <button key={t} onClick={()=>setTab(t)} className={`pb-2 font-bold ${tab===t ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-stone-400'}`}>{t==='phrases'?'日語會話':'五十音表'}</button>)}</div>{tab==='phrases' ? <JapanesePhrases /> : <GojuonChart />}</div>; }
function JapanesePhrases() { const playGoogleAudio = (text) => { const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(text)}`; new Audio(url).play(); }; const categories = { "出入境": ["パスポートを見せてください (請出示護照)", "入国カードはどこですか (入境卡在哪裡)", "観光で来ました (我是來觀光的)", "滞在期間は五日です (預計停留五天)", "申告するものはありますか (有需要申報的東西嗎)", "荷物はこれだけです (行李只有這些)", "台湾から来ました (我來自台灣)", "両替はどこですか (哪裡可以換錢)"], "購物": ["これはいくらですか (這個多少錢)", "これをください (我要這個)", "クレジットカードは使えますか (可以用信用卡嗎)", "免税できますか (可以免稅嗎)", "試着してもいいですか (可以試穿嗎)", "新しいのはありますか (有新的嗎)", "袋はいりません (不用袋子)", "領収書をください (請給我收據)"], "交通": ["駅はどこですか (車站在哪裡)", "切符売り場はどこですか (售票處在哪裡)", "この電車は東京に行きますか (這班車去東京嗎)", "路線図をもらえますか (可以給我路線圖嗎)", "次の駅はどこですか (下一站是哪裡)", "タクシー乗り場はどこですか (計程車乘車處在哪裡)", "このバスは空港に行きますか (這公車去機場嗎)", "ICカードにチャージしたい (我想儲值IC卡)"], "住宿": ["チェックインをお願いします (我要辦理入住)", "予約しています (我有預約)", "Wi-Fiのパスワードは何ですか (Wi-Fi密碼是什麼)", "荷物を預かってくれませんか (可以幫我寄放行李嗎)", "朝食は何時ですか (早餐幾點開始)", "チェックアウトをお願いします (我要退房)", "部屋が暑いです (房間很熱)", "タクシーを呼んでください (請幫我叫計程車)"], "餐廳": ["メニューをください (請給我菜單)", "お水をください (請給我水)", "お会計をお願いします (請結帳)", "おすすめは何ですか (有什麼推薦的)", "二人です (兩位)", "パクチー抜きでお願いします (請不要加香菜)", "持ち帰りできますか (可以外帶嗎)", "とても美味しいです (非常好吃)"], "打招呼": ["こんにちは (你好)", "おはようございます (早安)", "こんばんは (晚安)", "ありがとうございます (謝謝)", "すみません (不好意思/對不起)", "お願いします (拜託你了/麻煩你了)", "失礼します (失陪了/打擾了)", "さようなら (再見)"] }; return <div className="grid gap-6">{Object.entries(categories).map(([cat, phrases], i) => <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100"><h3 className="font-bold text-lg text-emerald-800 mb-4 pb-2 border-b border-stone-50">{cat}</h3><div className="space-y-3">{phrases.map((p, idx) => { const [jp, cn] = p.split(' ('); return <div key={idx} className="flex justify-between items-center bg-stone-50 p-3 rounded-xl hover:bg-emerald-50 transition"><div><div className="font-bold text-stone-800 text-lg mb-1">{jp}</div><div className="text-sm text-stone-500">{cn.replace(')', '')}</div></div><button onClick={() => playGoogleAudio(jp)} className="p-3 bg-white border border-emerald-100 rounded-full text-emerald-600 hover:bg-emerald-600 hover:text-white transition shadow-sm"><Volume2 size={20} /></button></div> })}</div></div>)}</div>; }
function GojuonChart() { const hiragana = [['あ','い','う','え','お'], ['か','き','く','け','こ'], ['さ','し','す','せ','そ'], ['た','ち','つ','て','と'], ['な','に','ぬ','ね','の'], ['は','ひ','ふ','へ','ほ'], ['ま','み','む','め','も'], ['や','','ゆ','','よ'], ['ら','り','る','れ','ろ'], ['わ','','','','を'], ['ん','','','','']]; const katakana = [['ア','イ','ウ','エ','オ'], ['カ','キ','ク','ケ','コ'], ['サ','シ','ス','セ','ソ'], ['タ','チ','ツ','テ','ト'], ['ナ','ニ','ヌ','ネ','ノ'], ['ハ','ヒ','フ','ヘ','ホ'], ['マ','ミ','ム','メ','モ'], ['ヤ','','ユ','','ヨ'], ['ラ','リ','ル','レ','ロ'], ['ワ','','','','ヲ'], ['ン','','','','']]; return <div className="space-y-8"><div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100"><h3 className="font-bold text-xl text-emerald-800 mb-4 border-l-4 border-emerald-500 pl-3">平假名 (Hiragana)</h3><div className="grid grid-cols-5 gap-2 text-center font-mono text-lg">{hiragana.flat().map((c, i) => <div key={`h-${i}`} className={`p-3 rounded-lg ${c ? 'bg-emerald-50 text-emerald-900 font-bold hover:bg-emerald-100' : ''}`}>{c}</div>)}</div></div><div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100"><h3 className="font-bold text-xl text-orange-800 mb-4 border-l-4 border-orange-500 pl-3">片假名 (Katakana)</h3><div className="grid grid-cols-5 gap-2 text-center font-mono text-lg">{katakana.flat().map((c, i) => <div key={`k-${i}`} className={`p-3 rounded-lg ${c ? 'bg-orange-50 text-orange-900 font-bold hover:bg-orange-100' : ''}`}>{c}</div>)}</div></div></div>; }

// --- Other Views ---
function PackingListView({ tripId, items }) { const [newItem, setNewItem] = useState(''); const handleAdd = async (e) => { e.preventDefault(); if(!newItem.trim()) return; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_packing'), { tripId, item: newItem.trim(), completed: false, createdAt: serverTimestamp() }); setNewItem(''); }; const toggle = (item) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_packing', item.id), { completed: !item.completed }); const del = (id) => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_packing', id)); return <div className="space-y-6 max-w-4xl mx-auto"><div className="flex items-end gap-3 mb-4"><h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Luggage className="text-emerald-600" size={32}/> 行李清單</h2></div><form onSubmit={handleAdd} className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-stone-100"><input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="新增行李項目..." className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" /><button className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700"><Plus size={24}/></button></form><div className="space-y-3">{items.length===0 ? <div className="text-center text-stone-400 py-10">尚無項目</div> : items.map(item => (<div key={item.id} className="flex items-center bg-white p-4 rounded-xl border border-stone-100 shadow-sm cursor-pointer" onClick={() => toggle(item)}><div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>{item.completed && <CheckCircle2 size={16} className="text-white"/>}</div><span className={`flex-1 text-lg font-medium ${item.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{item.item}</span><button onClick={(e)=>{e.stopPropagation();del(item.id)}} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button></div>))}</div></div>; }
function TodoListView({ tripId, items }) { const [newItem, setNewItem] = useState(''); const [editItem, setEditItem] = useState(null); const handleAdd = async (e) => { e.preventDefault(); if(!newItem.trim()) return; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_todo'), { tripId, task: newItem.trim(), completed: false, notes: '', createdAt: serverTimestamp() }); setNewItem(''); }; const toggle = (item) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_todo', item.id), { completed: !item.completed }); const del = (id) => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_todo', id)); const saveNote = (id, notes) => { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_todo', id), { notes }); setEditItem(null); }; return <div className="space-y-6 max-w-4xl mx-auto"><div className="flex items-end gap-3 mb-4"><h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><ClipboardList className="text-emerald-600" size={32}/> 代辦事項</h2></div><form onSubmit={handleAdd} className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-stone-100"><input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="新增代辦..." className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" /><button className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700"><Plus size={24}/></button></form><div className="space-y-3">{items.length===0 ? <div className="text-center text-stone-400 py-10">尚無代辦事項</div> : items.map(item => (<div key={item.id} className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm cursor-pointer" onClick={() => setEditItem(item)}><div className="flex items-center"><button onClick={(e) => { e.stopPropagation(); toggle(item); }} className={`p-1 rounded-full border-2 mr-3 ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 text-transparent'}`}><CheckCircle2 size={18}/></button><span className={`flex-1 text-lg font-medium ${item.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{item.task}</span><button onClick={(e)=>{e.stopPropagation();del(item.id)}} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button></div>{item.notes && <div className="mt-2 ml-10 p-2 text-xs text-stone-600 border border-emerald-200 bg-emerald-50/50 rounded-lg flex gap-2"><NotebookPen size={14} className="shrink-0 text-emerald-500"/>{item.notes}</div>}</div>))}</div>{editItem && <EditNoteModal item={editItem} onClose={()=>setEditItem(null)} onSave={saveNote} />}</div>; }
function EditNoteModal({ item, onClose, onSave }) { const [n, setN] = useState(item.notes || ''); return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-sm p-6"><h3 className="font-bold text-lg mb-4">編輯備註: {item.task}</h3><textarea className="w-full h-32 p-3 bg-stone-50 rounded-xl border mb-4 resize-none outline-none focus:border-emerald-500" placeholder="輸入備註..." value={n} onChange={e=>setN(e.target.value)}/><div className="flex gap-2"><button onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl text-stone-500 font-bold">取消</button><button onClick={()=>onSave(item.id, n)} className="flex-1 py-3 bg-emerald-600 rounded-xl text-white font-bold">儲存</button></div></div></div>; }
function WishListView({ tripId, items }) { const [newItem, setNewItem] = useState(''); const [cat, setCat] = useState('吃'); const categories = [{ id: '吃', icon: <Utensils size={16}/>, color: 'bg-orange-100 text-orange-600' }, { id: '喝', icon: <Coffee size={16}/>, color: 'bg-blue-100 text-blue-600' }, { id: '玩', icon: <Gamepad2 size={16}/>, color: 'bg-green-100 text-green-600' }, { id: '樂', icon: <Smile size={16}/>, color: 'bg-purple-100 text-purple-600' }]; const handleAdd = async (e) => { e.preventDefault(); if(!newItem.trim()) return; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_wishlist'), { tripId, name: newItem.trim(), category: cat, createdAt: serverTimestamp() }); setNewItem(''); }; const del = (id) => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_wishlist', id)); return <div className="space-y-6 max-w-4xl mx-auto"><div className="flex items-end gap-3 mb-4"><h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Heart className="text-emerald-600" size={32}/> 願望清單</h2></div><div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100"><div className="flex gap-2 mb-3 overflow-x-auto pb-1">{categories.map(c => <button key={c.id} onClick={()=>setCat(c.id)} className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-1 transition ${cat===c.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-stone-50 text-stone-500'}`}>{c.icon}{c.id}</button>)}</div><form onSubmit={handleAdd} className="flex gap-2"><input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder={`輸入想${cat}的地點...`} className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" /><button className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={24}/></button></form></div><div className="space-y-3">{items.length===0 ? <div className="text-center text-stone-400 py-10">尚無願望</div> : items.map(item => { const cStyle = categories.find(c=>c.id===item.category)?.color || 'bg-gray-100'; return (<a key={item.id} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}`} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition"><div className="flex items-center justify-between bg-white p-4 rounded-xl border border-stone-100 shadow-sm"><div className="flex items-center gap-3 overflow-hidden"><span className={`px-2 py-1 rounded-lg text-xs font-bold ${cStyle}`}>{item.category}</span><span className="text-lg font-bold text-stone-800 truncate">{item.name}</span></div><div className="flex gap-2"><div className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl"><MapPin size={20}/></div><button onClick={(e)=>{e.preventDefault();del(item.id)}} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button></div></div></a>); })}</div></div>; }
function ItineraryView({ tripId, items }) { const [showAdd, setShowAdd] = useState(false); const timelineItems = items.filter(item => item.type !== 'accommodation' && item.type !== 'flight' && item.type !== 'train' && item.type !== 'bus' && item.type !== 'ship'); return <div className="space-y-6 max-w-4xl mx-auto"><div className="flex justify-between items-end mb-8"><div><h2 className="text-3xl font-bold text-emerald-900 tracking-tight"><Calendar className="text-emerald-600 inline mr-2"/>行程規劃</h2></div><button onClick={() => setShowAdd(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl flex items-center gap-2 shadow-lg font-bold"><Plus size={20} /> 新增行程</button></div>{timelineItems.length === 0 ? <div className="bg-white rounded-[32px] p-12 text-center border-2 border-dashed border-stone-200"><p className="text-stone-500 font-bold">目前沒有行程</p></div> : timelineItems.map(item => <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm mb-4 border border-stone-100 flex justify-between"><div><div className="flex gap-2 items-center mb-1"><span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{item.type === 'sight' ? '景點' : item.type === 'shopping' ? '購物' : item.type === 'food' ? '餐廳' : '禮品'}</span><span className="text-stone-500 text-sm">{item.datetime?.replace('T', ' ')}</span></div><div className="font-bold text-lg">{item.title}</div><div className="text-sm text-stone-400 mt-1 flex items-center gap-1"><MapPin size={12}/> <a href={getGoogleMapsLink(item.location)} target="_blank" rel="noreferrer" className="hover:underline hover:text-emerald-600">{item.location}</a></div></div><button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', item.id))}><Trash2 className="text-stone-300 hover:text-red-500"/></button></div>)}{showAdd && <AddItineraryModal tripId={tripId} onClose={() => setShowAdd(false)} />}</div>; }
function TransportView({ tripId, items }) { const [showAdd, setShowAdd] = useState(false); const transportItems = items.filter(item => ['flight','train','ship','bus'].includes(item.type)); return <div className="space-y-6 max-w-4xl mx-auto"><div className="flex justify-between items-end mb-8"><div><h2 className="text-3xl font-bold text-emerald-900 tracking-tight flex items-center gap-3"><Train className="text-emerald-600" size={32}/> 交通情報</h2></div><button onClick={() => setShowAdd(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl flex items-center gap-2 shadow-lg transition font-bold"><Plus size={20} /> 新增票券</button></div>{transportItems.length === 0 ? <div className="bg-white rounded-[32px] p-12 text-center border-2 border-dashed border-stone-200"><p className="text-stone-500 font-bold">目前沒有交通票券</p></div> : transportItems.map(item => <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm mb-4 border border-stone-100 flex justify-between"><div><div className="flex gap-2 items-center mb-1"><span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{item.type}</span><span className="text-stone-500 text-sm">{item.datetime?.replace('T', ' ')}</span></div><div className="font-bold text-lg">{item.title}</div>{item.originDest && <div className="text-sm text-stone-600 mt-1"><ArrowRightLeft size={12} className="inline mr-1"/>{item.originDest}</div>}{item.seatInfo && <div className="text-sm text-stone-400"><Armchair size={12} className="inline mr-1"/>{item.seatInfo}</div>}</div><button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', item.id))}><Trash2 className="text-stone-300 hover:text-red-500"/></button></div>)}{showAdd && <AddTransportModal tripId={tripId} onClose={() => setShowAdd(false)} />}</div>; }
function AccommodationView({ tripId, items }) { const [showAdd, setShowAdd] = useState(false); const accommodationItems = items.filter(item => item.type === 'accommodation'); return <div className="space-y-6 max-w-4xl mx-auto"><div className="flex justify-between items-end mb-8"><div><h2 className="text-3xl font-bold text-emerald-900 tracking-tight flex items-center gap-3"><BedDouble className="text-emerald-600" size={32}/> 住宿登錄</h2></div><button onClick={() => setShowAdd(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl flex items-center gap-2 shadow-lg transition font-bold"><Plus size={20} /> 新增住宿</button></div>{accommodationItems.length === 0 ? <div className="bg-white rounded-[32px] p-12 text-center border-2 border-dashed border-stone-200"><p className="text-stone-500 font-bold">目前沒有住宿資料</p></div> : accommodationItems.map(item => <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm mb-4 border border-stone-100 flex justify-between"><div><div className="font-bold text-lg">{item.title}</div><div className="text-stone-500"><MapPin size={14} className="inline mr-1"/><a href={getGoogleMapsLink(item.location)} target="_blank" rel="noreferrer" className="hover:underline hover:text-emerald-600">{item.location}</a></div><div className="text-xs text-stone-400 mt-1">入住: {item.checkInTime} / 退房: {item.checkOutTime}</div></div><button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', item.id))}><Trash2 className="text-stone-300 hover:text-red-500"/></button></div>)}{showAdd && <AddAccommodationModal tripId={tripId} onClose={() => setShowAdd(false)} />}</div>; }

// --- MODALS (Updated) ---
function AddTransportModal({ tripId, onClose }) { 
  const [f, setF] = useState({ title: '', datetime: '', type: 'flight', originDest: '', seatInfo: '' }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none transition";
  return (
    <div className="fixed inset-0 bg-emerald-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-xl mb-4 text-emerald-900">新增交通票券</h3>
        <form onSubmit={sub} className="space-y-4">
          <div><label className="text-xs font-bold text-stone-500 ml-1">類型</label>
          <select className={inputClass} value={f.type} onChange={e=>setF({...f, type:e.target.value})}>
            <option value="flight">機票</option><option value="train">火車票</option><option value="ship">船票</option><option value="bus">巴士</option>
          </select></div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">時間</label><input type="datetime-local" className={inputClass} value={f.datetime} onChange={e=>setF({...f, datetime:e.target.value})} required /></div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">票券名稱</label><input className={inputClass} placeholder="例如: 樂桃航空 MM860" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required /></div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">起訖地點</label><input className={inputClass} placeholder="例如: 台北TPE >>> 東京NRT" value={f.originDest} onChange={e=>setF({...f, originDest:e.target.value})} required /></div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">班次/座位資訊</label><input className={inputClass} placeholder="例如: 32A 靠窗" value={f.seatInfo} onChange={e=>setF({...f, seatInfo:e.target.value})} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold">取消</button>
            <button className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200/50">確認新增</button>
          </div>
        </form>
      </div>
    </div>
  ); 
}

function AddAccommodationModal({ tripId, onClose }) { 
  const [f, setF] = useState({ title: '', type: 'accommodation', location: '', checkInTime: '15:00', checkOutTime: '11:00', imageUrl: '' }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none transition";
  return (
    <div className="fixed inset-0 bg-emerald-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-xl mb-4 text-emerald-900">新增住宿</h3>
        <form onSubmit={sub} className="space-y-4">
          <div><label className="text-xs font-bold text-stone-500 ml-1">住宿名稱</label><input className={inputClass} placeholder="例如: APA Hotel" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required /></div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">地址/位置 (連動Google地圖)</label><input className={inputClass} placeholder="輸入地址" value={f.location} onChange={e=>setF({...f, location:e.target.value})} required /></div>
          <div className="flex gap-2">
            <div className="w-1/2"><label className="text-xs font-bold text-stone-500 ml-1">入住時間</label><input type="time" className={inputClass} value={f.checkInTime} onChange={e=>setF({...f, checkInTime:e.target.value})} /></div>
            <div className="w-1/2"><label className="text-xs font-bold text-stone-500 ml-1">退房時間</label><input type="time" className={inputClass} value={f.checkOutTime} onChange={e=>setF({...f, checkOutTime:e.target.value})} /></div>
          </div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">飯店照片URL (選填)</label><input className={inputClass} placeholder="https://..." value={f.imageUrl} onChange={e=>setF({...f, imageUrl:e.target.value})} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold">取消</button>
            <button className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200/50">確認新增</button>
          </div>
        </form>
      </div>
    </div>
  ); 
}

function AddItineraryModal({ tripId, onClose }) { 
  const [f, setF] = useState({ title: '', datetime: '', type: 'sight', location: '', transportMethod: 'subway', imageUrl: '' }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none transition";
  return (
    <div className="fixed inset-0 bg-emerald-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-xl mb-4 text-emerald-900">新增行程規劃</h3>
        <form onSubmit={sub} className="space-y-4">
          <div className="flex gap-2">
             <div className="w-1/2">
                <label className="text-xs font-bold text-stone-500 ml-1">類型</label>
                <select className={inputClass} value={f.type} onChange={e=>setF({...f, type:e.target.value})}>
                  <option value="sight">景點</option><option value="shopping">購物</option><option value="food">餐廳</option><option value="gift">禮品店</option>
                </select>
             </div>
             <div className="w-1/2">
                <label className="text-xs font-bold text-stone-500 ml-1">交通方式</label>
                <select className={inputClass} value={f.transportMethod} onChange={e=>setF({...f, transportMethod:e.target.value})}>
                  <option value="subway">地鐵</option><option value="bus">公車</option><option value="walk">步行</option><option value="car">開車</option>
                </select>
             </div>
          </div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">時間</label><input type="datetime-local" className={inputClass} value={f.datetime} onChange={e=>setF({...f, datetime:e.target.value})} required /></div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">名稱</label><input className={inputClass} placeholder="行程名稱" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required /></div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">地圖 (Google連動)</label><input className={inputClass} placeholder="輸入地點名稱或地址" value={f.location} onChange={e=>setF({...f, location:e.target.value})} required /></div>
          <div><label className="text-xs font-bold text-stone-500 ml-1">圖片URL (選填)</label><input className={inputClass} placeholder="https://..." value={f.imageUrl} onChange={e=>setF({...f, imageUrl:e.target.value})} /></div>
          
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold">取消</button>
            <button className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200/50">確認新增行程</button>
          </div>
        </form>
      </div>
    </div>
  ); 
}