// src/components/ui/UserAvatar.jsx
export default function UserAvatar({ user, size = 'md', className = '' }) {
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-14 h-14 text-xl', xl: 'w-20 h-20 text-2xl' };
  const sizeClass = sizes[size] || sizes.md;
  const initials = user?.fullName?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';

  if (user?.photoURL) {
    return <img src={user.photoURL} alt={user.fullName} className={`${sizeClass} rounded-full object-cover ${className}`} />;
  }
  // Color from name
  const colors = ['bg-primary-100 text-primary-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-purple-100 text-purple-700'];
  const color = colors[(user?.fullName?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold ${color} flex-shrink-0 ${className}`}>
      {initials}
    </div>
  );
}
