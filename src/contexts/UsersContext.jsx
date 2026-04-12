// src/contexts/UsersContext.jsx
// Single global subscription to the 'users' collection.
// Now that isActive/lastActive are stored in 'presence' collection instead,
// this snapshot ONLY fires when real profile data changes (name, photo, etc.)
// — not on every heartbeat. This is the key to quota efficiency.
import { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const UsersContext = createContext([]);
export const useAllUsers = () => useContext(UsersContext);

export const UsersProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (!currentUser) { setAllUsers([]); return; }
    // This now only fires when actual profile data changes — never for heartbeats
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUser]);

  return (
    <UsersContext.Provider value={allUsers}>
      {children}
    </UsersContext.Provider>
  );
};
