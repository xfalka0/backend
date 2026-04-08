
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
    MoreHorizontal
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const AgencyPayouts = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState({ total_pending: 0, total_lifetime: 0, total_paid: 0 });
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [payoutModal, setPayoutModal] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutMethod, setPayoutMethod] = useState('Papara');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [statsRes, opsRes] = await Promise.all([
                axios.get(`${API_URL}/admin/payouts/summary`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/admin/operators/earnings`, { headers: { Authorization: `Bearer ${token}` } })
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
            await axios.post(`${API_URL}/admin/operators/${selectedOperator.id}/payout`, {
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
        op.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        op.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const StatCard = ({ title, value, icon: Icon, color, subValue }) => (
        <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/5 p-6 rounded-[32px] relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-600/10 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-${color}-600/20 transition-all duration-700`} />
            <div className="flex items-start justify-between relative z-10">
                <div>
                    <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1">{title}</p>
                    <h3 className="text-3xl font-black text-white tracking-tighter">
                        {value.toLocaleString()} <span className="text-sm font-bold text-slate-600 ml-1">COIN</span>
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
                        Personel <span className="text-blue-500">Yönetimi</span>
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">Personel performansını ve ödeme dengesini yönetin.</p>
                </div>
                <div className="flex items-center gap-3">
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
                subValue={`Yaklaşık ${((stats.total_pending || 0) * 0.5).toLocaleString('tr-TR')} TL`}
            />
            <StatCard 
                title="Toplam Ödenen" 
                value={stats.total_paid || 0} 
                icon={CheckCircle2} 
                color="emerald"
                subValue={`${((stats.total_paid || 0) * 0.5).toLocaleString('tr-TR')} TL ödeme yapıldı`}
            />
            <StatCard 
                title="Ajans Toplam Ciro" 
                value={stats.total_lifetime || 0} 
                icon={TrendingUp} 
                color="indigo"
                subValue={`Brüt: ${((stats.total_lifetime || 0) * 0.5).toLocaleString('tr-TR')} TL`}
            />
        </div>

            {/* Operator List Table */}
            <div className="bg-slate-900/50 backdrop-blur-3xl border border-white/5 rounded-[40px] overflow-hidden">
                <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-white px-2">Personel Performansı</h2>
                        <span className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-full uppercase">
                            {operators.length} AKTİF OPERATÖR
                        </span>
                    </div>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Personel veya Avatar Ara..."
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
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Operatör / Personel</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Zimmetli</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Bekleyen</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Toplam Kazanç</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Son Aktivite</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-slate-500 font-bold uppercase tracking-widest italic animate-pulse">
                                        Finansal veriler yükleniyor...
                                    </td>
                                </tr>
                            ) : filteredOperators.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-slate-500 font-bold tracking-widest">
                                        Hiç operatör bulunamadı.
                                    </td>
                                </tr>
                            ) : filteredOperators.map((op) => (
                                <tr key={op.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px]">
                                                <div className="w-full h-full rounded-[14px] bg-slate-950 overflow-hidden">
                                                    <img src={op.avatar_url || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white capitalize">{op.display_name || op.username}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{op.username}</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${op.pending_balance > 5000 ? 'bg-orange-500/10 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                                                        %{op.commission_rate * 100} KOMİSYON
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex justify-center">
                                            <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-slate-400">
                                                {op.total_messages || 0} Mesaj
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className={`text-sm font-black tracking-tighter ${op.pending_balance > 1000 ? 'text-blue-400' : 'text-white'}`}>
                                            {op.pending_balance?.toLocaleString()} 
                                            <span className="text-[10px] text-slate-600 ml-1">COIN</span>
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">
                                            ≈ {(op.pending_balance * 0.5).toLocaleString('tr-TR')} TRY
                                        </p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className="text-sm font-black text-slate-300 tracking-tighter">
                                            {op.lifetime_earnings?.toLocaleString()} 
                                            <span className="text-[10px] text-slate-700 ml-1">COIN</span>
                                        </p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Clock size={12} className={op.last_active_at && (new Date() - new Date(op.last_active_at) < 5 * 60000) ? "text-emerald-500" : "text-slate-600"} />
                                            <span className={`text-[11px] font-bold ${op.last_active_at && (new Date() - new Date(op.last_active_at) < 5 * 60000) ? "text-emerald-400" : "text-slate-400"}`}>
                                                {op.last_active_at ? new Date(op.last_active_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Pasif'}
                                            </span>
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-600 mt-1 uppercase tracking-tight">
                                           {op.last_active_at ? new Date(op.last_active_at).toLocaleDateString('tr-TR') : '-'}
                                        </p>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button 
                                            onClick={() => {
                                                setSelectedOperator(op);
                                                setPayoutAmount(op.pending_balance);
                                                setPayoutModal(true);
                                            }}
                                            className="px-4 py-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-xl uppercase hover:bg-blue-600 hover:text-white transition-all"
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
                            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">{selectedOperator?.display_name || selectedOperator?.username}</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Ödenecek Tutar (COIN)</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-2xl font-black text-white outline-none focus:border-blue-500/50 transition-all"
                                    value={payoutAmount}
                                    onChange={(e) => setPayoutAmount(e.target.value)}
                                />
                                <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tight">Kalan Borç: {Math.max(0, selectedOperator.pending_balance - payoutAmount).toLocaleString()} Coin</p>
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
        </div>
    );
};

export default AgencyPayouts;
