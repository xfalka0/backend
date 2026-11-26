import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Crown, CreditCard, Coins, MessageSquare, ShieldAlert,
    User, Calendar, MapPin, Smartphone, Lock, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const fmtTl = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDt = (d) => (d ? new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'veri yok');

const maskEmail = (e) => {
    if (!e || !e.includes('@')) return 'veri yok';
    const [u, d] = e.split('@');
    return `${u.slice(0, 2)}***@${d}`;
};

const maskPhone = (p) => {
    if (!p) return 'veri yok';
    const clean = String(p).replace(/\s+/g, '');
    return clean.length > 4 ? `${clean.slice(0, 3)}****${clean.slice(-2)}` : '***';
};

const maskName = (n) => {
    if (!n) return 'İsimsiz Üye';
    const s = String(n);
    return s.length <= 3 ? `${s[0]}**` : `${s.slice(0, 2)}***${s.slice(-1)}`;
};

export default function UserDetailPage() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [maskPii, setMaskPii] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/detail`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || 'Kullanıcı yüklenemedi');
                setData(body);
            } catch (err) {
                setError(err.message);
            }
            setLoading(false);
        };
        load();
    }, [userId]);

    if (loading) {
        return <div className="p-8 text-slate-400 font-bold">Kullanıcı detayı yükleniyor...</div>;
    }

    if (error || !data) {
        return (
            <div className="p-8 space-y-4">
                <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-xs font-bold inline-flex items-center gap-2">
                    <ArrowLeft size={14} /> Geri Dön
                </button>
                <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-bold">
                    {error || 'Kullanıcı bulunamadı.'}
                </div>
            </div>
        );
    }

    const p = data.profile || {};
    const msg = data.messageStats || {};
    const rep = data.reports || { filedByUser: [], againstUser: [], openCount: 0, closedCount: 0 };
    const missingNotes = data.dataAvailability?.missingNotes || [];

    return (
        <div className="p-8 space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => navigate(-1)}
                        className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-black text-white">
                                {maskPii ? maskName(p.display_name) : (p.display_name || p.username)}
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-800 text-slate-300 border border-white/10 inline-flex items-center gap-1">
                                <Lock size={10} /> Salt-Okunur Detay
                            </span>
                            {p.is_premium_active && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                                    <Crown size={10} /> Aktif Premium
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            ID: {p.id} • @{maskPii ? maskName(p.username) : p.username} • {maskPii ? maskEmail(p.email) : (p.email || 'E-posta yok')} • {maskPii ? maskPhone(p.phone) : (p.phone || 'Telefon yok')}
                        </p>
                    </div>
                </div>

                <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={maskPii} onChange={(e) => setMaskPii(e.target.checked)} className="rounded" />
                    Kişisel Veriyi Maskele
                </label>
            </div>

            {missingNotes.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                    <AlertTriangle size={17} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200 space-y-0.5">
                        <p className="font-black">Eksik Veri Alanı Bildirimi</p>
                        {missingNotes.map((n, idx) => <p key={idx}>• {n}</p>)}
                    </div>
                </div>
            )}

            {/* Profile Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1"><User size={11} /> Yaş</span>
                    <p className="text-base font-black text-white mt-1">{p.age ?? 'veri yok'}</p>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1"><MapPin size={11} /> Şehir</span>
                    <p className="text-base font-black text-white mt-1 truncate">{p.city || 'veri yok'}</p>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1"><Calendar size={11} /> Kayıt Tarihi</span>
                    <p className="text-xs font-bold text-white mt-1">{fmtDt(p.created_at)}</p>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500">Kayıt Kaynağı</span>
                    <p className="text-sm font-black text-blue-300 mt-1">{p.acquisition_source || 'bilinmiyor'}</p>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500">Son Görülme</span>
                    <p className="text-xs font-bold text-white mt-1">{fmtDt(p.last_login_at)}</p>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1"><Smartphone size={11} /> Sürüm</span>
                    <p className="text-sm font-black text-slate-300 mt-1">{p.app_version || 'veri yok'}</p>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500">Toplam Harcama</span>
                    <p className="text-base font-black text-emerald-400 mt-1">{fmtTl(p.total_spent_verified)}</p>
                </div>
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-black uppercase text-slate-500">Güncel Coin</span>
                    <p className="text-base font-black text-amber-400 mt-1">{p.balance ?? 0}</p>
                </div>
            </div>

            {/* Premium + Messages + Reports Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                    <h2 className="text-sm font-black text-white flex items-center gap-2 mb-2">
                        <Crown size={15} className="text-amber-400" /> Premium Durumu
                    </h2>
                    <p className="text-base font-black text-white">
                        {p.is_premium_active ? 'Aktif Premium' : (p.is_premium ? 'Süresi Dolmuş' : 'Standart (Premium Yok)')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Bitiş Tarihi: {fmtDt(p.premium_expire_date)}</p>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                    <h2 className="text-sm font-black text-white flex items-center gap-2 mb-2">
                        <MessageSquare size={15} className="text-blue-400" /> Mesaj İstatistiği
                    </h2>
                    <div className="flex gap-6 mt-1">
                        <div>
                            <span className="text-[11px] text-slate-400 block">Gönderilen</span>
                            <span className="text-xl font-black text-blue-400">{msg.sent_count ?? 0}</span>
                        </div>
                        <div>
                            <span className="text-[11px] text-slate-400 block">Alınan</span>
                            <span className="text-xl font-black text-purple-400">{msg.received_count ?? 0}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                    <h2 className="text-sm font-black text-white flex items-center gap-2 mb-2">
                        <ShieldAlert size={15} className="text-rose-400" /> Şikayet Özeti
                    </h2>
                    <p className="text-xs text-slate-300">
                        Açık: <strong className="text-rose-400">{rep.openCount}</strong> • Kapalı: <strong className="text-emerald-400">{rep.closedCount}</strong>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        Yaptığı: {rep.filedByUser.length} • Hakkında yapılan: {rep.againstUser.length}
                    </p>
                </div>
            </div>

            {/* Payments & Balance Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                        <CreditCard size={16} className="text-emerald-400" /> Ödeme Geçmişi ({data.payments?.length || 0})
                    </h2>
                    {(!data.payments || data.payments.length === 0) ? (
                        <p className="text-xs text-slate-500 py-4">Ödeme kaydı yok.</p>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {data.payments.map((pay) => (
                                <div key={pay.id} className="p-3 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-bold text-white">{pay.product_name}</p>
                                        <p className="text-[11px] text-slate-400">{fmtDt(pay.created_at)} • {pay.payment_method || '-'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-emerald-400">{fmtTl(pay.amount)}</p>
                                        <p className="text-[10px] text-slate-400 uppercase">{pay.status || 'completed'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-3">
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                        <Coins size={16} className="text-amber-400" /> Bakiye Hareketleri ({data.transactions?.length || 0})
                    </h2>
                    {(!data.transactions || data.transactions.length === 0) ? (
                        <p className="text-xs text-slate-500 py-4">Bakiye hareketi yok.</p>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {data.transactions.map((tx) => {
                                const pos = Number(tx.amount) >= 0;
                                return (
                                    <div key={tx.id} className="p-3 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between text-xs">
                                        <div>
                                            <p className="font-bold text-white">{tx.description || tx.type}</p>
                                            <p className="text-[11px] text-slate-400">{tx.type} • {fmtDt(tx.created_at)}</p>
                                        </div>
                                        <span className={`font-black ${pos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {pos ? `+${tx.amount}` : tx.amount} Coin
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Reports Both Directions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[
                    { title: 'Kullanıcının Yaptığı Şikayetler', items: rep.filedByUser, empty: 'Kullanıcının yaptığı şikayet yok.' },
                    { title: 'Kullanıcı Hakkında Yapılan Şikayetler', items: rep.againstUser, empty: 'Kullanıcı hakkında şikayet yok.' }
                ].map((box) => (
                    <div key={box.title} className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-3">
                        <h2 className="text-base font-black text-white">{box.title} ({box.items.length})</h2>
                        {box.items.length === 0 ? (
                            <p className="text-xs text-slate-500">{box.empty}</p>
                        ) : (
                            <div className="space-y-2">
                                {box.items.map((r) => (
                                    <div key={r.id} className="p-3 rounded-xl bg-slate-950/70 border border-white/5 text-xs flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-white">{r.reason}</p>
                                            {r.details && <p className="text-slate-400 mt-0.5">{r.details}</p>}
                                            <p className="text-[10px] text-slate-500 mt-1">{fmtDt(r.created_at)}</p>
                                        </div>
                                        <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-bold uppercase text-[10px]">{r.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
