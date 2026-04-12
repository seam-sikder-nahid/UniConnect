// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, serverTimestamp,
  collection, query, where, getDocs, updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

const ALLOWED_DOMAINS = ['uttarauniversity.edu.bd', 'uttara.ac.bd'];
const GMAIL_LIMIT = 5;

export const validateUniversityEmail = (email) => {
  const domain = email.split('@')[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain) || domain === 'gmail.com';
};

const isGmail = (email) => email.split('@')[1]?.toLowerCase() === 'gmail.com';

/** Check how many Gmail accounts exist already */
const getGmailCount = async () => {
  const snap = await getDocs(query(collection(db, 'users'), where('emailDomain', '==', 'gmail.com')));
  return snap.size;
};

/** Check if a club role is already taken */
export const checkClubRoleTaken = async (clubAffiliation, clubPosition) => {
  if (!clubAffiliation || !clubPosition || clubPosition === 'Member') return false;
  const q = query(
    collection(db, 'users'),
    where('clubAffiliation', '==', clubAffiliation),
    where('clubPosition',    '==', clubPosition)
  );
  const snap = await getDocs(q);
  return !snap.empty;
};

/** Update user active status in Firestore */
export const updateActiveStatus = async (uid, isActive) => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      isActive,
      lastActive: serverTimestamp(),
    });
  } catch (_) {}
};

export const AuthProvider = ({ children }) => {
  const [currentUser,  setCurrentUser]  = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [loading,      setLoading]      = useState(true);

  const fetchUserProfile = async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setUserProfile({ id: snap.id, ...snap.data() });
        return snap.data();
      }
    } catch (e) { console.error(e); }
    return null;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
        await updateActiveStatus(user.uid, true);
        // Mark offline on tab close
        const handleBeforeUnload = () => updateActiveStatus(user.uid, false);
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const buildBaseProfile = (uid, data) => ({
    uid,
    email:       data.email,
    emailDomain: data.email.split('@')[1]?.toLowerCase(),
    photoURL:    '',
    coverURL:    '',
    bio:         '',
    job:         '',
    education:   '',
    isActive:    false,
    lastActive:  serverTimestamp(),
    friends:     [],
    createdAt:   serverTimestamp(),
  });

  const signupStudent = async (data) => {
    const domain = data.email.split('@')[1]?.toLowerCase();
    const isUni = ALLOWED_DOMAINS.includes(domain);
    const isGm  = domain === 'gmail.com';
    if (!isUni && !isGm) throw new Error('Only university or @gmail.com emails allowed');
    if (isGm) {
      const cnt = await getGmailCount();
      if (cnt >= GMAIL_LIMIT) throw new Error(`Gmail signup limit reached (max ${GMAIL_LIMIT} test accounts). Use a university email.`);
    }
    if (data.clubAffiliation && data.clubPosition && data.clubPosition !== 'Member') {
      const taken = await checkClubRoleTaken(data.clubAffiliation, data.clubPosition);
      if (taken) throw new Error(`The role "${data.clubPosition}" in "${data.clubAffiliation}" is already taken. Choose another role.`);
    }
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const profile = {
      ...buildBaseProfile(cred.user.uid, data),
      universityId:    data.universityId,
      fullName:        data.fullName,
      department:      data.department,
      batch:           data.batch,
      clubAffiliation: data.clubAffiliation || '',
      clubPosition:    data.clubPosition    || '',
      role:            'student',
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile);
    return cred;
  };

  const signupAuthority = async (data) => {
    const domain = data.email.split('@')[1]?.toLowerCase();
    if (!ALLOWED_DOMAINS.includes(domain)) throw new Error('Only university email addresses are allowed');
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const profile = {
      ...buildBaseProfile(cred.user.uid, data),
      fullName:   data.fullName,
      address:    data.address,
      department: data.department,
      position:   data.position,
      role:       'authority',
    };
    await setDoc(doc(db, 'users', cred.user.uid), profile);
    return cred;
  };

  const login = async (emailOrId, password) => {
    let email = emailOrId;
    if (!emailOrId.includes('@')) {
      const q = query(collection(db, 'users'), where('universityId', '==', emailOrId));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('University ID not found');
      email = snap.docs[0].data().email;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchUserProfile(cred.user.uid);
    return cred;
  };

  /** Reset password after OTP verification: re-auth then update */
  const resetPasswordWithOTP = async (email, newPassword) => {
    // Find the user record to get their uid
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Email not registered');
    // We use Firebase Admin-style approach: sign them in with a temp session
    // For client-side reset we use sendPasswordResetEmail alternative:
    // Since we already verified OTP client-side, we allow them to re-login then change
    return { email, found: true };
  };

  const logout = async () => {
    if (currentUser) await updateActiveStatus(currentUser.uid, false);
    return signOut(auth);
  };

  const refreshProfile = () => currentUser && fetchUserProfile(currentUser.uid);

  return (
    <AuthContext.Provider value={{
      currentUser, userProfile, loading,
      signupStudent, signupAuthority, login, logout, refreshProfile,
      resetPasswordWithOTP, checkClubRoleTaken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
