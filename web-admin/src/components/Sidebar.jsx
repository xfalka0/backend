import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Users,
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
    Activity,
    Wallet,
    ChevronRight,
    TrendingUp
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

    const categories = [
        {
            title: 'ANA MENÜ',
            items: [
                { path: '/', icon: <LayoutDashboard size={18} />, label: 'Genel Bakış', roles: ['admin', 'super_admin', 'moderator', 'staff', 'operator'] },
                { path: '/chats', icon: <MessageSquare size={18} />, label: 'Sohbetler', roles: ['admin', 'super_admin', 'moderator', 'operator', 'staff'] },
                { path: '/users', icon: <Users size={18} />, label: 'Kullanıcılar', roles: ['admin', 'super_admin'] },
                { path: '/profiles', icon: <UserSquare2 size={18} />, label: 'Profiller', roles: ['admin', 'super_admin'] },
            ]
        },
        {
            title: 'PERSONEL & EKİP',
            items: [
                { path: '/staff-activity', icon: <TrendingUp size={18} />, label: 'Çalışma Takibi', roles: ['admin', 'super_admin'] },
                { path: '/operators', icon: <Shield size={18} />, label: 'Yetkililer', roles: ['admin', 'super_admin'] },
                { path: '/agency-payouts', icon: <Wallet size={18} />, label: 'Personel Yönetimi', roles: ['admin', 'super_admin'] },
                { path: '/quick-replies', icon: <MessageSquare size={18} />, label: 'Hızlı Cevaplar', roles: ['admin', 'super_admin', 'operator', 'staff'] },
            ]
        },
        {
            title: 'MAĞAZA & FİNANS',
            items: [
                { path: '/payments', icon: <CreditCard size={18} />, label: 'Ödemeler', roles: ['admin', 'super_admin'] },
                { path: '/gifts', icon: <Gift size={18} />, label: 'Hediyeler', roles: ['admin', 'super_admin'] },
                { path: '/vip', icon: <Crown size={18} />, label: 'Coin Fiyatları', roles: ['admin', 'super_admin'] },
                { path: '/analytics', icon: <BarChart2 size={18} />, label: 'Analiz / Gelir', roles: ['admin', 'super_admin'] },
            ]
        },
        {
            title: 'SİSTEM & YÖNETİM',
            items: [
                { path: '/moderation', icon: <ShieldCheck size={18} />, label: 'Fotoğraf Onayı', roles: ['admin', 'super_admin'] },
                { path: '/reports', icon: <ShieldCheck size={18} />, label: 'Destek / Raporlar', roles: ['admin', 'super_admin', 'moderator', 'staff'] },
                { path: '/social', icon: <Video size={18} />, label: 'Keşfet Yönetimi', roles: ['admin', 'super_admin'] },
                { path: '/notifications', icon: <BellRing size={18} />, label: 'Bildirimler', roles: ['admin', 'super_admin'] },
                { path: '/campaigns', icon: <Tag size={18} />, label: 'Kampanyalar', roles: ['admin', 'super_admin'] },
                { path: '/fake-scheduler', icon: <Clock size={18} />, label: 'Otomatik Mesaj', roles: ['admin', 'super_admin'] },
                { path: '/maintenance', icon: <Database size={18} />, label: 'Sistem Bakımı', roles: ['admin', 'super_admin'] },
                { path: '/settings', icon: <Settings size={18} />, label: 'Ayarlar', roles: ['admin', 'super_admin'] },
            ]
        }
    ];

    return (
        <div className="w-64 bg-slate-950 border-r border-white/5 h-screen fixed top-0 left-0 flex flex-col z-50">
            {/* Logo */}
            <div className="px-8 py-8 mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <Shield size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tighter text-white leading-none">FALKA</h1>
                        <p className="text-[10px] font-black text-blue-500 tracking-[0.2em] mt-1">SOFTWARE</p>
                    </div>
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 px-4 space-y-8 overflow-y-auto custom-scrollbar pb-10">
                {categories.map((cat, idx) => {
                    const visibleItems = cat.items.filter(item => item.roles.includes(user.role));
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={idx} className="space-y-2">
                            <h3 className="px-4 text-[9px] font-black text-slate-600 tracking-[0.2em] uppercase">
                                {cat.title}
                            </h3>
                            <div className="space-y-1">
                                {visibleItems.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10'
                                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                                                }`}
                                        >
                                            <div className={`${isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-400'} transition-colors`}>
                                                {item.icon}
                                            </div>
                                            <span className={`text-[12.5px] font-bold tracking-tight ${isActive ? 'translate-x-0.5' : ''}`}>
                                                {item.label}
                                            </span>
                                            {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Footer / Profile */}
            <div className="p-4 mt-auto border-t border-white/5 bg-slate-950/50 backdrop-blur-xl">
                <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition-all group cursor-pointer mb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border border-white/10 overflow-hidden shadow-lg">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt="av" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-sm font-black text-white">{user.username[0].toUpperCase()}</span>
                        )}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-black text-white truncate capitalize">{user.username}</p>
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{user.role}</p>
                    </div>
                </div>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300"
                >
                    <LogOut size={14} /> Çıkış Yap
                </button>
            </div>
        </div>
    );
}
