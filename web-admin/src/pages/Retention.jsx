import React, { useState, useEffect } from 'react';
import {
    Users, TrendingUp, TrendingDown, UserCheck, UserX, Calendar,
    Activity, Info, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const maskHandle = (u) => {
    const raw = u?.username || u?.display_name || 'uye';
    if (raw.length <= 3) return `${raw[0] || '*'}**`;
    return `${raw.slice(0, 2)}***${raw.slice(-1)}`;
};

export default function Retention() {
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('30');

    useEffect(() => {
        fetchRetention();
    }, [range]);

    const fetchRetention = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/analytics/retention?days=${range}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setData(await res.json());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const MetricCard = ({ icon: Icon, label, value, sub, color, change }) => (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-slate-500 text-xs uppercase tracking-wider">{label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon size={15} className="text-white" />
                </div>
            </div>
            <p className="text-3xl font-black text-white">{value ?? '—'}</p>
            {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
            {change != null && (
                <div className={`flex items-center gap-1 text-xs font-bold mt-2 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {change >= 0 ? '+' : ''}{change}% önceki dönem
                </div>
            )}
        </div>
    );

    const CohortCell = ({ metric }) => {
        if (!metric || !metric.mature) {
            return (
                <td className="py-3 px-4 text-center">
                    <span className="text-[11px] font-semibold text-slate-600">veri yok (süre dolmadı)</span>
                </td>
            );
        }
        const pct = metric.ratePct ?? 0;
        const badgeClass =
            pct >= 35 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            : pct >= 15 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
            : 'bg-slate-800 text-slate-300 border-white/10';
        return (
            <td className="py-3 px-4 text-center">
                <div className={`inline-flex flex-col items-center px-3 py-1.5 rounded-xl border ${badgeClass}`}>
                    <span className="text-sm font-black">%{pct}</span>
                    <span className="text-[10px] opacity-80">{metric.retained} / {metric.eligible} kişi</span>
                </div>
            </td>
        );
    };

    const meth = data?.methodology || {};
    const cohorts = data?.cohorts || [];

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-3xl font-black text-white">Kullanıcı Retention (Elde Tutma)</h1>
                        {meth.approximate && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Yaklaşık
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 mt-1">Son 8 haftalık kayıt cohort analizi, D1 / D7 / D30 geri dönüş oranları</p>
                </div>
                <div className="flex gap-2">
                    {['7', '14', '30', '90'].map(d => (
                        <button key={d} onClick={() => setRange(d)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${range === d ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                            {d} Gün
                        </button>
                    ))}
                </div>
            </div>

            {!loading && meth.accuracyNote && (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${meth.approximate ? 'bg-amber-500/10 border-amber-500/25 text-amber-200' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'}`}>
                    {meth.approximate ? <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" /> : <Info size={18} className="shrink-0 mt-0.5 text-emerald-400" />}
                    <div className="text-xs leading-relaxed">
                        <p className="font-black uppercase tracking-wider mb-1">
                            Veri Kaynağı: {meth.dataSource || 'users.last_login_at'} {meth.approximate ? '(Yaklaşık Hesap)' : '(Kesin Oturum)'}
                        </p>
                        <p className="opacity-90">{meth.accuracyNote}</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <div key={i} className="h-32 bg-slate-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard icon={Users} label="Toplam Kullanıcı" value={data?.total_users?.toLocaleString('tr-TR')} color="bg-blue-600" />
                        <MetricCard icon={Activity} label="Aktif Kullanıcı" value={data?.active_users?.toLocaleString('tr-TR')} sub={`Son ${range} gün`} color="bg-green-600" />
                        <MetricCard icon={UserX} label="Kayıp Kullanıcı" value={data?.churned_users?.toLocaleString('tr-TR')} sub="30+ gün girmedi" color="bg-red-600" />
                        <MetricCard icon={UserCheck} label="Geri Dönen" value={data?.returning_users?.toLocaleString('tr-TR')} sub="Son 7 günde tekrar aktif" color="bg-purple-600" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <h3 className="text-white font-bold mb-1">Günlük Aktif (DAU)</h3>
                            <p className="text-4xl font-black text-green-400">{data?.dau ?? '—'}</p>
                            <p className="text-slate-500 text-xs mt-1">Son 24 saatte görülen</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <h3 className="text-white font-bold mb-1">Haftalık Aktif (WAU)</h3>
                            <p className="text-4xl font-black text-blue-400">{data?.wau ?? '—'}</p>
                            <p className="text-slate-500 text-xs mt-1">Son 7 günde görülen</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <h3 className="text-white font-bold mb-1">Genel Retention Oranı</h3>
                            <p className="text-4xl font-black text-purple-400">
                                {data?.retention_rate != null ? `%${data.retention_rate}` : '—'}
                            </p>
                            <p className="text-slate-500 text-xs mt-1">WAU / son {range} gün aktif</p>
                        </div>
                    </div>

                    {/* 8-Week D1 / D7 / D30 Cohort Table */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 overflow-x-auto">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Calendar size={18} className="text-purple-400" /> Son 8 Haftalık Kayıt Grupları (D1 / D7 / D30)
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Her hücrede geri dönüş oranı (%) ve kişi sayısı gösterilir; n &lt; 30 gruplar "az veri" olarak işaretlenir.
                                </p>
                            </div>
                        </div>

                        {cohorts.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-6">Cohort verisi bulunamadı.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                                        <th className="text-left pb-3 px-2">Kayıt Haftası</th>
                                        <th className="text-center pb-3 px-4">Kayıt (n)</th>
                                        <th className="text-center pb-3 px-4">D1 {meth.approximate ? '(~yaklaşık)' : ''}</th>
                                        <th className="text-center pb-3 px-4">D7 {meth.approximate ? '(~yaklaşık)' : ''}</th>
                                        <th className="text-center pb-3 px-4">D30 {meth.approximate ? '(~yaklaşık)' : ''}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {cohorts.map((c) => (
                                        <tr key={c.weekStart} className="hover:bg-white/[0.02]">
                                            <td className="py-3 px-2 font-bold text-white whitespace-nowrap">
                                                {new Date(c.weekStart).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })} haftası
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="inline-flex items-center gap-2">
                                                    <span className="font-black text-white">{c.size}</span>
                                                    {c.lowSample && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                            az veri
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <CohortCell metric={c.d1} />
                                            <CohortCell metric={c.d7} />
                                            <CohortCell metric={c.d30} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Recent Registrations */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Calendar size={18} className="text-purple-400" /> Günlük Yeni Kayıt (Son 14 Gün)
                        </h2>
                        {data?.daily_signups && data.daily_signups.length > 0 ? (
                            <div className="space-y-2">
                                {data.daily_signups.map((d, i) => {
                                    const max = Math.max(...data.daily_signups.map(x => x.count));
                                    const pct = max > 0 ? (d.count / max) * 100 : 0;
                                    return (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="text-slate-500 text-xs w-20 flex-shrink-0">
                                                {new Date(d.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}
                                            </span>
                                            <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-white font-bold text-sm w-8 text-right">{d.count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-slate-500 text-sm text-center py-6">Son 14 günde kayıt verisi yok.</p>
                        )}
                    </div>

                    {/* At-risk users */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <TrendingDown size={18} className="text-red-400" /> Risk Altındaki Kullanıcılar
                        </h2>
                        <p className="text-slate-500 text-sm mb-4">Son 7–30 gündür giriş yapmayan kullanıcılar</p>
                        {data?.at_risk_users && data.at_risk_users.length > 0 ? (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                                        <th className="text-left pb-3">Kullanıcı</th>
                                        <th className="text-right pb-3">Son Görülme</th>
                                        <th className="text-right pb-3">Coin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.at_risk_users.slice(0, 10).map((u, i) => (
                                        <tr key={i}>
                                            <td className="py-2 text-white font-medium">{maskHandle(u)}</td>
                                            <td className="py-2 text-right text-orange-400 text-xs">
                                                {u.last_login ? `${Math.floor((Date.now() - new Date(u.last_login)) / 86400000)} gün önce` : 'veri yok'}
                                            </td>
                                            <td className="py-2 text-right text-yellow-400 font-bold">{u.balance}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-slate-500 text-sm text-center py-4">Şu an risk altında kullanıcı yok.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
