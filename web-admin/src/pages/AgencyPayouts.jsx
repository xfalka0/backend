
import React, { useState, useEffect } from 'react';
import { 
    Wallet, 
    TrendingUp, 
    Users, 
    ChevronRight, 
    ArrowUpRight, 
    CheckCircle2, 
    Clock,
    DollarSign,
    Search,
    Filter,
    MoreHorizontal,
    Building2
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

import { useLocation, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://backend-kj17.onrender.com/api';

const AgencyPayouts = () => {
    const { token } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [stats, setStats] = useState({ total_pending: 0, total_lifetime: 0, total_paid: 0 });
    const [operators, setOperators] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [payoutModal, setPayoutModal] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
        const [payoutMethod, setPayoutMethod] = useState('Papara');

    // Agency Modal & Creation States
    const [showAgencyModal, setShowAgencyModal] = useState(false);
    
    const handleCloseAgencyModal = () => {
        setShowAgencyModal(false);
        navigate('/agency-payouts');
    };
    const [agencyName, setAgencyName] = useState('');
    const [agencyOwnerId, setAgencyOwnerId] = useState('');
    const [agencyOwnerSearch, setAgencyOwnerSearch] = useState('');
    const [agencyStatus, setAgencyStatus] = useState(true); // true = 'active', false = 'inactive'
    const [agencyCommissionRate, setAgencyCommissionRate] = useState('0.40'); // Default %40
    
    // User search & creation states
    const [allUsersList, setAllUsersList] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [showQuickOwnerCreate, setShowQuickOwnerCreate] = useState(false);
    const [quickUsername, setQuickUsername] = useState('');
    const [quickEmail, setQuickEmail] = useState('');
    const [quickPhone, setQuickPhone] = useState('');
    const [quickPassword, setQuickPassword] = useState('');
    const [quickRole, setQuickRole] = useState('operator'); // Default to operator
    const [creatingUser, setCreatingUser] = useState(false);

    const fetchUsers = async () => {
        try {
            setSearchingUsers(true);
            const res = await axios.get(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
            setAllUsersList(res.data);
        } catch (err) {
            console.error('Kullanıcı listesi çekme hatası:', err);
        } finally {
            setSearchingUsers(false);
        }
    };

    useEffect(() => {
        if (showAgencyModal) {
            fetchUsers();
        }
    }, [showAgencyModal]);

    const filteredUsers = allUsersList.filter(u => {
        const username = String(u.username || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const phone = String(u.phone || '').toLowerCase();
        const id = String(u.id || '').toLowerCase();
        const search = String(agencyOwnerSearch || '').toLowerCase();

        return (username.includes(search) || 
                email.includes(search) ||
                phone.includes(search) ||
                id.includes(search)) &&
               u.role !== 'customer';
    }).slice(0, 5);

    const handleCreateQuickUser = async () => {
        if (!quickUsername.trim() || !quickEmail.trim() || !quickPassword.trim()) {
            alert('Lütfen kullanıcı adı, e-posta ve şifre alanlarını doldurun.');
            return;
        }

        try {
            setCreatingUser(true);
            const res = await axios.post(`${API_URL}/admin/users`, {
                username: quickUsername.trim().toLowerCase(),
                email: quickEmail.trim().toLowerCase(),
                phone: quickPhone.trim(),
                password: quickPassword.trim(),
                role: quickRole
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data) {
                alert('Ajans Sahibi profili başarıyla yaratıldı ve seçildi!');
                const newUser = res.data;
                setAllUsersList(prev => [newUser, ...prev]);
                setAgencyOwnerId(newUser.id);
                setAgencyOwnerSearch(newUser.username);
                
                // Clear quick creation form
                setQuickUsername('');
                setQuickEmail('');
                setQuickPhone('');
                setQuickPassword('');
                setShowQuickOwnerCreate(false);
            }
        } catch (err) {
            alert('Hızlı kullanıcı yaratma hatası: ' + (err.response?.data?.error || err.message));
        } finally {
            setCreatingUser(false);
        }
    };

    const handleCreateAgency = async () => {
        if (!agencyName.trim()) {
            alert('Lütfen ajans adı girin.');
            return;
        }
        if (!agencyOwnerId) {
            alert('Lütfen geçerli bir ajans sahibi seçin veya yenisini yaratın.');
            return;
        }

        try {
            await axios.post(`${API_URL}/admin/agencies`, {
                name: agencyName.trim(),
                owner_id: agencyOwnerId,
                commission_rate: parseFloat(agencyCommissionRate || 0.40),
                status: agencyStatus ? 'active' : 'inactive'
            }, { headers: { Authorization: `Bearer ${token}` } });

            alert('Yeni ajans başarıyla oluşturuldu!');
            handleCloseAgencyModal();
            
            // Clear inputs
            setAgencyName('');
            setAgencyOwnerId('');
            setAgencyOwnerSearch('');
            setAgencyStatus(true);
            setAgencyCommissionRate('0.40');
            
            fetchData();
        } catch (err) {
            alert('Ajans oluşturma hatası: ' + (err.response?.data?.error || err.message));
        }
    };

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('action') === 'create') {
            setShowAgencyModal(true);
        } else {
            setShowAgencyModal(false);
        }
    }, [location.search]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, opsRes] = await Promise.all([
                axios.get(`${API_URL}/admin/payouts/summary`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/admin/agencies/earnings`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setStats(statsRes.data);
            setOperators(opsRes.data);
        } catch (err) {
            console.error('Veri çekme hatası:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePayout = async () => {
        if (!selectedOperator) return;
        try {
            await axios.post(`${API_URL}/admin/agencies/${selectedOperator.id}/payout`, {
                amount: payoutAmount || selectedOperator.pending_balance,
                method: payoutMethod
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setPayoutModal(false);
            fetchData(); // Refresh
            alert('Ödeme başarıyla işlendi.');
        } catch (err) {
            alert('Hata: ' + (err.response?.data?.error || err.message));
        }
    };

    const filteredOperators = operators.filter(op => 
        op.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        op.owner_username?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const StatCard = ({ title, value, icon: Icon, color, subValue }) => (
        <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/5 p-6 rounded-[32px] relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-600/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-${color}-600/20 transition-all duration-700`} />
            <div className="flex items-start justify-between relative z-10">
                <div>
                    <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{title}</p>
                    <h3 className="text-3xl font-black text-white tracking-tighter">
                        {value.toLocaleString()} <span className="text-sm font-bold text-slate-600 ml-1">ELMAS</span>
                    </h3>
                    {subValue && <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wide">{subValue}</p>}
                </div>
                <div className={`w-12 h-12 rounded-2xl bg-${color}-600/10 border border-${color}-500/20 flex items-center justify-center text-${color}-400 shadow-lg`}>
                    <Icon size={22} />
                </div>
            </div>
            <div className="mt-6 flex items-center gap-2 relative z-10">
                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full bg-${color}-500/50 w-[70%]`} />
                </div>
                <ArrowUpRight size={14} className={`text-${color}-400`} />
            </div>
        </div>
    );

    return (
        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <TrendingUp size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Finansal Yönetim</span>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter">
                        Ajans <span className="text-blue-500">Yönetimi</span>
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Ajans performansını, komisyon dağılımlarını ve ödeme dengelerini yönetin.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowAgencyModal(true)} 
                        className="px-5 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 shadow-[0_10px_30px_rgba(99,102,241,0.3)] transition-all"
                    >
                        Yeni Ajans Ekle
                    </button>
                    <button onClick={fetchData} className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all">
                        Verileri Yenile
                    </button>
                    <button className="px-5 py-3 rounded-2xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-500 shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all">
                        Rapor Dışa Aktar
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
                title="Toplam Bekleyen Borç" 
                value={stats.total_pending || 0} 
                icon={Wallet} 
                color="blue"
                subValue={`Yaklaşık ${((stats.total_pending || 0) * 0.023).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`}
            />
            <StatCard 
                title="Toplam Ödenen" 
                value={stats.total_paid || 0} 
                icon={CheckCircle2} 
                color="emerald"
                subValue={`${((stats.total_paid || 0) * 0.023).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL ödeme yapıldı`}
            />
            <StatCard 
                title="Ajans Toplam Ciro" 
                value={stats.total_lifetime || 0} 
                icon={TrendingUp} 
                color="indigo"
                subValue={`Brüt: ${((stats.total_lifetime || 0) * 0.023).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`}
            />
        </div>

            {/* Agency List Table */}
            <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/5 rounded-[40px] overflow-hidden">
                <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-white px-2">Ajans Performansı ve Listesi</h2>
                        <span className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-full uppercase">
                            {operators.length} AKTİF AJANS
                        </span>
                    </div>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Ajans veya Sahibi Ara..."
                            className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all w-full md:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ajans Adı / Sahibi</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Referans Kodu</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Yayıncı Sayısı</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Bekleyen Bakiye</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Toplam Kazanç</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-slate-500 font-bold uppercase tracking-widest italic animate-pulse">
                                        Ajans verileri yükleniyor...
                                    </td>
                                </tr>
                            ) : filteredOperators.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-slate-500 font-bold tracking-widest">
                                        Hiç ajans bulunamadı.
                                    </td>
                                </tr>
                            ) : filteredOperators.map((op) => (
                                <tr key={op.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-[2px]">
                                                <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
                                                    <Building2 size={20} className="text-cyan-400" />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white capitalize">{op.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-bold text-slate-500">Sahip: @{op.owner_username || 'Bilinmiyor'}</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-500">
                                                        %{op.commission_rate * 100} KOMİSYON
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex justify-center">
                                            <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs font-black text-cyan-400 tracking-wider">
                                                {op.referral_code || 'YOK'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex justify-center">
                                            <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-slate-400">
                                                {op.total_models || 0} Model
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className={`text-sm font-black tracking-tighter ${op.pending_balance > 1000 ? 'text-cyan-400' : 'text-white'}`}>
                                            {parseFloat(op.pending_balance)?.toLocaleString()} 
                                            <span className="text-[10px] text-slate-600 ml-1">ELMAS</span>
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">
                                            ≈ {(op.pending_balance * 0.023).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TRY
                                        </p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className="text-sm font-black text-slate-300 tracking-tighter">
                                            {parseFloat(op.lifetime_earnings)?.toLocaleString()} 
                                            <span className="text-[10px] text-slate-700 ml-1">ELMAS</span>
                                        </p>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button 
                                            onClick={() => {
                                                setSelectedOperator(op);
                                                setPayoutAmount(op.pending_balance);
                                                setPayoutModal(true);
                                            }}
                                            className="px-4 py-2 bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black rounded-xl uppercase hover:bg-cyan-600 hover:text-white transition-all"
                                        >
                                            Hakediş Öde
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>



            {/* Payout Modal */}
            {payoutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setPayoutModal(false)} />
                    <div className="bg-[#0f172a] border border-white/10 w-full max-w-md rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-indigo-600/10">
                            <h2 className="text-2xl font-black text-white tracking-tighter">Ödeme İşlemi</h2>
                            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">{selectedOperator?.name}</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Ödenecek Tutar (ELMAS)</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-2xl font-black text-white outline-none focus:border-blue-500/50 transition-all"
                                    value={payoutAmount}
                                    onChange={(e) => setPayoutAmount(e.target.value)}
                                />
                                <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tight">Kalan Borç: {Math.max(0, selectedOperator.pending_balance - payoutAmount).toLocaleString()} Elmas</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Ödeme Yöntemi</label>
                                <select 
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-blue-500/50 appearance-none transition-all"
                                    value={payoutMethod}
                                    onChange={(e) => setPayoutMethod(e.target.value)}
                                >
                                    <option value="Papara">Papara</option>
                                    <option value="IBAN / Havale">IBAN / Havale</option>
                                    <option value="USDT / Kripto">USDT / Kripto</option>
                                    <option value="Manuel Settlement">Diğer / Manuel</option>
                                </select>
                            </div>
                            
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setPayoutModal(false)} className="flex-1 py-4 rounded-3xl bg-white/5 text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">İptal</button>
                                <button onClick={handlePayout} className="flex-2 px-8 py-4 rounded-3xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-500 shadow-xl transition-all">Ödemeyi Tamamla</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Yeni Ajans Ekleme Modali */}
            {showAgencyModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={handleCloseAgencyModal} />
                    <div className="bg-[#0f172a] border border-white/10 w-full max-w-lg rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        
                        {/* Modal Header */}
                        <div className="p-8 border-b border-white/5 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tighter">Yeni Ajans Kaydı</h2>
                                <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Sistem Ajansı Tanımlama Formu</p>
                            </div>
                            <button 
                                onClick={handleCloseAgencyModal} 
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            
                            {/* Agency Name */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Ajans Adı (Agency Name)</label>
                                <input 
                                    type="text" 
                                    placeholder="Örn: Marilyn Ajans"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all"
                                    value={agencyName}
                                    onChange={(e) => setAgencyName(e.target.value)}
                                />
                            </div>

                            {/* Agency Owner selection */}
                            <div className="border border-white/5 p-5 rounded-3xl bg-white/[0.01] relative">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ajans Sahibi (Owner)</label>
                                    <button 
                                        type="button"
                                        onClick={() => setShowQuickOwnerCreate(!showQuickOwnerCreate)}
                                        className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-wider"
                                    >
                                        {showQuickOwnerCreate ? 'Kayıtlı Kullanıcılardan Seç' : 'Yeni Sahip Kaydı Yarat ➕'}
                                    </button>
                                </div>

                                {!showQuickOwnerCreate ? (
                                    /* User Search and Selector Panel */
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                placeholder="Kullanıcı adı veya ID ile ara..."
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-5 text-sm font-bold text-white outline-none focus:border-indigo-500/50 transition-all"
                                                value={agencyOwnerSearch}
                                                onChange={(e) => {
                                                    setAgencyOwnerSearch(e.target.value);
                                                    if (agencyOwnerId) setAgencyOwnerId(''); // Reset selection if typing
                                                }}
                                            />
                                            {searchingUsers && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Dropdown Results */}
                                        {agencyOwnerSearch.length > 0 && !agencyOwnerId && (
                                            <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden mt-1 max-h-48 overflow-y-auto">
                                                {filteredUsers.length === 0 ? (
                                                    <div className="p-4 text-xs font-bold text-slate-500 text-center">Kullanıcı bulunamadı.</div>
                                                ) : (
                                                    filteredUsers.map(u => (
                                                        <div 
                                                            key={u.id}
                                                            onClick={() => {
                                                                setAgencyOwnerId(u.id);
                                                                setAgencyOwnerSearch(u.username);
                                                            }}
                                                            className="p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 flex items-center justify-between"
                                                        >
                                                            <div>
                                                                <p className="text-xs font-bold text-white capitalize">{u.username}</p>
                                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                                    {u.email || 'E-posta yok'}{u.phone ? ` • Tel: ${u.phone}` : ''}
                                                                </p>
                                                            </div>
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md uppercase">{u.role}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {agencyOwnerId && (
                                            <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                                <div>
                                                    <p className="text-xs font-black text-emerald-400">Sahip Seçildi ✓</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">ID: {agencyOwnerId}</p>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setAgencyOwnerId('');
                                                        setAgencyOwnerSearch('');
                                                    }}
                                                    className="text-xs font-bold text-slate-500 hover:text-rose-400"
                                                >
                                                    Temizle
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Hızlı Kullanıcı Oluşturma Formu */
                                    <div className="space-y-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5 animate-in slide-in-from-top-4 duration-300">
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Yeni Kullanıcı Kaydı</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Kullanıcı Adı</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Örn: vipowner"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-bold text-white outline-none focus:border-indigo-500"
                                                    value={quickUsername}
                                                    onChange={(e) => setQuickUsername(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Rolü</label>
                                                <select 
                                                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-bold text-white outline-none focus:border-indigo-500"
                                                    value={quickRole}
                                                    onChange={(e) => setQuickRole(e.target.value)}
                                                >
                                                    <option value="operator">Yayıncı / Operatör</option>
                                                    <option value="staff">Personel / Staff</option>
                                                    <option value="moderator">Moderatör</option>
                                                    <option value="admin">Yönetici / Admin</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">E-posta</label>
                                            <input 
                                                type="email" 
                                                placeholder="Örn: owner@agency.com"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-bold text-white outline-none focus:border-indigo-500"
                                                value={quickEmail}
                                                onChange={(e) => setQuickEmail(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Telefon Numarası</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Örn: +905..."
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-bold text-white outline-none focus:border-indigo-500"
                                                    value={quickPhone}
                                                    onChange={(e) => setQuickPhone(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Şifre</label>
                                                <input 
                                                    type="password" 
                                                    placeholder="En az 6 karakter..."
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-bold text-white outline-none focus:border-indigo-500"
                                                    value={quickPassword}
                                                    onChange={(e) => setQuickPassword(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        
                                        <button
                                            type="button"
                                            onClick={handleCreateQuickUser}
                                            disabled={creatingUser}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                        >
                                            {creatingUser ? 'Kullanıcı Yaratılıyor...' : 'Kullanıcı Yarat ve Seç'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Status and Commission Rate in a responsive row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                {/* Status Toggle */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Durum (Status)</label>
                                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl">
                                        <button
                                            type="button"
                                            onClick={() => setAgencyStatus(!agencyStatus)}
                                            className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${agencyStatus ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full transition-all duration-300 ${agencyStatus ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                        <div>
                                            <span className={`text-xs font-black uppercase tracking-wider ${agencyStatus ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                {agencyStatus ? 'Aktif' : 'Pasif'}
                                            </span>
                                            <p className="text-[9px] text-slate-500 font-bold mt-0.5">Ajans gelir üretimine açık</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Commission Rate */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Komisyon Oranı</label>
                                    <input 
                                        type="number" 
                                        step="0.05"
                                        min="0.10"
                                        max="0.90"
                                        placeholder="0.40"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-indigo-500/50 transition-all"
                                        value={agencyCommissionRate}
                                        onChange={(e) => setAgencyCommissionRate(e.target.value)}
                                    />
                                    {/* Quick pricing selectors */}
                                    <div className="flex gap-2 mt-2">
                                        {['0.40', '0.45', '0.50'].map(rate => (
                                            <button
                                                key={rate}
                                                type="button"
                                                onClick={() => setAgencyCommissionRate(rate)}
                                                className={`px-3 py-1 bg-white/5 hover:bg-white/10 border rounded-lg text-[9px] font-black tracking-wider transition-all ${agencyCommissionRate === rate ? 'text-indigo-400 border-indigo-500/50 bg-indigo-500/5' : 'text-slate-500 border-white/5'}`}
                                            >
                                                %{parseFloat(rate) * 100} ({rate})
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Submit & Cancel Buttons */}
                            <div className="pt-6 border-t border-white/5 flex gap-3">
                                <button 
                                    onClick={handleCloseAgencyModal} 
                                    className="flex-1 py-4 rounded-3xl bg-white/5 text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                                >
                                    İptal
                                </button>
                                <button 
                                    onClick={handleCreateAgency} 
                                    className="flex-2 px-8 py-4 rounded-3xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all"
                                >
                                    Kaydet ve Oluştur
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgencyPayouts;
