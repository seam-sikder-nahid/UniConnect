// src/pages/FriendsPage.jsx — complete friends system
import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where, updateDoc, doc,
  serverTimestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useAllUsers } from '../contexts/UsersContext';
import { usePresence } from '../contexts/PresenceContext';
import { Search, UserPlus, UserCheck, UserX, Users, Clock } from 'lucide-react';
import UserAvatar from '../components/ui/UserAvatar';
import UserBadges from '../components/ui/UserBadges';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { sendNotification } from '../utils/notifications';

export default function FriendsPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const allUsersRaw = useAllUsers();
  const presence = usePresence();
  const allUsers = allUsersRaw.filter(u => u.uid !== userProfile?.uid);
  const [tab,      setTab]      = useState('discover'); // discover | requests | friends
  const [requests, setRequests] = useState([]);  // incoming pending
  const [sent,     setSent]     = useState([]);  // outgoing pending
  const [friends,  setFriends]  = useState([]);  // accepted
  const [search,   setSearch]   = useState('');



  // Friend requests TO me
  useEffect(()=>{
    if (!userProfile) return;
    const q = query(collection(db,'friendRequests'), where('toUid','==',userProfile.uid), where('status','==','pending'));
    return onSnapshot(q, s=>setRequests(s.docs.map(d=>({id:d.id,...d.data()}))));
  },[userProfile]);

  // Friend requests FROM me (sent)
  useEffect(()=>{
    if (!userProfile) return;
    const q = query(collection(db,'friendRequests'), where('fromUid','==',userProfile.uid), where('status','==','pending'));
    return onSnapshot(q, s=>setSent(s.docs.map(d=>({id:d.id,...d.data()}))));
  },[userProfile]);

  // Accepted friends
  useEffect(()=>{
    if (!userProfile) return;
    const q1 = query(collection(db,'friendRequests'), where('fromUid','==',userProfile.uid), where('status','==','accepted'));
    const q2 = query(collection(db,'friendRequests'), where('toUid','==',userProfile.uid),   where('status','==','accepted'));
    const u1 = onSnapshot(q1, s=>{
      setFriends(prev=>{
        const fromMe = s.docs.map(d=>d.data().toUid);
        const toMe   = prev.filter(uid=>!s.docs.find(d=>d.data().fromUid===userProfile.uid&&d.data().toUid===uid));
        return [...new Set([...fromMe])];
      });
    });
    const u2 = onSnapshot(q2, s=>{
      setFriends(prev=>{
        const toMe = s.docs.map(d=>d.data().fromUid);
        return [...new Set([...prev, ...toMe])];
      });
    });
    return ()=>{ u1(); u2(); };
  },[userProfile]);

  const sendRequest = async (toUser) => {
    // Check if already sent
    const existing = sent.find(r=>r.toUid===toUser.uid);
    if (existing) {
      await deleteDoc(doc(db,'friendRequests',existing.id));
      toast('Request withdrawn');
      return;
    }
    const ref = await addDoc(collection(db,'friendRequests'),{
      fromUid:userProfile.uid, fromName:userProfile.fullName, fromPhoto:userProfile.photoURL||'',
      toUid:toUser.uid, status:'pending', createdAt:serverTimestamp()
    });
    await sendNotification(toUser.uid, userProfile.uid,'friend_request',
      `${userProfile.fullName} sent you a friend request`, ref.id);
    toast.success('Request sent!');
  };

  const acceptRequest = async (req) => {
    await updateDoc(doc(db,'friendRequests',req.id),{ status:'accepted' });
    await sendNotification(req.fromUid, userProfile.uid,'friend_accept',
      `${userProfile.fullName} accepted your friend request`, req.id);
    toast.success('Friend added!');
  };

  const ignoreRequest = async (req) => {
    await deleteDoc(doc(db,'friendRequests',req.id));
    toast('Request ignored');
  };

  const getRelation = (uid) => {
    if (friends.includes(uid)) return 'friends';
    if (sent.find(r=>r.toUid===uid)) return 'sent';
    if (requests.find(r=>r.fromUid===uid)) return 'incoming';
    return 'none';
  };

  const filterUsers = allUsers.filter(u=>
    u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.universityId?.includes(search) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  );

  const friendUsers = allUsers.filter(u=>friends.includes(u.uid));

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <h1 className="page-header">People</h1>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-10" placeholder="Search by name, ID, email, department..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-surface-200 shadow-sm">
        {[['discover','Discover'],['requests',`Requests${requests.length>0?` (${requests.length})`:''}`],['friends',`Friends${friendUsers.length>0?` (${friendUsers.length})`:''}`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${tab===k?'bg-primary-600 text-white shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Discover */}
      {tab==='discover' && (
        <div className="space-y-2">
          {filterUsers.length===0 && <div className="card text-center py-8 text-gray-400"><p className="text-sm">No users found</p></div>}
          {filterUsers.map(u=>{
            const rel = getRelation(u.uid);
            return (
              <div key={u.uid} className="card flex items-center gap-3">
                <button onClick={()=>navigate(`/profile/${u.uid}`)} className="flex-shrink-0">
                  <div className="relative">
                    <UserAvatar user={u} size="md"/>
                    {presence?.[u.uid]?.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>}
                  </div>
                </button>
                <button onClick={()=>navigate(`/profile/${u.uid}`)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold hover:text-primary-600 transition-colors">{u.fullName}</span>
                    <UserBadges user={u} inline/>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{u.department}{u.batch?` · Batch ${u.batch}`:''}</p>
                </button>
                <div className="flex-shrink-0">
                  {rel==='friends' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 rounded-full px-2.5 py-1">
                      <UserCheck size={12}/> Friends
                    </span>
                  ) : rel==='sent' ? (
                    <button onClick={()=>sendRequest(u)} className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-surface-100 hover:bg-red-50 hover:text-red-600 rounded-full px-2.5 py-1 transition-all">
                      <Clock size={12}/> Sent
                    </button>
                  ) : rel==='incoming' ? (
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">Incoming</span>
                  ) : (
                    <button onClick={()=>sendRequest(u)} className="flex items-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-full px-2.5 py-1.5 transition-all border border-primary-200">
                      <UserPlus size={12}/> Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Requests */}
      {tab==='requests' && (
        <div className="space-y-2">
          {requests.length===0 && <div className="card text-center py-8 text-gray-400"><Users size={28} className="mx-auto mb-2 opacity-40"/><p className="text-sm">No pending requests</p></div>}
          {requests.map(req=>{
            const fromUser = allUsers.find(u=>u.uid===req.fromUid);
            return (
              <div key={req.id} className="card flex items-center gap-3">
                <UserAvatar user={fromUser||{fullName:req.fromName,photoURL:req.fromPhoto}} size="md"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{req.fromName}</p>
                  {fromUser && <p className="text-xs text-gray-500">{fromUser.department}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={()=>acceptRequest(req)} className="flex items-center gap-1 text-xs font-semibold bg-primary-600 text-white rounded-xl px-2.5 py-1.5 hover:bg-primary-700 transition-all">
                    <UserCheck size={12}/> Accept
                  </button>
                  <button onClick={()=>ignoreRequest(req)} className="flex items-center gap-1 text-xs font-semibold bg-surface-100 text-gray-600 rounded-xl px-2.5 py-1.5 hover:bg-surface-200 transition-all">
                    <UserX size={12}/> Ignore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Friends list */}
      {tab==='friends' && (
        <div className="space-y-2">
          {friendUsers.length===0 && <div className="card text-center py-8 text-gray-400"><Users size={28} className="mx-auto mb-2 opacity-40"/><p className="text-sm">No friends yet. Discover people!</p></div>}
          {friendUsers.map(u=>(
            <div key={u.uid} className="card flex items-center gap-3">
              <button onClick={()=>navigate(`/profile/${u.uid}`)} className="flex-shrink-0">
                <div className="relative">
                  <UserAvatar user={u} size="md"/>
                  {presence?.[u.uid]?.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>}
                </div>
              </button>
              <button onClick={()=>navigate(`/profile/${u.uid}`)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold hover:text-primary-600 transition-colors">{u.fullName}</span>
                  <UserBadges user={u} inline/>
                </div>
                <p className="text-xs text-gray-500">{u.department}{u.batch?` · Batch ${u.batch}`:''}</p>
                {presence?.[u.uid]?.isActive ? <p className="text-[10px] text-green-600 font-medium mt-0.5">● Active now</p> : null}
              </button>
              <button onClick={()=>navigate('/messages')}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-xl px-2.5 py-1.5 border border-primary-200">
                💬 Message
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
