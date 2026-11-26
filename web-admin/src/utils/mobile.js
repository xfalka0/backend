import { useState, useEffect } from 'react';

const CHAT_ROLES = ['admin', 'super_admin', 'moderator', 'operator', 'staff'];

export const normalizeRole = (role) => String(role || '').trim().toLowerCase();

export const canAccessChatsRole = (role) => CHAT_ROLES.includes(normalizeRole(role));

export const isPhoneDevice = () => {
    if (typeof window === 'undefined') return false;
    const belowMdBreakpoint = !window.matchMedia('(min-width: 768px)').matches;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isPhoneUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isCoarseSmall = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024;
    return belowMdBreakpoint || (isPhoneUA && window.innerWidth < 1024) || isCoarseSmall;
};

export const useIsPhone = () => {
    const [isPhone, setIsPhone] = useState(isPhoneDevice);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const mq = window.matchMedia('(min-width: 768px)');
        const update = () => setIsPhone(isPhoneDevice());
        update();
        mq.addEventListener('change', update);
        window.addEventListener('resize', update);
        return () => {
            mq.removeEventListener('change', update);
            window.removeEventListener('resize', update);
        };
    }, []);

    return isPhone;
};

