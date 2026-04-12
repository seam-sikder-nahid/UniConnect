// src/components/ui/UserBadges.jsx
import { ShieldCheck, Star, Crown, Award } from 'lucide-react';

export default function UserBadges({ user, inline = false }) {
  if (!user) return null;
  const badges = [];

  if (user.role === 'authority') {
    badges.push(
      <span key="authority" className="badge-authority">
        <ShieldCheck size={11} />
        {user.position || 'Authority'}
      </span>
    );
  }

  if (user.clubPosition && user.clubAffiliation) {
    const icons = { President: Crown, 'Vice President': Star, 'General Secretary': Award };
    const Icon = icons[user.clubPosition] || Star;
    badges.push(
      <span key="club" className="badge-club">
        <Icon size={11} />
        {user.clubPosition}
      </span>
    );
  }

  if (badges.length === 0) return null;
  return <span className={`flex items-center gap-1 ${inline ? 'inline-flex' : 'flex-wrap'}`}>{badges}</span>;
}
