import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Search, Edit3, Trash2, Save, X, Clock, Quote } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function QuickRepliesPage() {
    const { token, user } = useAuth();
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingReply, setEditingReply] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        content: ''
    });

    const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

    useEffect(() => {
        fetchReplies();
    }, []);

    const fetchReplies = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/quick-replies`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) setReplies(data);
        } catch (err) {
            console.error("Fetch quick replies error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const method = editingReply ? 'PUT' : 'POST';
        const url = editingReply ? `${API_URL}/api/admin/quick-replies/${editingReply.id}` : `${API_URL}/api/admin/quick-replies`;

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
            setEditingReply(null);
            setFormData({ title: '', content: '' });
            fetchReplies();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu hızlı cevabı silmek istediğinize emin misiniz?')) return;
        try {
            await fetch(`${API_URL}/api/admin/quick-replies/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchReplies();
        } catch (err) {
            alert('Silme başarısız');
        }
    };

    const openEdit = (reply) => {
        setEditingReply(reply);
        setFormData({ title: reply.title, content: reply.content });
        setShowModal(true);
    };

    const filteredReplies = replies.filter(r =>
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isAdmin = ['admin', 'super_admin'].includes(user?.role);

    if (loading) return <div className="p-8 text-white font-bold italic">Yükleniyor...</div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Hızlı Cevaplar</h2>
                    <p className="text-slate-500 font-medium">Operatörler için hazır mesaj taslaklarını yönetin.</p>
                </div>

                {isAdmin && (
                    <button
                        onClick={() => {
                            setEditingReply(null);
                            setFormData({ title: '', content: '' });
                            setShowModal(true);
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-900/20 flex items-center gap-2"
                    >
                        <Plus size={18} /> Yeni Taslak Ekle
                    </button>
                )}
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                    type="text"
                    placeholder="Mesajlarda ara..."
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-purple-500 transition-all font-medium"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReplies.map((reply) => (
                    <div key={reply.id} className="group relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-[32px] blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[30px] p-8 hover:border-white/10 transition-all flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl">
                                    <Quote size={20} />
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEdit(reply)} className="p-2 bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-500 rounded-xl transition-all"><Edit3 size={16} /></button>
                                        <button onClick={() => handleDelete(reply.id)} className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded-xl transition-all"><Trash2 size={16} /></button>
                                    </div>
                                )}
                            </div>

                            <h4 className="text-lg font-black text-white mb-2 uppercase tracking-tight italic group-hover:text-purple-400 transition-colors uppercase">{reply.title}</h4>
                            <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6 flex-1 italic">"{reply.content}"</p>

                            <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5 line-clamp-1 truncate mr-2 max-w-[120px]">
                                    <Clock size={12} /> {new Date(reply.created_at).toLocaleDateString()}
                                </span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(reply.content);
                                        // Optional: Add a toast notification here
                                    }}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[10px] font-black text-white uppercase tracking-widest rounded-xl transition-all"
                                >
                                    Kopyala
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredReplies.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white/5 rounded-[40px] border-2 border-dashed border-white/5">
                        <MessageSquare size={48} className="mx-auto text-slate-700 mb-4" />
                        <p className="text-slate-500 font-black uppercase tracking-widest italic">Hazır cevap bulunamadı</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-[32px] p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                                {editingReply ? 'Taslağı Düzenle' : 'Yeni Mesaj Taslağı'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Taslak Başlığı</label>
                                <input
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Örn: Selamlama"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Mesaj İçeriği</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-purple-500 transition-all font-bold h-32 resize-none"
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Örn: Merhaba, size nasıl yardımcı olabilirim?"
                                    required
                                />
                            </div>

                            <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-purple-900/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                <Save size={18} /> {editingReply ? 'Güncelle' : 'Kaydet'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
