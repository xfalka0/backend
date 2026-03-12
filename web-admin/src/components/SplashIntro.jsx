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
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 transition-opacity duration-1000 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            {/* Particles Container */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(50)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full opacity-60 animate-spark"
                        style={{
                            width: (Math.random() * 4 + 1) + 'px',
                            height: (Math.random() * 4 + 1) + 'px',
                            left: Math.random() * 100 + '%',
                            top: (Math.random() * 100 + 100) + '%',
                            background: `radial-gradient(circle, ${['#ff4d00', '#ff9900', '#ffcc00'][Math.floor(Math.random() * 3)]}, transparent)`,
                            boxShadow: `0 0 10px ${['#ff4d00', '#ff9900', '#ffcc00'][Math.floor(Math.random() * 3)]}`,
                            animationDelay: Math.random() * 10 + 's',
                            animationDuration: (Math.random() * 8 + 4) + 's'
                        }}
                    />
                ))}
            </div>

            {/* Glowing background light */}
            <div className="absolute w-[500px] h-[500px] bg-pink-600/10 blur-[120px] rounded-full animate-pulse" />

            <div className="relative z-10 text-center animate-zoom-in">
                <h1 className="text-6xl md:text-8xl font-serif font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
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
                @keyframes spark {
                    0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
                    20% { opacity: 1; transform: translateY(-30vh) translateX(20px) scale(1.2); }
                    50% { transform: translateY(-70vh) translateX(-20px) scale(0.8); }
                    80% { opacity: 0.8; }
                    100% { transform: translateY(-150vh) translateX(40px) scale(0.5); opacity: 0; }
                }
                @keyframes flicker {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(0.9); }
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
                .animate-spark { animation: spark linear infinite, flicker 0.2s infinite; }
                .animate-zoom-in { animation: zoom-in 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-width-expand { animation: width-expand 2.5s 1s ease-out forwards; opacity: 0; }
                .animate-fade-in-up { animation: fade-in-up 2s 1.5s ease-out forwards; opacity: 0; }
            `}} />
        </div>
    );
};

export default SplashIntro;
