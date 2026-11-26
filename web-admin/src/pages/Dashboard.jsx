import React, { useState, useEffect } from 'react';
import {
    DollarSign, Users, MessageCircle, Award, Loader2, Activity, UserPlus, LogIn,
    ShoppingCart, ShieldCheck, Mail, Target, Flame, Crown, Clock, Copy, Check,
    Sparkles, ArrowUpRight, Filter, Zap, Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import KpiDetailDrawer, { DeltaBadge } from '../components/dashboard/KpiDetailDrawer';

const API_URL = import.meta.env.VITE_API_URL || '';
const SOCKET_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin;

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isOperator = user?.role === 'operator';

    const [showIntro, setShowIntro] = useState(() => !isOperator);
    const [introFading, setIntroFading] = useState(false);

    const [stats, setStats] = useState(null);
    const [personalStats, setPersonalStats] = useState({ today: { messages: 0, coins: 0 }, info: { pending_balance: 0, lifetime_earnings: 0 }, chart: [] });
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    // Interactive States
    const [drawerTab, setDrawerTab] = useState(null);
    const [drawerRange, setDrawerRange] = useState(null);
    const openDrawer = (tab, range = null) => {
        setDrawerRange(range);
        setDrawerTab(tab);
    };
    const [leftTab, setLeftTab] = useState('funnel'); // 'funnel' | 'packages'
    const [funnelScope, setFunnelScope] = useState('all'); // 'all' | 'week7d'
    const [rightTab, setRightTab] = useState('payments'); // 'payments' | 'hot' | 'loyal'
    const [peakTab, setPeakTab] = useState('registrations'); // 'registrations' | 'revenue'
    const [newUserTab, setNewUserTab] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'custom'
    const [customStart, setCustomStart] = useState(() => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10));
    const [customEnd, setCustomEnd] = useState(() => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10));
    const [customNewUsers, setCustomNewUsers] = useState(null);
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [targetsInfo, setTargetsInfo] = useState(null);
    const [alertHealth, setAlertHealth] = useState(null);

    const dismissIntro = () => {
        setIntroFading(true);
        setTimeout(() => {
            setShowIntro(false);
            setIntroFading(false);
        }, 900);
    };

    const replayIntro = () => {
        setIntroFading(false);
        setShowIntro(true);
    };

    useEffect(() => {
        if (!showIntro || isOperator) return undefined;
        const fadeTimer = setTimeout(() => setIntroFading(true), 4000);
        const closeTimer = setTimeout(() => {
            setShowIntro(false);
            setIntroFading(false);
        }, 5000);
        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(closeTimer);
        };
    }, [showIntro, isOperator]);

    const fetchDashboard = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            if (isOperator) {
                const [statsRes, actsRes] = await Promise.all([
                    axios.get(`${API_URL}/api/admin/my-stats`, { headers }),
                    axios.get(`${API_URL}/api/admin/activities`, { headers })
                ]);
                setPersonalStats(statsRes.data);
                setActivities(actsRes.data);
            } else {
                const [statsRes, actsRes, tgtRes, altRes] = await Promise.all([
                    axios.get(`${API_URL}/api/admin/stats`, { headers }),
                    axios.get(`${API_URL}/api/admin/activities`, { headers }),
                    axios.get(`${API_URL}/api/admin/targets`, { headers }).catch(() => ({ data: null })),
                    axios.get(`${API_URL}/api/admin/alerts/status`, { headers }).catch(() => ({ data: null })),
                ]);
                setStats(statsRes.data);
                setActivities(actsRes.data);
                if (tgtRes?.data) setTargetsInfo(tgtRes.data);
                if (altRes?.data?.health) setAlertHealth(altRes.data.health);
            }
        } catch (err) {
            console.error('Dashboard Data Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();

        const socket = io(SOCKET_URL, {
            auth: { token: localStorage.getItem('token') },
            transports: ['websocket', 'polling']
        });

        socket.on('new_activity', (newActivity) => {
            setActivities((prev) => [newActivity, ...prev].slice(0, 20));
        });

        socket.on('new_payment', () => {
            if (!isOperator) fetchDashboard();
        });

        return () => socket.disconnect();
    }, [isOperator]);

    const fetchCustomNewUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/stats/range?start=${customStart}&end=${customEnd}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCustomNewUsers(res.data?.users || null);
        } catch (err) {
            console.error('Custom range new users error:', err);
        }
    };

    const handleCopyWhatsappSummary = () => {
        if (!stats) return;
        const revB = stats.revenueBreakdown || {};
        const np = stats.newUsers?.periods?.today || {};
        const mon = stats.monetization || {};
        const pulse = stats.livePulse || {};
        const topPkg = revB.byPackage?.[0]?.name || '-';
        const todayDateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const text = [
            `📊 *Fiora Günlük Özet (${todayDateStr})*`,
            `💰 Bugünkü Ciro: *₺${(revB.today || 0).toLocaleString('tr-TR')}* (${revB.todayOrders || 0} sipariş | Düne göre ${revB.todayDeltaPct >= 0 ? '+' : ''}${revB.todayDeltaPct || 0}%)`,
            `👥 Bugünkü Kayıt: *${np.count || 0}* (Düne göre ${np.deltaPct >= 0 ? '+' : ''}${np.deltaPct || 0}%)`,
            `🎯 Bugünkü Dönüşüm: *%${np.payingRatePct || 0}* (${np.payingCount || 0} ödeyen) | Genel ARPPU: ₺${(mon.arppu || 0).toLocaleString('tr-TR')}`,
            `🔥 Anlık Aktif Üye: ${pulse.liveOnlineCount || 0} | İlk 30dk Ödeme: %${stats.adQuality?.within30mPctToday || 0}`,
            `🏆 En Çok Satan Paket: ${topPkg}`
        ].join('\n');

        navigator.clipboard?.writeText(text);
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2500);
    };

    const adminTitleName = user?.display_name || (user?.username?.toLowerCase().includes('furkan') ? 'Furkan Bey' : 'Furkan Bey');

    const welcomeOverlay = showIntro && !isOperator ? (
        <div
            onClick={dismissIntro}
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/95 backdrop-blur-2xl cursor-pointer transition-all duration-1000 ease-out ${introFading ? 'opacity-0 scale-[1.015] pointer-events-none' : 'opacity-100 scale-100'}`}
        >
            <div className="relative text-center px-6 py-10 max-w-3xl">
                {/* Soft breathing ambient light */}
                <div className="absolute -inset-28 bg-gradient-to-tr from-blue-500/20 via-indigo-400/15 to-emerald-400/15 blur-[100px] rounded-full pointer-events-none animate-soft-glow" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-28 bg-white/10 blur-[70px] rounded-full pointer-events-none animate-soft-glow" />

                <p className="relative text-[11px] font-bold uppercase tracking-[0.42em] text-blue-300/80 animate-soft-rise-1">
                    Yönetim Özeti
                </p>

                <h1 className="relative mt-4 text-3xl sm:text-5xl font-black tracking-tight sm:whitespace-nowrap text-transparent bg-clip-text soft-shimmer-text opacity-0 drop-shadow-[0_0_28px_rgba(147,197,253,0.28)]">
                    Hoş geldiniz, {adminTitleName}
                </h1>

                <div className="relative mx-auto mt-5 h-px w-52 bg-gradient-to-r from-transparent via-blue-300/65 to-transparent shadow-[0_0_14px_rgba(147,197,253,0.7)] animate-soft-line" />

                <p className="relative mt-4 text-sm font-medium text-slate-400 animate-soft-rise-3">
                    Canlı gelir ve günlük analizleriniz hazırlanıyor...
                </p>
            </div>
        </div>
    ) : null;

    // Operator legacy dashboard preserved cleanly
    if (isOperator) {
        if (loading) {
            return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-purple-500" size={40} /></div>;
        }
        const operatorStatItems = [
            { title: 'Bugünkü Mesajlarım', value: personalStats.today.messages || 0, icon: <MessageCircle />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { title: 'Bugünkü Kazancım', value: `${personalStats.today.coins || 0} Coin`, icon: <Award />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { title: 'Genel Bakiyem', value: `${personalStats.info.pending_balance || 0} Coin`, icon: <DollarSign />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { title: 'Toplam Kazanç', value: `${personalStats.info.lifetime_earnings || 0} Coin`, icon: <Target />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ];
        return (
            <div className="p-10 space-y-10 animate-fade-up">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tight">Hoş Geldin, Personel</h2>
                    <p className="text-slate-500 font-bold text-sm mt-1">Bugünkü performansını ve kazançlarını buradan takip edebilirsin.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {operatorStatItems.map((stat, i) => (
                        <div key={i} className="premium-card">
                            <div className="flex items-center gap-5">
                                <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>{stat.icon}</div>
                                <div>
                                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{stat.title}</p>
                                    <p className="text-3xl font-black text-white tracking-tighter italic">{stat.value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="premium-card p-8 h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={personalStats.chart}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="label" stroke="#475569" fontSize={11} />
                            <YAxis stroke="#475569" fontSize={11} />
                            <Tooltip />
                            <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f633" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    const revB = stats?.revenueBreakdown || {};
    const usrG = stats?.userGrowth || {};
    const mon = stats?.monetization || {};
    const pulse = stats?.livePulse || {};
    const adQ = stats?.adQuality || {};
    const funnelData = stats?.funnel?.[funnelScope] || {};

    const funnelSteps = [
        { key: 'registered', label: 'Kayıt Oldu', value: funnelData.registered || 0, color: 'from-blue-600 to-indigo-500' },
        { key: 'onboarded', label: 'Profil Tamamladı', value: funnelData.onboarded || 0, color: 'from-indigo-500 to-purple-500' },
        { key: 'messaged', label: 'İlk Mesajı Attı', value: funnelData.messaged || 0, color: 'from-purple-500 to-fuchsia-500' },
        { key: 'exhausted', label: 'Ücretsiz Hak / Coin Bitti', value: funnelData.exhausted || 0, color: 'from-amber-500 to-orange-500' },
        { key: 'paid', label: 'İlk Ödemeyi Yaptı', value: funnelData.paid || 0, color: 'from-emerald-500 to-teal-400' },
        { key: 'repeat', label: 'Tekrar Satın Aldı (2+)', value: funnelData.repeat || 0, color: 'from-pink-500 to-rose-400' }
    ];
    const funnelMax = Math.max(1, funnelSteps[0]?.value || 1);

    const activePeriodStats = newUserTab === 'custom' && customNewUsers
        ? {
            count: customNewUsers.total,
            deltaPct: customNewUsers.deltaPct,
            payingCount: customNewUsers.payingCount,
            payingRatePct: customNewUsers.payingRatePct,
            revenue: customNewUsers.cohortRevenue
          }
        : (stats?.newUsers?.periods?.[newUserTab] || { count: 0, deltaPct: 0, payingCount: 0, payingRatePct: 0, revenue: 0 });

    const activeNewUserList = newUserTab === 'custom' && customNewUsers
        ? (customNewUsers.list || [])
        : (stats?.newUsers?.lists?.[newUserTab] || []);

    const peakSeries = stats?.peakHours || [];
    const maxPeakVal = Math.max(1, ...peakSeries.map((h) => (peakTab === 'revenue' ? h.revenue : h.registrations)));
    const topPeakHour = peakSeries.reduce((best, cur) => ((peakTab === 'revenue' ? cur.revenue : cur.registrations) > (peakTab === 'revenue' ? best.revenue : best.registrations) ? cur : best), peakSeries[0] || { label: '00:00', registrations: 0, revenue: 0 });

    return (
        <div className="relative p-6 md:p-10 space-y-8">
            {welcomeOverlay}

            {loading ? (
                !showIntro && <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-purple-500" size={40} /></div>
            ) : (
                <>
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-up">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-400">Yönetim Özeti</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs font-bold text-slate-400">Hoş geldiniz, {adminTitleName}</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Genel Bakış</h2>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={handleCopyWhatsappSummary}
                        className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black flex items-center gap-2 transition active:scale-95"
                    >
                        {copiedSummary ? <Check size={15} /> : <Copy size={15} />}
                        <span>{copiedSummary ? 'Özet Kopyalandı!' : 'Gün Sonu Özeti Kopyala'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={replayIntro}
                        className="px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition"
                        title="Karşılamayı Tekrar Oynat"
                    >
                        <Sparkles size={14} className="text-blue-400" />
                    </button>

                    <div className="px-4 py-2.5 bg-blue-500/5 rounded-2xl border border-blue-500/15 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em]">Sistem Yayında</span>
                    </div>
                </div>
            </div>

            {/* Scheduler Missed Day Warning */}
            {alertHealth?.hasLogsTable && alertHealth?.yesterdayMissed && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 flex-wrap">
                    <div className="text-xs text-amber-200">
                        <strong className="text-amber-300 uppercase tracking-wider">Gün Sonu Özeti Uyarısı:</strong>{' '}
                        Dün otomatik 22:00 e-posta özeti tetiklenmemiş görünüyor (Bugün: {alertHealth.todayRunCount} kez çalıştı).
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/settings')}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-black"
                    >
                        Özet & Alarm Ayarlarına Git
                    </button>
                </div>
            )}

            {/* Row 1: 4 Interactive Clickable KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {/* 1. Toplam Gelir */}
                <button
                    type="button"
                    onClick={() => openDrawer('revenue')}
                    className="premium-card p-6 text-left group hover:border-emerald-500/40 hover:-translate-y-0.5 transition-all cursor-pointer animate-fade-up stagger-1"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <DollarSign size={22} />
                        </div>
                        <DeltaBadge pct={revB.todayDeltaPct} suffix="düne göre" />
                    </div>
                    <div className="mt-4">
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Toplam Net Gelir</p>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[9px] font-black uppercase">-%35 Net</span>
                        </div>
                        <p className="text-3xl font-black text-white tracking-tight mt-1">₺{(revB.total || 0).toLocaleString('tr-TR')}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Bugün: <strong className="text-emerald-400">₺{(revB.today || 0).toLocaleString('tr-TR')}</strong> <span className="text-[10px] text-slate-500">(Brüt ₺{(revB.grossTotal || 0).toLocaleString('tr-TR')})</span></span>
                        <span className="text-[11px] font-black text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Detaylar <ArrowUpRight size={13} /></span>
                    </div>
                </button>

                {/* 2. Kullanıcı Sayısı */}
                <button
                    type="button"
                    onClick={() => openDrawer('users')}
                    className="premium-card p-6 text-left group hover:border-blue-500/40 hover:-translate-y-0.5 transition-all cursor-pointer animate-fade-up stagger-2"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Users size={22} />
                        </div>
                        <DeltaBadge pct={usrG.todayDeltaPct} suffix="düne göre" />
                    </div>
                    <div className="mt-4">
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Kullanıcı Sayısı</p>
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[9px] font-black uppercase">Toplam</span>
                            {(usrG.total || 0) < 30 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-black">az veri</span>
                            )}
                        </div>
                        <p className="text-3xl font-black text-white tracking-tight mt-1">{usrG.total || 0}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold">Bugün: <strong className="text-blue-400">+{usrG.today || 0} üye</strong></span>
                        <span className="text-[11px] font-black text-blue-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Detaylar <ArrowUpRight size={13} /></span>
                    </div>
                </button>

                {/* 3. Öneri A: Ödeme Dönüşümü & ARPPU */}
                <button
                    type="button"
                    onClick={() => openDrawer('conversion')}
                    className="premium-card p-6 text-left group hover:border-amber-500/40 hover:-translate-y-0.5 transition-all cursor-pointer animate-fade-up stagger-3"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Award size={22} />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {revB.totalOrders || 0} Sipariş
                        </span>
                    </div>
                    <div className="mt-4">
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Ödeme Dönüşümü & ARPPU</p>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[9px] font-black uppercase">Toplam</span>
                            {(usrG.total || 0) < 30 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-black">az veri</span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-2.5 mt-1">
                            <p className="text-3xl font-black text-white tracking-tight">%{mon.conversionRatePct || 0}</p>
                            <span className="text-xs font-bold text-amber-400">({mon.payingUsers || 0} ödeyen)</span>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold">ARPPU: <strong className="text-white">₺{(mon.arppu || 0).toLocaleString('tr-TR')}</strong></span>
                        <span className="text-[11px] font-black text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Paketler <ArrowUpRight size={13} /></span>
                    </div>
                </button>

                {/* 4. Öneri A: Canlı Nabız & Fırsat Radarı */}
                <button
                    type="button"
                    onClick={() => openDrawer('pulse')}
                    className="premium-card p-6 text-left group hover:border-rose-500/40 hover:-translate-y-0.5 transition-all cursor-pointer animate-fade-up stagger-4"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <Flame size={22} />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Canlı
                        </span>
                    </div>
                    <div className="mt-4">
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Canlı Aktiflik & Huni Radarı</p>
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 text-[9px] font-black uppercase">Anlık</span>
                        </div>
                        <div className="flex items-baseline gap-2.5 mt-1">
                            <p className="text-3xl font-black text-white tracking-tight">{pulse.liveOnlineCount || 0}</p>
                            <span className="text-xs font-bold text-slate-400">aktif üye</span>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-semibold">0 Coin (24s): <strong className="text-amber-400">{pulse.exhausted24h || 0}</strong> • Silen: <strong className="text-rose-400">{pulse.pushUnregistered24h || 0}</strong></span>
                        <span className="text-[11px] font-black text-rose-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">Radar <ArrowUpRight size={13} /></span>
                    </div>
                </button>
            </div>

            {/* Period Comparison & Monthly Target Strip */}
            {targetsInfo && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up stagger-2">
                    <div className="premium-card p-5 flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bu Hafta vs Geçen Hafta</span>
                            <DeltaBadge pct={targetsInfo.comparisons?.weekVsPrevWeek?.revenue?.deltaPct} />
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                            <span className="text-lg font-black text-white">₺{(targetsInfo.comparisons?.weekVsPrevWeek?.revenue?.current || 0).toLocaleString('tr-TR')}</span>
                            <span className="text-slate-400">
                                {targetsInfo.comparisons?.weekVsPrevWeek?.registrations?.current || 0} kayıt • %{targetsInfo.comparisons?.weekVsPrevWeek?.conversionPct?.current || 0} dönüşüm
                            </span>
                        </div>
                    </div>

                    <div className="premium-card p-5 flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bu Ay vs Geçen Ay</span>
                            <DeltaBadge pct={targetsInfo.comparisons?.monthVsPrevMonth?.revenue?.deltaPct} />
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                            <span className="text-lg font-black text-white">₺{(targetsInfo.comparisons?.monthVsPrevMonth?.revenue?.current || 0).toLocaleString('tr-TR')}</span>
                            <span className="text-slate-400">
                                {targetsInfo.comparisons?.monthVsPrevMonth?.registrations?.current || 0} kayıt • %{targetsInfo.comparisons?.monthVsPrevMonth?.conversionPct?.current || 0} dönüşüm
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/analytics')}
                        className="premium-card p-5 text-left hover:border-emerald-500/30 transition space-y-2"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Aylık Hedef ({targetsInfo.monthKey})</span>
                            <span className="text-[11px] font-black text-slate-300">
                                Tahmin: ₺{(targetsInfo.target?.forecastRevenue || 0).toLocaleString('tr-TR')}
                            </span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                style={{ width: `${Math.min(100, targetsInfo.target?.revenueProgressPct || 0)}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-slate-400 flex justify-between">
                            <span>₺{(targetsInfo.target?.actualRevenue || 0).toLocaleString('tr-TR')} / {targetsInfo.target?.revenueTarget > 0 ? `₺${targetsInfo.target.revenueTarget.toLocaleString('tr-TR')}` : 'Hedef tanımla →'}</span>
                            <span>{targetsInfo.target?.actualRegistrations || 0} / {targetsInfo.target?.registrationsTarget || '—'} üye</span>
                        </p>
                    </button>
                </div>
            )}

            {/* Row 2: Replacing 2 Simple Charts with Actionable Decision Modules */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-up stagger-2">
                {/* Left Module: Dönüşüm Hunisi & İlk 30dk Reklam Kalitesi + Paket Payı */}
                <div className="premium-card p-6 md:p-7 flex flex-col justify-between space-y-6">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-white/10">
                            <button
                                type="button"
                                onClick={() => setLeftTab('funnel')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${leftTab === 'funnel' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                <Filter size={13} className="inline mr-1" /> Dönüşüm Hunisi
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeftTab('packages')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${leftTab === 'packages' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                Paket Payı
                            </button>
                        </div>

                        {leftTab === 'funnel' && (
                            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-white/5 text-[10px] font-black">
                                <button type="button" onClick={() => setFunnelScope('all')} className={`px-2.5 py-1 rounded ${funnelScope === 'all' ? 'bg-white/15 text-white' : 'text-slate-500'}`}>Tümü</button>
                                <button type="button" onClick={() => setFunnelScope('week7d')} className={`px-2.5 py-1 rounded ${funnelScope === 'week7d' ? 'bg-white/15 text-white' : 'text-slate-500'}`}>Son 7 Gün</button>
                            </div>
                        )}
                    </div>

                    {leftTab === 'funnel' ? (
                        <div className="space-y-3">
                            {funnelSteps.map((step, i) => {
                                const prevVal = i > 0 ? (funnelSteps[i - 1].value || 0) : step.value;
                                const stepPct = prevVal > 0 ? Math.round((step.value / prevVal) * 100) : 0;
                                const barWidth = Math.max(4, Math.round((step.value / funnelMax) * 100));
                                return (
                                    <div key={step.key} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-200">{step.label}</span>
                                            <div className="flex items-center gap-2">
                                                {i > 0 && <span className="text-[10px] font-black text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">%{stepPct} geçiş</span>}
                                                <span className="font-black text-white w-10 text-right">{step.value}</span>
                                            </div>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-slate-900 overflow-hidden border border-white/5">
                                            <div className={`h-full rounded-full bg-gradient-to-r ${step.color} transition-all duration-700`} style={{ width: `${barWidth}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                            {(revB.byPackage || []).map((pk, idx) => (
                                <div key={idx} className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-white">{pk.name} <span className="text-slate-400">({pk.orders} adet)</span></span>
                                        <span className="text-emerald-400">₺{pk.revenue.toLocaleString('tr-TR')} • %{pk.sharePct}</span>
                                    </div>
                                    <div className="h-2.5 rounded-full bg-slate-900 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full" style={{ width: `${Math.max(3, pk.sharePct)}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Ek Öneri 1: İlk 30 Dk Reklam Kalitesi & Hız Barı */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-fuchsia-500/10 to-blue-500/10 border border-white/10 grid grid-cols-3 gap-3 text-center">
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">İlk 30 Dk Ödeyen (7G)</p>
                            <p className="text-lg font-black text-amber-300 mt-0.5">%{adQ.within30mPct7d || 0} <span className="text-xs text-slate-400">({adQ.paidWithin30m7d || 0})</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">Bugün İlk 30 Dk</p>
                            <p className="text-lg font-black text-emerald-300 mt-0.5">%{adQ.within30mPctToday || 0} <span className="text-xs text-slate-400">({adQ.paidWithin30mToday || 0})</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400">Ort. İlk Ödeme Hızı</p>
                            <p className="text-lg font-black text-white mt-0.5">{adQ.avgMinutesToPay || 0} dk</p>
                        </div>
                    </div>
                </div>

                {/* Right Module: Canlı Ödemeler / 0 Coin Sıcak Liste / Sadık Müşteriler & Biten Premiumlar (Ek Öneri 2) */}
                <div className="premium-card p-6 md:p-7 flex flex-col space-y-5">
                    <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-white/10 flex-wrap w-fit">
                        <button
                            type="button"
                            onClick={() => setRightTab('payments')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${rightTab === 'payments' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Canlı Ödemeler
                        </button>
                        <button
                            type="button"
                            onClick={() => setRightTab('hot')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${rightTab === 'hot' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            0 Coin Sıcak ({pulse.hotZeroCoinUsers?.length || 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRightTab('loyal')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${rightTab === 'loyal' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Crown size={12} className="inline mr-1" /> Sadık & VIP
                        </button>
                    </div>

                    <div className="flex-1 space-y-2.5 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
                        {rightTab === 'payments' && (stats?.recentPayments || []).map((p) => (
                            <div key={p.id} className="p-3 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center justify-between gap-3 hover:bg-slate-800/70 transition">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img src={p.user_avatar || 'https://via.placeholder.com/80'} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-white truncate">{p.user_name}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{p.package_name} • {new Date(p.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black shrink-0">
                                    +₺{p.amount.toLocaleString('tr-TR')}
                                </span>
                            </div>
                        ))}

                        {rightTab === 'hot' && (pulse.hotZeroCoinUsers || []).map((hu) => (
                            <div key={hu.id} className="p-3 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img src={hu.avatar_url || 'https://via.placeholder.com/80'} alt="" className="w-10 h-10 rounded-xl object-cover border border-amber-500/30 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-white truncate">{hu.display_name || hu.username}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{hu.city || 'Şehir yok'} • 🪙 {hu.balance} Coin • {hu.pay_count > 0 ? `${hu.pay_count} alım` : 'Yeni'}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate(hu.last_chat_id ? '/chats' : '/users')}
                                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-black shrink-0"
                                >
                                    Sohbet →
                                </button>
                            </div>
                        ))}

                        {rightTab === 'loyal' && (
                            <>
                                {(stats?.expiringPremiums || []).length > 0 && (
                                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-1.5 mb-2">
                                        <p className="text-[10px] font-black uppercase text-rose-300">Süresi Yakında Bitecek Premiumlar (7 Gün)</p>
                                        {stats.expiringPremiums.map((ep) => (
                                            <div key={ep.id} className="flex justify-between text-xs text-white">
                                                <span className="font-bold truncate">{ep.display_name || ep.username}</span>
                                                <span className="text-rose-300 font-bold">{new Date(ep.expires_at).toLocaleDateString('tr-TR')}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {(stats?.loyalBuyers || []).map((lb, idx) => (
                                    <div key={lb.id} className="p-3 rounded-2xl bg-slate-900/70 border border-white/5 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-black flex items-center justify-center shrink-0">#{idx + 1}</span>
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-white truncate">{lb.display_name || lb.username} {lb.is_active_premium ? '👑' : ''}</p>
                                                <p className="text-[11px] text-slate-400">{lb.orders} sipariş • VIP Lv.{lb.vip_level || 0} • 🪙 {lb.balance}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-emerald-400 shrink-0">₺{lb.total_tl.toLocaleString('tr-TR')}</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Ek Öneri 3: 24 Saatlik Yoğunluk Şeridi (Peak Hours) */}
            <div className="premium-card p-6 space-y-4 animate-fade-up stagger-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                            <Clock size={16} className="text-indigo-400" /> 24 Saatlik Yoğunluk Şeridi (Son 7 Gün • TR Saati)
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            En yoğun saat: <strong className="text-indigo-300">{topPeakHour.label}</strong> ({peakTab === 'revenue' ? `₺${(topPeakHour.revenue || 0).toLocaleString('tr-TR')}` : `${topPeakHour.registrations || 0} kayıt`})
                        </p>
                    </div>
                    <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/10 w-fit">
                        <button type="button" onClick={() => setPeakTab('registrations')} className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase ${peakTab === 'registrations' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Kayıt Yoğunluğu</button>
                        <button type="button" onClick={() => setPeakTab('revenue')} className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase ${peakTab === 'revenue' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Satış Yoğunluğu</button>
                    </div>
                </div>
                <div className="flex items-end gap-1 sm:gap-1.5 h-24 pt-3">
                    {peakSeries.map((h) => {
                        const val = peakTab === 'revenue' ? h.revenue : h.registrations;
                        const pct = Math.max(8, Math.round((val / maxPeakVal) * 100));
                        return (
                            <div key={h.hour} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end group relative" title={`${h.label}: ${peakTab === 'revenue' ? `₺${h.revenue} (${h.orders} sip.)` : `${h.registrations} kayıt`}`}>
                                <div className="w-full bg-slate-900 rounded-md h-full flex items-end overflow-hidden border border-white/5">
                                    <div
                                        className={`w-full rounded-t-md transition-all duration-500 ${peakTab === 'revenue' ? 'bg-gradient-to-t from-emerald-600 to-teal-400' : 'bg-gradient-to-t from-indigo-600 to-blue-400'} ${val === 0 ? 'opacity-20' : 'opacity-90 group-hover:opacity-100'}`}
                                        style={{ height: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-[9px] font-bold text-slate-500">{String(h.hour).padStart(2, '0')}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Günlük Kayıt, Alım & Ciro Raporu (Son 14 Gün) */}
            {stats?.dailyReport?.length > 0 && (
                <div className="premium-card p-6 md:p-8 space-y-5 animate-fade-up stagger-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                                <Calendar size={20} className="text-emerald-400" /> Günlük Kayıt & Alım Raporu (Son 14 Gün)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Her gün kaç kişi kayıt olmuş, o günün kayıtlarından kaçı ödeme yapmış ve gün içinde toplam kaç kişi kaç TL kazandırmış (detay için satıra tıklayın).
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[680px]">
                            <thead>
                                <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <th className="py-3 px-3">Tarih</th>
                                    <th className="py-3 px-3">Kayıt Olan</th>
                                    <th className="py-3 px-3">Bugünkü Kayıttan Yatıran</th>
                                    <th className="py-3 px-3">O Gün Alım Yapan (Tüm)</th>
                                    <th className="py-3 px-3 text-right">Günlük Net Kazanç (-%35)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs">
                                {stats.dailyReport.map((day, idx) => (
                                    <tr
                                        key={day.date}
                                        onClick={() => openDrawer('revenue', { start: day.date, end: day.date })}
                                        className="hover:bg-white/[0.04] transition cursor-pointer group"
                                    >
                                        <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                                            {new Date(`${day.date}T12:00:00`).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', weekday: 'short' })}
                                            {idx === 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[9px] font-black uppercase">Bugün</span>}
                                        </td>
                                        <td className="py-3 px-3 font-black text-blue-300">
                                            {day.registered} üye
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="font-black text-amber-300">{day.cohortPaying} kişi</span>
                                            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 text-[10px] font-bold">%{day.cohortRatePct}</span>
                                            {day.cohortRevenue > 0 && (
                                                <span className="ml-2 text-[11px] text-slate-400">(₺{day.cohortRevenue.toLocaleString('tr-TR')})</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-slate-200 font-bold">
                                            {day.totalBuyers} kişi <span className="text-slate-500 font-medium">({day.totalOrders} sipariş)</span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-black text-emerald-400 group-hover:underline">
                                            <div>₺{day.totalRevenue.toLocaleString('tr-TR')}</div>
                                            {day.grossTotalRevenue > 0 && (
                                                <div className="text-[10px] font-medium text-slate-500 no-underline">Brüt: ₺{day.grossTotalRevenue.toLocaleString('tr-TR')}</div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Row 4: Gelişmiş Yeni Kayıt Olanlar (Kıyaslama % & Ödeme Oranı %) */}
            {stats?.newUsers && (
                <div className="premium-card p-6 md:p-8 space-y-6 animate-fade-up stagger-4">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                                <UserPlus className="text-fuchsia-500" size={22} /> Yeni Kayıt Olanlar & Dönüşüm
                            </h3>
                            <div className="flex items-center gap-3 flex-wrap mt-2">
                                <span className="text-xs font-bold text-slate-300">
                                    Toplam: <strong className="text-white text-sm">{activePeriodStats.count}</strong> üye
                                </span>
                                <DeltaBadge pct={activePeriodStats.deltaPct} suffix="önceki dönem" />
                                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black">
                                    Ödeme Oranı: %{activePeriodStats.payingRatePct} ({activePeriodStats.payingCount} kişi • ₺{(activePeriodStats.revenue || 0).toLocaleString('tr-TR')})
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex bg-slate-900/70 p-1 rounded-2xl border border-white/10 flex-wrap">
                                {[
                                    { id: 'today', label: 'Bugün', count: stats.newUsers.counts.today },
                                    { id: 'yesterday', label: 'Dün', count: stats.newUsers.counts.yesterday },
                                    { id: 'week', label: 'Bu Hafta', count: stats.newUsers.counts.week },
                                    { id: 'month', label: 'Bu Ay', count: stats.newUsers.counts.month },
                                    { id: 'custom', label: 'Tarih Seç', count: null }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setNewUserTab(tab.id)}
                                        className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition flex items-center gap-1.5 ${
                                            newUserTab === tab.id ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30' : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {tab.id === 'custom' && <Calendar size={12} />}
                                        {tab.label}
                                        {tab.count !== null && (
                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${newUserTab === tab.id ? 'bg-white/20' : 'bg-slate-800'}`}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {newUserTab === 'custom' && (
                        <div className="flex items-center gap-2.5 flex-wrap p-3 rounded-2xl bg-slate-900/70 border border-white/10">
                            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="bg-slate-950 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-bold text-white" />
                            <span className="text-slate-500 text-xs font-bold">→</span>
                            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="bg-slate-950 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-bold text-white" />
                            <button type="button" onClick={fetchCustomNewUsers} className="px-4 py-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-xs font-black text-white">Getir</button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                        {activeNewUserList.length > 0 ? activeNewUserList.map((u) => (
                            <div
                                key={u.id}
                                onClick={() => navigate('/chats')}
                                className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 flex flex-col gap-2.5 hover:bg-slate-800/80 hover:border-fuchsia-500/40 transition cursor-pointer group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative shrink-0">
                                        <img src={u.avatar_url || 'https://via.placeholder.com/100'} alt={u.username} className="w-11 h-11 rounded-full object-cover border border-white/10" />
                                        {u.is_online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" title="Çevrimiçi" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-white truncate">{u.display_name || u.username}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{u.city || 'Şehir yok'}{u.age ? ` • ${u.age}y` : ''}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/5 text-[10px] font-black">
                                    <span className={`px-2 py-0.5 rounded-full ${Number(u.balance || 0) <= 0 ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}`}>
                                        🪙 {u.balance || 0}
                                    </span>
                                    {Number(u.paid_total || 0) > 0 ? (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                            💳 ₺{Number(u.paid_total).toLocaleString('tr-TR')}
                                        </span>
                                    ) : (
                                        <span className="text-slate-500">
                                            {new Date(u.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full py-8 text-center text-slate-500 text-sm font-medium">
                                Bu aralıkta yeni kayıt bulunmuyor.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Bottom Section: Recent Activities + Quick Access */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 premium-card p-6 md:p-8">
                    <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2.5">
                        <Activity size={20} className="text-blue-500" /> Son Aktiviteler
                    </h3>
                    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                        {activities.map((act) => (
                            <div key={act.id} className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 border border-white/5">
                                    {act.action_type === 'purchase' ? <ShoppingCart className="text-emerald-400" size={18} /> :
                                        act.action_type === 'free_messages_exhausted' ? <Zap className="text-amber-400" size={18} /> :
                                        act.action_type === 'register' ? <UserPlus className="text-blue-400" size={18} /> :
                                        <LogIn className="text-slate-400" size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate"><span className="text-blue-400">@{act.user_name}</span> {act.description}</p>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{act.action_type}</span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-black shrink-0">{new Date(act.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="premium-card p-6 md:p-8 space-y-4">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Hızlı Erişim</h3>
                    <button type="button" onClick={() => navigate('/notifications')} className="w-full p-4 bg-white/5 hover:bg-blue-600/15 rounded-2xl flex items-center gap-4 transition border border-white/5 text-left">
                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><Mail size={20} /></div>
                        <div>
                            <p className="text-sm font-black text-white">Toplu Bildirim</p>
                            <p className="text-[11px] text-slate-400">Tüm kullanıcılara push ilet</p>
                        </div>
                    </button>
                    <button type="button" onClick={() => navigate('/admin-users')} className="w-full p-4 bg-white/5 hover:bg-indigo-600/15 rounded-2xl flex items-center gap-4 transition border border-white/5 text-left">
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl"><ShieldCheck size={20} /></div>
                        <div>
                            <p className="text-sm font-black text-white">Yetkili & Moderatör</p>
                            <p className="text-[11px] text-slate-400">Personel izinlerini yönet</p>
                        </div>
                    </button>
                    <button type="button" onClick={() => navigate('/payments')} className="w-full p-4 bg-white/5 hover:bg-emerald-600/15 rounded-2xl flex items-center gap-4 transition border border-white/5 text-left">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><DollarSign size={20} /></div>
                        <div>
                            <p className="text-sm font-black text-white">Ödemeler & Paketler</p>
                            <p className="text-[11px] text-slate-400">Detaylı ödeme geçmişi</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Interactive KPI Detail Drawer */}
            <KpiDetailDrawer openTab={drawerTab} initialRange={drawerRange} onClose={() => { setDrawerTab(null); setDrawerRange(null); }} stats={stats} />
                </>
            )}
        </div>
    );
}
