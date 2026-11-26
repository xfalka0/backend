import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Calendar, TrendingUp, TrendingDown, Users, DollarSign, Award, Flame, ArrowUpRight, Loader2, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

const getTodayTrDate = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const getOffsetTrDate = (daysAgo) => new Date(Date.now() + 3 * 3600 * 1000 - daysAgo * 86400000).toISOString().slice(0, 10);

export const DeltaBadge = ({ pct, suffix = '' }) => {
    const val = Number(pct || 0);
    const positive = val >= 0;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
            positive
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        }`}>
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {positive ? `+${val}%` : `${val}%`}
            {suffix ? <span className="opacity-75 font-bold ml-0.5">{suffix}</span> : null}
        </span>
    );
};

export default function KpiDetailDrawer({ openTab, initialRange, onClose, stats }) {
    const navigate = useNavigate();
    const [startDate, setStartDate] = useState(() => initialRange?.start || getTodayTrDate());
    const [endDate, setEndDate] = useState(() => initialRange?.end || getTodayTrDate());
    const [rangeData, setRangeData] = useState(null);
    const [loadingRange, setLoadingRange] = useState(false);

    const fetchRange = async (s, e) => {
        setLoadingRange(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/stats/range?start=${s}&end=${e}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRangeData(res.data);
        } catch (err) {
            console.error('Range stats fetch error:', err);
        } finally {
            setLoadingRange(false);
        }
    };

    useEffect(() => {
        if (openTab && (openTab === 'revenue' || openTab === 'users')) {
            const s = initialRange?.start || getTodayTrDate();
            const e = initialRange?.end || s;
            setStartDate(s);
            setEndDate(e);
            fetchRange(s, e);
        }
    }, [openTab, initialRange?.start, initialRange?.end]);

    if (!openTab) return null;

    const applyPreset = (daysBackStart, daysBackEnd = 0) => {
        const s = getOffsetTrDate(daysBackStart);
        const e = getOffsetTrDate(daysBackEnd);
        setStartDate(s);
        setEndDate(e);
        fetchRange(s, e);
    };

    const titles = {
        revenue: { title: 'Gelir & Ciro Analizi', subtitle: 'Günlük, haftalık, aylık ve tarih bazlı gerçek Google Play cirosu', icon: <DollarSign className="text-emerald-400" size={22} /> },
        users: { title: 'Kullanıcı Büyüme & Kayıt Analizi', subtitle: 'Düne, geçen haftaya ve aya göre artış/azalış & şehir dağılımı', icon: <Users className="text-blue-400" size={22} /> },
        conversion: { title: 'Ödeme Dönüşümü & ARPPU Detayı', subtitle: 'Üyelerin ödeme oranı, tekrar alımlar ve paket performansı', icon: <Award className="text-amber-400" size={22} /> },
        pulse: { title: 'Canlı Aktiflik & Huni Radarı', subtitle: 'Anlık çevrimiçi üyeler, 0 coinli sıcak fırsatlar ve silme sinyalleri', icon: <Flame className="text-rose-400" size={22} /> }
    };

    const meta = titles[openTab] || titles.revenue;
    const revB = stats?.revenueBreakdown || {};
    const usrG = stats?.userGrowth || {};
    const mon = stats?.monetization || {};
    const pulse = stats?.livePulse || {};

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-full max-w-3xl h-full bg-[#060b1b] border-l border-white/10 shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10 bg-slate-950/90 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            {meta.icon}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-white tracking-tight truncate">{meta.title}</h3>
                            <p className="text-xs text-slate-400 font-medium truncate">{meta.subtitle}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {(openTab === 'revenue' || openTab === 'users') && (
                        <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Calendar size={14} className="text-blue-400" /> Tarih Aralığı Seç
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {[
                                        { label: 'Bugün', fn: () => applyPreset(0, 0) },
                                        { label: 'Dün', fn: () => applyPreset(1, 1) },
                                        { label: 'Son 7 Gün', fn: () => applyPreset(6, 0) },
                                        { label: 'Son 30 Gün', fn: () => applyPreset(29, 0) }
                                    ].map((p) => (
                                        <button
                                            key={p.label}
                                            type="button"
                                            onClick={p.fn}
                                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-blue-600/25 border border-white/10 text-[11px] font-bold text-slate-200 transition"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                />
                                <span className="text-slate-500 font-bold text-xs">→</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => fetchRange(startDate, endDate)}
                                    disabled={loadingRange}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-black text-white transition flex items-center gap-1.5 disabled:opacity-60"
                                >
                                    {loadingRange ? <Loader2 size={14} className="animate-spin" /> : null}
                                    Sorgula
                                </button>
                            </div>
                        </div>
                    )}

                    {/* REVENUE DRAWER */}
                    {openTab === 'revenue' && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Bugün', value: `₺${(revB.today || 0).toLocaleString('tr-TR')}`, sub: `${revB.todayOrders || 0} sipariş`, delta: revB.todayDeltaPct },
                                    { label: 'Dün', value: `₺${(revB.yesterday || 0).toLocaleString('tr-TR')}`, sub: `${revB.yesterdayOrders || 0} sipariş` },
                                    { label: 'Bu Hafta', value: `₺${(revB.week || 0).toLocaleString('tr-TR')}`, sub: `Önceki: ₺${(revB.prevWeek || 0).toLocaleString('tr-TR')}`, delta: revB.weekDeltaPct },
                                    { label: 'Bu Ay', value: `₺${(revB.month || 0).toLocaleString('tr-TR')}`, sub: `Önceki: ₺${(revB.prevMonth || 0).toLocaleString('tr-TR')}`, delta: revB.monthDeltaPct }
                                ].map((c, idx) => (
                                    <div key={idx} className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1.5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{c.label}</p>
                                        <p className="text-xl font-black text-white">{c.value}</p>
                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                            <span className="text-[11px] text-slate-400 font-medium">{c.sub}</span>
                                            {c.delta !== undefined && <DeltaBadge pct={c.delta} />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {rangeData?.revenue && (
                                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                                                Seçili Tarih ({rangeData.range.start} → {rangeData.range.end})
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-3xl font-black text-white">₺{rangeData.revenue.total.toLocaleString('tr-TR')}</span>
                                                <DeltaBadge pct={rangeData.revenue.deltaPct} suffix="önceki dönem" />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-slate-300">{rangeData.revenue.orders} Sipariş • {rangeData.revenue.payingUsers} Kişi</p>
                                            <p className="text-[11px] text-slate-500">Önceki eşit aralık: ₺{rangeData.revenue.prevTotal.toLocaleString('tr-TR')}</p>
                                        </div>
                                    </div>

                                    {rangeData.revenue.byPackage?.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10">
                                            {rangeData.revenue.byPackage.map((pk, idx) => (
                                                <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-white/10">
                                                    <p className="text-xs font-bold text-white truncate">{pk.name}</p>
                                                    <p className="text-sm font-black text-emerald-400 mt-0.5">₺{pk.revenue.toLocaleString('tr-TR')}</p>
                                                    <p className="text-[10px] text-slate-400">{pk.orders} adet</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {rangeData.revenue.payments?.length > 0 && (
                                        <div className="space-y-2 pt-2 border-t border-white/10 max-h-64 overflow-y-auto custom-scrollbar">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seçili Aralıktaki İşlemler</p>
                                            {rangeData.revenue.payments.map((p) => (
                                                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-xs">
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-white truncate">{p.user_name} <span className="text-slate-500 font-normal">({p.package_name})</span></p>
                                                        <p className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleString('tr-TR')}</p>
                                                    </div>
                                                    <span className="font-black text-emerald-400 shrink-0 ml-2">₺{p.amount.toLocaleString('tr-TR')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* USERS DRAWER */}
                    {openTab === 'users' && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Bugün Kayıt', value: usrG.today || 0, sub: `Dün: ${usrG.yesterday || 0}`, delta: usrG.todayDeltaPct },
                                    { label: 'Bu Hafta', value: usrG.week || 0, sub: `Önceki: ${usrG.prevWeek || 0}`, delta: usrG.weekDeltaPct },
                                    { label: 'Bu Ay', value: usrG.month || 0, sub: `Önceki: ${usrG.prevMonth || 0}`, delta: usrG.monthDeltaPct },
                                    { label: '0 Coin / Premium', value: usrG.zeroCoinUsers || 0, sub: `${usrG.activePremiumUsers || 0} Premium aktif` }
                                ].map((c, idx) => (
                                    <div key={idx} className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1.5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{c.label}</p>
                                        <p className="text-2xl font-black text-white">{c.value}</p>
                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                            <span className="text-[11px] text-slate-400 font-medium">{c.sub}</span>
                                            {c.delta !== undefined && <DeltaBadge pct={c.delta} />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {rangeData?.users && (
                                <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-blue-400">
                                                Seçili Tarih ({rangeData.range.start} → {rangeData.range.end})
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-3xl font-black text-white">{rangeData.users.total} Kayıt</span>
                                                <DeltaBadge pct={rangeData.users.deltaPct} suffix="önceki dönem" />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-emerald-400">
                                                Ödeme Oranı: %{rangeData.users.payingRatePct} ({rangeData.users.payingCount} kişi)
                                            </p>
                                            <p className="text-[11px] text-slate-400">Bu kayıtlardan ciro: ₺{rangeData.users.cohortRevenue.toLocaleString('tr-TR')}</p>
                                        </div>
                                    </div>

                                    {rangeData.users.daily?.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-1">
                                            {rangeData.users.daily.map((d) => (
                                                <div key={d.label} className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-center shrink-0">
                                                    <p className="text-[10px] text-slate-400 font-bold">{d.label}</p>
                                                    <p className="text-sm font-black text-white">{d.count}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-300">En Çok Kayıt Gelen Şehirler</p>
                                    <div className="space-y-2">
                                        {(usrG.topCities || []).map((c, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs">
                                                <span className="text-slate-300 font-bold">{c.city}</span>
                                                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-black">{c.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                                    <p className="text-xs font-black uppercase tracking-wider text-slate-300">Cinsiyet Dağılımı</p>
                                    <div className="space-y-2.5 text-xs">
                                        <div className="flex justify-between"><span className="text-blue-300 font-bold">Erkek</span><span className="font-black text-white">{usrG.gender?.male || 0}</span></div>
                                        <div className="flex justify-between"><span className="text-pink-300 font-bold">Kadın</span><span className="font-black text-white">{usrG.gender?.female || 0}</span></div>
                                        <div className="flex justify-between"><span className="text-slate-400 font-bold">Belirtilmedi</span><span className="font-black text-white">{usrG.gender?.other || 0}</span></div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* CONVERSION DRAWER */}
                    {openTab === 'conversion' && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    { label: 'Ödeme Dönüşüm Oranı', value: `%${mon.conversionRatePct || 0}`, sub: `${mon.payingUsers || 0} ödeyen üye` },
                                    { label: 'ARPPU (Ödeyen Başına)', value: `₺${(mon.arppu || 0).toLocaleString('tr-TR')}`, sub: `ARPU: ₺${(mon.arpu || 0).toLocaleString('tr-TR')}` },
                                    { label: 'Tekrar Satın Alma', value: `%${mon.repeatRatePct || 0}`, sub: `${mon.repeatBuyers || 0} sadık müşteri` }
                                ].map((m, idx) => (
                                    <div key={idx} className="p-4 rounded-2xl bg-slate-900/80 border border-white/10">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{m.label}</p>
                                        <p className="text-2xl font-black text-amber-400 mt-1">{m.value}</p>
                                        <p className="text-[11px] text-slate-400 mt-1">{m.sub}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                                <p className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                                    <Package size={15} className="text-purple-400" /> Paket Bazlı Gelir & Sipariş Kırılımı
                                </p>
                                <div className="space-y-2.5">
                                    {(revB.byPackage || []).map((pk, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-white">{pk.name} <span className="text-slate-400">({pk.orders} sipariş)</span></span>
                                                <span className="text-emerald-400">₺{pk.revenue.toLocaleString('tr-TR')} (%{pk.sharePct})</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(100, pk.sharePct)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* LIVE PULSE DRAWER */}
                    {openTab === 'pulse' && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                                    <p className="text-[10px] font-black uppercase text-emerald-300">Şu An Aktif Üye</p>
                                    <p className="text-3xl font-black text-white mt-1">{pulse.liveOnlineCount || 0}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                                    <p className="text-[10px] font-black uppercase text-amber-300">24s Hak Biten</p>
                                    <p className="text-3xl font-black text-white mt-1">{pulse.exhausted24h || 0}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                                    <p className="text-[10px] font-black uppercase text-rose-300">24s Silme Sinyali</p>
                                    <p className="text-3xl font-black text-white mt-1">{pulse.pushUnregistered24h || 0}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30">
                                    <p className="text-[10px] font-black uppercase text-fuchsia-300">AI Kanca Dönüşümü</p>
                                    <p className="text-2xl font-black text-white mt-1">%{pulse.aiHookConversionPct || 0}</p>
                                    <p className="text-[10px] text-slate-400">{pulse.aiHooksPaid || 0}/{pulse.aiHooksTotal || 0} ödedi</p>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <p className="text-xs font-black uppercase tracking-wider text-amber-300">Coin Bitti / Sıcak Kullanıcılar (Son 12s & Online)</p>
                                {(pulse.hotZeroCoinUsers || []).map((hu) => (
                                    <div key={hu.id} className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={hu.avatar_url || 'https://via.placeholder.com/100'} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{hu.display_name || hu.username}</p>
                                                <p className="text-[11px] text-slate-400 truncate">
                                                    {hu.city || 'Şehir yok'} • 🪙 {hu.balance} Coin • {hu.pay_count > 0 ? `${hu.pay_count} eski alım` : 'Hiç almadı'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { onClose(); navigate(hu.last_chat_id ? '/chats' : '/users'); }}
                                            className="px-3 py-2 rounded-xl bg-fuchsia-600/25 hover:bg-fuchsia-600/40 border border-fuchsia-500/40 text-xs font-black text-fuchsia-200 flex items-center gap-1 shrink-0"
                                        >
                                            İncele <ArrowUpRight size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
