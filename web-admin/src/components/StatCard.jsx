import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, change, isPositive, icon, gradient }) {
    return (
        <div className="relative group">
            {/* Gradient Border Effect */}
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${gradient} rounded-[22px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200`}></div>

            <div className="relative bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 hover:border-purple-500/30 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient} bg-opacity-10 text-white shadow-lg`}>
                        {icon}
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {change}
                    </div>
                </div>

                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-3xl font-black text-white tracking-tight">{value}</h3>
                </div>
            </div>
        </div>
    );
}
