import React, { useState } from 'react';
import { Video, Plus, Search, Filter, Play, Trash2, Eye, Calendar, Clock, CheckCircle2 } from 'lucide-react';

const DUMMY_VIDEOS = [
    { id: 1, title: 'Gece Sohbeti #1', operator: 'Selin Yıldız', duration: '00:45', status: 'Aktif', date: '12.01.2024', views: 842 },
    { id: 2, title: 'Haftasonu Enerjisi', operator: 'Can Bartu', duration: '01:12', status: 'Aktif', date: '11.01.2024', views: 421 },
    { id: 3, title: 'Canım Sıkıldı', operator: 'Merve S.', duration: '00:30', status: 'Pasif', date: '10.01.2024', views: 125 },
];

export default function VideosPage() {
    const [showUpload, setShowUpload] = useState(false);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-2">Fake Video Yönetimi</h2>
                    <p className="text-slate-500 font-medium">Aromatik çağrılar için sisteme sahte videolar yükleyin.</p>
                </div>

                <button
                    onClick={() => setShowUpload(!showUpload)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-900/20 flex items-center gap-2"
                >
                    <Plus size={18} /> Yeni Video Yükle
                </button>
            </div>

            {showUpload && (
                <div className="relative group animate-in slide-in-from-top-4 duration-300">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-[32px] blur"></div>
                    <div className="relative bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[30px] p-12 text-center">
                        <div className="max-w-md mx-auto space-y-4">
                            <div className="w-20 h-20 bg-purple-600/20 text-purple-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Video size={40} />
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-widest">Video Dosyasını Seçin</h3>
                            <p className="text-slate-500 text-sm font-medium">MP4, MOV veya WEBM formatında, maksimum 50MB.</p>
                            <label className="mt-8 block cursor-pointer">
                                <span className="inline-block px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest rounded-2xl border border-white/10 transition-all">Gözat</span>
                                <input type="file" className="hidden" accept="video/*" />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Video List */}
            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 rounded-[32px] blur opacity-50"></div>
                <div className="relative bg-slate-900/50 backdrop-blur-2xl border border-white/5 rounded-[30px] overflow-hidden">
                    <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">Kayıtlı Videolar</h3>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                                <input type="text" placeholder="Video ara..." className="bg-white/5 border border-white/10 rounded-lg py-1.5 pl-9 pr-4 text-[10px] text-white focus:outline-none focus:border-purple-500 w-48" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 divide-x divide-y divide-white/5">
                        {DUMMY_VIDEOS.map((video) => (
                            <div key={video.id} className="group/video p-8 hover:bg-white/[0.02] transition-colors relative overflow-hidden">
                                <div className="flex items-start justify-between relative z-10">
                                    <div className="space-y-4 flex-1">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`w-2 h-2 rounded-full ${video.status === 'Aktif' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'}`} />
                                                <h4 className="text-base font-black text-white group-hover/video:text-purple-400 transition-colors uppercase tracking-tight">{video.title}</h4>
                                            </div>
                                            <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-widest">
                                                <CheckCircle2 size={12} className="text-purple-500" /> {video.operator}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Süre</span>
                                                <span className="text-xs font-black text-slate-200 flex items-center gap-1"><Clock size={10} className="text-slate-500" /> {video.duration}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Tarih</span>
                                                <span className="text-xs font-black text-slate-200 flex items-center gap-1"><Calendar size={10} className="text-slate-500" /> {video.date}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">İzlenme</span>
                                                <span className="text-xs font-black text-emerald-500 flex items-center gap-1"><Eye size={10} /> {video.views}</span>
                                            </div>
                                        </div>

                                        <div className="pt-4 flex items-center gap-2">
                                            <button className="flex-1 py-2.5 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                                                <Play size={14} fill="currentColor" /> Önizle
                                            </button>
                                            <button className="p-2.5 bg-white/5 hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 rounded-xl transition-all border border-white/5">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden relative group/thumb ml-4 shrink-0 transition-transform group-hover/video:scale-105">
                                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity z-20">
                                            <Play size={20} className="text-white fill-white" />
                                        </div>
                                        <img src={`https://picsum.photos/seed/${video.id}/200/200`} className="w-full h-full object-cover" alt="" />
                                    </div>
                                </div>

                                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl group-hover/video:bg-purple-500/10 transition-colors" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
