import React, { useState, useEffect } from 'react';
import { Crown, Check, Plus, Edit3, Trash2, ShieldCheck, Zap, Star, Coins, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function VipPage() {
    const { token } = useAuth();
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPkg, setEditingPkg] = useState(null);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        coins: '',
        price: '',
        is_popular: false
    });

    const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'https://backend-kj17.onrender.com'
        : '';

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/packages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setPackages(data);
        } catch (err) {
            console.error("Fetch packages error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');

        const method = editingPkg ? 'PUT' : 'POST';
        const url = editingPkg ? `${API_URL}/api/admin/packages/${editingPkg.id}` : `${API_URL}/api/admin/packages`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('İşlem başarısız');

            setShowModal(false);
            setEditingPkg(null);
            setFormData({ name: '', coins: '', price: '', is_popular: false });
            fetchPackages();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu paketi silmek istediğinize emin misiniz?')) return;
        try {
            await fetch(`${API_URL}/api/admin/packages/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchPackages();
        } catch (err) {
            alert('Silme başarısız');
        }
    };

    const openEdit = (pkg) => {
        setEditingPkg(pkg);
        setFormData({
            name: pkg.name,
            coins: pkg.coins,
            price: pkg.price,
            is_popular: pkg.is_popular
        });
        setShowModal(true);
    };

    if (loading) return <div className="p-8 text-white font-bold">Yükleniyor...</div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Coin Fiyatları Yönetimi</h2>
                    <p className="text-slate-500 font-medium">Uygulama içi satın alım paketlerini ve fiyatlarını yönetin.</p>
                </div>

                <button
                    onClick={() => {
                        setEditingPkg(null);
                        setFormData({ name: '', coins: '', price: '', is_popular: false });
                        setShowModal(true);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-900/20 flex items-center gap-2"
                >
                    <Plus size={18} /> Yeni Paket Ekle
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pt-4">
                {packages.map((pkg) => (
                    <div key={pkg.id} className="relative group">
                        {pkg.is_popular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-xl">
                                EN POPÜLER
                            </div>
                        )}
                        <div className={`absolute -inset-1 bg-gradient-to-br from-purple-500 to-blue-500 rounded-[32px] blur opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                        <div className="relative bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[30px] p-8 flex flex-col h-full hover:border-white/10 transition-all">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white mb-6 shadow-2xl">
                                <Coins size={28} />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-1 uppercase tracking-tighter">{pkg.name}</h3>
                            <div className="flex items-baseline gap-2 mb-8">
                                <span className="text-4xl font-black text-white tracking-tight">₺{pkg.price}</span>
                                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">/ {pkg.coins} Coin</span>
                            </div>

                            <div className="flex gap-2 mt-auto">
                                <button
                                    onClick={() => openEdit(pkg)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <Edit3 size={16} /> Düzenle
                                </button>
                                <button
                                    onClick={() => handleDelete(pkg.id)}
                                    className="p-3 bg-white/5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-xl transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {packages.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white/5 rounded-[32px] border-2 border-dashed border-white/5">
                        <Coins size={48} className="mx-auto text-slate-700 mb-4" />
                        <p className="text-slate-500 font-black uppercase tracking-widest">Henüz paket eklenmedi</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-[32px] p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                                {editingPkg ? 'Paketi Düzenle' : 'Yeni Paket Ekle'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Paket Adı</label>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Örn: Süper Başlangıç Paketi"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Coin Miktarı</label>
                                    <input
                                        type="number"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                                        value={formData.coins}
                                        onChange={e => setFormData({ ...formData, coins: e.target.value })}
                                        placeholder="500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fiyat (TL)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                                        value={formData.price}
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        placeholder="49.99"
                                        required
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-12 h-6 rounded-full p-1 transition-all ${formData.is_popular ? 'bg-purple-600' : 'bg-slate-800'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${formData.is_popular ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={formData.is_popular}
                                    onChange={e => setFormData({ ...formData, is_popular: e.target.checked })}
                                />
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">Popüler Paket Olarak İşaretle</span>
                            </label>

                            <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-purple-900/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                <Save size={18} /> Kaydet
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
