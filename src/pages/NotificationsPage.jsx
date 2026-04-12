// src/pages/NotificationsPage.jsx — mobile layout fixed
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Heart, MessageCircle, AtSign, UserPlus, UserCheck, Calendar, ClipboardList, CheckCheck, Share2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const NOTIF_CONFIG = {
  reaction:       { icon: Heart,         color: 'text-red-600 bg-red-100',        label: 'Reaction' },
  comment:        { icon: MessageCircle, color: 'text-green-600 bg-green-100',     label: 'Comment' },
  mention:        { icon: AtSign,        color: 'text-amber-600 bg-amber-100',     label: 'Mention' },
  friend_request: { icon: UserPlus,      color: 'text-primary-600 bg-primary-100', label: 'Friend Request' },
  friend_accept:  { icon: UserCheck,     color: 'text-emerald-600 bg-emerald-100', label: 'Friend Accept' },
  event:          { icon: Calendar,      color: 'text-purple-600 bg-purple-100',   label: 'Event' },
  notice:         { icon: ClipboardList, color: 'text-orange-600 bg-orange-100',   label: 'Notice' },
  share:          { icon: Share2,        color: 'text-blue-600 bg-blue-100',       label: 'Share' },
};

const FILTER_TYPES = [
  { key: 'all',            label: 'All' },
  { key: 'reaction',       label: '❤️ Reactions' },
  { key: 'comment',        label: '💬 Comments' },
  { key: 'mention',        label: '@ Mentions' },
  { key: 'friend_request', label: '👥 Requests' },
  { key: 'event',          label: '📅 Events' },
  { key: 'notice',         label: '📢 Notices' },
];

export default function NotificationsPage() {
  const { userProfile } = useAuth();
  const navigate        = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filterType,    setFilterType]    = useState('all');

  useEffect(() => {
    if (!userProfile) return;
    const q = query(
      collection(db, 'notifications'),
      where('toUid', '==', userProfile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [userProfile]);

  const markRead = async (notif) => {
    if (!notif.read) {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    }
    if (notif.type === 'friend_request' || notif.type === 'friend_accept') navigate('/friends');
    else if (notif.type === 'event')  navigate('/events');
    else if (notif.type === 'notice') navigate('/notices');
    else if (notif.refId)             navigate('/');
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (!unread.length) return toast('All already read');
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
    toast.success('All marked as read');
  };

  const filtered = filterType === 'all'
    ? notifications
    : notifications.filter(n => n.type === filterType);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    // overflow-hidden stops any child from creating horizontal scroll on mobile
    <div className="space-y-4 pb-20 md:pb-4 overflow-hidden">

      {/* ── Header — wraps gracefully on small screens ─── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-header mb-0">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-primary-600">({unreadCount})</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 bg-primary-50 px-3 py-1.5 rounded-xl border border-primary-200 hover:bg-primary-100 transition-all flex-shrink-0">
            <CheckCheck size={13}/> Mark all read
          </button>
        )}
      </div>

      {/* ── Filter pills — contained scroll, no page bleed ── */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-1.5" style={{ width: 'max-content', minWidth: '100%' }}>
          {FILTER_TYPES.map(ft => (
            <button key={ft.key} onClick={() => setFilterType(ft.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filterType === ft.key
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-500 hover:bg-primary-50 border border-surface-200'
              }`}>
              {ft.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notification list ─────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="card h-16 animate-pulse bg-surface-100"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Bell size={32} className="mx-auto mb-2 opacity-40"/>
          <p className="text-sm font-medium">
            {filterType === 'all' ? 'No notifications yet' : `No ${filterType} notifications`}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(notif => {
            const config = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.reaction;
            const Icon   = config.icon;
            return (
              <button key={notif.id} onClick={() => markRead(notif)}
                className={`w-full card text-left flex items-start gap-3 hover:shadow-md transition-all cursor-pointer overflow-hidden ${
                  !notif.read ? 'bg-primary-50 border-primary-100' : ''
                }`}>
                {/* Icon badge — never shrinks */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                  <Icon size={16}/>
                </div>
                {/* Text — clips to available width */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className={`text-sm leading-snug break-words ${!notif.read ? 'font-semibold' : ''}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {notif.createdAt?.toDate
                      ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true })
                      : 'Just now'}
                  </p>
                </div>
                {/* Unread dot */}
                {!notif.read && (
                  <span className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-2"/>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
