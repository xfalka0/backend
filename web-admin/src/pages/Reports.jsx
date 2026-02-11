import React, { useState, useEffect } from 'react';
import { ShieldCheck, User, ShieldAlert, CheckCircle, Clock, Search, Filter, MessageCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ReportsPage() {
    const { token } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all'); // all, pending, resolved
    const [searchTerm, setSearchTerm] = useState('');

    const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'https://backend-kj17.onrender.com'
        : '';

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/reports`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setReports(data);
        } catch (err) {
            console.error("Fetch reports error:", err);
            setError("Raporlar yüklenirken hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            const res = await fetch(`${API_URL}/api/admin/reports/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });

            if (!res.ok) throw new Error('Güncelleme başarısız');
            fetchReports();
        } catch (err) {
            alert(err.message);
        }
    };

    const filteredReports = reports.filter(r => {
        if (filter !== 'all' && r.status !== filter) return false;
        const search = searchTerm.toLowerCase();
        return (
            r.reason?.toLowerCase().includes(search) ||
            r.reporter_name?.toLowerCase().includes(search) ||
            r.reported_name?.toLowerCase().includes(search)
        );
    });

    if (loading) return <div className="p-8 text-white font-bold italic">Raporlar yükleniyor...</div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Şikayet ve Destek Yönetimi</h2>
                    <p className="text-slate-500 font-medium">Kullanıcılar tarafından iletilen raporları ve sorunları yönetin.</p>
                </div>

                <div className="flex gap-2">
                    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-1 flex">
                        {['all', 'pending', 'resolved'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                            >
                                {f === 'all' ? 'Tümü' : f === 'pending' ? 'Bekleyen' : 'Çözüldü'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-[32px] blur"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[30px] overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.01]">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="text-purple-500" size={20} />
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">Gelen Raporlar</h3>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Raporlarda ara..."
                                className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-purple-500 w-full md:w-64 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.01]">
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Kullanıcılar</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Şikayet Nedeni</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Tarih</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Durum</th>
                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-white/[0.02] transition-colors group/row">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Raporlayan:</span>
                                                    <span className="text-xs font-black text-white">{report.reporter_name || 'Silinmiş Hesap'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Şikayet Edilen:</span>
                                                    <span className="text-xs font-black text-pink-400">{report.reported_name || 'Silinmiş Hesap'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white mb-1 group-hover/row:text-purple-400 transition-colors uppercase tracking-tight">{report.reason}</span>
                                                <p className="text-[10px] text-slate-500 max-w-xs truncate">{report.details || 'Detay belirtilmemiş.'}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Clock size={12} />
                                                <span className="text-[11px] font-bold">{new Date(report.created_at).toLocaleString('tr-TR')}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500 animate-pulse'}`}>
                                                    {report.status === 'resolved' ? 'Çözüldü' : 'Bekliyor'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            {report.status === 'pending' ? (
                                                <button
                                                    onClick={() => updateStatus(report.id, 'resolved')}
                                                    className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
                                                >
                                                    <CheckCircle size={14} /> Çözüldü İşaretle
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => updateStatus(report.id, 'pending')}
                                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2"
                                                >
                                                    <Clock size={14} /> Geri Al
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}

                                {filteredReports.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center text-slate-600">
                                                    <ShieldCheck size={32} />
                                                </div>
                                                <p className="text-slate-500 font-black uppercase tracking-widest">Rapor Bulunamadı</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
