import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Coins, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { normalizeRole } from '../utils/mobile';
import {
    isPaymentSoundEnabled,
    playTrinkkSound,
    unlockPaymentAudio,
} from '../utils/paymentSound';

const SOCKET_URL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : window.location.origin;

export default function PaymentSoundListener() {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const role = normalizeRole(user?.role);
    const isAdmin = role === 'admin' || role === 'super_admin';

    const seenTxIdsRef = useRef(new Set());
    const [toast, setToast] = useState(null);
    const hideTimerRef = useRef(null);

    useEffect(() => {
        if (!isAdmin) return;

        const handleGesture = () => unlockPaymentAudio();
        window.addEventListener('pointerdown', handleGesture, { passive: true });
        window.addEventListener('keydown', handleGesture, { passive: true });

        return () => {
            window.removeEventListener('pointerdown', handleGesture);
            window.removeEventListener('keydown', handleGesture);
        };
    }, [isAdmin]);

    useEffect(() => {
        if (!isAdmin || !token) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            auth: { token },
        });

        socket.on('new_payment', (data) => {
            const txId = data?.transaction_id ? String(data.transaction_id) : null;
            if (txId) {
                if (seenTxIdsRef.current.has(txId)) return;
                seenTxIdsRef.current.add(txId);
                if (seenTxIdsRef.current.size > 100) {
                    const first = seenTxIdsRef.current.values().next().value;
                    seenTxIdsRef.current.delete(first);
                }
            }

            if (isPaymentSoundEnabled()) {
                playTrinkkSound();
            }

            const isVip = data?.status === 'completed_vip';
            setToast({
                id: txId || Date.now(),
                amount: data?.amount,
                isVip,
                userId: data?.user_id,
            });

            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            hideTimerRef.current = setTimeout(() => setToast(null), 5000);
        });

        return () => {
            socket.disconnect();
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [isAdmin, token]);

    if (!isAdmin || !toast) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div
                onClick={() => {
                    setToast(null);
                    navigate('/payments');
                }}
                className="cursor-pointer flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/95 border border-emerald-500/40 shadow-2xl shadow-emerald-950/50 backdrop-blur-xl hover:border-emerald-400/70 transition-all"
            >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <Coins size={20} className="text-white" />
                </div>
                <div className="pr-2">
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                        Yeni Ödeme Geldi
                    </p>
                    <p className="text-sm font-bold text-white">
                        {toast.isVip ? 'VIP Abonelik' : 'Coin Satışı'}
                        {toast.amount !== undefined && toast.amount !== null
                            ? ` • ${toast.amount}`
                            : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setToast(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Kapat"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
