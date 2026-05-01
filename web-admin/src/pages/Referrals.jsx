import React, { useState, useEffect } from 'react';
import { Users, Link as LinkIcon, DollarSign, Calendar, Search, AlertCircle, CheckCircle2, UserCircle, TrendingUp, Wallet, ArrowRight, Star } from 'lucide-react';
import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : '';

export default function ReferralsPage() {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [commissionRate, setCommissionRate] = useState(20); // Default %20

    // Lists for Selection
    const [staff, setStaff] = useState([]);
    const [filteredStaff, setFilteredStaff] = useState([]);
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');

    // Selection States
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedReferrerId, setSelectedReferrerId] = useState('');

    useEffect(() => {
        fetchStats();
        fetchInitialData();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/referrals/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.error || err.message);
            setLoading(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allUsers = res.data || [];
            setStaff(allUsers);
            setUsers(allUsers);
        } catch (err) {
            console.error("Fetch data error:", err);
            setError("Kullanıcı listesi alınamadı: " + err.message);
        }
    };

    const handleLink = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!selectedUserId || !selectedReferrerId) {
            setError("Lütfen hem personeli hem de kullanıcıyı seçin.");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/admin/referrals/link`, {
                userId: selectedUserId,
                referrerId: selectedReferrerId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess("Eşleştirme başarıyla tamamlandı!");
            setSelectedUserId('');
            setUserSearch('');
            fetchStats(); 
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        }
    };

    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(userSearch.toLowerCase()) || 
        u.email.toLowerCase().includes(userSearch.toLowerCase())
    ).slice(0, 5);

    const totalStats = {
        count: stats.length,
        totalRevenue: stats.reduce((sum, row) => sum + parseFloat(row.total_deposit || 0), 0),
        totalCommission: stats.reduce((sum, row) => sum + (parseFloat(row.total_deposit || 0) * (commissionRate / 100)), 0)
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-slate-950 min-h-screen text-slate-200">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                        <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        REFERANS VE KAZANÇ MERKEZİ
                    </h1>
                    <p className="text-slate-500 font-medium ml-1">Personel performansını ve komisyon haklarını detaylı takip edin.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
                    <div className="px-4 py-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Komisyon Oranı</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white">%{commissionRate}</span>
                            <input 
                                type="range" min="1" max="50" value={commissionRate} 
                                onChange={(e) => setCommissionRate(e.target.value)}
                                className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-[2rem] shadow-xl shadow-indigo-500/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Users size={80} />
                    </div>
                    <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs">Toplam Bağlantı</p>
                    <h3 className="text-4xl font-black text-white mt-2">{totalStats.count}</h3>
                    <div className="mt-4 flex items-center gap-2 text-indigo-100/70 text-xs font-bold">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        SİSTEM AKTİF
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <DollarSign size={80} />
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Toplam Ciro</p>
                    <h3 className="text-4xl font-black text-white mt-2">
                        {totalStats.totalRevenue.toLocaleString('tr-TR')} <span className="text-lg text-slate-500">TL</span>
                    </h3>
                    <p className="mt-4 text-emerald-400 text-xs font-bold flex items-center gap-1">
                        <TrendingUp size={14} /> GETİRİLEN TOPLAM YATIRIM
                    </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <Wallet size={80} />
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Toplam Hakediş</p>
                    <h3 className="text-4xl font-black text-emerald-400 mt-2">
                        {totalStats.totalCommission.toLocaleString('tr-TR')} <span className="text-lg text-slate-500">TL</span>
                    </h3>
                    <p className="mt-4 text-slate-500 text-xs font-bold uppercase tracking-tighter">
                        %{commissionRate} ORANINDA HESAPLANAN
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Assignment Form */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                                <LinkIcon className="text-indigo-500" size={20} />
                            </div>
                            <h2 className="text-xl font-black text-white tracking-tight">Yeni Eşleştirme</h2>
                        </div>

                        <form onSubmit={handleLink} className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Personel Ara ve Seç</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Personel adı..."
                                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold placeholder:font-normal placeholder:text-slate-700"
                                        onChange={(e) => {
                                            const term = e.target.value.toLowerCase();
                                            if (!term) { setFilteredStaff([]); return; }
                                            setFilteredStaff(staff.filter(s => s.username?.toLowerCase().includes(term) || s.email?.toLowerCase().includes(term)).slice(0, 10));
                                        }}
                                    />
                                </div>
                                <select
                                    value={selectedReferrerId}
                                    onChange={(e) => setSelectedReferrerId(e.target.value)}
                                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold cursor-pointer appearance-none shadow-inner"
                                >
                                    <option value="">-- Listeden Seç --</option>
                                    {(filteredStaff.length > 0 ? filteredStaff : staff.slice(0, 50)).map(s => (
                                        <option key={s.id} value={s.id}>
                                            {(s.display_name || s.username).toUpperCase()} ({s.role})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Kullanıcıyı Bul</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        placeholder="Kullanıcı adı veya e-posta..."
                                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-bold placeholder:font-normal placeholder:text-slate-700"
                                    />
                                </div>
                                
                                {userSearch && filteredUsers.length > 0 && (
                                    <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl overflow-hidden mt-2 shadow-2xl animate-in slide-in-from-top-2 duration-200">
                                        {filteredUsers.map(u => (
                                            <button
                                                key={u.id} type="button"
                                                onClick={() => { setSelectedUserId(u.id); setUserSearch(u.username); }}
                                                className={`w-full px-5 py-4 text-left hover:bg-indigo-600/10 flex items-center justify-between transition-colors ${selectedUserId === u.id ? 'bg-indigo-600/20' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                        {u.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-white">{u.username.toUpperCase()}</div>
                                                        <div className="text-[10px] text-slate-600 font-bold">{u.email}</div>
                                                    </div>
                                                </div>
                                                {selectedUserId === u.id && <CheckCircle2 size={18} className="text-indigo-500" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                {error && (
                                    <div className="p-4 bg-rose-500/10 border-2 border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm mb-4 animate-in fade-in zoom-in duration-200">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <span className="font-bold">{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm mb-4 animate-in fade-in zoom-in duration-200">
                                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                        <span className="font-bold">{success}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                                    disabled={!selectedUserId || !selectedReferrerId}
                                >
                                    SİSTEME KAYDET VE BAĞLA
                                    <ArrowRight size={20} />
                                </button>
                            </div>
                        </form>
                    </div>

                    <button
                        onClick={async () => {
                            try {
                                const token = localStorage.getItem('token');
                                const res = await axios.get(`${API_URL}/api/admin/repair-db-referred`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                alert("Sonuç: " + res.data.message);
                                window.location.reload();
                            } catch (err) { alert("Hata: " + (err.response?.data?.error || err.message)); }
                        }}
                        className="w-full py-4 px-6 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-indigo-400 hover:border-indigo-500/30 transition-all flex items-center justify-center gap-2"
                    >
                        <AlertCircle size={14} />
                        Veritabanı Şemasını Zorla Onar
                    </button>
                </div>

                {/* Performance List */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="flex items-center justify-between mb-2 px-4">
                        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                            <Star className="text-amber-400 fill-amber-400" size={20} />
                            Personel Performans Listesi
                        </h2>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                            {stats.length} KAYIT
                        </span>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-800">
                                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Veriler İşleniyor...</p>
                            </div>
                        ) : stats.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 space-y-4 bg-slate-900/30 rounded-[3rem] border border-dashed border-slate-800">
                                <Users size={48} className="text-slate-800" />
                                <p className="text-slate-600 font-bold uppercase tracking-widest text-sm">Henüz bir bağlantı kurulmamış</p>
                            </div>
                        ) : (
                            stats.map((row, idx) => {
                                const commission = (parseFloat(row.total_deposit || 0) * (commissionRate / 100)).toFixed(2);
                                return (
                                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 hover:border-indigo-500/50 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity">
                                            <TrendingUp size={100} />
                                        </div>
                                        
                                        <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
                                            {/* Personnel Info */}
                                            <div className="flex items-center gap-4 min-w-[200px]">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20">
                                                    {row.referrer_name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Personel</p>
                                                    <h4 className="text-white font-black text-lg tracking-tight uppercase">{row.referrer_name}</h4>
                                                </div>
                                            </div>

                                            <div className="hidden md:block w-px h-12 bg-slate-800" />

                                            {/* Brought User Info */}
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Getirilen Kullanıcı</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-bold">{row.user_name.toUpperCase()}</span>
                                                    <span className="text-slate-600 text-xs font-medium">({row.user_email})</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2 text-slate-500 text-[10px] font-bold">
                                                    <Calendar size={12} />
                                                    {new Date(row.joined_at).toLocaleDateString('tr-TR')} KAYIT TARİHİ
                                                </div>
                                            </div>

                                            {/* Financial Stats */}
                                            <div className="flex items-center gap-8 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Toplam Harcama</p>
                                                    <p className="text-2xl font-black text-white mt-1">
                                                        {parseFloat(row.total_deposit).toLocaleString('tr-TR')} <span className="text-xs text-slate-600 font-bold">TL</span>
                                                    </p>
                                                </div>
                                                <div className="w-px h-8 bg-slate-800" />
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Hak Edilen (%{commissionRate})</p>
                                                    <p className="text-2xl font-black text-emerald-400 mt-1">
                                                        {parseFloat(commission).toLocaleString('tr-TR')} <span className="text-xs text-slate-600 font-bold">TL</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
