import React, { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, DollarSign, Calendar, Search, Download, CheckCircle2, Clock, Loader2, Package, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : '';

export default function PaymentsPage() {
    const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' or 'packages'
    const [payments, setPayments] = useState([]);
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        coins: '',
        price: '',
        revenuecat_id: '',
        description: '',
        is_popular: false,
        is_active: true
    });

    useEffect(() => {
        if (activeTab === 'transactions') {
            fetchPayments();
        } else {
            fetchPackages();
        }
    }, [activeTab]);

    const fetchPayments = async () => {
        setLoading(true);
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

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/packages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPackages(res.data);
        } catch (err) {
            console.error("Fetch Packages Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (pkg = null) => {
        if (pkg) {
            setEditingPackage(pkg);
            setFormData({
                name: pkg.name || '',
                coins: pkg.coins || '',
                price: pkg.price || '',
                revenuecat_id: pkg.revenuecat_id || '',
                description: pkg.description || '',
                is_popular: pkg.is_popular || false,
                is_active: pkg.is_active !== false
            });
        } else {
            setEditingPackage(null);
            setFormData({
                name: '',
                coins: '',
                price: '',
                revenuecat_id: '',
                description: '',
                is_popular: false,
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const url = editingPackage
                ? `${API_URL}/api/admin/packages/${editingPackage.id}`
                : `${API_URL}/api/admin/packages`;
            const method = editingPackage ? 'put' : 'post';

            await axios[method](url, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setIsModalOpen(false);
            fetchPackages();
        } catch (err) {
            alert("İşlem başarısız: " + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bu paketi silmek istediğinize emin misiniz?")) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/api/admin/packages/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPackages();
        } catch (err) {
            alert("Silme işlemi başarısız.");
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Finans & Paketler</h2>
                    <p className="text-slate-500 font-medium">Satın alımları izleyin ve coin paketlerini yönetin.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 flex gap-1">
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'transactions' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            İşlemler
                        </button>
                        <button
                            onClick={() => setActiveTab('packages')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'packages' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            Paket Ayarları
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'transactions' ? (
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
                                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 group-hover/row:bg-emerald-600 transition-all">
                                                            {(payment.user_name || '?')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs font-black text-white group-hover/row:text-emerald-400 transition-colors uppercase tracking-tight">
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
            ) : (
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-[32px] blur opacity-50"></div>
                    <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[30px] overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-lg font-black text-white">Coin Paketleri</h3>
                            <button
                                onClick={() => handleOpenModal()}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
                            >
                                <Plus size={14} /> Yeni Paket Ekle
                            </button>
                        </div>

                        {loading ? (
                            <div className="p-12 flex justify-center">
                                <Loader2 className="animate-spin text-purple-500" size={32} />
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/[0.02]">
                                        <th className="px-8 py-5">Paket Adı</th>
                                        <th className="px-8 py-5">Coin Miktarı</th>
                                        <th className="px-8 py-5">Fiyat (₺)</th>
                                        <th className="px-8 py-5">RevenueCat ID</th>
                                        <th className="px-8 py-5">Durum</th>
                                        <th className="px-8 py-5 text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {packages.map((pkg) => (
                                        <tr key={pkg.id} className="group/row hover:bg-white/[0.02] transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${pkg.is_popular ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-400'} group-hover/row:bg-purple-600 group-hover/row:text-white transition-all`}>
                                                        <Package size={16} />
                                                    </div>
                                                    <div>
                                                        <span className="block text-xs font-black text-white group-hover/row:text-purple-400 transition-colors uppercase tracking-tight">
                                                            {pkg.name}
                                                        </span>
                                                        {pkg.is_popular && <span className="text-[9px] text-amber-500 font-black uppercase tracking-widest">En Popüler</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-xs font-black text-white tabular-nums">
                                                {pkg.coins} COIN
                                            </td>
                                            <td className="px-8 py-5 text-xs font-black text-emerald-500">
                                                ₺{pkg.price}
                                            </td>
                                            <td className="px-8 py-5 text-[10px] font-mono text-slate-500 uppercase">
                                                {pkg.revenuecat_id || 'ID YOK'}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${pkg.is_active !== false ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {pkg.is_active !== false ? <Check size={12} /> : <X size={12} />}
                                                    {pkg.is_active !== false ? 'Aktif' : 'Pasif'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(pkg)}
                                                        className="p-2 text-slate-600 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(pkg.id)}
                                                        className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-xl font-black text-white">{editingPackage ? 'Paketi Düzenle' : 'Yeni Paket Ekle'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paket Adı</label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    type="text" required className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-purple-500 transition-all" placeholder="Gümüş Paket"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Coin Miktarı</label>
                                    <input
                                        value={formData.coins}
                                        onChange={(e) => setFormData({ ...formData, coins: e.target.value })}
                                        type="number" required className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-purple-500 transition-all" placeholder="250"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fiyat (₺)</label>
                                    <input
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        type="number" step="0.01" required className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-purple-500 transition-all" placeholder="89.99"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">RevenueCat ID</label>
                                <input
                                    value={formData.revenuecat_id}
                                    onChange={(e) => setFormData({ ...formData, revenuecat_id: e.target.value })}
                                    type="text" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-purple-500 transition-all" placeholder="coins_250"
                                />
                            </div>
                            <div className="flex items-center gap-6 py-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div
                                        onClick={() => setFormData({ ...formData, is_popular: !formData.is_popular })}
                                        className={`w-5 h-5 rounded border ${formData.is_popular ? 'bg-purple-600 border-purple-600' : 'border-white/10'} flex items-center justify-center transition-all`}
                                    >
                                        {formData.is_popular && <Check size={14} className="text-white" />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">En Popüler</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div
                                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                        className={`w-5 h-5 rounded border ${formData.is_active ? 'bg-emerald-600 border-emerald-600' : 'border-white/10'} flex items-center justify-center transition-all`}
                                    >
                                        {formData.is_active && <Check size={14} className="text-white" />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">Aktif</span>
                                </label>
                            </div>
                            <button type="submit" className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-purple-900/20">
                                {editingPackage ? 'Değişiklikleri Kaydet' : 'Paketi Oluştur'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
