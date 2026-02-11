import React, { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, DollarSign, Calendar, Search, Download, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://backend-kj17.onrender.com'
    : '';

export default function PaymentsPage() {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPayments = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API_URL}/api/admin/payments`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPayments(res.data);
            } catch (err) {
                console.error("Fetch Payments Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPayments();
    }, []);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Ödemeler</h2>
                    <p className="text-slate-500 font-medium">Finansal işlemleri kontrol edin ve raporları inceleyin.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 bg-slate-800 border border-white/5 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all flex items-center gap-2">
                        <Download size={16} /> Rapor İndir
                    </button>
                    <button className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-900/20">
                        Mutabakat Yap
                    </button>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-[32px] blur opacity-50"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[30px] overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-lg font-black text-white">Son Satın Alımlar</h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                            <input type="text" placeholder="İşlem veya kullanıcı ara..." className="bg-white/5 border border-white/10 rounded-lg py-1.5 pl-9 pr-4 text-[10px] text-white focus:outline-none focus:border-emerald-500 w-48" />
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="animate-spin text-emerald-500" size={32} />
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/[0.02]">
                                    <th className="px-8 py-5">Kullanıcı</th>
                                    <th className="px-8 py-5">Paket Detayı</th>
                                    <th className="px-8 py-5">Tutar</th>
                                    <th className="px-8 py-5">Tarih</th>
                                    <th className="px-8 py-5">Durum</th>
                                    <th className="px-8 py-5 text-right">Fatura</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-slate-500 font-medium">
                                            Henüz işlem kaydı bulunmuyor.
                                        </td>
                                    </tr>
                                ) : (
                                    payments.map((payment) => (
                                        <tr key={payment.id} className="group/row hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 group-hover/row:bg-purple-600 transition-all">
                                                        {(payment.user_name || '?')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs font-black text-white group-hover/row:text-purple-400 transition-colors uppercase tracking-tight">
                                                            {payment.user_name || 'Bilinmeyen'}
                                                        </span>
                                                        <span className="text-[9px] text-slate-500">{payment.email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-xs font-bold text-slate-400">
                                                {payment.package_name || 'Bilinmeyen Paket'}
                                            </td>
                                            <td className="px-8 py-5 text-sm font-black text-emerald-500 tracking-tight">
                                                ₺{payment.amount}
                                            </td>
                                            <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 py-7">
                                                <Calendar size={10} /> {new Date(payment.created_at).toLocaleDateString("tr-TR")}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${payment.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                                                    }`}>
                                                    {payment.status === 'completed' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                    {payment.status === 'completed' ? 'Tamamlandı' : payment.status}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button className="text-slate-600 hover:text-white transition-colors cursor-pointer"><Download size={18} /></button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
