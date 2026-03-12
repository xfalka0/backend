import React, { useState, useEffect } from 'react';
import { DollarSign, Users, MessageCircle, Heart, Loader2, Activity, UserPlus, LogIn, ShoppingCart, TrendingUp, ShieldCheck, Mail } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = '';
const SOCKET_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;

export default function Dashboard() {
    const [stats, setStats] = useState({
        revenue: 0,
        activeUsers: 0,
        messages: 0,
        onlineOperators: 0,
        charts: {
            revenue: [],
            registrations: []
        }
    });
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { Authorization: `Bearer ${token}` };

                const [statsRes, actsRes] = await Promise.all([
                    axios.get(`${API_URL}/api/admin/stats`, { headers }),
                    axios.get(`${API_URL}/api/admin/activities`, { headers })
                ]);

                setStats(statsRes.data);
                setActivities(actsRes.data);
            } catch (err) {
                console.error("Dashboard Data Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        const socket = io(SOCKET_URL, {
            auth: { token: localStorage.getItem('token') },
            transports: ['websocket', 'polling']
        });

        socket.on('new_activity', (newActivity) => {
            setActivities(prev => [newActivity, ...prev].slice(0, 15));
        });

        return () => socket.disconnect();
    }, []);

    const statItems = [
        { title: 'Toplam Gelir', value: `₺${stats?.revenue || 0}`, icon: <DollarSign />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { title: 'Kullanıcı Sayısı', value: stats?.activeUsers || 0, icon: <Users />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { title: 'Mesaj Trafiği', value: stats?.messages || 0, icon: <MessageCircle />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { title: 'Online Operatör', value: stats?.onlineOperators || 0, icon: <Heart />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    ];

    if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-purple-500" size={40} /></div>;

    return (
        <div className="p-10 space-y-10 animate-fade-up">
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                    <h2 className="text-4xl font-black text-white tracking-tight">Genel Bakış</h2>
                    <p className="text-slate-500 font-bold text-sm tracking-wide">Platform performansını ve büyüme verilerini izleyin.</p>
                </div>
                <div className="px-5 py-2.5 bg-blue-500/5 rounded-2xl border border-blue-500/10 flex items-center gap-2.5 shadow-lg shadow-blue-500/5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em]">Sistem Yayında</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {statItems.map((stat, i) => (
                    <div key={i} className="premium-card group">
                        <div className={`absolute -top-10 -right-10 w-32 h-32 blur-[100px] opacity-0 group-hover:opacity-20 transition-opacity duration-1000 ${stat.bg}`} />
                        <div className="flex items-center gap-5 relative z-10">
                            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} shadow-lg shadow-black/20 group-hover:scale-110 transition-transform duration-500`}>
                                {stat.icon}
                            </div>
                            <div>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{stat.title}</p>
                                <p className="text-3xl font-black text-white tracking-tighter italic">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="premium-card p-8">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
                            <TrendingUp className="text-blue-500" size={24} /> Gelir Grafiği (7 Gün)
                        </h3>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats?.charts?.revenue || []}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '15px' }}
                                    itemStyle={{ color: '#3b82f6', fontWeight: '900' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="premium-card p-8">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
                            <UserPlus className="text-indigo-500" size={24} /> Kayıt Grafiği (7 Gün)
                        </h3>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats?.charts?.registrations || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '15px' }}
                                    itemStyle={{ color: '#6366f1', fontWeight: '900' }}
                                />
                                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Activities */}
                <div className="lg:col-span-2 premium-card">
                    <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
                        <Activity size={24} className="text-blue-500" /> Son Aktiviteler
                    </h3>
                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-3 custom-scrollbar">
                        {activities.map((act, idx) => (
                            <div key={act.id} className={`flex items-start gap-5 p-5 rounded-[24px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group animate-fade-up stagger-${(idx % 5) + 1}`}>
                                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0 border border-white/5 shadow-inner group-hover:scale-105 transition-transform">
                                    {act.action_type === 'purchase' ? <ShoppingCart className="text-emerald-400" size={20} /> :
                                        act.action_type === 'register' ? <UserPlus className="text-blue-400" size={20} /> : <LogIn className="text-slate-400" size={20} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-[15px] font-bold text-white"><span className="text-blue-400">@{act.user_name}</span> {act.description}</p>
                                        <span className="text-[11px] text-slate-500 font-black">{new Date(act.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{act.action_type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="premium-card space-y-6">
                    <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter italic">Hızlı Erişim</h3>
                    <div className="space-y-4">
                        <button className="w-full p-5 bg-white/5 hover:bg-blue-600/10 rounded-[28px] flex items-center gap-5 transition-all group border border-white/5">
                            <div className="p-4 bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white rounded-2xl transition-all shadow-lg"><Mail size={22} /></div>
                            <div className="text-left">
                                <p className="text-[15px] font-black text-white">Toplu Bildirim</p>
                                <p className="text-[11px] text-slate-500 font-bold">Tüm kullanıcılara push ilet</p>
                            </div>
                        </button>
                        <button className="w-full p-5 bg-white/5 hover:bg-indigo-600/10 rounded-[28px] flex items-center gap-5 transition-all group border border-white/5">
                            <div className="p-4 bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white rounded-2xl transition-all shadow-lg"><ShieldCheck size={22} /></div>
                            <div className="text-left">
                                <p className="text-[15px] font-black text-white">Moderatör Ekle</p>
                                <p className="text-[11px] text-slate-500 font-bold">Yeni personel yetkilendir</p>
                            </div>
                        </button>
                    </div>
                    
                    <div className="pt-10 mt-6 border-t border-white/5">
                        <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-5">
                            <span>Sunucu Durumu</span>
                            <span className="text-blue-500">Optimum</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden shadow-inner p-0.5 border border-white/5">
                            <div className="w-[85%] h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
