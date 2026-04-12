// src/pages/ProfilePage.jsx — v2 with all editable fields, interactive posts, cover upload
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, orderBy,
  arrayUnion, arrayRemove, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage } from '../utils/cloudinary';
import { useAuth } from '../contexts/AuthContext';
import { useAllUsers } from '../contexts/UsersContext';
import { Camera, Edit2, Save, X, MessageCircle, MapPin, BookOpen, Briefcase,
  GraduationCap, Send, Trash2, ThumbsUp, Heart } from 'lucide-react';
import UserAvatar from '../components/ui/UserAvatar';
import UserBadges from '../components/ui/UserBadges';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { sendNotification } from '../utils/notifications';

const CLUBS         = ['Cybersecurity Club','Programming Club','Robotics Club','Cultural Club','Debate Club','Photography Club','Sports Club','Volunteer Club'];
const CLUB_POSITIONS= ['President','Vice President','General Secretary','AGS','Treasurer','Member'];

export default function ProfilePage() {
  const { uid } = useParams();
  const { userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [profile,  setProfile]  = useState(null);
  const [posts,    setPosts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [editForm, setEditForm] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [comments,     setComments]     = useState({});
  const [commentText,  setCommentText]  = useState({});

  const allUsers = useAllUsers();
  const isOwn = uid === userProfile?.uid;

  useEffect(()=>{
    setLoading(true);
    getDoc(doc(db,'users',uid)).then(snap=>{
      if (snap.exists()) {
        const data={id:snap.id,...snap.data()};
        setProfile(data);
        setEditForm({
          bio:data.bio||'', address:data.address||'', job:data.job||'',
          education:data.education||'', clubAffiliation:data.clubAffiliation||'',
          clubPosition:data.clubPosition||'',
        });
      }
      setLoading(false);
    });
  },[uid]);

  useEffect(()=>{
    const q=query(collection(db,'posts'),where('authorUid','==',uid),orderBy('createdAt','desc'));
    return onSnapshot(q, s=>setPosts(s.docs.map(d=>({id:d.id,...d.data()}))));
  },[uid]);



  const handlePhotoUpload = async (e, type) => {
    const file=e.target.files[0]; if (!file) return;
    setSaving(true);
    try {
      const url = await uploadImage(file,`uniconnect/${type==='profile'?'avatars':'covers'}`);
      const field = type==='profile'?'photoURL':'coverURL';
      await updateDoc(doc(db,'users',uid),{[field]:url});
      setProfile(p=>({...p,[field]:url}));
      await refreshProfile();
      toast.success('Photo updated!');
    } catch(err){ toast.error('Upload failed'); }
    finally { setSaving(false); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db,'users',uid), editForm);
      setProfile(p=>({...p,...editForm}));
      await refreshProfile();
      setEditing(false);
      toast.success('Profile updated!');
    } catch(err){ toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  // Post interactions on profile
  const handleReaction = async (post, type) => {
    const arr = post.reactions?.[type]||[];
    const has = arr.includes(userProfile.uid);
    await updateDoc(doc(db,'posts',post.id),{
      [`reactions.${type}`]: has ? arrayRemove(userProfile.uid) : arrayUnion(userProfile.uid)
    });
    if (!has && post.authorUid!==userProfile.uid)
      await sendNotification(post.authorUid,userProfile.uid,'reaction',`${userProfile.fullName} reacted to your post`,post.id);
  };

  const deletePost = async (postId) => {
    if (!confirm('Delete?')) return;
    await deleteDoc(doc(db,'posts',postId)); toast.success('Deleted');
  };

  const loadComments = (postId) => {
    if (comments[postId]) return;
    const q=query(collection(db,'posts',postId,'comments'),orderBy('createdAt','asc'));
    onSnapshot(q, s=>setComments(p=>({...p,[postId]:s.docs.map(d=>({id:d.id,...d.data()}))})));
  };
  const toggleComments = (postId) => {
    setExpandedComments(p=>{ const n={...p,[postId]:!p[postId]}; if(n[postId]) loadComments(postId); return n; });
  };
  const addComment = async (postId, authorUid) => {
    const text = commentText[postId]?.trim(); if (!text) return;
    await addDoc(collection(db,'posts',postId,'comments'),{
      text, authorUid:userProfile.uid, authorName:userProfile.fullName,
      authorPhoto:userProfile.photoURL||'', createdAt:serverTimestamp()
    });
    const post=posts.find(p=>p.id===postId);
    await updateDoc(doc(db,'posts',postId),{commentCount:(post?.commentCount||0)+1});
    if (authorUid!==userProfile.uid)
      await sendNotification(authorUid,userProfile.uid,'comment',`${userProfile.fullName} commented on your post`,postId);
    setCommentText(p=>({...p,[postId]:''}));
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!profile) return <div className="card text-center py-12 text-gray-400"><p>Profile not found</p></div>;

  return (
    <div className="space-y-4 pb-20 md:pb-4 animate-fade-in">
      {/* Cover + Avatar card */}
      <div className="card p-0 overflow-hidden">
        {/* Cover */}
        <div className="relative h-32 md:h-44 bg-gradient-to-r from-primary-600 to-primary-800">
          {profile.coverURL && <img src={profile.coverURL} alt="" className="w-full h-full object-cover"/>}
          {isOwn && (
            <label className="absolute bottom-2 right-2 cursor-pointer bg-black/40 hover:bg-black/60 text-white rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-xs transition-all">
              <Camera size={12}/> Change Cover
              <input type="file" accept="image/*" className="hidden" onChange={e=>handlePhotoUpload(e,'cover')}/>
            </label>
          )}
        </div>
        <div className="px-4 pb-4 relative">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="relative">
              {profile.photoURL
                ? <img src={profile.photoURL} className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"/>
                : <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-bold text-2xl">{profile.fullName?.[0]}</span>
                  </div>
              }
              {isOwn && (
                <label className="absolute bottom-0 right-0 cursor-pointer bg-primary-600 text-white rounded-full p-1.5 shadow hover:bg-primary-700 transition-all">
                  <Camera size={12}/>
                  <input type="file" accept="image/*" className="hidden" onChange={e=>handlePhotoUpload(e,'profile')}/>
                </label>
              )}
            </div>
            <div className="flex gap-2 mt-12">
              {isOwn ? (
                editing ? (
                  <div className="flex gap-2">
                    <button onClick={saveProfile} disabled={saving} className="btn-primary py-1.5 px-3 text-xs">
                      {saving?<span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<Save size={13}/>} Save
                    </button>
                    <button onClick={()=>setEditing(false)} className="btn-ghost py-1.5 px-3 text-xs"><X size={13}/></button>
                  </div>
                ) : (
                  <button onClick={()=>setEditing(true)} className="btn-ghost py-1.5 px-3 text-xs"><Edit2 size={13}/> Edit Profile</button>
                )
              ) : (
                <button onClick={()=>navigate('/messages')} className="btn-primary py-1.5 px-3 text-xs">
                  <MessageCircle size={13}/> Message
                </button>
              )}
            </div>
          </div>

          {/* Name & badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="font-display font-bold text-lg text-surface-900">{profile.fullName}</h2>
            <UserBadges user={profile} inline/>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><BookOpen size={12} className="text-primary-500"/>{profile.department}{profile.batch?` · Batch ${profile.batch}`:''}</span>
            {profile.role==='authority'&&profile.position&&<span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="text-amber-500">★</span>{profile.position}</span>}
            {profile.address&&<span className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin size={12} className="text-gray-400"/>{profile.address}</span>}
            {profile.job&&<span className="flex items-center gap-1.5 text-xs text-gray-500"><Briefcase size={12} className="text-blue-500"/>{profile.job}</span>}
            {profile.education&&<span className="flex items-center gap-1.5 text-xs text-gray-500"><GraduationCap size={12} className="text-green-500"/>{profile.education}</span>}
          </div>

          {/* Club badges */}
          {profile.clubAffiliation && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="badge-club">{profile.clubAffiliation}</span>
              {profile.clubPosition && <span className="badge-club">{profile.clubPosition}</span>}
            </div>
          )}

          {/* Bio */}
          {editing ? (
            <div className="mt-3 space-y-2">
              <div><label className="label">Bio</label>
                <textarea className="input text-sm min-h-[70px] resize-none" placeholder="Write a bio..."
                  value={editForm.bio} onChange={e=>setEditForm(p=>({...p,bio:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Job / Work</label>
                  <input className="input text-sm" placeholder="e.g. Software Engineer" value={editForm.job} onChange={e=>setEditForm(p=>({...p,job:e.target.value}))}/></div>
                <div><label className="label">Education</label>
                  <input className="input text-sm" placeholder="e.g. BSc CSE" value={editForm.education} onChange={e=>setEditForm(p=>({...p,education:e.target.value}))}/></div>
              </div>
              <div><label className="label">Address</label>
                <input className="input text-sm" placeholder="Your address" value={editForm.address} onChange={e=>setEditForm(p=>({...p,address:e.target.value}))}/></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Club Affiliation</label>
                  <select className="input text-sm" value={editForm.clubAffiliation} onChange={e=>setEditForm(p=>({...p,clubAffiliation:e.target.value}))}>
                    <option value="">None</option>
                    {CLUBS.map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label className="label">Club Role</label>
                  <select className="input text-sm" value={editForm.clubPosition} onChange={e=>setEditForm(p=>({...p,clubPosition:e.target.value}))} disabled={!editForm.clubAffiliation}>
                    <option value="">None</option>
                    {CLUB_POSITIONS.map(p=><option key={p}>{p}</option>)}</select></div>
              </div>
              <p className="text-[10px] text-gray-400">Note: Name, Department, and Student ID cannot be changed.</p>
            </div>
          ) : profile.bio ? (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{profile.bio}</p>
          ) : isOwn ? (
            <p className="mt-2 text-xs text-gray-400 italic cursor-pointer" onClick={()=>setEditing(true)}>+ Add a bio</p>
          ) : null}
        </div>
      </div>

      {/* Posts */}
      <div>
        <h3 className="font-semibold text-sm text-surface-900 mb-3">Posts ({posts.length})</h3>
        {posts.length===0 ? (
          <div className="card text-center py-8 text-gray-400"><p className="text-sm">No posts yet</p></div>
        ) : posts.map(post=>{
          const likeCount  = post.reactions?.like?.length||0;
          const loveCount  = post.reactions?.love?.length||0;
          const liked = post.reactions?.like?.includes(userProfile.uid);
          const loved = post.reactions?.love?.includes(userProfile.uid);
          const timeAgo = post.createdAt?.toDate?formatDistanceToNow(post.createdAt.toDate(),{addSuffix:true}):'';
          return (
            <div key={post.id} className="card mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{timeAgo}{post.editHistory?.length>0&&' (edited)'}</span>
                {(isOwn || post.authorUid===userProfile.uid) && (
                  <button onClick={()=>deletePost(post.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={13}/></button>
                )}
              </div>
              {post.text&&<p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post.text}</p>}
              {post.imageURL&&<img src={post.imageURL} alt="" className="w-full rounded-xl object-cover max-h-60 mt-2"/>}
              <div className="flex gap-3 mt-2 pt-2 border-t border-surface-200">
                <button onClick={()=>handleReaction(post,'like')}
                  className={`flex items-center gap-1 text-xs font-medium transition-all px-2 py-1 rounded-lg ${liked?'bg-primary-100 text-primary-700':'text-gray-500 hover:bg-surface-100'}`}>
                  <ThumbsUp size={12}/>{likeCount>0?likeCount:'Like'}
                </button>
                <button onClick={()=>handleReaction(post,'love')}
                  className={`flex items-center gap-1 text-xs font-medium transition-all px-2 py-1 rounded-lg ${loved?'bg-red-100 text-red-600':'text-gray-500 hover:bg-surface-100'}`}>
                  <Heart size={12}/>{loveCount>0?loveCount:'Love'}
                </button>
                <button onClick={()=>toggleComments(post.id)} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:bg-surface-100 px-2 py-1 rounded-lg transition-all">
                  💬 {post.commentCount||0}
                </button>
              </div>
              {expandedComments[post.id] && (
                <div className="mt-2 space-y-1.5">
                  {(comments[post.id]||[]).map(c=>(
                    <div key={c.id} className="flex gap-2">
                      <UserAvatar user={{fullName:c.authorName,photoURL:c.authorPhoto}} size="xs"/>
                      <div className="flex-1 bg-surface-50 rounded-xl px-2.5 py-1.5">
                        <p className="text-xs font-semibold">{c.authorName}</p>
                        <p className="text-xs text-gray-700">{c.text}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1.5">
                    <UserAvatar user={userProfile} size="xs"/>
                    <div className="flex-1 flex gap-1.5">
                      <input className="input flex-1 text-xs py-1.5" placeholder="Comment..."
                        value={commentText[post.id]||''} onChange={e=>setCommentText(p=>({...p,[post.id]:e.target.value}))}
                        onKeyDown={e=>e.key==='Enter'&&addComment(post.id,post.authorUid)}/>
                      <button onClick={()=>addComment(post.id,post.authorUid)} className="btn-primary py-1.5 px-2.5 text-xs"><Send size={11}/></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
