export const isUserVIP = (user) => {
    if (!user) return false;

    // Coerce string to boolean just in case
    const isVipStatus = user.is_vip === true || user.is_vip === 'true' || user.is_vip === 1;

    if (!isVipStatus) return false;

    // If VIP status is true but no expiry date, assume lifetime VIP
    if (!user.vip_expire_date) return true;

    const expireDate = new Date(user.vip_expire_date);
    const now = new Date();

    return expireDate > now;
};
