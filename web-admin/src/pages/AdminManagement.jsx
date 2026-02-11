import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminManagement() {
    const { token } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [newData, setNewData] = useState({ username: '', email: '', password: '', role: 'moderator' });
    const [error, setError] = useState('');

    const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/staff`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                // Show ONLY Admins and Moderators (Hide Operators)
                setUsers(data.filter(u => u.role !== 'operator'));
            }
        } catch (err) {
            console.error("Fetch admins error:", err);
            setError("Liste yüklenirken hata oluştu: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch(`${API_URL}/api/admin/staff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newData)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Oluşturma başarısız');

            setShowModal(false);
            setNewData({ username: '', email: '', password: '', role: 'moderator' });
            fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        try {
            await fetch(`${API_URL}/api/admin/staff/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchUsers();
        } catch (err) {
            alert('Silme başarısız: ' + err.message);
        }
    };

    if (loading) return <div className="p-8">Yükleniyor...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white">Yetkili Yönetimi</h1>
                    <p className="text-slate-500 mt-2">Sadece Yönetici ve Moderatör hesaplarını yönetin</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded font-bold"
                >
                    + Yeni Personel Ekle
                </button>
            </div>

            <div className="bg-slate-900 rounded-xl overflow-hidden border border-white/5">
                {error && !showModal && <div className="bg-red-500/10 text-red-400 p-4 border-b border-red-500/20 text-center font-bold">{error}</div>}
                <table className="w-full text-left">
                    <thead className="bg-slate-800 text-slate-400 text-xs uppercase font-bold">
                        <tr>
                            <th className="p-4">Kullanıcı Adı</th>
                            <th className="p-4">E-posta</th>
                            <th className="p-4">Rol</th>
                            <th className="p-4 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-white/5 transition">
                                <td className="p-4 font-bold text-white">{user.username}</td>
                                <td className="p-4 text-slate-400">{user.email}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                                        user.role === 'moderator' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="text-red-400 hover:text-red-300 font-bold text-xs"
                                    >
                                        SİL
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan="4" className="p-8 text-center text-slate-500">
                                    Henüz yetkili personel bulunmuyor.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-8 rounded-xl max-w-md w-full border border-white/10">
                        <h2 className="text-2xl font-bold text-white mb-6">Yeni Personel Ekle</h2>

                        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Kullanıcı Adı</label>
                                <input
                                    className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white focus:outline-none focus:border-pink-500"
                                    value={newData.username}
                                    onChange={e => setNewData({ ...newData, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">E-posta</label>
                                <input
                                    className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white focus:outline-none focus:border-pink-500"
                                    value={newData.email}
                                    onChange={e => setNewData({ ...newData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Şifre</label>
                                <input
                                    type="password"
                                    className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white focus:outline-none focus:border-pink-500"
                                    value={newData.password}
                                    onChange={e => setNewData({ ...newData, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Rol</label>
                                <select
                                    className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white focus:outline-none focus:border-pink-500"
                                    value={newData.role}
                                    onChange={e => setNewData({ ...newData, role: e.target.value })}
                                >
                                    <option value="moderator">Moderatör</option>
                                    <option value="admin">Yönetici</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="text-slate-400 hover:text-white font-bold text-sm px-4"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded font-bold"
                                >
                                    Oluştur
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
