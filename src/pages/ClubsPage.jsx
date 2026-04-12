// src/pages/ClubsPage.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { Users, ChevronRight, Crown, Star, Award } from 'lucide-react';
import UserAvatar from '../components/ui/UserAvatar';

const CLUBS = [
  { id: 'cybersecurity', name: 'Cybersecurity Club', icon: '🔐', color: 'bg-red-500', desc: 'Ethical hacking, CTF challenges, and cybersecurity awareness.' },
  { id: 'programming', name: 'Programming Club', icon: '💻', color: 'bg-primary-600', desc: 'Competitive programming, hackathons, and coding workshops.' },
  { id: 'robotics', name: 'Robotics Club', icon: '🤖', color: 'bg-purple-600', desc: 'Build and program robots for competitions and projects.' },
  { id: 'cultural', name: 'Cultural Club', icon: '🎭', color: 'bg-amber-500', desc: 'Celebrate culture through arts, music, drama, and events.' },
  { id: 'debate', name: 'Debate Club', icon: '🗣️', color: 'bg-green-600', desc: 'Sharpen your argumentation and public speaking skills.' },
  { id: 'photography', name: 'Photography Club', icon: '📷', color: 'bg-rose-500', desc: 'Capture moments, learn editing, and showcase your work.' },
  { id: 'sports', name: 'Sports Club', icon: '⚽', color: 'bg-orange-500', desc: 'Football, cricket, badminton, and fitness activities.' },
  { id: 'volunteer', name: 'Volunteer Club', icon: '🤝', color: 'bg-teal-600', desc: 'Community service, social work, and humanitarian activities.' },
];

const ROLE_ICONS = { President: Crown, 'Vice President': Star, 'General Secretary': Award };

export default function ClubsPage() {
  const { userProfile } = useAuth();
  const [activeClub, setActiveClub] = useState(null);
  const [clubMembers, setClubMembers] = useState({});
  const [clubPosts, setClubPosts] = useState({});

  const loadClubData = async (clubName) => {
    // Load members
    if (!clubMembers[clubName]) {
      const q = query(collection(db, 'users'), where('clubAffiliation', '==', clubName));
      const snap = await getDocs(q);
      setClubMembers(p => ({ ...p, [clubName]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    }
    // Load posts tagged with this club
    if (!clubPosts[clubName]) {
      const q = query(collection(db, 'posts'), where('clubTag', '==', clubName), orderBy('createdAt', 'desc'));
      onSnapshot(q, snap => {
        setClubPosts(p => ({ ...p, [clubName]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
      });
    }
  };

  const openClub = (club) => {
    setActiveClub(club);
    loadClubData(club.name);
  };

  const members = clubMembers[activeClub?.name] || [];
  const committee = members.filter(m => m.clubPosition && m.clubPosition !== 'Member');
  const regularMembers = members.filter(m => !m.clubPosition || m.clubPosition === 'Member');

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      {activeClub ? (
        // Club Detail View
        <div className="animate-fade-in">
          <button onClick={() => setActiveClub(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 mb-4 transition-colors">
            ← Back to Clubs
          </button>

          {/* Club Header */}
          <div className={`${activeClub.color} rounded-2xl p-6 text-white mb-4 shadow-lg`}>
            <div className="text-4xl mb-2">{activeClub.icon}</div>
            <h2 className="font-display font-bold text-xl">{activeClub.name}</h2>
            <p className="text-white/80 text-sm mt-1">{activeClub.desc}</p>
            <div className="mt-3 flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1.5 w-fit">
              <Users size={13} />
              <span className="text-xs font-medium">{members.length} members</span>
            </div>
          </div>

          {/* Committee */}
          {committee.length > 0 && (
            <div className="card mb-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Crown size={15} className="text-amber-500" /> Committee</h3>
              <div className="space-y-2.5">
                {committee.map(m => {
                  const Icon = ROLE_ICONS[m.clubPosition] || Star;
                  return (
                    <div key={m.uid} className="flex items-center gap-3 p-2.5 bg-amber-50 rounded-xl">
                      <UserAvatar user={m} size="md" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{m.fullName}</p>
                        <p className="text-xs text-gray-500">{m.department}</p>
                      </div>
                      <span className="flex items-center gap-1 bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        <Icon size={10} /> {m.clubPosition}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Members */}
          {regularMembers.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Users size={15} className="text-primary-600" /> Members ({regularMembers.length})</h3>
              <div className="grid grid-cols-2 gap-2">
                {regularMembers.map(m => (
                  <div key={m.uid} className="flex items-center gap-2 p-2 bg-surface-50 rounded-xl">
                    <UserAvatar user={m} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{m.fullName}</p>
                      <p className="text-[10px] text-gray-400">{m.department}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {members.length === 0 && (
            <div className="card text-center py-8 text-gray-400">
              <p className="text-sm">No members found for this club</p>
            </div>
          )}
        </div>
      ) : (
        // Clubs Grid
        <>
          <h1 className="page-header">University Clubs</h1>
          {userProfile?.clubAffiliation && (
            <div className="card bg-primary-50 border-primary-200">
              <p className="text-xs font-semibold text-primary-700 mb-1">Your Club</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-primary-900">{userProfile.clubAffiliation}</p>
                  {userProfile.clubPosition && <p className="text-xs text-primary-600">{userProfile.clubPosition}</p>}
                </div>
                <button onClick={() => openClub(CLUBS.find(c => c.name === userProfile.clubAffiliation) || { name: userProfile.clubAffiliation, icon: '🏛️', color: 'bg-primary-600', desc: '' })}
                  className="btn-primary py-1.5 px-3 text-xs">View Club</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CLUBS.map(club => (
              <button key={club.id} onClick={() => openClub(club)}
                className="card text-left hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className="flex items-start gap-3">
                  <div className={`${club.color} w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm flex-shrink-0`}>{club.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-surface-900 group-hover:text-primary-700 transition-colors">{club.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{club.desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
