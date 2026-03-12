import React, { useEffect, useState } from 'react';

const SplashIntro = ({ onComplete }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(onComplete, 1000); // Wait for fade out
        }, 3500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 transition-opacity duration-1000 animate-bg-pulse ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            {/* Particles Container */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(60)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full opacity-80 animate-spark-move flicker-fast"
                        style={{
                            width: (Math.random() * 4 + 1) + 'px',
                            height: (Math.random() * 4 + 1) + 'px',
                            left: Math.random() * 100 + '%',
                            top: (Math.random() * 100 + 20) + '%',
                            background: ['#ff4d00', '#ff9900', '#ffcc00'][Math.floor(Math.random() * 3)],
                            boxShadow: `0 0 12px ${['#ff4d00', '#ff9900', '#ffcc00'][Math.floor(Math.random() * 3)]}`,
                            animationDelay: (Math.random() * -15) + 's',
                            animationDuration: (Math.random() * 5 + 5) + 's'
                        }}
                    />
                ))}
            </div>

            {/* Glowing background light */}
            <div className="absolute w-[500px] h-[500px] bg-pink-600/10 blur-[120px] rounded-full animate-pulse" />

            <div className="relative z-10 text-center animate-zoom-in">
                <h1 className="text-6xl md:text-8xl font-sans font-black tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-400 to-white bg-[length:200%_auto] animate-gradient-text drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    Falka Software
                </h1>
                <div className="mt-6 flex justify-center gap-2">
                    <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-pink-600 to-transparent animate-width-expand" />
                </div>
                <p className="mt-4 text-[10px] uppercase tracking-[0.4em] font-black text-slate-500 animate-fade-in-up">
                    Falka, at the heart of the future.
                </p>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bg-pulse {
                    0% { background-color: #020617; }
                    50% { background-color: #0c0a1f; } /* Deep bluish purple */
                    100% { background-color: #020617; }
                }
                @keyframes spark-move {
                    0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translateY(-120vh) translateX(40px) scale(0.5); opacity: 0; }
                }
                @keyframes gradient-text {
                    0% { background-position: 0% center; }
                    50% { background-position: 100% center; }
                    100% { background-position: 0% center; }
                }
                @keyframes flicker-fast {
                    0%, 100% { opacity: 1; filter: brightness(1.2); }
                    50% { opacity: 0.7; filter: brightness(1.8); }
                }
                @keyframes zoom-in {
                    0% { transform: scale(0.9); opacity: 0; filter: blur(20px); }
                    100% { transform: scale(1); opacity: 1; filter: blur(0); }
                }
                @keyframes width-expand {
                    0% { width: 0; opacity: 0; }
                    100% { width: 96px; opacity: 1; }
                }
                @keyframes fade-in-up {
                    0% { transform: translateY(10px); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .animate-bg-pulse { animation: bg-pulse 12s ease-in-out infinite; }
                .animate-spark-move { animation: spark-move linear infinite; }
                .animate-gradient-text { animation: gradient-text 5s ease infinite; }
                .flicker-fast { animation: flicker-fast 0.1s infinite; }
                .animate-zoom-in { animation: zoom-in 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-width-expand { animation: width-expand 2.5s 1s ease-out forwards; opacity: 0; }
                .animate-fade-in-up { animation: fade-in-up 2s 1.5s ease-out forwards; opacity: 0; }
            `}} />
        </div>
    );
};

export default SplashIntro;
