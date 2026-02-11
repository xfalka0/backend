import React, { useState, useEffect } from 'react';
import { Plus, Gift, Coins, Camera, Trash2, Edit3, XCircle, Save, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function GiftsPage() {
    const { token } = useAuth();
    const [gifts, setGifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGift, setEditingGift] = useState(null);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        cost: '',
        icon_url: ''
    });

    const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

    useEffect(() => {
        fetchGifts();
    }, []);

    const fetchGifts = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/gifts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setGifts(data);
        } catch (err) {
            console.error("Fetch gifts error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');

        const method = editingGift ? 'PUT' : 'POST';
        const url = editingGift ? `${API_URL}/api/admin/gifts/${editingGift.id}` : `${API_URL}/api/admin/gifts`;

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
            setEditingGift(null);
            setFormData({ name: '', cost: '', icon_url: '' });
            fetchGifts();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu hediyeyi silmek istediğinize emin misiniz?')) return;
        try {
            await fetch(`${API_URL}/api/admin/gifts/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchGifts();
        } catch (err) {
            alert('Silme başarısız');
        }
    };

    const openEdit = (gift) => {
        setEditingGift(gift);
        setFormData({
            name: gift.name,
            cost: gift.cost,
            icon_url: gift.icon_url
        });
        setShowModal(true);
    };

    if (loading) return <div className="p-8 text-white font-bold">Yükleniyor...</div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Hediye Yönetimi</h2>
                    <p className="text-slate-500 font-medium">Uygulama içi hediye ekonomisini ve fiyatlarını yönetin.</p>
                </div>

                <button
                    onClick={() => {
                        setEditingGift(null);
                        setFormData({ name: '', cost: '', icon_url: '' });
                        setShowModal(true);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-900/20 flex items-center gap-2"
                >
                    <Plus size={18} /> Yeni Hediye Ekle
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {gifts.map((gift) => (
                    <div key={gift.id} className="group relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-[24px] blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[22px] p-6 text-center hover:border-white/10 transition-all">
                            <div className="text-5xl mb-4 group-hover:scale-125 transition-transform duration-500 drop-shadow-2xl">
                                {gift.icon_url.length < 5 ? gift.icon_url : <img src={gift.icon_url} alt={gift.name} className="w-16 h-16 mx-auto object-contain" />}
                            </div>
                            <h4 className="text-sm font-black text-white group-hover:text-purple-400 transition-colors uppercase tracking-widest truncate px-1">{gift.name}</h4>
                            <div className="flex items-center justify-center gap-1.5 mt-2 bg-white/5 rounded-lg py-1">
                                <span className="text-[10px] font-black text-yellow-400">{gift.cost} COIN</span>
                            </div>

                            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(gift)} className="p-1.5 bg-slate-800/80 hover:bg-amber-500/20 text-slate-400 hover:text-amber-500 rounded-lg transition-colors"><Edit3 size={14} /></button>
                                <button onClick={() => handleDelete(gift.id)} className="p-1.5 bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    </div>
                ))}

                {gifts.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white/5 rounded-[32px] border-2 border-dashed border-white/5">
                        <Gift size={48} className="mx-auto text-slate-700 mb-4" />
                        <p className="text-slate-500 font-black uppercase tracking-widest">Henüz hediye eklenmedi</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-[32px] p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                                {editingGift ? 'Hediyeyi Düzenle' : 'Yeni Hediye Ekle'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Hediye Adı</label>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Örn: Kırmızı Gül"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Coin Maliyeti</label>
                                    <input
                                        type="number"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                                        value={formData.cost}
                                        onChange={e => setFormData({ ...formData, cost: e.target.value })}
                                        placeholder="10"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Simge (Emoji veya URL)</label>
                                    <input
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                                        value={formData.icon_url}
                                        onChange={e => setFormData({ ...formData, icon_url: e.target.value })}
                                        placeholder="🌹 veya https://..."
                                        required
                                    />
                                </div>
                            </div>

                            <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-purple-900/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                <Save size={18} /> {editingGift ? 'Güncelle' : 'Kaydet'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
