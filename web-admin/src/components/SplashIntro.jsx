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
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#020617] transition-opacity duration-1000 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
            {/* Background Atmosphere - Moved to back */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-blue-600/5 blur-[180px] rounded-full animate-glow-pulse" />
            </div>

            {/* Particles Container - Elevated z-index and fixed position to prevent mouse disappearance */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                {[...Array(80)].map((_, i) => (
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
                            animationDelay: (Math.random() * -15) + 's',
                            animationDuration: (Math.random() * 6 + 4) + 's',
                            opacity: 0.8
                        }}
                    />
                ))}
            </div>

            <div className="relative z-20 text-center animate-zoom-in">
                <h1 className="text-6xl md:text-8xl font-sans font-black tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-white bg-[length:200%_auto] animate-gradient-text drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                    Falka Software
                </h1>
                <div className="mt-6 flex justify-center gap-2">
                    <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-width-expand" />
                </div>
                <p className="mt-4 text-[10px] uppercase tracking-[0.4em] font-black text-slate-500 animate-fade-in-up">
                    Falka, at the heart of the future.
                </p>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes spark-float-anim {
                    0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { transform: translateY(-120vh) translateX(40px) scale(0.5); opacity: 0; }
                }
                @keyframes spark-flicker-anim {
                    0%, 100% { opacity: 1; filter: brightness(1.2); }
                    50% { opacity: 0.6; filter: brightness(1.8); }
                }
                @keyframes gradient-text-anim {
                    0% { background-position: 0% center; }
                    50% { background-position: 100% center; }
                    100% { background-position: 0% center; }
                }
                @keyframes zoom-in-anim {
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
                @keyframes glow-pulse-anim {
                    0% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
                    50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.1); }
                    100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
                }
                .animate-glow-pulse { animation: glow-pulse-anim 8s ease-in-out infinite; }
                .spark-particle { animation: spark-float-anim 12s linear infinite, spark-flicker-anim 0.2s infinite; }
                .animate-gradient-text { animation: gradient-text-anim 5s ease infinite; }
                .animate-zoom-in { animation: zoom-in-anim 3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-width-expand { animation: width-expand 2.5s 1s ease-out forwards; opacity: 0; }
                .animate-fade-in-up { animation: fade-in-up 2s 1.5s ease-out forwards; opacity: 0; }
            `}} />
        </div>
    );
};

export default SplashIntro;
