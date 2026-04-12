// src/pages/NoticeBoardPage.jsx — mobile layout fixed
import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useAllUsers } from '../contexts/UsersContext';
import { ClipboardList, Plus, X, AlertCircle, Info, CheckCircle, Bell, ExternalLink, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { notifyDepartment } from '../utils/notifications';

const DEPARTMENTS = ['All','CSE','CSE Evening','EEE','FDT','English','Library','IT','Management','BBA','General'];
const TYPES = [
  { value:'general',  label:'General',  icon:Info,          color:'bg-blue-100 text-blue-700 border-blue-200' },
  { value:'urgent',   label:'Urgent',   icon:AlertCircle,   color:'bg-red-100 text-red-700 border-red-200' },
  { value:'academic', label:'Academic', icon:CheckCircle,   color:'bg-green-100 text-green-700 border-green-200' },
  { value:'exam',     label:'Exam',     icon:ClipboardList, color:'bg-amber-100 text-amber-700 border-amber-200' },
];

export default function NoticeBoardPage() {
  const { userProfile } = useAuth();
  const [notices,    setNotices]    = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [filterDept, setFilterDept] = useState('All');
  const [viewNotice, setViewNotice] = useState(null);
  const [form,       setForm]       = useState({ title:'', content:'', department:'General', type:'general', driveLink:'' });
  const [submitting, setSubmitting] = useState(false);
  const allUsers = useAllUsers();
  const canPost = userProfile?.role === 'authority';

  useEffect(() => {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, s => setNotices(s.docs.map(d => ({ id:d.id, ...d.data() }))));
  }, []);



  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) return toast.error('Title and content required');
    setSubmitting(true);
    try {
      const ref = await addDoc(collection(db, 'notices'), {
        ...form,
        authorUid:      userProfile.uid,
        authorName:     userProfile.fullName,
        authorPosition: userProfile.position || '',
        authorDept:     userProfile.department,
        authorRole:     userProfile.role,
        createdAt:      serverTimestamp(),
      });
      await notifyDepartment(form.department, userProfile.uid, 'notice',
        `📢 New notice: ${form.title}`, ref.id, allUsers);
      setForm({ title:'', content:'', department:'General', type:'general', driveLink:'' });
      setShowForm(false);
      toast.success('Notice posted & notifications sent!');
    } catch (err) {
      toast.error('Failed to post notice');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteNotice = async (id, authorUid) => {
    if (authorUid !== userProfile.uid) return toast.error('Not authorized');
    if (!confirm('Delete?')) return;
    await deleteDoc(doc(db, 'notices', id));
    toast.success('Deleted');
  };

  const filtered = notices.filter(n =>
    filterDept === 'All' || n.department === filterDept || n.department === 'General'
  );

  return (
    // overflow-hidden prevents any child from breaking the page width on mobile
    <div className="space-y-4 pb-20 md:pb-4 overflow-hidden">

      {/* ── Full notice modal ─────────────────────────────── */}
      {viewNotice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewNotice(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-surface-200 sticky top-0 bg-white">
              <h3 className="font-semibold text-sm break-words flex-1 pr-3">{viewNotice.title}</h3>
              <button onClick={() => setViewNotice(null)} className="text-gray-400 flex-shrink-0"><X size={18}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const t = TYPES.find(x => x.value === viewNotice.type);
                  if (!t) return null;
                  const Icon = t.icon;
                  return <span className={`flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.color}`}><Icon size={11}/>{t.label}</span>;
                })()}
                <span className="badge-dept">{viewNotice.department}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed break-words">{viewNotice.content}</p>
              {viewNotice.driveLink && (
                <a href={viewNotice.driveLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-blue-100 transition-all">
                  <ExternalLink size={14}/> View Attached Document
                </a>
              )}
              <div className="pt-3 border-t border-surface-200">
                <p className="text-xs font-medium text-gray-700">{viewNotice.authorName}</p>
                <p className="text-xs text-gray-400">{viewNotice.authorPosition} · {viewNotice.authorDept}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {viewNotice.createdAt?.toDate ? format(viewNotice.createdAt.toDate(), 'dd MMM yyyy, hh:mm a') : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="page-header mb-0">Notice Board</h1>
        {canPost && (
          <button onClick={() => setShowForm(p => !p)} className="btn-primary py-2 px-3 text-xs flex-shrink-0">
            <Plus size={15}/> Post Notice
          </button>
        )}
      </div>

      {!canPost && (
        <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-xl px-3 py-2.5">
          <Info size={14} className="text-primary-600 flex-shrink-0"/>
          <p className="text-xs text-primary-700">Only authority members can post notices.</p>
        </div>
      )}

      {/* ── Post Notice Form ──────────────────────────────── */}
      {showForm && canPost && (
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Post Notice</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400"><X size={16}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label">Title *</label>
              <input className="input" placeholder="Notice title" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}/>
            </div>
            {/* Stack selects vertically on mobile, side-by-side on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Department</label>
                <select className="input" value={form.department}
                  onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                  {DEPARTMENTS.filter(d => d !== 'All').map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Content *</label>
              <textarea className="input min-h-[120px] resize-none" placeholder="Notice details..."
                value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Google Drive Link (optional)</label>
              <input className="input" type="url" placeholder="https://drive.google.com/..."
                value={form.driveLink} onChange={e => setForm(p => ({ ...p, driveLink: e.target.value }))}/>
            </div>
            <button className="btn-primary w-full" disabled={submitting}>
              {submitting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : <Bell size={15}/>
              }
              Publish Notice
            </button>
          </form>
        </div>
      )}

      {/* ── Department filter — contained horizontal scroll ── */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-1.5" style={{ width: 'max-content', minWidth: '100%' }}>
          {DEPARTMENTS.map(dept => (
            <button key={dept} onClick={() => setFilterDept(dept)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filterDept === dept
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-500 hover:bg-primary-50 border border-surface-200'
              }`}>
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* ── Notices list ─────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <ClipboardList size={32} className="mx-auto mb-2 opacity-40"/>
          <p className="text-sm">No notices for {filterDept}</p>
        </div>
      ) : filtered.map(notice => {
        const ti   = TYPES.find(t => t.value === notice.type) || TYPES[0];
        const Icon = ti.icon;
        return (
          <div key={notice.id}
            className={`card border-l-4 animate-fade-in overflow-hidden w-full ${
              notice.type === 'urgent'   ? 'border-l-red-500'     :
              notice.type === 'exam'     ? 'border-l-amber-500'   :
              notice.type === 'academic' ? 'border-l-green-500'   :
              'border-l-primary-500'
            }`}>
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex-1 min-w-0 overflow-hidden">
                {/* Type + dept badges */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${ti.color}`}>
                    <Icon size={10}/>{ti.label}
                  </span>
                  <span className="badge-dept flex-shrink-0">{notice.department}</span>
                </div>
                {/* Title */}
                <h3 className="font-semibold text-sm text-surface-900 break-words">{notice.title}</h3>
                {/* Preview */}
                <p className="text-xs text-gray-600 mt-1 line-clamp-2 break-words">{notice.content}</p>
                {/* Author row */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap min-w-0">
                  <span className="text-xs text-gray-500 font-medium truncate">{notice.authorName}</span>
                  {notice.authorRole === 'authority' && (
                    <span className="badge-authority text-[10px] py-0 flex-shrink-0">{notice.authorPosition}</span>
                  )}
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {notice.createdAt?.toDate
                      ? formatDistanceToNow(notice.createdAt.toDate(), { addSuffix: true })
                      : ''}
                  </span>
                </div>
              </div>
              {notice.authorUid === userProfile.uid && (
                <button onClick={() => deleteNotice(notice.id, notice.authorUid)}
                  className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
                  <X size={15}/>
                </button>
              )}
            </div>
            {/* Footer actions */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-surface-200 flex-wrap">
              <button onClick={() => setViewNotice(notice)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                <Eye size={13}/> View Full Notice
              </button>
              {notice.driveLink && (
                <a href={notice.driveLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 ml-auto flex-shrink-0">
                  <ExternalLink size={11}/> Attachment
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
