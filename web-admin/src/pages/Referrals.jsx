import React, { useState, useEffect } from 'react';
import { Users, Link as LinkIcon, DollarSign, Calendar, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : '';

export default function ReferralsPage() {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Form States
    const [userId, setUserId] = useState('');
    const [referrerId, setReferrerId] = useState('');
    const [allUsers, setAllUsers] = useState([]); // To help search for IDs

    useEffect(() => {
        fetchStats();
        fetchAllUsers();
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

    const fetchAllUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllUsers(res.data);
        } catch (err) {
            console.error("Fetch users error:", err);
        }
    };

    const handleLink = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!userId || !referrerId) {
            setError("Lütfen her iki ID'yi de girin.");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/admin/referrals/link`, {
                userId,
                referrerId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess("Kullanıcı ve personel başarıyla eşleştirildi!");
            setUserId('');
            setReferrerId('');
            fetchStats(); // Refresh table
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="w-8 h-8 text-indigo-500" />
                        Referans ve Komisyon Yönetimi
                    </h1>
                    <p className="text-slate-400 mt-1">Personellerin getirdiği kullanıcıları takip edin ve kazançlarını yönetin.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Link Form */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <LinkIcon className="w-5 h-5 text-indigo-400" />
                            Yeni Referans Eşle
                        </h2>
                        
                        <form onSubmit={handleLink} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Getirilen Kullanıcı ID</label>
                                <input
                                    type="text"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    placeholder="Örn: 550e8400-e29b..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Personel (Referans) ID</label>
                                <input
                                    type="text"
                                    value={referrerId}
                                    onChange={(e) => setReferrerId(e.target.value)}
                                    placeholder="Personel ID girin..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {success}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                            >
                                Eşleştirmeyi Kaydet
                            </button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-slate-800">
                            <h3 className="text-sm font-medium text-slate-300 mb-2">Nasıl Çalışır?</h3>
                            <ul className="text-xs text-slate-500 space-y-2">
                                <li>• Kullanıcılar listesinden hedefin ID'sini kopyalayın.</li>
                                <li>• Personelin (Operatör) ID'sini girin.</li>
                                <li>• Eşleşme sonrası o kullanıcının tüm yatırımları personelin istatistiklerine yansır.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Stats Table */}
                <div className="lg:col-span-2">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                        <div className="p-6 border-b border-slate-800">
                            <h2 className="text-lg font-semibold text-white">Aktif Referanslar ve Kazançlar</h2>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-950/50 border-b border-slate-800">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Personel</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Getirilen Kullanıcı</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Yatırım</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Katılım</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-slate-500 italic">Veriler yükleniyor...</td>
                                        </tr>
                                    ) : stats.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-slate-500 italic">Henüz referans kaydı bulunamadı.</td>
                                        </tr>
                                    ) : (
                                        stats.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="text-white font-medium">{row.referrer_name}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div className="text-white font-medium">{row.user_name}</div>
                                                    <div className="text-slate-500 text-xs">{row.user_email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1 text-emerald-400 font-bold">
                                                        <DollarSign className="w-4 h-4" />
                                                        {parseFloat(row.total_deposit).toLocaleString('tr-TR')} TL
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4" />
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
