import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Users, 
    Calendar, 
    TrendingUp, 
    MessageCircle, 
    Image as ImageIcon, 
    Gift, 
    Mic, 
    DollarSign,
    Search,
    Filter,
    Clock,
    Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = '';

const StaffActivity = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('daily'); // daily, logs
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, logsRes] = await Promise.all([
                axios.get(`${API_URL}/api/admin/staff-activity`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/admin/commission-logs`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setStats(statsRes.data);
            setLogs(logsRes.data);
        } catch (err) {
            console.error('Error fetching staff activity:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredStats = stats.filter(s => 
        s.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredLogs = logs.filter(l => 
        l.operator_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const StatCard = ({ title, value, icon, color }) => (
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl relative overflow-hidden group hover:bg-slate-900 transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/10 blur-3xl -mr-8 -mt-8`}></div>
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
                    <h4 className="text-2xl font-black text-white italic">{value}</h4>
                </div>
                <div className={`p-3 bg-${color}-500/20 text-${color}-400 rounded-2xl`}>
                    {icon}
                </div>
            </div>
        </div>
    );

    if (loading) return <div className="p-8 text-white font-black italic animate-pulse">Veriler hazırlanıyor...</div>;

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Personel Çalışma Takibi</h2>
                    <p className="text-slate-500 font-medium">Personellerin günlük performansını ve kazançlarını anlık takip edin.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-slate-900/50 border border-white/5 p-1 rounded-2xl flex">
                        <button 
                            onClick={() => setActiveTab('daily')}
                            className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'daily' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <TrendingUp size={14} className="inline mr-2" /> Günlük Özet
                        </button>
                        <button 
                            onClick={() => setActiveTab('logs')}
                            className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Activity size={14} className="inline mr-2" /> Detaylı Loglar
                        </button>
                    </div>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Personel veya kullanıcı ara..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                    />
                </div>
                <button onClick={fetchData} className="p-3.5 bg-white/5 border border-white/10 text-white rounded-2xl hover:bg-white/10 transition-all">
                    <Calendar size={20} />
                </button>
            </div>

            {activeTab === 'daily' ? (
                <div className="grid grid-cols-1 gap-6">
                    {/* Stats Table */}
                    <div className="bg-slate-900/50 border border-white/5 rounded-[32px] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/[0.01]">
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Personel</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Tarih</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Msj Sayısı</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Msj (TL)</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Foto (TL)</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Ses (TL)</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Hediye (TL)</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">TOPLAM KAZANÇ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredStats.map((s, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                                                        <img src={s.avatar_url || 'https://via.placeholder.com/150'} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-white group-hover:text-blue-400 transition-colors uppercase italic">{s.display_name || s.username}</p>
                                                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">{s.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center text-[11px] font-black text-slate-400 uppercase">
                                                {new Date(s.date).toLocaleDateString('tr-TR')}
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <div className="inline-flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-white/5">
                                                    <MessageCircle size={12} className="text-slate-500" />
                                                    <span className="text-xs font-black text-white">{s.messages_sent}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-center text-xs font-bold text-slate-400">₺{parseFloat(s.text_earned).toFixed(2)}</td>
                                            <td className="px-8 py-6 text-center text-xs font-bold text-slate-400">₺{parseFloat(s.image_earned).toFixed(2)}</td>
                                            <td className="px-8 py-6 text-center text-xs font-bold text-slate-400">₺{parseFloat(s.audio_earned).toFixed(2)}</td>
                                            <td className="px-8 py-6 text-center text-xs font-bold text-slate-400">₺{parseFloat(s.gift_earned).toFixed(2)}</td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="inline-flex flex-col items-end">
                                                    <span className="text-lg font-black text-emerald-400 tabular-nums">₺{parseFloat(s.coins_earned).toFixed(2)}</span>
                                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Kayıtlı Hak</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900/50 border border-white/5 rounded-[32px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.01]">
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Personel</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500">Müşteri</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Tür</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Zaman</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Kazanç (TL)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLogs.map((log, idx) => (
                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-black text-white uppercase italic">{log.operator_name}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-bold text-slate-400">{log.customer_name}</span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                                log.type === 'text' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                log.type === 'image' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                                                log.type === 'gift' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                                'bg-slate-500/10 border-slate-500/20 text-slate-400'
                                            }`}>
                                                {log.type === 'text' ? 'Mesaj' : log.type === 'image' ? 'Foto' : log.type === 'gift' ? 'Hediye' : log.type}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-slate-500">{new Date(log.created_at).toLocaleTimeString('tr-TR')}</span>
                                                <span className="text-[9px] text-slate-700">{new Date(log.created_at).toLocaleDateString('tr-TR')}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right font-black text-emerald-400 italic">
                                            + ₺{parseFloat(log.amount).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffActivity;
