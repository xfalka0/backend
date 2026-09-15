const fs = require('fs');

const path = 'd:/dating/backend/web-admin/src/pages/Chats.jsx';
let content = fs.readFileSync(path, 'utf8');

const marker1 = '{showQuickMessages && (';
const marker2 = '<input\\n                                type="text"\\n                                value={input}';

const idx1 = content.indexOf(marker1);
const idx2 = content.indexOf('<input\n                                type="text"');

if (idx1 !== -1 && idx2 !== -1) {
    const head = content.substring(0, idx1 + marker1.length);
    const tail = content.substring(idx2);
    const middle = `
                                    <div className="absolute bottom-[calc(100%+12px)] left-0 z-30 w-72 rounded-2xl border border-fuchsia-400/30 bg-slate-900 p-2 shadow-2xl shadow-fuchsia-950/40">
                                        <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-fuchsia-300">Hazır mesajlar</p>
                                        {['Merhaba, nasılsın?', 'Sana nasıl yardımcı olabilirim?', 'Mesajını aldım, hemen ilgileniyorum.', 'Güzel bir gün dilerim ✨'].map((message) => (
                                            <button key={message} type="button" onClick={() => sendQuickMessage(message)} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-200 transition hover:bg-fuchsia-500/20 hover:text-white">
                                                {message}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                            <div className="flex flex-col items-center justify-center gap-1">
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={sendLocationMessage}
                                        disabled={uploading}
                                        title="Konum Gönder"
                                        className="p-3 rounded-xl border border-white/10 transition-all hover:bg-white/5 active:scale-95 text-slate-400"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        title="Resim Gönder"
                                        className={\`p-3 rounded-xl border border-white/10 transition-all hover:bg-white/5 active:scale-95 \${uploading ? 'animate-pulse opacity-50' : ''} \${isLockedImage ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500' : 'text-slate-400'}\`}
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex items-center gap-1">
                                    <label className="flex items-center gap-1 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={isLockedImage}
                                            onChange={(e) => setIsLockedImage(e.target.checked)}
                                            className="w-3 h-3 rounded bg-slate-800 border-white/20 text-yellow-500 focus:ring-yellow-500/50 cursor-pointer"
                                        />
                                        <span className="text-[9px] font-black uppercase text-slate-500 group-hover:text-yellow-500 transition-colors">Ücretli</span>
                                    </label>
                                    {isLockedImage && (
                                        <span className="text-[10px] font-black text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded ml-1">200 Coin</span>
                                    )}
                                </div>
                            </div>
                            `;
    fs.writeFileSync(path, head + middle + tail);
    console.log('Fixed successfully');
} else {
    console.log('Could not find markers', idx1, idx2);
}
