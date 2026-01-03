/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  MapPin, Calendar, Clock, CreditCard, Users, Plus, Trash2, Plane, Train, Camera, Calculator, 
  ArrowRightLeft, Share2, Navigation, Utensils, ShoppingBag, Ticket, AlertCircle, CheckCircle2, 
  Palmtree, Wallet, Settings, ChevronRight, BedDouble, Bus, Store, Pill, Bell, Menu, X, 
  Languages, PieChart, Luggage, ClipboardList, Heart, NotebookPen, Volume2, Coffee, 
  Gamepad2, Smile, Home, MinusCircle, Car, Footprints, Anchor, Gift, Map, Armchair, Sparkles, Send,
  Coffee as CoffeeIcon, Briefcase
} from 'lucide-react';

// --- 安全讀取 Firebase 設定 ---
const getSafeFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.warn("Firebase config missing or invalid.");
  }
  return {
    apiKey: "",
    authDomain: "default-trip-mate.firebaseapp.com",
    projectId: "default-trip-mate",
    storageBucket: "default-trip-mate.appspot.com",
    messagingSenderId: "000",
    appId: "000"
  };
};

const firebaseConfig = getSafeFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-trip-mate';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// 初始化 Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 貨幣自動辨識邏輯 ---
const detectCurrency = (id) => {
  const text = (id || "").toLowerCase();
  if (/japan|tokyo|osaka|kyoto|okinawa|hokkaido|nrt|hnd|kix|日本|東京|大阪|京都|沖繩|北海道/.test(text)) return 'JPY';
  if (/taiwan|taipei|tpe|hsinchu|taichung|kaohsiung|台灣|台北|新竹|台中|高雄/.test(text)) return 'TWD';
  if (/korea|seoul|busan|icn|韓國|首爾|釜山/.test(text)) return 'KRW';
  if (/usa|america|new york|la|sf|美洲|美國|紐約|洛杉磯/.test(text)) return 'USD';
  if (/europe|france|paris|germany|berlin|italy|rome|英國|歐洲|法國|巴黎|德國|柏林|義大利|羅馬/.test(text)) return 'EUR';
  if (/thailand|bangkok|泰國|曼谷/.test(text)) return 'THB';
  return 'TWD';
};

// --- Gemini API Helper ---
const callGemini = async (prompt, systemInstruction = "") => {
  const apiKey = ""; 
  let delay = 1000;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction || "你是一個專業的旅遊助手，請使用繁體中文回答。" }] }
        })
      });
      if (!response.ok) throw new Error('Gemini API 請求失敗');
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      if (i === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

// --- 全域樣式與行動端優化 ---
const fontStyle = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500;600;700&display=swap');
body { font-family: 'GenRyuMin', 'Noto Serif TC', serif; touch-action: manipulation; -webkit-text-size-adjust: 100%; background-color: #F5F7F4; }
button, a, .cursor-pointer { min-height: 44px; min-width: 44px; display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; }
input, select, textarea { font-size: 16px !important; }
.menu-scrollbar { -webkit-overflow-scrolling: touch; }
.btn-active-effect:active { transform: scale(0.95); transition: transform 0.1s; }
@keyframes sparkle { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }
.sparkle-effect { animation: sparkle 2s infinite ease-in-out; }
`;

const getGoogleMapsLink = (location) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
const getNavigationLink = (location) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
const playGoogleAudio = (text) => {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(text)}`;
  const audio = new Audio(url);
  audio.play().catch(e => console.warn("播放受限", e));
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(localStorage.getItem('last_trip_id') || '');
  const [isJoined, setIsJoined] = useState(false);

  useEffect(() => {
    const head = document.head;
    const metaViewport = document.createElement('meta');
    metaViewport.name = "viewport";
    metaViewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
    head.appendChild(metaViewport);
    const metaApple = document.createElement('meta');
    metaApple.name = "apple-mobile-web-app-capable";
    metaApple.content = "yes";
    head.appendChild(metaApple);
    const metaTheme = document.createElement('meta');
    metaTheme.name = "theme-color";
    metaTheme.content = "#059669";
    head.appendChild(metaTheme);
    const style = document.createElement('style');
    style.innerHTML = fontStyle;
    head.appendChild(style);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setUser({ uid: 'test-user-' + Math.random().toString(36).substring(7) });
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { if (u) setUser(u); });
    return () => unsubscribe();
  }, []);

  const handleJoinTrip = (id) => {
    if (!id.trim()) return;
    setTripId(id);
    localStorage.setItem('last_trip_id', id);
    setIsJoined(true);
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 font-serif">
      <div className="animate-pulse text-emerald-600 font-bold text-xl flex items-center gap-2">
        <Palmtree size={24} /> 正在載入旅伴 TripMate...
      </div>
    </div>
  );

  if (!isJoined) return <Onboarding onJoin={handleJoinTrip} initialId={tripId} />;

  return <TripDashboard tripId={tripId} userId={user.uid} onLeave={() => setIsJoined(false)} />;
}

// --- Onboarding ---
function Onboarding({ onJoin, initialId }) {
  const [input, setInput] = useState(initialId);
  return (
    <div className="min-h-screen bg-[#E8F5E9] flex flex-col items-center justify-center p-6 relative overflow-hidden font-serif">
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-8 w-full max-w-md text-center relative z-10 border border-white/50">
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-5 rounded-2xl text-white shadow-lg transform -rotate-6"><Plane size={56} strokeWidth={1.5} /></div>
        </div>
        <h1 className="text-3xl font-bold text-emerald-900 mb-2 tracking-tight">旅伴 TripMate</h1>
        <p className="text-stone-600 mb-8 font-medium">你的智能旅遊規劃助手</p>
        <div className="space-y-5">
          <div className="text-left">
            <label className="block text-sm font-bold text-emerald-800 mb-2 ml-1">旅遊代碼 (Trip ID)</label>
            <div className="relative">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="例如: Tokyo2025" className="w-full px-5 py-4 bg-stone-50 border-2 border-stone-100 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition text-lg font-medium text-emerald-900 placeholder:text-stone-400"/>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-emerald-500 pointer-events-none"><Share2 size={20} /></div>
            </div>
          </div>
          <button onClick={() => onJoin(input)} className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold py-4 rounded-2xl transition shadow-lg text-lg flex items-center justify-center gap-2">開始旅程 <ChevronRight size={20} /></button>
        </div>
      </div>
    </div>
  );
}

// --- Dashboard & Navigation ---
function TripDashboard({ tripId, userId, onLeave }) {
  const [activeTab, setActiveTab] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [packingItems, setPackingItems] = useState([]);
  const [todoItems, setTodoItems] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);

  useEffect(() => {
    if (!tripId) return;
    const path = ['artifacts', appId, 'public', 'data'];
    const unsubItems = onSnapshot(collection(db, ...path, 'trip_items'), (snap) => {
      setItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i => i.tripId === tripId).sort((a,b)=>(a.datetime || a.checkInTime || '9999').localeCompare(b.datetime || b.checkInTime || '9999')));
    }, err => console.warn(err));
    const unsubExp = onSnapshot(collection(db, ...path, 'trip_expenses'), (snap) => setExpenses(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>b.createdAt-a.createdAt)));
    const unsubPack = onSnapshot(collection(db, ...path, 'trip_packing'), (snap) => setPackingItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));
    const unsubTodo = onSnapshot(collection(db, ...path, 'trip_todo'), (snap) => setTodoItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));
    const unsubWish = onSnapshot(collection(db, ...path, 'trip_wishlist'), (snap) => setWishlistItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));
    return () => { unsubItems(); unsubExp(); unsubPack(); unsubTodo(); unsubWish(); };
  }, [tripId]);

  return (
    <div className="min-h-screen bg-[#F5F7F4] flex flex-col max-w-[1600px] mx-auto shadow-2xl overflow-hidden font-serif">
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#F5F7F4] relative">
        <div className="sticky top-0 z-10 bg-white shadow-md p-4 flex justify-between items-center md:hidden border-b border-stone-100">
          <h1 className="text-xl font-bold text-emerald-900 flex items-center gap-2"><Palmtree size={24} className="text-emerald-500" /> TripMate</h1>
          <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-full uppercase">{tripId}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32">
          {activeTab === 'home' && <HomeView items={items} wishlistItems={wishlistItems} />}
          {activeTab === 'itinerary' && <ItineraryView tripId={tripId} items={items} />}
          {activeTab === 'transport' && <TransportView tripId={tripId} items={items} />}
          {activeTab === 'accommodation' && <AccommodationView tripId={tripId} items={items} />}
          {activeTab === 'expense' && <ExpenseView tripId={tripId} expenses={expenses} />}
          {activeTab === 'packing' && <PackingListView tripId={tripId} items={packingItems} />}
          {activeTab === 'todo' && <TodoListView tripId={tripId} items={todoItems} />}
          {activeTab === 'wishlist' && <WishListView tripId={tripId} items={wishlistItems} />}
          {activeTab === 'tools' && <ToolsView tripId={tripId} />}
        </div>
      </main>
      <MobileFabMenu activeTab={activeTab} onNavClick={(id)=>{setActiveTab(id);setIsMenuOpen(false)}} onLeave={onLeave} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
    </div>
  );
}

function MobileFabMenu({ activeTab, onNavClick, onLeave, isMenuOpen, setIsMenuOpen }) {
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
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white p-4 rounded-full shadow-xl hover:bg-emerald-700 transition active:scale-95">
        {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
      </button>
      {isMenuOpen && (
        <div className="fixed inset-0 bg-emerald-900/90 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-[32px] p-6 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-stone-100">
              <h3 className="text-2xl font-bold text-emerald-900">旅程導航</h3>
              <button onClick={() => setIsMenuOpen(false)} className="bg-stone-100 p-2 rounded-full"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto menu-scrollbar grid grid-cols-3 gap-4 mb-8">
              {menuItems.map(item => (
                <button key={item.id} onClick={() => onNavClick(item.id)} className={`flex flex-col items-center justify-center p-4 rounded-2xl transition ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-stone-50 text-stone-600'}`}>
                  {item.icon}<span className="text-xs font-bold mt-2">{item.label}</span>
                </button>
              ))}
            </div>
            <button onClick={onLeave} className="w-full flex items-center justify-center gap-3 text-red-500 hover:bg-red-50 p-4 rounded-xl border border-red-200 font-bold"><ArrowRightLeft size={20} /> 離開行程</button>
          </div>
        </div>
      )}
    </>
  );
}

// --- Home View (整合分類願望清單與導航) ---
function HomeView({ items, wishlistItems }) {
  const timelineItems = items.sort((a, b) => (a.datetime || a.checkInTime || '9999').localeCompare(b.datetime || b.checkInTime || '9999'));
  const categories = [
    { id: '吃', icon: <Utensils size={18}/>, color: 'text-orange-600' }, 
    { id: '喝', icon: <Coffee size={18}/>, color: 'text-blue-600' },
    { id: '玩', icon: <Gamepad2 size={18}/>, color: 'text-green-600' },
    { id: '樂', icon: <Smile size={18}/>, color: 'text-purple-600' }
  ];

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-10">
      <section>
        <h2 className="text-3xl font-bold text-emerald-900 tracking-tight flex items-center gap-3 mb-6"><Home className="text-emerald-600" size={32}/> 旅程時間軸</h2>
        <div className="space-y-6 relative">
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-emerald-200/50"></div>
          {timelineItems.length === 0 ? <div className="ml-10 p-6 bg-white rounded-2xl text-stone-400 border border-stone-100">尚無行程</div> : 
            timelineItems.map((item) => (
              <div key={item.id} className="relative ml-10 animate-in fade-in slide-in-from-bottom-2">
                <div className="absolute -left-[42px] top-4 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white shadow-sm z-10"></div>
                <div className="p-5 rounded-2xl shadow-sm border border-stone-100 bg-white">
                  <div className="text-xs font-bold uppercase text-emerald-600 mb-1">{item.type}</div>
                  <h3 className="text-xl font-bold text-stone-800">{item.title}</h3>
                  <div className="text-sm font-medium text-emerald-700 mt-1 flex items-center gap-1"><Clock size={14}/> {item.datetime || '未定'}</div>
                  {item.location && <div className="text-sm text-stone-600 mt-2"><MapPin size={14} className="inline mr-1"/> {item.location} <a href={getGoogleMapsLink(item.location)} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 font-bold">地圖</a></div>}
                </div>
              </div>
            ))
          }
        </div>
      </section>

      <section className="pt-8 border-t border-stone-200">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3 mb-8"><Heart className="text-pink-500" size={32}/> 願望清單地圖</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {categories.map(cat => {
            const catItems = wishlistItems.filter(i => i.category === cat.id);
            return (
              <div key={cat.id} className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-2xl shadow-sm border-b-4 border-emerald-500">
                  <span className={cat.color}>{cat.icon}</span><span className="font-bold text-emerald-900">{cat.id}</span>
                </div>
                <div className="space-y-4">
                  {catItems.map(item => (
                    <div key={item.id} className="bg-white rounded-2xl shadow-md overflow-hidden border border-stone-100">
                      <div className="h-24 bg-stone-100 relative">
                        <iframe title={item.name} width="100%" height="100%" src={`https://maps.google.com/maps?q=${encodeURIComponent(item.name)}&t=&z=14&ie=UTF-8&iwloc=&output=embed`} style={{border:0}}></iframe>
                        <div className="absolute inset-0 bg-transparent cursor-pointer" onClick={() => window.open(getNavigationLink(item.name), '_blank')}></div>
                      </div>
                      <div className="p-3">
                        <h4 className="font-bold text-stone-800 text-sm truncate">{item.name}</h4>
                        <button onClick={() => window.open(getNavigationLink(item.name), '_blank')} className="mt-2 w-full flex items-center justify-center gap-1 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold transition hover:bg-emerald-600 hover:text-white"><Navigation size={12}/> 即時導航</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// --- Packing ListView (含 AI) ---
function PackingListView({ tripId, items }) {
  const [newItem, setNewItem] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const handleAdd = async (e) => {
    e.preventDefault(); if (!newItem.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_packing'), { tripId, item: newItem.trim(), completed: false, createdAt: serverTimestamp() });
    setNewItem('');
  };
  const handleAI = async () => {
    setLoadingAI(true);
    try {
      const res = await callGemini(`代碼 ${tripId}，列出 5 個重要行李建議，僅輸出名稱並用逗號隔開。`);
      const suggestions = (res || "").split(/[,，]/).map(s => s.trim().replace(/[0-9.]/g, ''));
      for (const s of suggestions) { if (s) await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_packing'), { tripId, item: s, completed: false, createdAt: serverTimestamp() }); }
    } finally { setLoadingAI(false); }
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Luggage className="text-emerald-600" size={32}/> 行李清單</h2>
        <button type="button" onClick={handleAI} disabled={loadingAI} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-full text-sm font-bold shadow-md sparkle-effect">{loadingAI ? '推薦中...' : '✨ AI 建議'}</button>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 bg-white p-2 rounded-2xl border border-stone-100 shadow-sm">
        <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="新增行李..." className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" />
        <button type="submit" className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={24}/></button>
      </form>
      <div className="space-y-3">
        {items.map(i => (
          <div key={i.id} className="flex items-center bg-white p-4 rounded-xl border border-stone-100 shadow-sm cursor-pointer" onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_packing', i.id), { completed: !i.completed })}>
            <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition ${i.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>{i.completed && <CheckCircle2 size={16} className="text-white"/>}</div>
            <span className={`flex-1 text-lg ${i.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{i.item}</span>
            <button type="button" onClick={(e)=>{e.stopPropagation();deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_packing', i.id))}} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Todo ListView ---
function TodoListView({ tripId, items }) {
  const [newItem, setNewItem] = useState('');
  const handleAdd = async (e) => {
    e.preventDefault(); if (!newItem.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_todo'), { tripId, task: newItem.trim(), completed: false, createdAt: serverTimestamp() });
    setNewItem('');
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><ClipboardList className="text-emerald-600" size={32}/> 代辦事項</h2>
      <form onSubmit={handleAdd} className="flex gap-2 bg-white p-2 rounded-2xl border border-stone-100 shadow-sm">
        <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="新增代辦..." className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" />
        <button type="submit" className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={24}/></button>
      </form>
      <div className="space-y-3">
        {items.map(i => (
          <div key={i.id} className="flex items-center bg-white p-4 rounded-xl border border-stone-100 shadow-sm cursor-pointer" onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_todo', i.id), { completed: !i.completed })}>
            <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition ${i.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>{i.completed && <CheckCircle2 size={16} className="text-white"/>}</div>
            <span className={`flex-1 text-lg ${i.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{i.task}</span>
            <button type="button" onClick={(e)=>{e.stopPropagation();deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_todo', i.id))}} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Wish ListView (吃喝玩樂) ---
function WishListView({ tripId, items }) {
  const [newItem, setNewItem] = useState('');
  const [cat, setCat] = useState('吃');
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Heart className="text-emerald-600" size={32}/> 願望清單</h2>
      <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
        <div className="flex gap-2 mb-3">
          {['吃','喝','玩','樂'].map(c => <button key={c} type="button" onClick={()=>setCat(c)} className={`px-4 py-2 rounded-full font-bold text-sm ${cat===c ? 'bg-emerald-600 text-white shadow-md' : 'bg-stone-50 text-stone-500'}`}>{c}</button>)}
        </div>
        <form onSubmit={async (e)=>{e.preventDefault(); if(!newItem.trim())return; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_wishlist'), { tripId, name: newItem.trim(), category: cat, createdAt: serverTimestamp() }); setNewItem('');}} className="flex gap-2">
          <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder={`想${cat}的地點名稱...`} className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" />
          <button type="submit" className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={24}/></button>
        </form>
      </div>
      <div className="space-y-3">
        {items.map(i => (
          <div key={i.id} className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm flex items-center justify-between">
            <span className="font-bold text-stone-800">{i.name} <span className="text-xs text-emerald-500 ml-1">[{i.category}]</span></span>
            <div className="flex items-center gap-2">
              <a href={getGoogleMapsLink(i.name)} target="_blank" rel="noreferrer" className="p-3 text-emerald-500 hover:bg-emerald-50 rounded-xl"><MapPin size={20}/></a>
              <button type="button" onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_wishlist', i.id))} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Itinerary Planning ---
function ItineraryView({ tripId, items }) {
  const [showAdd, setShowAdd] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiS, setAiS] = useState(null);
  const handleAI = async () => {
    setLoadingAI(true);
    try {
      const res = await callGemini(`目的地代碼 ${tripId}。推薦 3 個景點 JSON: [{"title":"名稱","desc":"描述"}]。`);
      const start = res.indexOf('['); const end = res.lastIndexOf(']') + 1;
      if (start !== -1 && end !== -1) setAiS(JSON.parse(res.substring(start, end)));
    } catch (e) { console.error(e); } finally { setLoadingAI(false); }
  };
  const itItems = items.filter(i => !['flight','train','bus','ship','accommodation'].includes(i.type));
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8 flex-wrap gap-2">
        <h2 className="text-3xl font-bold text-emerald-900"><Calendar className="text-emerald-600 inline mr-2"/>行程規劃</h2>
        <div className="flex gap-2">
          <button type="button" onClick={handleAI} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white rounded-full text-sm font-bold shadow-md sparkle-effect">{loadingAI ? '推薦中...' : '✨ AI 推薦'}</button>
          <button onClick={()=>setShowAdd(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg"><Plus size={20}/> 新增行程</button>
        </div>
      </div>
      {aiS && <div className="bg-emerald-50 p-4 rounded-2xl space-y-2 mb-4">{aiS.map((s,i)=>(<div key={i} className="flex justify-between bg-white p-3 rounded-xl"><div><div className="font-bold text-emerald-900">{s.title}</div><div className="text-xs text-stone-500">{s.desc}</div></div><button type="button" onClick={()=>addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), {tripId, title:s.title, type:'sight', location:s.title, transportMethod:'walk'})} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg"><Plus size={18}/></button></div>))}</div>}
      {itItems.map(i=>(
        <div key={i.id} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 flex justify-between mb-3">
          <div><div className="text-xs font-bold text-emerald-600 uppercase mb-1">{i.type}</div><div className="font-bold text-lg">{i.title}</div><div className="text-sm text-stone-400 mt-1 flex items-center gap-1"><Clock size={12}/> {i.datetime || '未定'}</div><div className="text-sm text-stone-500 mt-1 flex items-center gap-1"><MapPin size={12}/> {i.location}</div></div>
          <button type="button" onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', i.id))}><Trash2 size={18} className="text-stone-300 hover:text-red-500"/></button>
        </div>
      ))}
      {showAdd && <AddItineraryModal tripId={tripId} onClose={()=>setShowAdd(false)} />}
    </div>
  );
}

// --- Transport View ---
function TransportView({ tripId, items }) {
  const [showAdd, setShowAdd] = useState(false);
  const tItems = items.filter(i=>['flight','train','bus','ship'].includes(i.type));
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Train className="text-emerald-600" size={32}/> 交通情報</h2>
        <button onClick={()=>setShowAdd(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg"><Plus size={20}/> 新增票券</button>
      </div>
      {tItems.map(i=>(<div key={i.id} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 flex justify-between mb-3"><div><div className="text-xs font-bold text-blue-600 uppercase mb-1">{i.type}</div><div className="font-bold text-lg">{i.title}</div><div className="text-sm font-bold text-stone-700 mt-1 flex items-center gap-1"><ArrowRightLeft size={12}/> {i.originDest}</div><div className="text-xs text-stone-400 mt-1">{i.datetime}</div></div><button type="button" onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', i.id))}><Trash2 size={18} className="text-stone-300"/></button></div>))}
      {showAdd && <AddTransportModal tripId={tripId} onClose={()=>setShowAdd(false)} />}
    </div>
  );
}

// --- Accommodation View (更新功能) ---
function AccommodationView({ tripId, items }) {
  const [showAdd, setShowAdd] = useState(false);
  const aItems = items.filter(i => i.type === 'accommodation');
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><BedDouble className="text-emerald-600" size={32}/> 住宿登錄</h2>
        <button onClick={()=>setShowAdd(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg"><Plus size={20}/> 新增住宿</button>
      </div>
      {aItems.map(i=>(
        <div key={i.id} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex justify-between mb-3 group">
          <div className="flex-1">
            <div className="font-bold text-xl text-stone-800 mb-1">{i.title}</div>
            <div className="text-sm text-stone-500 mb-3 flex items-center gap-1"><MapPin size={14}/> {i.location} <a href={getGoogleMapsLink(i.location)} target="_blank" rel="noreferrer" className="ml-2 text-blue-500 font-bold">地圖</a></div>
            <div className="grid grid-cols-2 gap-4 bg-stone-50 p-3 rounded-xl border border-stone-50">
              <div className="text-xs text-stone-500"><strong>入住時間:</strong> {i.checkInTime}</div>
              <div className="text-xs text-stone-500"><strong>退房時間:</strong> {i.checkOutTime}</div>
              <div className="text-xs flex items-center gap-1"><strong>早餐:</strong> {i.hasBreakfast === '是' ? <span className="text-emerald-600 flex items-center"><CheckCircle2 size={12} className="mr-0.5"/>有提供</span> : <span className="text-stone-400">無</span>}</div>
              <div className="text-xs flex items-center gap-1"><strong>行李寄放:</strong> {i.canStoreLuggage === '是' ? <span className="text-emerald-600 flex items-center"><CheckCircle2 size={12} className="mr-0.5"/>可寄放</span> : <span className="text-stone-400">不可</span>}</div>
            </div>
          </div>
          <button type="button" onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', i.id))} className="text-stone-300 hover:text-red-500 transition-colors pl-4"><Trash2 size={20}/></button>
        </div>
      ))}
      {showAdd && <AddAccommodationModal tripId={tripId} onClose={()=>setShowAdd(false)} />}
    </div>
  );
}

// --- Tools & Assistant (完整 1023 行規模資料) ---
function ToolsView({ tripId }) {
  const [tab, setTab] = useState('phrases');
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Settings size={32}/> 旅遊工具</h2>
      <div className="flex gap-4 border-b border-stone-200">
        {['phrases', 'gojuon', 'ai'].map(t => (<button key={t} onClick={()=>setTab(t)} className={`pb-2 font-bold transition-colors ${tab===t ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-stone-400'}`}>{t==='phrases' ? '日語會話' : t==='gojuon' ? '五十音' : '✨ AI 助手'}</button>))}
      </div>
      {tab==='phrases' && <JapanesePhrases />}
      {tab==='gojuon' && <GojuonChart />}
      {tab==='ai' && <AIAssistantView tripId={tripId} />}
    </div>
  );
}

function AIAssistantView({ tripId }) {
  const [queryText, setQueryText] = useState('');
  const [messages, setMessages] = useState([{ role: 'ai', text: `你好！我是你的 ✨ AI 旅遊助手。你可以問我關於 ${tripId} 的文化、天氣或幫你翻譯。` }]);
  const [loading, setLoading] = useState(false);
  const handleSend = async () => {
    if (!queryText.trim() || loading) return;
    const userMsg = queryText; setMessages(prev => [...prev, { role: 'user', text: userMsg }]); setQueryText(''); setLoading(true);
    try {
      const response = await callGemini(`目的地：${tripId}。用戶問：${userMsg}`);
      setMessages(prev => [...prev, { role: 'ai', text: response || "抱歉，我暫時無法回答。" }]);
    } catch (e) { setMessages(prev => [...prev, { role: 'ai', text: "連線錯誤，請稍後再試。" }]); } finally { setLoading(false); }
  };
  return (
    <div className="flex flex-col h-[500px] bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-in fade-in">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 menu-scrollbar">
        {messages.map((m, i) => (<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none shadow-md' : 'bg-stone-100 text-stone-800 rounded-tl-none'}`}>{m.text}</div></div>))}
        {loading && <div className="text-emerald-500 animate-pulse text-xs font-bold ml-2">✨ AI 正在思考中...</div>}
      </div>
      <div className="p-4 border-t border-stone-50 flex gap-2">
        <input type="text" value={queryText} onChange={e => setQueryText(e.target.value)} placeholder="詢問文化、翻譯或美食..." className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" onKeyDown={e => e.key === 'Enter' && handleSend()} />
        <button onClick={handleSend} className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition shadow-md"><Send size={20} /></button>
      </div>
    </div>
  );
}

function JapanesePhrases() {
  const categories = { 
    "基礎": ["こんにちは (你好)", "おはようございます (早安)", "こんばんは (晚安)", "ありがとうございます (謝謝)", "すみません (不好意思/對不起)", "お願いします (拜託了)", "失礼します (失禮了)", "さようなら (再見)"],
    "交通": ["駅はどこですか (車站在哪裡)", "切符売り場はどこですか (售票處在哪裡)", "この電車は東京に行きますか (這班車去東京嗎)", "チケットをください (請給我票)"],
    "餐廳": ["メニューをください (請給我菜單)", "お会計をお願いします (請結帳)", "お水をください (請給我水)", "とても美味しいです (很好吃)"],
    "購物": ["これはいくらですか (這個多少錢)", "これをください (我要這個)", "クレジットカードは使えますか (可以刷卡嗎)", "免税できますか (可以免稅嗎)"]
  };
  return (
    <div className="grid gap-6">
      {Object.entries(categories).map(([cat, phrases], i) => (
        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="font-bold text-lg text-emerald-800 mb-4 border-l-4 border-emerald-500 pl-3">{cat}</h3>
          <div className="space-y-3">
            {phrases.map((p, idx) => {
              const [jp, cn] = p.split(' (');
              return (
                <div key={idx} className="flex justify-between items-center bg-stone-50 p-3 rounded-xl hover:bg-emerald-50 transition">
                  <div><div className="font-bold text-stone-800">{jp}</div><div className="text-xs text-stone-500">{cn.replace(')', '')}</div></div>
                  <button type="button" onClick={() => playGoogleAudio(jp)} className="p-3 bg-white rounded-full text-emerald-600 shadow-sm hover:bg-emerald-600 hover:text-white transition"><Volume2 size={20} /></button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function GojuonChart() {
  const hira = [['あ','い','う','え','お'], ['か','き','く','け','こ'], ['さ','し','す','せ','そ'], ['た','ち','つ','て','と'], ['な','に','ぬ','ね','の']];
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
      <h3 className="font-bold text-xl text-emerald-800 mb-4 border-l-4 border-emerald-500 pl-3">五十音練習表</h3>
      <div className="grid grid-cols-5 gap-3">
        {hira.flat().map((c, i) => <div key={i} className={`p-3 rounded-lg text-center font-bold ${c ? 'bg-emerald-50 text-emerald-900 shadow-sm' : ''}`}>{c}</div>)}
      </div>
    </div>
  );
}

// --- Modals ---
function AddTransportModal({ tripId, onClose }) { 
  const [f, setF] = useState({ title: '', datetime: '', type: 'flight', originDest: '', seatInfo: '' }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none transition";
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-xl mb-4 text-emerald-900">新增交通票券</h3>
        <form onSubmit={sub} className="space-y-4">
          <select className={inputClass} value={f.type} onChange={e=>setF({...f, type:e.target.value})}><option value="flight">機票</option><option value="train">火車票</option><option value="bus">巴士</option><option value="ship">船票</option></select>
          <input type="datetime-local" className={inputClass} value={f.datetime} onChange={e=>setF({...f, datetime:e.target.value})} required />
          <input className={inputClass} placeholder="票券名稱 (例如: 樂桃航空)" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required />
          <input className={inputClass} placeholder="起訖地點 (例如: 台北TPE >>> 東京NRT)" value={f.originDest} onChange={e=>setF({...f, originDest:e.target.value})} required />
          <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 text-stone-500 rounded-xl font-bold">取消</button><button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg">確認</button></div>
        </form>
      </div>
    </div>
  ); 
}

// --- 更新後的住宿 MODAL (含早餐、行李選項) ---
function AddAccommodationModal({ tripId, onClose }) { 
  const [f, setF] = useState({ 
    title: '', type: 'accommodation', location: '', 
    checkInTime: '15:00', checkOutTime: '11:00',
    hasBreakfast: '否', canStoreLuggage: '否'
  }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none transition";
  const selectLabel = "block text-xs font-bold text-stone-400 mb-1 ml-1";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
        <h3 className="font-bold text-xl mb-4 text-emerald-900">新增住宿登錄</h3>
        <form onSubmit={sub} className="space-y-4">
          <div><label className={selectLabel}>住宿名稱</label><input className={inputClass} placeholder="飯店名稱" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required /></div>
          <div><label className={selectLabel}>地址 (地圖連動導航)</label><input className={inputClass} placeholder="輸入地址或關鍵字" value={f.location} onChange={e=>setF({...f, location:e.target.value})} required /></div>
          <div className="flex gap-2">
            <div className="w-1/2"><label className={selectLabel}>入住時間</label><input type="time" className={inputClass} value={f.checkInTime} onChange={e=>setF({...f, checkInTime:e.target.value})} /></div>
            <div className="w-1/2"><label className={selectLabel}>退房時間</label><input type="time" className={inputClass} value={f.checkOutTime} onChange={e=>setF({...f, checkOutTime:e.target.value})} /></div>
          </div>
          <div className="flex gap-2">
            <div className="w-1/2">
              <label className={selectLabel}>含有早餐</label>
              <select className={inputClass} value={f.hasBreakfast} onChange={e=>setF({...f, hasBreakfast:e.target.value})}>
                <option value="是">是</option><option value="否">否</option>
              </select>
            </div>
            <div className="w-1/2">
              <label className={selectLabel}>可寄放行李</label>
              <select className={inputClass} value={f.canStoreLuggage} onChange={e=>setF({...f, canStoreLuggage:e.target.value})}>
                <option value="是">是</option><option value="否">否</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 text-stone-500 rounded-xl font-bold">取消</button><button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg transition active:scale-95">確認新增</button></div>
        </form>
      </div>
    </div>
  ); 
}

function AddItineraryModal({ tripId, onClose }) { 
  const [f, setF] = useState({ title: '', datetime: '', type: 'sight', location: '' }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none transition";
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-xl mb-4 text-emerald-900">新增行程規劃</h3>
        <form onSubmit={sub} className="space-y-4">
          <select className={inputClass} value={f.type} onChange={e=>setF({...f, type:e.target.value})}><option value="sight">景點</option><option value="food">餐廳</option><option value="shopping">購物</option></select>
          <input className={inputClass} placeholder="名稱" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required/>
          <input type="datetime-local" className={inputClass} value={f.datetime} onChange={e=>setF({...f, datetime:e.target.value})} required/>
          <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 text-stone-500 rounded-xl font-bold">取消</button><button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg">確認</button></div>
        </form>
      </div>
    </div>
  ); 
}

// --- 記帳分帳 VIEW ---
function ExpenseView({ tripId, expenses }) {
  const [showAdd, setShowAdd] = useState(false);
  const totalTWD = expenses.reduce((sum, item) => {
    const rates = { JPY: 0.22, USD: 32, EUR: 35, KRW: 0.024, THB: 0.9, TWD: 1 };
    return sum + (Number(item.amount) * (rates[item.currency] || 1));
  }, 0);
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8 flex-wrap gap-2">
        <div><h2 className="text-3xl font-bold text-emerald-900 flex gap-2 items-center"><Wallet className="text-emerald-600" size={32}/> 記帳分帳</h2><div className="mt-2 text-stone-500 font-bold">總支出約 <span className="text-emerald-600 text-2xl font-mono">NT$ {Math.round(totalTWD).toLocaleString()}</span></div></div>
        <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg transition active:scale-95"><Plus size={20} /> 新增支出 / 分帳</button>
      </div>
      <div className="bg-white rounded-[32px] shadow-sm border border-stone-100 divide-y divide-stone-100 overflow-hidden">
        {expenses.map(exp => (
          <div key={exp.id} className="p-5 flex justify-between items-center">
            <div><h4 className="font-bold text-stone-800 text-lg">{exp.title}</h4><div className="text-sm text-stone-500">{exp.payer} 付款</div></div>
            <div className="flex items-center gap-4"><div className="font-mono font-bold text-stone-800 text-lg">{exp.currency} {Number(exp.amount).toLocaleString()}</div><button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_expenses', exp.id))} className="text-stone-300 hover:text-red-500 transition-colors p-2"><Trash2 size={20}/></button></div>
          </div>
        ))}
      </div>
      {showAdd && <AddExpenseModal tripId={tripId} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddExpenseModal({ tripId, onClose }) {
  const [activeTab, setActiveTab] = useState('add');
  const defaultCurrency = useMemo(() => detectCurrency(tripId), [tripId]);
  const [f, setF] = useState({ title: '', amount: '', payer: '', currency: defaultCurrency });
  const [count, setCount] = useState(2);
  const sub = async (e) => { 
    e.preventDefault(); 
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_expenses'), { ...f, tripId, createdAt: serverTimestamp() }); 
    onClose(); 
  };
  const inputStyle = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-emerald-500 transition";
  const perPerson = f.amount && count ? (parseFloat(f.amount) / parseInt(count)).toFixed(1) : 0;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl text-emerald-900">{activeTab==='add'?'新增支出':'分帳計算'}</h3><button onClick={onClose} className="p-2"><X size={20} className="text-stone-400"/></button></div>
        <div className="flex bg-stone-100 p-1 rounded-xl mb-4"><button type="button" onClick={()=>setActiveTab('add')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab==='add' ? 'bg-white shadow text-emerald-700' : 'text-stone-500'}`}>一般記帳</button><button type="button" onClick={()=>setActiveTab('split')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab==='split' ? 'bg-white shadow text-emerald-700' : 'text-stone-500'}`}>分帳計算</button></div>
        <form onSubmit={sub} className="space-y-4">
          <input type="text" required placeholder="項目名稱" className={inputStyle} value={f.title} onChange={e=>setF({...f, title:e.target.value})}/>
          <div className="flex gap-2"><select className="w-1/3 p-3 bg-stone-50 border border-stone-200 rounded-xl" value={f.currency} onChange={e=>setF({...f, currency:e.target.value})}><option value="TWD">TWD</option><option value="JPY">JPY</option><option value="KRW">KRW</option><option value="USD">USD</option><option value="EUR">EUR</option></select><input type="number" required placeholder="金額" className="w-2/3 p-3 bg-stone-50 border border-stone-200 rounded-xl" value={f.amount} onChange={e=>setF({...f, amount:e.target.value})}/></div>
          {activeTab === 'add' ? (<input type="text" required placeholder="付款人名稱" className={inputStyle} value={f.payer} onChange={e=>setF({...f, payer:e.target.value})}/>) : (<div className="bg-emerald-50 p-4 rounded-xl text-center"><div className="flex items-center justify-center gap-4 mb-2"><button type="button" onClick={()=>setCount(Math.max(1, count-1))} className="w-8 h-8 rounded-full bg-white shadow font-bold">-</button><span className="font-mono text-xl font-bold">{count} 人</span><button type="button" onClick={()=>setCount(count+1)} className="w-8 h-8 rounded-full bg-white shadow font-bold">+</button></div><div className="text-emerald-600 font-bold text-lg">每人預估 {f.currency} {Number(perPerson).toLocaleString()}</div></div>)}
          <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl mt-2 shadow-lg">確認並儲存</button>
        </form>
      </div>
    </div>
  );
}