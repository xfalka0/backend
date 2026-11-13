/**
 * VIP Check:
 * VIP has NO expiration date. It is a permanent level progression (VIP 1-6)
 * gained as the user deposits money, buys coins, or accumulates VIP XP.
 */
export const isUserVIP = (user) => {
    if (!user) return false;
    const isVipStatus = user.is_vip === true || user.is_vip === 'true' || user.is_vip === 1;
    const vipLevel = parseInt(user.vip_level || 0, 10);
    return vipLevel > 0 || isVipStatus;
};

/**
 * Premium Check:
 * Premium is the timed subscription that EXPIRES (1 Ay, 3 Ay, 12 Ay).
 */
export const isUserPremium = (user) => {
    if (!user) return false;
    const expireDateStr = user.premium_expire_date || user.vip_expire_date;
    if (!expireDateStr) return false;

    const expireDate = new Date(expireDateStr);
    if (isNaN(expireDate.getTime())) return false;

    return expireDate > new Date();
};

