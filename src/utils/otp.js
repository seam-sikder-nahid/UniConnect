// src/utils/otp.js — OTP generation and sending via EmailJS
import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  || 'service_uniconnect';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_e80f8or';
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  || 'sqtwpuaDG-_Y6GtrP';

/** Generate a 6-digit OTP and store it in sessionStorage with a 10-min expiry */
export const generateOTP = () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
  sessionStorage.setItem('uc_otp', JSON.stringify({ code, expiry }));
  return code;
};

/** Verify OTP entered by user */
export const verifyOTP = (input) => {
  const raw = sessionStorage.getItem('uc_otp');
  if (!raw) return false;
  const { code, expiry } = JSON.parse(raw);
  if (Date.now() > expiry) { sessionStorage.removeItem('uc_otp'); return false; }
  if (input.trim() === code) { sessionStorage.removeItem('uc_otp'); return true; }
  return false;
};

/** Send OTP email via EmailJS */
export const sendOTPEmail = async (toEmail, toName, otp) => {
  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: toEmail,
      to_name:  toName  || toEmail.split('@')[0],
      otp_code: otp,
      app_name: 'UniConnect',
    },
    PUBLIC_KEY
  );
};
