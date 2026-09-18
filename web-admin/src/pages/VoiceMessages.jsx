import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '');

const VoiceMessages = () => {
    const { user, token } = useAuth();
    const [voiceMessages, setVoiceMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [title, setTitle] = useState('');
    const [audioFile, setAudioFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

    const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    useEffect(() => {
        fetchVoiceMessages();
    }, []);

    const fetchVoiceMessages = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/voice-messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setVoiceMessages(res.data);
            setIsLoading(false);
        } catch (err) {
            console.error('Error fetching voice messages:', err);
            setError('Sesli mesajlar yüklenirken bir hata oluştu.');
            setIsLoading(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setAudioFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!title || !audioFile) {
            setError('Lütfen bir başlık girin ve bir ses dosyası seçin.');
            return;
        }

        setIsUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('title', title);
        formData.append('audio', audioFile);

        try {
            await axios.post(`${API_URL}/api/admin/voice-messages`, formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setTitle('');
            setAudioFile(null);
            document.getElementById('audio-upload-input').value = '';
            fetchVoiceMessages();
        } catch (err) {
            console.error('Error uploading voice message:', err);
            setError(err.response?.data?.error || 'Ses dosyası yüklenemedi.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu sesli mesajı silmek istediğinize emin misiniz?')) return;

        try {
            await axios.delete(`${API_URL}/api/admin/voice-messages/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchVoiceMessages();
        } catch (err) {
            console.error('Error deleting voice message:', err);
            alert('Mesaj silinirken bir hata oluştu.');
        }
    };

    if (!isSuperAdmin) {
        return (
            <div className="p-6 md:p-10 max-w-7xl mx-auto">
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                    <p className="text-red-400 font-medium">Bu sayfayı görüntüleme yetkiniz yok.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
            <div className="mb-10">
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 tracking-tight mb-3">
                    Sesli Mesajlar
                </h1>
                <p className="text-slate-400 text-lg">
                    Sohbetlerde kullanılabilecek hazır sesli mesajları yönetin.
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-8">
                    {error}
                </div>
            )}

            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 md:p-8 mb-10 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Yeni Sesli Mesaj Yükle
                </h2>
                
                <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                    <div className="md:col-span-5">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Başlık (Örn: Tanışma 1)</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            placeholder="Mesaj başlığı..."
                            required
                        />
                    </div>
                    <div className="md:col-span-5">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Ses Dosyası (.mp3, .m4a vb.)</label>
                        <input
                            type="file"
                            id="audio-upload-input"
                            accept="audio/*"
                            onChange={handleFileChange}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 transition-all cursor-pointer"
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="w-full h-[52px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                            {isUploading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    Yükle
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Kayıtlı Sesli Mesajlar
                    </h2>
                </div>

                {isLoading ? (
                    <div className="p-12 flex justify-center">
                        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                ) : voiceMessages.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        Henüz hiç sesli mesaj yüklenmemiş.
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {voiceMessages.map(msg => (
                            <div key={msg.id} className="p-6 flex flex-col md:flex-row items-center gap-6 hover:bg-white/[0.02] transition-colors group">
                                <div className="flex-1 min-w-0 w-full">
                                    <h3 className="text-lg font-bold text-slate-200 mb-2 truncate">{msg.title}</h3>
                                    <audio controls className="w-full h-10 max-w-md">
                                        <source src={msg.audio_url} />
                                        Tarayıcınız ses oynatmayı desteklemiyor.
                                    </audio>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-slate-500 shrink-0">
                                    <span>{new Date(msg.created_at).toLocaleDateString('tr-TR')}</span>
                                    <button
                                        onClick={() => handleDelete(msg.id)}
                                        className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                                        title="Sil"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceMessages;
