// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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

const getGmailCount = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('emailDomain', '==', 'gmail.com')));
    return snap.size;
  } catch (_) { return 0; }
};

export const checkClubRoleTaken = async (clubAffiliation, clubPosition) => {
  if (!clubAffiliation || !clubPosition || clubPosition === 'Member') return false;
  const snap = await getDocs(query(
    collection(db, 'users'),
    where('clubAffiliation', '==', clubAffiliation),
    where('clubPosition',    '==', clubPosition)
  ));
  return !snap.empty;
};

// ── Presence: writes to a SEPARATE 'presence' collection ──────
// This means heartbeat writes NEVER touch 'users' collection,
// so they NEVER trigger the UsersContext snapshot → zero wasted reads.
export const updatePresence = async (uid, isActive) => {
  try {
    await setDoc(doc(db, 'presence', uid), {
      isActive,
      lastActive: serverTimestamp(),
      uid,
    }, { merge: true });
  } catch (_) {}
};

/**
 * Presence tracking — writes only to 'presence' collection, never 'users'.
 * Heartbeat every 5 minutes.
 * Inactivity timeout: 5 minutes.
 */
const startActivityTracking = (uid) => {
  updatePresence(uid, true);

  let inactivityTimer = null;
  const INACTIVITY_MS = 5 * 60 * 1000;

  const setOffline = () => {
    clearTimeout(inactivityTimer);
    updatePresence(uid, false);
  };
  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(setOffline, INACTIVITY_MS);
  };

  // Heartbeat every 5 minutes while tab is visible
  const heartbeat = setInterval(() => {
    if (!document.hidden) updatePresence(uid, true);
  }, 5 * 60_000);

  // Tab visibility
  const handleVisibility = () => {
    if (document.hidden) { clearTimeout(inactivityTimer); updatePresence(uid, false); }
    else { updatePresence(uid, true); resetTimer(); }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // User activity — throttled to one write per 60 seconds max
  let lastWrite = 0;
  const handleActivity = () => {
    const now = Date.now();
    if (now - lastWrite > 60_000) {
      lastWrite = now;
      if (!document.hidden) resetTimer();
    }
  };
  const events = ['mousemove', 'keydown', 'touchstart', 'click'];
  events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));

  window.addEventListener('beforeunload', setOffline);
  resetTimer();

  return () => {
    clearInterval(heartbeat);
    clearTimeout(inactivityTimer);
    document.removeEventListener('visibilitychange', handleVisibility);
    events.forEach(e => document.removeEventListener(e, handleActivity));
    window.removeEventListener('beforeunload', setOffline);
    updatePresence(uid, false);
  };
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);

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
    let stopTracking = null;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (stopTracking) { stopTracking(); stopTracking = null; }
      setCurrentUser(user);
      if (user) {
        try {
          await fetchUserProfile(user.uid);
          stopTracking = startActivityTracking(user.uid);
        } catch (e) {
          console.error('Auth init error:', e);
        } finally {
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });
    return () => { unsub(); if (stopTracking) stopTracking(); };
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
    friends:     [],
    createdAt:   serverTimestamp(),
  });

  const signupStudent = async (data) => {
    const domain = data.email.split('@')[1]?.toLowerCase();
    const isUni  = ALLOWED_DOMAINS.includes(domain);
    const isGm   = domain === 'gmail.com';
    if (!isUni && !isGm)
      throw new Error('Only university emails or Gmail test accounts are allowed.');
    if (isGm) {
      const cnt = await getGmailCount();
      if (cnt >= GMAIL_LIMIT)
        throw new Error(`Gmail test account limit reached (${GMAIL_LIMIT} max). Use your university email.`);
    }
    if (data.clubAffiliation && data.clubPosition && data.clubPosition !== 'Member') {
      const taken = await checkClubRoleTaken(data.clubAffiliation, data.clubPosition);
      if (taken) throw new Error(`The role "${data.clubPosition}" in "${data.clubAffiliation}" is already taken.`);
    }
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...buildBaseProfile(cred.user.uid, data),
      universityId:    data.universityId,
      fullName:        data.fullName,
      department:      data.department,
      batch:           data.batch,
      clubAffiliation: data.clubAffiliation || '',
      clubPosition:    data.clubPosition    || '',
      role:            'student',
    });
    return cred;
  };

  const signupAuthority = async (data) => {
    const domain = data.email.split('@')[1]?.toLowerCase();
    if (!ALLOWED_DOMAINS.includes(domain))
      throw new Error('Only university email addresses are allowed for authority accounts.');
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...buildBaseProfile(cred.user.uid, data),
      fullName:   data.fullName,
      address:    data.address,
      department: data.department,
      position:   data.position,
      role:       'authority',
    });
    return cred;
  };

  const login = async (emailOrId, password) => {
    let email = emailOrId;
    if (!emailOrId.includes('@')) {
      const snap = await getDocs(query(collection(db, 'users'), where('universityId', '==', emailOrId)));
      if (snap.empty) throw new Error('University ID not found');
      email = snap.docs[0].data().email;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await fetchUserProfile(cred.user.uid);
    return cred;
  };

  const logout = async () => {
    if (currentUser) await updatePresence(currentUser.uid, false);
    return signOut(auth);
  };

  const refreshProfile = () => currentUser && fetchUserProfile(currentUser.uid);

  return (
    <AuthContext.Provider value={{
      currentUser, userProfile, loading,
      signupStudent, signupAuthority, login, logout, refreshProfile,
      checkClubRoleTaken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
