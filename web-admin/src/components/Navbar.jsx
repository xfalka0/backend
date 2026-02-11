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
        <header className="h-20 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-30 px-8 flex items-center justify-between">
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Herhangi bir şeyi arayın (kullanıcı, ödeme, operatör...)"
                        className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all placeholder:text-slate-600"
                    />
                </div>
            </div>

            <div className="flex items-center gap-6">
                <button className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-purple-900/20">
                    <Plus size={18} />
                    <span>Hızlı Ekle</span>
                </button>

                <div className="flex items-center gap-2 border-r border-white/10 pr-6">
                    <button className="p-2.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all relative">
                        <Bell size={20} />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 border-2 border-slate-950 rounded-full" />
                    </button>
                </div>

                <div
                    className="relative"
                    ref={menuRef}
                >
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold capitalize">{user?.username || 'Admin'}</p>
                            <p className="text-[10px] text-emerald-500">Çevrimiçi</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 overflow-hidden transition-transform group-hover:scale-105">
                            <img src={user?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"} alt="Admin" className="w-full h-full object-cover" />
                        </div>
                        <ChevronDown size={16} className={`text-slate-500 group-hover:text-white transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 z-50">
                            <div className="px-4 py-3 border-b border-white/5 mb-1 sm:hidden">
                                <p className="text-sm font-bold text-white capitalize">{user?.username}</p>
                                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                            </div>

                            <button className="w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-2 transition-colors">
                                <User size={16} /> Profili Düzenle
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 transition-colors font-medium"
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
