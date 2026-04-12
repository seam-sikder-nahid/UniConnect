// src/components/auth/LoginForm.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { generateOTP, sendOTPEmail, verifyOTP } from '../../utils/otp';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { confirmPasswordReset, sendPasswordResetEmail } from 'firebase/auth';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn, KeyRound, Mail, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function LoginForm() {
  const { login } = useAuth();
  const [form, setForm]       = useState({ emailOrId:'', password:'' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  // Reset flow states
  const [mode, setMode]           = useState('login'); // 'login' | 'reset_email' | 'reset_otp' | 'reset_pass'
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp]     = useState('');
  const [newPass, setNewPass]       = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // ── login ──
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.emailOrId || !form.password) return toast.error('Fill in all fields');
    setLoading(true);
    try {
      await login(form.emailOrId, form.password);
      toast.success('Welcome back!');
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' ? 'Invalid credentials'
        : err.code === 'auth/too-many-requests' ? 'Too many attempts. Try later.'
        : err.message || 'Login failed';
      toast.error(msg);
    } finally { setLoading(false); }
  };

  // ── password reset: step 1 — find account & send OTP ──
  const handleSendResetOTP = async () => {
    if (!resetEmail) return toast.error('Enter your registered email');
    setResetLoading(true);
    try {
      const q = query(collection(db, 'users'), where('email','==', resetEmail));
      const snap = await getDocs(q);
      if (snap.empty) { toast.error('No account found with that email'); setResetLoading(false); return; }
      const code = generateOTP();
      await sendOTPEmail(resetEmail, snap.docs[0].data().fullName, code);
      toast.success('OTP sent to ' + resetEmail);
      setMode('reset_otp');
    } catch (err) {
      toast.error('Failed to send OTP');
    } finally { setResetLoading(false); }
  };

  // ── password reset: step 2 — verify OTP ──
  const handleVerifyResetOTP = () => {
    if (verifyOTP(resetOtp)) { toast.success('Verified!'); setMode('reset_pass'); }
    else toast.error('Invalid or expired code');
  };

  // ── password reset: step 3 — set new password via Firebase reset email ──
  const handleSetNewPassword = async () => {
    if (newPass.length < 6) return toast.error('Password must be at least 6 characters');
    setResetLoading(true);
    try {
      // Use Firebase's sendPasswordResetEmail which handles this securely
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success('Password reset email sent! Check your inbox to complete the reset.');
      setMode('login');
    } catch (err) {
      toast.error(err.message || 'Reset failed');
    } finally { setResetLoading(false); }
  };

  // ── render reset flow ──
  if (mode === 'reset_email') return (
    <div className="space-y-4">
      <button onClick={()=>setMode('login')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600">
        <ArrowLeft size={14}/> Back to login
      </button>
      <div className="text-center">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <KeyRound size={20} className="text-primary-600"/>
        </div>
        <h3 className="font-semibold">Reset Password</h3>
        <p className="text-xs text-gray-500 mt-1">Enter your registered email to receive an OTP</p>
      </div>
      <div>
        <label className="label">Registered Email</label>
        <input className="input" type="email" placeholder="your@email.com"
          value={resetEmail} onChange={e=>setResetEmail(e.target.value)}/>
      </div>
      <button onClick={handleSendResetOTP} disabled={resetLoading} className="btn-primary w-full">
        {resetLoading?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<Mail size={15}/>}
        Send OTP
      </button>
    </div>
  );

  if (mode === 'reset_otp') return (
    <div className="space-y-4 text-center">
      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-2">
        <ShieldCheck size={20} className="text-primary-600"/>
      </div>
      <p className="text-sm text-gray-600">Enter the OTP sent to <strong>{resetEmail}</strong></p>
      <input className="input text-center text-lg tracking-[0.3em] font-bold" maxLength={6}
        placeholder="••••••" value={resetOtp} onChange={e=>setResetOtp(e.target.value.replace(/\D/g,''))}/>
      <button onClick={handleVerifyResetOTP} disabled={resetOtp.length!==6} className="btn-primary w-full">
        <ShieldCheck size={15}/> Verify OTP
      </button>
      <button onClick={handleSendResetOTP} className="text-xs text-primary-600 hover:underline">Resend code</button>
    </div>
  );

  if (mode === 'reset_pass') return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-semibold">Set New Password</h3>
        <p className="text-xs text-gray-500 mt-1">A reset link will be sent to {resetEmail}</p>
      </div>
      <div>
        <label className="label">New Password</label>
        <input className="input" type="password" placeholder="Min 6 characters"
          value={newPass} onChange={e=>setNewPass(e.target.value)}/>
      </div>
      <button onClick={handleSetNewPassword} disabled={resetLoading} className="btn-primary w-full">
        {resetLoading?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<KeyRound size={15}/>}
        Send Reset Link
      </button>
    </div>
  );

  // ── default: login form ──
  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="label">Email or Student ID</label>
        <input className="input" placeholder="email@uttarauniversity.edu.bd or 2233081415"
          value={form.emailOrId} onChange={e=>setForm(p=>({...p, emailOrId:e.target.value}))}/>
      </div>
      <div>
        <label className="label">Password</label>
        <div className="relative">
          <input className="input pr-10" type={showPass?'text':'password'} placeholder="••••••••"
            value={form.password} onChange={e=>setForm(p=>({...p, password:e.target.value}))}/>
          <button type="button" onClick={()=>setShowPass(p=>!p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {showPass?<EyeOff size={16}/>:<Eye size={16}/>}
          </button>
        </div>
      </div>
      <button type="button" onClick={()=>setMode('reset_email')}
        className="text-xs text-primary-600 hover:underline flex items-center gap-1">
        <KeyRound size={11}/> Forgot password?
      </button>
      <button className="btn-primary w-full" disabled={loading}>
        {loading?<span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>:<LogIn size={16}/>}
        {loading?'Signing in...':'Sign In'}
      </button>
    </form>
  );
}
