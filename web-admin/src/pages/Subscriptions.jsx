import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Clock, RefreshCw, XCircle, AlertTriangle, Eye, DollarSign, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const fmtTl = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const maskName = (u) => {
    const raw = u?.display_name || u?.username || 'Üye';
    if (raw.length <= 3) return `${raw[0] || '*'}**`;
    return `${raw.slice(0, 2)}***${raw.slice(-1)}`;
};

export default function SubscriptionsPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [excludeTest, setExcludeTest] = useState(true);

    useEffect(() => {
        fetchData();
    }, [excludeTest]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/subscriptions/overview?excludeTest=${excludeTest ? '1' : '0'}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setData(await res.json());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const active = data?.activeSummary || {};
    const life = data?.lifecycle || {};
    const expiring = data?.expiringSoon || [];
    const byProduct = data?.revenueByProduct || [];

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Crown className="text-amber-400" size={28} /> Premium & Abonelik Yönetimi
                    </h1>
                    <p className="text-slate-500 mt-1">Aktif abonelikler (1/3/6 ay), süresi dolacaklar, yenileme/iptal olayları ve ürün geliri</p>
                </div>

                <label className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={excludeTest}
                        onChange={(e) => setExcludeTest(e.target.checked)}
                        className="rounded border-white/20 bg-slate-800 text-emerald-500"
                    />
                    <span className="text-xs font-bold text-slate-200">Test / manual_ işlemleri hariç tut</span>
                </label>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : (
                <>
                    {/* Active Premium Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-5">
                            <span className="text-[11px] font-black uppercase text-amber-400">Aktif Premium Üye</span>
                            <p className="text-3xl font-black text-white mt-2">{active.total ?? 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Geçerli aboneliği olanlar</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <span className="text-[11px] font-black uppercase text-slate-400">1 Aylık Plan</span>
                            <p className="text-3xl font-black text-blue-400 mt-2">{active.oneMonth ?? 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Son ödemeye göre</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <span className="text-[11px] font-black uppercase text-slate-400">3 Aylık Plan</span>
                            <p className="text-3xl font-black text-purple-400 mt-2">{active.threeMonths ?? 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Son ödemeye göre</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <span className="text-[11px] font-black uppercase text-slate-400">6 Aylık Plan</span>
                            <p className="text-3xl font-black text-emerald-400 mt-2">{active.sixMonths ?? 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Son ödemeye göre</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <span className="text-[11px] font-black uppercase text-slate-400">Diğer / Belirsiz</span>
                            <p className="text-3xl font-black text-slate-300 mt-2">{active.unspecified ?? 0}</p>
                            <p className="text-xs text-slate-500 mt-1">Manuel / eski kayıtlar</p>
                        </div>
                    </div>

                    {/* Lifecycle: Renewal / Cancellation */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <RefreshCw size={18} className="text-emerald-400" /> Yenileme & İptal Olayları (RevenueCat Webhook)
                            </h2>
                            {!life.hasEventsTable && (
                                <span className="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-bold border border-amber-500/30">
                                    subscription_events migration bekleniyor
                                </span>
                            )}
                        </div>

                        {!life.hasEventData ? (
                            <div className="p-5 rounded-xl bg-slate-950/70 border border-white/5 flex items-start gap-3">
                                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                <div className="text-xs text-slate-300 space-y-1">
                                    <p className="font-bold text-white">Yenileme / iptal verisi: veri yok</p>
                                    <p>
                                        `subscription_events` tablosu henüz aktif olmadığı veya bu ay webhook yaşam döngüsü olayı (RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE) kaydedilmediği için iptal ve yenileme sayıları gösterilemiyor.
                                        Mevcut webhook güvenlik doğrulaması (`REVENUECAT_WEBHOOK_SECRET`) korunarak olay kaydı kodu hazırlanmıştır.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5">
                                    <span className="text-[11px] font-black uppercase text-slate-400">Bu Ay Yenileyen</span>
                                    <p className="text-2xl font-black text-emerald-400 mt-1">{life.thisMonthRenewals}</p>
                                    <p className="text-xs text-slate-500">Geçen ay: {life.prevMonthRenewals} ({life.renewalDeltaPct >= 0 ? '+' : ''}{life.renewalDeltaPct}%)</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5">
                                    <span className="text-[11px] font-black uppercase text-slate-400">Bu Ay İptal Eden</span>
                                    <p className="text-2xl font-black text-rose-400 mt-1">{life.thisMonthCancellations}</p>
                                    <p className="text-xs text-slate-500">Geçen ay: {life.prevMonthCancellations} ({life.cancellationDeltaPct >= 0 ? '+' : ''}{life.cancellationDeltaPct}%)</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5">
                                    <span className="text-[11px] font-black uppercase text-slate-400">Süresi Dolan (Bu Ay)</span>
                                    <p className="text-2xl font-black text-slate-200 mt-1">{life.thisMonthExpirations}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5">
                                    <span className="text-[11px] font-black uppercase text-slate-400">Ödeme Sorunu</span>
                                    <p className="text-2xl font-black text-amber-400 mt-1">{life.thisMonthBillingIssues}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Product Revenue + Expiring Soon */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <DollarSign size={18} className="text-emerald-400" /> Ürün Bazlı Abonelik Geliri
                            </h2>
                            {byProduct.length === 0 ? (
                                <p className="text-sm text-slate-500 py-6 text-center">Abonelik ödeme kaydı yok.</p>
                            ) : (
                                <div className="space-y-3">
                                    {byProduct.map((p) => (
                                        <div key={p.planKey} className="p-4 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-white">{p.label}</p>
                                                <p className="text-xs text-slate-400">{p.orders} işlem • {p.buyers} üye</p>
                                            </div>
                                            <span className="text-lg font-black text-emerald-400">{fmtTl(p.revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Clock size={18} className="text-amber-400" /> Süresi Dolmak Üzere Olanlar (7 Gün İçinde)
                            </h2>
                            {expiring.length === 0 ? (
                                <p className="text-sm text-slate-500 py-6 text-center">Önümüzdeki 7 gün içinde süresi bitecek Premium üye yok.</p>
                            ) : (
                                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                                    {expiring.map((u) => (
                                        <div key={u.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-white">{maskName(u)}</p>
                                                <p className="text-[11px] text-slate-400">
                                                    Bitiş: {new Date(u.premium_expire_date).toLocaleDateString('tr-TR')} ({u.daysLeft} gün kaldı)
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                    Son ödeme: {u.last_payment_amount != null ? fmtTl(u.last_payment_amount) : 'veri yok'}
                                                    {u.last_payment_at ? ` • ${new Date(u.last_payment_at).toLocaleDateString('tr-TR')}` : ''}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/users/${u.id}`)}
                                                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-black flex items-center gap-1.5 shrink-0"
                                            >
                                                <Eye size={13} /> Kullanıcıya Git
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
