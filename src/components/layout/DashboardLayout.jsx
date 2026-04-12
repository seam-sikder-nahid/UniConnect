// src/components/layout/DashboardLayout.jsx
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Home, MessageCircle, Calendar, Users, ShoppingBag, Bell, ClipboardList, LogOut, UserPlus, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import UserAvatar from '../ui/UserAvatar';

const navItems = [
  { path:'/',             icon:Home,          label:'Feed' },
  { path:'/messages',     icon:MessageCircle, label:'Messages' },
  { path:'/friends',      icon:UserPlus,      label:'Friends' },
  { path:'/events',       icon:Calendar,      label:'Events' },
  { path:'/clubs',        icon:Users,         label:'Clubs' },
  { path:'/marketplace',  icon:ShoppingBag,   label:'Marketplace' },
  { path:'/notices',      icon:ClipboardList, label:'Notice Board' },
  { path:'/notifications',icon:Bell,          label:'Notifications' },
];

export default function DashboardLayout() {
  const { userProfile, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadNotifs,   setUnreadNotifs]   = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingRequests,setPendingRequests]= useState(0);

  useEffect(() => {
    if (!userProfile) return;
    // unread notifications (no message type)
    const nq = query(collection(db,'notifications'),
      where('toUid','==',userProfile.uid), where('read','==',false));
    const u1 = onSnapshot(nq, s => setUnreadNotifs(s.size));
    // unread messages via conversations unread map
    const cq = query(collection(db,'conversations'), where('members','array-contains',userProfile.uid));
    const u2 = onSnapshot(cq, s => {
      let cnt = 0;
      s.docs.forEach(d => { cnt += d.data().unread?.[userProfile.uid] || 0; });
      setUnreadMessages(cnt);
    });
    // pending friend requests
    const fq = query(collection(db,'friendRequests'),
      where('toUid','==',userProfile.uid), where('status','==','pending'));
    const u3 = onSnapshot(fq, s => setPendingRequests(s.size));
    return () => { u1(); u2(); u3(); };
  }, [userProfile]);

  const go = (path) => { navigate(path); setMobileOpen(false); };
  const isActive = (p) => p==='/' ? location.pathname==='/' : location.pathname.startsWith(p);
  const handleLogout = async () => { await logout(); navigate('/auth'); };

  const getBadge = (label) => {
    if (label==='Notifications' && unreadNotifs>0)   return unreadNotifs;
    if (label==='Messages'      && unreadMessages>0) return unreadMessages;
    if (label==='Friends'       && pendingRequests>0)return pendingRequests;
    return 0;
  };

  return (
    <div className="min-h-screen flex bg-surface-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-surface-200 fixed h-full z-20 shadow-sm">
        <div className="p-4 border-b border-surface-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-display font-bold">U</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-surface-900 text-base leading-tight">UniConnect</h1>
              <p className="text-[10px] text-gray-400">Uttara University</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({path, icon:Icon, label}) => {
            const badge = getBadge(label);
            return (
              <button key={path} onClick={()=>go(path)}
                className={`nav-link w-full relative ${isActive(path)?'active':''}`}>
                <Icon size={18}/><span>{label}</span>
                {badge>0 && <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">{badge>9?'9+':badge}</span>}
              </button>
            );
          })}
        </nav>
        {userProfile && (
          <div className="p-3 border-t border-surface-200">
            <button onClick={()=>navigate(`/profile/${userProfile.uid}`)}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-surface-100 transition-all">
              <UserAvatar user={userProfile} size="sm"/>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-surface-900 truncate">{userProfile.fullName}</p>
                <p className="text-[10px] text-gray-400">{userProfile.role==='authority'?userProfile.position:`Batch ${userProfile.batch}`}</p>
              </div>
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl mt-1 text-sm font-medium transition-all">
              <LogOut size={15}/> Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-surface-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-display font-bold text-sm">U</span>
          </div>
          <span className="font-display font-bold text-surface-900">UniConnect</span>
        </div>
        <div className="flex items-center gap-3">
          {unreadNotifs>0 && (
            <button onClick={()=>navigate('/notifications')} className="relative">
              <Bell size={20} className="text-gray-600"/>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">{unreadNotifs}</span>
            </button>
          )}
          <button onClick={()=>setMobileOpen(p=>!p)} className="p-1.5 rounded-lg hover:bg-surface-100">
            {mobileOpen?<X size={20}/>:<Menu size={20}/>}
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/50" onClick={()=>setMobileOpen(false)}>
          <div className="absolute top-0 right-0 h-full w-64 bg-white shadow-2xl p-4 pt-16" onClick={e=>e.stopPropagation()}>
            {userProfile && (
              <div className="flex items-center gap-2.5 p-2 mb-3 bg-surface-50 rounded-xl">
                <UserAvatar user={userProfile} size="sm"/>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{userProfile.fullName}</p>
                  <p className="text-xs text-gray-400">{userProfile.department}</p>
                </div>
              </div>
            )}
            {navItems.map(({path, icon:Icon, label}) => {
              const badge = getBadge(label);
              return (
                <button key={path} onClick={()=>go(path)} className={`nav-link w-full mb-0.5 ${isActive(path)?'active':''}`}>
                  <Icon size={17}/>{label}
                  {badge>0 && <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">{badge>9?'9+':badge}</span>}
                </button>
              );
            })}
            <div className="mt-3 border-t border-surface-200 pt-3">
              <button onClick={handleLogout} className="nav-link w-full text-red-500 hover:bg-red-50 hover:text-red-600">
                <LogOut size={17}/> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0">
        <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6">
          <Outlet/>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-surface-200 z-20 pb-safe">
        <div className="flex">
          {[
            {path:'/',            icon:Home},
            {path:'/messages',    icon:MessageCircle, badge:unreadMessages},
            {path:'/friends',     icon:UserPlus,      badge:pendingRequests},
            {path:'/events',      icon:Calendar},
            {path:'/marketplace', icon:ShoppingBag},
          ].map(({path, icon:Icon, badge}) => (
            <button key={path} onClick={()=>navigate(path)}
              className={`flex-1 flex flex-col items-center py-2 relative transition-colors ${isActive(path)?'text-primary-600':'text-gray-400'}`}>
              <Icon size={20}/>
              {badge>0 && <span className="absolute top-1 right-3 bg-primary-600 text-white text-[9px] font-bold min-w-[14px] h-3.5 rounded-full flex items-center justify-center px-0.5">{badge}</span>}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
