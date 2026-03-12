import React, { useState, useEffect } from 'react';
import { Clock, Send, Plus, Trash2, Play, Pause, Bot, User, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-kj17.onrender.com/api';

const defaultForm = {
    operator_id: '',
    target: 'random', // 'random' or 'specific'
    target_user_id: '',
    message_template: '',
    send_at_hour: 10,
    send_at_minute: 0,
    days_of_week: [1, 2, 3, 4, 5], // Mon-Fri
    is_active: true
};

const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MESSAGE_TEMPLATES = [
    'Merhaba tatlım, nasılsın? 😊',
    'Seni düşünüyordum... ✨',
    'Bu gece ne yapıyorsun? 🌙',
    'Çok güzel bir profil fotoğrafın var 😍',
    'Seninle konuşmak istedim 💌',
    'Hey, burada mısın? 👋',
    'Hediyeni bekliyorum 😘',
    'Bana merhaba demez misin? 🌹',
];

export default function FakeScheduler() {
    const { token } = useAuth();
    const [schedules, setSchedules] = useState([]);
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        fetchSchedules();
        fetchOperators();
    }, []);

    const fetchSchedules = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/message-schedules`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setSchedules(await res.json());
        } catch (e) { }
        setLoading(false);
    };

    const fetchOperators = async () => {
        try {
            const res = await fetch(`${API_URL}/operators`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setOperators(await res.json());
        } catch (e) { }
    };

    const saveSchedule = async () => {
        if (!form.operator_id || !form.message_template) return;
        setSaving(true); setMsg(null);
        try {
            const res = await fetch(`${API_URL}/admin/message-schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            setMsg({ success: res.ok, text: res.ok ? 'Zamanlama oluşturuldu!' : data.error || 'Hata.' });
            if (res.ok) { setShowForm(false); setForm(defaultForm); fetchSchedules(); }
        } catch (e) { setMsg({ success: false, text: 'Sunucu hatası.' }); }
        setSaving(false);
    };

    const toggleSchedule = async (id, is_active) => {
        await fetch(`${API_URL}/admin/message-schedules/${id}/toggle`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ is_active: !is_active })
        });
        fetchSchedules();
    };

    const deleteSchedule = async (id) => {
        if (!confirm('Bu zamanlamayı silmek istediğine emin misin?')) return;
        await fetch(`${API_URL}/admin/message-schedules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        fetchSchedules();
    };

    const toggleDay = (day) => {
        setForm(f => ({
            ...f,
            days_of_week: f.days_of_week.includes(day)
                ? f.days_of_week.filter(d => d !== day)
                : [...f.days_of_week, day]
        }));
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white">Mesaj Zamanlayıcı</h1>
                    <p className="text-slate-500 mt-1">Operatörlerden otomatik mesaj gönderimi</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-5 py-3 rounded-xl transition">
                    <Plus size={16} /> Yeni Zamanlama
                </button>
            </div>

            {/* Info banner */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <Bot size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-blue-300 text-sm">
                    Bu özellik belirlediğin saatte seçili operatörden rastgele veya belirli bir kullanıcıya otomatik mesaj gönderir.
                    Mesajlar chat üzerinden iletilir ve coin düşmez.
                </p>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 space-y-5">
                    <h2 className="text-lg font-bold text-white">Yeni Zamanlama</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Operatör (Gönderen)</label>
                            <select value={form.operator_id} onChange={e => setForm({ ...form, operator_id: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition">
                                <option value="">— Seç —</option>
                                {operators.map(op => (
                                    <option key={op.id} value={op.id}>{op.name || op.username}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Alıcı</label>
                            <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition">
                                <option value="random">Rastgele Aktif Kullanıcı</option>
                                <option value="inactive">Son 3 Günde Girmeyen</option>
                                <option value="new">Yeni Kayıt (7 gün)</option>
                            </select>
                        </div>
                    </div>

                    {/* Message Template */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Mesaj Şablonu</label>
                        <textarea value={form.message_template} onChange={e => setForm({ ...form, message_template: e.target.value })}
                            placeholder="Mesaj içeriği..."
                            rows={3}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition resize-none" />
                        <div className="flex flex-wrap gap-2 mt-2">
                            {MESSAGE_TEMPLATES.map((t, i) => (
                                <button key={i} onClick={() => setForm({ ...form, message_template: t })}
                                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg transition">
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Saat</label>
                            <div className="flex gap-2">
                                <input type="number" min={0} max={23} value={form.send_at_hour}
                                    onChange={e => setForm({ ...form, send_at_hour: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-purple-500 transition" />
                                <span className="text-slate-400 self-center font-bold">:</span>
                                <input type="number" min={0} max={59} step={5} value={form.send_at_minute}
                                    onChange={e => setForm({ ...form, send_at_minute: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-purple-500 transition" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Günler</label>
                            <div className="flex gap-1">
                                {DAYS.map((day, i) => (
                                    <button key={i} onClick={() => toggleDay(i)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${form.days_of_week.includes(i) ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {msg && (
                        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${msg.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {msg.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {msg.text}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button onClick={saveSchedule} disabled={saving || !form.operator_id || !form.message_template}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition">
                            {saving ? 'Kaydediliyor...' : 'Zamanlamayı Kaydet'}
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-6 bg-slate-800 text-slate-300 hover:bg-slate-700 py-3 rounded-xl transition font-bold">
                            İptal
                        </button>
                    </div>
                </div>
            )}

            {/* Schedule List */}
            {loading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-900 rounded-2xl animate-pulse" />)}</div>
            ) : schedules.length === 0 ? (
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center">
                    <Clock size={48} className="text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500">Henüz zamanlama yok.</p>
                    <p className="text-slate-600 text-sm mt-1">İlk otomatik mesajını oluştur!</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {schedules.map(s => (
                        <div key={s.id} className={`bg-slate-900 border rounded-2xl p-5 flex items-center gap-4 ${s.is_active ? 'border-purple-500/20' : 'border-white/5 opacity-60'}`}>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.is_active ? 'bg-purple-500/20' : 'bg-slate-800'}`}>
                                <Bot size={20} className={s.is_active ? 'text-purple-400' : 'text-slate-500'} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-white font-bold text-sm">
                                        {operators.find(o => o.id == s.operator_id)?.name || `Operatör #${s.operator_id}`}
                                    </p>
                                    <span className="text-slate-500 text-xs">→</span>
                                    <span className="text-slate-400 text-xs">{s.target === 'random' ? 'Rastgele' : s.target === 'inactive' ? 'İnaktif' : 'Yeni'}</span>
                                </div>
                                <p className="text-slate-400 text-sm truncate mt-0.5">"{s.message_template}"</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-purple-400 text-xs font-bold flex items-center gap-1">
                                        <Clock size={10} /> {String(s.send_at_hour).padStart(2, '0')}:{String(s.send_at_minute).padStart(2, '0')}
                                    </span>
                                    <span className="text-slate-500 text-xs">
                                        {s.days_of_week?.map(d => DAYS[d]).join(', ') || 'Her gün'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => toggleSchedule(s.id, s.is_active)}
                                    className={`p-2 rounded-xl transition ${s.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-slate-500 hover:bg-slate-700'}`}>
                                    {s.is_active ? <Play size={18} /> : <Pause size={18} />}
                                </button>
                                <button onClick={() => deleteSchedule(s.id)}
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
