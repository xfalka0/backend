import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, CheckCircle, AlertCircle, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = '';

export default function Notifications() {
    const { token } = useAuth();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [target, setTarget] = useState('all');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => { fetchHistory(); }, []);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch(`${API_URL}/admin/notifications/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setHistory(await res.json());
        } catch (e) { }
        setLoadingHistory(false);
    };

    const handleSend = async () => {
        if (!title.trim() || !body.trim()) return;
        setSending(true);
        setResult(null);
        try {
            const res = await fetch(`${API_URL}/admin/notifications/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ title, body, target })
            });
            const data = await res.json();
            setResult({ success: res.ok, message: data.message || (res.ok ? 'Bildirim gönderildi!' : 'Hata oluştu.'), count: data.sent_count });
            if (res.ok) {
                setTitle(''); setBody('');
                setTimeout(fetchHistory, 1000);
            }
        } catch (e) {
            setResult({ success: false, message: 'Sunucu hatası.' });
        }
        setSending(false);
    };

    const templates = [
        { emoji: '💌', text: 'Yeni bir mesajın var! Hemen kontrol et.', title: 'Yeni Mesaj!' },
        { emoji: '🔥', text: 'Seni bekleyen profiller var! Şimdi keşfet.', title: 'Keşfet!' },
        { emoji: '🎁', text: 'Bugüne özel %50 bonus coin fırsatını kaçırma!', title: 'Özel Teklif!' },
        { emoji: '💫', text: 'Profilini tamamla, 100 coin kazan!', title: 'Profil Tamamla' },
    ];

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-black text-white">Push Bildirim Yönetimi</h1>
                <p className="text-slate-500 mt-1">Tüm kullanıcılara anlık bildirim gönder</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Compose */}
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Bell size={18} className="text-purple-400" /> Bildirim Oluştur
                    </h2>

                    <div>
                        <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Başlık</label>
                        <input value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Bildirim başlığı..."
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition" />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Mesaj</label>
                        <textarea value={body} onChange={e => setBody(e.target.value)}
                            placeholder="Bildirim içeriği..."
                            rows={4}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition resize-none" />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">Hedef Kitle</label>
                        <select value={target} onChange={e => setTarget(e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition">
                            <option value="all">Tüm Kullanıcılar</option>
                            <option value="kadin">Kadın Kullanıcılar</option>
                            <option value="erkek">Erkek Kullanıcılar</option>
                            <option value="inactive">Son 7 Günde Girmeyen</option>
                        </select>
                    </div>

                    {result && (
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                            {result.success ? <CheckCircle size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
                            <span className={`text-sm font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                                {result.message}{result.count ? ` (${result.count} kullanıcı)` : ''}
                            </span>
                        </div>
                    )}

                    <button onClick={handleSend} disabled={sending || !title || !body}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition">
                        {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                        {sending ? 'Gönderiliyor...' : 'Bildirimi Gönder'}
                    </button>
                </div>

                {/* Templates */}
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Plus size={18} className="text-pink-400" /> Hazır Şablonlar
                    </h2>
                    <div className="space-y-3">
                        {templates.map((tmpl, i) => (
                            <button key={i} onClick={() => { setTitle(tmpl.title); setBody(tmpl.text); }}
                                className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-white/5 hover:border-purple-500/30 rounded-xl p-4 transition group">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{tmpl.emoji}</span>
                                    <div>
                                        <p className="text-white font-semibold text-sm group-hover:text-purple-300 transition">{tmpl.title}</p>
                                        <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{tmpl.text}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Preview */}
                    {(title || body) && (
                        <div className="mt-4 bg-slate-800 rounded-xl p-4 border border-purple-500/20">
                            <p className="text-xs text-purple-400 mb-2 uppercase tracking-wider">Önizleme</p>
                            <div className="bg-slate-700 rounded-lg p-3 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center">
                                    <Bell size={14} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-white text-sm font-bold">{title || 'Başlık'}</p>
                                    <p className="text-slate-300 text-xs mt-0.5">{body || 'Mesaj içeriği...'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* History */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4">Gönderim Geçmişi</h2>
                {loadingHistory ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />)}</div>
                ) : history.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-8">Henüz bildirim gönderilmedi.</p>
                ) : (
                    <div className="space-y-2">
                        {history.map((n, i) => (
                            <div key={i} className="flex items-center gap-4 bg-slate-800 rounded-xl px-4 py-3">
                                <Bell size={16} className="text-purple-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-semibold text-sm truncate">{n.title}</p>
                                    <p className="text-slate-400 text-xs truncate">{n.body}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-slate-400 text-xs">{new Date(n.sent_at).toLocaleDateString('tr-TR')}</p>
                                    <p className="text-purple-400 text-xs font-bold">{n.sent_count} kişi</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
