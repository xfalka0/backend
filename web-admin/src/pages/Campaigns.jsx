import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, ToggleLeft, ToggleRight, Calendar, Percent, Coins, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = '';

const defaultForm = {
    title: '', description: '', bonus_percent: 50,
    start_date: new Date().toISOString().slice(0, 16),
    end_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16),
    target: 'all', is_active: true
};

export default function Campaigns() {
    const { token } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => { fetchCampaigns(); }, []);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/campaigns`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setCampaigns(await res.json());
        } catch (e) { }
        setLoading(false);
    };

    const saveCampaign = async () => {
        if (!form.title) return;
        setSaving(true);
        setMsg(null);
        try {
            const res = await fetch(`${API_URL}/admin/campaigns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            setMsg({ success: res.ok, text: res.ok ? 'Kampanya oluşturuldu!' : data.error || 'Hata.' });
            if (res.ok) { setShowForm(false); setForm(defaultForm); fetchCampaigns(); }
        } catch (e) { setMsg({ success: false, text: 'Sunucu hatası.' }); }
        setSaving(false);
    };

    const toggleCampaign = async (id, is_active) => {
        await fetch(`${API_URL}/admin/campaigns/${id}/toggle`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ is_active: !is_active })
        });
        fetchCampaigns();
    };

    const deleteCampaign = async (id) => {
        if (!confirm('Bu kampanyayı silmek istediğine emin misin?')) return;
        await fetch(`${API_URL}/admin/campaigns/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        fetchCampaigns();
    };

    const isActive = (c) => c.is_active && new Date(c.start_date) <= new Date() && new Date(c.end_date) >= new Date();
    const isUpcoming = (c) => c.is_active && new Date(c.start_date) > new Date();
    const isExpired = (c) => new Date(c.end_date) < new Date();

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white">Kampanya Yönetimi</h1>
                    <p className="text-slate-500 mt-1">Bonus coin kampanyaları ve promosyonlar</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-5 py-3 rounded-xl transition">
                    <Plus size={16} /> Yeni Kampanya
                </button>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-white">Yeni Kampanya Oluştur</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Kampanya Adı</label>
                            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder="Bayram Kampanyası..."
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Bonus %</label>
                            <div className="relative">
                                <input type="number" min={1} max={500} value={form.bonus_percent}
                                    onChange={e => setForm({ ...form, bonus_percent: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition" />
                                <span className="absolute right-4 top-3 text-slate-400">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Başlangıç</label>
                            <input type="datetime-local" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Bitiş</label>
                            <input type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Hedef</label>
                            <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition">
                                <option value="all">Tüm Kullanıcılar</option>
                                <option value="new">Yeni Kullanıcılar (7 gün)</option>
                                <option value="returning">Geri Dönen Kullanıcılar</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Açıklama</label>
                            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                placeholder="Kampanya detayı..."
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition" />
                        </div>
                    </div>

                    {msg && (
                        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${msg.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {msg.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {msg.text}
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={saveCampaign} disabled={saving}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
                            {saving ? 'Kaydediliyor...' : 'Kampanya Oluştur'}
                        </button>
                        <button onClick={() => setShowForm(false)}
                            className="px-6 bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold py-3 rounded-xl transition">
                            İptal
                        </button>
                    </div>
                </div>
            )}

            {/* Campaign List */}
            {loading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-900 rounded-2xl animate-pulse" />)}</div>
            ) : campaigns.length === 0 ? (
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center">
                    <Tag size={48} className="text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500">Henüz kampanya yok.</p>
                    <p className="text-slate-600 text-sm mt-1">İlk kampanyanı oluştur!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {campaigns.map(c => (
                        <div key={c.id} className={`bg-slate-900 border rounded-2xl p-5 flex items-center gap-4 ${isActive(c) ? 'border-green-500/30' : isExpired(c) ? 'border-white/5 opacity-60' : 'border-yellow-500/30'}`}>
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-xl ${isActive(c) ? 'bg-green-500/20 text-green-400' : isUpcoming(c) ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-800 text-slate-500'}`}>
                                %{c.bonus_percent}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-white font-bold">{c.title}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isActive(c) ? 'bg-green-500/20 text-green-400' : isUpcoming(c) ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                                        {isActive(c) ? 'Aktif' : isUpcoming(c) ? 'Yakında' : 'Bitti'}
                                    </span>
                                </div>
                                {c.description && <p className="text-slate-400 text-sm mt-0.5">{c.description}</p>}
                                <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                                    <Calendar size={10} />
                                    {new Date(c.start_date).toLocaleDateString('tr-TR')} — {new Date(c.end_date).toLocaleDateString('tr-TR')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => toggleCampaign(c.id, c.is_active)}
                                    className={`p-2 rounded-xl transition ${c.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:bg-slate-700'}`}>
                                    {c.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                </button>
                                <button onClick={() => deleteCampaign(c.id)}
                                    className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
