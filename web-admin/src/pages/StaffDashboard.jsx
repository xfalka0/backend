import React, { useState, useEffect } from 'react';
import { 
    Wallet, 
    Clock,
    Trophy,
    Activity
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = '/api';

const StaffDashboard = () => {
    const { user, token } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/operator/my-stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
        } catch (err) {
            console.error('Stats fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 animate-pulse space-y-8">
                <div className="h-20 w-1/3 bg-white/5 rounded-3xl" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white/5 rounded-[40px]" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 max-w-7xl mx-auto">
            {/* Header with Large Balance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                <div className="lg:col-span-2 flex flex-col justify-center bg-gradient-to-br from-blue-600/20 via-transparent to-indigo-600/10 p-10 rounded-[48px] border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full -mr-48 -mt-48" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 text-blue-400 mb-4">
                            <Trophy size={18} />
                            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Falka Personel Paneli</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tighter leading-tight mb-2">
                            İyi Mesailer, {stats?.display_name || user?.username}
                        </h1>
                        <p className="text-slate-500 text-sm font-medium max-w-md">Performansınızı takip edin ve kazancınızı artırmak için sohbetlere odaklanın.</p>
                    </div>
                </div>

                {/* MAIN WALLET CARD */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-1 rounded-[48px] shadow-2xl shadow-blue-500/20 group">
                    <div className="bg-slate-950 h-full w-full rounded-[45px] p-10 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
                        
                        <div className="relative z-10">
                            <p className="text-blue-400 text-[11px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                                <Wallet size={14} /> Toplam Bekleyen Bakiye
                            </p>
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-6xl font-black text-white tracking-tighter">
                                    {((parseFloat(stats?.pending_balance) || 0) * 0.5).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </h2>
                                <span className="text-2xl font-black text-blue-500">TL</span>
                            </div>
                            <p className="text-slate-500 text-sm font-bold mt-2">
                                {(parseFloat(stats?.pending_balance) || 0).toLocaleString('tr-TR')} COIN
                            </p>
                        </div>

                        <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6 relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Durum</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[11px] font-black text-emerald-400 uppercase">Aktif Çalışıyor</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Weekly History Table */}
            <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[40px] overflow-hidden">
                <div className="p-8 border-bottom border-white/5 flex items-center justify-between bg-white/5">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Activity size={20} className="text-blue-500" />
                        Haftalık Performans Özeti
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Son 7 Gün</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50">
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tarih</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Mesaj</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fotoğraf</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Toplam Coin</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Net Kazanç</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {stats?.weekly_stats?.length > 0 ? stats.weekly_stats.map((day, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-6">
                                        <p className="text-sm font-bold text-white">{new Date(day.date).toLocaleDateString('tr-TR', { weekday: 'long' })}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{new Date(day.date).toLocaleDateString('tr-TR')}</p>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-sm font-black text-slate-300">{day.text_count || day.messages_sent || 0}</span>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-sm font-black text-slate-300">{day.image_count || 0}</span>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-sm font-bold text-slate-400">{day.coins_earned}</span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-black text-emerald-400">{(day.coins_earned * 0.5).toFixed(2)}</span>
                                            <span className="text-[10px] font-bold text-emerald-500/50">TL</span>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Clock size={40} className="text-slate-800" />
                                            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Henüz veriniz bulunmuyor</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StaffDashboard;
