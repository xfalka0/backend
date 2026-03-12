import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';

// Pages
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import ProfilesPage from './pages/Profiles';
import PaymentsPage from './pages/Payments';
import GiftsPage from './pages/Gifts';
import VipPage from './pages/Vip';
import ChatsPage from './pages/Chats';
import Moderation from './components/Moderation';
import ReportsPage from './pages/Reports';
import QuickRepliesPage from './pages/QuickReplies';
import SocialPage from './pages/Social';
import AnalyticsPage from './pages/Analytics';
import NotificationsPage from './pages/Notifications';
import CampaignsPage from './pages/Campaigns';
import RetentionPage from './pages/Retention';
import FakeSchedulerPage from './pages/FakeScheduler';
import AdminManagement from './pages/AdminManagement';
import MaintenancePage from './pages/Maintenance';
import SplashIntro from './components/SplashIntro';

// Placeholder Pages
const Placeholder = ({ title }) => (
    <div className="p-8">
        <h2 className="text-3xl font-black text-white">{title}</h2>
        <p className="text-slate-500 mt-4">Bu sayfa yakında eklenecek.</p>
    </div>
);

const ProtectedRoute = ({ allowedRoles }) => {
    const { user, token, loading } = useAuth();

    if (loading) return <div className="p-10 text-white">Yükleniyor...</div>;

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return (
            <div className="p-8 text-white">
                <h2 className="text-2xl font-bold text-red-500">Yetkisiz Erişim</h2>
                <p>Bu sayfayı görüntüleme yetkiniz yok.</p>
            </div>
        );
    }

    return <Outlet />;
};

const Layout = () => (
    <div className="bg-[#020617] min-h-screen text-white flex relative overflow-hidden">
        {/* Global Background Aurora Effect */}
        <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full animate-aurora" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full animate-aurora" style={{ animationDelay: '-5s' }} />
        </div>

        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen flex flex-col relative z-10">
            <Navbar />
            <div className="flex-1 overflow-x-hidden">
                <Outlet />
            </div>
            <footer className="p-10 text-center text-[11px] font-black uppercase tracking-[0.3em] text-slate-800 border-t border-white/5">
                &copy; 2024 Falka Software Admin Dashboard • Premium Management Console
            </footer>
        </main>
    </div>
);

function App() {
    const [showSplash, setShowSplash] = React.useState(true);

    if (showSplash) {
        return <SplashIntro onComplete={() => setShowSplash(false)} />;
    }

    return (
        <AuthProvider>
            <BrowserRouter basename="/">
                <Routes>
                    <Route path="/login" element={<Login />} />

                    {/* Protected Area */}
                    <Route element={<ProtectedRoute />}>
                        <Route element={<Layout />}>

                            {/* General Dashboard - Restricted to Staff */}
                            <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'moderator', 'operator']} />}>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/quick-replies" element={<QuickRepliesPage />} />
                            </Route>

                            {/* Admin/Manager Only Routes */}
                            <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
                                <Route path="/admin-users" element={<AdminManagement />} />
                                <Route path="/admins" element={<AdminManagement />} />
                                <Route path="/operators" element={<AdminManagement />} />
                                <Route path="/moderation" element={<Moderation />} />
                                <Route path="/maintenance" element={<MaintenancePage />} />
                            </Route>

                            {/* Moderator & Admin Routes */}
                            <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin', 'moderator']} />}>
                                <Route path="/formatted-chats" element={<ChatsPage />} />
                                <Route path="/chats" element={<ChatsPage />} />
                                <Route path="/reports" element={<ReportsPage />} />
                            </Route>

                            {/* General Access (adjust as needed, currently specific protection above) */}
                            {/* If we want strict block for moderators on these: */}
                            <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
                                <Route path="/users" element={<UsersPage />} />
                                <Route path="/profiles" element={<ProfilesPage />} />
                                <Route path="/social" element={<SocialPage />} />
                                <Route path="/payments" element={<PaymentsPage />} />
                                <Route path="/gifts" element={<GiftsPage />} />
                                <Route path="/vip" element={<VipPage />} />
                                <Route path="/analytics" element={<AnalyticsPage />} />
                                <Route path="/notifications" element={<NotificationsPage />} />
                                <Route path="/campaigns" element={<CampaignsPage />} />
                                <Route path="/retention" element={<RetentionPage />} />
                                <Route path="/fake-scheduler" element={<FakeSchedulerPage />} />
                                <Route path="/settings" element={<Placeholder title="Ayarlar" />} />
                            </Route>

                            {/* Fallback */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
