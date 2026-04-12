// src/components/auth/SignupForm.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { generateOTP, sendOTPEmail, verifyOTP } from '../../utils/otp';
import toast from 'react-hot-toast';
import { UserCheck, GraduationCap, Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react';

const DEPARTMENTS   = ['CSE','CSE Evening','EEE','FDT','English','Library','IT','Management','BBA','Law','Architecture'];
const POSITIONS     = ['Faculty','IT Officer','Librarian','Admin','Dean','Director','Registrar','Staff'];
const CLUBS         = ['Cybersecurity Club','Programming Club','Robotics Club','Cultural Club','Debate Club','Photography Club','Sports Club','Volunteer Club'];
const CLUB_POSITIONS= ['President','Vice President','General Secretary','AGS','Treasurer','Member'];

// OTP step component
function OTPStep({ email, name, onVerified, onBack }) {
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async () => {
    setSending(true);
    try {
      const code = generateOTP();
      await sendOTPEmail(email, name, code);
      setSent(true);
      toast.success('OTP sent to ' + email);
    } catch (err) {
      toast.error('Failed to send OTP: ' + (err?.text || err.message || 'Check EmailJS config'));
    } finally { setSending(false); }
  };

  const verify = () => {
    setVerifying(true);
    if (verifyOTP(otp)) {
      toast.success('Email verified!');
      onVerified();
    } else {
      toast.error('Invalid or expired OTP. Try again.');
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4 text-center">
      <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
        <Mail size={24} className="text-primary-600" />
      </div>
      <div>
        <h3 className="font-semibold text-surface-900">Verify your email</h3>
        <p className="text-xs text-gray-500 mt-1">We'll send a 6-digit code to<br/><strong>{email}</strong></p>
      </div>
      {!sent ? (
        <button onClick={sendCode} disabled={sending} className="btn-primary w-full">
          {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <Mail size={15}/>}
          {sending ? 'Sending...' : 'Send Verification Code'}
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Enter 6-digit OTP</label>
            <input className="input text-center text-lg tracking-[0.3em] font-bold" maxLength={6}
              placeholder="••••••" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,''))} />
          </div>
          <button onClick={verify} disabled={verifying || otp.length !== 6} className="btn-primary w-full">
            <ShieldCheck size={15}/> Verify & Create Account
          </button>
          <button onClick={sendCode} className="text-xs text-primary-600 hover:underline">Resend code</button>
        </div>
      )}
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600">← Back to form</button>
    </div>
  );
}

export default function SignupForm({ onSuccess }) {
  const { signupStudent, signupAuthority, checkClubRoleTaken } = useAuth();
  const [type, setType] = useState('student');
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [loading, setLoading] = useState(false);

  const [sf, setSf] = useState({
    universityId:'', email:'', password:'', fullName:'',
    department:'', batch:'', clubAffiliation:'', clubPosition:''
  });
  const [af, setAf] = useState({
    email:'', password:'', fullName:'', address:'', department:'', position:''
  });

  const upS = e => setSf(p => ({...p, [e.target.name]: e.target.value}));
  const upA = e => setAf(p => ({...p, [e.target.name]: e.target.value}));

  const validateAndGoOTP = async (e) => {
    e.preventDefault();
    const form = type === 'student' ? sf : af;
    if (!form.email || !form.password || !form.fullName || !form.department)
      return toast.error('Please fill all required fields');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    if (type === 'student') {
      if (!sf.universityId || !sf.batch) return toast.error('Student ID and batch are required');
      if (sf.clubAffiliation && sf.clubPosition && sf.clubPosition !== 'Member') {
        setLoading(true);
        const taken = await checkClubRoleTaken(sf.clubAffiliation, sf.clubPosition);
        setLoading(false);
        if (taken) return toast.error(`"${sf.clubPosition}" in "${sf.clubAffiliation}" is already taken`);
      }
    } else {
      if (!af.position) return toast.error('Position is required');
    }
    setStep('otp');
  };

  const handleOTPVerified = async () => {
    setLoading(true);
    try {
      if (type === 'student') await signupStudent(sf);
      else await signupAuthority(af);
      toast.success('Account created! You can now log in.');
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || 'Signup failed');
      setStep('form');
    } finally { setLoading(false); }
  };

  if (step === 'otp') {
    const form = type === 'student' ? sf : af;
    return <OTPStep email={form.email} name={form.fullName} onVerified={handleOTPVerified} onBack={() => setStep('form')} />;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[['student', GraduationCap,'Student'],['authority', UserCheck,'Authority']].map(([v, Icon, label]) => (
          <button key={v} type="button" onClick={() => setType(v)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${type===v?'border-primary-600 bg-primary-50 text-primary-700':'border-surface-200 text-gray-500'}`}>
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      {type === 'student' ? (
        <form onSubmit={validateAndGoOTP} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Student ID *</label>
              <input className="input" name="universityId" placeholder="2233081415" value={sf.universityId} onChange={upS}/></div>
            <div><label className="label">Batch *</label>
              <input className="input" name="batch" placeholder="60" value={sf.batch} onChange={upS}/></div>
          </div>
          <div><label className="label">Full Name *</label>
            <input className="input" name="fullName" placeholder="Your full name" value={sf.fullName} onChange={upS}/></div>
          <div><label className="label">Email *</label>
            <input className="input" name="email" type="email" placeholder="id@uttarauniversity.edu.bd" value={sf.email} onChange={upS}/></div>
          <div><label className="label">Department *</label>
            <select className="input" name="department" value={sf.department} onChange={upS}>
              <option value="">Select Department</option>
              {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Club</label>
              <select className="input" name="clubAffiliation" value={sf.clubAffiliation} onChange={upS}>
                <option value="">None</option>
                {CLUBS.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Club Role</label>
              <select className="input" name="clubPosition" value={sf.clubPosition} onChange={upS} disabled={!sf.clubAffiliation}>
                <option value="">None</option>
                {CLUB_POSITIONS.map(p=><option key={p}>{p}</option>)}</select></div>
          </div>
          <div><label className="label">Password *</label>
            <div className="relative">
              <input className="input pr-10" name="password" type={showPass?'text':'password'} placeholder="Min 6 chars" value={sf.password} onChange={upS}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<Mail size={15}/>}
            Continue → Verify Email
          </button>
        </form>
      ) : (
        <form onSubmit={validateAndGoOTP} className="space-y-3">
          <div><label className="label">Full Name *</label>
            <input className="input" name="fullName" placeholder="Your full name" value={af.fullName} onChange={upA}/></div>
          <div><label className="label">University Email *</label>
            <input className="input" name="email" type="email" placeholder="name@uttarauniversity.edu.bd" value={af.email} onChange={upA}/></div>
          <div><label className="label">Address</label>
            <input className="input" name="address" placeholder="Your address" value={af.address} onChange={upA}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Department *</label>
              <select className="input" name="department" value={af.department} onChange={upA}>
                <option value="">Select</option>
                {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}</select></div>
            <div><label className="label">Position *</label>
              <select className="input" name="position" value={af.position} onChange={upA}>
                <option value="">Select</option>
                {POSITIONS.map(p=><option key={p}>{p}</option>)}</select></div>
          </div>
          <div><label className="label">Password *</label>
            <div className="relative">
              <input className="input pr-10" name="password" type={showPass?'text':'password'} placeholder="Min 6 chars" value={af.password} onChange={upA}/>
              <button type="button" onClick={()=>setShowPass(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass?<EyeOff size={15}/>:<Eye size={15}/>}</button></div></div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<Mail size={15}/>}
            Continue → Verify Email
          </button>
        </form>
      )}
    </div>
  );
}
