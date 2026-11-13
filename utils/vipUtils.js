/**
 * VIP Level Utilities
 * Handles VIP level calculation and thresholds
 */

const VIP_THRESHOLDS = {
    1: 100,
    2: 1500,
    3: 10000,
    4: 20000,
    5: 40000,
    6: 100000
};

/**
 * Calculate VIP level from VIP XP
 * @param {number} vipXp - Total VIP XP accumulated
 * @returns {number} VIP level (0-6)
 */
function getVipLevel(vipXp) {
    if (vipXp >= VIP_THRESHOLDS[6]) return 6;
    if (vipXp >= VIP_THRESHOLDS[5]) return 5;
    if (vipXp >= VIP_THRESHOLDS[4]) return 4;
    if (vipXp >= VIP_THRESHOLDS[3]) return 3;
    if (vipXp >= VIP_THRESHOLDS[2]) return 2;
    if (vipXp >= VIP_THRESHOLDS[1]) return 1;
    return 0;
}

/**
 * Get XP required for next VIP level
 * @param {number} currentXp - Current VIP XP
 * @returns {object} { currentLevel, nextLevel, xpNeeded, progress }
 */
function getVipProgress(currentXp) {
    const currentLevel = getVipLevel(currentXp);
    const nextLevel = currentLevel < 6 ? currentLevel + 1 : 6;
    const nextThreshold = VIP_THRESHOLDS[nextLevel] || VIP_THRESHOLDS[6];
    const prevThreshold = currentLevel > 0 ? VIP_THRESHOLDS[currentLevel] : 0;

    const xpNeeded = nextThreshold - currentXp;
    const progress = currentLevel === 6 ? 1 : (currentXp - prevThreshold) / (nextThreshold - prevThreshold);

    return {
        currentLevel,
        nextLevel,
        currentXp,
        nextThreshold,
        xpNeeded: Math.max(0, xpNeeded),
        progress: Math.min(1, Math.max(0, progress))
    };
}

/**
 * Get all VIP thresholds
 * @returns {object} VIP level thresholds
 */
function getVipThresholds() {
    return { ...VIP_THRESHOLDS };
}

/**
 * Check whether a user's Premium subscription is currently active.
 * - Staff roles (admin, super_admin, operator, moderator) have operational access.
 * - Regular users require an unexpired subscription date (premium_expire_date or vip_expire_date).
 * - VIP level alone does NOT grant Premium; Premium is the timed subscription that expires.
 * @param {object} user - User record from database
 * @returns {boolean}
 */
function isUserPremiumActive(user) {
    if (!user) return false;

    // Staff/internal roles exception
    const staffRoles = ['admin', 'super_admin', 'operator', 'moderator'];
    if (staffRoles.includes(user.role)) return true;

    // Must have a valid future expiration date
    const expireDateStr = user.premium_expire_date || user.vip_expire_date;
    if (!expireDateStr) return false;

    const expireDate = new Date(expireDateStr);
    if (isNaN(expireDate.getTime())) return false;

    return expireDate > new Date();
}

/**
 * Check whether a user has VIP status.
 * VIP has NO expiration date. It is a permanent level progression (VIP 1-6)
 * gained as the user deposits money, buys coins, or accumulates VIP XP.
 * @param {object} user - User record from database
 * @returns {boolean}
 */
function isUserVip(user) {
    if (!user) return false;
    return (parseInt(user.vip_level || 0, 10) > 0) || Boolean(user.is_vip);
}

/**
 * Legacy alias for backwards compatibility: maps to isUserPremiumActive
 */
function isUserVipActive(user) {
    return isUserPremiumActive(user);
}

module.exports = {
    getVipLevel,
    getVipProgress,
    getVipThresholds,
    isUserPremiumActive,
    isUserVip,
    isUserVipActive,
    VIP_THRESHOLDS
};
