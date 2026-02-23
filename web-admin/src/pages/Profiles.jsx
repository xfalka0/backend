import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Search, Filter, Camera, Trash2, Edit3, CheckCircle, XCircle, Briefcase, GraduationCap, Heart, Hash, Loader2, Crown } from 'lucide-react';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://backend-kj17.onrender.com/api'
    : '/api';

export default function ProfilesPage() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const fileInputRef = useRef(null);
    const albumInputRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({
        gender: 'kadin',
        photos: [],
        age: 18,
        vip_level: 0,
        job: '',
        relationship: '',
        zodiac: '',
        interests: '[]'
    });

    const [hobbies, setHobbies] = useState([]);
    const [newHobby, setNewHobby] = useState('');

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/operators`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProfiles(res.data);
        } catch (err) {
            console.error("Fetch Profiles Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploading(true);
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            setFormData(prev => ({ ...prev, avatar_url: res.data.url }));
        } catch (err) {
            console.error("Upload Error Full:", err);
            console.error("Server Response:", err.response?.data);
            const msg = err.response?.data?.error || err.message;
            alert('Resim yüklenirken bir hata oluştu: ' + msg);
        } finally {
            setUploading(false);
        }
    };

    const addHobby = () => {
        if (newHobby.trim()) {
            setHobbies([...hobbies, newHobby.trim()]);
            setNewHobby('');
        }
    };

    const handleAlbumUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            setUploading(true);
            const token = localStorage.getItem('token');
            const uploadPromises = files.map(file => {
                const fData = new FormData();
                fData.append('file', file);
                return axios.post(`${API_URL}/upload`, fData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${token}`
                    }
                });
            });

            const responses = await Promise.all(uploadPromises);
            const newUrls = responses.map(res => res.data.url);

            setFormData(prev => ({
                ...prev,
                photos: [...(prev.photos || []), ...newUrls]
            }));
        } catch (err) {
            console.error("Album Upload Error Full:", err);
            console.error("Server Response:", err.response?.data);
            alert(`Albüm resimleri yüklenirken hata oluştu: ${err.response?.data?.error || err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (profile) => {
        setEditingId(profile.id);
        const ints = profile.interests ? (Array.isArray(profile.interests) ? JSON.stringify(profile.interests) : profile.interests) : '[]';
        setFormData({
            name: profile.name,
            job: profile.job || '',
            category: profile.category || 'Flirty',
            bio: profile.bio || '',
            avatar_url: profile.avatar_url,
            gender: profile.gender || 'kadin',
            photos: profile.photos || [],
            age: profile.age || 18,
            vip_level: profile.vip_level || 0,
            relationship: profile.relationship || '',
            zodiac: profile.zodiac || '',
            interests: ints // Store as stringified JSON in form
        });
        setHobbies(profile.category ? [profile.category] : []);
        setShowAddForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.avatar_url) {
            alert('Lütfen bir profil fotoğrafı yükleyin.');
            return;
        }

        try {
            const dataToSend = {
                ...formData,
                category: hobbies.length > 0 ? hobbies[0] : formData.category,
                bio: formData.bio || 'Merhaba! Sohbet etmeyi bekliyorum.',
            };

            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            if (editingId) {
                await axios.put(`${API_URL}/operators/${editingId}`, dataToSend, { headers });
                alert('Profil başarıyla güncellendi!');
            } else {
                await axios.post(`${API_URL}/operators`, dataToSend, { headers });
                alert('Profil başarıyla oluşturuldu!');
            }

            setShowAddForm(false);
            setEditingId(null);
            setFormData({
                name: '',
                job: '',
                category: 'Flirty',
                bio: '',
                avatar_url: '',
                gender: 'kadin',
                photos: [],
                age: 18,
                vip_level: 0,
                relationship: '',
                zodiac: '',
                interests: '[]'
            });
            setHobbies([]);
            fetchProfiles();
        } catch (err) {
            console.error("Submit Error:", err);
            const msg = err.response?.data?.error || err.message;
            alert(`Profil ${editingId ? 'güncellenirken' : 'oluşturulurken'} bir hata oluştu: ` + msg);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu profili silmek istediğinize emin misiniz? Not: Veri güvenliği gereği profil tamamen silinmez, sadece yayından kaldırılır ve arşivlenir.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/operators/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Profil silindi.');
            fetchProfiles(); // Refresh list
        } catch (err) {
            console.error("Delete Error:", err);
            alert('Silme işlemi başarısız: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Profiller</h2>
                    <p className="text-slate-500 font-medium">Uygulamada gösterilen ana vitrin profilleri yönetin.</p>
                </div>

                <button
                    onClick={() => {
                        if (showAddForm) {
                            setFormData({ name: '', job: '', category: 'Flirty', bio: '', avatar_url: '', gender: 'kadin', photos: [], age: 18, vip_level: 0, relationship: '', zodiac: '', interests: '[]' });
                            setHobbies([]);
                        }
                        setShowAddForm(!showAddForm);
                    }}
                    className={`px-6 py-3 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-xl ${showAddForm ? 'bg-slate-800 text-white' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-900/20'
                        }`}
                >
                    {showAddForm ? <XCircle size={18} /> : <Plus size={18} />}
                    <span>{showAddForm ? 'İptal Et' : 'Yeni Profil Oluştur'}</span>
                </button>
            </div>

            {showAddForm && (
                <div className="relative group animate-in slide-in-from-top-4 duration-300">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-rose-500/20 rounded-[32px] blur"></div>
                    <div className="relative bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[30px] p-8">
                        <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
                            <Plus className="text-purple-400" /> Profil Verilerini Girin
                        </h3>

                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div
                                        onClick={() => fileInputRef.current.click()}
                                        className="group/avatar relative w-40 h-40 rounded-3xl overflow-hidden border-2 border-dashed border-white/20 hover:border-purple-500/50 transition-all cursor-pointer bg-slate-800/50 flex flex-col items-center justify-center"
                                    >
                                        {uploading ? (
                                            <Loader2 className="animate-spin text-purple-500" size={32} />
                                        ) : formData.avatar_url ? (
                                            <img src={formData.avatar_url} className="w-full h-full object-cover" alt="Avatar Preview" />
                                        ) : (
                                            <>
                                                <Camera className="text-slate-600 mb-2 group-hover/avatar:text-purple-400 transition-colors" size={32} />
                                                <span className="text-[10px] font-black uppercase text-slate-500 group-hover/avatar:text-purple-300">Fotoğraf Yükle</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest">Tam İsim</p>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-bold"
                                                placeholder="Örn: Selin Yıldız"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="relative">
                                                <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest">Cinsiyet</p>
                                                <select
                                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none transition-all text-white font-bold"
                                                    value={formData.gender}
                                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                                >
                                                    <option value="kadin">Kadın</option>
                                                    <option value="erkek">Erkek</option>
                                                </select>
                                            </div>
                                            <div className="relative">
                                                <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest">Yaş</p>
                                                <input
                                                    type="number"
                                                    required
                                                    min="18"
                                                    max="99"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-white font-bold"
                                                    value={formData.age}
                                                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest">VIP Seviyesi</p>
                                            <select
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none transition-all text-amber-400 font-black"
                                                value={formData.vip_level}
                                                onChange={(e) => setFormData({ ...formData, vip_level: parseInt(e.target.value) })}
                                            >
                                                <option value="0">Normal Kullanıcı</option>
                                                <option value="1">VIP 1</option>
                                                <option value="2">VIP 2</option>
                                                <option value="3">VIP 3</option>
                                                <option value="4">VIP 4</option>
                                                <option value="5">VIP 5</option>
                                                <option value="6">VIP 6</option>
                                            </select>
                                        </div>
                                        <div className="relative">
                                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest">Meslek</p>
                                            <div className="relative">
                                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                                                <input
                                                    type="text"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                                    placeholder="Örn: Avukat"
                                                    value={formData.job}
                                                    onChange={(e) => setFormData({ ...formData, job: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest">Burç</p>
                                            <select
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none transition-all text-white font-bold"
                                                value={formData.zodiac || ''}
                                                onChange={(e) => setFormData({ ...formData, zodiac: e.target.value })}
                                            >
                                                <option value="">Seçiniz</option>
                                                <option value="Koç">Koç (Aries)</option>
                                                <option value="Boğa">Boğa (Taurus)</option>
                                                <option value="İkizler">İkizler (Gemini)</option>
                                                <option value="Yengeç">Yengeç (Cancer)</option>
                                                <option value="Aslan">Aslan (Leo)</option>
                                                <option value="Başak">Başak (Virgo)</option>
                                                <option value="Terazi">Terazi (Libra)</option>
                                                <option value="Akrep">Akrep (Scorpio)</option>
                                                <option value="Yay">Yay (Sagittarius)</option>
                                                <option value="Oğlak">Oğlak (Capricorn)</option>
                                                <option value="Kova">Kova (Aquarius)</option>
                                                <option value="Balık">Balık (Pisces)</option>
                                            </select>
                                        </div>
                                        <div className="relative">
                                            <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest">İlişki Durumu</p>
                                            <select
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none transition-all text-white font-bold"
                                                value={formData.relationship || ''}
                                                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                                            >
                                                <option value="">Seçiniz</option>
                                                <option value="Bekar">Bekar</option>
                                                <option value="İlişkisi Var">İlişkisi Var</option>
                                                <option value="Nişanlı">Nişanlı</option>
                                                <option value="Evli">Evli</option>
                                                <option value="Karmaşık">Karmaşık</option>
                                                <option value="Arkadaşlık">Arkadaşlık Arıyor</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest flex items-center gap-2">
                                            <Hash size={12} className="text-purple-400" /> Kategori / Unvan
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newHobby}
                                                onChange={(e) => setNewHobby(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHobby())}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-all"
                                                placeholder="Örn: Flirty, Gamer..."
                                            />
                                            <button type="button" onClick={addHobby} className="p-2 bg-purple-600 rounded-xl hover:bg-purple-500 transition-all"><Plus size={20} /></button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {hobbies.map(h => (
                                                <span key={h} className="group flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-black uppercase rounded-lg">
                                                    {h}
                                                    <XCircle size={10} className="hover:text-rose-500 cursor-pointer" onClick={() => setHobbies(hobbies.filter(i => i !== h))} />
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-slate-600">Bu alan profilin ana kategorisini belirler (tek seçim önerilir).</p>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest flex items-center gap-2">
                                            <Heart size={12} className="text-pink-400" /> İlgi Alanları (Yeni)
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                id="interestInput"
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-pink-500 transition-all"
                                                placeholder="Örn: Yüzme, Kitap, Müzik..."
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const val = e.target.value.trim();
                                                        if (val) {
                                                            const current = formData.interests ? (Array.isArray(formData.interests) ? formData.interests : JSON.parse(formData.interests || '[]')) : [];
                                                            setFormData({ ...formData, interests: JSON.stringify([...current, val]) });
                                                            e.target.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <button type="button" onClick={() => {
                                                const input = document.getElementById('interestInput');
                                                const val = input.value.trim();
                                                if (val) {
                                                    const current = formData.interests ? (Array.isArray(formData.interests) ? formData.interests : JSON.parse(formData.interests || '[]')) : [];
                                                    setFormData({ ...formData, interests: JSON.stringify([...current, val]) });
                                                    input.value = '';
                                                }
                                            }} className="p-2 bg-pink-600 rounded-xl hover:bg-pink-500 transition-all"><Plus size={20} /></button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {(formData.interests ? (Array.isArray(formData.interests) ? formData.interests : JSON.parse(formData.interests || '[]')) : []).map((int, i) => (
                                                <span key={i} className="group flex items-center gap-1.5 px-3 py-1 bg-pink-500/10 text-pink-400 border border-pink-500/20 text-[10px] font-black uppercase rounded-lg">
                                                    {int}
                                                    <XCircle size={10} className="hover:text-rose-500 cursor-pointer" onClick={() => {
                                                        const current = formData.interests ? (Array.isArray(formData.interests) ? formData.interests : JSON.parse(formData.interests || '[]')) : [];
                                                        const filtered = current.filter((_, idx) => idx !== i);
                                                        setFormData({ ...formData, interests: JSON.stringify(filtered) });
                                                    }} />
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1 ml-1 tracking-widest">Biyografi (Bio)</p>
                                        <textarea
                                            rows="4"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none"
                                            placeholder="Kısa bir açıklama..."
                                            value={formData.bio}
                                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        />
                                    </div>

                                    <div className="relative pt-4">
                                        <p className="text-[10px] font-black uppercase text-slate-500 mb-3 ml-1 tracking-widest">Fotoğraf Albümü</p>
                                        <div className="grid grid-cols-4 gap-4">
                                            {(formData.photos || []).map((url, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group/photo">
                                                    <img src={url} className="w-full h-full object-cover" alt="" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                                                        className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-md opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => albumInputRef.current.click()}
                                                className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center hover:border-purple-500/50 hover:bg-white/5 transition-all"
                                            >
                                                <Plus size={20} className="text-slate-500" />
                                                <span className="text-[8px] font-black uppercase text-slate-500 mt-1">Ekle</span>
                                            </button>
                                        </div>
                                        <input
                                            type="file"
                                            ref={albumInputRef}
                                            className="hidden"
                                            multiple
                                            accept="image/*"
                                            onChange={handleAlbumUpload}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="px-10 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-2xl shadow-purple-900/40 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {uploading ? 'Yükleniyor...' : editingId ? 'Değişiklikleri Kaydet' : 'Profili Yayınla'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Profiles Grid */}
            {loading ? (
                <div className="flex items-center justify-center p-20">
                    <Loader2 className="animate-spin text-purple-500" size={40} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {profiles.map((profile) => (
                        <div key={profile.id} className="group relative">
                            <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-[32px] blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-[30px] overflow-hidden group-hover:border-white/10 transition-all border-b-4 border-b-purple-500/20">
                                <div className="relative aspect-[3/4] overflow-hidden">
                                    <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=random&color=fff`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                                    <div className="absolute top-4 left-4">
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-wider ${profile.is_online || profile.id > 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${profile.is_online || profile.id > 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-500'}`} />
                                            {profile.is_online || profile.id > 100 ? 'Açık' : 'Kapalı'}
                                        </div>
                                    </div>

                                    <div className="absolute bottom-6 left-6 right-6">
                                        <h4 className="text-xl font-black text-white leading-tight">{profile.name}, {profile.age || '??'}</h4>
                                        <p className="text-sm font-bold text-slate-300 opacity-80">{profile.category} • {profile.gender === 'kadin' ? 'K' : 'E'}</p>
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {profile.vip_level > 0 && <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1"><Crown size={10} /> VIP{profile.vip_level}</span>}
                                            {profile.role === 'operator' && <span className="text-[9px] font-black uppercase text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/10">SİSTEM PROFİLİ</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex gap-1.5">
                                        <button className="p-2.5 bg-white/5 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded-xl border border-white/5 transition-all"><CheckCircle size={18} /></button>
                                        <button
                                            onClick={() => handleEdit(profile)}
                                            className="p-2.5 bg-white/5 hover:bg-amber-500/10 text-slate-400 hover:text-amber-500 rounded-xl border border-white/5 transition-all"
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(profile.id)}
                                        className="p-2.5 bg-white/5 hover:bg-rose-500 text-slate-400 hover:text-white rounded-xl border border-white/5 transition-all shadow-lg active:scale-95"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                    }

                    <button
                        onClick={() => setShowAddForm(true)}
                        className="group relative h-full min-h-[400px]"
                    >
                        <div className="absolute inset-0 border-4 border-dashed border-white/5 group-hover:border-purple-500/30 rounded-[30px] transition-all flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] group-hover:bg-purple-500/5">
                            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-2xl mb-4 group-hover:scale-110">
                                <Plus size={32} />
                            </div>
                            <p className="font-black text-slate-500 group-hover:text-white transition-colors uppercase tracking-widest">Profil Ekle</p>
                            <p className="text-sm text-slate-600 mt-2 font-medium">Yeni bir operatör veya vitrin profili oluşturun.</p>
                        </div>
                    </button>
                </div >
            )}
        </div >
    );
}
