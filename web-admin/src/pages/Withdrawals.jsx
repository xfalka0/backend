import React, { useState, useEffect } from 'react';
import { 
    Wallet, 
    TrendingUp, 
    CheckCircle2, 
    Clock, 
    XCircle, 
    Search, 
    Loader2, 
    Check, 
    X, 
    AlertTriangle, 
    Calendar,
    ArrowUpRight,
    Users
} from 'lucide-react';
import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : '';

export default function WithdrawalsPage() {
    const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'processed', 'rejected', 'all'
    const [withdrawals, setWithdrawals] = useState([]);
    const [summary, setSummary] = useState({ total_pending: 0, total_lifetime: 0, total_paid: 0 });
    const [loading, setLoading] = useState(true);
    
    // Modal states for rejection
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [selectedPayoutId, setSelectedPayoutId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const DIAMONDS_PER_USD = 2000;
    const USD_TO_TRY = 46.00;

    useEffect(() => {
        fetchWithdrawals();
        fetchSummary();
    }, [statusFilter]);

    const fetchWithdrawals = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const statusParam = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
            const res = await axios.get(`${API_URL}/api/operators/admin/withdrawals/list${statusParam}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setWithdrawals(res.data);
        } catch (err) {
            console.error("Fetch Withdrawals Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/operators/payouts/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data) {
                setSummary(res.data);
            }
        } catch (err) {
            console.error("Fetch Summary Error:", err);
        }
    };

    const handleApprove = async (payoutId, amount, name, cashAmount) => {
        const confirmMsg = `${name} isimli operatörün ${parseFloat(amount).toLocaleString()} elmaslık (${parseFloat(cashAmount).toFixed(2)} TL) para çekme talebi onaylansın ve ödendi olarak işaretlensin mi?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/operators/admin/payouts/${payoutId}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Para çekme talebi başarıyla onaylandı ve operatörün lifetime kazancına eklendi.");
            fetchWithdrawals();
            fetchSummary();
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message;
            alert("Onaylama işlemi başarısız: " + errMsg);
        }
    };

    const handleOpenRejectModal = (payoutId) => {
        setSelectedPayoutId(payoutId);
        setRejectionReason('');
        setIsRejectModalOpen(true);
    };

    const handleRejectSubmit = async (e) => {
        e.preventDefault();
        if (!rejectionReason.trim()) {
            alert("Lütfen bir ret gerekçesi girin.");
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/operators/admin/payouts/${selectedPayoutId}/reject`, {
                reason: rejectionReason.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Para çekme talebi reddedildi ve elmaslar operatör hesabına iade edildi.");
            setIsRejectModalOpen(false);
            fetchWithdrawals();
            fetchSummary();
        } catch (err) {
            const errMsg = err.response?.data?.error || err.message;
            alert("Reddetme işlemi başarısız: " + errMsg);
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'Bekliyor';
            case 'processed': return 'Onaylandı';
            case 'rejected': return 'Reddedildi';
            default: return status;
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'processed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'rejected': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return <Clock size={12} />;
            case 'processed': return <CheckCircle2 size={12} />;
            case 'rejected': return <XCircle size={12} />;
            default: return null;
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Page Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Para Çekme Talepleri</h2>
                    <p className="text-slate-500 font-medium">Yayıncı ve operatörlerin elmas kazanç çekim taleplerini yönetin.</p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-3">
                    <div className="bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 flex gap-1">
                        <button
                            onClick={() => setStatusFilter('pending')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'pending' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Bekleyenler
                        </button>
                        <button
                            onClick={() => setStatusFilter('processed')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'processed' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Ödenenler
                        </button>
                        <button
                            onClick={() => setStatusFilter('rejected')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'rejected' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Reddedilenler
                        </button>
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            Tümü
                        </button>
                    </div>
                </div>
            </div>

            {/* Financial Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric 1 */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-[24px] blur opacity-50"></div>
                    <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 p-6 rounded-[22px] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bekleyen Çekimler (Diamonds)</span>
                            <h4 className="text-2xl font-black text-amber-500 tracking-tight mt-1">
                                {parseFloat(summary.total_pending || 0).toLocaleString()} Elmas
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1">
                                ~ {((summary.total_pending || 0) / DIAMONDS_PER_USD * USD_TO_TRY).toLocaleString('tr-TR', { minimumFractionDigits: 0 })} TL
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 text-amber-500">
                            <Clock size={20} />
                        </div>
                    </div>
                </div>

                {/* Metric 2 */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-[24px] blur opacity-50"></div>
                    <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 p-6 rounded-[22px] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Toplam Ödenen Miktar</span>
                            <h4 className="text-2xl font-black text-emerald-500 tracking-tight mt-1">
                                {parseFloat(summary.total_paid || 0).toLocaleString()} Elmas
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1">
                                ~ {((summary.total_paid || 0) / DIAMONDS_PER_USD * USD_TO_TRY).toLocaleString('tr-TR', { minimumFractionDigits: 0 })} TL
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                </div>

                {/* Metric 3 */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-[24px] blur opacity-50"></div>
                    <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 p-6 rounded-[22px] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sistem Toplam Kazancı</span>
                            <h4 className="text-2xl font-black text-blue-500 tracking-tight mt-1">
                                {parseFloat(summary.total_lifetime || 0).toLocaleString()} Elmas
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-1">
                                Çekilen + Bekleyen toplam elmas
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-500">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Payout Requests List Table Card */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-[32px] blur opacity-50"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[30px] overflow-hidden">
                    
                    {/* Card Header */}
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-lg font-black text-white capitalize">
                            {getStatusText(statusFilter)} Çekim Talepleri
                        </h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                            <input 
                                type="text" 
                                placeholder="Operatör veya IBAN ara..." 
                                className="bg-white/5 border border-white/10 rounded-lg py-1.5 pl-9 pr-4 text-[10px] text-white focus:outline-none focus:border-blue-500 w-48 transition-all" 
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[800px]">
                                <thead>
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/[0.02]">
                                        <th className="px-8 py-5">Operatör</th>
                                        <th className="px-8 py-5">Banka Hesap Sahibi</th>
                                        <th className="px-8 py-5">IBAN Numarası</th>
                                        <th className="px-8 py-5 text-right">Elmas Tutarı</th>
                                        <th className="px-8 py-5 text-right">Ödenecek TL</th>
                                        <th className="px-8 py-5">Tarih</th>
                                        <th className="px-8 py-5">Durum</th>
                                        {statusFilter === 'pending' && <th className="px-8 py-5 text-right">İşlem</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {withdrawals.length === 0 ? (
                                        <tr>
                                            <td colSpan={statusFilter === 'pending' ? 8 : 7} className="p-12 text-center text-slate-500 font-medium">
                                                Bu kategoride gösterilecek bakiye çekim talebi bulunamadı.
                                            </td>
                                        </tr>
                                    ) : (
                                        withdrawals.map((item) => (
                                            <tr key={item.id} className="group/row hover:bg-white/[0.02] transition-colors">
                                                {/* Operator Username */}
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                                                            {item.username ? item.username[0].toUpperCase() : '?'}
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs font-black text-white group-hover/row:text-indigo-400 transition-colors uppercase tracking-tight">
                                                                {item.display_name || item.username || 'Bilinmeyen'}
                                                            </span>
                                                            <span className="text-[9px] text-slate-500">ID: {item.username || ''}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                
                                                {/* Account Holder */}
                                                <td className="px-8 py-5 text-xs font-bold text-slate-300 capitalize">
                                                    {item.account_holder}
                                                </td>
                                                
                                                {/* IBAN */}
                                                <td className="px-8 py-5">
                                                    <span className="block text-xs font-mono font-bold text-slate-400 bg-white/5 border border-white/5 rounded px-2.5 py-1 select-all cursor-pointer hover:border-slate-500 max-w-[240px] truncate tracking-tight text-center">
                                                        {item.iban.replace(/(.{4})/g, '$1 ')}
                                                    </span>
                                                </td>
                                                
                                                {/* Diamond Amount */}
                                                <td className="px-8 py-5 text-right text-xs font-black text-cyan-400 tabular-nums tracking-tight">
                                                    {parseFloat(item.amount).toLocaleString()} Elmas
                                                </td>
                                                
                                                {/* Cash Amount */}
                                                <td className="px-8 py-5 text-right text-sm font-black text-emerald-500 tabular-nums tracking-tight">
                                                    ₺{parseFloat(item.cash_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                
                                                {/* Date */}
                                                <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">
                                                    <div className="flex items-center gap-1.5 py-2">
                                                        <Calendar size={10} /> 
                                                        {new Date(item.created_at).toLocaleDateString("tr-TR", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                
                                                {/* Status */}
                                                <td className="px-8 py-5">
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${getStatusStyle(item.status)}`}>
                                                        {getStatusIcon(item.status)}
                                                        {getStatusText(item.status)}
                                                    </div>
                                                    {item.status === 'rejected' && item.rejection_reason && (
                                                        <span className="block text-[8px] text-rose-500 font-bold max-w-[150px] truncate mt-1">
                                                            Neden: {item.rejection_reason}
                                                        </span>
                                                    )}
                                                </td>
                                                
                                                {/* Quick Approval / Rejection Operations */}
                                                {statusFilter === 'pending' && (
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleApprove(item.id, item.amount, item.account_holder, item.cash_amount)}
                                                                className="p-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg border border-emerald-500/20 hover:border-emerald-500 transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 cursor-pointer shadow-lg shadow-emerald-500/5"
                                                                title="Ödemeyi Onayla"
                                                            >
                                                                <Check size={12} /> Öde / Onayla
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenRejectModal(item.id)}
                                                                className="p-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg border border-rose-500/20 hover:border-rose-500 transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 cursor-pointer shadow-lg shadow-rose-500/5"
                                                                title="Talebi Reddet"
                                                            >
                                                                <X size={12} /> Reddet
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Rejection Dialog Modal */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-rose-500">
                                <AlertTriangle size={24} />
                                <h3 className="text-lg font-black text-white">Çekim Talebi Reddi</h3>
                            </div>
                            <button onClick={() => setIsRejectModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        {/* Form */}
                        <form onSubmit={handleRejectSubmit} className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Red Gerekçesi (Operatör Görecektir)
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    required
                                    rows={4}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-all resize-none"
                                    placeholder="Örnek: Belirttiğiniz IBAN geçersiz veya isim eşleşmiyor. Lütfen IBAN bilgilerinizi güncelleyerek tekrar deneyiniz."
                                />
                            </div>

                            <div className="bg-rose-500/5 rounded-xl border border-rose-500/10 p-4">
                                <p className="text-[10px] text-rose-400 font-bold leading-relaxed">
                                    ⚠️ ÖNEMLİ: Bu talep reddedildiğinde, operatörün para çekimi için düşülen elmas miktarı anında bakiye hesabına iade edilecektir.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                                >
                                    Vazgeç
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-rose-900/20"
                                >
                                    Talebi Reddet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
