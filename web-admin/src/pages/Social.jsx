import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Plus, Camera, Trash2, Video, Image as ImageIcon,
    Send, User, Loader2, Calendar, Clock, Eye
} from 'lucide-react';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://backend-kj17.onrender.com/api'
    : '/api';

export default function SocialPage() {
    const [operators, setOperators] = useState([]);
    const [socialContent, setSocialContent] = useState({ stories: [], posts: [] });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('posts'); // 'posts' or 'stories'

    // Form State
    const [formData, setFormData] = useState({
        operator_id: '',
        image_url: '',
        content: ''
    });

    const fileInputRef = useRef(null);

    // DEBUG STATE
    const [debugLogs, setDebugLogs] = useState([]);
    const addLog = (msg, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setDebugLogs(prev => [`[${timestamp}] [${type}] ${msg}`, ...prev]);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            addLog('Fetching data...', 'info');
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            const [opsRes, socialRes] = await Promise.all([
                axios.get(`${API_URL}/operators`, { headers }),
                axios.get(`${API_URL}/social/explore`)
            ]);

            addLog(`Fetched ${opsRes.data.length} operators`, 'success');
            addLog(`Fetched ${socialRes.data.posts.length} posts, ${socialRes.data.stories.length} stories`, 'success');

            setOperators(opsRes.data);
            setSocialContent(socialRes.data);

            if (opsRes.data.length > 0 && !formData.operator_id) {
                setFormData(prev => ({ ...prev, operator_id: opsRes.data[0].id }));
            }
        } catch (err) {
            console.error("Fetch Data Error:", err);
            addLog(`Fetch Error: ${err.message}`, 'error');
            if (err.response) addLog(`Fetch Status: ${err.response.status}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('file', file);

        try {
            setUploading(true);
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/upload`, uploadData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            setFormData(prev => ({ ...prev, image_url: res.data.url }));
        } catch (err) {
            console.error("Upload Error:", err);
            alert('Görsel yüklenirken bir hata oluştu.');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // DEBUG: Clear logs on new attempt
        setDebugLogs([]);
        addLog(`Starting submission...`, 'info');
        addLog(`Target API: ${API_URL}`, 'info');

        if (!formData.image_url) {
            addLog('Error: Image URL is missing', 'error');
            alert('Lütfen bir görsel yükleyin veya URL girin.');
            return;
        }

        try {
            setUploading(true);
            const token = localStorage.getItem('token');
            const endpoint = activeTab === 'stories' ? '/admin/social/story' : '/admin/social/post';
            const fullUrl = `${API_URL}${endpoint}`;

            addLog(`Request URL: ${fullUrl}`, 'info');
            addLog(`Payload: ${JSON.stringify(formData)}`, 'info');

            const res = await axios.post(fullUrl, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            addLog(`Success! Status: ${res.status}`, 'success');
            addLog(`Response: ${JSON.stringify(res.data)}`, 'success');

            alert(`${activeTab === 'stories' ? 'Hikaye' : 'Post'} başarıyla paylaşıldı!`);
            setFormData(prev => ({ ...prev, image_url: '', content: '' }));
            fetchData();
        } catch (err) {
            console.error(err);
            addLog(`Error Message: ${err.message}`, 'error');
            if (err.response) {
                addLog(`Server Status: ${err.response.status}`, 'error');
                addLog(`Server Data: ${JSON.stringify(err.response.data)}`, 'error');
            } else if (err.request) {
                addLog('No response received from server (Network Error?)', 'error');
            } else {
                addLog(`Request Setup Error: ${err.message}`, 'error');
            }
            alert('Hata oluştu: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm('Bu içeriği silmek istediğinize emin misiniz?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/admin/social/${type}/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (err) {
            console.error("Delete Error:", err);
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Keşfet Yönetimi</h2>
                    <p className="text-slate-500 font-medium">Operatörler adına hikaye ve gönderi paylaşın.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Creation Form */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/10 rounded-[30px] overflow-hidden">
                        <div className="flex border-b border-white/5">
                            <button
                                onClick={() => setActiveTab('posts')}
                                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'posts' ? 'text-purple-400 bg-purple-500/5 border-b-2 border-purple-500' : 'text-slate-500 hover:text-white'}`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <ImageIcon size={14} /> Post Paylaş
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('stories')}
                                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'stories' ? 'text-pink-400 bg-pink-500/5 border-b-2 border-pink-500' : 'text-slate-500 hover:text-white'}`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Video size={14} /> Hikaye Paylaş
                                </div>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Operator Select */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-slate-500 ml-1">Paylaşacak Operatör</p>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                                    <select
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none transition-all text-white font-bold"
                                        value={formData.operator_id}
                                        onChange={(e) => setFormData({ ...formData, operator_id: e.target.value })}
                                    >
                                        {operators.map(op => (
                                            <option key={op.id} value={op.id}>{op.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Image Upload */}
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-slate-500 ml-1">Görsel</p>
                                <div
                                    onClick={() => fileInputRef.current.click()}
                                    className="group/upload relative aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-white/10 hover:border-purple-500/50 transition-all cursor-pointer bg-slate-800/30 flex flex-col items-center justify-center"
                                >
                                    {uploading ? (
                                        <Loader2 className="animate-spin text-purple-500" size={32} />
                                    ) : formData.image_url ? (
                                        <img src={formData.image_url} className="w-full h-full object-cover" alt="Preview" />
                                    ) : (
                                        <>
                                            <Camera className="text-slate-600 mb-2 group-hover/upload:text-purple-400 transition-colors" size={32} />
                                            <span className="text-[10px] font-black uppercase text-slate-500 group-hover/upload:text-purple-300">Medya Yükle</span>
                                        </>
                                    )}
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </div>
                            </div>

                            {/* Content (Only for Posts) */}
                            {activeTab === 'posts' && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase text-slate-500 ml-1">Açıklama</p>
                                    <textarea
                                        rows="4"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none font-medium"
                                        placeholder="Bir şeyler yaz..."
                                        value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={uploading || !formData.image_url}
                                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-purple-900/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {uploading ? 'İşleniyor...' : 'Hemen Paylaş'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Content List */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                        <button
                            onClick={() => setActiveTab('posts')}
                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'posts' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-900 text-slate-500'}`}
                        >
                            Gönderiler
                        </button>
                        <button
                            onClick={() => setActiveTab('stories')}
                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'stories' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20' : 'bg-slate-900 text-slate-500'}`}
                        >
                            Hikayeler
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-20">
                            <Loader2 className="animate-spin text-purple-500" size={40} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(activeTab === 'posts' ? socialContent.posts : socialContent.stories).map(item => (
                                <div key={item.id} className="group relative bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all">
                                    <div className="aspect-square relative">
                                        <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                                        <button
                                            onClick={() => handleDelete(activeTab === 'stories' ? 'story' : 'post', item.id)}
                                            className="absolute top-3 right-3 p-2 bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg backdrop-blur-md border border-rose-500/20 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>

                                        <div className="absolute bottom-4 left-4 right-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <img src={item.avatar} className="w-6 h-6 rounded-full border border-white/20" alt="" />
                                                <span className="text-xs font-bold text-white">{item.userName || item.name}</span>
                                            </div>
                                            {item.content && <p className="text-[10px] text-slate-300 line-clamp-2">{item.content}</p>}
                                            <div className="flex items-center gap-3 mt-3 opacity-60">
                                                <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase">
                                                    <Clock size={10} /> {new Date(item.created_at).toLocaleDateString()}
                                                </div>
                                                {activeTab === 'stories' && (
                                                    <div className="flex items-center gap-1 text-[8px] font-bold text-pink-400 uppercase">
                                                        <Calendar size={10} /> {new Date(item.expires_at).getHours()}:00 'da Biter
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && (activeTab === 'posts' ? socialContent.posts : socialContent.stories).length === 0 && (
                        <div className="flex flex-col items-center justify-center p-20 bg-slate-900/20 rounded-[30px] border border-dashed border-white/5">
                            <ImageIcon size={48} className="text-slate-800 mb-4" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Henüz içerik yok</p>
                        </div>
                    )}
                </div>
            </div>

            {/* DEBUG CONSOLE */}
            <div className="mt-8 p-4 bg-black text-green-400 font-mono text-xs rounded-xl border border-gray-700 h-64 overflow-y-auto shadow-2xl">
                <h3 className="font-bold border-b border-gray-700 mb-2 pb-1 text-white">DEBUG CONSOLE (For Troubleshooting)</h3>
                {debugLogs.length === 0 && <p className="opacity-50">Waiting for action...</p>}
                {debugLogs.map((log, i) => (
                    <div key={i} className={`mb-1 border-b border-white/5 pb-1 ${log.includes('[error]') ? 'text-red-400 font-bold' : log.includes('[success]') ? 'text-green-300' : 'text-gray-300'}`}>
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
}
