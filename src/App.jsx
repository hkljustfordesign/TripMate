/* global __firebase_config, __app_id, __initial_auth_token */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  MapPin, Calendar, Clock, CreditCard, Users, Plus, Trash2, Plane, Train, Camera, Calculator, 
  ArrowRightLeft, Share2, Navigation, Utensils, ShoppingBag, Ticket, AlertCircle, CheckCircle2, 
  Palmtree, Wallet, Settings, ChevronRight, BedDouble, Bus, Store, Pill, Bell, Menu, X, 
  Languages, PieChart, Luggage, ClipboardList, Heart, NotebookPen, Volume2, Coffee, 
  Briefcase, 
  Gamepad2, Smile, Home, MinusCircle, Car, Footprints, Anchor, Gift, Map, Armchair, Sparkles, Send,
  UserPlus, UserMinus, Wifi, MonitorSmartphone
} from 'lucide-react';

// --- 安全讀取 Firebase 設定 ---
const getSafeFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config && __firebase_config !== "") {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.warn("Firebase 配置解析失敗，進入預覽模式。");
  }
  return {
    apiKey: "GUEST_MODE",
    authDomain: "default-trip-mate.firebaseapp.com",
    projectId: "default-project",
    storageBucket: "default-project.appspot.com",
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
  // 【重要】請在此處填入您的 Google Gemini API Key
  // 例如：const apiKey = "AIzaSyDHDWII7UZyTtsTc2LDDXuCn3H-aM_buHY";
  const apiKey = ""; 
  
  if (!apiKey) {
    console.warn("未偵測到 API Key，請在程式碼中設定 apiKey 以啟用 AI 功能。");
    return "系統提示：目前尚未設定 API Key，請檢查程式碼設定以啟用 AI 助手功能。";
  }

  let delay = 1000;
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction || "你是一個專業的旅遊助手，請使用繁體中文回答。" }] }
        })
      });
      if (!response.ok) throw new Error(`API 請求失敗: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      if (i === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

const fontStyle = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500;600;700&display=swap');
body { font-family: 'GenRyuMin', 'Noto Serif TC', serif; touch-action: manipulation; -webkit-text-size-adjust: 100%; background-color: #F5F7F4; }
button, a, .cursor-pointer { min-height: 44px; min-width: 44px; display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent; }
input, select, textarea { font-size: 16px !important; }
.menu-scrollbar { -webkit-overflow-scrolling: touch; }
.btn-active-effect:active { transform: scale(0.95); transition: transform 0.1s; }
.menu-scrollbar::-webkit-scrollbar { width: 6px; }
.menu-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
.menu-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
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
        setUser({ uid: 'user-' + Math.random().toString(36).substring(7) });
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

// --- 入口頁面 (強調跨裝置連動) ---
function Onboarding({ onJoin, initialId }) {
  const [input, setInput] = useState(initialId);
  return (
    <div className="min-h-screen bg-[#E8F5E9] flex flex-col items-center justify-center p-6 relative overflow-hidden font-serif">
      <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-8 w-full max-md text-center relative z-10 border border-white/50">
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-5 rounded-2xl text-white shadow-lg transform -rotate-6">
            <Plane size={56} strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-emerald-900 mb-2 tracking-tight">旅伴 TripMate</h1>
        <p className="text-stone-600 mb-8 font-medium">即時連動、多人協作的旅遊助手</p>
        
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-6 text-left">
          <h3 className="font-bold text-emerald-800 flex items-center gap-2 text-sm mb-1">
            <MonitorSmartphone size={16}/> 如何跨裝置連動？
          </h3>
          <p className="text-xs text-emerald-700 leading-relaxed">
            只要在不同手機或電腦輸入<span className="font-bold underline">完全相同</span>的「旅遊代碼」，
            所有行程、記帳與清單都會即時同步顯示！
          </p>
        </div>

        <div className="space-y-5">
          <div className="text-left">
            <label className="block text-sm font-bold text-emerald-800 mb-2 ml-1">設定旅遊代碼 (Trip ID)</label>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="例如: Tokyo2024" className="w-full px-5 py-4 bg-stone-50 border-2 border-stone-100 rounded-2xl focus:border-emerald-500 outline-none text-lg font-medium text-emerald-900"/>
          </div>
          <button onClick={() => onJoin(input)} className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold py-4 rounded-2xl transition shadow-lg text-lg flex items-center justify-center gap-2 btn-active-effect">開始旅程 <ChevronRight size={20} /></button>
        </div>
      </div>
    </div>
  );
}

// --- 主要儀表板 ---
function TripDashboard({ tripId, userId, onLeave }) {
  const [activeTab, setActiveTab] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [packingItems, setPackingItems] = useState([]);
  const [todoItems, setTodoItems] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);

  // 資料同步核心：只要 tripId 相同，不同裝置會監聽同一份 Firestore 資料
  useEffect(() => {
    if (!tripId || !userId) return;
    const path = ['artifacts', appId, 'public', 'data'];
    const unsubItems = onSnapshot(collection(db, ...path, 'trip_items'), (snap) => {
      setItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i => i.tripId === tripId).sort((a,b)=>(a.datetime || a.checkInTime || '9999').localeCompare(b.datetime || b.checkInTime || '9999')));
    }, err => console.error(err));
    const unsubExp = onSnapshot(collection(db, ...path, 'trip_expenses'), (snap) => setExpenses(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>b.createdAt-a.createdAt)));
    const unsubPack = onSnapshot(collection(db, ...path, 'trip_packing'), (snap) => setPackingItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));
    const unsubTodo = onSnapshot(collection(db, ...path, 'trip_todo'), (snap) => setTodoItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));
    const unsubWish = onSnapshot(collection(db, ...path, 'trip_wishlist'), (snap) => setWishlistItems(snap.docs.map(d => ({id:d.id, ...d.data()})).filter(i=>i.tripId===tripId).sort((a,b)=>a.createdAt-b.createdAt)));
    return () => { unsubItems(); unsubExp(); unsubPack(); unsubTodo(); unsubWish(); };
  }, [tripId, userId]);

  return (
    <div className="min-h-screen bg-[#F5F7F4] flex flex-col max-w-[1600px] mx-auto shadow-2xl overflow-hidden font-serif">
      <main className="flex-1 flex flex-col overflow-y-auto bg-[#F5F7F4] relative">
        <div className="sticky top-0 z-30 bg-white shadow-md p-4 flex justify-between items-center md:hidden border-b border-stone-100">
          <h1 className="text-xl font-bold text-emerald-900 flex items-center gap-2"><Palmtree size={24} className="text-emerald-500" /> TripMate</h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 font-bold animate-pulse"><Wifi size={10}/> 連線中</span>
            <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-full uppercase">{tripId}</span>
          </div>
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
            <div className="overflow-y-auto menu-scrollbar grid grid-cols-3 gap-4 mb-8">
              {menuItems.map(item => (
                <button key={item.id} onClick={() => onNavClick(item.id)} className={`flex flex-col items-center justify-center p-4 rounded-2xl transition ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-lg' : 'bg-stone-50 text-stone-600'}`}>
                  {item.icon}<span className="text-xs font-bold mt-2">{item.label}</span>
                </button>
              ))}
            </div>
            <button onClick={onLeave} className="w-full flex items-center justify-center gap-3 text-red-500 hover:bg-red-50 p-4 rounded-xl border border-red-200 font-bold"><ArrowRightLeft size={20} /> 離開行程 / 切換代碼</button>
          </div>
        </div>
      )}
    </>
  );
}

// --- 視圖組件: 首頁 ---
function HomeView({ items, wishlistItems }) {
  const timelineItems = items.sort((a, b) => (a.datetime || a.checkInTime || '9999').localeCompare(b.datetime || b.checkInTime || '9999'));
  const wishlistCategories = [
    { id: '吃', icon: <Utensils size={18}/>, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { id: '喝', icon: <Coffee size={18}/>, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: '玩', icon: <Gamepad2 size={18}/>, color: 'text-green-600', bgColor: 'bg-green-50' },
    { id: '樂', icon: <Smile size={18}/>, color: 'text-purple-600', bgColor: 'bg-purple-50' }
  ];

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-10">
      <section>
        <h2 className="text-3xl font-bold text-emerald-900 tracking-tight flex items-center gap-3 mb-6">
          <Home className="text-emerald-600" size={32}/> 旅程時間軸
        </h2>
        <div className="space-y-6 relative">
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-emerald-200/50"></div>
          {timelineItems.length === 0 ? <div className="ml-10 p-6 bg-white rounded-2xl text-stone-400 border border-stone-100">尚無行程</div> : 
            timelineItems.map((item) => {
              let Icon = MapPin;
              if (item.type === 'flight') Icon = Plane;
              else if (item.type === 'train') Icon = Train;
              else if (item.type === 'accommodation') Icon = BedDouble;
              return (
                <div key={item.id} className="relative ml-10">
                  <div className="absolute -left-[42px] top-4 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white shadow-sm z-10"></div>
                  <div className="p-5 rounded-2xl shadow-sm border border-stone-100 bg-white">
                    <div className="flex items-center gap-2 mb-1"><Icon size={14} className="text-emerald-600"/><span className="text-xs font-bold uppercase text-emerald-600">{item.type}</span></div>
                    <h3 className="text-xl font-bold text-stone-800">{item.title}</h3>
                    <div className="text-sm font-medium text-emerald-700 mt-1 flex items-center gap-1"><Clock size={14}/> {item.datetime || '未定時間'}</div>
                    {item.location && <div className="text-sm text-stone-600 mt-2 flex items-center gap-1"><MapPin size={14}/> {item.location} <a href={getGoogleMapsLink(item.location)} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 font-bold hover:underline">地圖</a></div>}
                  </div>
                </div>
              );
            })
          }
        </div>
      </section>

      <section className="pt-8 border-t border-stone-200">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3 mb-8">
          <Heart className="text-pink-500" size={32}/> 願望地圖指南
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {wishlistCategories.map(cat => {
            const catItems = wishlistItems.filter(item => item.category === cat.id);
            return (
              <div key={cat.id} className="flex flex-col space-y-4">
                <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl ${cat.bgColor} border-b-4 border-emerald-500/20`}>
                  <span className={cat.color}>{cat.icon}</span>
                  <span className="font-bold text-stone-800 text-lg">想{cat.id}的</span>
                  <span className="ml-auto bg-white/50 px-2 py-0.5 rounded-full text-xs font-bold text-stone-500">{catItems.length}</span>
                </div>
                <div className="space-y-4">
                  {catItems.length === 0 ? (
                    <div className="text-center py-8 bg-white/30 rounded-2xl border border-dashed border-stone-200 text-stone-300 text-xs font-bold">尚無願望</div>
                  ) : catItems.map(item => (
                    <div key={item.id} className="bg-white rounded-[24px] shadow-md border border-stone-100 overflow-hidden hover:shadow-xl transition group">
                      <div className="h-28 bg-stone-100 relative">
                        <iframe title={item.name} width="100%" height="100%" loading="lazy" style={{ border: 0, filter: 'grayscale(0.2)' }} src={`https://maps.google.com/maps?q=${encodeURIComponent(item.name)}&t=&z=14&ie=UTF-8&iwloc=&output=embed`}></iframe>
                        <div className="absolute inset-0 bg-transparent cursor-pointer" onClick={() => window.open(getNavigationLink(item.name), '_blank')}></div>
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-stone-800 text-sm truncate mb-3">{item.name}</h4>
                        <button onClick={() => window.open(getNavigationLink(item.name), '_blank')} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition group-hover:scale-[1.02] active:scale-95">
                          <Navigation size={14} className="animate-pulse" /> 即時導覽
                        </button>
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

// --- 視圖組件: 行李清單 (已移除 AI) ---
function PackingListView({ tripId, items }) {
  const [newItem, setNewItem] = useState('');
  const handleAdd = async (e) => {
    e.preventDefault(); if (!newItem.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_packing'), { tripId, item: newItem.trim(), completed: false, createdAt: serverTimestamp() });
    setNewItem('');
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Luggage className="text-emerald-600" size={32}/> 行李清單</h2>
        {/* AI 按鈕已移除 */}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 bg-white p-2 rounded-2xl border border-stone-100 shadow-sm">
        <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder="新增行李..." className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" />
        <button type="submit" className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={24}/></button>
      </form>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center bg-white p-4 rounded-xl border border-stone-100 shadow-sm cursor-pointer" onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_packing', item.id), { completed: !item.completed })}>
            <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>{item.completed && <CheckCircle2 size={16} className="text-white"/>}</div>
            <span className={`flex-1 text-lg font-medium ${item.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{item.item}</span>
            <button type="button" onClick={(e)=>{e.stopPropagation();deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_packing', item.id))}} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 視圖組件: 代辦事項 ---
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
        {items.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-stone-100 flex items-center shadow-sm cursor-pointer" onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_todo', item.id), { completed: !item.completed })}>
            <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>{item.completed && <CheckCircle2 size={16} className="text-white"/>}</div>
            <span className={`flex-1 text-lg font-medium ${item.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{item.task}</span>
            <button type="button" onClick={(e)=>{e.stopPropagation();deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_todo', item.id))}} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 視圖組件: 願望清單 ---
function WishListView({ tripId, items }) {
  const [newItem, setNewItem] = useState('');
  const [cat, setCat] = useState('吃');
  const categories = [{ id: '吃', icon: <Utensils size={16}/> }, { id: '喝', icon: <Coffee size={16}/> }, { id: '玩', icon: <Gamepad2 size={16}/> }, { id: '樂', icon: <Smile size={16}/> }];
  const handleAdd = async (e) => {
    e.preventDefault(); if (!newItem.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_wishlist'), { tripId, name: newItem.trim(), category: cat, createdAt: serverTimestamp() });
    setNewItem('');
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Heart className="text-emerald-600" size={32}/> 願望清單</h2>
      <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {categories.map(c => <button key={c.id} onClick={()=>setCat(c.id)} className={`px-4 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-1 ${cat===c.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-stone-50 text-stone-500'}`}>{c.icon}{c.id}</button>)}
        </div>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input type="text" value={newItem} onChange={e=>setNewItem(e.target.value)} placeholder={`想${cat}的地點名稱...`} className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" />
          <button type="submit" className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={24}/></button>
        </form>
      </div>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-stone-100 shadow-sm flex items-center justify-between">
            <div className="flex-1">
              <span className="font-bold text-stone-800">{item.name} </span>
              <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg font-bold ml-2">{item.category}</span>
            </div>
            <div className="flex items-center gap-2">
              <a href={getGoogleMapsLink(item.name)} target="_blank" rel="noreferrer" className="p-3 text-emerald-500 hover:bg-emerald-50 rounded-xl transition">
                <Map size={20} />
              </a>
              <button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_wishlist', item.id))} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 視圖組件: 行程規劃 (已移除 AI) ---
function ItineraryView({ tripId, items }) {
  const [showAdd, setShowAdd] = useState(false);
  // AI 相關功能已移除
  const itItems = items.filter(i => !['flight','train','bus','ship','accommodation'].includes(i.type));
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8 flex-wrap gap-2">
        <h2 className="text-3xl font-bold text-emerald-900"><Calendar className="text-emerald-600 inline mr-2"/>行程規劃</h2>
        <div className="flex gap-2">
          {/* AI 按鈕已移除 */}
          <button onClick={()=>setShowAdd(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg"><Plus size={20}/> 新增行程</button>
        </div>
      </div>
      {itItems.map(item=>(
        <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 flex justify-between mb-3">
          <div><div className="text-xs font-bold text-emerald-600 uppercase mb-1">{item.type}</div><div className="font-bold text-lg">{item.title}</div><div className="text-sm text-stone-400 mt-1 flex items-center gap-1"><Clock size={12}/> {item.datetime || '未定'}</div><div className="text-sm text-stone-500 mt-1 flex items-center gap-1"><MapPin size={12}/> {item.location}</div></div>
          <button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', item.id))}><Trash2 size={18} className="text-stone-300 hover:text-red-500"/></button>
        </div>
      ))}
      {showAdd && <AddItineraryModal tripId={tripId} onClose={()=>setShowAdd(false)} />}
    </div>
  );
}

// --- 視圖組件: 交通情報 ---
function TransportView({ tripId, items }) {
  const [showAdd, setShowAdd] = useState(false);
  const tItems = items.filter(i=>['flight','train','bus','ship'].includes(i.type));
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Train className="text-emerald-600" size={32}/> 交通情報</h2>
        <button onClick={()=>setShowAdd(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg"><Plus size={20}/> 新增票券</button>
      </div>
      <div className="grid gap-4">
        {tItems.map(item=>(
          <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 flex justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-600 uppercase px-2 py-0.5 bg-blue-50 rounded-full">{item.type}</span>
                {item.seat && <span className="text-xs font-bold text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-full flex items-center gap-1"><Armchair size={12}/> 座位: {item.seat}</span>}
              </div>
              <div className="font-bold text-lg text-stone-800">{item.title}</div>
              <div className="text-sm font-bold text-stone-700 mt-1 flex items-center gap-1"><ArrowRightLeft size={14} className="text-stone-400"/> {item.originDest}</div>
              <div className="text-xs text-stone-400 mt-2 flex items-center gap-1"><Clock size={12}/> {item.datetime}</div>
            </div>
            <button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', item.id))} className="text-stone-200 hover:text-red-500 transition-colors p-2 self-start"><Trash2 size={20}/></button>
          </div>
        ))}
      </div>
      {showAdd && <AddTransportModal tripId={tripId} onClose={()=>setShowAdd(false)} />}
    </div>
  );
}

// --- 視圖組件: 住宿登錄 ---
function AccommodationView({ tripId, items }) {
  const [showAdd, setShowAdd] = useState(false);
  const aItems = items.filter(i=>i.type==='accommodation');
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><BedDouble className="text-emerald-600" size={32}/> 住宿登錄</h2>
        <button onClick={()=>setShowAdd(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg"><Plus size={20}/> 新增住宿</button>
      </div>
      {aItems.map(i=>(
        <div key={i.id} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex justify-between mb-4">
          <div className="flex-1">
            <div className="font-bold text-xl text-stone-800 mb-1">{i.title}</div>
            <div className="text-sm text-stone-500 mb-3 flex items-center gap-1"><MapPin size={14}/> {i.location} <a href={getGoogleMapsLink(i.location)} target="_blank" rel="noreferrer" className="ml-2 text-blue-500 font-bold hover:underline text-xs">地圖</a></div>
            <div className="grid grid-cols-2 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-50 shadow-inner">
              <div className="text-xs text-stone-600"><strong>入住時間:</strong> {i.checkInTime || '--:--'}</div>
              <div className="text-xs text-stone-600"><strong>退房時間:</strong> {i.checkOutTime || '--:--'}</div>
              <div className="text-xs flex items-center gap-1"><strong>早餐服務:</strong> {i.hasBreakfast === '是' ? <span className="text-emerald-600 flex items-center font-bold"><Coffee size={12} className="mr-0.5"/>含早餐</span> : <span className="text-stone-400">無</span>}</div>
              <div className="text-xs flex items-center gap-1"><strong>行李寄放:</strong> {i.canStoreLuggage === '是' ? <span className="text-emerald-600 flex items-center font-bold"><Briefcase size={12} className="mr-0.5"/>可寄放</span> : <span className="text-stone-400">不可</span>}</div>
            </div>
          </div>
          <button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_items', i.id))} className="pl-4 text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
        </div>
      ))}
      {showAdd && <AddAccommodationModal tripId={tripId} onClose={()=>setShowAdd(false)} />}
    </div>
  );
}

// --- 視圖組件: 旅遊工具箱 ---
function ToolsView({ tripId }) {
  const [tab, setTab] = useState('phrases');
  return (
    <div className="space-y-6 max-w-4xl mx-auto h-full flex flex-col">
      <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3 flex-shrink-0"><Settings size={32}/> 旅遊工具</h2>
      <div className="flex gap-4 border-b border-stone-200 mb-4 flex-shrink-0">
        {['phrases', 'gojuon', 'ai'].map(t => (<button key={t} onClick={()=>setTab(t)} className={`pb-2 font-bold transition-colors ${tab===t ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-stone-400'}`}>{t==='phrases' ? '日語會話' : t==='gojuon' ? '五十音' : '✨ AI 助手'}</button>))}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab==='phrases' && <JapanesePhrases />}
        {tab==='gojuon' && <GojuonChart />}
        {tab==='ai' && <AIAssistantView tripId={tripId} />}
      </div>
    </div>
  );
}

// --- 子組件: AI 助手 (CSS修正 + Key說明) ---
function AIAssistantView({ tripId }) {
  const [queryText, setQueryText] = useState('');
  const [messages, setMessages] = useState([{ role: 'ai', text: `你好！我是你的 ✨ AI 旅遊助手。你可以問我關於 ${tripId} 的文化、天氣或幫你翻譯。` }]);
  const [loading, setLoading] = useState(false);
  // 新增 ref 以自動捲動到底部
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!queryText.trim() || loading) return;
    const userMsg = queryText; 
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]); 
    setQueryText(''); 
    setLoading(true);
    
    try {
      const response = await callGemini(`目的地：${tripId}。用戶問：${userMsg}`);
      setMessages(prev => [...prev, { role: 'ai', text: response || "抱歉，我無法回答。" }]);
    } catch (e) { 
      setMessages(prev => [...prev, { role: 'ai', text: `連線失敗: ${e.message} (請確認您的 API Key 設定)` }]); 
    } finally { 
      setLoading(false); 
    }
  };

  // 使用 h-[calc(100vh-280px)] 確保在手機上有足夠空間，並使用 flex-col 撐開
  return (
    <div className="flex flex-col h-[calc(100vh-280px)] md:h-[600px] bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 menu-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-800'}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        {loading && <div className="text-center text-xs text-stone-400 animate-pulse">正在輸入...</div>}
      </div>
      <div className="p-4 border-t border-stone-100 bg-white flex gap-2 flex-shrink-0">
        <input 
          type="text" 
          value={queryText} 
          onChange={e => setQueryText(e.target.value)} 
          placeholder="問點什麼..." 
          className="flex-1 p-3 bg-stone-50 rounded-xl outline-none border border-stone-200 focus:border-emerald-500 transition-colors" 
          onKeyDown={e => e.key === 'Enter' && handleSend()} 
        />
        <button onClick={handleSend} disabled={loading} className="bg-emerald-600 text-white p-3 rounded-xl disabled:opacity-50 active:scale-95 transition-transform">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}

// --- 子組件: 日語會話 ---
function JapanesePhrases() {
  const categories = { 
    "常用招呼": ["こんにちは (你好)", "ありがとうございます (謝謝)", "すみません (不好意思)"],
    "餐廳用語": ["メニューをください (請給我菜單)", "お會計をお願いします (請結帳)", "美味しいです (好吃)"]
  };
  return (
    <div className="grid gap-6">
      {Object.entries(categories).map(([cat, phrases], i) => (
        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100">
          <h3 className="font-bold text-lg text-emerald-800 mb-4">{cat}</h3>
          <div className="space-y-3">
            {phrases.map((p, idx) => {
              const [jp, cn] = p.split(' (');
              return (
                <div key={idx} className="flex justify-between items-center bg-stone-50 p-3 rounded-xl">
                  <div><div className="font-bold text-stone-800">{jp}</div><div className="text-xs text-stone-500">{cn.replace(')', '')}</div></div>
                  <button onClick={() => playGoogleAudio(jp)} className="p-3 text-emerald-600 hover:scale-110 transition-transform"><Volume2 size={20} /></button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- 子組件: 五十音圖 ---
function GojuonChart() {
  const hira = [['あ','い','う','え','お'], ['か','き','く','け','こ']];
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
      <div className="grid grid-cols-5 gap-3">
        {hira.flat().map((c, i) => <div key={i} className="p-3 bg-emerald-50 rounded-lg text-center font-bold text-emerald-900">{c}</div>)}
      </div>
    </div>
  );
}

// --- 視圖組件: 記帳分帳 (分攤功能) ---
function ExpenseView({ tripId, expenses }) {
  const [showAdd, setShowAdd] = useState(false);
  const totalTWD = expenses.reduce((sum, item) => {
    const rates = { JPY: 0.22, USD: 32, EUR: 35, KRW: 0.024, THB: 0.9, TWD: 1 };
    return sum + (Number(item.amount) * (rates[item.currency] || 1));
  }, 0);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8 flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-bold text-emerald-900 flex gap-2 items-center"><Wallet className="text-emerald-600" size={32}/> 記帳分帳</h2>
          <div className="mt-2 text-stone-500 font-bold text-2xl flex items-baseline gap-1">
            <span className="text-sm font-medium">總支出約</span> NT$ {Math.round(totalTWD).toLocaleString()}
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg btn-active-effect">
          <Plus size={20} /> 新增支出
        </button>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm border border-stone-100 divide-y divide-stone-100 overflow-hidden">
        {expenses.length === 0 ? <div className="p-10 text-center text-stone-400">尚無紀錄</div> : expenses.map(exp => (
          <div key={exp.id} className="p-5 flex flex-col hover:bg-stone-50 transition-colors">
            <div className="flex justify-between items-center mb-2">
              <div className="flex-1">
                <h4 className="font-bold text-stone-800 text-lg">{exp.title}</h4>
                <div className="text-xs text-stone-500 mt-1">
                  <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold">{exp.payer} 付款</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div className="font-mono font-bold text-stone-800 text-lg">{exp.currency} {Number(exp.amount).toLocaleString()}</div>
                <button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'trip_expenses', exp.id))} className="text-stone-200 hover:text-red-500 transition-colors p-2"><Trash2 size={20}/></button>
              </div>
            </div>
            {/* 分攤詳情 */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
              <div className="text-[10px] font-bold text-stone-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Users size={10}/> 分攤明細 ({exp.splitMode === 'average' ? '自動平均' : '手動分攤'})</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {exp.splitDetails?.map((detail, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white px-3 py-1.5 rounded-lg border border-stone-100 shadow-sm">
                    <span className="text-xs text-stone-600 font-medium truncate max-w-[50px]">{detail.name}</span>
                    <span className="text-xs font-bold text-emerald-600">{exp.currency} {Math.round(detail.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {showAdd && <AddExpenseModal tripId={tripId} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// --- 彈窗組件: 新增支出 (進階分攤功能) ---
function AddExpenseModal({ tripId, onClose }) {
  const defaultCurrency = useMemo(() => detectCurrency(tripId), [tripId]);
  const [f, setF] = useState({ title: '', amount: '', payer: '', currency: defaultCurrency });
  const [splitMode, setSplitMode] = useState('average'); // 'average' 或 'manual'
  const [numPeople, setNumPeople] = useState(2);
  const [manualSplits, setManualSplits] = useState([{ name: '', amount: '' }]);

  const handleAddPerson = () => setManualSplits([...manualSplits, { name: '', amount: '' }]);
  const handleRemovePerson = (index) => setManualSplits(manualSplits.filter((_, i) => i !== index));
  const updateManualSplit = (index, field, value) => {
    const newSplits = [...manualSplits];
    newSplits[index][field] = value;
    setManualSplits(newSplits);
  };

  const sub = async (e) => {
    e.preventDefault();
    let finalSplitDetails = [];
    const totalAmount = Number(f.amount);

    if (splitMode === 'average') {
      const perPerson = totalAmount / numPeople;
      for (let i = 1; i <= numPeople; i++) {
        finalSplitDetails.push({ name: `成員 ${i}`, amount: perPerson });
      }
    } else {
      finalSplitDetails = manualSplits.map(s => ({ name: s.name || '未具名', amount: Number(s.amount) || 0 }));
    }

    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_expenses'), { 
      ...f, 
      tripId, 
      splitMode, 
      splitDetails: finalSplitDetails,
      createdAt: serverTimestamp() 
    });
    onClose();
  };

  const inputStyle = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-emerald-500 transition-colors";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <h3 className="font-bold text-xl mb-4 text-emerald-900 flex items-center gap-2"><CreditCard size={24}/> 新增支出與分攤</h3>
        <form onSubmit={sub} className="space-y-4 overflow-y-auto menu-scrollbar pr-1">
          <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">項目名稱</label><input type="text" required placeholder="例如: 飯店餐費、環球影城門票" className={inputStyle} value={f.title} onChange={e=>setF({...f, title:e.target.value})}/></div>
          <div className="flex gap-2">
            <div className="w-1/3"><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">幣別</label><select className={inputStyle} value={f.currency} onChange={e=>setF({...f, currency:e.target.value})}><option value="TWD">TWD</option><option value="JPY">JPY</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="KRW">KRW</option><option value="THB">THB</option></select></div>
            <div className="w-2/3"><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">總金額</label><input type="number" required placeholder="0" className={inputStyle} value={f.amount} onChange={e=>setF({...f, amount:e.target.value})}/></div>
          </div>
          <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">付款人</label><input type="text" required placeholder="誰先付的錢？" className={inputStyle} value={f.payer} onChange={e=>setF({...f, payer:e.target.value})}/></div>
          {/* 分攤切換 */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <div className="flex gap-2 mb-4 p-1 bg-white rounded-xl border border-stone-200 shadow-inner">
              <button type="button" onClick={()=>setSplitMode('average')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${splitMode==='average' ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-400'}`}>自動平均</button>
              <button type="button" onClick={()=>setSplitMode('manual')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${splitMode==='manual' ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-400'}`}>手動分攤</button>
            </div>
            {splitMode === 'average' ? (
              <div><label className="block text-xs font-bold text-emerald-800 mb-2 ml-1">分攤人數</label><input type="number" min="1" className={inputStyle} value={numPeople} onChange={e=>setNumPeople(Number(e.target.value))}/><div className="mt-2 text-right text-sm font-bold text-emerald-600">每人應付約 {f.currency} {f.amount && numPeople ? Math.round(f.amount / numPeople).toLocaleString() : 0}</div></div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center"><label className="block text-xs font-bold text-emerald-800 ml-1">分攤名單</label><button type="button" onClick={handleAddPerson} className="text-emerald-600 text-[10px] font-bold">+ 新增成員</button></div>
                <div className="space-y-2 max-h-40 overflow-y-auto">{manualSplits.map((s, i) => (<div key={i} className="flex gap-2"><input type="text" placeholder="人名" className="w-1/2 p-2 bg-white border rounded-lg text-sm" value={s.name} onChange={e=>updateManualSplit(i, 'name', e.target.value)}/><input type="number" placeholder="金額" className="w-1/3 p-2 bg-white border rounded-lg text-sm font-mono" value={s.amount} onChange={e=>updateManualSplit(i, 'amount', e.target.value)}/><button type="button" onClick={()=>handleRemovePerson(i)} className="text-stone-300 hover:text-red-500"><UserMinus size={16}/></button></div>))}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="flex-1 py-4 bg-stone-100 rounded-xl font-bold text-stone-600">取消</button><button type="submit" className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg">儲存分攤</button></div>
        </form>
      </div>
    </div>
  );
}

// --- 彈窗組件: 新增住宿 ---
function AddAccommodationModal({ tripId, onClose }) { 
  const [f, setF] = useState({ title: '', type: 'accommodation', location: '', checkInTime: '15:00', checkOutTime: '11:00', hasBreakfast: '否', canStoreLuggage: '否' }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border border-stone-100 rounded-xl outline-none focus:border-emerald-500 transition-colors";
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
        <h3 className="font-bold text-xl mb-6 text-emerald-900 flex items-center gap-2"><BedDouble size={24}/> 新增住宿登錄</h3>
        <form onSubmit={sub} className="space-y-4">
          <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">住宿名稱</label><input className={inputClass} placeholder="例如: 東京灣希爾頓酒店" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required /></div>
          <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">地址 (與地圖連動)</label><input className={inputClass} placeholder="輸入地址或地點" value={f.location} onChange={e=>setF({...f, location:e.target.value})} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">入住時間</label><input type="time" className={inputClass} value={f.checkInTime} onChange={e=>setF({...f, checkInTime:e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">退房時間</label><input type="time" className={inputClass} value={f.checkOutTime} onChange={e=>setF({...f, checkOutTime:e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">含有早餐</label><select className={inputClass} value={f.hasBreakfast} onChange={e=>setF({...f, hasBreakfast:e.target.value})}><option value="否">否</option><option value="是">是</option></select></div>
            <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">行李寄放</label><select className={inputClass} value={f.canStoreLuggage} onChange={e=>setF({...f, canStoreLuggage:e.target.value})}><option value="否">否</option><option value="是">是</option></select></div>
          </div>
          <div className="flex gap-2 pt-4"><button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-stone-600 btn-active-effect">取消</button><button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg">確認新增</button></div>
        </form>
      </div>
    </div>
  ); 
}

// --- 彈窗組件: 新增交通票券 ---
function AddTransportModal({ tripId, onClose }) { 
  const [f, setF] = useState({ title: '', datetime: '', type: 'flight', originDest: '', seat: '' }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border border-stone-100 rounded-xl outline-none focus:border-blue-500 transition-colors";
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-xl mb-6 text-blue-900 flex items-center gap-2"><Train size={24}/> 新增交通票券</h3>
        <form onSubmit={sub} className="space-y-4">
          <select className={inputClass} value={f.type} onChange={e=>setF({...f, type:e.target.value})}><option value="flight">機票 (Flight)</option><option value="train">火車票 (Train)</option><option value="bus">巴士券 (Bus)</option><option value="ship">船票 (Ship)</option></select>
          <input type="datetime-local" className={inputClass} value={f.datetime} onChange={e=>setF({...f, datetime:e.target.value})} required />
          <input className={inputClass} placeholder="班次名稱" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required />
          <div className="grid grid-cols-2 gap-3"><input className={inputClass} placeholder="起訖點" value={f.originDest} onChange={e=>setF({...f, originDest:e.target.value})} required /><input className={inputClass} placeholder="座位" value={f.seat} onChange={e=>setF({...f, seat:e.target.value})} /></div>
          <div className="flex gap-2 pt-4"><button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-stone-600">取消</button><button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">確認新增</button></div>
        </form>
      </div>
    </div>
  ); 
}

// --- 彈窗組件: 新增行程規劃 ---
function AddItineraryModal({ tripId, onClose }) { 
  const [f, setF] = useState({ title: '', datetime: '', type: 'sight', location: '' }); 
  const sub = async (e) => { e.preventDefault(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'trip_items'), { ...f, tripId }); onClose(); }; 
  const inputClass = "w-full p-3 bg-stone-50 border rounded-xl outline-none focus:border-emerald-500";
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-bold text-xl mb-4 text-emerald-900">新增行程規劃</h3>
        <form onSubmit={sub} className="space-y-4">
          <input className={inputClass} placeholder="景點名稱" value={f.title} onChange={e=>setF({...f, title:e.target.value})} required/>
          <input type="datetime-local" className={inputClass} value={f.datetime} onChange={e=>setF({...f, datetime:e.target.value})} required/>
          <input className={inputClass} placeholder="地點" value={f.location} onChange={e=>setF({...f, location:e.target.value})} required/>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold">取消</button><button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">確認新增</button></div>
        </form>
      </div>
    </div>
  ); 
}