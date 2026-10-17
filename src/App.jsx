import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  MapPin, Calendar, Clock, CreditCard, Users, Plus, Trash2, Plane, Train, 
  ArrowRightLeft, Navigation, Utensils, CheckCircle2, 
  Palmtree, Wallet, Settings, ChevronRight, BedDouble, Menu, X, 
  Luggage, ClipboardList, Heart, Volume2, Coffee, 
  Briefcase, Gamepad2, Smile, Home, Armchair,
  UserMinus, Wifi, MonitorSmartphone, Fuel, ShoppingBag, Compass, Pencil, Tag, StickyNote,
  Calculator, UserCheck, ArrowRight, Hourglass, ChevronDown, ChevronUp, Radio,
  ArrowUp, ArrowDown
} from 'lucide-react';

// --- 請確認此處已填入您的真實 Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyBh0YDP353os0h_CwjJ04K4U9NTVDa2nn4",
  authDomain: "tripmate-c8148.firebaseapp.com",
  projectId: "tripmate-c8148",
  storageBucket: "tripmate-c8148.firebasestorage.app",
  messagingSenderId: "1051971323186",
  appId: "1:1051971323186:web:c6596264c4de9fe9ad032b"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const detectCurrency = (id) => {
  const text = (id || "").toLowerCase();
  if (/japan|tokyo|osaka|kyoto|okinawa|hokkaido|fukuoka|nrt|hnd|kix|fuk|日本|東京|大阪|京都|沖繩|北海道|福岡|九州/.test(text)) return 'JPY';
  if (/taiwan|taipei|tpe|hsinchu|taichung|kaohsiung|台灣|台北|新竹|台中|高雄/.test(text)) return 'TWD';
  if (/korea|seoul|busan|icn|韓國|首爾|釜山/.test(text)) return 'KRW';
  if (/usa|america|new york|la|sf|美洲|美國|紐約|洛杉磯/.test(text)) return 'USD';
  if (/europe|france|paris|germany|berlin|italy|rome|英國|歐洲|法國|巴黎|德國|柏林|義大利|羅馬/.test(text)) return 'EUR';
  if (/thailand|bangkok|泰國|曼谷/.test(text)) return 'THB';
  return 'TWD'; 
};

// 判斷是否為日本行程/地點
const checkIsJapan = (tripId, location) => {
  const text = `${tripId || ''} ${location || ''}`.toLowerCase();
  return /japan|tokyo|osaka|kyoto|okinawa|hokkaido|fukuoka|nagoya|nrt|hnd|kix|fuk|日本|東京|大阪|京都|沖繩|北海道|福岡|名古屋|九州/.test(text);
};

const calculateDuration = (start, end) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  if (isNaN(diffMs) || diffMs <= 0) return null;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours > 0 && mins > 0) return `${hours}小時 ${mins}分鐘`;
  if (hours > 0) return `${hours}小時`;
  return `${mins}分鐘`;
};

const getItemSortTime = (item) => {
  if (!item) return '9999-99-99T99:99';
  if (item.datetime) return item.datetime;
  if (item.checkInDatetime) return item.checkInDatetime;
  if (item.checkInDate) {
    let time = item.checkInTime || '15:00';
    if (time.length === 4) time = '0' + time;
    return `${item.checkInDate}T${time}`;
  }
  return '9999-99-99T99:99';
};

const compressImageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const scaleSize = MAX_WIDTH / Math.max(img.width, MAX_WIDTH);
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const getGoogleMapsLink = (location) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || '')}`;
const getNavigationLink = (location) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location || '')}`;

const playGoogleAudio = (text) => {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(text || '')}`;
  const audio = new Audio(url);
  audio.play().catch((e) => console.warn("播放受限", e));
};

export default function App() {
  const [user, setUser] = useState(null);
  const [tripId, setTripId] = useState(localStorage.getItem('last_trip_id') || '');
  const [isJoined, setIsJoined] = useState(Boolean(localStorage.getItem('last_trip_id')));

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        setUser({ uid: 'user-' + Math.random().toString(36).substring(7) });
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { if (u) setUser(u); });
    return () => unsubscribe();
  }, []);

  const handleJoinTrip = (id) => {
    const cleanId = (id || '').trim().toUpperCase();
    if (!cleanId) return;
    setTripId(cleanId);
    localStorage.setItem('last_trip_id', cleanId);
    setIsJoined(true);
  };

  const handleLeave = () => {
    localStorage.removeItem('last_trip_id');
    setTripId('');
    setIsJoined(false);
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 font-serif">
      <div className="text-emerald-600 font-bold text-xl flex items-center gap-2">
        <Palmtree size={24} /> 正在載入旅伴 TripMate...
      </div>
    </div>
  );

  if (!isJoined) return <Onboarding onJoin={handleJoinTrip} initialId={tripId} />;

  return <TripDashboard tripId={tripId} userId={user.uid} onLeave={handleLeave} />;
}

function Onboarding({ onJoin, initialId }) {
  const [input, setInput] = useState(initialId);
  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-serif">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center relative z-10 border border-stone-200">
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-500 p-5 rounded-2xl text-white shadow-lg">
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
            只要在不同手機或電腦輸入完全相同的「旅遊代碼」，
            所有行程、記帳與清單都會即時同步顯示！
          </p>
        </div>

        <div className="space-y-5">
          <div className="text-left">
            <label className="block text-sm font-bold text-emerald-800 mb-2 ml-1">設定旅遊代碼 (Trip ID)</label>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value.toUpperCase())} 
              placeholder="例如: JEJU2026 或 6 位數代碼" 
              className="w-full px-5 py-4 bg-stone-50 border-2 border-stone-100 rounded-2xl focus:border-emerald-500 outline-none text-lg font-mono font-bold tracking-wider text-emerald-900 uppercase text-center"
            />
          </div>
          <button onClick={() => onJoin(input)} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl transition shadow-lg text-lg flex items-center justify-center gap-2">開始旅程 <ChevronRight size={20} /></button>
        </div>
      </div>
    </div>
  );
}

function TripDashboard({ tripId, userId, onLeave }) {
  const [activeTab, setActiveTab] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [packingItems, setPackingItems] = useState([]);
  const [todoItems, setTodoItems] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  useEffect(() => {
    if (!tripId || !userId) return;

    const unsubItems = onSnapshot(collection(db, 'trips', tripId, 'items'), (snap) => {
      setItems(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => getItemSortTime(a).localeCompare(getItemSortTime(b)))
      );
    }, (err) => console.error("同步行程失敗:", err));

    const unsubExp = onSnapshot(collection(db, 'trips', tripId, 'expenses'), (snap) => {
      setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0)));
    }, (err) => console.error("同步記帳失敗:", err));

    const unsubPack = onSnapshot(collection(db, 'trips', tripId, 'packing'), (snap) => {
      setPackingItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("同步行李失敗:", err));

    const unsubTodo = onSnapshot(collection(db, 'trips', tripId, 'todo'), (snap) => {
      setTodoItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("同步待辦失敗:", err));

    const unsubWish = onSnapshot(collection(db, 'trips', tripId, 'wishlist'), (snap) => {
      setWishlistItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("同步願望失敗:", err));

    const unsubMembers = onSnapshot(collection(db, 'trips', tripId, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("同步成員失敗:", err));

    return () => { unsubItems(); unsubExp(); unsubPack(); unsubTodo(); unsubWish(); unsubMembers(); };
  }, [tripId, userId]);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col max-w-5xl mx-auto shadow-2xl overflow-hidden font-serif">
      <main className="flex-1 flex flex-col overflow-y-auto bg-stone-100 relative">
        <div className="sticky top-0 z-30 bg-white shadow-md p-4 flex justify-between items-center md:hidden border-b border-stone-200">
          <h1 className="text-xl font-bold text-emerald-900 flex items-center gap-2"><Palmtree size={24} className="text-emerald-500" /> TripMate</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 font-bold"><Wifi size={12}/> 連線中</span>
            <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 px-3 py-1 rounded-full uppercase">{tripId}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32">
          {activeTab === 'home' && <HomeView tripId={tripId} items={items} wishlistItems={wishlistItems} onPreviewAttachment={setPreviewAttachment} />}
          {activeTab === 'itinerary' && <ItineraryView tripId={tripId} items={items} />}
          {activeTab === 'transport' && <TransportView tripId={tripId} items={items} onPreviewAttachment={setPreviewAttachment} />}
          {activeTab === 'accommodation' && <AccommodationView tripId={tripId} items={items} onPreviewAttachment={setPreviewAttachment} />}
          {activeTab === 'expense' && <ExpenseView tripId={tripId} expenses={expenses} members={members} />}
          {activeTab === 'packing' && <PackingListView tripId={tripId} items={packingItems} />}
          {activeTab === 'todo' && <TodoListView tripId={tripId} items={todoItems} />}
          {activeTab === 'wishlist' && <WishListView tripId={tripId} items={wishlistItems} />}
          {activeTab === 'tools' && <ToolsView />}
        </div>
      </main>

      {previewAttachment && (
        <AttachmentModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}

      <MobileFabMenu activeTab={activeTab} onNavClick={(id) => { setActiveTab(id); setIsMenuOpen(false); }} onLeave={onLeave} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
    </div>
  );
}

function AttachmentModal({ attachment, onClose }) {
  const isImage = (attachment || '').startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(attachment || '');

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[90vh] flex flex-col items-center justify-between shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 bg-stone-100 rounded-full"
        >
          <X size={20}/>
        </button>

        <div className="w-full text-center mb-4">
          <span className="text-3xl block mb-1">🎫</span>
          <h3 className="font-bold text-lg text-stone-800">重要票券 / 憑證掃描</h3>
          <p className="text-xs text-stone-400">請直接出示給工作人員掃描</p>
        </div>

        <div className="flex-1 w-full flex items-center justify-center bg-stone-50 rounded-2xl overflow-hidden p-2 border border-stone-200">
          {isImage ? (
            <img src={attachment} alt="憑證截圖" className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-sm" />
          ) : (
            <div className="text-center p-6 space-y-3">
              <span className="text-4xl block text-blue-500">📄</span>
              <p className="text-sm font-bold text-stone-700">外部文件憑證 (PDF / 雲端硬碟)</p>
              <a 
                href={attachment} 
                target="_blank" 
                rel="noreferrer"
                className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-md"
              >
                開啟原始文件連結
              </a>
            </div>
          )}
        </div>

        <button 
          onClick={onClose} 
          className="w-full mt-4 py-3 bg-stone-900 text-white font-bold rounded-xl text-sm"
        >
          關閉預覽
        </button>
      </div>
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
    { id: 'tools', label: '日語會話', icon: <Settings size={20} /> },
  ];
  return (
    <>
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white p-4 rounded-full shadow-xl hover:bg-emerald-700 transition">
        {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
      </button>
      {isMenuOpen && (
        <div className="fixed inset-0 bg-stone-900 bg-opacity-70 z-40" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-3xl p-6 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-y-auto menu-scrollbar grid grid-cols-3 gap-4 mb-8">
              {menuItems.map((item) => (
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

// --- 視圖組件: 首頁 (包含折疊便條紙與行程旁 Mapcode 支援一鍵複製) ---
function HomeView({ tripId, items, wishlistItems, onPreviewAttachment }) {
  const [openCategory, setOpenCategory] = useState('吃');
  const [weatherData, setWeatherData] = useState({});
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [stickyNotes, setStickyNotes] = useState([]);
  const [noteInput, setNoteInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  const timelineItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const timeA = getItemSortTime(a);
      const timeB = getItemSortTime(b);
      return timeA.localeCompare(timeB);
    });
  }, [items]);

  useEffect(() => {
    if (!tripId) return;
    const unsub = onSnapshot(collection(db, 'trips', tripId, 'sticky_notes'), (snap) => {
      const notes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notes.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      setStickyNotes(notes);
    }, (err) => console.error("同步便條紙失敗:", err));
    return () => unsub();
  }, [tripId]);

  const handleAddStickyNote = async (e) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    await addDoc(collection(db, 'trips', tripId, 'sticky_notes'), {
      content: noteInput.trim(),
      createdAt: serverTimestamp()
    });
    setNoteInput('');
    setIsNoteOpen(true);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const lat = 33.5904; 
        const lon = 130.4017;
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
        const data = await res.json();
        if (isMounted && data && data.daily) {
          const map = {};
          data.daily.time.forEach((dateStr, idx) => {
            map[dateStr] = {
              code: data.daily.weathercode[idx],
              maxTemp: Math.round(data.daily.temperature_2m_max[idx]),
              minTemp: Math.round(data.daily.temperature_2m_min[idx]),
              rainProb: data.daily.precipitation_probability_max[idx]
            };
          });
          setWeatherData(map);
        }
      } catch (e) {
        console.warn("無法取得氣象資訊", e);
      }
    };
    fetchWeather();
    return () => { isMounted = false; };
  }, []);

  const getWeatherDisplay = (dateStr) => {
    const w = weatherData[dateStr];
    if (!w) return null;
    let iconStr = "☀️";
    if (w.code >= 51 || w.rainProb > 40) iconStr = "🌧️";
    else if (w.code >= 1 && w.code <= 3) iconStr = "⛅";
    else if (w.code > 3) iconStr = "☁️";

    return (
      <span className="bg-emerald-900 text-emerald-200 border border-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-mono flex items-center gap-1 shadow-sm">
        <span>{iconStr}</span>
        <span>{w.minTemp}°~{w.maxTemp}°C</span>
        {w.rainProb > 0 && <span className="text-cyan-200">💧{w.rainProb}%</span>}
      </span>
    );
  };

  const { currentItem, nextItem, isTripOver, isTripNotStarted } = useMemo(() => {
    if (timelineItems.length === 0) return { currentItem: null, nextItem: null, isTripOver: false, isTripNotStarted: false };

    const now = new Date();
    let current = null;
    let next = null;

    for (let i = 0; i < timelineItems.length; i++) {
      const item = timelineItems[i];
      const startStr = getItemSortTime(item);
      if (!startStr || startStr.startsWith('9999')) continue;

      const startTime = new Date(startStr);
      const endTime = item.endDatetime 
        ? new Date(item.endDatetime) 
        : new Date(startTime.getTime() + (90 * 60 * 1000));

      if (now >= startTime && now <= endTime) {
        current = item;
        next = timelineItems[i + 1] || null;
        break;
      }

      if (now < startTime) {
        next = item;
        break;
      }
    }

    const firstTimeStr = getItemSortTime(timelineItems[0]);
    const lastItem = timelineItems[timelineItems.length - 1];
    const lastTimeStr = lastItem ? (lastItem.endDatetime || getItemSortTime(lastItem)) : null;

    const isNotStarted = firstTimeStr && !firstTimeStr.startsWith('9999') && now < new Date(firstTimeStr);
    const isOver = lastTimeStr && !lastTimeStr.startsWith('9999') && now > new Date(lastTimeStr);

    return {
      currentItem: current,
      nextItem: next,
      isTripOver: isOver && !current,
      isTripNotStarted: isNotStarted && !current
    };
  }, [timelineItems]);

  const uniqueDates = useMemo(() => {
    const dates = timelineItems
      .map((item) => {
        const fullTime = getItemSortTime(item);
        return fullTime && fullTime !== '9999-99-99T99:99' ? fullTime.split('T')[0] : null;
      })
      .filter(Boolean);
    return Array.from(new Set(dates)).sort();
  }, [timelineItems]);

  const dateDayMap = useMemo(() => {
    const map = {};
    const totalDays = uniqueDates.length;
    uniqueDates.forEach((dateStr, idx) => {
      if (totalDays === 1) {
        map[dateStr] = "當日行程";
      } else if (idx === totalDays - 1) {
        map[dateStr] = "最後一天";
      } else {
        map[dateStr] = `第 ${idx + 1} 天`;
      }
    });
    return map;
  }, [uniqueDates]);

  const wishlistCategories = [
    { id: '吃', icon: <Utensils size={18}/>, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { id: '喝', icon: <Coffee size={18}/>, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: '玩', icon: <Gamepad2 size={18}/>, color: 'text-green-600', bgColor: 'bg-green-50' },
    { id: '樂', icon: <Smile size={18}/>, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { id: '購', icon: <ShoppingBag size={18}/>, color: 'text-rose-600', bgColor: 'bg-rose-50' }
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      
      {/* 1. 置頂快捷卡片：目前與下一站 (Now & Next) */}
      {timelineItems.length > 0 && (
        <section className="bg-emerald-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-800">
          <div className="flex items-center justify-between mb-5 border-b border-emerald-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h2 className="text-xs font-bold tracking-wider uppercase text-emerald-300">旅程即時動態 • NOW & NEXT</h2>
            </div>
            <div className="text-xs text-stone-300 font-mono font-medium flex items-center gap-1">
              <Clock size={12}/> 即時同步中
            </div>
          </div>

          {isTripNotStarted ? (
            <div className="p-4 bg-emerald-900 rounded-2xl border border-emerald-800">
              <div className="text-xs text-emerald-300 font-bold mb-1">📅 旅程準備出發！首站行程：</div>
              <div className="text-lg font-bold text-white mb-2">{timelineItems[0]?.title}</div>
              <div className="text-xs text-stone-300 flex items-center gap-1">
                <Clock size={12}/> {getItemSortTime(timelineItems[0])?.replace('T', ' ')}
                {timelineItems[0]?.location && ` • ${timelineItems[0].location}`}
              </div>
            </div>
          ) : isTripOver ? (
            <div className="p-4 bg-emerald-900 rounded-2xl text-center py-6 border border-emerald-800">
              <span className="text-2xl mb-1 block">🎉</span>
              <h3 className="font-bold text-white text-base">本次旅程已圓滿完成！</h3>
              <p className="text-xs text-stone-300 mt-1">所有美好回憶與分帳紀錄皆已安全保存。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-900 rounded-2xl p-4 border border-emerald-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400 text-stone-900 flex items-center gap-1">
                      <Radio size={12}/> NOW 進行中
                    </span>
                    <span className="text-xs text-emerald-300 font-bold uppercase">
                      {currentItem?.type === 'res' ? '餐廳' : currentItem?.type === 'accommodation' ? '住宿' : currentItem?.type || '行程'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white truncate mb-1">
                    {currentItem ? currentItem.title : "目前為自由活動時間"}
                  </h3>
                  <div className="text-xs text-stone-300 flex items-center gap-1 mt-1">
                    <Clock size={12}/> 
                    {currentItem ? (
                      <span>
                        {getItemSortTime(currentItem)?.split('T')[1]} 
                        {currentItem.endDatetime && ` ➜ ${currentItem.endDatetime.includes('T') ? currentItem.endDatetime.split('T')[1] : currentItem.endDatetime}`}
                      </span>
                    ) : "享受悠閒步調吧"}
                  </div>
                </div>

                {currentItem?.location && (
                  <div className="mt-4 pt-3 border-t border-emerald-800 flex items-center justify-between">
                    <span className="text-xs text-stone-300 truncate max-w-[180px] flex items-center gap-1">
                      <MapPin size={12} className="text-emerald-400"/> {currentItem.location}
                    </span>
                    <button
                      onClick={() => window.open(getNavigationLink(currentItem.location), '_blank')}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md"
                    >
                      <Navigation size={12}/> 即刻導航
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-stone-900 rounded-2xl p-4 border border-stone-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-700 text-stone-200">
                      NEXT 下一站
                    </span>
                    <span className="text-xs text-stone-400 font-bold uppercase">
                      {nextItem?.type === 'res' ? '餐廳' : nextItem?.type === 'accommodation' ? '住宿' : nextItem?.type || ''}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white truncate mb-1">
                    {nextItem ? nextItem.title : "本日已無後續排程"}
                  </h3>
                  <div className="text-xs text-stone-300 flex items-center gap-1 mt-1">
                    <Clock size={12}/> 
                    {nextItem ? (
                      <span>預計 {getItemSortTime(nextItem)?.replace('T', ' ')} 開始</span>
                    ) : "可以回飯店休息或自由探索"}
                  </div>
                </div>

                {nextItem?.location && (
                  <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between">
                    <span className="text-xs text-stone-300 truncate max-w-[180px] flex items-center gap-1">
                      <MapPin size={12} className="text-stone-400"/> {nextItem.location}
                    </span>
                    <button
                      onClick={() => window.open(getNavigationLink(nextItem.location), '_blank')}
                      className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <Navigation size={12}/> 查看路線
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. 首頁「便條紙」手風琴折疊盒 (位置在即時動態與時間軸正中間) */}
      <section className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setIsNoteOpen(!isNoteOpen)}
          className="w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <span className="font-bold text-amber-950 text-base">便條紙</span>
            <span className="bg-white text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
              {stickyNotes.length}
            </span>
            <span className="text-xs text-amber-700 hidden sm:inline">（點擊展開／收合，隨手記文字資訊）</span>
          </div>
          <div className="text-amber-800">
            {isNoteOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </button>

        {isNoteOpen && (
          <div className="p-4 border-t border-amber-100 bg-white space-y-3">
            <form onSubmit={handleAddStickyNote} className="flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="在此輸入臨時文字資訊、日語句子或飯店地址..."
                className="flex-1 p-2.5 bg-stone-50 border border-stone-200 rounded-xl outline-none text-xs text-stone-800 focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm transition"
              >
                <Plus size={16}/> 新增
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto menu-scrollbar pr-1">
              {stickyNotes.length === 0 ? (
                <div className="text-center py-4 text-stone-300 text-xs font-bold">
                  尚無便條紙紀錄，快在上方新增隨手筆記吧！
                </div>
              ) : stickyNotes.map((note) => (
                <div key={note.id} className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start justify-between gap-3">
                  <p className="flex-1 text-xs leading-relaxed text-stone-800 font-sans whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                  <button
                    type="button"
                    onClick={() => deleteDoc(doc(db, 'trips', tripId, 'sticky_notes', note.id))}
                    className="text-stone-300 hover:text-red-500 p-1 transition flex-shrink-0"
                    title="刪除"
                  >
                    <Trash2 size={15}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 3. 旅程時間軸 (含 Mapcode 備註展示與複製按鈕) */}
      <section>
        <h2 className="text-3xl font-bold text-emerald-900 tracking-tight flex items-center gap-3 mb-6">
          <Home className="text-emerald-600" size={32}/> 旅程時間軸
        </h2>
        <div className="space-y-6 relative">
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-emerald-200"></div>
          {timelineItems.length === 0 ? <div className="ml-10 p-6 bg-white rounded-2xl text-stone-400 border border-stone-100">尚無行程</div> : 
            timelineItems.map((item, index) => {
              const isMemo = item.type === 'memo';
              const isTransport = ['flight','train','bus','ship'].includes(item.type);
              const isAccommodation = item.type === 'accommodation';
              const isRestaurant = item.type === 'res';
              
              let Icon = MapPin;
              if (item.type === 'flight') Icon = Plane;
              else if (item.type === 'train') Icon = Train;
              else if (isAccommodation) Icon = BedDouble;
              else if (isMemo) Icon = StickyNote;
              else if (isRestaurant) Icon = Utensils;

              const fullSortTime = getItemSortTime(item);
              const currentDate = fullSortTime && fullSortTime !== '9999-99-99T99:99' ? fullSortTime.split('T')[0] : null;

              const prevItem = index > 0 ? timelineItems[index - 1] : null;
              const prevDate = prevItem ? getItemSortTime(prevItem).split('T')[0] : null;
              const isFirstItemOfDay = currentDate && currentDate !== prevDate;
              const dayLabel = currentDate ? dateDayMap[currentDate] : '';

              const durationText = calculateDuration(item.datetime, item.endDatetime);

              return (
                <div key={item.id} className="relative ml-10">
                  {isFirstItemOfDay && (
                    <div className="mb-3.5 -ml-8 flex items-center gap-2 z-20 relative flex-wrap">
                      <div className="bg-emerald-800 text-white font-mono font-bold text-xs px-3 py-1 rounded-full shadow-md flex items-center gap-1.5 border border-emerald-700">
                        <Calendar size={12} className="text-emerald-300"/>
                        <span>{currentDate}</span>
                        <span className="bg-emerald-600 text-emerald-100 px-2 py-0.2 rounded-full text-[10px]">
                          {dayLabel}
                        </span>
                      </div>
                      {getWeatherDisplay(currentDate)}
                    </div>
                  )}

                  <div className={`absolute -left-[42px] top-4 w-5 h-5 rounded-full border-4 border-white shadow-sm z-10 ${
                    isMemo ? 'bg-amber-500' : isTransport ? 'bg-blue-500' : isAccommodation ? 'bg-indigo-500' : isRestaurant ? 'bg-orange-500' : 'bg-emerald-500'
                  }`}></div>
                  <div className={`p-5 rounded-2xl shadow-sm border transition-all ${
                    isMemo ? 'bg-amber-50 border-amber-200' : 
                    isTransport ? 'bg-blue-50 border-blue-100' : 
                    isAccommodation ? 'bg-indigo-50 border-indigo-100' : 
                    isRestaurant ? 'bg-orange-50 border-orange-100' : 'bg-white border-stone-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Icon size={14} className={
                        isMemo ? 'text-amber-600' : 
                        isTransport ? 'text-blue-600' : 
                        isAccommodation ? 'text-indigo-600' : 
                        isRestaurant ? 'text-orange-600' : 'text-emerald-600'
                      }/>
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        isMemo ? 'text-amber-700' : 
                        isTransport ? 'text-blue-600' : 
                        isAccommodation ? 'text-indigo-700' : 
                        isRestaurant ? 'text-orange-700' : 'text-emerald-600'
                      }`}>
                        {isMemo ? '旅遊備忘註記' : isAccommodation ? '住宿登錄' : isRestaurant ? 'RES' : item.type === 'sight' ? 'SIGHT' : item.type}
                      </span>
                      {durationText && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-100">
                          <Hourglass size={10}/> 停留 {durationText}
                        </span>
                      )}
                    </div>
                    <h3 className={`text-xl font-bold ${isMemo ? 'text-amber-950 font-sans' : 'text-stone-800'}`}>{item.title}</h3>
                    
                    <div className={`text-sm font-medium mt-1 flex items-center gap-1 flex-wrap ${
                      isMemo ? 'text-amber-700' : 
                      isTransport ? 'text-blue-700' : 
                      isAccommodation ? 'text-indigo-700 font-bold' : 
                      isRestaurant ? 'text-orange-700' : 'text-emerald-700'
                    }`}>
                      <Clock size={14}/> 
                      {isAccommodation ? (
                        <span>
                          入住: {(item.checkInDatetime || `${item.checkInDate || ''} ${item.checkInTime || ''}`).replace('T', ' ')}
                          {(item.checkOutDatetime || item.checkOutDate) && (
                            <span className="text-stone-400 font-normal ml-2">
                              ➜ 退房: {(item.checkOutDatetime || `${item.checkOutDate || ''} ${item.checkOutTime || ''}`).replace('T', ' ')}
                            </span>
                          )}
                        </span>
                      ) : item.datetime ? (
                        <span>
                          {item.datetime.replace('T', ' ')}
                          {item.endDatetime && (
                            <span className="text-stone-400 font-normal"> ➜ {item.endDatetime.includes('T') ? item.endDatetime.split('T')[1] : item.endDatetime}</span>
                          )}
                        </span>
                      ) : '未定時間'}
                    </div>

                    {isTransport && (
                      <div className="mt-3 pt-2.5 border-t border-blue-100 flex flex-wrap gap-2 text-xs">
                        {item.originDest && (
                          <span className="bg-white text-blue-700 font-bold px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                            <ArrowRightLeft size={12} className="text-blue-500"/> {item.originDest}
                          </span>
                        )}
                        {item.seat && (
                          <span className="bg-white text-emerald-700 font-bold px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                            <Armchair size={12}/> 座位: {item.seat}
                          </span>
                        )}
                      </div>
                    )}

                    {item.attachment && (
                      <div className="mt-2.5">
                        <button
                          onClick={() => onPreviewAttachment && onPreviewAttachment(item.attachment)}
                          className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <span>🎫</span> 快速出示憑證／條碼
                        </button>
                      </div>
                    )}

                    {!isMemo && !isTransport && item.location && (
                      <div className="text-sm text-stone-600 mt-2 flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <MapPin size={14}/> {item.location} 
                          <a href={getGoogleMapsLink(item.location)} target="_blank" rel="noreferrer" className="ml-1 text-blue-600 font-bold hover:underline">地圖</a>
                        </div>
                        
                        {/* 🚗 日本自駕專用 Mapcode 徽章 (支援一鍵複製) */}
                        {item.mapcode && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.mapcode)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition active:scale-95 shadow-xs"
                            title="點擊複製 Mapcode 到剪貼簿"
                          >
                            <span>🚗 Mapcode: {item.mapcode}</span>
                            <span className="text-[10px] text-indigo-500">{copiedCode === item.mapcode ? '已複製！' : '複製'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          }
        </div>
      </section>

      {/* 4. 願望清單折疊手風琴區塊 */}
      <section className="pt-8 border-t border-stone-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3">
            <Heart className="text-pink-500" size={32}/> 願望地圖指南
          </h2>
          <span className="text-xs text-stone-400 font-bold">點擊類別可展開／收合清單</span>
        </div>

        <div className="space-y-4">
          {wishlistCategories.map((cat) => {
            const catItems = wishlistItems.filter((item) => item.category === cat.id);
            const isOpen = openCategory === cat.id;

            return (
              <div key={cat.id} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setOpenCategory(isOpen ? null : cat.id)}
                  className={`w-full flex items-center justify-between p-4 ${cat.bgColor} hover:opacity-90 transition`}
                >
                  <div className="flex items-center gap-2">
                    <span className={cat.color}>{cat.icon}</span>
                    <span className="font-bold text-stone-800 text-lg">想{cat.id}的</span>
                    <span className="bg-white text-stone-600 text-xs font-bold px-2.5 py-0.5 rounded-full ml-1">
                      {catItems.length}
                    </span>
                  </div>
                  <div className="text-stone-400">
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {isOpen && (
                  <div className="p-4 border-t border-stone-100 bg-white space-y-3">
                    {catItems.length === 0 ? (
                      <div className="text-center py-6 text-stone-300 text-xs font-bold">尚無願望紀錄</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {catItems.map((item) => (
                          <div key={item.id} className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 flex flex-col justify-between hover:bg-stone-100 transition">
                            <div>
                              <h4 className="font-bold text-stone-800 text-sm truncate mb-1">{item.name}</h4>
                              {item.note && (
                                <p className="text-xs text-stone-500 line-clamp-2 mb-2">💡 {item.note}</p>
                              )}
                            </div>
                            <button
                              onClick={() => window.open(getNavigationLink(item.name), '_blank')}
                              className="w-full flex items-center justify-center gap-1.5 py-2 bg-white text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-600 hover:text-white transition shadow-sm border border-stone-100"
                            >
                              <Navigation size={12}/> 即時導覽
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PackingListView({ tripId, items }) {
  const [newItem, setNewItem] = useState('');
  const handleAdd = async (e) => {
    e.preventDefault(); if (!newItem.trim()) return;
    await addDoc(collection(db, 'trips', tripId, 'packing'), { item: newItem.trim(), completed: false, createdAt: serverTimestamp() });
    setNewItem('');
  };
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Luggage className="text-emerald-600" size={32}/> 行李清單</h2>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2 bg-white p-2 rounded-2xl border border-stone-100 shadow-sm">
        <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="新增行李..." className="flex-1 p-3 bg-stone-50 rounded-xl outline-none" />
        <button type="submit" className="bg-emerald-600 text-white p-3 rounded-xl"><Plus size={24}/></button>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center bg-white p-4 rounded-xl border border-stone-100 shadow-sm cursor-pointer" onClick={() => updateDoc(doc(db, 'trips', tripId, 'packing', item.id), { completed: !item.completed })}>
            <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>{item.completed && <CheckCircle2 size={16} className="text-white"/>}</div>
            <span className={`flex-1 text-lg font-medium ${item.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{item.item}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'trips', tripId, 'packing', item.id)); }} className="text-stone-300 hover:text-red-500 p-2"><Trash2 size={18}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodoListView({ tripId, items }) {
  const [newItem, setNewItem] = useState('');

  const handleAddTodo = async (e) => {
    e.preventDefault(); if (!newItem.trim()) return;
    await addDoc(collection(db, 'trips', tripId, 'todo'), { task: newItem.trim(), completed: false, createdAt: serverTimestamp() });
    setNewItem('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3">
        <ClipboardList className="text-emerald-600" size={32}/> 代辦事項
      </h2>
      <form onSubmit={handleAddTodo} className="flex gap-2 bg-white p-2 rounded-2xl border border-stone-100 shadow-sm">
        <input 
          type="text" 
          value={newItem} 
          onChange={(e) => setNewItem(e.target.value)} 
          placeholder="新增一般代辦事項 (例如: 買網卡、換日幣)..." 
          className="flex-1 p-3 bg-stone-50 rounded-xl outline-none text-sm" 
        />
        <button type="submit" className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition">
          <Plus size={22}/>
        </button>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="bg-white p-4 rounded-xl border border-stone-100 flex items-center shadow-sm cursor-pointer hover:bg-stone-50 transition" 
            onClick={() => updateDoc(doc(db, 'trips', tripId, 'todo', item.id), { completed: !item.completed })}
          >
            <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition ${item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-stone-300'}`}>
              {item.completed && <CheckCircle2 size={16} className="text-white"/>}
            </div>
            <span className={`flex-1 text-base font-medium ${item.completed ? 'line-through text-stone-400' : 'text-stone-800'}`}>{item.task}</span>
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'trips', tripId, 'todo', item.id)); }} 
              className="text-stone-300 hover:text-red-500 p-2"
            >
              <Trash2 size={18}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItineraryView({ tripId, items }) {
  const [showAddItinerary, setShowAddItinerary] = useState(false);
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [showPool, setShowPool] = useState(false);
  
  const scheduledItems = items.filter((i) => !['flight','train','bus','ship','accommodation'].includes(i.type) && i.datetime);
  const unscheduledPool = items.filter((i) => !['flight','train','bus','ship','accommodation'].includes(i.type) && !i.datetime);

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    if (item.type === 'memo') {
      setShowAddMemo(true);
    } else {
      setShowAddItinerary(true);
    }
  };

  const handleCloseModal = () => {
    setShowAddItinerary(false);
    setShowAddMemo(false);
    setEditingItem(null);
  };

  const handleSwapOrder = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scheduledItems.length) return;

    const itemA = scheduledItems[index];
    const itemB = scheduledItems[targetIndex];

    const tempTime = itemA.datetime;
    await updateDoc(doc(db, 'trips', tripId, 'items', itemA.id), { datetime: itemB.datetime });
    await updateDoc(doc(db, 'trips', tripId, 'items', itemB.id), { datetime: tempTime });
  };

  const handleAssignToToday = async (poolItem) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const newDatetime = `${todayStr}T14:00`;
    await updateDoc(doc(db, 'trips', tripId, 'items', poolItem.id), { datetime: newDatetime });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-2">
            <Calendar className="text-emerald-600 inline" size={32}/> 行程規劃
          </h2>
          <div className="flex mt-2 bg-white p-1 rounded-2xl border border-stone-200 shadow-sm w-fit">
            <button 
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-xl font-bold text-xs transition ${viewMode === 'list' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-500'}`}
            >
              清單排列
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('route')}
              className={`px-3 py-1 rounded-xl font-bold text-xs transition flex items-center gap-1 ${viewMode === 'route' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-500'}`}
            >
              <Compass size={14}/> 當日行程動線軌跡
            </button>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => { setEditingItem(null); setShowAddMemo(true); }} 
            className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-3 rounded-2xl flex items-center gap-1.5 font-bold shadow-md transition text-xs"
          >
            <StickyNote size={16}/> + 備忘錄
          </button>
          <button 
            onClick={() => { setEditingItem(null); setShowAddItinerary(true); }} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl flex items-center gap-1.5 font-bold shadow-lg transition text-xs"
          >
            <Plus size={16}/> + 新增行程
          </button>
        </div>
      </div>

      {/* 雨天備案與備選庫 */}
      <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-sm">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowPool(!showPool)}>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm text-sm">
              ☔
            </span>
            <div>
              <h4 className="font-bold text-emerald-950 text-sm">雨天備案與彈性備選庫</h4>
              <p className="text-xs text-emerald-700">未排定時間的候補景點，遇到下雨或排隊過長可即時替換</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-200 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {unscheduledPool.length} 個候補
            </span>
            {showPool ? <ChevronUp size={18} className="text-emerald-700"/> : <ChevronDown size={18} className="text-emerald-700"/>}
          </div>
        </div>

        {showPool && (
          <div className="mt-4 pt-3 border-t border-emerald-200 space-y-2.5">
            {unscheduledPool.length === 0 ? (
              <div className="text-center py-4 text-emerald-600 text-xs font-bold">
                目前沒有備選景點。新增行程時「時間欄位留空」即可存入備選庫！
              </div>
            ) : unscheduledPool.map((poolItem) => (
              <div key={poolItem.id} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-800 text-sm">{poolItem.title}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold uppercase">
                      {poolItem.type === 'res' ? '餐廳' : '景點'}
                    </span>
                  </div>
                  {poolItem.location && (
                    <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                      <MapPin size={10}/> {poolItem.location}
                    </div>
                  )}
                  {poolItem.mapcode && (
                    <div className="text-xs text-indigo-600 font-mono font-bold mt-0.5">
                      🚗 Mapcode: {poolItem.mapcode}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAssignToToday(poolItem)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={12}/> 排入今日 14:00
                  </button>
                  <button 
                    onClick={() => handleOpenEdit(poolItem)} 
                    className="p-1.5 text-stone-400 hover:text-emerald-600"
                  >
                    <Pencil size={14}/>
                  </button>
                  <button 
                    onClick={() => deleteDoc(doc(db, 'trips', tripId, 'items', poolItem.id))} 
                    className="p-1.5 text-stone-300 hover:text-red-500"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'route' ? (
        <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="font-bold text-lg text-emerald-900 flex items-center gap-2">
              <Compass className="text-emerald-600" size={20}/> 單日行程順序連線動線
            </h3>
            <span className="text-xs text-stone-400 font-bold">按時間排列之當日景點與餐廳動線</span>
          </div>

          <div className="space-y-4">
            {scheduledItems.filter((i) => i.location).length === 0 ? (
              <div className="text-stone-300 text-sm text-center py-10">尚無包含地點的行程可呈現動線</div>
            ) : (
              scheduledItems.filter((i) => i.location).map((item, idx, arr) => {
                const duration = calculateDuration(item.datetime, item.endDatetime);
                const isRestaurant = item.type === 'res';
                return (
                  <div key={item.id} className="relative">
                    <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                      <div className={`w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 ${isRestaurant ? 'bg-orange-500' : 'bg-emerald-600'}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-stone-800 text-base">{item.title}</h4>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${isRestaurant ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isRestaurant ? 'RES' : 'SIGHT'}
                          </span>
                          {duration && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-bold">
                              {duration}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                          <Clock size={12}/> {item.datetime ? item.datetime.replace('T', ' ') : '未定時間'}
                          {item.endDatetime && ` ➜ ${item.endDatetime.includes('T') ? item.endDatetime.split('T')[1] : item.endDatetime}`}
                        </p>
                        <p className="text-xs text-emerald-700 mt-1 font-medium flex items-center gap-1">
                          <MapPin size={12}/> {item.location}
                        </p>
                      </div>
                      <a href={getNavigationLink(item.location)} target="_blank" rel="noreferrer" className="p-2.5 bg-white text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl shadow-sm border border-stone-100 transition">
                        <Navigation size={16}/>
                      </a>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="flex items-center justify-center py-1">
                        <ArrowRight size={16} className="text-emerald-400 rotate-90"/>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        scheduledItems.map((item, index) => {
          const isMemo = item.type === 'memo';
          const isRestaurant = item.type === 'res';
          const duration = calculateDuration(item.datetime, item.endDatetime);

          return (
            <div 
              key={item.id} 
              className={`p-5 rounded-2xl shadow-sm border flex justify-between items-center mb-3 transition-all ${
                isMemo ? 'bg-amber-50 border-amber-200' : 
                isRestaurant ? 'bg-orange-50 border-orange-100' : 'bg-white border-stone-100'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {isMemo ? (
                    <span className="text-xs font-bold text-amber-700 uppercase bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <StickyNote size={12}/> 備忘註記
                    </span>
                  ) : isRestaurant ? (
                    <span className="text-xs font-bold text-orange-700 uppercase bg-orange-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Utensils size={12}/> RES
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-md">
                      <MapPin size={12}/> SIGHT
                    </span>
                  )}
                  {duration && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                      <Hourglass size={12}/> 預計停留 {duration}
                    </span>
                  )}
                </div>
                <div className={`font-bold text-lg ${isMemo ? 'text-amber-950 font-sans' : 'text-stone-800'}`}>{item.title}</div>
                <div className={`text-sm mt-1 flex items-center gap-1 flex-wrap ${isMemo ? 'text-amber-700' : isRestaurant ? 'text-orange-700' : 'text-stone-400'}`}>
                  <Clock size={12}/> 
                  {item.datetime ? (
                    <span>
                      {item.datetime.replace('T', ' ')}
                      {item.endDatetime && (
                        <span className="text-stone-500 font-medium"> ➜ {item.endDatetime.includes('T') ? item.endDatetime.split('T')[1] : item.endDatetime}</span>
                      )}
                    </span>
                  ) : '未定時間'}
                </div>
                {!isMemo && item.location && (
                  <div className="text-sm text-stone-500 mt-1 flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <MapPin size={12}/> {item.location}
                    </div>
                    {item.mapcode && (
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-xs font-mono font-bold">
                        🚗 Mapcode: {item.mapcode}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-1 ml-4">
                <div className="flex items-center gap-1 bg-stone-50 rounded-lg p-0.5 border border-stone-200">
                  <button 
                    disabled={index === 0} 
                    onClick={() => handleSwapOrder(index, 'up')}
                    className="p-1 text-stone-400 hover:text-emerald-700 disabled:opacity-20"
                    title="上移"
                  >
                    <ArrowUp size={14}/>
                  </button>
                  <button 
                    disabled={index === scheduledItems.length - 1} 
                    onClick={() => handleSwapOrder(index, 'down')}
                    className="p-1 text-stone-400 hover:text-emerald-700 disabled:opacity-20"
                    title="下移"
                  >
                    <ArrowDown size={14}/>
                  </button>
                </div>
                <button 
                  onClick={() => handleOpenEdit(item)} 
                  className={`p-1.5 transition-colors ${isMemo ? 'text-amber-600 hover:text-amber-800' : isRestaurant ? 'text-orange-600 hover:text-orange-800' : 'text-stone-400 hover:text-emerald-600'}`} 
                  title="編輯"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={() => deleteDoc(doc(db, 'trips', tripId, 'items', item.id))} 
                  className="text-stone-300 hover:text-red-500 p-1.5 transition-colors" 
                  title="刪除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })
      )}

      {showAddItinerary && <AddItineraryModal tripId={tripId} initialData={editingItem} onClose={handleCloseModal} />}
      {showAddMemo && <AddMemoModal tripId={tripId} initialData={editingItem} onClose={handleCloseModal} />}
    </div>
  );
}

function AddMemoModal({ tripId, initialData, onClose }) {
  const [f, setF] = useState({ 
    title: initialData?.title || '', 
    datetime: initialData?.datetime || '', 
    type: 'memo' 
  }); 

  const sub = async (e) => {
    e.preventDefault(); 
    if (initialData?.id) {
      await updateDoc(doc(db, 'trips', tripId, 'items', initialData.id), f);
    } else {
      await addDoc(collection(db, 'trips', tripId, 'items'), { ...f, createdAt: serverTimestamp() });
    }
    onClose(); 
  }; 

  const inputClass = "w-full p-3 bg-stone-50 border rounded-xl outline-none focus:border-amber-500";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border-t-4 border-amber-500">
        <h3 className="font-bold text-xl mb-4 text-amber-900 flex items-center gap-2">
          <StickyNote size={24} className="text-amber-500"/>
          {initialData ? '編輯旅遊備忘錄' : '新增旅遊備忘錄'}
        </h3>
        <form onSubmit={sub} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">旅遊註記內容</label>
            <input 
              className={inputClass} 
              placeholder="例: 抵達車站需先租車、找地下街扭蛋機" 
              value={f.title} 
              onChange={(e) => setF({ ...f, title: e.target.value })} 
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">預計時間 (選填)</label>
            <input 
              type="datetime-local" 
              className={inputClass} 
              value={f.datetime} 
              onChange={(e) => setF({ ...f, datetime: e.target.value })} 
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-stone-600">
              取消
            </button>
            <button type="submit" className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-md transition">
              {initialData ? '更新備忘錄' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ); 
}

// --- 彈窗組件: 新增/編輯行程規劃 (支援日本 Mapcode 搜尋與儲存) ---
function AddItineraryModal({ tripId, initialData, onClose }) { 
  const [sightName, setSightName] = useState(initialData?.type !== 'res' ? (initialData?.title || '') : '');
  const [restaurantName, setRestaurantName] = useState(initialData?.type === 'res' ? (initialData?.title || '') : '');
  const [datetime, setDatetime] = useState(initialData?.datetime || '');
  const [endDatetime, setEndDatetime] = useState(initialData?.endDatetime || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [mapcode, setMapcode] = useState(initialData?.mapcode || '');

  // 判定是否為日本景點行程 (排除餐廳與非日本地區)
  const isSight = Boolean(sightName.trim()) || (!restaurantName.trim() && !sightName.trim());
  const isJapanSight = useMemo(() => {
    return isSight && checkIsJapan(tripId, `${sightName} ${location}`);
  }, [tripId, sightName, location, isSight]);

  const openMapcodeSearch = () => {
    const query = sightName.trim() || location.trim();
    const searchUrl = `https://japanmapcode.com/en?fbclid=IwY2xjawVAbuhleHRuA2FlbQIxMABwZG9mBWJyaWQRMUNGcGpZeVFXQWgxNFhCWG9zcnRjBmFwcF9pZBAyMjIwMzkxNzg4MjAwODkyAAEehwRrGcS4LASTEw8Y8V8i6zrj9B9QrjOscP8vB1KEKh0L3Il3MnoheniW0_g_aem_qpTRiNDnG21Sk9xlnvt75Q#google_vignette`;
    window.open(searchUrl, '_blank');
  };

  const sub = async (e) => { 
    e.preventDefault(); 
    
    const isRestaurant = Boolean(restaurantName.trim()) && !sightName.trim();
    const finalTitle = isRestaurant ? restaurantName.trim() : (sightName.trim() || restaurantName.trim());
    const finalType = isRestaurant ? 'res' : 'sight';

    if (!finalTitle) {
      alert("請填寫「景點名稱」或「餐廳名稱」其中一項！");
      return;
    }

    const payload = {
      title: finalTitle,
      type: finalType,
      datetime,
      endDatetime,
      location,
      mapcode: finalType === 'sight' ? mapcode.trim() : ''
    };

    if (initialData?.id) {
      await updateDoc(doc(db, 'trips', tripId, 'items', initialData.id), payload);
    } else {
      await addDoc(collection(db, 'trips', tripId, 'items'), { ...payload, createdAt: serverTimestamp() });
    }
    onClose(); 
  }; 

  const inputClass = "w-full p-3 bg-stone-50 border rounded-xl outline-none focus:border-emerald-500";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto menu-scrollbar">
        <h3 className="font-bold text-xl mb-4 text-emerald-900">
          {initialData ? '編輯行程規劃' : '新增行程規劃'}
        </h3>
        <p className="text-xs text-stone-400 mb-4">
          提示：若未填寫開始時間，系統會自動歸類到「雨天備案與備選庫」！
        </p>

        <form onSubmit={sub} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1 flex items-center gap-1">
              <MapPin size={12} className="text-emerald-600"/> 景點名稱 (顯示為 SIGHT)
            </label>
            <input 
              className={inputClass} 
              placeholder="例如: 淺草寺、晴空塔、古宇利大橋" 
              value={sightName} 
              onChange={(e) => {
                setSightName(e.target.value);
                if (e.target.value) setRestaurantName('');
              }} 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1 flex items-center gap-1">
              <Utensils size={12} className="text-orange-600"/> 餐廳名稱 (顯示為 RES)
            </label>
            <input 
              className={inputClass} 
              placeholder="例如: 一蘭拉麵、燒肉敘敘苑" 
              value={restaurantName} 
              onChange={(e) => {
                setRestaurantName(e.target.value);
                if (e.target.value) setSightName('');
              }} 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">開始時間 (選填)</label>
              <input type="datetime-local" className={inputClass} value={datetime} onChange={(e) => setDatetime(e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">結束時間 (選填)</label>
              <input type="datetime-local" className={inputClass} value={endDatetime} onChange={(e) => setEndDatetime(e.target.value)}/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">地點 (與地圖導航連動)</label>
            <input className={inputClass} placeholder="地點或詳細地址" value={location} onChange={(e) => setLocation(e.target.value)} required/>
          </div>

          {/* 🚗 日本自駕專屬：Mapcode 輸入與查詢專區 (只在景點且符合日本行程時顯示) */}
          {isJapanSight && (
            <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                  <span>🚗</span> 日本租車 GPS Mapcode (自駕專用)
                </label>
                <button
                  type="button"
                  onClick={openMapcodeSearch}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-0.5"
                  title="前往 Japan Mapcode 搜尋此地點"
                >
                  🔍 查詢 Mapcode
                </button>
              </div>
              <input 
                className="w-full p-2.5 bg-white border border-indigo-200 rounded-xl outline-none text-xs font-mono font-bold text-indigo-900 focus:border-indigo-500" 
                placeholder="例如: 13 318 318*42 (查到後直接貼上)" 
                value={mapcode} 
                onChange={(e) => setMapcode(e.target.value)}
              />
              <p className="text-[11px] text-indigo-600 leading-normal">
                💡 點擊「查詢 Mapcode」開啟官方查碼網站，將查到的號碼貼在上方，首頁即可一鍵複製給車機導航！
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-stone-600">取消</button>
            <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg">
              {initialData ? '更新行程' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ); 
}

function TransportView({ tripId, items, onPreviewAttachment }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const tItems = items.filter((i) => ['flight','train','bus','ship'].includes(i.type));

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setShowAdd(true);
  };

  const handleCloseModal = () => {
    setShowAdd(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><Train className="text-emerald-600" size={32}/> 交通情報</h2>
        <button onClick={() => { setEditingItem(null); setShowAdd(true); }} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg"><Plus size={20}/> 新增票券</button>
      </div>
      <div className="grid gap-4">
        {tItems.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 flex justify-between items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-600 uppercase px-2 py-0.5 bg-blue-50 rounded-full">{item.type}</span>
                {item.seat && <span className="text-xs font-bold text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-full flex items-center gap-1"><Armchair size={12}/> 座位: {item.seat}</span>}
              </div>
              <div className="font-bold text-lg text-stone-800">{item.title}</div>
              <div className="text-sm font-bold text-stone-700 mt-1 flex items-center gap-1"><ArrowRightLeft size={14} className="text-stone-400"/> {item.originDest}</div>
              <div className="text-xs text-stone-400 mt-2 flex items-center gap-1"><Clock size={12}/> {item.datetime ? item.datetime.replace('T', ' ') : ''}</div>
              
              {item.attachment && (
                <button
                  onClick={() => onPreviewAttachment && onPreviewAttachment(item.attachment)}
                  className="mt-3 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <span>🎫</span> 滿版出示車票／登機證
                </button>
              )}
            </div>
            <div className="flex flex-col items-center gap-1 ml-4">
              <button onClick={() => handleOpenEdit(item)} className="text-stone-400 hover:text-blue-600 p-2 transition-colors" title="編輯票券">
                <Pencil size={18} />
              </button>
              <button onClick={() => deleteDoc(doc(db, 'trips', tripId, 'items', item.id))} className="text-stone-200 hover:text-red-500 transition-colors p-2" title="刪除票券">
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {showAdd && <AddTransportModal tripId={tripId} initialData={editingItem} onClose={handleCloseModal} />}
    </div>
  );
}

function AddTransportModal({ tripId, initialData, onClose }) { 
  const [f, setF] = useState({ 
    title: initialData?.title || '', 
    datetime: initialData?.datetime || '', 
    type: initialData?.type || 'flight', 
    originDest: initialData?.originDest || '', 
    seat: initialData?.seat || '',
    attachment: initialData?.attachment || ''
  }); 
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const base64 = await compressImageToBase64(file);
      setF((prev) => ({ ...prev, attachment: base64 }));
    } catch (err) {
      alert("圖片讀取失敗，請重試");
    } finally {
      setUploading(false);
    }
  };

  const sub = async (e) => { 
    e.preventDefault(); 
    if (initialData?.id) {
      await updateDoc(doc(db, 'trips', tripId, 'items', initialData.id), f);
    } else {
      await addDoc(collection(db, 'trips', tripId, 'items'), { ...f, createdAt: serverTimestamp() });
    }
    onClose(); 
  }; 

  const inputClass = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-blue-500 transition-colors";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto menu-scrollbar">
        <h3 className="font-bold text-xl mb-4 text-blue-900 flex items-center gap-2">
          <Train size={24}/> {initialData ? '編輯交通票券' : '新增交通票券'}
        </h3>
        <form onSubmit={sub} className="space-y-4">
          <select className={inputClass} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="flight">機票 (Flight)</option>
            <option value="train">火車票 (Train)</option>
            <option value="bus">巴士券 (Bus)</option>
            <option value="ship">船票 (Ship)</option>
          </select>
          <input type="datetime-local" className={inputClass} value={f.datetime} onChange={(e) => setF({ ...f, datetime: e.target.value })} required />
          <input className={inputClass} placeholder="班次名稱" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} placeholder="起訖點 (例: 台北 ➜ 高雄)" value={f.originDest} onChange={(e) => setF({ ...f, originDest: e.target.value })} required />
            <input className={inputClass} placeholder="座位 (例: 8車12A)" value={f.seat} onChange={(e) => setF({ ...f, seat: e.target.value })} />
          </div>

          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
            <label className="block text-xs font-bold text-stone-700 mb-2 flex items-center gap-1.5">
              <span>🎫</span> 票券憑證截圖／QR Code (支援離線出示)
            </label>
            <div className="space-y-2">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="text-xs text-stone-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              <input 
                type="text" 
                placeholder="或直接貼上 Google Drive / PDF 網址" 
                value={(f.attachment || '').startsWith('data:image') ? '' : f.attachment} 
                onChange={(e) => setF({ ...f, attachment: e.target.value })}
                className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs"
              />
              {uploading && <p className="text-xs text-blue-500 font-bold">圖片最佳化中...</p>}
              {f.attachment && (
                <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12}/> 已成功附加憑證文件
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-stone-600">取消</button>
            <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">
              {initialData ? '更新票券' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ); 
}

function AccommodationView({ tripId, items, onPreviewAttachment }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const aItems = items.filter((i) => i.type === 'accommodation');

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setShowAdd(true);
  };

  const handleCloseModal = () => {
    setShowAdd(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3"><BedDouble className="text-emerald-600" size={32}/> 住宿登錄</h2>
        <button onClick={() => { setEditingItem(null); setShowAdd(true); }} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg"><Plus size={20}/> 新增住宿</button>
      </div>
      {aItems.map((i) => (
        <div key={i.id} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex justify-between items-center mb-4">
          <div className="flex-1">
            <div className="font-bold text-xl text-stone-800 mb-1">{i.title}</div>
            <div className="text-sm text-stone-500 mb-3 flex items-center gap-1"><MapPin size={14}/> {i.location} <a href={getGoogleMapsLink(i.location)} target="_blank" rel="noreferrer" className="ml-2 text-blue-500 font-bold hover:underline text-xs">地圖</a></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="text-xs text-stone-600">
                <strong>入住時間:</strong> {(i.checkInDatetime || `${i.checkInDate || ''} ${i.checkInTime || ''}`).replace('T', ' ') || '未定時間'}
              </div>
              <div className="text-xs text-stone-600">
                <strong>退房時間:</strong> {(i.checkOutDatetime || `${i.checkOutDate || ''} ${i.checkOutTime || ''}`).replace('T', ' ') || '未定時間'}
              </div>
              <div className="text-xs flex items-center gap-1"><strong>早餐服務:</strong> {i.hasBreakfast === '是' ? <span className="text-emerald-600 flex items-center font-bold"><Coffee size={12} className="mr-0.5"/>含早餐</span> : <span className="text-stone-400">無</span>}</div>
              <div className="text-xs flex items-center gap-1"><strong>行李寄放:</strong> {i.canStoreLuggage === '是' ? <span className="text-emerald-600 flex items-center font-bold"><Briefcase size={12} className="mr-0.5"/>可寄放</span> : <span className="text-stone-400">不可</span>}</div>
            </div>

            {i.attachment && (
              <button
                onClick={() => onPreviewAttachment && onPreviewAttachment(i.attachment)}
                className="mt-3 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <span>🎫</span> 快速出示訂房憑證 / QR Code
              </button>
            )}
          </div>
          <div className="flex flex-col items-center gap-1 ml-4">
            <button onClick={() => handleOpenEdit(i)} className="text-stone-400 hover:text-emerald-600 p-2 transition-colors" title="編輯住宿">
              <Pencil size={18} />
            </button>
            <button onClick={() => deleteDoc(doc(db, 'trips', tripId, 'items', i.id))} className="text-stone-300 hover:text-red-500 transition-colors p-2" title="刪除住宿">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}
      {showAdd && <AddAccommodationModal tripId={tripId} initialData={editingItem} onClose={handleCloseModal} />}
    </div>
  );
}

function AddAccommodationModal({ tripId, initialData, onClose }) { 
  const [f, setF] = useState({ 
    title: initialData?.title || '', 
    type: 'accommodation', 
    location: initialData?.location || '', 
    checkInDatetime: initialData?.checkInDatetime || (initialData?.checkInDate ? `${initialData.checkInDate}T${initialData.checkInTime || '15:00'}` : ''),
    checkOutDatetime: initialData?.checkOutDatetime || (initialData?.checkOutDate ? `${initialData.checkOutDate}T${initialData.checkOutTime || '11:00'}` : ''),
    hasBreakfast: initialData?.hasBreakfast || '否', 
    canStoreLuggage: initialData?.canStoreLuggage || '否',
    attachment: initialData?.attachment || ''
  }); 
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const base64 = await compressImageToBase64(file);
      setF((prev) => ({ ...prev, attachment: base64 }));
    } catch (err) {
      alert("圖片讀取失敗，請重試");
    } finally {
      setUploading(false);
    }
  };

  const sub = async (e) => { 
    e.preventDefault(); 
    if (initialData?.id) {
      await updateDoc(doc(db, 'trips', tripId, 'items', initialData.id), f);
    } else {
      await addDoc(collection(db, 'trips', tripId, 'items'), { ...f, createdAt: serverTimestamp() });
    }
    onClose(); 
  }; 

  const inputClass = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-emerald-500 transition-colors";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto menu-scrollbar">
        <h3 className="font-bold text-xl mb-4 text-emerald-900 flex items-center gap-2">
          <BedDouble size={24}/> {initialData ? '編輯住宿登錄' : '新增住宿登錄'}
        </h3>
        <form onSubmit={sub} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">住宿名稱</label>
            <input className={inputClass} placeholder="例如: 濟州島海景飯店" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">地址 (與地圖連動)</label>
            <input className={inputClass} placeholder="輸入地址或地點" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} required />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">入住時間 (年/月/日 時間)</label>
            <input 
              type="datetime-local" 
              className={inputClass} 
              value={f.checkInDatetime} 
              onChange={(e) => setF({ ...f, checkInDatetime: e.target.value })} 
              required 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">退房時間 (年/月/日 時間)</label>
            <input 
              type="datetime-local" 
              className={inputClass} 
              value={f.checkOutDatetime} 
              onChange={(e) => setF({ ...f, checkOutDatetime: e.target.value })} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">含有早餐</label>
              <select className={inputClass} value={f.hasBreakfast} onChange={(e) => setF({ ...f, hasBreakfast: e.target.value })}>
                <option value="否">否</option>
                <option value="是">是</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">行李寄放</label>
              <select className={inputClass} value={f.canStoreLuggage} onChange={(e) => setF({ ...f, canStoreLuggage: e.target.value })}>
                <option value="否">否</option>
                <option value="是">是</option>
              </select>
            </div>
          </div>

          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
            <label className="block text-xs font-bold text-stone-700 mb-2 flex items-center gap-1.5">
              <span>🎫</span> 訂房憑證截圖／Agoda/Booking 代碼 (支援離線出示)
            </label>
            <div className="space-y-2">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="text-xs text-stone-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
              />
              <input 
                type="text" 
                placeholder="或直接貼上 Google Drive / PDF 網址" 
                value={(f.attachment || '').startsWith('data:image') ? '' : f.attachment} 
                onChange={(e) => setF({ ...f, attachment: e.target.value })}
                className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs"
              />
              {uploading && <p className="text-xs text-emerald-600 font-bold">圖片最佳化中...</p>}
              {f.attachment && (
                <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12}/> 已成功附加訂房憑證
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-stone-100 rounded-xl font-bold text-stone-600">取消</button>
            <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg">
              {initialData ? '更新住宿' : '確認新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ); 
}

function ToolsView() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-stone-200 pb-4">
        <h2 className="text-3xl font-bold text-emerald-900 flex items-center gap-3">
          <Settings className="text-emerald-600" size={32}/> 日本旅遊實用會話
        </h2>
        <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-bold flex items-center gap-1">
          <Volume2 size={14}/> 點擊即可發音
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <JapanesePhrases />
      </div>
    </div>
  );
}

function JapanesePhrases() {
  const categories = { 
    "招呼 👋": {
      fullName: "常用招呼",
      icon: <Smile size={18} className="text-emerald-600"/>,
      phrases: [
        "こんにちは (你好)",
        "ありがとうございます (謝謝你)",
        "すみません (不好意思 / 借過)",
        "ごめんなさい (對不起)",
        "お願いします (麻煩您了 / 請)",
        "はい / いいえ (好的 / 不是)",
        "英語が話せますか (你會說英文嗎？)",
        "日本語がわかりません (我不太懂日語)",
        "これをお願いします (請給我這個)",
        "大丈夫です (沒關係 / 不用了)",
        "さようなら (再見)"
      ]
    },
    "餐飲 🍽️": {
      fullName: "訂位 / 餐廳 / 菜單",
      icon: <Utensils size={18} className="text-orange-600"/>,
      phrases: [
        "予約した◯◯です (我是有預約的◯◯)",
        "予約していません、◯名です (沒有預約，我們有◯位)",
        "メニューをいただけますか (請給我菜單)",
        "おすすめは何ですか (推薦的餐點是什麼？)",
        "注文をお願いします (麻煩請幫我點餐)",
        "これと同じものをください (請給我一份和這個一樣的)",
        "お水をもらえますか (可以給我杯水嗎？)",
        "牛肉は入っていますか (這裡面有牛肉嗎？)",
        "パクチーを抜いてください (請幫我不要加香菜)",
        "辛くしないでください (請不要做得太辣)",
        "ラストオーダーは何時ですか (最後加點是幾點？)",
        "持ち帰りはできますか (可以外帶嗎？)",
        "お会計をお願いします (麻煩結帳)",
        "別々に会計できますか (可以分開結帳嗎？)",
        "ごちそうさまでした (謝謝招待 / 吃飽了)"
      ]
    },
    "交通 🚗": {
      fullName: "租車 / 加油 / 問路",
      icon: <Fuel size={18} className="text-blue-600"/>,
      phrases: [
        "レンタカーの予約をしています (我有預約租車)",
        "國際免許証はこちらです (這是我的國際駕照)",
        "ETCカードをレンタルしたいです (我想租借ETC卡)",
        "カーナビを英語か中国語にできますか (導航能換成中文或英文嗎？)",
        "レギュラー満タンでお願いします (請加滿 Regular 一般汽油)",
        "軽油を満タンでお願いします (請加滿柴油)",
        "タイヤの空氣壓を點検してください (請幫我檢查胎壓)",
        "窓を拭いてもらえますか (可以幫忙擦一下車窗嗎？)",
        "ゴミを捨ててもらえますか (可以幫我倒一下垃圾嗎？)",
        "◯◯はどこですか (請問◯◯在哪裡？)",
        "ここはどこですか (請問這裡現在是哪裡？)",
        "駅へはどう行けばいいですか (請問到車站該怎麼走？)",
        "近くにトイレはありますか (這附近有洗手間嗎？)",
        "近くに駐車場はありますか (這附近有停車場嗎？)",
        "写真を撮っていただけますか (可以幫我們拍張照片嗎？)"
      ]
    },
    "購物 🛍️": {
      fullName: "試穿 / 試吃 / 結帳",
      icon: <ShoppingBag size={18} className="text-pink-600"/>,
      phrases: [
        "いくらですか (請問這個多少錢？)",
        "試着してもいいですか (請問可以試穿嗎？)",
        "これの他のサイズはありますか (這款有其他尺寸嗎？)",
        "他の色はありますか (這款有其他顏色嗎？)",
        "試食してもいいですか (請問可以試吃嗎？)",
        "香りを試してもいいですか (請問可以試聞香味嗎？)",
        "新しい在庫はありますか (請問有新的庫存嗎？)",
        "これを見せてください (請讓我看一下這個)",
        "少し考えます (我再考慮看看，謝謝)",
        "これをください (我要買這個)",
        "プレゼント用です (這是要送禮用的包裝)",
        "袋はいりません (我不需要塑膠袋)",
        "クレジットカードは使えますか (可以刷信用卡嗎？)",
        "電子マネーで払えますか (可以使用電子支付/交通卡嗎？)",
        "領収書をお願いします (請開收據發票)"
      ]
    },
    "機場 ✈️": {
      fullName: "出入境 / 退稅相關",
      icon: <Compass size={18} className="text-teal-600"/>,
      phrases: [
        "免税手続きをお願いします (麻煩請幫我辦理免稅手續)",
        "免税カウンターはどこですか (請問免稅櫃台在哪裡？)",
        "パスポートを持っています (我有隨身攜帶護照)",
        "観光で来ました (我是來觀光旅遊的)",
        "◯日間滞在します (我預計停留◯天)",
        "◯◯ホテルに泊まります (我會住在◯◯飯店)",
        "搭乗口は何番ですか (請問登機門是幾號？)",
        "受託手荷物は何キロまでですか (請問托運行李限重幾公斤？)",
        "荷物を預けたいです (我想要辦理行李托運)",
        "壊れ物が入っています (行李箱裡面有易碎品)",
        "手荷物受取所はどこですか (行李領取處在哪裡？)",
        "荷物が出てきません (我的行李一直沒有出來)",
        "リムジンバス乗り場はどこですか (請問利木津巴士搭車處在哪？)",
        "税関申告書はこちらです (這是我的海關申報單)",
        "日本円に両替できますか (這裡可以兌換日幣現金嗎？)"
      ]
    }
  };

  const [activeCategory, setActiveCategory] = useState("招呼 👋");

  return (
    <div className="space-y-6 pb-8">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {Object.entries(categories).map(([shortKey, catData]) => (
          <button
            key={shortKey}
            type="button"
            onClick={() => setActiveCategory(shortKey)}
            className={`py-3 px-2 rounded-2xl font-bold text-xs transition-all flex flex-col items-center justify-center gap-1 border ${
              activeCategory === shortKey 
                ? 'bg-emerald-600 text-white shadow-md border-emerald-600' 
                : 'bg-white text-stone-700 hover:bg-stone-50 border-stone-200'
            }`}
          >
            <span className="text-base">{shortKey.split(' ')[1]}</span>
            <span className="truncate">{shortKey.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg text-emerald-900 flex items-center gap-2">
            {categories[activeCategory]?.icon}
            {categories[activeCategory]?.fullName}
          </h3>
          <span className="text-xs bg-stone-100 text-stone-500 font-bold px-2.5 py-1 rounded-full">
            共 {categories[activeCategory]?.phrases.length} 句
          </span>
        </div>

        <div className="space-y-2.5">
          {categories[activeCategory]?.phrases.map((p, idx) => {
            const [jp, cn] = p.split(' (');
            return (
              <div 
                key={idx} 
                onClick={() => playGoogleAudio(jp)}
                className="flex justify-between items-center bg-stone-50 hover:bg-emerald-50 p-3.5 rounded-2xl border border-stone-100 transition-colors cursor-pointer group"
              >
                <div>
                  <div className="font-bold text-stone-800 text-base group-hover:text-emerald-900 transition-colors">{jp}</div>
                  <div className="text-xs text-stone-500 group-hover:text-emerald-700 mt-0.5">{cn ? cn.replace(')', '') : ''}</div>
                </div>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); playGoogleAudio(jp); }}
                  className="p-2.5 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all"
                  title="播放語音"
                >
                  <Volume2 size={20} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExpenseView({ tripId, expenses, members }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [reportMode, setReportMode] = useState(false);

  const rates = { JPY: 0.22, USD: 32, EUR: 35, KRW: 0.024, THB: 0.9, TWD: 1 };

  const totalTWD = expenses.reduce((sum, item) => {
    return sum + (Number(item.amount) * (rates[item.currency] || 1));
  }, 0);

  const settlementData = useMemo(() => {
    const balances = {};

    expenses.forEach((exp) => {
      const rate = rates[exp.currency] || 1;
      const amountTWD = Number(exp.amount) * rate;
      const payer = exp.payer || '未具名';

      balances[payer] = (balances[payer] || 0) + amountTWD;

      if (exp.splitDetails && exp.splitDetails.length > 0) {
        exp.splitDetails.forEach((detail) => {
          const person = detail.name || '未具名';
          const splitAmountTWD = Number(detail.amount) * rate;
          balances[person] = (balances[person] || 0) - splitAmountTWD;
        });
      }
    });

    let debtors = [];
    let creditors = [];

    Object.entries(balances).forEach(([name, bal]) => {
      const roundBal = Math.round(bal);
      if (roundBal < -1) {
        debtors.push({ name, amount: -roundBal });
      } else if (roundBal > 1) {
        creditors.push({ name, amount: roundBal });
      }
    });

    const transfers = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      const settleAmount = Math.min(debtor.amount, creditor.amount);

      transfers.push({
        from: debtor.name,
        to: creditor.name,
        amount: settleAmount
      });

      debtor.amount -= settleAmount;
      creditor.amount -= settleAmount;

      if (debtor.amount <= 1) dIdx++;
      if (creditor.amount <= 1) cIdx++;
    }

    return { balances, transfers };
  }, [expenses]);

  const handleOpenEdit = (exp) => {
    setEditingExpense(exp);
    setShowAdd(true);
  };

  const handleCloseModal = () => {
    setShowAdd(false);
    setEditingExpense(null);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-8 flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-emerald-900 flex gap-2 items-center"><Wallet className="text-emerald-600" size={32}/> 記帳分帳</h2>
          <div className="mt-2 text-stone-500 font-bold text-2xl flex items-baseline gap-1">
            <span className="text-sm font-medium">總支出約</span> NT$ {Math.round(totalTWD).toLocaleString()}
          </div>
          <div className="flex mt-2 bg-white p-1 rounded-2xl border border-stone-200 shadow-sm w-fit">
            <button 
              type="button"
              onClick={() => setReportMode(false)}
              className={`px-3 py-1 rounded-xl font-bold text-xs transition ${!reportMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-500'}`}
            >
              支出明細
            </button>
            <button 
              type="button"
              onClick={() => setReportMode(true)}
              className={`px-3 py-1 rounded-xl font-bold text-xs transition flex items-center gap-1 ${reportMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-500'}`}
            >
              <Calculator size={14}/> 智慧結算報表
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowMembersModal(true)} 
            className="bg-stone-800 hover:bg-stone-900 text-white px-4 py-3 rounded-2xl flex items-center gap-1.5 font-bold shadow-md transition"
          >
            <Users size={18}/> 誰來付錢
          </button>
          <button 
            onClick={() => { setEditingExpense(null); setShowAdd(true); }} 
            className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg hover:bg-emerald-700"
          >
            <Plus size={20} /> 新增支出
          </button>
        </div>
      </div>

      {reportMode ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="font-bold text-emerald-900 text-lg flex items-center gap-2">
              <UserCheck size={20} className="text-emerald-600"/> 成員收支總覽 (折合台幣)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.keys(settlementData.balances).length === 0 ? (
                <div className="text-stone-400 text-xs col-span-2 py-4 text-center">尚無支出紀錄可結算</div>
              ) : Object.entries(settlementData.balances).map(([name, bal]) => (
                <div key={name} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex justify-between items-center">
                  <span className="font-bold text-stone-800">{name}</span>
                  <div className="text-right">
                    <span className={`text-sm font-bold font-mono ${bal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {bal >= 0 ? `應收 NT$ ${Math.round(bal).toLocaleString()}` : `應付 NT$ ${Math.abs(Math.round(bal)).toLocaleString()}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-md space-y-4">
            <h3 className="font-bold text-emerald-900 text-lg flex items-center gap-2">
              <Calculator size={20} className="text-emerald-600"/> 最佳化轉帳結算建議 (最少次數)
            </h3>
            <div className="space-y-3">
              {settlementData.transfers.length === 0 ? (
                <div className="p-6 bg-emerald-50 rounded-2xl text-emerald-800 text-xs font-bold text-center">
                  🎉 目前帳目完全平衡，無需任何轉帳！
                </div>
              ) : settlementData.transfers.map((t, idx) => (
                <div key={idx} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-stone-800 font-bold">
                    <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-lg text-xs">{t.from}</span>
                    <ArrowRight size={16} className="text-stone-400"/>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg text-xs">{t.to}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 text-base">
                    NT$ {t.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 divide-y divide-stone-100 overflow-hidden">
          {expenses.length === 0 ? <div className="p-10 text-center text-stone-400">尚無紀錄</div> : expenses.map((exp) => (
            <div key={exp.id} className="p-5 flex flex-col hover:bg-stone-50 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <div className="flex-1">
                  <h4 className="font-bold text-stone-800 text-lg">{exp.title}</h4>
                  <div className="text-xs text-stone-500 mt-1">
                    <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold">{exp.payer} 付款</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div className="font-mono font-bold text-stone-800 text-lg">{exp.currency} {Number(exp.amount).toLocaleString()}</div>
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={() => handleOpenEdit(exp)} className="text-stone-400 hover:text-emerald-600 p-1.5 transition-colors" title="編輯支出">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => deleteDoc(doc(db, 'trips', tripId, 'expenses', exp.id))} className="text-stone-200 hover:text-red-500 transition-colors p-1.5" title="刪除支出">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                <div className="text-xs font-bold text-stone-400 mb-1 flex items-center gap-1 uppercase tracking-wider"><Users size={12}/> 分攤明細 ({exp.splitMode === 'average' ? '自動平均' : '手動分攤'})</div>
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
      )}

      {showAdd && <AddExpenseModal tripId={tripId} initialData={editingExpense} members={members} onClose={handleCloseModal} />}
      {showMembersModal && <MembersManagementModal tripId={tripId} members={members} onClose={() => setShowMembersModal(false)} />}
    </div>
  );
}

function MembersManagementModal({ tripId, members, onClose }) {
  const [newMemberName, setNewMemberName] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    await addDoc(collection(db, 'trips', tripId, 'members'), {
      name: newMemberName.trim(),
      createdAt: serverTimestamp()
    });
    setNewMemberName('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <h3 className="font-bold text-xl text-stone-900 flex items-center gap-2">
          <Users size={24} className="text-emerald-600"/> 誰來付錢（旅程成員設定）
        </h3>
        <p className="text-xs text-stone-500">
          在此輸入本次旅行的夥伴名稱或綽號，記帳時即可直接從選單挑選付款人與分攤成員！
        </p>

        <form onSubmit={handleAdd} className="flex gap-2">
          <input 
            type="text" 
            value={newMemberName} 
            onChange={(e) => setNewMemberName(e.target.value)} 
            placeholder="成員姓名或綽號 (例: 小美、阿強)" 
            className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-emerald-500 text-sm"
          />
          <button type="submit" className="bg-stone-900 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-stone-800">
            新增
          </button>
        </form>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 menu-scrollbar">
          {members.length === 0 ? (
            <div className="text-center py-6 text-stone-300 text-xs font-bold">尚無成員名單，快在上方新增吧！</div>
          ) : members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="font-bold text-stone-800 text-sm">{m.name}</span>
              <button 
                type="button" 
                onClick={() => deleteDoc(doc(db, 'trips', tripId, 'members', m.id))}
                className="text-stone-300 hover:text-red-500 p-1 transition-colors"
              >
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
        </div>

        <button 
          type="button" 
          onClick={onClose} 
          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 transition mt-2"
        >
          完成設定
        </button>
      </div>
    </div>
  );
}

function AddExpenseModal({ tripId, initialData, members, onClose }) {
  const defaultCurrency = useMemo(() => detectCurrency(tripId), [tripId]);
  const [f, setF] = useState({
    title: initialData?.title || '',
    amount: initialData?.amount || '',
    payer: initialData?.payer || (members[0]?.name || ''),
    currency: initialData?.currency || defaultCurrency
  });
  const [splitMode, setSplitMode] = useState(initialData?.splitMode || 'average');
  const [numPeople, setNumPeople] = useState(initialData?.splitMode === 'average' && initialData?.splitDetails ? initialData.splitDetails.length : (members.length || 2));
  const [manualSplits, setManualSplits] = useState(
    initialData?.splitMode === 'manual' && initialData?.splitDetails 
      ? initialData.splitDetails 
      : [{ name: '', amount: '' }]
  );

  const handleAddPerson = (name = '') => setManualSplits([...manualSplits, { name, amount: '' }]);
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
      if (members.length >= numPeople) {
        for (let i = 0; i < numPeople; i++) {
          finalSplitDetails.push({ name: members[i]?.name || `成員 ${i + 1}`, amount: perPerson });
        }
      } else {
        for (let i = 1; i <= numPeople; i++) {
          finalSplitDetails.push({ name: members[i - 1]?.name || `成員 ${i}`, amount: perPerson });
        }
      }
    } else {
      finalSplitDetails = manualSplits.map((s) => ({ name: s.name || '未具名', amount: Number(s.amount) || 0 }));
    }

    const payload = {
      ...f,
      splitMode,
      splitDetails: finalSplitDetails
    };

    if (initialData?.id) {
      await updateDoc(doc(db, 'trips', tripId, 'expenses', initialData.id), payload);
    } else {
      await addDoc(collection(db, 'trips', tripId, 'expenses'), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }
    onClose();
  };

  const inputStyle = "w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-emerald-500 transition-colors";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <h3 className="font-bold text-xl mb-4 text-emerald-900 flex items-center gap-2">
          <CreditCard size={24}/> {initialData ? '編輯支出與分攤' : '新增支出與分攤'}
        </h3>
        <form onSubmit={sub} className="space-y-4 overflow-y-auto menu-scrollbar pr-1">
          <div><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">項目名稱</label><input type="text" required placeholder="例如: 飯店餐費、門票" className={inputStyle} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })}/></div>
          <div className="flex gap-2">
            <div className="w-1/3"><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">幣別</label><select className={inputStyle} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}><option value="TWD">TWD</option><option value="JPY">JPY</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="KRW">KRW</option><option value="THB">THB</option></select></div>
            <div className="w-2/3"><label className="block text-xs font-bold text-stone-500 mb-1 ml-1">總金額</label><input type="number" required placeholder="0" className={inputStyle} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })}/></div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 mb-1 ml-1">付款人</label>
            {members && members.length > 0 ? (
              <select 
                className={inputStyle} 
                value={f.payer} 
                onChange={(e) => setF({ ...f, payer: e.target.value })}
                required
              >
                {members.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            ) : (
              <input 
                type="text" 
                required 
                placeholder="誰先付的錢？(可點選上方「誰來付錢」新增常駐名單)" 
                className={inputStyle} 
                value={f.payer} 
                onChange={(e) => setF({ ...f, payer: e.target.value })}
              />
            )}
          </div>

          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
            <div className="flex gap-2 mb-4 p-1 bg-white rounded-xl border border-stone-200">
              <button type="button" onClick={() => setSplitMode('average')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${splitMode === 'average' ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-400'}`}>自動平均</button>
              <button type="button" onClick={() => setSplitMode('manual')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${splitMode === 'manual' ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-400'}`}>手動分攤</button>
            </div>
            {splitMode === 'average' ? (
              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-2 ml-1">分攤人數</label>
                <input type="number" min="1" className={inputStyle} value={numPeople} onChange={(e) => setNumPeople(Number(e.target.value))}/><div className="mt-2 text-right text-sm font-bold text-emerald-600">每人應付約 {f.currency} {f.amount && numPeople ? Math.round(f.amount / numPeople).toLocaleString() : 0}</div></div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center"><label className="block text-xs font-bold text-emerald-800 ml-1">分攤名單</label><button type="button" onClick={() => handleAddPerson()} className="text-emerald-600 text-[10px] font-bold">+ 新增成員</button></div>
                <div className="space-y-2 max-h-40 overflow-y-auto">{manualSplits.map((s, i) => (<div key={i} className="flex gap-2">{members.length > 0 ? (<select className="w-1/2 p-2 bg-white border rounded-lg text-sm" value={s.name} onChange={(e) => updateManualSplit(i, 'name', e.target.value)}><option value="">選擇成員</option>{members.map(m => (<option key={m.id} value={m.name}>{m.name}</option>))}</select>) : (<input type="text" placeholder="人名" className="w-1/2 p-2 bg-white border rounded-lg text-sm" value={s.name} onChange={(e) => updateManualSplit(i, 'name', e.target.value)}/>)}<input type="number" placeholder="金額" className="w-1/3 p-2 bg-white border rounded-lg text-sm font-mono" value={s.amount} onChange={(e) => updateManualSplit(i, 'amount', e.target.value)}/><button type="button" onClick={() => handleRemovePerson(i)} className="text-stone-300 hover:text-red-500"><UserMinus size={16}/></button></div>))}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-stone-100 rounded-xl font-bold text-stone-600">取消</button>
            <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg">
              {initialData ? '更新分攤' : '儲存分攤'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
