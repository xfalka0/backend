import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, Plus, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="h-20 border-b border-white/5 bg-slate-950/20 backdrop-blur-3xl sticky top-0 z-40 px-8 flex items-center justify-between">
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Herhangi bir şeyi arayın..."
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/40 transition-all placeholder:text-slate-700 font-medium"
                    />
                </div>
            </div>

            <div className="flex items-center gap-6">
                <button className="flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-900/10 hover:shadow-blue-600/20 active:scale-95">
                    <Plus size={16} />
                    <span>Hızlı Ekle</span>
                </button>

                <div className="flex items-center gap-2 border-r border-white/10 pr-6">
                    <button className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all relative">
                        <Bell size={20} />
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 border-2 border-[#020617] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    </button>
                </div>

                <div
                    className="relative"
                    ref={menuRef}
                >
                    <div
                        className="flex items-center gap-4 cursor-pointer group"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-black text-white/90 tracking-tight capitalize">{user?.username || 'Admin'}</p>
                            <div className="flex items-center justify-end gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-blue-500" />
                                <p className="text-[9px] font-black text-blue-500/80 uppercase tracking-widest">Çevrimiçi</p>
                            </div>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-[1px] shadow-lg group-hover:scale-105 transition-transform duration-300">
                            <div className="w-full h-full rounded-[14px] bg-slate-900 overflow-hidden">
                                <img src={user?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"} alt="Admin" className="w-full h-full object-cover" />
                            </div>
                        </div>
                        <ChevronDown size={14} className={`text-slate-600 group-hover:text-white transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-3 w-56 premium-card p-2 z-50 border-blue-500/10 shadow-2xl">
                            <div className="px-4 py-3 border-b border-white/5 mb-1 sm:hidden">
                                <p className="text-sm font-bold text-white capitalize">{user?.username}</p>
                                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                            </div>

                            <button className="w-full text-left px-4 py-3 text-[13px] font-bold text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-3 rounded-xl transition-all">
                                <User size={16} className="text-blue-400" /> Profili Düzenle
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-3 text-[13px] font-bold text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/5 flex items-center gap-3 rounded-xl transition-all"
                            >
                                <LogOut size={16} /> Çıkış Yap
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
