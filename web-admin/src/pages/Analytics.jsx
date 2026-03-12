import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, ShoppingBag, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = '';

export default function Analytics() {
    const { token } = useAuth();
    const [stats, setStats] = useState(null);
    const [topBuyers, setTopBuyers] = useState([]);
    const [topPackages, setTopPackages] = useState([]);
    const [dailyRevenue, setDailyRevenue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('7');

    useEffect(() => {
        fetchAnalytics();
    }, [range]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [statsRes, buyersRes] = await Promise.all([
                fetch(`${API_URL}/admin/analytics/summary?days=${range}`, { headers }),
                fetch(`${API_URL}/admin/analytics/top-buyers?days=${range}`, { headers }),
            ]);
            if (statsRes.ok) setStats(await statsRes.json());
            if (buyersRes.ok) setTopBuyers((await buyersRes.json()).slice(0, 10));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const StatCard = ({ icon: Icon, label, value, sub, color, trend }) => (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={22} className="text-white" />
            </div>
            <div className="flex-1">
                <p className="text-slate-500 text-xs uppercase tracking-widest">{label}</p>
                <p className="text-2xl font-black text-white mt-1">{value ?? '—'}</p>
                {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
            </div>
            {trend != null && (
                <div className={`flex items-center gap-1 text-xs font-bold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
    );

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white">Gelir Analitikleri</h1>
                    <p className="text-slate-500 mt-1">Satış ve gelir istatistikleri</p>
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

            {/* Stat Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-slate-900 border border-white/5 rounded-2xl p-6 h-28 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={DollarSign} label="Toplam Gelir" value={stats?.total_revenue ? `₺${Number(stats.total_revenue).toLocaleString()}` : '₺0'} sub={`Son ${range} gün`} color="bg-gradient-to-br from-green-500 to-emerald-600" />
                    <StatCard icon={ShoppingBag} label="Toplam Satış" value={stats?.total_purchases ?? 0} sub="Coin paketi" color="bg-gradient-to-br from-purple-500 to-pink-600" />
                    <StatCard icon={Users} label="Alıcı Sayısı" value={stats?.unique_buyers ?? 0} sub="Benzersiz kullanıcı" color="bg-gradient-to-br from-blue-500 to-cyan-600" />
                    <StatCard icon={TrendingUp} label="Ortalama Sipariş" value={stats?.avg_order ? `₺${Number(stats.avg_order).toFixed(0)}` : '₺0'} sub="Kişi başı" color="bg-gradient-to-br from-orange-500 to-red-600" />
                </div>
            )}

            {/* Top Buyers Table */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-purple-400" /> En Çok Harcayan Kullanıcılar
                </h2>
                {topBuyers.length === 0 ? (
                    <p className="text-slate-500 text-sm py-8 text-center">Henüz satış verisi yok.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                                <th className="text-left pb-3">#</th>
                                <th className="text-left pb-3">Kullanıcı</th>
                                <th className="text-right pb-3">Harcama</th>
                                <th className="text-right pb-3">Satın Alma</th>
                                <th className="text-right pb-3">Coin Aldı</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {topBuyers.map((b, i) => (
                                <tr key={i} className="hover:bg-white/3 transition">
                                    <td className="py-3 text-slate-500 text-xs font-bold">#{i + 1}</td>
                                    <td className="py-3">
                                        <span className="font-semibold text-white">{b.username || b.display_name || `User #${b.user_id}`}</span>
                                    </td>
                                    <td className="py-3 text-right font-bold text-green-400">₺{Number(b.total_spent || 0).toLocaleString()}</td>
                                    <td className="py-3 text-right text-slate-300">{b.purchase_count}</td>
                                    <td className="py-3 text-right text-yellow-400 font-bold">{Number(b.total_coins || 0).toLocaleString()} 🪙</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Revenue by Package */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <ShoppingBag size={18} className="text-pink-400" /> Paket Bazında Satışlar
                </h2>
                <p className="text-slate-500 text-sm">Paket istatistikleri ödeme geçmişinden hesaplanmaktadır.</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: '500 Coin', color: 'from-blue-500 to-cyan-500' },
                        { label: '1000 Coin', color: 'from-purple-500 to-pink-500' },
                        { label: '5000 Coin', color: 'from-orange-500 to-red-500' },
                    ].map((pkg) => (
                        <div key={pkg.label} className={`bg-gradient-to-br ${pkg.color} p-px rounded-xl`}>
                            <div className="bg-slate-900 rounded-xl p-4">
                                <p className="text-white font-bold">{pkg.label}</p>
                                <p className="text-slate-400 text-xs mt-1">Detaylar yakında</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
