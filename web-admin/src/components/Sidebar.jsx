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
    Database
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
            { path: '/settings', icon: <Settings size={20} />, label: 'Ayarlar', roles: ['admin', 'super_admin'] },
        ];

        return items.filter(item => item.roles.includes(role));
    };

    const menuItems = getMenuItems(user.role);

    return (
        <div className="w-64 bg-slate-950 border-r border-white/5 h-screen fixed top-0 left-0 p-4 flex flex-col">
            <div className="px-4 py-8">
                <h1 className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-rose-500">
                    FALKA SOFTWARE
                </h1>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <div className={`${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                                {item.icon}
                            </div>
                            <span className="text-sm font-medium">{item.label}</span>
                            {isActive && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/5 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-slate-900 overflow-hidden">
                        {user.avatar_url && <img src={user.avatar_url} alt="av" className="w-full h-full object-cover" />}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold truncate capitalize">{user.username}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{user.role}</p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 py-2 rounded-xl text-xs font-bold transition"
                >
                    <LogOut size={14} /> Çıkış Yap
                </button>
            </div>
        </div>
    );
}
