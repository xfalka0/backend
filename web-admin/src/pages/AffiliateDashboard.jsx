import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, Link as LinkIcon, ExternalLink, Calendar, UserPlus, Wallet, Copy, Check } from 'lucide-react';
import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : '';

export default function AffiliateDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        setUser(userData);
        fetchStats();
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
        } catch (err) {
            console.error("Profile fetch error:", err);
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/affiliate-stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Fetch error:", err);
            setLoading(false);
        }
    };

    const copyLink = () => {
        const link = `https://falkasoft.com/api/r/${user?.referral_code}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
        </div>
    );

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-950 min-h-screen text-slate-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <div className="p-3 bg-indigo-500 rounded-2xl">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        AFFILIATE PANELİ
                    </h1>
                    <p className="text-slate-500 font-medium">Hoş geldin, {user?.display_name || user?.username}. Performansını buradan takip edebilirsin.</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">KODUNUZ</p>
                        <p className="text-xl font-black text-indigo-400">{user?.referral_code || 'YOK'}</p>
                    </div>
                    <button 
                        onClick={copyLink}
                        className="p-3 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl transition-colors text-indigo-400"
                    >
                        {copied ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard 
                    title="Toplam Kayıt" 
                    value={data?.stats.totalReferrals || 0} 
                    icon={<Users size={24} />} 
                    color="indigo" 
                    subText={`Bugün: +${data?.stats.todayReferrals || 0}`}
                />
                <StatCard 
                    title="Toplam Kazanç" 
                    value={`${data?.stats.totalEarnings || '0.00'} TL`} 
                    icon={<DollarSign size={24} />} 
                    color="emerald" 
                    subText={`Bugün: ${data?.stats.todayEarnings || '0.00'} TL`}
                />
                <StatCard 
                    title="Komisyon Oranı" 
                    value="%20" 
                    icon={<Wallet size={24} />} 
                    color="amber" 
                    subText="Harcanan Coin Üzerinden"
                />
                <StatCard 
                    title="Link Tıklanma" 
                    value={data?.stats.totalClicks || 0} 
                    icon={<ExternalLink size={24} />} 
                    color="sky" 
                    subText={`Bugün: +${data?.stats.todayClicks || 0}`}
                />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Referrals List */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <UserPlus className="text-indigo-400" size={20} />
                            Son Katılan Kullanıcılar
                        </h2>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-950/50 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Kullanıcı</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Kayıt Tarihi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {data?.referrals.length === 0 ? (
                                    <tr>
                                        <td colSpan="2" className="px-6 py-12 text-center text-slate-500 font-bold">Henüz kimse gelmemiş. Linkinizi paylaşın!</td>
                                    </tr>
                                ) : (
                                    data?.referrals.map((ref, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-400">
                                                        {ref.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-white">{ref.username.toUpperCase()}</div>
                                                        <div className="text-[10px] text-slate-600 font-bold">{ref.display_name}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-xs font-bold text-slate-400">
                                                    {new Date(ref.created_at).toLocaleDateString('tr-TR')}
                                                </div>
                                                <div className="text-[10px] text-slate-600">
                                                    {new Date(ref.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Tracking Link Card */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <LinkIcon size={160} />
                        </div>
                        
                        <div className="relative z-10 space-y-6">
                            <h3 className="text-2xl font-black text-white leading-tight">Paylaş ve Kazanmaya Başla</h3>
                            <p className="text-indigo-100/80 text-sm font-medium">Bu link üzerinden gelen kullanıcıların harcamalarından %20 komisyon kazanırsın.</p>
                            
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/10">
                                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">SİZE ÖZEL TAKİP LİNKİ</p>
                                <p className="text-xs text-white font-mono break-all line-clamp-1">{`https://falkasoft.com/api/r/${user?.referral_code}`}</p>
                            </div>

                            <button 
                                onClick={copyLink}
                                className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl shadow-lg hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                            >
                                {copied ? 'KOPYALANDI!' : 'LİNKİ KOPYALA'}
                                {!copied && <Copy size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] space-y-4">
                        <h4 className="text-white font-black flex items-center gap-2">
                            <AlertCircle className="text-amber-400" size={18} />
                            Nasıl Çalışır?
                        </h4>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-xs text-slate-400">
                                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-white font-bold">1</div>
                                <p>Linkinizi sosyal medya veya WhatsApp üzerinden paylaşın.</p>
                            </li>
                            <li className="flex gap-3 text-xs text-slate-400">
                                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-white font-bold">2</div>
                                <p>Linke tıklayan kullanıcılar 2 saat boyunca sizin IP izinizle takip edilir.</p>
                            </li>
                            <li className="flex gap-3 text-xs text-slate-400">
                                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-white font-bold">3</div>
                                <p>Kaydolduklarında sistem otomatik olarak onları size bağlar.</p>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, subText }) {
    const colorClasses = {
        indigo: "bg-indigo-500/10 text-indigo-500",
        emerald: "bg-emerald-500/10 text-emerald-500",
        amber: "bg-amber-500/10 text-amber-500",
        sky: "bg-sky-500/10 text-sky-500"
    };

    return (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                    {icon}
                </div>
                <div className="text-slate-700 group-hover:scale-110 transition-transform">
                    {icon}
                </div>
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{title}</p>
            <h3 className="text-2xl font-black text-white mt-1">{value}</h3>
            {subText && <p className="text-[10px] text-slate-600 font-bold mt-2 uppercase">{subText}</p>}
        </div>
    );
}

import { AlertCircle } from 'lucide-react';
