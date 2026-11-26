import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, DollarSign, Users, ShoppingBag, ArrowUp, ArrowDown,
    Target, Megaphone, Plus, Trash2, Info, Save, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const fmtTl = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DeltaBadge = ({ pct }) => {
    const val = Number(pct || 0);
    const positive = val >= 0;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${
            positive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
        }`}>
            {positive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {positive ? `+${val}%` : `${val}%`}
        </span>
    );
};

const LowSampleBadge = () => (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
        az veri
    </span>
);

export default function Analytics() {
    const { token } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('revenue'); // 'revenue' | 'acquisition'
    const [range, setRange] = useState('7');
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState(null);
    const [topBuyers, setTopBuyers] = useState([]);
    const [targetsData, setTargetsData] = useState(null);
    const [targetForm, setTargetForm] = useState({ revenueTarget: '', registrationsTarget: '' });
    const [targetSaving, setTargetSaving] = useState(false);
    const [targetMsg, setTargetMsg] = useState(null);

    const [acqData, setAcqData] = useState(null);
    const [spendForm, setSpendForm] = useState({
        spend_date: new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10),
        source: 'meta_ads',
        campaign: '',
        amount: '',
        notes: ''
    });
    const [spendMsg, setSpendMsg] = useState(null);
    const [spendSaving, setSpendSaving] = useState(false);

    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        fetchAnalytics();
    }, [range]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const [statsRes, buyersRes, targetsRes, acqRes] = await Promise.all([
                fetch(`${API_URL}/admin/analytics/summary?days=${range}`, { headers }),
                fetch(`${API_URL}/admin/analytics/top-buyers?days=${range}`, { headers }),
                fetch(`${API_URL}/admin/targets`, { headers }),
                fetch(`${API_URL}/admin/analytics/acquisition?days=${range}`, { headers }),
            ]);
            if (statsRes.ok) setStats(await statsRes.json());
            if (buyersRes.ok) setTopBuyers((await buyersRes.json()).slice(0, 10));
            if (targetsRes.ok) {
                const tJson = await targetsRes.json();
                setTargetsData(tJson);
                setTargetForm({
                    revenueTarget: tJson.target?.revenueTarget || '',
                    registrationsTarget: tJson.target?.registrationsTarget || '',
                });
            }
            if (acqRes.ok) setAcqData(await acqRes.json());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleSaveTarget = async (e) => {
        e.preventDefault();
        if (!targetsData?.monthKey) return;
        setTargetSaving(true);
        setTargetMsg(null);
        try {
            const res = await fetch(`${API_URL}/admin/targets`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monthKey: targetsData.monthKey,
                    revenueTarget: Number(targetForm.revenueTarget || 0),
                    registrationsTarget: Number(targetForm.registrationsTarget || 0),
                })
            });
            const body = await res.json();
            if (!res.ok) {
                setTargetMsg({ ok: false, text: body.error || 'Hedef kaydedilemedi.' });
            } else {
                setTargetsData(body);
                setTargetMsg({ ok: true, text: 'Aylık hedef kaydedildi.' });
            }
        } catch (err) {
            setTargetMsg({ ok: false, text: err.message });
        }
        setTargetSaving(false);
    };

    const handleAddSpend = async (e) => {
        e.preventDefault();
        setSpendSaving(true);
        setSpendMsg(null);
        try {
            const res = await fetch(`${API_URL}/admin/analytics/ad-spends`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(spendForm)
            });
            const body = await res.json();
            if (!res.ok) {
                setSpendMsg({ ok: false, text: body.error || 'Reklam harcaması kaydedilemedi.' });
            } else {
                setSpendMsg({ ok: true, text: 'Reklam harcaması eklendi.' });
                setSpendForm({ ...spendForm, campaign: '', amount: '', notes: '' });
                fetchAnalytics();
            }
        } catch (err) {
            setSpendMsg({ ok: false, text: err.message });
        }
        setSpendSaving(false);
    };

    const handleDeleteSpend = async (id) => {
        const res = await fetch(`${API_URL}/admin/analytics/ad-spends/${id}`, { method: 'DELETE', headers });
        if (res.ok) fetchAnalytics();
    };

    const cmpWeek = targetsData?.comparisons?.weekVsPrevWeek;
    const cmpMonth = targetsData?.comparisons?.monthVsPrevMonth;
    const tInfo = targetsData?.target;
    const pkgList = stats?.package_breakdown || [];

    return (
        <div className="p-8 space-y-8">
            {/* Header + Tabs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white">Gelir & Büyüme Analizi</h1>
                    <p className="text-slate-500 mt-1">Dönemsel karşılaştırma, aylık hedefler, kayıt kaynakları ve CAC/ROAS</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-900 border border-white/10 rounded-xl p-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('revenue')}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition ${activeTab === 'revenue' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Gelir, Kıyas & Hedef
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('acquisition')}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition ${activeTab === 'acquisition' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            Kayıt Kaynağı & Reklam Maliyeti
                        </button>
                    </div>
                    <div className="flex gap-1.5">
                        {['7', '14', '30', '90'].map(d => (
                            <button key={d} onClick={() => setRange(d)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition ${range === d ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                                Son {d} Gün
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="bg-slate-900 border border-white/5 rounded-2xl p-6 h-28 animate-pulse" />)}
                </div>
            ) : activeTab === 'revenue' ? (
                <>
                    {/* Summary KPI Cards with Period Tags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase text-slate-500">Seçili Dönem Gelir</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-black">Son {range} Gün</span>
                            </div>
                            <p className="text-2xl font-black text-white">{fmtTl(stats?.total_revenue)}</p>
                            <p className="text-xs text-slate-400 mt-1">{stats?.total_purchases ?? 0} sipariş</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase text-slate-500">Ödeyen Kişi</span>
                                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-black">Son {range} Gün</span>
                            </div>
                            <p className="text-2xl font-black text-white">{stats?.unique_buyers ?? 0}</p>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs text-slate-400">Benzersiz alıcı</span>
                                {Number(stats?.unique_buyers || 0) < 30 && <LowSampleBadge />}
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase text-slate-500">Ortalama Sipariş</span>
                                <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-black">Son {range} Gün</span>
                            </div>
                            <p className="text-2xl font-black text-white">{fmtTl(stats?.avg_order)}</p>
                            <p className="text-xs text-slate-400 mt-1">Sipariş başına ortalama</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black uppercase text-slate-500">Ay Sonu Gelir Tahmini</span>
                                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-black">Bu Ay</span>
                            </div>
                            <p className="text-2xl font-black text-amber-300">{fmtTl(tInfo?.forecastRevenue)}</p>
                            <p className="text-xs text-slate-400 mt-1">{targetsData?.elapsedDays}/{targetsData?.daysInMonth} gün ortalamasıyla</p>
                        </div>
                    </div>

                    {/* Week vs Prev Week & Month vs Prev Month Comparison */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[
                            { title: 'Bu Hafta vs Geçen Hafta', badge: 'Haftalık Kıyas', data: cmpWeek },
                            { title: 'Bu Ay vs Geçen Ay', badge: 'Aylık Kıyas', data: cmpMonth }
                        ].map((block) => (
                            <div key={block.title} className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-base font-black text-white">{block.title}</h2>
                                    <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[10px] font-black uppercase text-slate-400">{block.badge}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-black text-slate-500">Gelir</span>
                                            <DeltaBadge pct={block.data?.revenue?.deltaPct} />
                                        </div>
                                        <p className="text-lg font-black text-emerald-400 mt-1">{fmtTl(block.data?.revenue?.current)}</p>
                                        <p className="text-[11px] text-slate-500">Önceki: {fmtTl(block.data?.revenue?.previous)}</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-black text-slate-500">Kayıt</span>
                                            <DeltaBadge pct={block.data?.registrations?.deltaPct} />
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-lg font-black text-blue-400">{block.data?.registrations?.current ?? 0}</p>
                                            {block.data?.registrations?.lowSample && <LowSampleBadge />}
                                        </div>
                                        <p className="text-[11px] text-slate-500">Önceki: {block.data?.registrations?.previous ?? 0}</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-black text-slate-500">Ödeme Yapan</span>
                                            <DeltaBadge pct={block.data?.payingUsers?.deltaPct} />
                                        </div>
                                        <p className="text-lg font-black text-white mt-1">{block.data?.payingUsers?.current ?? 0}</p>
                                        <p className="text-[11px] text-slate-500">Önceki: {block.data?.payingUsers?.previous ?? 0}</p>
                                    </div>
                                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-black text-slate-500">Dönüşüm</span>
                                            <DeltaBadge pct={block.data?.conversionPct?.deltaPct} />
                                        </div>
                                        <p className="text-lg font-black text-amber-300 mt-1">%{block.data?.conversionPct?.current ?? 0}</p>
                                        <p className="text-[11px] text-slate-500">Önceki: %{block.data?.conversionPct?.previous ?? 0}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Monthly Goal & Forecast */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Target size={18} className="text-emerald-400" /> Aylık Hedefler & Ay Sonu Tahmini ({targetsData?.monthKey})
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Hedefler veritabanında saklanır. Ay sonu tahmini, ay başından bugüne ({targetsData?.elapsedDays} gün) günlük ortalama ile hesaplanır.
                                </p>
                            </div>
                            {!targetsData?.hasTargetsTable && (
                                <span className="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-bold border border-amber-500/30">
                                    monthly_targets migration bekleniyor
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-slate-400">Gelir Hedefi İlerlemesi</span>
                                    <span className="text-emerald-400">
                                        {fmtTl(tInfo?.actualRevenue)} / {tInfo?.revenueTarget > 0 ? fmtTl(tInfo?.revenueTarget) : 'Hedef girilmedi'}
                                        {tInfo?.revenueProgressPct != null ? ` (%${tInfo.revenueProgressPct})` : ''}
                                    </span>
                                </div>
                                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, tInfo?.revenueProgressPct || 0)}%` }} />
                                </div>
                                <p className="text-xs text-slate-400">Ay sonu tahmini: <strong className="text-white">{fmtTl(tInfo?.forecastRevenue)}</strong></p>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-slate-400">Kayıt Hedefi İlerlemesi</span>
                                    <span className="text-blue-400">
                                        {tInfo?.actualRegistrations ?? 0} / {tInfo?.registrationsTarget > 0 ? tInfo?.registrationsTarget : 'Hedef girilmedi'}
                                        {tInfo?.registrationsProgressPct != null ? ` (%${tInfo.registrationsProgressPct})` : ''}
                                    </span>
                                </div>
                                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full transition-all"
                                        style={{ width: `${Math.min(100, tInfo?.registrationsProgressPct || 0)}%` }} />
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span>Ay sonu tahmini: <strong className="text-white">{tInfo?.forecastRegistrations ?? 0} üye</strong></span>
                                    {tInfo?.lowSample && <LowSampleBadge />}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSaveTarget} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2 border-t border-white/5">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Aylık Gelir Hedefi (₺)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={targetForm.revenueTarget}
                                    onChange={(e) => setTargetForm({ ...targetForm, revenueTarget: e.target.value })}
                                    placeholder="Örn: 150000"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Aylık Kayıt Hedefi (Üye)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={targetForm.registrationsTarget}
                                    onChange={(e) => setTargetForm({ ...targetForm, registrationsTarget: e.target.value })}
                                    placeholder="Örn: 3000"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={targetSaving || !targetsData?.hasTargetsTable}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-black flex items-center justify-center gap-2"
                            >
                                <Save size={15} /> {targetSaving ? 'Kaydediliyor...' : 'Hedefi Kaydet'}
                            </button>
                        </form>
                        {targetMsg && (
                            <p className={`text-xs font-bold ${targetMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{targetMsg.text}</p>
                        )}
                    </div>

                    {/* Top Buyers & Real Package Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <TrendingUp size={18} className="text-purple-400" /> En Çok Harcayan Kullanıcılar
                            </h2>
                            {topBuyers.length === 0 ? (
                                <p className="text-slate-500 text-sm py-8 text-center">Seçili dönemde satış verisi yok.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                                            <th className="text-left pb-3">#</th>
                                            <th className="text-left pb-3">Kullanıcı</th>
                                            <th className="text-right pb-3">Harcama</th>
                                            <th className="text-right pb-3">Adet</th>
                                            <th className="text-right pb-3">Detay</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {topBuyers.map((b, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02]">
                                                <td className="py-3 text-slate-500 text-xs font-bold">#{i + 1}</td>
                                                <td className="py-3 font-semibold text-white">{b.display_name || b.username || `Üye #${b.user_id}`}</td>
                                                <td className="py-3 text-right font-bold text-green-400">{fmtTl(b.total_spent)}</td>
                                                <td className="py-3 text-right text-slate-300">{b.purchase_count}</td>
                                                <td className="py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/users/${b.user_id}`)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-blue-600/30 text-blue-300 text-xs font-bold"
                                                    >
                                                        <Eye size={12} /> Gör
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <ShoppingBag size={18} className="text-pink-400" /> Paket Bazında Satışlar (Son {range} Gün)
                            </h2>
                            {pkgList.length === 0 ? (
                                <p className="text-slate-500 text-sm py-8 text-center">Seçili dönemde paket satışı yok.</p>
                            ) : (
                                <div className="space-y-3">
                                    {pkgList.map((p) => (
                                        <div key={p.name} className="p-4 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-white">{p.name}</p>
                                                <p className="text-xs text-slate-400">{p.orders} sipariş • {Number(p.coins || 0).toLocaleString('tr-TR')} Coin</p>
                                            </div>
                                            <span className="text-base font-black text-emerald-400">{fmtTl(p.revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                /* TAB 2: KAYIT KAYNAĞI VE REKLAM MALİYETİ */
                <div className="space-y-6">
                    <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-3">
                        <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-100 space-y-1.5">
                            <p className="font-bold">{acqData?.integrationNotes?.statusText}</p>
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                                {(acqData?.integrationNotes?.mobileOptions || []).map((opt, idx) => (
                                    <li key={idx}>{opt}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Source Table with CAC & ROAS */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 overflow-x-auto">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Megaphone size={18} className="text-purple-400" /> Kaynak Bazında Dönüşüm ve Maliyet (Son {range} Gün)
                        </h2>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                                    <th className="text-left pb-3">Kaynak</th>
                                    <th className="text-right pb-3">Kayıt</th>
                                    <th className="text-right pb-3">İlk Ödeme</th>
                                    <th className="text-right pb-3">Dönüşüm</th>
                                    <th className="text-right pb-3">Gelir</th>
                                    <th className="text-right pb-3">Reklam Harcaması</th>
                                    <th className="text-right pb-3">CAC (Kayıt Maliyeti)</th>
                                    <th className="text-right pb-3">Ödeyen Maliyeti</th>
                                    <th className="text-right pb-3">ROAS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {(acqData?.sources || []).map((s) => (
                                    <tr key={s.source} className="hover:bg-white/[0.02]">
                                        <td className="py-3 font-bold text-white flex items-center gap-2">
                                            <span>{s.source}</span>
                                            {s.lowSample && <LowSampleBadge />}
                                        </td>
                                        <td className="py-3 text-right text-white font-bold">{s.registrations}</td>
                                        <td className="py-3 text-right text-slate-300">{s.payingUsers}</td>
                                        <td className="py-3 text-right text-amber-300 font-bold">%{s.conversionPct}</td>
                                        <td className="py-3 text-right text-emerald-400 font-bold">{fmtTl(s.revenue)}</td>
                                        <td className="py-3 text-right text-rose-300">{s.adSpend > 0 ? fmtTl(s.adSpend) : 'veri yok'}</td>
                                        <td className="py-3 text-right text-slate-300">{s.cac != null ? fmtTl(s.cac) : 'veri yok'}</td>
                                        <td className="py-3 text-right text-slate-300">{s.costPerPayer != null ? fmtTl(s.costPerPayer) : 'veri yok'}</td>
                                        <td className="py-3 text-right font-black text-blue-400">{s.roas != null ? `${s.roas}x` : 'veri yok'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Manual Ad Spend Form + List */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Plus size={18} className="text-emerald-400" /> Reklam Harcaması Girişi (₺)
                                </h2>
                                <p className="text-xs text-slate-500">Girilen kaynak adının yukarıdaki kaynak adıyla eşleşmesi halinde CAC ve ROAS otomatik hesaplanır.</p>
                            </div>
                            {!acqData?.hasAdSpendsTable && (
                                <span className="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-bold border border-amber-500/30">
                                    ad_spends migration bekleniyor
                                </span>
                            )}
                        </div>

                        <form onSubmit={handleAddSpend} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Tarih</label>
                                <input type="date" value={spendForm.spend_date}
                                    onChange={(e) => setSpendForm({ ...spendForm, spend_date: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Kaynak</label>
                                <input type="text" value={spendForm.source} placeholder="meta_ads / google_ads"
                                    onChange={(e) => setSpendForm({ ...spendForm, source: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Kampanya</label>
                                <input type="text" value={spendForm.campaign} placeholder="Kampanya adı..."
                                    onChange={(e) => setSpendForm({ ...spendForm, campaign: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Tutar (₺)</label>
                                <input type="number" min="0" step="0.01" value={spendForm.amount} placeholder="2500"
                                    onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                            </div>
                            <button type="submit" disabled={spendSaving || !acqData?.hasAdSpendsTable}
                                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-black">
                                {spendSaving ? 'Ekleniyor...' : 'Harcama Ekle'}
                            </button>
                        </form>
                        {spendMsg && (
                            <p className={`text-xs font-bold ${spendMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{spendMsg.text}</p>
                        )}

                        <div className="space-y-2 pt-2">
                            {(acqData?.adSpends || []).length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-4">Henüz reklam harcaması girişi yok.</p>
                            ) : (
                                acqData.adSpends.map((sp) => (
                                    <div key={sp.id} className="p-3 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="font-black text-white">{sp.source}</span>
                                            {sp.campaign ? <span className="text-slate-400 ml-2">• {sp.campaign}</span> : null}
                                            <span className="text-slate-500 ml-2">({sp.spend_date})</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-rose-300">{fmtTl(sp.amount)}</span>
                                            <button type="button" onClick={() => handleDeleteSpend(sp.id)} className="text-slate-500 hover:text-rose-400">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
