import React, { useState, useEffect } from 'react';
import { Users, Link as LinkIcon, DollarSign, Calendar, Search, AlertCircle, CheckCircle2, UserCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : '';

export default function ReferralsPage() {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Lists for Selection
    const [staff, setStaff] = useState([]);
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
            
            // Filter staff (operators and admins) - more robust check
            const staffMembers = allUsers.filter(u => 
                u.role && ['operator', 'admin', 'super_admin', 'staff'].includes(u.role.toLowerCase())
            );
            console.log("Detected staff:", staffMembers.length);
            setStaff(staffMembers);
            
            // Filter potential customers (regular users)
            const customers = allUsers.filter(u => !u.role || u.role.toLowerCase() === 'user');
            setUsers(customers);
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
    ).slice(0, 5); // Show top 5 matches

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-8 h-8 text-indigo-500" />
                        Referans ve Komisyon Sistemi
                    </h1>
                    <p className="text-slate-400 mt-1">Yetkililer ve getirdikleri kullanıcılar arasındaki bağı yönetin.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
                        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <LinkIcon className="w-5 h-5 text-indigo-400" />
                            Hızlı Eşleştirme
                        </h2>
                        
                        <form onSubmit={handleLink} className="space-y-6">
                            {/* Staff Selection */}
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Personel Seçin</label>
                                <select
                                    value={selectedReferrerId}
                                    onChange={(e) => setSelectedReferrerId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                                >
                                    <option value="">-- Personel Seçin --</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.username.toUpperCase()} ({s.role})</option>
                                    ))}
                                </select>
                            </div>

                            {/* User Search & Selection */}
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Getirilen Kullanıcıyı Ara</label>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        placeholder="Kullanıcı adı veya e-posta..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-10 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    />
                                </div>
                                
                                {userSearch && filteredUsers.length > 0 && (
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden mt-1 max-h-48 overflow-y-auto shadow-2xl">
                                        {filteredUsers.map(u => (
                                            <button
                                                key={u.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedUserId(u.id);
                                                    setUserSearch(u.username);
                                                }}
                                                className={`w-full px-4 py-3 text-left hover:bg-indigo-600/20 flex items-center justify-between transition-colors ${selectedUserId === u.id ? 'bg-indigo-600/30' : ''}`}
                                            >
                                                <div>
                                                    <div className="text-sm font-bold text-white">{u.username}</div>
                                                    <div className="text-[10px] text-slate-500">{u.email}</div>
                                                </div>
                                                {selectedUserId === u.id && <CheckCircle2 size={16} className="text-indigo-400" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm animate-pulse">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400 text-sm">
                                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                    {success}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                                disabled={!selectedUserId || !selectedReferrerId}
                            >
                                SİSTEME KAYDET
                            </button>
                        </form>
                    </div>

                    <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-6">
                        <div className="flex items-center gap-2 text-indigo-400 font-bold mb-3">
                            <UserCircle size={18} />
                            <span className="text-xs uppercase tracking-widest">Bilgi Paneli</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Buradan yapılan eşleştirmeler kalıcıdır. Bir kullanıcı bir personele bağlandığında, o kullanıcının tüm harcamaları personelin performans raporlarına dahil edilir.
                        </p>
                    </div>
                </div>

                {/* Table Section */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">Referans İstatistikleri</h2>
                            <div className="px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                {stats.length} Aktif Bağlantı
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-950/50 border-b border-slate-800">
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Personel</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Getirilen Kişi</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Harcanan</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Kayıt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-16 text-center">
                                                <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                                                <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Yükleniyor...</span>
                                            </td>
                                        </tr>
                                    ) : stats.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-16 text-center text-slate-600 font-bold uppercase tracking-widest italic">Veri bulunamadı</td>
                                        </tr>
                                    ) : (
                                        stats.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-indigo-600/5 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black text-xs uppercase">
                                                            {row.referrer_name[0]}
                                                        </div>
                                                        <span className="text-white font-black uppercase text-xs tracking-tight">{row.referrer_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-sm">
                                                    <div className="text-white font-bold">{row.user_name}</div>
                                                    <div className="text-slate-600 text-[10px] font-medium">{row.user_email}</div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-1 text-emerald-400 font-black text-sm">
                                                        <DollarSign size={14} />
                                                        {parseFloat(row.total_deposit).toLocaleString('tr-TR')}
                                                    </div>
                                                    <div className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">TL YATIRIM</div>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2 text-slate-500 font-bold text-xs">
                                                        <Calendar size={14} className="text-slate-700" />
                                                        {new Date(row.joined_at).toLocaleDateString('tr-TR')}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
