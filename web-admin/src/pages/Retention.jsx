import React, { useState, useEffect } from 'react';
import { BarChart2, Users, TrendingUp, TrendingDown, UserCheck, UserX, Calendar, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-kj17.onrender.com/api';

export default function Retention() {
    const { token } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('30');

    useEffect(() => { fetchRetention(); }, [range]);

    const fetchRetention = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/analytics/retention?days=${range}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setData(await res.json());
        } catch (e) { }
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

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white">Kullanıcı Retention</h1>
                    <p className="text-slate-500 mt-1">Aktiflik, kayıp ve geri dönüş oranları</p>
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

            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <div key={i} className="h-32 bg-slate-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard icon={Users} label="Toplam Kullanıcı" value={data?.total_users?.toLocaleString()} color="bg-blue-600" />
                        <MetricCard icon={Activity} label="Aktif Kullanıcı" value={data?.active_users?.toLocaleString()} sub={`Son ${range} gün`} color="bg-green-600" />
                        <MetricCard icon={UserX} label="Kayıp Kullanıcı" value={data?.churned_users?.toLocaleString()} sub="30+ gün girmedi" color="bg-red-600" />
                        <MetricCard icon={UserCheck} label="Geri Dönen" value={data?.returning_users?.toLocaleString()} sub="Bu hafta döndü" color="bg-purple-600" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <h3 className="text-white font-bold mb-1">Günlük Aktif (DAU)</h3>
                            <p className="text-4xl font-black text-green-400">{data?.dau ?? '—'}</p>
                            <p className="text-slate-500 text-xs mt-1">Bugün giriş yapan</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <h3 className="text-white font-bold mb-1">Haftalık Aktif (WAU)</h3>
                            <p className="text-4xl font-black text-blue-400">{data?.wau ?? '—'}</p>
                            <p className="text-slate-500 text-xs mt-1">Bu hafta giriş yapan</p>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                            <h3 className="text-white font-bold mb-1">Retention Oranı</h3>
                            <p className="text-4xl font-black text-purple-400">
                                {data?.retention_rate != null ? `%${data.retention_rate}` : '—'}
                            </p>
                            <p className="text-slate-500 text-xs mt-1">7 günde geri dönen</p>
                        </div>
                    </div>

                    {/* Recent Registrations */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Calendar size={18} className="text-purple-400" /> Günlük Yeni Kayıt
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
                            <p className="text-slate-500 text-sm text-center py-6">Veri yükleniyor veya API bağlantısı kurulamıyor.</p>
                        )}
                    </div>

                    {/* At-risk users */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <TrendingDown size={18} className="text-red-400" /> Risk Altındaki Kullanıcılar
                        </h2>
                        <p className="text-slate-500 text-sm mb-4">Son 7-30 gündür giriş yapmayan aktif kullanıcılar</p>
                        {data?.at_risk_users && data.at_risk_users.length > 0 ? (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                                        <th className="text-left pb-3">Kullanıcı</th>
                                        <th className="text-right pb-3">Son Giriş</th>
                                        <th className="text-right pb-3">Coin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.at_risk_users.slice(0, 10).map((u, i) => (
                                        <tr key={i}>
                                            <td className="py-2 text-white font-medium">{u.username || u.display_name}</td>
                                            <td className="py-2 text-right text-orange-400 text-xs">
                                                {Math.floor((Date.now() - new Date(u.last_login)) / 86400000)} gün önce
                                            </td>
                                            <td className="py-2 text-right text-yellow-400 font-bold">{u.balance} 🪙</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-slate-500 text-sm text-center py-4">Şu an risk altında kullanıcı yok. 🎉</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
