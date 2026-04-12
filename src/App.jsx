// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import DashboardLayout from './components/layout/DashboardLayout';
import FeedPage from './pages/FeedPage';
import MessagesPage from './pages/MessagesPage';
import EventsPage from './pages/EventsPage';
import ClubsPage from './pages/ClubsPage';
import MarketplacePage from './pages/MarketplacePage';
import NoticeBoardPage from './pages/NoticeBoardPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import FriendsPage from './pages/FriendsPage';

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-surface-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-gray-500 font-medium">Loading UniConnect...</p>
      </div>
    </div>
  );
  return currentUser ? children : <Navigate to="/auth" replace />;
};
const PublicRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  return currentUser ? <Navigate to="/" replace /> : children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{
          style:{ fontFamily:'Sora,sans-serif', fontSize:'13px', borderRadius:'12px', boxShadow:'0 4px 20px rgba(0,0,0,0.1)'},
          success:{ iconTheme:{ primary:'#4b52e8', secondary:'white'}}
        }}/>
        <Routes>
          <Route path="/auth" element={<PublicRoute><AuthPage/></PublicRoute>}/>
          <Route path="/" element={<ProtectedRoute><DashboardLayout/></ProtectedRoute>}>
            <Route index element={<FeedPage/>}/>
            <Route path="messages" element={<MessagesPage/>}/>
            <Route path="messages/:conversationId" element={<MessagesPage/>}/>
            <Route path="events" element={<EventsPage/>}/>
            <Route path="clubs" element={<ClubsPage/>}/>
            <Route path="marketplace" element={<MarketplacePage/>}/>
            <Route path="notices" element={<NoticeBoardPage/>}/>
            <Route path="profile/:uid" element={<ProfilePage/>}/>
            <Route path="notifications" element={<NotificationsPage/>}/>
            <Route path="friends" element={<FriendsPage/>}/>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
