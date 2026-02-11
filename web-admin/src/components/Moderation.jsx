import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Check, X, Clock, User } from 'lucide-react';

const API_URL = window.location.origin + '/api';

export default function Moderation() {
    const [pendingPhotos, setPendingPhotos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPending();
    }, []);

    const fetchPending = async () => {
        try {
            const res = await axios.get(`${API_URL}/moderation/pending`);
            setPendingPhotos(res.data);
        } catch (error) {
            console.error('Error fetching pending photos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (photoId, action) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Oturum süreniz dolmuş veya giriş yapmadınız. Lütfen tekrar giriş yapın.');
                return;
            }

            await axios.post(`${API_URL}/moderation/${action}`, { photoId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Remove from list
            setPendingPhotos(pendingPhotos.filter(p => p.id !== photoId));
            alert(`${action === 'approve' ? 'Kabul edildi' : 'Reddedildi'}!`);
        } catch (error) {
            console.error(`Error during ${action}:`, error);
            alert(`İşlem başarısız: ${error.response?.data?.error || error.message}`);
        }
    };

    if (loading) return <div className="p-8">Yükleniyor...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold">Fotoğraf Moderasyonu</h2>
                    <p className="text-gray-400 mt-2">Bekleyen {pendingPhotos.length} fotoğraf var.</p>
                </div>
                <button
                    onClick={fetchPending}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                    <Clock size={20} className="text-gray-400" />
                </button>
            </div>

            {pendingPhotos.length === 0 ? (
                <div className="card flex flex-col items-center justify-center p-20 text-gray-500">
                    <Check size={48} className="mb-4 opacity-20" />
                    <p>Şu an bekleyen fotoğraf bulunmuyor.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {pendingPhotos.map((photo) => (
                        <div key={photo.id} className="card overflow-hidden flex flex-col">
                            <div className="relative aspect-square">
                                <img
                                    src={photo.url}
                                    alt="Moderation"
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-bold uppercase tracking-wider">
                                    {photo.type === 'avatar' ? 'Profil' : 'Albüm'}
                                </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <User size={16} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{photo.username}</p>
                                        <p className="text-[10px] text-gray-500">
                                            {new Date(photo.created_at).toLocaleString('tr-TR')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-auto">
                                    <button
                                        onClick={() => handleAction(photo.id, 'approve')}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg transition-all font-bold text-sm"
                                    >
                                        <Check size={16} />
                                        Kabul Et
                                    </button>
                                    <button
                                        onClick={() => handleAction(photo.id, 'reject')}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all font-bold text-sm"
                                    >
                                        <X size={16} />
                                        Reddet
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
