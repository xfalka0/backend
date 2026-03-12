import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const result = await login(email, password);
        if (result.success) {
            navigate('/');
        } else {
            setError(result.error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white relative overflow-hidden">
            {/* Background Particles (Subset of Splash) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
                {[...Array(25)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full animate-spark-slow flicker-fast"
                        style={{
                            width: (Math.random() * 3 + 1) + 'px',
                            height: (Math.random() * 3 + 1) + 'px',
                            left: Math.random() * 100 + '%',
                            top: (Math.random() * 100 + 50) + '%',
                            background: ['#ff4d00', '#ff9900', '#ffcc00'][Math.floor(Math.random() * 3)],
                            boxShadow: `0 0 8px ${['#ff4d00', '#ff9900', '#ffcc00'][Math.floor(Math.random() * 3)]}`,
                            animationDelay: (Math.random() * 5) + 's',
                            animationDuration: (Math.random() * 10 + 10) + 's'
                        }}
                    />
                ))}
            </div>

            {/* Glowing background light */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-600/5 blur-[120px] rounded-full" />

            <div className="relative z-10 w-full max-w-md px-6 animate-in fade-in zoom-in duration-1000">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-sans font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 mb-2">
                        Falka Software
                    </h1>
                    <div className="h-[2px] w-12 bg-pink-600 mx-auto rounded-full mb-4" />
                    <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500">
                        Falka, at the heart of the future.
                    </p>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-2xl p-8 rounded-[40px] border border-white/5 shadow-2xl">
                    <h2 className="text-xl font-bold mb-8 text-center text-white/90">Yönetim Merkeze Bağlan</h2>

                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl mb-6 text-sm font-medium text-center animate-shake">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-posta</label>
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/5 rounded-[20px] px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-pink-600/50 transition-all font-medium"
                                placeholder="E-posta adresiniz"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Şifre</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/5 rounded-[20px] px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-pink-600/50 transition-all font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full mt-4 bg-gradient-to-br from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 text-white font-black text-xs uppercase tracking-[0.2em] py-5 rounded-[20px] shadow-[0_10px_30px_rgba(219,39,119,0.3)] hover:shadow-pink-600/40 transition-all active:scale-[0.98]"
                        >
                            Giriş Yap
                        </button>
                    </form>
                </div>
                
                <p className="mt-8 text-center text-[10px] font-black text-slate-700 uppercase tracking-widest">
                    &copy; 2026 FALKA SOFTWARE • SECURITY ENFORCED
                </p>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes spark-slow {
                    0% { transform: translateY(0) translateX(0); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translateY(-120vh) translateX(30px); opacity: 0; }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                @keyframes flicker-fast {
                    0%, 100% { opacity: 1; filter: brightness(1); }
                    50% { opacity: 0.6; filter: brightness(1.5); }
                }
                .animate-spark-slow { animation: spark-slow linear infinite; }
                .flicker-fast { animation: flicker-fast 0.1s infinite; }
                .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
            `}} />
        </div>
    );
}
