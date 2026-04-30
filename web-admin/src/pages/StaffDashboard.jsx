import React, { useState, useEffect } from 'react';
import { 
    Wallet, 
    TrendingUp, 
    MessageSquare, 
    Zap, 
    ArrowUpRight, 
    Clock,
    DollarSign,
    Trophy,
    Target,
    Activity
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:5000/api' 
    : 'https://backend-kj17.onrender.com/api';

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

    const StatCard = ({ title, value, icon: Icon, color, subText }) => {
        const tlValue = (parseFloat(value) || 0) * 0.5;
        return (
            <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/5 p-8 rounded-[40px] relative overflow-hidden group hover:border-white/10 transition-all duration-500">
                <div className={`absolute top-0 right-0 w-40 h-40 bg-${color}-600/10 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:bg-${color}-600/20 transition-all duration-700`} />
                
                <div className="flex items-start justify-between relative z-10">
                    <div>
                        <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
                        <h3 className="text-4xl font-black text-white tracking-tighter mb-1">
                            {tlValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-bold text-slate-600 ml-1">TL</span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500/60 tracking-tight uppercase">
                            {value.toLocaleString('tr-TR', { minimumFractionDigits: 1 })} COIN
                        </p>
                        {subText && <p className="text-[10px] font-bold text-slate-500 mt-4 uppercase tracking-widest flex items-center gap-2">
                            <Activity size={10} className={`text-${color}-400`} />
                            {subText}
                        </p>}
                    </div>
                    <div className={`w-14 h-14 rounded-2xl bg-${color}-600/10 border border-${color}-500/20 flex items-center justify-center text-${color}-400 shadow-xl group-hover:scale-110 transition-transform duration-500`}>
                        <Icon size={24} />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-gradient-to-br from-blue-600/10 via-transparent to-indigo-600/5 p-10 rounded-[48px] border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full -mr-48 -mt-48" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 text-blue-400 mb-3">
                        <Trophy size={18} />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em]">Hoş Geldin, Falka Personeli</span>
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter leading-tight">
                        İyi Mesailer, <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-400 bg-[length:200%_auto] animate-gradient-text">
                            {stats?.display_name || stats?.username || user?.username}
                        </span>
                    </h1>
                    <p className="text-slate-500 text-base font-medium mt-4 max-w-md">Bugünkü performansınızı takip edin ve kazancınızı artırmak için sohbetlere odaklanın.</p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Durumunuz</p>
                        <div className="flex items-center justify-end gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                            <span className="text-xs font-black text-emerald-400 uppercase tracking-tighter">Aktif Çalışıyor</span>
                        </div>
                    </div>
                    <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-blue-500 to-indigo-600 p-[3px] shadow-2xl">
                        <div className="w-full h-full rounded-[29px] bg-slate-950 overflow-hidden">
                            <img src={stats?.avatar_url || user?.avatar_url || 'https://via.placeholder.com/150'} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatCard 
                    title="Toplam Bekleyen Bakiye" 
                    value={parseFloat(stats?.pending_balance || 0)} 
                    icon={Wallet} 
                    color="blue"
                    subText="Son ödemeden beri kazanılan"
                />
                <StatCard 
                    title="Bugünkü Kazanç" 
                    value={parseFloat(stats?.earned_today || 0)} 
                    icon={Zap} 
                    color="amber"
                    subText="Bugün gece yarısından itibaren"
                />
                <StatCard 
                    title="Toplam Mesaj Sayısı" 
                    value={stats?.total_messages || 0} 
                    icon={MessageSquare} 
                    color="indigo"
                    subText="Sistemdeki tüm zamanlar"
                />
            </div>

            {/* Achievement / Info Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[40px] p-10">
                    <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
                        <Target size={20} className="text-blue-500" />
                        Günlük Hedef
                    </h3>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between text-sm font-bold">
                            <span className="text-slate-500 uppercase tracking-widest text-[10px]">Mesaj Hedefi (500)</span>
                            <span className="text-white">{Math.min(100, Math.round(((stats?.earned_today / 2) / 500) * 100))}%</span>
                        </div>
                        <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div 
                                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all duration-1000" 
                                style={{ width: `${Math.min(100, Math.round(((stats?.earned_today / 2) / 500) * 100))}%` }} 
                            />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Hedefinize ulaştığınızda ekstra bonuslar için admin ile iletişime geçin.</p>
                    </div>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[40px] p-10 flex items-center justify-between group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] rounded-full -mr-16 -mt-16" />
                    <div className="relative z-10">
                        <h3 className="text-xl font-black text-white mb-2">Hızlı Destek</h3>
                        <p className="text-slate-500 text-sm font-medium mb-6">Herhangi bir sorun yaşarsanız moderatorler ile iletişime geçebilirsiniz.</p>
                        <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all">
                            Yönetime Bildir
                        </button>
                    </div>
                    <Clock size={80} className="text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                </div>
            </div>
            {/* Earnings Guide & Info - Enhanced Version */}
            <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[48px] p-12 mt-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full -ml-32 -mt-32" />
                
                <h3 className="text-2xl font-black text-white mb-10 flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <DollarSign size={20} />
                    </div>
                    Kazanç Rehberi
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                    {/* Text Message Card */}
                    <div className="bg-gradient-to-br from-blue-600/10 to-transparent p-8 rounded-[32px] border border-blue-500/10 hover:border-blue-500/30 transition-all group">
                        <p className="text-blue-400 text-[12px] font-black uppercase tracking-[0.2em] mb-4">Metin Mesajı (10 Coin)</p>
                        <div className="flex flex-col gap-1">
                            <span className="text-4xl font-black text-white tracking-tighter">1.15 TL</span>
                            <span className="text-sm font-bold text-slate-500">Kazanılan: 2.3 Coin</span>
                        </div>
                    </div>

                    {/* Photo Card */}
                    <div className="bg-gradient-to-br from-purple-600/10 to-transparent p-8 rounded-[32px] border border-purple-500/10 hover:border-purple-500/30 transition-all group">
                        <p className="text-purple-400 text-[12px] font-black uppercase tracking-[0.2em] mb-4">Fotoğraf (50 Coin)</p>
                        <div className="flex flex-col gap-1">
                            <span className="text-4xl font-black text-white tracking-tighter">10.00 TL</span>
                            <span className="text-sm font-bold text-slate-500">Kazanılan: 20 Coin</span>
                        </div>
                    </div>

                    {/* Audio Card */}
                    <div className="bg-gradient-to-br from-amber-600/10 to-transparent p-8 rounded-[32px] border border-amber-500/10 hover:border-amber-500/30 transition-all group">
                        <p className="text-amber-400 text-[12px] font-black uppercase tracking-[0.2em] mb-4">Ses Kaydı (30 Coin)</p>
                        <div className="flex flex-col gap-1">
                            <span className="text-4xl font-black text-white tracking-tighter">5.00 TL</span>
                            <span className="text-sm font-bold text-slate-500">Kazanılan: 10 Coin</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 p-6 bg-slate-950/50 border border-white/5 rounded-3xl relative z-10">
                    <div className="flex items-start gap-4">
                        <Zap size={18} className="text-blue-500 mt-1 shrink-0" />
                        <p className="text-sm text-slate-400 font-medium leading-relaxed">
                            <strong className="text-white">Bilgilendirme:</strong> Hakedişler coin harcamasının belirli oranlarında (Mesaj %23, Foto %40, Ses %33) hesaplanır. Kazancınız otomatik olarak bakiyenize eklenir ve admin tarafından belirlenen sabit kur <span className="text-blue-400 font-bold">(1 Coin = 0.5 TL)</span> üzerinden hesaplanır.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffDashboard;
