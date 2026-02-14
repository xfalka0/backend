import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreHorizontal, User, Heart, Crown, Ban, Eye, Mail, Coins, X, Check, Clock } from 'lucide-react';
import axios from 'axios';
import io from 'socket.io-client';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://backend-kj17.onrender.com'
    : '';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);
    const [dbStatus, setDbStatus] = useState({ checked: false, connected: false });

    // Modals
    const [banModal, setBanModal] = useState({ open: false, user: null });
    const [balanceModal, setBalanceModal] = useState({ open: false, user: null });

    // Form States
    const [banDuration, setBanDuration] = useState('permanent'); // 'permanent', '1', '24', '168'
    const [balanceAmount, setBalanceAmount] = useState('');
    const [balanceAction, setBalanceAction] = useState('add'); // 'add', 'remove'

    useEffect(() => {
        const init = async () => {
            await checkHealth();
            fetchUsers();
        };
        init();

        // Real-time listener
        const token = localStorage.getItem('token');
        const socket = io(API_URL, {
            transports: ['websocket'],
            auth: { token }
        });
        socket.on('new_user', (newUser) => {
            setUsers(prev => [newUser, ...prev]);
        });

        return () => socket.disconnect();
    }, []);

    const checkHealth = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/health`);
            setDbStatus({ checked: true, connected: res.data.db === 'connected' });
        } catch (err) {
            setDbStatus({ checked: true, connected: false });
            console.error("Health check failed:", err.message);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Fetch Users Error:", err);
            setError(err.response?.data?.error || err.message);
            setLoading(false);
        }
    };

    const handleBan = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/admin/users/${banModal.user.id}/ban`, {
                duration: banDuration
            }, { headers: { Authorization: `Bearer ${token}` } });

            setBanModal({ open: false, user: null });
            fetchUsers(); // Refresh list
        } catch (err) {
            alert('Hata: ' + err.response?.data?.error || err.message);
        }
    };

    const handleUnban = async (userId) => {
        if (!window.confirm('Bu kullanıcının banını kaldırmak istediğinize emin misiniz?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/admin/users/${userId}/unban`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers();
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    };

    const handleBalance = async () => {
        try {
            const token = localStorage.getItem('token');
            const finalAmount = balanceAction === 'add' ? parseInt(balanceAmount) : -parseInt(balanceAmount);

            await axios.post(`${API_URL}/api/admin/users/${balanceModal.user.id}/balance`, {
                amount: finalAmount
            }, { headers: { Authorization: `Bearer ${token}` } });

            setBalanceModal({ open: false, user: null });
            setBalanceAmount('');
            fetchUsers();
        } catch (err) {
            alert('Hata: ' + err.response?.data?.error || err.message);
        }
    };

    const filteredUsers = users.filter(user =>
        (user.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (user.phone || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* DEBUG INFO OVERLAY */}
            <div className="fixed bottom-4 right-4 z-[9999] group">
                <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-2xl transition-all group-hover:bg-slate-800">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sistem Bilgisi</span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                            <span className="text-[10px] font-bold text-slate-500">Backend:</span>
                            <span className="text-[10px] font-mono text-purple-400">{API_URL || 'window.origin'}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-[10px] font-bold text-slate-500">Frontend:</span>
                            <span className="text-[10px] font-mono text-blue-400">{window.location.host}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-[10px] font-bold text-slate-500">Ortam:</span>
                            <span className="text-[10px] font-black text-white uppercase italic">
                                {API_URL.includes('localhost') ? 'Lokal Geliştirme' : 'Canlı Sunucu (Render)'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* HERADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Kullanıcılar</h2>
                    <div className="flex items-center gap-4">
                        <p className="text-slate-500 font-medium">Sistemdeki tüm üyeleri yönetin. ({users.length} Üye)</p>
                        {dbStatus.checked && !dbStatus.connected && (
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase rounded-md border border-rose-500/20">
                                Veritabanı Bağlantı Hatası
                            </span>
                        )}
                        {dbStatus.checked && dbStatus.connected && (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase rounded-md border border-emerald-500/20">
                                DB Aktif
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Kullanıcı ara..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-slate-900/50 border border-white/5 rounded-xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all placeholder:text-slate-600 w-64 text-white"
                        />
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-[32px] blur opacity-50"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[30px] overflow-hidden min-h-[400px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                <th className="px-8 py-5">Kullanıcı</th>
                                <th className="px-8 py-5">Durum</th>
                                <th className="px-8 py-5">Bakiye</th>
                                <th className="px-8 py-5">Üyelik</th>
                                <th className="px-8 py-5">Kayıt Tarihi</th>
                                <th className="px-8 py-5 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-20">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                                        <p className="text-sm font-bold text-slate-500">Kullanıcılar yükleniyor...</p>
                                    </div>
                                </td></tr>
                            ) : error ? (
                                <tr><td colSpan="6" className="text-center py-20 px-10">
                                    <div className="max-w-md mx-auto">
                                        <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <X size={32} />
                                        </div>
                                        <h4 className="text-lg font-bold text-white mb-2">Veriler Alınamadı</h4>
                                        <p className="text-sm text-slate-500 mb-6">{error}</p>
                                        <button
                                            onClick={fetchUsers}
                                            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5"
                                        >
                                            Tekrar Dene
                                        </button>
                                    </div>
                                </td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-10 text-slate-500">Kullanıcı bulunamadı.</td></tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="group/row hover:bg-white/[0.02] transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <img
                                                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                                                        className="w-12 h-12 rounded-2xl border-2 border-slate-800 object-cover"
                                                        alt=""
                                                    />
                                                    {user.is_vip && <div className="absolute -top-1 -right-1 p-1 bg-amber-500 rounded-full border-2 border-slate-900"><Crown size={8} className="text-white" /></div>}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white group-hover/row:text-purple-400 transition-colors uppercase tracking-tight">{user.username}</p>
                                                    <div className="flex flex-col">
                                                        {user.email && <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>}
                                                        {user.phone && <p className="text-[10px] text-slate-400 font-bold">{user.phone}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            {user.account_status === 'active' ? (
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
                                                    Aktif
                                                </span>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500 w-fit">
                                                        Banlı
                                                    </span>
                                                    {user.ban_expires_at && (
                                                        <span className="text-[10px] text-slate-500">
                                                            Bit: {new Date(user.ban_expires_at).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2 text-amber-400">
                                                <Coins size={14} fill="currentColor" />
                                                <span className="text-sm font-black">{user.balance || 0}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-sm font-medium text-slate-300">
                                            {user.is_vip ? (
                                                <span className="text-amber-500 font-bold flex items-center gap-1">
                                                    <Crown size={14} /> VIP
                                                </span>
                                            ) : 'Standart'}
                                        </td>
                                        <td className="px-8 py-5 text-sm font-bold text-slate-500 uppercase tabular-nums tracking-tighter">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setBalanceModal({ open: true, user })}
                                                    className="p-2 hover:bg-amber-500/10 text-amber-400 rounded-lg transition-colors"
                                                    title="Bakiye Yönet"
                                                >
                                                    <Coins size={18} />
                                                </button>

                                                {user.account_status === 'active' ? (
                                                    <button
                                                        onClick={() => setBanModal({ open: true, user })}
                                                        className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors"
                                                        title="Banla"
                                                    >
                                                        <Ban size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleUnban(user.id)}
                                                        className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors"
                                                        title="Banını Kaldır"
                                                    >
                                                        <Check size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BAN MODAL */}
            {banModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 relative">
                        <button onClick={() => setBanModal({ open: false, user: null })} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                            <X size={20} />
                        </button>

                        <div className="mb-6">
                            <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center mb-4 text-rose-500">
                                <Ban size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Kullanıcıyı Banla</h3>
                            <p className="text-slate-400 text-sm mt-1">
                                <span className="text-white font-bold">{banModal.user?.username}</span> adlı kullanıcıyı yasaklıyorsunuz.
                            </p>
                        </div>

                        <div className="space-y-3 mb-6">
                            {[
                                { val: '1', label: '1 Saat' },
                                { val: '24', label: '1 Gün' },
                                { val: '168', label: '1 Hafta' },
                                { val: 'permanent', label: 'Süresiz (Kalıcı)' }
                            ].map((opt) => (
                                <label key={opt.val} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${banDuration === opt.val
                                    ? 'bg-rose-500/20 border-rose-500/50 text-white'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                                    }`}>
                                    <input
                                        type="radio"
                                        name="duration"
                                        className="hidden"
                                        checked={banDuration === opt.val}
                                        onChange={() => setBanDuration(opt.val)}
                                    />
                                    <Clock size={16} className="mr-3 opactiy-50" />
                                    <span className="font-bold text-sm">{opt.label}</span>
                                    {banDuration === opt.val && <Check size={16} className="ml-auto text-rose-500" />}
                                </label>
                            ))}
                        </div>

                        <button
                            onClick={handleBan}
                            className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-900/20"
                        >
                            Banla ve İşlemi Tamamla
                        </button>
                    </div>
                </div>
            )}

            {/* BALANCE MODAL */}
            {balanceModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 relative">
                        <button onClick={() => setBalanceModal({ open: false, user: null })} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                            <X size={20} />
                        </button>

                        <div className="mb-6">
                            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 text-amber-500">
                                <Coins size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Bakiye Yönetimi</h3>
                            <p className="text-slate-400 text-sm mt-1">
                                <span className="text-white font-bold">{balanceModal.user?.username}</span> için işlem yapın.
                                <br />Mevcut Bakiye: <span className="text-amber-400">{balanceModal.user?.balance}</span>
                            </p>
                        </div>

                        <div className="flex bg-white/5 p-1 rounded-xl mb-6">
                            <button
                                onClick={() => setBalanceAction('add')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${balanceAction === 'add' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Ekle (+)
                            </button>
                            <button
                                onClick={() => setBalanceAction('remove')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${balanceAction === 'remove' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                Çıkar (-)
                            </button>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Miktar</label>
                            <input
                                type="number"
                                value={balanceAmount}
                                onChange={(e) => setBalanceAmount(e.target.value)}
                                placeholder="Örn: 500"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500/50 transition-colors font-mono font-bold text-lg"
                            />
                        </div>

                        <button
                            onClick={handleBalance}
                            className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg ${balanceAction === 'add'
                                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 text-white'
                                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20 text-white'
                                }`}
                        >
                            İşlemi Onayla
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
