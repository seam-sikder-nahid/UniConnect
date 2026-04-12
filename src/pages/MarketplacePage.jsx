// src/pages/MarketplacePage.jsx — v2 with contact seller → DM, mobile fix
import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage } from '../utils/cloudinary';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, Plus, X, Trash2, Image, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import UserAvatar from '../components/ui/UserAvatar';
import { useNavigate } from 'react-router-dom';
import { getDocs, query as q2, where } from 'firebase/firestore';

export default function MarketplacePage() {
  const { userProfile } = useAuth();
  const navigate   = useNavigate();
  const [listings,    setListings]    = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState({title:'',description:'',price:'',category:'Books',contact:''});
  const [imageFile,   setImageFile]   = useState(null);
  const [imagePreview,setImagePreview]= useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [filterCat,   setFilterCat]  = useState('All');
  const [contacting,  setContacting]  = useState(null);

  const CATS = ['All','Books','Electronics','Clothing','Stationery','Food','Services','Other'];

  useEffect(()=>{
    const q=query(collection(db,'marketplace'),orderBy('createdAt','desc'));
    return onSnapshot(q,s=>setListings(s.docs.map(d=>({id:d.id,...d.data()}))));
  },[]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title||!form.price) return toast.error('Title and price required');
    setSubmitting(true);
    try {
      let imageURL='';
      if (imageFile) imageURL=await uploadImage(imageFile,'uniconnect/marketplace');
      await addDoc(collection(db,'marketplace'),{
        ...form, imageURL,
        sellerUid:userProfile.uid, sellerName:userProfile.fullName,
        sellerDept:userProfile.department, sellerPhoto:userProfile.photoURL||'',
        sold:false, createdAt:serverTimestamp()
      });
      setForm({title:'',description:'',price:'',category:'Books',contact:''});
      setImageFile(null); setImagePreview(''); setShowForm(false);
      toast.success('Listed!');
    } catch(err){ toast.error('Failed'); }
    finally { setSubmitting(false); }
  };

  const deleteListing = async (id, sellerUid) => {
    if (sellerUid!==userProfile.uid) return toast.error('Not yours');
    if (!confirm('Delete?')) return;
    await deleteDoc(doc(db,'marketplace',id)); toast.success('Deleted');
  };

  const contactSeller = async (listing) => {
    if (listing.sellerUid===userProfile.uid) return;
    setContacting(listing.id);
    try {
      // Find or create DM conversation
      const convSnap = await getDocs(q2(collection(db,'conversations'),
        where('members','array-contains',userProfile.uid)));
      const existing = convSnap.docs.find(d=>{
        const data=d.data();
        return !data.isGroup&&data.members.includes(listing.sellerUid)&&data.members.length===2;
      });
      let convId;
      if (existing) {
        convId = existing.id;
      } else {
        const ref = await addDoc(collection(db,'conversations'),{
          members:[userProfile.uid, listing.sellerUid], isGroup:false,
          memberProfiles:{
            [userProfile.uid]:{name:userProfile.fullName,photo:userProfile.photoURL||''},
            [listing.sellerUid]:{name:listing.sellerName,photo:listing.sellerPhoto||''}
          },
          lastMessage:'', lastMessageAt:serverTimestamp(),
          unread:{[userProfile.uid]:0,[listing.sellerUid]:0},
          createdAt:serverTimestamp()
        });
        convId = ref.id;
        // Auto-send intro message
        await addDoc(collection(db,'conversations',convId,'messages'),{
          text:`Hi! I'm interested in your listing: "${listing.title}" (৳${listing.price})`,
          senderUid:userProfile.uid, senderName:userProfile.fullName,
          createdAt:serverTimestamp(), read:false
        });
        await import('firebase/firestore').then(({updateDoc})=>
          updateDoc(doc(db,'conversations',convId),{
            lastMessage:`Interested in: ${listing.title}`,
            lastMessageAt:serverTimestamp(),
            [`unread.${listing.sellerUid}`]:1
          })
        );
      }
      navigate(`/messages/${convId}`);
    } catch(err){ toast.error('Failed to open chat'); }
    finally { setContacting(null); }
  };

  const filtered = filterCat==='All' ? listings : listings.filter(l=>l.category===filterCat);

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <div className="flex items-center justify-between">
        <h1 className="page-header mb-0">Marketplace</h1>
        <button onClick={()=>setShowForm(p=>!p)} className="btn-primary py-2 px-3 text-xs"><Plus size={15}/> Sell Item</button>
      </div>

      {showForm && (
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">New Listing</h3>
            <button onClick={()=>setShowForm(false)} className="text-gray-400"><X size={16}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><label className="label">Title *</label>
              <input className="input" placeholder="What are you selling?" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Price (৳) *</label>
                <input className="input" type="number" placeholder="500" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))}/></div>
              <div><label className="label">Category</label>
                <select className="input" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                  {CATS.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
            <div><label className="label">Description</label>
              <textarea className="input min-h-[80px] resize-none" placeholder="Condition, details..." value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
            <div><label className="label">Contact Info</label>
              <input className="input" placeholder="Phone number or note" value={form.contact} onChange={e=>setForm(p=>({...p,contact:e.target.value}))}/></div>
            <div><label className="label">Photo</label>
              {imagePreview
                ? <div className="relative inline-block"><img src={imagePreview} className="h-32 w-32 rounded-xl object-cover"/>
                    <button type="button" onClick={()=>{setImageFile(null);setImagePreview('');}} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X size={12}/></button></div>
                : <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-surface-200 rounded-xl p-3 hover:border-primary-300 text-gray-400 hover:text-primary-600 transition-all">
                    <Image size={16}/><span className="text-sm">Upload photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(f){setImageFile(f);setImagePreview(URL.createObjectURL(f));}}}/>
                  </label>
              }
            </div>
            <button className="btn-primary w-full" disabled={submitting}>
              {submitting?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<ShoppingBag size={15}/>}
              Post Listing
            </button>
          </form>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {CATS.map(cat=>(
          <button key={cat} onClick={()=>setFilterCat(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filterCat===cat?'bg-primary-600 text-white shadow-sm':'bg-white text-gray-500 hover:bg-primary-50 border border-surface-200'}`}>
            {cat}
          </button>
        ))}
      </div>

      {filtered.length===0 ? (
        <div className="card text-center py-10 text-gray-400">
          <ShoppingBag size={32} className="mx-auto mb-2 opacity-40"/>
          <p className="text-sm">No listings{filterCat!=='All'?` in ${filterCat}`:''}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(listing=>(
            <div key={listing.id} className="card flex flex-col hover:shadow-md transition-all">
              {listing.imageURL && <img src={listing.imageURL} alt={listing.title} className="w-full h-40 object-cover rounded-xl mb-3"/>}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-surface-900 truncate">{listing.title}</h3>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs font-bold">৳{Number(listing.price).toLocaleString()}</span>
                    <span className="badge-dept">{listing.category}</span>
                  </div>
                </div>
                {listing.sellerUid===userProfile.uid && (
                  <button onClick={()=>deleteListing(listing.id,listing.sellerUid)} className="text-gray-300 hover:text-red-500 transition-colors p-1 flex-shrink-0"><Trash2 size={14}/></button>
                )}
              </div>
              {listing.description && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{listing.description}</p>}
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-surface-200">
                <UserAvatar user={{fullName:listing.sellerName,photoURL:listing.sellerPhoto}} size="xs"/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{listing.sellerName}</p>
                  <p className="text-[10px] text-gray-400">{listing.sellerDept}</p>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{listing.createdAt?.toDate?formatDistanceToNow(listing.createdAt.toDate(),{addSuffix:true}):''}</span>
              </div>
              {listing.sellerUid!==userProfile.uid && (
                <button onClick={()=>contactSeller(listing)} disabled={contacting===listing.id}
                  className="mt-2.5 btn-ghost py-2 w-full text-xs">
                  {contacting===listing.id?<span className="w-3.5 h-3.5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></span>:<MessageCircle size={13}/>}
                  Message Seller
                </button>
              )}
              {listing.contact && <p className="text-xs text-gray-400 mt-1 text-center">📞 {listing.contact}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
