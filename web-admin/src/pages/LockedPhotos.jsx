import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Lock,
    Upload,
    Trash2,
    Check,
    X,
    Play,
    Power,
    Settings2,
    Send,
    TrendingUp,
    Eye,
    AlertCircle,
    Coins,
    Clock,
    Sparkles,
    Edit2,
    Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = '';

const formatDateTimeTR = (val) => {
    if (!val) return '-';
    try {
        return new Date(val).toLocaleString('tr-TR', {
            timeZone: 'Europe/Istanbul',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return val;
    }
};

const formatMinuteToHHMM = (mins) => {
    const m = Math.max(0, Math.min(1439, Number(mins || 0)));
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return `${hh}:${mm}`;
};

const triggerBadge = (trigger) => {
    if (trigger === 'evening_offline_push') {
        return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                Pasif Push
            </span>
        );
    }
    if (trigger === 'manual_test') {
        return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25">
                Test
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25">
            Akşam Aktif
        </span>
    );
};

export default function LockedPhotos() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [photos, setPhotos] = useState([]);
    const [summary, setSummary] = useState({});
    const [settings, setSettings] = useState(null);
    const [status, setStatus] = useState(null);
    const [recentDeliveries, setRecentDeliveries] = useState([]);

    // Upload form state (supports multi-image upload)
    const [files, setFiles] = useState([]);
    const [title, setTitle] = useState('');
    const [unlockCost, setUnlockCost] = useState(100);
    const [preMessage, setPreMessage] = useState('');
    const [uploading, setUploading] = useState(false);

    // Inline photo edit state
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ title: '', unlock_cost: 100, pre_message: '' });

    // Settings editor
    const [showSettings, setShowSettings] = useState(false);
    const [settingsForm, setSettingsForm] = useState(null);
    const [savingSettings, setSavingSettings] = useState(false);

    // Manual test & sweep
    const [testTarget, setTestTarget] = useState('');
    const [testPhotoId, setTestPhotoId] = useState('');
    const [testing, setTesting] = useState(false);
    const [runningSweep, setRunningSweep] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const authHeaders = { Authorization: `Bearer ${token}` };

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/locked-photos`, { headers: authHeaders });
            setPhotos(res.data.photos || []);
            setSummary(res.data.summary || {});
            setSettings(res.data.settings || null);
            setSettingsForm(res.data.settings || null);
            setStatus(res.data.status || null);
            setRecentDeliveries(res.data.recentDeliveries || []);
        } catch (err) {
            console.error('Fetch locked photos error:', err);
            setFeedback({ type: 'error', text: err.response?.data?.error || 'Veriler yüklenemedi.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!files || files.length === 0) {
            setFeedback({ type: 'error', text: 'Lütfen en az bir fotoğraf seçin.' });
            return;
        }

        setUploading(true);
        setFeedback(null);
        try {
            const uploadedItems = [];
            for (let i = 0; i < files.length; i += 1) {
                const f = files[i];
                const fd = new FormData();
                fd.append('file', f);
                const upRes = await axios.post(`${API_URL}/api/media-upload`, fd, {
                    headers: {
                        ...authHeaders,
                        'Content-Type': 'multipart/form-data',
                    },
                });
                const url = upRes.data?.url;
                if (url) {
                    const itemTitle = title
                        ? (files.length > 1 ? `${title.trim()} #${i + 1}` : title.trim())
                        : f.name.replace(/\.[^.]+$/, '');
                    uploadedItems.push({
                        title: itemTitle,
                        image_url: url,
                        unlock_cost: Math.max(1, parseInt(unlockCost, 10) || 100),
                        pre_message: preMessage.trim() || null,
                        is_active: true,
                    });
                }
            }

            if (uploadedItems.length === 0) {
                throw new Error('Fotoğraflar yüklenemedi.');
            }

            await axios.post(
                `${API_URL}/api/admin/locked-photos`,
                { items: uploadedItems },
                { headers: authHeaders }
            );

            setFiles([]);
            setTitle('');
            setPreMessage('');
            const input = document.getElementById('locked-photo-file-input');
            if (input) input.value = '';
            setFeedback({ type: 'success', text: `${uploadedItems.length} kilitli fotoğraf havuza eklendi.` });
            fetchData();
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.error || err.message || 'Yükleme hatası.' });
        } finally {
            setUploading(false);
        }
    };

    const togglePhotoActive = async (photo) => {
        try {
            await axios.patch(
                `${API_URL}/api/admin/locked-photos/${photo.id}`,
                { is_active: !photo.is_active },
                { headers: authHeaders }
            );
            fetchData();
        } catch (err) {
            setFeedback({ type: 'error', text: 'Durum güncellenemedi.' });
        }
    };

    const startEdit = (photo) => {
        setEditingId(photo.id);
        setEditForm({
            title: photo.title || '',
            unlock_cost: photo.unlock_cost || 100,
            pre_message: photo.pre_message || '',
        });
    };

    const saveEdit = async (id) => {
        try {
            await axios.patch(
                `${API_URL}/api/admin/locked-photos/${id}`,
                {
                    title: editForm.title,
                    unlock_cost: Math.max(1, parseInt(editForm.unlock_cost, 10) || 100),
                    pre_message: editForm.pre_message,
                },
                { headers: authHeaders }
            );
            setEditingId(null);
            fetchData();
        } catch (err) {
            setFeedback({ type: 'error', text: 'Fotoğraf güncellenemedi.' });
        }
    };

    const deletePhoto = async (id) => {
        if (!window.confirm('Bu fotoğrafı havuzdan silmek istediğinize emin misiniz?')) return;
        try {
            await axios.delete(`${API_URL}/api/admin/locked-photos/${id}`, { headers: authHeaders });
            fetchData();
        } catch (err) {
            setFeedback({ type: 'error', text: 'Fotoğraf silinemedi.' });
        }
    };

    const toggleSystemEnabled = async () => {
        if (!settings) return;
        try {
            const res = await axios.put(
                `${API_URL}/api/admin/locked-photos/settings`,
                { is_enabled: !settings.is_enabled },
                { headers: authHeaders }
            );
            setSettings(res.data);
            setSettingsForm(res.data);
            setFeedback({
                type: 'success',
                text: res.data.is_enabled ? 'Kilitli fotoğraf otomasyonu aktifleştirildi.' : 'Kilitli fotoğraf otomasyonu duraklatıldı.',
            });
        } catch (err) {
            setFeedback({ type: 'error', text: 'Ayar değiştirilemedi.' });
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        if (!settingsForm) return;
        setSavingSettings(true);
        try {
            const res = await axios.put(
                `${API_URL}/api/admin/locked-photos/settings`,
                settingsForm,
                { headers: authHeaders }
            );
            setSettings(res.data);
            setSettingsForm(res.data);
            setShowSettings(false);
            setFeedback({ type: 'success', text: 'Otomasyon ayarları kaydedildi.' });
            fetchData();
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.error || 'Ayarlar kaydedilemedi.' });
        } finally {
            setSavingSettings(false);
        }
    };

    const handleRunSweep = async () => {
        setRunningSweep(true);
        setFeedback(null);
        try {
            const res = await axios.post(`${API_URL}/api/admin/locked-photos/run-sweep`, {}, { headers: authHeaders });
            const r = res.data?.result || {};
            if (r.skipped) {
                setFeedback({ type: 'info', text: `Tarama atlandı (${r.skipped}).` });
            } else {
                setFeedback({
                    type: 'success',
                    text: `Tarama tamamlandı: ${r.activeSent || 0} aktif, ${r.offlineSent || 0} pasif kullanıcıya gönderildi.`,
                });
            }
            fetchData();
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.error || 'Tarama çalıştırılamadı.' });
        } finally {
            setRunningSweep(false);
        }
    };

    const handleTestSend = async (e) => {
        e.preventDefault();
        if (!testTarget.trim()) return;
        setTesting(true);
        setFeedback(null);
        try {
            const res = await axios.post(
                `${API_URL}/api/admin/locked-photos/test-send`,
                {
                    target: testTarget.trim(),
                    photoId: testPhotoId || null,
                },
                { headers: authHeaders }
            );
            const r = res.data?.result || {};
            setFeedback({
                type: 'success',
                text: `Test başlatıldı (${res.data?.targetUser?.username}): "${r.preMessageText}" ön mesajı atıldı, ${(r.delayMs / 1000).toFixed(1)} sn sonra kilitli foto gidecek.`,
            });
            setTestTarget('');
            setTimeout(fetchData, 6500);
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.error || 'Test gönderimi başarısız.' });
        } finally {
            setTesting(false);
        }
    };

    const totalSent = Number(summary.total_sent || 0);
    const totalUnlocks = Number(summary.total_unlocks || 0);
    const totalConversions = Number(summary.total_conversions || 0);
    const unlockPct = totalSent > 0 ? ((totalUnlocks / totalSent) * 100).toFixed(1) : '0.0';
    const convPct = totalSent > 0 ? ((totalConversions / totalSent) * 100).toFixed(1) : '0.0';

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-screen space-y-8">
            {/* Header & Quick Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
                            <Lock size={22} className="text-white" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                            Kilitli Foto Havuzu
                        </h1>
                    </div>
                    <p className="text-slate-400 text-sm md:text-base">
                        Akşam 19:00 sonrası coin almayan aktiflere ve gündüz girip dönmeyen pasiflere ön-mesaj + gecikmeli kilitli fotoğraf otomasyonu.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {status && (
                        <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs flex items-center gap-2">
                            <Clock size={14} className="text-blue-400" />
                            <span className="text-slate-300 font-semibold">
                                TR {String(status.istanbulHour).padStart(2, '0')}:{String(status.istanbulMinute).padStart(2, '0')}
                            </span>
                            {status.inEveningActiveWindow ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold">Akşam Aktif Açık</span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">Aktif Pencere Bekliyor</span>
                            )}
                            {status.inOfflinePushWindow && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold">Push Penceresi Açık</span>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={toggleSystemEnabled}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 border transition-all ${
                            settings?.is_enabled
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                        }`}
                    >
                        <Power size={15} />
                        {settings?.is_enabled ? 'Otomasyon Açık' : 'Otomasyon Kapalı'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all"
                    >
                        <Settings2 size={15} />
                        Ayarlar
                    </button>

                    <button
                        type="button"
                        onClick={handleRunSweep}
                        disabled={runningSweep}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {runningSweep ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                        Şimdi Tara
                    </button>
                </div>
            </div>

            {feedback && (
                <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-medium ${
                        feedback.type === 'error'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            : feedback.type === 'info'
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <AlertCircle size={17} />
                        <span>{feedback.text}</span>
                    </div>
                    <button type="button" onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Settings Collapsible */}
            {showSettings && settingsForm && (
                <form
                    onSubmit={handleSaveSettings}
                    className="bg-slate-900/70 border border-white/10 rounded-3xl p-6 space-y-5 backdrop-blur-xl"
                >
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Settings2 size={18} className="text-blue-400" />
                            Otomasyon & Çakışma Ayarları (TR Saati)
                        </h2>
                        <button type="button" onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                            <label className="block text-slate-400 mb-1.5 font-semibold">Varsayılan Fiyat (Coin)</label>
                            <input
                                type="number"
                                min="1"
                                value={settingsForm.default_unlock_cost}
                                onChange={(e) => setSettingsForm({ ...settingsForm, default_unlock_cost: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-1.5 font-semibold">Günlük Limit (Kullanıcı Başı)</label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                value={settingsForm.daily_cap}
                                onChange={(e) => setSettingsForm({ ...settingsForm, daily_cap: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-1.5 font-semibold">Aktif Başlangıç Saati (0-23)</label>
                            <input
                                type="number"
                                min="0"
                                max="23"
                                value={settingsForm.active_start_hour}
                                onChange={(e) => setSettingsForm({ ...settingsForm, active_start_hour: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-1.5 font-semibold">Aktif Bitiş Saati (0-23)</label>
                            <input
                                type="number"
                                min="0"
                                max="23"
                                value={settingsForm.active_end_hour}
                                onChange={(e) => setSettingsForm({ ...settingsForm, active_end_hour: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-1.5 font-semibold">Pasif Min. Süre (Saat)</label>
                            <input
                                type="number"
                                min="1"
                                max="72"
                                value={settingsForm.min_inactive_hours}
                                onChange={(e) => setSettingsForm({ ...settingsForm, min_inactive_hours: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-1.5 font-semibold">Pasif Max. Süre (Gün)</label>
                            <input
                                type="number"
                                min="1"
                                max="90"
                                value={settingsForm.max_inactive_days}
                                onChange={(e) => setSettingsForm({ ...settingsForm, max_inactive_days: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-1.5 font-semibold">Numara Hook Bekleme (Saat)</label>
                            <input
                                type="number"
                                min="1"
                                max="72"
                                value={settingsForm.numara_cooldown_hours}
                                onChange={(e) => setSettingsForm({ ...settingsForm, numara_cooldown_hours: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-1.5 font-semibold">Push Penceresi (TR)</label>
                            <div className="px-3 py-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-slate-300">
                                {formatMinuteToHHMM(settingsForm.offline_start_minute)} – {formatMinuteToHHMM(settingsForm.offline_end_minute)}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={savingSettings}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2"
                        >
                            {savingSettings ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                            Ayarları Kaydet
                        </button>
                    </div>
                </form>
            )}

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Aktif Havuz</p>
                    <p className="text-2xl font-black text-white mt-2">
                        {summary.active_photos || 0} <span className="text-sm text-slate-500 font-semibold">/ {summary.total_photos || 0}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Bugün gönderilen: {summary.today_sent || 0}</p>
                </div>
                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Toplam Gönderim</p>
                    <p className="text-2xl font-black text-blue-400 mt-2">{totalSent}</p>
                    <p className="text-xs text-slate-500 mt-1">Ön-mesaj + kilitli foto</p>
                </div>
                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bakiye Yetersiz Tık</p>
                    <p className="text-2xl font-black text-amber-400 mt-2">{summary.total_insufficient_hits || 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Açmaya çalışıp mağazaya düşen</p>
                </div>
                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Açılan Foto</p>
                    <p className="text-2xl font-black text-emerald-400 mt-2">
                        {totalUnlocks} <span className="text-xs text-emerald-500/80 font-bold">(%{unlockPct})</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Kilidi coinle açılan</p>
                </div>
                <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Satışa Dönüş</p>
                    <p className="text-2xl font-black text-white mt-2">
                        {totalConversions} <span className="text-xs text-emerald-400 font-bold">(%{convPct})</span>
                    </p>
                    <p className="text-xs text-emerald-400/80 font-semibold mt-1">
                        {Number(summary.total_revenue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </p>
                </div>
            </div>

            {/* Add Photos + Manual Test Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form
                    onSubmit={handleUploadSubmit}
                    className="lg:col-span-2 bg-slate-900/60 border border-white/5 rounded-3xl p-6 space-y-5"
                >
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Upload size={18} className="text-rose-400" />
                        Havuza Kilitli Fotoğraf Ekle (Tekli veya Çoklu)
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Fotoğraf Dosyaları *</label>
                            <input
                                id="locked-photo-file-input"
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-rose-500/20 file:text-rose-300 file:font-bold cursor-pointer"
                            />
                            {files.length > 0 && (
                                <p className="text-[11px] text-emerald-400 mt-1">{files.length} dosya seçildi</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Başlık / Etiket (Opsiyonel)</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Örn: Ayna karşısı ev hali"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kilit Açma Ücreti (Coin)</label>
                            <input
                                type="number"
                                min="1"
                                value={unlockCost}
                                onChange={(e) => setUnlockCost(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                                Özel Ön Mesaj (Boşsa doğal havuzdan seçilir)
                            </label>
                            <input
                                type="text"
                                value={preMessage}
                                onChange={(e) => setPreMessage(e.target.value)}
                                placeholder="Örn: az önce çektim sadece sen gör diye kilitledim"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={uploading}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-rose-500/20 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {uploading ? 'Yükleniyor...' : 'Havuza Ekle'}
                        </button>
                    </div>
                </form>

                {/* Manual Test Box */}
                <form
                    onSubmit={handleTestSend}
                    className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 flex flex-col justify-between space-y-4"
                >
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Send size={18} className="text-blue-400" />
                            Canlı Test Gönderimi
                        </h2>
                        <p className="text-xs text-slate-400">
                            Kendi test hesabınıza ön-mesaj + 5-12 sn gecikmeli kilitli fotoğraf akışını hemen test edin.
                        </p>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Kullanıcı Adı veya ID</label>
                            <input
                                type="text"
                                value={testTarget}
                                onChange={(e) => setTestTarget(e.target.value)}
                                placeholder="username veya user ID..."
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Fotoğraf (Opsiyonel)</label>
                            <select
                                value={testPhotoId}
                                onChange={(e) => setTestPhotoId(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                            >
                                <option value="">Havuzdan Rastgele Seç</option>
                                {photos.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        #{p.id} - {p.title || 'Fotoğraf'} ({p.unlock_cost} coin)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={testing || photos.length === 0}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Test Gönder
                    </button>
                </form>
            </div>

            {/* Pool Grid with Per-Photo Metrics */}
            <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6">
                <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-400" />
                    Fotoğraf Performansı ({photos.length})
                </h2>

                {loading ? (
                    <div className="py-12 flex justify-center">
                        <Loader2 size={28} className="animate-spin text-blue-400" />
                    </div>
                ) : photos.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">
                        Henüz havuzda kilitli fotoğraf yok. Yukarıdan 5-10 doğal fotoğraf yükleyerek başlatabilirsiniz.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {photos.map((photo) => {
                            const s = Number(photo.sent_count || 0);
                            const u = Number(photo.unlock_count || 0);
                            const c = Number(photo.purchase_conversion_count || 0);
                            const uRate = s > 0 ? ((u / s) * 100).toFixed(1) : '0.0';
                            const cRate = s > 0 ? ((c / s) * 100).toFixed(1) : '0.0';
                            const isEditing = editingId === photo.id;

                            return (
                                <div
                                    key={photo.id}
                                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-all ${
                                        photo.is_active
                                            ? 'bg-slate-950/70 border-white/10'
                                            : 'bg-slate-950/30 border-white/5 opacity-60'
                                    }`}
                                >
                                    <div className="flex gap-4">
                                        <img
                                            src={photo.image_url}
                                            alt={photo.title || `Foto #${photo.id}`}
                                            className="w-24 h-28 object-cover rounded-xl border border-white/10 shrink-0 bg-slate-900"
                                        />
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <input
                                                        type="text"
                                                        value={editForm.title}
                                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                        placeholder="Başlık"
                                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={editForm.unlock_cost}
                                                        onChange={(e) => setEditForm({ ...editForm, unlock_cost: e.target.value })}
                                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editForm.pre_message}
                                                        onChange={(e) => setEditForm({ ...editForm, pre_message: e.target.value })}
                                                        placeholder="Özel ön mesaj (opsiyonel)"
                                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className="text-sm font-bold text-white truncate">
                                                            #{photo.id} {photo.title || 'Kilitli Fotoğraf'}
                                                        </p>
                                                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 text-xs font-black shrink-0 flex items-center gap-1">
                                                            <Coins size={12} /> {photo.unlock_cost}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                                                        {photo.pre_message ? `"${photo.pre_message}"` : 'Ön mesaj: Rastgele doğal havuz'}
                                                    </p>
                                                </>
                                            )}

                                            <div className="grid grid-cols-2 gap-1.5 mt-3 text-[11px]">
                                                <div className="bg-white/5 rounded-lg px-2 py-1">
                                                    <span className="text-slate-500">Gönderim:</span>{' '}
                                                    <span className="text-white font-bold">{s}</span>
                                                </div>
                                                <div className="bg-white/5 rounded-lg px-2 py-1">
                                                    <span className="text-slate-500">Yetersiz Tık:</span>{' '}
                                                    <span className="text-amber-300 font-bold">{photo.insufficient_hits || 0}</span>
                                                </div>
                                                <div className="bg-white/5 rounded-lg px-2 py-1">
                                                    <span className="text-slate-500">Açılma:</span>{' '}
                                                    <span className="text-emerald-300 font-bold">{u} (%{uRate})</span>
                                                </div>
                                                <div className="bg-emerald-500/10 rounded-lg px-2 py-1">
                                                    <span className="text-emerald-300/70">Satış:</span>{' '}
                                                    <span className="text-emerald-300 font-bold">{c} (%{cRate})</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <span className="text-[11px] text-slate-400 font-semibold">
                                            Gelir:{' '}
                                            <span className="text-emerald-400 font-bold">
                                                {Number(photo.conversion_revenue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                            </span>
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => saveEdit(photo.id)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                                                    >
                                                        <Check size={13} /> Kaydet
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingId(null)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-white/10 text-slate-300 text-xs"
                                                    >
                                                        İptal
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => togglePhotoActive(photo)}
                                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                                                            photo.is_active
                                                                ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                    >
                                                        {photo.is_active ? 'Aktif' : 'Pasif'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => startEdit(photo)}
                                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                                                        title="Düzenle"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deletePhoto(photo.id)}
                                                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                                                        title="Sil"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Recent Deliveries Log */}
            <div className="bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Eye size={18} className="text-indigo-400" />
                        Son Otomatik Gönderimler (Son 30)
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-white/5 text-slate-500 uppercase tracking-wider">
                                <th className="py-3.5 px-4">Tarih</th>
                                <th className="py-3.5 px-4">Kullanıcı</th>
                                <th className="py-3.5 px-4">Operatör</th>
                                <th className="py-3.5 px-4">Tetikleyici</th>
                                <th className="py-3.5 px-4">Ön Mesaj</th>
                                <th className="py-3.5 px-4">Foto</th>
                                <th className="py-3.5 px-4">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {recentDeliveries.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-500">
                                        Henüz otomatik gönderim kaydı yok.
                                    </td>
                                </tr>
                            ) : (
                                recentDeliveries.map((d) => (
                                    <tr key={d.id} className="hover:bg-white/[0.02]">
                                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{formatDateTimeTR(d.created_at)}</td>
                                        <td className="py-3 px-4 font-bold text-white">
                                            {d.user_name || d.user_username || d.user_id}
                                        </td>
                                        <td className="py-3 px-4 text-slate-300">{d.operator_name || '-'}</td>
                                        <td className="py-3 px-4">{triggerBadge(d.trigger_type)}</td>
                                        <td className="py-3 px-4 text-slate-400 max-w-[220px] truncate">{d.pre_message_text}</td>
                                        <td className="py-3 px-4 text-slate-300">
                                            #{d.photo_id} ({d.unlock_cost} coin)
                                        </td>
                                        <td className="py-3 px-4">
                                            {d.converted_to_purchase ? (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-bold">
                                                    Satış ({Number(d.converted_amount || 0).toFixed(0)} ₺)
                                                </span>
                                            ) : d.is_unlocked ? (
                                                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-bold">
                                                    Açıldı
                                                </span>
                                            ) : d.insufficient_funds_hit_at ? (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold">
                                                    Bakiye Yetersiz
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">Bekliyor</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

