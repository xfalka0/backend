import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Users, DollarSign, Coins, TrendingUp, Crown, Search, Download,
    Package, ChevronRight, X, Clock, MessageSquare, Phone, Gift,
    Lock, FileText, Plus, Minus, Loader2, RefreshCw, Sparkles,
    AlertTriangle, Repeat, UserCheck, ShieldAlert, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import axios from 'axios';

const API_URL = '';

const SEGMENT_META = {
    all: { label: 'Tümü', badge: 'bg-slate-800 text-slate-300 border-white/10' },
    vip: { label: 'VIP / Yüksek Harcama', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    repeat: { label: 'Tekrar Alanlar', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    first_time: { label: 'İlk Alım', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    free_hooked: { label: 'Ücretsiz (Kancalı)', badge: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
    free: { label: 'Ücretsiz', badge: 'bg-slate-700/40 text-slate-400 border-white/10' },
    churn_risk: { label: 'Churn Riski (7+ Gün)', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

const TX_TYPE_LABELS = {
    purchase: 'Paket Satın Alımı',
    webhook_purchase: 'Mağaza Satın Alımı',
    starter_pack: 'Başlangıç Paketi',
    admin_grant: 'Admin Coin Yükleme',
    admin_deduct: 'Admin Coin Kesintisi',
    referral_bonus: 'Referans Bonusu',
    spend_text: 'Sohbet Mesajı',
    spend_image: 'Fotoğraf Gönderimi',
    spend_audio: 'Sesli Mesaj',
    spend_gift: 'Hediye Gönderimi',
    spend_call: 'Sesli / Görüntülü Arama',
    spend_unlock: 'Kilitli Medya Açma',
};

const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleString('tr-TR', {
            timeZone: 'Europe/Istanbul',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
};

const formatMoney = (val) => {
    const num = parseFloat(val || 0);
    return `₺${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatNum = (val) => parseInt(val || 0, 10).toLocaleString('tr-TR');

export default function CRMPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [summary, setSummary] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    // Filters
    const [segment, setSegment] = useState('all');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [packageFilter, setPackageFilter] = useState('');
    const [sortBy, setSortBy] = useState('real_spent_desc');
    const [page, setPage] = useState(1);

    // Detail Drawer
    const [selectedUserId, setSelectedUserId] = useState(searchParams.get('userId') || null);
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTab, setDetailTab] = useState('payments'); // 'payments' | 'coins' | 'operators' | 'notes'

    // Drawer Actions
    const [noteText, setNoteText] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [coinAmount, setCoinAmount] = useState('');
    const [coinAction, setCoinAction] = useState('add');
    const [coinReason, setCoinReason] = useState('');
    const [coinSaving, setCoinSaving] = useState(false);
    const [actionMessage, setActionMessage] = useState(null);

    const getAuthHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem('token')}`
    });

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchSummary = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/crm/summary`, { headers: getAuthHeaders() });
            setSummary(res.data);
        } catch (err) {
            console.error('[CRM Summary Error]:', err);
        }
    }, []);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/crm/customers`, {
                headers: getAuthHeaders(),
                params: {
                    search: debouncedSearch,
                    segment,
                    packageFilter,
                    sortBy,
                    page,
                    limit: 30
                }
            });
            setCustomers(res.data.customers || []);
            setTotalCustomers(res.data.total || 0);
            setTotalPages(res.data.total_pages || 1);
        } catch (err) {
            console.error('[CRM Customers Error]:', err);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, segment, packageFilter, sortBy, page]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const openCustomerDetail = useCallback(async (userId) => {
        if (!userId) return;
        setSelectedUserId(userId);
        setSearchParams({ userId });
        setDetailLoading(true);
        setActionMessage(null);
        try {
            const res = await axios.get(`${API_URL}/api/admin/crm/customers/${userId}`, {
                headers: getAuthHeaders()
            });
            setDetailData(res.data);
            setNoteText(res.data.profile?.admin_notes || '');
        } catch (err) {
            console.error('[CRM Detail Error]:', err);
        } finally {
            setDetailLoading(false);
        }
    }, [setSearchParams]);

    useEffect(() => {
        const urlUid = searchParams.get('userId');
        if (urlUid) {
            openCustomerDetail(urlUid);
        }
    }, []);

    const closeDrawer = () => {
        setSelectedUserId(null);
        setDetailData(null);
        setSearchParams({});
        setActionMessage(null);
    };

    const handleSaveNote = async () => {
        if (!selectedUserId) return;
        setNoteSaving(true);
        setActionMessage(null);
        try {
            await axios.post(
                `${API_URL}/api/admin/crm/customers/${selectedUserId}/notes`,
                { notes: noteText },
                { headers: getAuthHeaders() }
            );
            setActionMessage({ type: 'success', text: 'CRM notu kaydedildi.' });
            fetchCustomers();
        } catch (err) {
            setActionMessage({ type: 'error', text: err.response?.data?.error || 'Not kaydedilemedi.' });
        } finally {
            setNoteSaving(false);
        }
    };

    const handleBalanceUpdate = async (e) => {
        e.preventDefault();
        const parsed = parseInt(coinAmount, 10);
        if (!selectedUserId || isNaN(parsed) || parsed <= 0) {
            setActionMessage({ type: 'error', text: 'Lütfen geçerli pozitif bir coin miktarı girin.' });
            return;
        }
        setCoinSaving(true);
        setActionMessage(null);
        try {
            const finalAmount = coinAction === 'add' ? parsed : -parsed;
            await axios.post(
                `${API_URL}/api/admin/crm/customers/${selectedUserId}/balance`,
                { amount: finalAmount, reason: coinReason },
                { headers: getAuthHeaders() }
            );
            setCoinAmount('');
            setCoinReason('');
            setActionMessage({ type: 'success', text: `Bakiye güncellendi (${finalAmount > 0 ? '+' : ''}${finalAmount} Coin).` });
            await Promise.all([openCustomerDetail(selectedUserId), fetchCustomers(), fetchSummary()]);
        } catch (err) {
            setActionMessage({ type: 'error', text: err.response?.data?.error || 'Bakiye güncellenemedi.' });
        } finally {
            setCoinSaving(false);
        }
    };

    const handleExportCsv = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/crm/export`, {
                headers: getAuthHeaders(),
                params: { search: debouncedSearch, segment, packageFilter, sortBy },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `fiora-crm-${segment}-${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[CRM Export Error]:', err);
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2 flex items-center gap-3">
                        <span className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-900/30">
                            <Users size={22} className="text-white" />
                        </span>
                        Müşteri CRM & Finans İstihbaratı
                    </h2>
                    <p className="text-slate-500 font-medium">
                        Kullanıcı bazlı paket alımları, verilen/harcanan coin dengesi, segmentasyon ve 360° müşteri geçmişi.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { fetchSummary(); fetchCustomers(); }}
                        className="px-4 py-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-bold flex items-center gap-2 transition-colors"
                    >
                        <RefreshCw size={14} />
                        Yenile
                    </button>
                    <button
                        onClick={handleExportCsv}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors"
                    >
                        <Download size={14} />
                        CSV İndir
                    </button>
                </div>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Toplam Gerçek Ciro</span>
                        <DollarSign size={16} className="text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{formatMoney(summary?.total_revenue)}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        Son 30g: <span className="text-emerald-400 font-bold">{formatMoney(summary?.revenue_30d)}</span> • Bugün: <span className="text-white font-bold">{formatMoney(summary?.revenue_today)}</span>
                    </p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ödeyen Müşteri</span>
                        <UserCheck size={16} className="text-blue-400" />
                    </div>
                    <p className="text-2xl font-black text-white">
                        {formatNum(summary?.paying_users)} <span className="text-sm font-bold text-slate-500">/ {formatNum(summary?.total_users)}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        Dönüşüm Oranı: <span className="text-blue-400 font-bold">%{summary?.conversion_rate ?? 0}</span>
                    </p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">ARPPU & Tekrar Alım</span>
                        <Repeat size={16} className="text-purple-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{formatMoney(summary?.arppu)}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        2+ Paket Alan: <span className="text-purple-400 font-bold">{formatNum(summary?.repeat_buyers)} kişi (%{summary?.repeat_rate ?? 0})</span>
                    </p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dağıtılan Coin</span>
                        <Coins size={16} className="text-amber-400" />
                    </div>
                    <p className="text-2xl font-black text-amber-400">{formatNum(summary?.total_coins_granted)}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        Satın Alım: <span className="text-white font-bold">{formatNum(summary?.total_purchased_coins)}</span> • Bonus: <span className="text-amber-300 font-bold">{formatNum(summary?.total_bonus_coins)}</span>
                    </p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Harcanan / Kalan Coin</span>
                        <TrendingUp size={16} className="text-pink-400" />
                    </div>
                    <p className="text-2xl font-black text-white">{formatNum(summary?.total_spent_coins)}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                        Cüzdanlardaki Bakiye: <span className="text-pink-400 font-bold">{formatNum(summary?.total_current_balance)}</span>
                    </p>
                </div>
            </div>

            {/* Package Sales Breakdown Bar */}
            {summary?.package_breakdown?.length > 0 && (
                <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Package size={16} className="text-indigo-400" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">Paket Bazlı Satış Dağılımı (Filtrelemek için tıklayın)</h3>
                        </div>
                        {packageFilter && (
                            <button
                                onClick={() => { setPackageFilter(''); setPage(1); }}
                                className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                            >
                                <X size={12} /> Paket Filtresini Temizle ({packageFilter})
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {summary.package_breakdown.map((pkg) => {
                            const active = packageFilter === pkg.package_name;
                            return (
                                <button
                                    key={pkg.package_name}
                                    onClick={() => { setPackageFilter(active ? '' : pkg.package_name); setPage(1); }}
                                    className={`px-3.5 py-2 rounded-xl border text-left transition-all ${
                                        active
                                            ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-lg shadow-indigo-900/20'
                                            : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/10 text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black">{pkg.package_name}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-black">
                                            {pkg.sales_count}x
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        {formatMoney(pkg.total_revenue)} • {formatNum(pkg.total_coins)} Coin • {pkg.unique_buyers} kişi
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Table Card */}
            <div className="bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[28px] overflow-hidden">
                {/* Segment Tabs & Search/Sort */}
                <div className="p-6 border-b border-white/5 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(SEGMENT_META).map(([key, meta]) => (
                            <button
                                key={key}
                                onClick={() => { setSegment(key); setPage(1); }}
                                className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${
                                    segment === key
                                        ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                                        : 'bg-white/[0.02] text-slate-400 border-white/5 hover:text-white hover:bg-white/[0.05]'
                                }`}
                            >
                                {meta.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Ad, kullanıcı adı, e-posta, telefon veya ID ara..."
                                className="w-full bg-slate-950/70 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500">
                                Toplam <span className="text-white">{formatNum(totalCustomers)}</span> müşteri
                            </span>
                            <select
                                value={sortBy}
                                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                                className="bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="real_spent_desc">En Çok Ödeyen (₺)</option>
                                <option value="purchases_desc">En Çok Paket Alan</option>
                                <option value="spent_coins_desc">En Çok Coin Harcayan</option>
                                <option value="balance_desc">En Yüksek Bakiye</option>
                                <option value="recent_active">Son Aktif Olanlar</option>
                                <option value="newest">En Yeni Kayıtlar</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="p-16 flex justify-center">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/[0.02]">
                                    <th className="px-6 py-4">Kullanıcı</th>
                                    <th className="px-4 py-4">Segment</th>
                                    <th className="px-4 py-4">Toplam Ödenen</th>
                                    <th className="px-4 py-4">Alınan Paketler</th>
                                    <th className="px-4 py-4">Verilen Coin</th>
                                    <th className="px-4 py-4">Harcanan / Bakiye</th>
                                    <th className="px-4 py-4">AI / Kanca</th>
                                    <th className="px-4 py-4">Son Aktiflik</th>
                                    <th className="px-6 py-4 text-right">Detay</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {customers.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" className="p-12 text-center text-slate-500 font-medium">
                                            Bu filtrelere uygun müşteri bulunamadı.
                                        </td>
                                    </tr>
                                ) : (
                                    customers.map((c) => {
                                        const segMeta = SEGMENT_META[c.segment] || SEGMENT_META.free;
                                        return (
                                            <tr
                                                key={c.id}
                                                onClick={() => openCustomerDetail(c.id)}
                                                className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative shrink-0">
                                                            <img
                                                                src={c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.display_name || 'U')}&background=1e293b&color=fff`}
                                                                alt=""
                                                                className="w-10 h-10 rounded-xl object-cover border border-white/10"
                                                            />
                                                            {(c.is_vip || c.vip_level > 0) && (
                                                                <span className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 border border-slate-950">
                                                                    <Crown size={9} className="text-white" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-white group-hover:text-blue-400 transition-colors">
                                                                {c.display_name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400">@{c.username}</p>
                                                            <p className="text-[10px] text-slate-500">{c.email || c.phone || '-'}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border whitespace-nowrap ${segMeta.badge}`}>
                                                        {segMeta.label}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <span className={`text-sm font-black ${c.real_spent_amount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                        {formatMoney(c.real_spent_amount)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-4">
                                                    {c.purchase_count > 0 ? (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 text-xs font-black text-white">
                                                                <Package size={12} className="text-indigo-400" />
                                                                {c.purchase_count} Paket
                                                            </span>
                                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[160px]">
                                                                Son: {c.last_package_name || '-'}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-600 font-bold">Alım Yok</span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="text-xs font-black text-amber-400">
                                                        {formatNum(c.total_coins_granted)} Coin
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        Alım: {formatNum(c.purchased_coins)} • Bonus: {formatNum(c.bonus_coins)}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="text-xs font-black text-pink-400">
                                                        -{formatNum(c.effective_spent_coins)} Harcandı
                                                    </div>
                                                    <div className="text-[10px] text-slate-300 font-bold mt-0.5">
                                                        Kalan: {formatNum(c.balance)} Coin
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-bold text-slate-300">
                                                            AI: {c.ai_messages_count}/5
                                                        </span>
                                                        {c.ai_hook_sent && (
                                                            <span className="px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-400 text-[9px] font-black w-fit">
                                                                Onay Kancası Atıldı
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-[11px] text-slate-400 whitespace-nowrap">
                                                    {formatDateTime(c.last_login_at || c.created_at)}
                                                </td>

                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openCustomerDetail(c.id); }}
                                                        className="px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white text-[11px] font-black inline-flex items-center gap-1 transition-all"
                                                    >
                                                        360° İncele
                                                        <ChevronRight size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            Sayfa <span className="text-white font-bold">{page}</span> / {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-xs font-bold text-white"
                            >
                                Önceki
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-xs font-bold text-white"
                            >
                                Sonraki
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 360-Degree Customer Detail Slide-Over Drawer */}
            {selectedUserId && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeDrawer}>
                    <div
                        className="w-full max-w-3xl bg-slate-950 border-l border-white/10 h-full overflow-y-auto shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {detailLoading || !detailData ? (
                            <div className="flex-1 flex items-center justify-center p-12">
                                <Loader2 className="animate-spin text-blue-500" size={36} />
                            </div>
                        ) : (
                            <>
                                {/* Drawer Header */}
                                <div className="p-6 border-b border-white/10 bg-slate-900/60 sticky top-0 z-10 backdrop-blur-xl">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <img
                                                src={detailData.profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(detailData.profile.display_name || 'U')}&background=1e293b&color=fff`}
                                                alt=""
                                                className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500/40"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-xl font-black text-white">{detailData.profile.display_name}</h3>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${(SEGMENT_META[detailData.profile.segment] || SEGMENT_META.free).badge}`}>
                                                        {(SEGMENT_META[detailData.profile.segment] || SEGMENT_META.free).label}
                                                    </span>
                                                    {detailData.profile.vip_level > 0 && (
                                                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                                            <Crown size={10} /> VIP {detailData.profile.vip_level}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    @{detailData.profile.username} • {detailData.profile.email || 'E-posta yok'} {detailData.profile.phone ? `• ${detailData.profile.phone}` : ''}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                    ID: {detailData.profile.id} • Kayıt: {formatDateTime(detailData.profile.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={closeDrawer}
                                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* 5 Mini Metric Boxes */}
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-5">
                                        <div className="bg-slate-900 border border-white/5 rounded-xl p-3">
                                            <span className="text-[9px] font-black uppercase text-slate-500 block">Toplam Ödeme</span>
                                            <span className="text-base font-black text-emerald-400">{formatMoney(detailData.profile.real_spent_amount)}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-white/5 rounded-xl p-3">
                                            <span className="text-[9px] font-black uppercase text-slate-500 block">Alınan Paket</span>
                                            <span className="text-base font-black text-white">{detailData.profile.purchase_count} Adet</span>
                                        </div>
                                        <div className="bg-slate-900 border border-white/5 rounded-xl p-3">
                                            <span className="text-[9px] font-black uppercase text-slate-500 block">Verilen Coin</span>
                                            <span className="text-base font-black text-amber-400">{formatNum(detailData.profile.total_coins_granted)}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-white/5 rounded-xl p-3">
                                            <span className="text-[9px] font-black uppercase text-slate-500 block">Harcanan Coin</span>
                                            <span className="text-base font-black text-pink-400">{formatNum(detailData.profile.effective_spent_coins)}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-white/5 rounded-xl p-3">
                                            <span className="text-[9px] font-black uppercase text-slate-500 block">Güncel Bakiye</span>
                                            <span className="text-base font-black text-blue-400">{formatNum(detailData.profile.balance)}</span>
                                        </div>
                                    </div>

                                    {/* Sub-tabs */}
                                    <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                                        {[
                                            { id: 'payments', label: 'Paket & Ödemeler' },
                                            { id: 'coins', label: 'Coin & Harcama Analizi' },
                                            { id: 'operators', label: 'Sohbet & AI Kancası' },
                                            { id: 'notes', label: 'CRM Notları & İşlemler' },
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setDetailTab(tab.id)}
                                                className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                                                    detailTab === tab.id
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-900 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Drawer Body */}
                                <div className="p-6 space-y-6 flex-1">
                                    {actionMessage && (
                                        <div className={`p-3.5 rounded-xl border text-xs font-bold ${
                                            actionMessage.type === 'success'
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                        }`}>
                                            {actionMessage.text}
                                        </div>
                                    )}

                                    {/* TAB 1: PAYMENTS & PACKAGES */}
                                    {detailTab === 'payments' && (
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                                                    Aldığı Paketlerin Özeti
                                                </h4>
                                                {detailData.package_summary.length === 0 ? (
                                                    <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 text-center text-xs text-slate-500">
                                                        Bu kullanıcı henüz paket satın alımı yapmamış.
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {detailData.package_summary.map((ps, i) => (
                                                            <div key={i} className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-sm font-black text-white">{ps.package_name}</p>
                                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                                        {ps.count} kez alındı • +{formatNum(ps.total_coins)} Coin
                                                                    </p>
                                                                </div>
                                                                <span className="text-base font-black text-emerald-400">
                                                                    {formatMoney(ps.total_amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                                                    Tüm Ödeme Geçmişi ({detailData.payments.length})
                                                </h4>
                                                <div className="space-y-2.5">
                                                    {detailData.payments.length === 0 ? (
                                                        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 text-center text-xs text-slate-500">
                                                            Ödeme kaydı bulunmuyor.
                                                        </div>
                                                    ) : (
                                                        detailData.payments.map(p => (
                                                            <div key={p.id} className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-white">{p.package_name}</span>
                                                                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-black">
                                                                            +{formatNum(p.coins_given)} Coin
                                                                        </span>
                                                                        {p.payment_method && (
                                                                            <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 text-[10px] font-bold">
                                                                                {p.payment_method}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                                                                        {formatDateTime(p.created_at)} • TX: {p.transaction_id || '-'}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-sm font-black text-emerald-400 block">{formatMoney(p.amount)}</span>
                                                                    <span className="text-[10px] uppercase font-bold text-slate-400">{p.status || 'completed'}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: COIN SPENDING & TRANSACTIONS */}
                                    {detailTab === 'coins' && (
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                                                    Kullanım Aktivite Özeti & Coin Kırılımı
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5">
                                                        <MessageSquare size={14} className="text-blue-400 mb-1" />
                                                        <span className="text-sm font-black text-white block">{detailData.activity_stats.text_sent}</span>
                                                        <span className="text-[10px] text-slate-500">Yazılı Mesaj</span>
                                                    </div>
                                                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5">
                                                        <Sparkles size={14} className="text-purple-400 mb-1" />
                                                        <span className="text-sm font-black text-white block">{detailData.activity_stats.media_sent}</span>
                                                        <span className="text-[10px] text-slate-500">Foto/Video</span>
                                                    </div>
                                                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5">
                                                        <Phone size={14} className="text-emerald-400 mb-1" />
                                                        <span className="text-sm font-black text-white block">{detailData.activity_stats.audio_sent}</span>
                                                        <span className="text-[10px] text-slate-500">Sesli Mesaj</span>
                                                    </div>
                                                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5">
                                                        <Gift size={14} className="text-pink-400 mb-1" />
                                                        <span className="text-sm font-black text-white block">{detailData.activity_stats.gifts_sent}</span>
                                                        <span className="text-[10px] text-slate-500">Hediye</span>
                                                    </div>
                                                    <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5">
                                                        <Lock size={14} className="text-amber-400 mb-1" />
                                                        <span className="text-sm font-black text-white block">{detailData.activity_stats.media_unlocked}</span>
                                                        <span className="text-[10px] text-slate-500">Kilitli Açma</span>
                                                    </div>
                                                </div>

                                                {detailData.spending_breakdown.length > 0 && (
                                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        {detailData.spending_breakdown.map(sb => (
                                                            <div key={sb.type} className="p-3 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between">
                                                                <div>
                                                                    <span className="text-xs font-bold text-white block">{TX_TYPE_LABELS[sb.type] || sb.type}</span>
                                                                    <span className="text-[10px] text-slate-500">{sb.count} işlem</span>
                                                                </div>
                                                                <span className="text-xs font-black text-pink-400">-{formatNum(sb.total_coins)} Coin</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                                                    Coin Hareket Defteri (Son {detailData.transactions.length} Kayıt)
                                                </h4>
                                                <div className="space-y-2">
                                                    {detailData.transactions.length === 0 ? (
                                                        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 text-center text-xs text-slate-500">
                                                            Henüz coin hareketi loglanmamış.
                                                        </div>
                                                    ) : (
                                                        detailData.transactions.map(tx => {
                                                            const isPositive = tx.amount >= 0;
                                                            return (
                                                                <div key={tx.id} className="p-3.5 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between gap-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`p-2 rounded-lg ${isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                                                                            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-bold text-white">{tx.description || TX_TYPE_LABELS[tx.type] || tx.type}</p>
                                                                            <p className="text-[10px] text-slate-500">
                                                                                {TX_TYPE_LABELS[tx.type] || tx.type} • {formatDateTime(tx.created_at)}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <span className={`text-sm font-black whitespace-nowrap ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                        {isPositive ? '+' : ''}{formatNum(tx.amount)} Coin
                                                                    </span>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 3: OPERATORS & AI STATUS */}
                                    {detailTab === 'operators' && (
                                        <div className="space-y-6">
                                            <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Yeni Üye AI & Kanca Durumu</h4>
                                                    <p className="text-xs text-slate-300 mt-1">
                                                        Kullanılan AI Mesajı: <span className="text-white font-black">{detailData.profile.ai_messages_count} / 5</span>
                                                    </p>
                                                </div>
                                                <span className={`px-3 py-1.5 rounded-xl text-xs font-black ${
                                                    detailData.profile.ai_hook_sent
                                                        ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                                                        : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {detailData.profile.ai_hook_sent ? 'Numara Onay Kancası Gönderildi' : 'Kanca Henüz Gönderilmedi'}
                                                </span>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                                                    En Çok Etkileşime Girdiği Profiller ({detailData.top_operators.length})
                                                </h4>
                                                <div className="space-y-2.5">
                                                    {detailData.top_operators.length === 0 ? (
                                                        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 text-center text-xs text-slate-500">
                                                            Sohbet geçmişi bulunmuyor.
                                                        </div>
                                                    ) : (
                                                        detailData.top_operators.map(op => (
                                                            <div key={op.chat_id} className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <img
                                                                        src={op.operator_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(op.operator_name || 'O')}&background=1e293b&color=fff`}
                                                                        alt=""
                                                                        className="w-10 h-10 rounded-xl object-cover border border-white/10"
                                                                    />
                                                                    <div>
                                                                        <p className="text-xs font-black text-white">{op.operator_name}</p>
                                                                        <p className="text-[10px] text-slate-500">
                                                                            Son etkileşim: {formatDateTime(op.last_interaction_at)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-xs font-black text-blue-400 block">{op.user_messages_count} Müşteri Mesajı</span>
                                                                    <span className="text-[10px] text-slate-400">{op.operator_messages_count} Profil Yanıtı</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 4: CRM NOTES & QUICK COIN ACTION */}
                                    {detailTab === 'notes' && (
                                        <div className="space-y-6">
                                            {/* Admin CRM Notes */}
                                            <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <FileText size={16} className="text-blue-400" />
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-white">Yönetici CRM Notu</h4>
                                                </div>
                                                <textarea
                                                    rows={4}
                                                    value={noteText}
                                                    onChange={(e) => setNoteText(e.target.value)}
                                                    placeholder="Müşteri hakkında özel CRM notları (ör. VIP müşteri, şu operatörle ilgileniyor, iade talebi vs.)..."
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                                />
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={handleSaveNote}
                                                        disabled={noteSaving}
                                                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition-colors disabled:opacity-50"
                                                    >
                                                        {noteSaving ? 'Kaydediliyor...' : 'Notu Kaydet'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Quick Coin Adjust (Tracked Separately from Real Money Revenue) */}
                                            <form onSubmit={handleBalanceUpdate} className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Coins size={16} className="text-amber-400" />
                                                        <h4 className="text-xs font-black uppercase tracking-widest text-white">Sebepli Manuel Coin Yükle / Kes</h4>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">Gerçek ödeme cirosunu etkilemez</span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCoinAction('add')}
                                                        className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border ${
                                                            coinAction === 'add'
                                                                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                                                                : 'bg-slate-950 border-white/10 text-slate-400'
                                                        }`}
                                                    >
                                                        <Plus size={14} /> Coin Ekle
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCoinAction('deduct')}
                                                        className={`py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border ${
                                                            coinAction === 'deduct'
                                                                ? 'bg-rose-600/20 border-rose-500 text-rose-400'
                                                                : 'bg-slate-950 border-white/10 text-slate-400'
                                                        }`}
                                                    >
                                                        <Minus size={14} /> Coin Düş
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={coinAmount}
                                                        onChange={(e) => setCoinAmount(e.target.value)}
                                                        placeholder="Coin Miktarı (ör. 500)"
                                                        className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={coinReason}
                                                        onChange={(e) => setCoinReason(e.target.value)}
                                                        placeholder="İşlem Sebebi (ör. VIP Hediye)"
                                                        className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                                    />
                                                </div>

                                                <div className="flex justify-end">
                                                    <button
                                                        type="submit"
                                                        disabled={coinSaving}
                                                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors disabled:opacity-50"
                                                    >
                                                        {coinSaving ? 'İşleniyor...' : 'Bakiyeyi Güncelle'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

