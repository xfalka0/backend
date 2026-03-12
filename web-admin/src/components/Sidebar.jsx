import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Users,
    UserCircle2,
    MessageSquare,
    CreditCard,
    Gift,
    Crown,
    Video,
    Settings,
    UserSquare2,
    ShieldCheck,
    LogOut,
    Shield,
    Database,
    BarChart2,
    BellRing,
    Tag,
    Clock,
    Activity
} from 'lucide-react';

export default function Sidebar() {
    const location = useLocation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    const getMenuItems = (role) => {
        const items = [
            { path: '/', icon: <LayoutDashboard size={20} />, label: 'Genel Bakış', roles: ['admin', 'super_admin', 'moderator'] },
            // { path: '/admin-users', icon: <Shield size={20} />, label: 'Personel', roles: ['admin', 'super_admin'] },
            { path: '/users', icon: <Users size={20} />, label: 'Kullanıcılar', roles: ['admin', 'super_admin'] },
            { path: '/profiles', icon: <UserSquare2 size={20} />, label: 'Profiller', roles: ['admin', 'super_admin'] },
            { path: '/operators', icon: <Shield size={20} />, label: 'Yetkililer', roles: ['admin', 'super_admin'] },
            { path: '/chats', icon: <MessageSquare size={20} />, label: 'Sohbetler', roles: ['admin', 'super_admin', 'moderator'] },
            { path: '/payments', icon: <CreditCard size={20} />, label: 'Ödemeler', roles: ['admin', 'super_admin'] },
            { path: '/gifts', icon: <Gift size={20} />, label: 'Hediyeler', roles: ['admin', 'super_admin'] },
            { path: '/vip', icon: <Crown size={20} />, label: 'Coin Fiyatları', roles: ['admin', 'super_admin'] },
            { path: '/reports', icon: <ShieldCheck size={20} />, label: 'Destek / Raporlar', roles: ['admin', 'super_admin', 'moderator'] },
            { path: '/quick-replies', icon: <MessageSquare size={20} />, label: 'Hızlı Cevaplar', roles: ['admin', 'super_admin', 'operator'] },
            { path: '/maintenance', icon: <Database size={20} />, label: 'Sistem Bakımı', roles: ['admin', 'super_admin'] },
            { path: '/moderation', icon: <ShieldCheck size={20} />, label: 'Fotoğraf Onayı', roles: ['admin', 'super_admin'] },
            { path: '/social', icon: <Video size={20} />, label: 'Keşfet Yönetimi', roles: ['admin', 'super_admin'] },
            { path: '/analytics', icon: <BarChart2 size={20} />, label: 'Analiz / Gelir', roles: ['admin', 'super_admin'] },
            { path: '/notifications', icon: <BellRing size={20} />, label: 'Bildirimler', roles: ['admin', 'super_admin'] },
            { path: '/campaigns', icon: <Tag size={20} />, label: 'Kampanyalar', roles: ['admin', 'super_admin'] },
            { path: '/retention', icon: <Activity size={20} />, label: 'Kullanıcı Takibi', roles: ['admin', 'super_admin'] },
            { path: '/fake-scheduler', icon: <Clock size={20} />, label: 'Otomatik Mesaj', roles: ['admin', 'super_admin'] },
            { path: '/settings', icon: <Settings size={20} />, label: 'Ayarlar', roles: ['admin', 'super_admin'] },
        ];

        return items.filter(item => item.roles.includes(role));
    };

    const menuItems = getMenuItems(user.role);

    return (
        <div className="w-64 bg-slate-950/80 backdrop-blur-3xl border-r border-white/5 h-screen fixed top-0 left-0 p-5 flex flex-col z-50">
            <div className="px-4 py-8 mb-4">
                <h1 className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-400 bg-[length:200%_auto] animate-gradient-text">
                    FALKA SOFTWARE
                </h1>
                <div className="h-[2px] w-8 bg-blue-600 mt-2 rounded-full" />
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-2">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${isActive
                                ? 'bg-blue-600/10 text-white border border-blue-500/20 shadow-[0_10px_30px_rgba(37,99,235,0.1)]'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                                }`}
                        >
                            <div className={`${isActive ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'} transition-colors`}>
                                {item.icon}
                            </div>
                            <span className={`text-[13px] font-bold tracking-tight transition-all ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto pt-5 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-3 px-4 py-4 bg-white/5 rounded-[24px] border border-white/5 hover:bg-white/[0.08] transition-all group">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-slate-900 overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                        {user.avatar_url && <img src={user.avatar_url} alt="av" className="w-full h-full object-cover" />}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-black text-white/90 truncate capitalize">{user.username}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{user.role}</p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300"
                >
                    <LogOut size={14} /> Çıkış Yap
                </button>
            </div>
        </div>
    );
}
