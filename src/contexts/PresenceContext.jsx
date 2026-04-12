// src/contexts/PresenceContext.jsx
// Reads online/offline status from the SEPARATE 'presence' collection.
// This is the ONLY listener on presence data.
// Because presence is separate from users, heartbeat writes to 'presence'
// do NOT trigger the UsersContext snapshot → eliminates wasted reads entirely.
import { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const PresenceContext = createContext({});

// Returns a map of { [uid]: { isActive, lastActive } }
export const usePresence = () => useContext(PresenceContext);

// Convenience hook: get presence for a single user
export const useUserPresence = (uid) => {
  const presence = useContext(PresenceContext);
  return presence[uid] || { isActive: false, lastActive: null };
};

export const PresenceProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [presence, setPresence] = useState({});

  useEffect(() => {
    if (!currentUser) { setPresence({}); return; }

    // Subscribe to all presence docs (tiny documents, very cheap)
    const unsub = onSnapshot(collection(db, 'presence'), snap => {
      const map = {};
      snap.docs.forEach(d => {
        map[d.id] = d.data();
      });
      setPresence(map);
    });
    return unsub;
  }, [currentUser]);

  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  );
};
