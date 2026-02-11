import React, { useState, useEffect } from 'react';
import { DollarSign, Users, MessageCircle, Heart, Loader2, Activity, UserPlus, LogIn, ShoppingCart, TrendingUp, ShieldCheck, Mail } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://backend-kj17.onrender.com'
    : '';

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

        const socket = io(API_URL, {
            auth: { token: localStorage.getItem('token') },
            transports: ['websocket']
        });

        socket.on('new_activity', (newActivity) => {
            setActivities(prev => [newActivity, ...prev].slice(0, 15));
        });

        return () => socket.disconnect();
    }, []);

    const statItems = [
        { title: 'Toplam Gelir', value: `₺${stats.revenue}`, icon: <DollarSign />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { title: 'Kullanıcı Sayısı', value: stats.activeUsers, icon: <Users />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { title: 'Mesaj Trafiği', value: stats.messages, icon: <MessageCircle />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        { title: 'Online Operatör', value: stats.onlineOperators, icon: <Heart />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    ];

    if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-purple-500" size={40} /></div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-white mb-2">Genel Bakış</h2>
                    <p className="text-slate-500 font-medium">Platform performansını ve büyüme verilerini izleyin.</p>
                </div>
                <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sistem Yayında</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statItems.map((stat, i) => (
                    <div key={i} className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[24px] p-6 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity ${stat.bg}`} />
                        <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} relative z-10`}>
                            {stat.icon}
                        </div>
                        <div className="relative z-10">
                            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{stat.title}</p>
                            <p className="text-2xl font-black text-white">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[30px] p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter italic flex items-center gap-2">
                            <TrendingUp className="text-emerald-500" size={20} /> Gelir Grafiği (7 Gün)
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.charts.revenue}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[30px] p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter italic flex items-center gap-2">
                            <UserPlus className="text-blue-500" size={20} /> Kayıt Grafiği (7 Gün)
                        </h3>
                    </div>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.charts.registrations}>
                                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activities */}
                <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[30px] p-8">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-purple-500" /> Son Aktiviteler
                    </h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {activities.map((act) => (
                            <div key={act.id} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all">
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-white/5">
                                    {act.action_type === 'purchase' ? <ShoppingCart className="text-emerald-400" size={16} /> :
                                        act.action_type === 'register' ? <UserPlus className="text-blue-400" size={16} /> : <LogIn className="text-slate-400" size={16} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-bold text-white"><span className="text-purple-400">@{act.user_name}</span> {act.description}</p>
                                        <span className="text-[10px] text-slate-500 font-bold">{new Date(act.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{act.action_type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[30px] p-8 space-y-4">
                    <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight italic">Hızlı Erişim</h3>
                    <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center gap-4 transition-all group">
                        <div className="p-3 bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white rounded-xl transition-all"><Mail size={20} /></div>
                        <div className="text-left">
                            <p className="text-sm font-black text-white">Toplu Bildirim</p>
                            <p className="text-[10px] text-slate-500 font-medium">Tüm kullanıcılara push ilet</p>
                        </div>
                    </button>
                    <button className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center gap-4 transition-all group">
                        <div className="p-3 bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-white rounded-xl transition-all"><ShieldCheck size={20} /></div>
                        <div className="text-left">
                            <p className="text-sm font-black text-white">Moderatör Ekle</p>
                            <p className="text-[10px] text-slate-500 font-medium">Yeni personel yetkilendir</p>
                        </div>
                    </button>
                    <div className="pt-8 border-t border-white/5">
                        <div className="flex items-center justify-between text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">
                            <span>Sunucu Durumu</span>
                            <span className="text-emerald-500 text-[8px]">Çalışıyor</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="w-[85%] h-full bg-emerald-500" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
