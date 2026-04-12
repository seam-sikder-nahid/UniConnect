// src/pages/EventsPage.jsx — v2 with photo upload, Interested, dept notifications
import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, orderBy, query, serverTimestamp,
  deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadImage } from '../utils/cloudinary';
import { useAuth } from '../contexts/AuthContext';
import { useAllUsers } from '../contexts/UsersContext';
import { Calendar, Plus, X, Clock, MapPin, Users, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isFuture, isToday } from 'date-fns';
import { notifyDepartment } from '../utils/notifications';

export default function EventsPage() {
  const { userProfile } = useAuth();
  const allUsers = useAllUsers();
  const [events,     setEvents]     = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [tab,        setTab]        = useState('upcoming');
  const [form,       setForm]       = useState({title:'',description:'',date:'',time:'',location:''});
  const [imageFile,  setImageFile]  = useState(null);
  const [imagePreview,setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [interestedModal, setInterestedModal] = useState(null);

  useEffect(() => {
    const q = query(collection(db,'events'), orderBy('date','asc'));
    return onSnapshot(q, snap=>setEvents(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title||!form.date) return toast.error('Title and date required');
    setSubmitting(true);
    try {
      let imageURL = '';
      if (imageFile) imageURL = await uploadImage(imageFile,'uniconnect/events');
      const ref = await addDoc(collection(db,'events'),{
        ...form, imageURL,
        organizerUid:userProfile.uid, organizerName:userProfile.fullName,
        organizerRole:userProfile.role, organizerDept:userProfile.department,
        interested:[], createdAt:serverTimestamp()
      });
      // Notify dept
      await notifyDepartment(userProfile.department, userProfile.uid, 'event',
        `📅 New event: ${form.title} on ${form.date}`, ref.id, allUsers);
      setForm({title:'',description:'',date:'',time:'',location:''});
      setImageFile(null); setImagePreview(''); setShowForm(false);
      toast.success('Event created & notifications sent!');
    } catch(err) { toast.error('Failed: '+err.message); }
    finally { setSubmitting(false); }
  };

  const toggleInterested = async (event) => {
    const uid = userProfile.uid;
    const has = (event.interested||[]).includes(uid);
    await updateDoc(doc(db,'events',event.id),{
      interested: has ? arrayRemove(uid) : arrayUnion(uid)
    });
  };

  const deleteEvent = async (id, orgUid) => {
    if (orgUid!==userProfile.uid) return toast.error('Not authorized');
    if (!confirm('Delete?')) return;
    await deleteDoc(doc(db,'events',id)); toast.success('Deleted');
  };

  const getStatus = (ev) => {
    const d = new Date(`${ev.date}T${ev.time||'00:00'}`);
    return isToday(d)?'running':isFuture(d)?'upcoming':'past';
  };
  const filtered = events.filter(e=>getStatus(e)===tab);

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      {/* Interested Users Modal */}
      {interestedModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setInterestedModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-surface-200">
              <h3 className="font-semibold text-sm">Interested ({interestedModal.length})</h3>
              <button onClick={()=>setInterestedModal(null)} className="text-gray-400"><X size={16}/></button>
            </div>
            <div className="max-h-60 overflow-y-auto p-3 space-y-2">
              {interestedModal.map(uid=>{
                const u = allUsers.find(x=>x.uid===uid);
                return u?(
                  <div key={uid} className="flex items-center gap-2">
                    <img src={u.photoURL||''} onError={e=>{e.target.style.display='none'}} className="w-7 h-7 rounded-full"/>
                    <span className="text-sm">{u.fullName}</span>
                    <span className="badge-dept ml-auto">{u.department}</span>
                  </div>
                ):null;
              })}
              {interestedModal.length===0 && <p className="text-xs text-gray-400 text-center py-4">No one yet</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="page-header mb-0">Events</h1>
        <button onClick={()=>setShowForm(p=>!p)} className="btn-primary py-2 px-3 text-xs">
          <Plus size={15}/> Create Event
        </button>
      </div>

      {showForm && (
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">New Event</h3>
            <button onClick={()=>setShowForm(false)} className="text-gray-400"><X size={16}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><label className="label">Title *</label>
              <input className="input" placeholder="Event title" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
            <div><label className="label">Description</label>
              <textarea className="input min-h-[80px] resize-none" placeholder="Details..." value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Date *</label>
                <input className="input" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
              <div><label className="label">Time</label>
                <input className="input" type="time" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}/></div>
            </div>
            <div><label className="label">Location</label>
              <input className="input" placeholder="Room, Auditorium..." value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}/></div>
            <div><label className="label">Event Photo</label>
              {imagePreview
                ? <div className="relative inline-block"><img src={imagePreview} className="h-32 w-full object-cover rounded-xl"/>
                    <button type="button" onClick={()=>{setImageFile(null);setImagePreview('');}} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"><X size={12}/></button></div>
                : <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-surface-200 rounded-xl p-3 hover:border-primary-300 text-gray-400 hover:text-primary-600 transition-all">
                    <Calendar size={16}/><span className="text-sm">Upload photo (optional)</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];if(f){setImageFile(f);setImagePreview(URL.createObjectURL(f));}}}/>
                  </label>
              }
            </div>
            <button className="btn-primary w-full" disabled={submitting}>
              {submitting?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<Calendar size={15}/>}
              Create Event
            </button>
          </form>
        </div>
      )}

      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-surface-200">
        {[['upcoming','Upcoming'],['running','Today'],['past','Past']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${tab===k?'bg-primary-600 text-white shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length===0 ? (
        <div className="card text-center py-10 text-gray-400">
          <Calendar size={32} className="mx-auto mb-2 opacity-40"/>
          <p className="text-sm">No {tab} events</p>
        </div>
      ) : filtered.map(event=>{
        const isInterested = (event.interested||[]).includes(userProfile.uid);
        const intCount = event.interested?.length||0;
        return (
          <div key={event.id} className="card animate-fade-in">
            {event.imageURL && <img src={event.imageURL} alt="" className="w-full h-40 object-cover rounded-xl mb-3"/>}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-xl flex flex-col items-center justify-center text-white shadow-sm">
                <span className="text-[10px] font-bold leading-none">{event.date?format(new Date(event.date),'MMM'):'—'}</span>
                <span className="text-lg font-bold leading-none">{event.date?format(new Date(event.date),'d'):'—'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-surface-900">{event.title}</h3>
                {event.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>}
                <div className="flex flex-wrap gap-3 mt-2">
                  {event.time && <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={11}/>{event.time}</span>}
                  {event.location && <span className="flex items-center gap-1 text-xs text-gray-400"><MapPin size={11}/>{event.location}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">By {event.organizerName} · {event.organizerDept}</p>
              </div>
              {event.organizerUid===userProfile.uid && (
                <button onClick={()=>deleteEvent(event.id,event.organizerUid)} className="text-gray-300 hover:text-red-500 transition-colors"><X size={15}/></button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-200">
              <button onClick={()=>toggleInterested(event)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isInterested?'bg-amber-100 text-amber-700 border border-amber-200':'btn-ghost'}`}>
                <Star size={13} className={isInterested?'fill-amber-500 text-amber-500':''}/> {isInterested?'Interested':'I\'m Interested'}
              </button>
              {intCount>0 && (
                <button onClick={()=>setInterestedModal(event.interested||[])}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 transition-colors">
                  <Users size={12}/> {intCount} interested
                </button>
              )}
              {tab==='running' && (
                <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Live
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
