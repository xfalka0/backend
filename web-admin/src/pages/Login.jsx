import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const { login } = useAuth();
    const navigate = useNavigate();
    const containerRef = useRef(null);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (containerRef.current) {
                const { left, top } = containerRef.current.getBoundingClientRect();
                setMousePos({ x: e.clientX - left, y: e.clientY - top });
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

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
        <div ref={containerRef} className="min-h-screen flex items-center justify-center bg-[#020617] text-white relative overflow-hidden animate-bg-pulse">
            {/* Mouse Follower Glow - Fixed Positioning */}
            <div 
                className="pointer-events-none absolute top-0 left-0 z-0 w-[600px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full transition-transform duration-500 ease-out"
                style={{
                    transform: `translate(${mousePos.x - 300}px, ${mousePos.y - 300}px)`,
                    willChange: 'transform'
                }}
            />

            {/* Background Particles (Subset of Splash) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60 z-10">
                {[...Array(40)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full spark-particle"
                        style={{
                            width: (Math.random() * 3 + 1) + 'px',
                            height: (Math.random() * 3 + 1) + 'px',
                            left: Math.random() * 100 + '%',
                            top: (Math.random() * 100 + 10) + '%',
                            background: ['#3b82f6', '#6366f1', '#ffffff'][Math.floor(Math.random() * 3)],
                            boxShadow: `0 0 15px ${['#3b82f6', '#6366f1', '#ffffff'][Math.floor(Math.random() * 3)]}`,
                            animationDelay: (Math.random() * -20) + 's',
                            animationDuration: (Math.random() * 10 + 5) + 's'
                        }}
                    />
                ))}
            </div>

            {/* Glowing background light - Pure Blue Atmosphere */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 blur-[150px] rounded-full animate-glow-pulse" />

            <div className="relative z-10 w-full max-w-md px-6 animate-in fade-in zoom-in duration-1000">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-sans font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-500 to-white bg-[length:200%_auto] animate-gradient-text mb-2">
                        Falka Software
                    </h1>
                    <div className="h-[2px] w-12 bg-blue-600 mx-auto rounded-full mb-4" />
                    <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500">
                        Falka, at the heart of the future.
                    </p>
                </div>

                <div className="premium-card p-10 border-blue-500/10 shadow-2xl">
                    <h2 className="text-xl font-bold mb-8 text-center text-white/90">Yönetim Merkezine Bağlan</h2>

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
                                className="w-full bg-slate-950/50 border border-white/5 rounded-[20px] px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-600/50 transition-all font-medium"
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
                                className="w-full bg-slate-950/50 border border-white/5 rounded-[20px] px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-600/50 transition-all font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full mt-4 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] py-5 rounded-[20px] shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:shadow-blue-600/40 transition-all active:scale-[0.98]"
                        >
                            Giriş Yap
                        </button>
                    </form>
                </div>
                
                <p className="mt-8 text-center text-[10px] font-black text-slate-700 uppercase tracking-widest">
                    &copy; 2024 FALKA SOFTWARE • SECURITY ENFORCED
                </p>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bg-pulse-bg {
                    0% { background-color: #020617; } /* Deep Black-Blue */
                    50% { background-color: #050a2d; } /* Deep vibrant Navy - stays blue, not grey */
                    100% { background-color: #020617; }
                }
                @keyframes spark-float {
                    0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translateY(-120vh) translateX(30px) scale(0.5); opacity: 0; }
                }
                @keyframes spark-flicker {
                    0%, 100% { opacity: 1; filter: brightness(1.2); }
                    50% { opacity: 0.6; filter: brightness(1.8); }
                }
                @keyframes gradient-text-anim {
                    0% { background-position: 0% center; }
                    50% { background-position: 100% center; }
                    100% { background-position: 0% center; }
                }
                @keyframes shake-anim {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                @keyframes glow-pulse-anim {
                    0% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
                    50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.1); }
                    100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
                }
                .animate-bg-pulse { animation: bg-pulse-bg 15s ease-in-out infinite !important; }
                .animate-glow-pulse { animation: glow-pulse-anim 8s ease-in-out infinite; }
                .spark-particle { animation: spark-float 10s linear infinite, spark-flicker 0.15s infinite; }
                .spark-particle { animation-duration: inherit; } /* It will be overridden by inline style */
                .animate-gradient-text { animation: gradient-text-anim 5s ease infinite; }
                .animate-shake { animation: shake-anim 0.4s cubic-bezier(.36,.07,.19,.97) both; }
            `}} />
        </div>
    );
}
