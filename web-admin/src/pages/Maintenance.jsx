import React, { useState, useEffect } from 'react';
import { Database, Trash2, HardDrive, MessageSquare, Activity, AlertTriangle, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://backend-kj17.onrender.com'
    : '';

export default function MaintenancePage() {
    const { token } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/api/admin/maintenance/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
        } catch (err) {
            console.error("Fetch stats error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCleanup = async (type) => {
        const confirmMsg = {
            'messages': '30 günden eski mesajlar kalıcı olarak silinecek. Emin misiniz?',
            'activities': 'Sadece son 500 aktivite kaydı tutulacak, eskiler silinecek. Emin misiniz?',
            'orphaned_files': 'Reddedilmiş fotoğraflar ve dosyaları temizlenecek. Emin misiniz?'
        };

        if (!window.confirm(confirmMsg[type])) return;

        try {
            setCleaning(type);
            const res = await axios.post(`${API_URL}/api/admin/maintenance/cleanup`, { type }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResult({ type, count: res.data.count });
            fetchStats();
            setTimeout(() => setResult(null), 5000);
        } catch (err) {
            alert("Temizlik işlemi başarısız: " + err.message);
        } finally {
            setCleaning(false);
        }
    };

    if (loading && !stats) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-purple-500" size={40} /></div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-white mb-2">Bakım ve Optimizasyon</h2>
                <p className="text-slate-500 font-medium">Veritabanı ve depolama limitlerini korumak için sistemi temizleyin.</p>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-900/50 border border-white/5 rounded-[24px] p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><MessageSquare size={20} /></div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Toplam Mesaj</span>
                    </div>
                    <p className="text-3xl font-black text-white">{stats?.messages}</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-[24px] p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl"><Activity size={20} /></div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Aktivite Kaydı</span>
                    </div>
                    <p className="text-3xl font-black text-white">{stats?.activities}</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-[24px] p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><Database size={20} /></div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Dosya Sayısı</span>
                    </div>
                    <p className="text-3xl font-black text-white">{stats?.fileCount}</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-[24px] p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl"><HardDrive size={20} /></div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Depolama Alanı</span>
                    </div>
                    <p className="text-3xl font-black text-white">{stats?.totalSizeMB} <span className="text-sm font-medium text-slate-500">MB</span></p>
                </div>
            </div>

            {/* Actions Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/50 border border-white/5 rounded-[40px] p-8">
                    <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                        <Trash2 className="text-rose-500" size={24} /> Temizlik İşlemleri
                    </h3>

                    <div className="space-y-4">
                        {/* Cleanup Item 1 */}
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[24px] flex items-center justify-between group hover:border-rose-500/30 transition-all">
                            <div>
                                <h4 className="font-bold text-white mb-1">Eski Mesajları Temizle</h4>
                                <p className="text-xs text-slate-500">30 günden eski tüm sohbet geçmişini siler.</p>
                            </div>
                            <button
                                onClick={() => handleCleanup('messages')}
                                disabled={cleaning}
                                className="px-6 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
                            >
                                {cleaning === 'messages' ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Hemen Sil
                            </button>
                        </div>

                        {/* Cleanup Item 2 */}
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[24px] flex items-center justify-between group hover:border-purple-500/30 transition-all">
                            <div>
                                <h4 className="font-bold text-white mb-1">Log Kayıtlarını Optimize Et</h4>
                                <p className="text-xs text-slate-500">Sadece son 500 aktiviteyi tutar, kalanı siler.</p>
                            </div>
                            <button
                                onClick={() => handleCleanup('activities')}
                                disabled={cleaning}
                                className="px-6 py-3 bg-purple-500/10 hover:bg-purple-500 text-purple-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
                            >
                                {cleaning === 'activities' ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Optimize Et
                            </button>
                        </div>

                        {/* Cleanup Item 3 */}
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[24px] flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                            <div>
                                <h4 className="font-bold text-white mb-1">Öksüz Dosyaları Temizle</h4>
                                <p className="text-xs text-slate-500">Reddedilen fotoğrafları depolamadan siler.</p>
                            </div>
                            <button
                                onClick={() => handleCleanup('orphaned_files')}
                                disabled={cleaning}
                                className="px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
                            >
                                {cleaning === 'orphaned_files' ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Dosyaları Tara
                            </button>
                        </div>
                    </div>

                    {result && (
                        <div className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 animate-in slide-in-from-bottom-2">
                            <CheckCircle2 size={20} />
                            <span className="text-sm font-bold">{result.count} öğe başarıyla temizlendi.</span>
                        </div>
                    )}
                </div>

                {/* Info Section */}
                <div className="bg-gradient-to-br from-amber-500/20 to-slate-900 border border-amber-500/10 rounded-[40px] p-8 flex flex-col justify-center">
                    <AlertTriangle className="text-amber-500 mb-6" size={48} />
                    <h3 className="text-2xl font-black text-white mb-4 italic uppercase tracking-tighter">Dikkat</h3>
                    <div className="space-y-4 text-slate-400 text-sm font-medium">
                        <p>• Temizlik işlemleri **geri alınamaz**. Silinen veriler veritabanından kalıcı olarak kalkar.</p>
                        <p>• "Görüntü Sıkıştırma" sistemi şu an aktif. Yeni yüklenen tüm dosyalar otomatik olarak %80 oranında optimize edilmektedir.</p>
                        <p>• Ücretsiz paket limitlerinizi korumak için haftada en az bir kez bu temizliği yapmanız önerilir.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
