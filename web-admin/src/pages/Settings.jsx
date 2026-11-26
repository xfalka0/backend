import React, { useState, useEffect } from 'react';
import {
    Mail, Bell, Clock, AlertTriangle, CheckCircle2, Send, Save,
    Server, ShieldAlert, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function SettingsPage() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [form, setForm] = useState({
        alert_revenue_drop_pct: 50,
        alert_signup_spike_mult: 3,
        alert_pending_support_limit: 20,
    });
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [previewMode, setPreviewMode] = useState('text'); // 'text' | 'html'

    const headers = { Authorization: `Bearer ${token}` };

    const fetchStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/alerts/status`, { headers });
            if (res.ok) {
                const json = await res.json();
                setData(json);
                if (json.health?.settings) {
                    setForm({
                        alert_revenue_drop_pct: json.health.settings.alert_revenue_drop_pct,
                        alert_signup_spike_mult: json.health.settings.alert_signup_spike_mult,
                        alert_pending_support_limit: json.health.settings.alert_pending_support_limit,
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFeedback(null);
        try {
            const res = await fetch(`${API_URL}/admin/alerts/settings`, {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const body = await res.json();
            if (!res.ok) {
                setFeedback({ ok: false, text: body.error || 'Ayarlar kaydedilemedi.' });
            } else {
                setFeedback({ ok: true, text: 'Alarm eşik ayarları güncellendi.' });
                fetchStatus();
            }
        } catch (err) {
            setFeedback({ ok: false, text: err.message });
        }
        setSaving(false);
    };

    const handleTestSummary = async () => {
        setTesting(true);
        setFeedback(null);
        try {
            const res = await fetch(`${API_URL}/admin/alerts/test-summary`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ writePreviewFiles: false })
            });
            const body = await res.json();
            if (!res.ok) {
                setFeedback({ ok: false, text: body.error || 'Test özeti çalıştırılamadı.' });
            } else if (body.delivery?.previewOnly) {
                setFeedback({
                    ok: true,
                    text: `SMTP kimlik bilgileri tanımlı olmadığı için e-posta GÖNDERİLMEDİ; yalnızca önizleme oluşturuldu (${body.delivery.reason}).`
                });
            } else {
                setFeedback({ ok: true, text: `Test özeti ${body.delivery?.recipient} adresine gönderildi.` });
            }
            fetchStatus();
        } catch (err) {
            setFeedback({ ok: false, text: err.message });
        }
        setTesting(false);
    };

    const health = data?.health || {};
    const preview = data?.preview || {};

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Bell className="text-blue-400" size={28} /> Ayarlar: Gün Sonu Özeti & Alarmlar
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Her gün 22:00 (TR) otomatik yönetici e-postası, anlık anomali alarmları ve zamanlayıcı sağlığı
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleTestSummary}
                    disabled={testing}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 self-start md:self-auto"
                >
                    <Send size={14} /> {testing ? 'Hazırlanıyor...' : 'Şimdi Test Özeti Gönder (Admin)'}
                </button>
            </div>

            {feedback && (
                <div className={`p-4 rounded-2xl border text-xs font-bold ${feedback.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                    {feedback.text}
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-900 rounded-2xl animate-pulse" />)}
                </div>
            ) : (
                <>
                    {/* Scheduler & SMTP Status Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase text-slate-400">SMTP E-Posta Altyapısı</span>
                                {health.smtpConfigured ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
                            </div>
                            <p className="text-lg font-black text-white">
                                {health.smtpConfigured ? 'Kimlik Bilgileri Hazır' : 'Kimlik Bilgileri Girilmedi'}
                            </p>
                            <p className="text-xs text-slate-400">
                                Hedef: <strong className="text-slate-200">{health.recipient || 'falkasoft@gmail.com'}</strong>
                            </p>
                            {!health.smtpConfigured && (
                                <p className="text-[11px] text-amber-300">
                                    Eksik env: {(health.missingEnvVars || []).join(', ')}
                                </p>
                            )}
                        </div>

                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase text-slate-400">Bugünkü Tetiklenme</span>
                                <Clock size={16} className="text-blue-400" />
                            </div>
                            <p className="text-3xl font-black text-white">{health.todayRunCount ?? 0} kez</p>
                            <p className="text-xs text-slate-400">
                                {health.hasLogsTable ? 'daily_summary_runs tablosundan canlı sayım' : 'daily_summary_runs migration bekleniyor'}
                            </p>
                        </div>

                        <div className={`bg-slate-900 border rounded-2xl p-5 space-y-2 ${health.yesterdayMissed ? 'border-rose-500/40' : 'border-white/5'}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase text-slate-400">Dünkü Özet Kontrolü</span>
                                {health.yesterdayMissed ? <ShieldAlert size={16} className="text-rose-400" /> : <CheckCircle2 size={16} className="text-emerald-400" />}
                            </div>
                            <p className={`text-lg font-black ${health.yesterdayMissed ? 'text-rose-300' : 'text-emerald-300'}`}>
                                {health.hasLogsTable ? (health.yesterdayMissed ? 'Uyarı: Dün Atlandı (0 çalışma)' : 'Normal (Çalıştı)') : 'veri yok (log tablosu yok)'}
                            </p>
                            <p className="text-xs text-slate-400">
                                Render ücretsiz plan uyursa dış cron (/api/cron/daily-summary) önerilir.
                            </p>
                        </div>
                    </div>

                    {/* Alert Thresholds Form + Render Sleep Note */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-white">Anında Alarm Eşikleri (Günde En Fazla 1 Kez)</h2>
                                {!health.settings?.fromDatabase && (
                                    <span className="text-[11px] text-amber-300 font-bold">migration bekleniyor</span>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">
                                        Günlük gelir son 7 gün ortalamasının % kaçının altına düşerse uyar? (Gün sonunda)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={form.alert_revenue_drop_pct}
                                        onChange={(e) => setForm({ ...form, alert_revenue_drop_pct: Number(e.target.value) })}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">
                                        Günlük kayıt son 7 gün ortalamasının kaç katını aşarsa uyar?
                                    </label>
                                    <input
                                        type="number"
                                        min="1.1"
                                        max="50"
                                        step="0.1"
                                        value={form.alert_signup_spike_mult}
                                        onChange={(e) => setForm({ ...form, alert_signup_spike_mult: Number(e.target.value) })}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">
                                        Bekleyen destek/şikayet sayısı kaça ulaşırsa uyar?
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={form.alert_pending_support_limit}
                                        onChange={(e) => setForm({ ...form, alert_pending_support_limit: Number(e.target.value) })}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={saving || !health.settings?.fromDatabase}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2"
                            >
                                <Save size={14} /> {saving ? 'Kaydediliyor...' : 'Eşikleri Kaydet'}
                            </button>
                        </form>

                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Server size={18} className="text-purple-400" /> Zamanlama & E-posta Sağlayıcı Özeti
                            </h2>
                            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5">
                                    <p className="font-black text-white mb-1">Render Uyku Riski & Çözüm</p>
                                    <p>
                                        Render ücretsiz web servisi 15 dk trafiksiz kalırsa uyur ve sunucu içi 22:00 zamanlayıcısı kaçabilir.
                                        Çözüm olarak dış zamanlayıcı (cron-job.org vb.) veya Render Cron Job her gün <strong>19:00 UTC (22:00 TR)</strong> saatinde
                                        <code className="text-blue-300 ml-1">POST /api/cron/daily-summary</code> endpoint&apos;ini <code className="text-blue-300">x-cron-secret</code> ile tetiklemelidir.
                                    </p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/5">
                                    <p className="font-black text-white mb-1">Önerilen E-posta Servisi: Brevo veya Resend SMTP</p>
                                    <p>
                                        • <strong>Gmail App Password:</strong> Kurulumu kolay, günde ~500 mail, ancak Render sunucu IP&apos;sinden gelen oturumlar güvenlik uyarısına/spam&apos;e takılabilir.<br />
                                        • <strong>Resend (3.000/ay ücretsiz) / Brevo (300/gün ücretsiz):</strong> SPF/DKIM doğrulamalı, yüksek teslim edilebilirlik ve SMTP (587) uyumludur. Zaten projede Brevo geçmişi olduğu için Resend veya Brevo SMTP önerilir.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Mail size={18} className="text-blue-400" /> Gün Sonu E-posta Önizlemesi
                            </h2>
                            <div className="flex bg-slate-950 rounded-xl p-1 border border-white/10">
                                <button type="button" onClick={() => setPreviewMode('text')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold ${previewMode === 'text' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                                    Metin
                                </button>
                                <button type="button" onClick={() => setPreviewMode('html')}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold ${previewMode === 'html' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                                    HTML Önizleme
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400">Konu: <strong className="text-white">{preview.subject}</strong></p>

                        {previewMode === 'text' ? (
                            <pre className="p-4 rounded-xl bg-slate-950 border border-white/5 text-xs text-slate-200 whitespace-pre-wrap font-mono overflow-x-auto">
                                {preview.text}
                            </pre>
                        ) : (
                            <iframe
                                title="Daily Summary HTML Preview"
                                srcDoc={preview.html || ''}
                                className="w-full h-96 rounded-xl border border-white/10 bg-[#020617]"
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
