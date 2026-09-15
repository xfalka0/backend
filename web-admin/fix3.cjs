const fs = require('fs');
const path = 'd:/dating/backend/web-admin/src/pages/Chats.jsx';
let content = fs.readFileSync(path, 'utf8');

const marker = '{showQuickMessages && (';
const idx = content.indexOf(marker);

if (idx !== -1) {
    const head = content.substring(0, idx + marker.length);
    const tail = `
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
                                <input
                                    type="text"
                                    value={input}
                                    onChange={handleTyping}
                                    placeholder={uploading ? "Resim yükleniyor..." : "Mesajınızı yazın..."}
                                    disabled={uploading}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 pl-14 text-sm text-white focus:outline-none focus:border-fuchsia-500 transition-all font-medium disabled:opacity-50"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={uploading || !input.trim()}
                                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-fuchsia-600/20 active:scale-95 disabled:opacity-50 disabled:hover:bg-fuchsia-600"
                            >
                                Gönder
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
                        <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center">
                            <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p className="font-black uppercase tracking-widest text-xs">Sohbet seçilmedi</p>
                    </div>
                )}
            </div >
        </div >
    );
};

export default Chats;
`;
    fs.writeFileSync(path, head + tail);
    console.log('Fixed successfully');
} else {
    console.log('Could not find markers', idx);
}
