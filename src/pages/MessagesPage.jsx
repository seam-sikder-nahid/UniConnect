// src/pages/MessagesPage.jsx
// Fixes: unread count, instant scroll, reply system, seen status
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, addDoc, orderBy, limit,
  serverTimestamp, updateDoc, doc, getDoc, arrayUnion, startAfter,
  getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage } from '../utils/cloudinary';
import { useAuth } from '../contexts/AuthContext';
import { useAllUsers } from '../contexts/UsersContext';
import { usePresence } from '../contexts/PresenceContext';
import {
  Search, Send, ArrowLeft, Plus, Users, X,
  Image, UserPlus, LogOut as LeaveIcon, Camera, Smile, Reply, CheckCheck, Check,
} from 'lucide-react';
import UserAvatar from '../components/ui/UserAvatar';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const MSG_PAGE_SIZE = 25;

// ── Emoji Picker ─────────────────────────────────────────────
const EMOJI_LIST = [
  '😀','😂','😍','😭','😡','👍','👎','❤️','🔥','🎉',
  '😊','😢','😮','😎','🤔','👏','🙏','💯','✅','❌',
  '😴','🤣','😏','😅','🥳','💪','🫡','👋','🤝','💬',
];
function EmojiPicker({ onPick, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute bottom-full mb-2 left-0 bg-white rounded-2xl shadow-xl border border-surface-200 p-2 z-30 w-64">
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJI_LIST.map(e => (
          <button key={e} onClick={() => onPick(e)}
            className="w-7 h-7 flex items-center justify-center text-lg hover:bg-surface-100 rounded-lg transition-colors">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Active Status Badge ───────────────────────────────────────
function ActiveBadge({ uid, presence }) {
  const p = presence?.[uid];
  if (!p) return null;
  if (p.isActive) return (
    <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"/>Active
    </span>
  );
  if (p.lastActive?.toDate) return (
    <span className="text-[10px] text-gray-400">
      Last seen {formatDistanceToNow(p.lastActive.toDate(), { addSuffix: true })}
    </span>
  );
  return null;
}

// ── Reply Preview Bar (shown above input when replying) ───────
function ReplyPreview({ replyTo, onCancel }) {
  if (!replyTo) return null;
  return (
    <div className="mx-3 mb-0 bg-primary-50 border-l-4 border-primary-500 rounded-xl px-3 py-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-primary-600 mb-0.5">
          Replying to {replyTo.senderName}
        </p>
        <p className="text-xs text-gray-600 truncate">
          {replyTo.imageURL ? '📷 Image' : replyTo.text}
        </p>
      </div>
      <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
        <X size={14}/>
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function MessagesPage() {
  const { conversationId } = useParams();
  const { userProfile }    = useAuth();
  const navigate           = useNavigate();
  const allUsers           = useAllUsers();
  const presence           = usePresence();

  const [conversations,   setConversations]   = useState([]);
  const [activeConv,      setActiveConv]      = useState(null);
  const [messages,        setMessages]        = useState([]);
  const [messageText,     setMessageText]     = useState('');
  const [searchUser,      setSearchUser]      = useState('');
  const [showNewChat,     setShowNewChat]     = useState(false);
  const [showGroupModal,  setShowGroupModal]  = useState(false);
  const [showGroupInfo,   setShowGroupInfo]   = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [groupName,       setGroupName]       = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [uploadingImg,    setUploadingImg]    = useState(false);
  const [loadingOlder,    setLoadingOlder]    = useState(false);
  const [hasOlder,        setHasOlder]        = useState(false);
  const [oldestDoc,       setOldestDoc]       = useState(null);
  // Reply state
  const [replyTo,         setReplyTo]         = useState(null);
  // Track which message row shows the action button
  const [hoveredMsg,      setHoveredMsg]      = useState(null);

  const messagesContainerRef = useRef(null);
  const messagesEndRef       = useRef(null);
  const prevScrollHeight     = useRef(0);
  const isInitialLoad        = useRef(true);
  const activeConvIdRef      = useRef(null); // track conv id to detect real changes



  // ── Conversations list ────────────────────────────────────
  useEffect(() => {
    if (!userProfile) return;
    const q = query(collection(db, 'conversations'), where('members', 'array-contains', userProfile.uid));
    const unsub = onSnapshot(q, snap => {
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      convs.sort((a, b) => (b.lastMessageAt?.seconds || 0) - (a.lastMessageAt?.seconds || 0));
      setConversations(convs);
    });
    return unsub;
  }, [userProfile]);

  // ── Resolve active conversation from URL ─────────────────
  useEffect(() => {
    if (!conversationId) return;
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) setActiveConv(conv);
    else getDoc(doc(db, 'conversations', conversationId)).then(d => {
      if (d.exists()) setActiveConv({ id: d.id, ...d.data() });
    });
  }, [conversationId, conversations]);

  // ── Mark all incoming messages as seen when chat is open ─
  const markConversationSeen = useCallback(async (convId) => {
    if (!convId || !userProfile) return;
    try {
      // Reset unread counter for this user
      await updateDoc(doc(db, 'conversations', convId), {
        [`unread.${userProfile.uid}`]: 0,
      });

      // Fetch ALL unseen messages in this conversation (simple single-field query)
      // Then filter client-side for messages NOT sent by current user.
      // This avoids the compound index requirement for != + ==
      const unreadSnap = await getDocs(
        query(
          collection(db, 'conversations', convId, 'messages'),
          where('seen', '==', false)
        )
      );
      if (unreadSnap.empty) return;

      // Only mark messages from OTHER users as seen
      const toMark = unreadSnap.docs.filter(d => d.data().senderUid !== userProfile.uid);
      if (!toMark.length) return;

      const batch = writeBatch(db);
      toMark.forEach(d => batch.update(d.ref, {
        seen:  true,
        seenBy: arrayUnion(userProfile.uid),
      }));
      await batch.commit();
    } catch (err) {
      // Log but never throw — must not break the message listener
      console.warn('markConversationSeen:', err.message);
    }
  }, [userProfile]);

  // ── Load messages for active conversation ────────────────
  // FIX #2: use scrollTop = scrollHeight for guaranteed instant bottom
  useEffect(() => {
    if (!activeConv?.id) return;

    const isNewConv = activeConvIdRef.current !== activeConv.id;
    if (isNewConv) {
      activeConvIdRef.current = activeConv.id;
      isInitialLoad.current   = true;
      setMessages([]);
      setHasOlder(false);
      setOldestDoc(null);
      setReplyTo(null);
    }

    // Load latest MSG_PAGE_SIZE messages, desc order, then reverse for display
    const q = query(
      collection(db, 'conversations', activeConv.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(MSG_PAGE_SIZE)
    );

    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs;
      const msgs = [...docs].reverse().map(d => ({ id: d.id, ...d.data() }));

      setMessages(msgs);
      setHasOlder(docs.length === MSG_PAGE_SIZE);
      if (docs.length > 0) setOldestDoc(docs[docs.length - 1]);

      if (isInitialLoad.current) {
        // Double rAF guarantees DOM has painted before we measure
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const c = messagesContainerRef.current;
          if (c) c.scrollTop = c.scrollHeight;
        }));
        isInitialLoad.current = false;
        // Mark seen only ONCE when chat opens — not on every new message snapshot
        markConversationSeen(activeConv.id);
      } else {
        // On subsequent updates (new messages arriving): only scroll if near bottom
        const c = messagesContainerRef.current;
        if (c) {
          const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 120;
          if (nearBottom) {
            requestAnimationFrame(() => { if (c) c.scrollTop = c.scrollHeight; });
          }
        }
        // Mark the newly arrived message as seen if we are in this chat
        // (only fires if sender is someone else — avoids marking own messages)
        const newUnseen = docs.filter(d =>
          d.data().senderUid !== userProfile.uid && !d.data().seen
        );
        if (newUnseen.length > 0) markConversationSeen(activeConv.id);
      }
    });

    return unsub;
  }, [activeConv?.id, markConversationSeen]);

  // ── Load older messages on scroll-to-top ─────────────────
  const loadOlderMessages = useCallback(async () => {
    if (!activeConv || !hasOlder || loadingOlder || !oldestDoc) return;
    setLoadingOlder(true);
    prevScrollHeight.current = messagesContainerRef.current?.scrollHeight || 0;
    try {
      const q = query(
        collection(db, 'conversations', activeConv.id, 'messages'),
        orderBy('createdAt', 'desc'),
        startAfter(oldestDoc),
        limit(MSG_PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const older = [...snap.docs].reverse().map(d => ({ id: d.id, ...d.data() }));
      setMessages(prev => [...older, ...prev]);
      setHasOlder(snap.docs.length === MSG_PAGE_SIZE);
      if (snap.docs.length > 0) setOldestDoc(snap.docs[snap.docs.length - 1]);
      requestAnimationFrame(() => {
        const c = messagesContainerRef.current;
        if (c) c.scrollTop = c.scrollHeight - prevScrollHeight.current;
      });
    } catch (e) {
      console.error('loadOlderMessages:', e);
    } finally {
      setLoadingOlder(false);
    }
  }, [activeConv, hasOlder, loadingOlder, oldestDoc]);

  const handleScroll = useCallback(() => {
    const c = messagesContainerRef.current;
    if (!c) return;
    if (c.scrollTop < 60 && hasOlder && !loadingOlder) loadOlderMessages();
  }, [hasOlder, loadingOlder, loadOlderMessages]);

  // ── Send message ─────────────────────────────────────────
  const sendMessage = async (text = '', imgURL = '') => {
    const content = text || messageText.trim();
    if (!content && !imgURL) return;
    if (!activeConv) return;
    if (!imgURL) setMessageText('');

    const msgData = {
      text:       content,
      imageURL:   imgURL || '',
      senderUid:  userProfile.uid,
      senderName: userProfile.fullName,
      createdAt:  serverTimestamp(),
      // Sender's own message is always seen — never counts as unread for them
      seen:       true,
      seenBy:     [userProfile.uid],
    };

    // Attach reply reference if replying
    if (replyTo) {
      msgData.replyToId     = replyTo.id;
      msgData.replyToText   = replyTo.imageURL ? '📷 Image' : (replyTo.text || '');
      msgData.replyToSender = replyTo.senderName;
    }
    setReplyTo(null);

    try {
      await addDoc(collection(db, 'conversations', activeConv.id, 'messages'), msgData);

      // Use Firestore increment() to avoid race conditions with stale state
      const { increment } = await import('firebase/firestore');
      const unreadUpdates = {};
      activeConv.members.forEach(uid => {
        if (uid !== userProfile.uid) {
          unreadUpdates[`unread.${uid}`] = increment(1);
        }
      });
      await updateDoc(doc(db, 'conversations', activeConv.id), {
        lastMessage:       imgURL ? '📷 Image' : content,
        lastMessageAt:     serverTimestamp(),
        lastMessageSender: userProfile.uid,
        ...unreadUpdates,
      });
    } catch (err) {
      console.error('sendMessage error:', err);
      toast.error('Failed to send message');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadImage(file, 'uniconnect/chat');
      await sendMessage('', url);
    } catch { toast.error('Image upload failed'); }
    finally { setUploadingImg(false); e.target.value = ''; }
  };

  const handleEmojiPick = (emoji) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // ── Conversation helpers ──────────────────────────────────
  const startDirectChat = async (otherUser) => {
    const existing = conversations.find(c =>
      !c.isGroup && c.members.includes(otherUser.uid) && c.members.length === 2
    );
    if (existing) {
      setActiveConv(existing);
      navigate(`/messages/${existing.id}`);
      setShowNewChat(false);
      return;
    }
    const ref = await addDoc(collection(db, 'conversations'), {
      members: [userProfile.uid, otherUser.uid],
      isGroup: false,
      memberProfiles: {
        [userProfile.uid]: { name: userProfile.fullName,  photo: userProfile.photoURL  || '' },
        [otherUser.uid]:   { name: otherUser.fullName,    photo: otherUser.photoURL    || '' },
      },
      lastMessage: '', lastMessageAt: serverTimestamp(),
      unread: { [userProfile.uid]: 0, [otherUser.uid]: 0 },
      createdAt: serverTimestamp(),
    });
    setShowNewChat(false);
    navigate(`/messages/${ref.id}`);
  };

  const createGroup = async () => {
    if (!groupName.trim())           return toast.error('Enter group name');
    if (selectedMembers.length < 1)  return toast.error('Add at least one member');
    if (selectedMembers.length > 49) return toast.error('Max 50 members');
    const members = [userProfile.uid, ...selectedMembers.map(m => m.uid)];
    const memberProfiles = {
      [userProfile.uid]: { name: userProfile.fullName, photo: userProfile.photoURL || '' },
    };
    selectedMembers.forEach(m => {
      memberProfiles[m.uid] = { name: m.fullName, photo: m.photoURL || '' };
    });
    const ref = await addDoc(collection(db, 'conversations'), {
      members, isGroup: true, groupName: groupName.trim(), groupImage: '',
      memberProfiles, createdBy: userProfile.uid,
      lastMessage: '', lastMessageAt: serverTimestamp(), unread: {},
      createdAt: serverTimestamp(),
    });
    setShowGroupModal(false); setGroupName(''); setSelectedMembers([]);
    navigate(`/messages/${ref.id}`);
  };

  const addMembersToGroup = async (newMembers) => {
    if (!activeConv) return;
    const toAdd = newMembers.filter(m => !activeConv.members.includes(m.uid));
    if (!toAdd.length) return;
    const updates = { members: arrayUnion(...toAdd.map(m => m.uid)) };
    toAdd.forEach(m => { updates[`memberProfiles.${m.uid}`] = { name: m.fullName, photo: m.photoURL || '' }; });
    await updateDoc(doc(db, 'conversations', activeConv.id), updates);
    toast.success(`Added ${toAdd.length} member(s)`);
  };

  const leaveGroup = async () => {
    if (!confirm('Leave this group?')) return;
    const newMembers = activeConv.members.filter(uid => uid !== userProfile.uid);
    await updateDoc(doc(db, 'conversations', activeConv.id), { members: newMembers });
    setActiveConv(null);
    navigate('/messages');
    toast.success('Left the group');
  };

  const uploadGroupImage = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const url = await uploadImage(file, 'uniconnect/groups');
      await updateDoc(doc(db, 'conversations', activeConv.id), { groupImage: url });
      toast.success('Group image updated');
    } catch { toast.error('Upload failed'); }
  };

  const getConvDisplay = (conv) => {
    if (conv.isGroup) return { name: conv.groupName, photo: conv.groupImage || '', isGroup: true };
    const otherUid  = conv.members.find(m => m !== userProfile.uid);
    const other     = conv.memberProfiles?.[otherUid] || {};
    const liveUser  = allUsers.find(u => u.uid === otherUid);
    return { name: other.name || 'Unknown', photo: liveUser?.photoURL || other.photo || '', isGroup: false, otherUid };
  };

  const filteredUsers = allUsers
    .filter(u => u.uid !== userProfile?.uid)
    .filter(u =>
      u.fullName?.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchUser.toLowerCase())
    );

  // FIX #4: the last message sent by me — check if it's been seen
  const lastMyMsg = [...messages].reverse().find(m => m.senderUid === userProfile.uid);
  const lastMsgSeen = lastMyMsg?.seenBy
    ? lastMyMsg.seenBy.some(uid => uid !== userProfile.uid)
    : lastMyMsg?.seen === true && messages[messages.length - 1]?.id !== lastMyMsg?.id
      ? false  // not trusted unless seenBy populated
      : false;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="pb-20 md:pb-0">
      <h1 className="page-header">Messages</h1>

      {/* ── New DM Modal ───────────────────────────────────── */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-surface-200">
              <h3 className="font-semibold">New Message</h3>
              <div className="flex gap-2">
                <button onClick={() => { setShowNewChat(false); setShowGroupModal(true); }}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1.5 rounded-lg">
                  <Users size={13}/> Group
                </button>
                <button onClick={() => setShowNewChat(false)} className="text-gray-400"><X size={18}/></button>
              </div>
            </div>
            <div className="p-3 border-b border-surface-200">
              <input className="input text-sm" placeholder="Search users..." value={searchUser}
                onChange={e => setSearchUser(e.target.value)} autoFocus/>
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredUsers.map(u => (
                <button key={u.uid} onClick={() => startDirectChat(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-50 text-left">
                  <div className="relative">
                    <UserAvatar user={u} size="md"/>
                    {presence?.[u.uid]?.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"/>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{u.fullName}</p>
                    <p className="text-xs text-gray-400">{u.department}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Group Create Modal ────────────────────────────── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-surface-200">
              <h3 className="font-semibold">Create Group</h3>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-400"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              <input className="input" placeholder="Group name" value={groupName}
                onChange={e => setGroupName(e.target.value)}/>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedMembers.map(m => (
                    <span key={m.uid} className="flex items-center gap-1 bg-primary-100 text-primary-700 rounded-full px-2.5 py-1 text-xs font-medium">
                      {m.fullName.split(' ')[0]}
                      <button onClick={() => setSelectedMembers(p => p.filter(x => x.uid !== m.uid))}><X size={10}/></button>
                    </span>
                  ))}
                </div>
              )}
              <input className="input text-sm" placeholder="Search members..." value={searchUser}
                onChange={e => setSearchUser(e.target.value)}/>
            </div>
            <div className="overflow-y-auto flex-1 px-2">
              {filteredUsers.filter(u => !selectedMembers.find(m => m.uid === u.uid)).map(u => (
                <button key={u.uid} onClick={() => setSelectedMembers(p => [...p, u])}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-50 rounded-xl text-left">
                  <UserAvatar user={u} size="sm"/>
                  <div>
                    <p className="text-sm font-semibold">{u.fullName}</p>
                    <p className="text-xs text-gray-400">{u.department}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-surface-200">
              <button onClick={createGroup} className="btn-primary w-full">
                Create Group ({selectedMembers.length + 1} members)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main chat layout ──────────────────────────────── */}
      <div className="flex gap-3 h-[calc(100vh-140px)] md:h-[calc(100vh-100px)]">

        {/* Conversation list */}
        <div className={`${activeConv ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden flex-shrink-0`}>
          <div className="p-3 border-b border-surface-200 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input className="input pl-8 text-xs py-2" placeholder="Search..."/>
            </div>
            <button onClick={() => setShowNewChat(true)}
              className="p-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all flex-shrink-0">
              <Plus size={15}/>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs mt-1">Click + to start chatting</p>
              </div>
            ) : conversations.map(conv => {
              const d      = getConvDisplay(conv);
              // FIX #1: only count unread for current user (never sender's own msgs)
              const unread = conv.unread?.[userProfile.uid] || 0;
              const otherUser = !conv.isGroup ? allUsers.find(u => u.uid === d.otherUid) : null;
              return (
                <button key={conv.id}
                  onClick={() => { setActiveConv(conv); navigate(`/messages/${conv.id}`); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-surface-50 text-left transition-all border-b border-surface-100 ${activeConv?.id === conv.id ? 'bg-primary-50' : ''}`}>
                  <div className="relative flex-shrink-0">
                    {d.isGroup
                      ? <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white overflow-hidden">
                          {d.photo ? <img src={d.photo} className="w-10 h-10 rounded-full object-cover" alt=""/> : <Users size={16}/>}
                        </div>
                      : <UserAvatar user={{ fullName: d.name, photoURL: d.photo }} size="md"/>
                    }
                    {!d.isGroup && otherUser?.isActive && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"/>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${unread > 0 ? 'font-bold' : 'font-semibold'}`}>{d.name}</p>
                      {unread > 0 && (
                        <span className="bg-primary-600 text-white text-[10px] font-bold min-w-[18px] h-4 rounded-full flex items-center justify-center px-1 flex-shrink-0">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {conv.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat panel */}
        {activeConv ? (
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden min-w-0">

            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 bg-white flex-shrink-0">
              <button onClick={() => { setActiveConv(null); navigate('/messages'); }} className="md:hidden text-gray-500">
                <ArrowLeft size={20}/>
              </button>
              {(() => {
                const d         = getConvDisplay(activeConv);
                const otherUser = !d.isGroup ? allUsers.find(u => u.uid === d.otherUid) : null;
                return (
                  <button className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => activeConv.isGroup ? setShowGroupInfo(true) : null}>
                    <div className="relative">
                      {d.isGroup
                        ? <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-white overflow-hidden">
                            {d.photo ? <img src={d.photo} className="w-full h-full object-cover" alt=""/> : <Users size={15}/>}
                          </div>
                        : <UserAvatar user={{ fullName: d.name, photoURL: d.photo }} size="sm"/>
                      }
                      {!d.isGroup && otherUser?.isActive && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-white"/>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{d.name}</p>
                      {d.isGroup
                        ? <p className="text-xs text-gray-400">{activeConv.members.length} members · tap to manage</p>
                        : <ActiveBadge uid={d.otherUid} presence={presence}/>
                      }
                    </div>
                  </button>
                );
              })()}
            </div>

            {/* Group settings panel */}
            {showGroupInfo && activeConv.isGroup && (
              <div className="border-b border-surface-200 bg-surface-50 p-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600">Group Settings</p>
                  <button onClick={() => setShowGroupInfo(false)} className="text-gray-400"><X size={14}/></button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs bg-primary-100 text-primary-700 rounded-lg px-2.5 py-1.5 cursor-pointer font-medium">
                    <Camera size={12}/> Change Photo
                    <input type="file" accept="image/*" className="hidden" onChange={uploadGroupImage}/>
                  </label>
                  <AddMemberButton
                    activeConv={activeConv}
                    allUsers={allUsers.filter(u => u.uid !== userProfile?.uid)}
                    onAdd={addMembersToGroup}
                  />
                  <button onClick={leaveGroup}
                    className="flex items-center gap-1.5 text-xs bg-red-100 text-red-600 rounded-lg px-2.5 py-1.5 font-medium">
                    <LeaveIcon size={12}/> Leave Group
                  </button>
                </div>
              </div>
            )}

            {/* Messages area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-1">

              {/* Load older button */}
              {hasOlder && (
                <div className="flex justify-center pb-2">
                  <button onClick={loadOlderMessages} disabled={loadingOlder}
                    className="text-xs text-primary-600 bg-primary-50 border border-primary-200 px-3 py-1.5 rounded-full font-medium hover:bg-primary-100 transition-all">
                    {loadingOlder
                      ? <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"/>
                          Loading...
                        </span>
                      : '↑ Load older messages'
                    }
                  </button>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isMe       = msg.senderUid === userProfile.uid;
                const senderUser = allUsers.find(u => u.uid === msg.senderUid);
                const isLastMsg  = idx === messages.length - 1;
                // FIX #4: show "Seen" only under my last message, if seen by someone else
                const showSeen   = isMe && isLastMsg && msg.seenBy && msg.seenBy.some(uid => uid !== userProfile.uid);
                const showDelivered = isMe && isLastMsg && !showSeen;

                return (
                  <div key={msg.id}
                    className="relative group"
                    onMouseEnter={() => setHoveredMsg(msg.id)}
                    onMouseLeave={() => setHoveredMsg(null)}>

                    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar — only for others */}
                      {!isMe && (
                        <UserAvatar
                          user={{ fullName: msg.senderName, photoURL: senderUser?.photoURL || '' }}
                          size="xs"
                        />
                      )}

                      <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Group sender name */}
                        {activeConv.isGroup && !isMe && (
                          <p className="text-[10px] font-semibold text-gray-400 px-1">{msg.senderName}</p>
                        )}

                        {/* FIX #3: Reply context preview */}
                        {msg.replyToId && (
                          <div className={`flex items-start gap-1.5 rounded-xl px-2.5 py-1.5 mb-0.5 max-w-full border-l-4 ${
                            isMe
                              ? 'bg-primary-700/40 border-white/50 text-white/80'
                              : 'bg-surface-200 border-gray-400 text-gray-500'
                          }`}>
                            <Reply size={10} className="mt-0.5 flex-shrink-0 opacity-70"/>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold opacity-80 truncate">{msg.replyToSender}</p>
                              <p className="text-[10px] truncate opacity-70">{msg.replyToText}</p>
                            </div>
                          </div>
                        )}

                        {/* Image */}
                        {msg.imageURL && (
                          <img src={msg.imageURL} alt="" className="max-w-[200px] rounded-xl object-cover"/>
                        )}

                        {/* Text bubble */}
                        {msg.text && (
                          <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                            isMe
                              ? 'bg-primary-600 text-white rounded-br-sm'
                              : 'bg-surface-100 text-gray-800 rounded-bl-sm'
                          }`}>
                            {msg.text}
                          </div>
                        )}

                        {/* Timestamp + FIX #4 seen indicator */}
                        <div className={`flex items-center gap-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <p className="text-[10px] text-gray-400">
                            {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
                          </p>
                          {isMe && isLastMsg && (
                            showSeen
                              ? <span className="flex items-center gap-0.5 text-[10px] text-primary-500 font-medium">
                                  <CheckCheck size={12} className="text-primary-500"/> Seen
                                </span>
                              : <Check size={11} className="text-gray-300"/>
                          )}
                        </div>
                      </div>

                      {/* FIX #3: Reply button — appears on hover */}
                      {hoveredMsg === msg.id && (
                        <button
                          onClick={() => setReplyTo(msg)}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded-full hover:bg-surface-200 text-gray-400 hover:text-gray-600 ${isMe ? 'mr-1' : 'ml-1'}`}>
                          <Reply size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef}/>
            </div>

            {/* FIX #3: Reply preview bar above input */}
            <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)}/>

            {/* Input bar */}
            <div className="p-3 border-t border-surface-200 flex-shrink-0">
              <div className="flex gap-2 items-center relative">
                {/* Image upload */}
                <label className={`p-2 rounded-xl border border-surface-200 hover:bg-surface-100 cursor-pointer transition-all flex-shrink-0 ${uploadingImg ? 'opacity-50' : ''}`}>
                  {uploadingImg
                    ? <span className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin block"/>
                    : <Image size={16} className="text-gray-500"/>
                  }
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImg}/>
                </label>

                {/* Emoji picker */}
                <div className="relative flex-shrink-0">
                  {showEmojiPicker && (
                    <EmojiPicker onPick={handleEmojiPick} onClose={() => setShowEmojiPicker(false)}/>
                  )}
                  <button
                    onClick={() => setShowEmojiPicker(p => !p)}
                    className={`p-2 rounded-xl border transition-all ${showEmojiPicker ? 'border-primary-400 bg-primary-50' : 'border-surface-200 hover:bg-surface-100'}`}>
                    <Smile size={16} className={showEmojiPicker ? 'text-primary-600' : 'text-gray-500'}/>
                  </button>
                </div>

                <input
                  className="input flex-1 text-sm"
                  placeholder={replyTo ? `Reply to ${replyTo.senderName}...` : 'Type a message...'}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                />
                <button onClick={() => sendMessage()} className="btn-primary py-2 px-4 flex-shrink-0">
                  <Send size={16}/>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 bg-white rounded-2xl border border-surface-200 items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">💬</span>
              </div>
              <p className="font-medium text-sm">Select a conversation</p>
              <p className="text-xs mt-1">or click + to start one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Member Button (group) ─────────────────────────────────
function AddMemberButton({ activeConv, allUsers, onAdd }) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState('');
  const available = allUsers.filter(u =>
    !activeConv.members.includes(u.uid) &&
    u.fullName?.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="relative">
      <button onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 rounded-lg px-2.5 py-1.5 font-medium">
        <UserPlus size={12}/> Add Members
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-56 bg-white rounded-xl shadow-lg border border-surface-200 z-30">
          <div className="p-2 border-b border-surface-200">
            <input className="input text-xs py-1.5" placeholder="Search..."
              value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {available.slice(0, 8).map(u => (
              <button key={u.uid} onClick={() => { onAdd([u]); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-50 text-left">
                <UserAvatar user={u} size="xs"/>
                <span className="text-xs font-medium truncate">{u.fullName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
