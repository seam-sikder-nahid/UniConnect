// src/pages/FeedPage.jsx — v2 with edit, reactions, mentions, share, profile nav
import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, arrayUnion, arrayRemove, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage } from '../utils/cloudinary';
import { useAuth } from '../contexts/AuthContext';
import { sendNotification } from '../utils/notifications';
import toast from 'react-hot-toast';
import { Trash2, Image, X, BarChart2, Send, Edit2, Check, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import UserAvatar from '../components/ui/UserAvatar';
import UserBadges from '../components/ui/UserBadges';
import { useNavigate } from 'react-router-dom';

// ── Reaction config ──────────────────────────────────────────
const REACTIONS = [
  { key:'like',    emoji:'👍', label:'Like',    color:'text-primary-600 bg-primary-100' },
  { key:'love',    emoji:'❤️', label:'Love',    color:'text-red-600 bg-red-100' },
  { key:'dislike', emoji:'👎', label:'Dislike', color:'text-gray-600 bg-gray-100' },
  { key:'angry',   emoji:'😡', label:'Angry',   color:'text-orange-600 bg-orange-100' },
  { key:'sad',     emoji:'😢', label:'Sad',     color:'text-blue-600 bg-blue-100' },
];
const emptyReactions = () => Object.fromEntries(REACTIONS.map(r => [r.key, []]));

// ── Mention input ────────────────────────────────────────────
function MentionInput({ value, onChange, onKeyDown, placeholder, className, allUsers }) {
  const [suggestions, setSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const inputRef = useRef();

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    const atIdx = val.lastIndexOf('@');
    if (atIdx !== -1) {
      const q = val.slice(atIdx + 1).toLowerCase();
      if (q.length > 0) {
        const matches = allUsers.filter(u => u.fullName?.toLowerCase().includes(q)).slice(0, 5);
        setSuggestions(matches);
        setMentionQuery(q);
        setShowSugg(matches.length > 0);
        return;
      }
    }
    setShowSugg(false);
  };

  const pickUser = (user) => {
    const atIdx = value.lastIndexOf('@');
    const newVal = value.slice(0, atIdx) + `@${user.fullName} `;
    onChange(newVal);
    setShowSugg(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex-1">
      <input ref={inputRef} className={className} placeholder={placeholder}
        value={value} onChange={handleChange} onKeyDown={onKeyDown}/>
      {showSugg && (
        <div className="absolute bottom-full mb-1 left-0 w-56 bg-white rounded-xl shadow-lg border border-surface-200 overflow-hidden z-20">
          {suggestions.map(u => (
            <button key={u.uid} onMouseDown={()=>pickUser(u)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary-50 text-left">
              <UserAvatar user={u} size="xs"/>
              <span className="text-xs font-medium truncate">{u.fullName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reactions Picker ─────────────────────────────────────────
function ReactionPicker({ onPick, currentReaction }) {
  return (
    <div className="absolute bottom-full mb-1 left-0 flex items-center gap-1 bg-white rounded-full shadow-lg border border-surface-200 px-2 py-1.5 z-20">
      {REACTIONS.map(r => (
        <button key={r.key} onClick={()=>onPick(r.key)} title={r.label}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-lg hover:scale-125 transition-transform ${currentReaction===r.key?'ring-2 ring-primary-500 bg-primary-50':''}`}>
          {r.emoji}
        </button>
      ))}
    </div>
  );
}

// ── Reactions Modal ──────────────────────────────────────────
function ReactionsModal({ reactions, allUsers, onClose }) {
  const [tab, setTab] = useState('all');
  const tabs = [{ key:'all', label:'All' }, ...REACTIONS.map(r=>({ key:r.key, label:`${r.emoji} ${r.label}` }))];
  const getUids = (key) => key==='all' ? Object.values(reactions).flat() : (reactions[key] || []);
  const uids = getUids(tab);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-surface-200">
          <h3 className="font-semibold text-sm">Reactions</h3>
          <button onClick={onClose} className="text-gray-400"><X size={16}/></button>
        </div>
        <div className="flex overflow-x-auto gap-1 p-2 border-b border-surface-200">
          {tabs.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${tab===t.key?'bg-primary-600 text-white':'bg-surface-100 text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="max-h-60 overflow-y-auto p-3 space-y-2">
          {uids.map(uid => {
            const u = allUsers.find(x=>x.uid===uid);
            return u ? (
              <div key={uid} className="flex items-center gap-2">
                <UserAvatar user={u} size="sm"/>
                <span className="text-sm font-medium">{u.fullName}</span>
              </div>
            ) : null;
          })}
          {uids.length===0 && <p className="text-xs text-gray-400 text-center py-4">No reactions yet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main FeedPage ────────────────────────────────────────────
export default function FeedPage() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsers,setAllUsers] = useState([]);
  const [newPost, setNewPost]  = useState({ text:'', image:null, imagePreview:null, isPoll:false, pollOptions:['',''] });
  const [submitting, setSubmitting] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState({});
  const [showReactionsPicker, setShowReactionsPicker] = useState({});
  const [showReactionsModal,  setShowReactionsModal]  = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    const q = query(collection(db,'posts'), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap => { setPosts(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,'users'), snap => setAllUsers(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  }, []);

  const loadComments = (postId) => {
    if (comments[postId]) return;
    const q = query(collection(db,'posts',postId,'comments'), orderBy('createdAt','asc'));
    onSnapshot(q, snap => setComments(p=>({...p,[postId]:snap.docs.map(d=>({id:d.id,...d.data()}))})));
  };

  const toggleComments = (postId) => {
    setExpandedComments(p=>{ const n={...p,[postId]:!p[postId]}; if(n[postId]) loadComments(postId); return n; });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) return toast.error('Max 5MB');
    setNewPost(p=>({...p, image:file, imagePreview:URL.createObjectURL(file)}));
  };

  const submitPost = async () => {
    if (!newPost.text.trim() && !newPost.image) return toast.error('Write something first!');
    setSubmitting(true);
    try {
      let imageURL = '';
      if (newPost.image) imageURL = await uploadImage(newPost.image,'uniconnect/posts');
      const postData = {
        text:newPost.text.trim(), imageURL,
        authorUid:userProfile.uid, authorName:userProfile.fullName,
        authorPhoto:userProfile.photoURL||'', authorDept:userProfile.department,
        authorRole:userProfile.role, authorPosition:userProfile.position||'',
        authorBatch:userProfile.batch||'', authorClubPosition:userProfile.clubPosition||'',
        authorClubAffiliation:userProfile.clubAffiliation||'',
        reactions:emptyReactions(), commentCount:0, editHistory:[],
        createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
      };
      if (newPost.isPoll) {
        const opts = newPost.pollOptions.filter(o=>o.trim());
        if (opts.length<2) { toast.error('Add at least 2 poll options'); setSubmitting(false); return; }
        postData.poll = { options: opts.map(o=>({text:o, votes:[]})) };
      }
      await addDoc(collection(db,'posts'), postData);
      setNewPost({text:'',image:null,imagePreview:null,isPoll:false,pollOptions:['','']});
      toast.success('Posted!');
    } catch(err) { toast.error(err.message||'Post failed'); }
    finally { setSubmitting(false); }
  };

  const handleReaction = async (post, reactionKey) => {
    const reactions = { ...emptyReactions(), ...(post.reactions||{}) };
    // Remove user from all reaction types first
    const updated = {};
    REACTIONS.forEach(r => {
      updated[r.key] = (reactions[r.key]||[]).filter(uid => uid !== userProfile.uid);
    });
    // If not already on this type, add them
    const wasOn = (reactions[reactionKey]||[]).includes(userProfile.uid);
    if (!wasOn) updated[reactionKey] = [...updated[reactionKey], userProfile.uid];
    await updateDoc(doc(db,'posts',post.id), { reactions: updated });
    if (!wasOn && post.authorUid !== userProfile.uid) {
      const r = REACTIONS.find(x=>x.key===reactionKey);
      await sendNotification(post.authorUid, userProfile.uid,'reaction',
        `${userProfile.fullName} reacted ${r.emoji} to your post`, post.id);
    }
    setShowReactionsPicker(p=>({...p,[post.id]:false}));
  };

  const addComment = async (postId, authorUid) => {
    const text = commentText[postId]?.trim();
    if (!text) return;
    // Detect mentions
    const mentions = [];
    const mentionRegex = /@([\w\s]+?)(?=\s|$|@)/g;
    let m;
    while ((m = mentionRegex.exec(text)) !== null) {
      const name = m[1].trim();
      const user = allUsers.find(u => u.fullName?.toLowerCase() === name.toLowerCase());
      if (user && user.uid !== userProfile.uid) mentions.push(user.uid);
    }
    await addDoc(collection(db,'posts',postId,'comments'), {
      text, authorUid:userProfile.uid, authorName:userProfile.fullName,
      authorPhoto:userProfile.photoURL||'', createdAt:serverTimestamp()
    });
    const post = posts.find(p=>p.id===postId);
    await updateDoc(doc(db,'posts',postId), { commentCount:(post?.commentCount||0)+1 });
    if (authorUid !== userProfile.uid)
      await sendNotification(authorUid, userProfile.uid,'comment',`${userProfile.fullName} commented on your post`, postId);
    mentions.forEach(uid =>
      sendNotification(uid, userProfile.uid,'mention',`${userProfile.fullName} mentioned you in a comment`, postId)
    );
    setCommentText(p=>({...p,[postId]:''}));
  };

  const deletePost = async (postId, authorUid) => {
    if (authorUid !== userProfile.uid) return toast.error('Not authorized');
    if (!confirm('Delete post?')) return;
    await deleteDoc(doc(db,'posts',postId));
    toast.success('Deleted');
  };

  const saveEdit = async (postId, origText) => {
    if (!editText.trim()) return;
    const postRef = doc(db,'posts',postId);
    await updateDoc(postRef, {
      text: editText.trim(),
      editHistory: arrayUnion({ text:origText, editedAt:new Date().toISOString() }),
      updatedAt: serverTimestamp(),
    });
    setEditingPostId(null);
    toast.success('Post updated');
  };

  const sharePost = async (post) => {
    const shareText = `🔁 Shared from ${post.authorName}:\n\n${post.text}`;
    await addDoc(collection(db,'posts'), {
      text:shareText, imageURL:post.imageURL||'',
      authorUid:userProfile.uid, authorName:userProfile.fullName,
      authorPhoto:userProfile.photoURL||'', authorDept:userProfile.department,
      authorRole:userProfile.role, authorPosition:userProfile.position||'',
      authorBatch:userProfile.batch||'', authorClubPosition:userProfile.clubPosition||'',
      authorClubAffiliation:userProfile.clubAffiliation||'',
      reactions:emptyReactions(), commentCount:0, editHistory:[],
      sharedFrom: { authorName:post.authorName, postId:post.id },
      createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
    });
    toast.success('Shared to your profile!');
  };

  const votePoll = async (post, optIdx) => {
    if (!post.poll) return;
    const newOptions = post.poll.options.map((opt,i)=>({
      ...opt,
      votes: i===optIdx
        ? opt.votes.includes(userProfile.uid) ? opt.votes.filter(v=>v!==userProfile.uid) : [...opt.votes, userProfile.uid]
        : opt.votes.filter(v=>v!==userProfile.uid)
    }));
    await updateDoc(doc(db,'posts',post.id), {'poll.options':newOptions});
  };

  const totalReactionCount = (reactions) => {
    if (!reactions) return 0;
    return Object.values(reactions).flat().length;
  };
  const myReaction = (reactions) => {
    if (!reactions) return null;
    for (const r of REACTIONS) {
      if ((reactions[r.key]||[]).includes(userProfile.uid)) return r;
    }
    return null;
  };

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      {showReactionsModal && (
        <ReactionsModal reactions={showReactionsModal.reactions} allUsers={allUsers}
          onClose={()=>setShowReactionsModal(null)}/>
      )}

      <h1 className="page-header">Feed</h1>

      {/* Compose */}
      <div className="card">
        <div className="flex gap-3">
          <UserAvatar user={userProfile} size="md"/>
          <div className="flex-1">
            <textarea className="w-full resize-none bg-transparent text-sm focus:outline-none placeholder-gray-400 min-h-[72px]"
              placeholder={`What's on your mind, ${userProfile?.fullName?.split(' ')[0]}?`}
              value={newPost.text} onChange={e=>setNewPost(p=>({...p,text:e.target.value}))}/>
            {newPost.imagePreview && (
              <div className="relative inline-block mt-2">
                <img src={newPost.imagePreview} alt="" className="max-h-48 rounded-xl object-cover"/>
                <button onClick={()=>setNewPost(p=>({...p,image:null,imagePreview:null}))}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X size={12}/></button>
              </div>
            )}
            {newPost.isPoll && (
              <div className="mt-3 space-y-2 p-3 bg-primary-50 rounded-xl">
                <p className="text-xs font-semibold text-primary-700">Poll Options</p>
                {newPost.pollOptions.map((opt,i) => (
                  <input key={i} className="input text-sm" placeholder={`Option ${i+1}`} value={opt}
                    onChange={e=>{ const o=[...newPost.pollOptions]; o[i]=e.target.value; setNewPost(p=>({...p,pollOptions:o})); }}/>
                ))}
                {newPost.pollOptions.length<4 && (
                  <button className="text-xs text-primary-600 font-medium"
                    onClick={()=>setNewPost(p=>({...p,pollOptions:[...p.pollOptions,'']}))}>+ Add option</button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="divider"/>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-surface-100 text-gray-500 hover:text-primary-600 text-xs font-medium transition-all">
              <Image size={15}/> Photo
              <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect}/>
            </label>
            <button onClick={()=>setNewPost(p=>({...p,isPoll:!p.isPoll}))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${newPost.isPoll?'bg-primary-100 text-primary-700':'hover:bg-surface-100 text-gray-500'}`}>
              <BarChart2 size={15}/> Poll
            </button>
          </div>
          <button className="btn-primary py-2 px-4 text-xs" onClick={submitPost} disabled={submitting}>
            {submitting?<span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<Send size={14}/>}
            {submitting?'Posting...':'Post'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="card animate-pulse h-32 bg-surface-100"/>)}</div>
      ) : posts.length===0 ? (
        <div className="card text-center py-12 text-gray-400"><p>No posts yet. Be the first!</p></div>
      ) : posts.map(post => {
        const myR   = myReaction(post.reactions);
        const total = totalReactionCount(post.reactions);
        const isEditing = editingPostId === post.id;
        const authorUser = {
          uid:post.authorUid, fullName:post.authorName, photoURL:post.authorPhoto,
          role:post.authorRole, position:post.authorPosition, department:post.authorDept,
          batch:post.authorBatch, clubPosition:post.authorClubPosition, clubAffiliation:post.authorClubAffiliation
        };
        const timeAgo = post.createdAt?.toDate ? formatDistanceToNow(post.createdAt.toDate(),{addSuffix:true}) : 'just now';
        return (
          <div key={post.id} className="card animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={()=>navigate(`/profile/${post.authorUid}`)}>
                <UserAvatar user={authorUser} size="md"/>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold hover:text-primary-600 transition-colors">{post.authorName}</span>
                    <UserBadges user={authorUser} inline/>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="badge-dept">{post.authorDept}</span>
                    <span className="text-xs text-gray-400">{timeAgo}</span>
                    {post.editHistory?.length>0 && <span className="text-xs text-gray-400 italic">(edited)</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {post.authorUid===userProfile.uid && !isEditing && (
                  <button onClick={()=>{ setEditingPostId(post.id); setEditText(post.text); }}
                    className="text-gray-400 hover:text-primary-600 p-1 rounded-lg hover:bg-primary-50 transition-all">
                    <Edit2 size={14}/>
                  </button>
                )}
                {post.authorUid===userProfile.uid && (
                  <button onClick={()=>deletePost(post.id,post.authorUid)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            </div>

            {/* Content / Edit */}
            {isEditing ? (
              <div className="mb-3">
                <textarea className="input w-full resize-none min-h-[80px] text-sm" value={editText} onChange={e=>setEditText(e.target.value)}/>
                <div className="flex gap-2 mt-2">
                  <button onClick={()=>saveEdit(post.id, post.text)} className="btn-primary py-1.5 px-3 text-xs"><Check size={13}/> Save</button>
                  <button onClick={()=>setEditingPostId(null)} className="btn-ghost py-1.5 px-3 text-xs"><X size={13}/> Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {post.sharedFrom && <div className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Users size={11}/>Shared from {post.sharedFrom.authorName}</div>}
                {post.text && <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3 leading-relaxed">{post.text}</p>}
                {post.imageURL && <img src={post.imageURL} alt="" className="w-full rounded-xl object-cover max-h-80 mb-3"/>}
              </>
            )}

            {/* Poll */}
            {post.poll && (
              <div className="bg-primary-50 rounded-xl p-3 mb-3 space-y-2">
                {post.poll.options.map((opt,i) => {
                  const tv = post.poll.options.reduce((a,o)=>a+(o.votes?.length||0),0);
                  const pct = tv>0 ? Math.round((opt.votes?.length||0)/tv*100) : 0;
                  const voted = opt.votes?.includes(userProfile.uid);
                  return (
                    <button key={i} onClick={()=>votePoll(post,i)}
                      className={`w-full text-left rounded-lg overflow-hidden border-2 transition-all ${voted?'border-primary-500':'border-surface-200 hover:border-primary-300'}`}>
                      <div className="relative px-3 py-2">
                        <div className="absolute inset-0 bg-primary-100" style={{width:`${pct}%`}}/>
                        <div className="relative flex justify-between">
                          <span className="text-xs font-medium">{opt.text}</span>
                          <span className="text-xs font-bold text-primary-700">{pct}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Reaction summary */}
            {total>0 && (
              <button onClick={()=>setShowReactionsModal({reactions:post.reactions||{}})}
                className="flex items-center gap-1 mb-2 text-xs text-gray-500 hover:text-primary-600 transition-colors">
                <span className="flex -space-x-0.5">
                  {REACTIONS.filter(r=>(post.reactions?.[r.key]||[]).length>0).slice(0,3).map(r=>(
                    <span key={r.key} className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-white shadow-sm ring-1 ring-surface-200">{r.emoji}</span>
                  ))}
                </span>
                <span>{total}</span>
              </button>
            )}

            <div className="divider"/>

            {/* Action bar */}
            <div className="flex gap-1">
              {/* Reaction button with hover picker */}
              <div className="relative flex-1">
                {showReactionsPicker[post.id] && (
                  <ReactionPicker onPick={k=>handleReaction(post,k)} currentReaction={myR?.key}/>
                )}
                <button
                  onMouseEnter={()=>setShowReactionsPicker(p=>({...p,[post.id]:true}))}
                  onMouseLeave={()=>setTimeout(()=>setShowReactionsPicker(p=>({...p,[post.id]:false})),300)}
                  onClick={()=>handleReaction(post, myR?myR.key:'like')}
                  className={`flex items-center gap-1 w-full justify-center px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${myR?`${myR.color}`:'hover:bg-surface-100 text-gray-500'}`}>
                  <span>{myR?myR.emoji:'👍'}</span>
                  <span>{myR?myR.label:'React'}</span>
                </button>
              </div>

              <button onClick={()=>toggleComments(post.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-surface-100 text-gray-500 transition-all flex-1 justify-center">
                💬 {post.commentCount||0}
              </button>

              <button onClick={()=>sharePost(post)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-surface-100 text-gray-500 transition-all flex-1 justify-center">
                🔁 Share
              </button>
            </div>

            {/* Comments */}
            {expandedComments[post.id] && (
              <div className="mt-3 space-y-2">
                {(comments[post.id]||[]).map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div className="cursor-pointer" onClick={()=>navigate(`/profile/${c.authorUid}`)}>
                      <UserAvatar user={{fullName:c.authorName,photoURL:c.authorPhoto}} size="xs"/>
                    </div>
                    <div className="flex-1 bg-surface-50 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold">{c.authorName}</p>
                      <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <UserAvatar user={userProfile} size="xs"/>
                  <div className="flex-1 flex gap-1.5">
                    <MentionInput
                      className="input flex-1 text-xs py-1.5"
                      placeholder="Comment... use @ to mention"
                      value={commentText[post.id]||''}
                      onChange={v=>setCommentText(p=>({...p,[post.id]:v}))}
                      onKeyDown={e=>e.key==='Enter'&&addComment(post.id,post.authorUid)}
                      allUsers={allUsers}
                    />
                    <button onClick={()=>addComment(post.id,post.authorUid)}
                      className="btn-primary py-1.5 px-3 text-xs"><Send size={12}/></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
