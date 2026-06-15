/**
 * Helper logic for Sugo/Soyo style live chat room permissions
 * Roles supported: admin, agency_owner, agency_host, moderator, user
 */
export function canCreateRoom(user) {
    // TEMPORARY FOR TESTING: Allow all users to create rooms
    return true;

    if (!user) return false;

    // admin can always create a room
    if (user.role === 'admin') return true;

    // agency_owner can always create a room
    if (user.role === 'agency_owner') return true;

    // agency_host can only create a room if permissions.canCreateRoom === true
    if (
        user.role === 'agency_host' &&
        user.permissions?.canCreateRoom === true
    ) {
        return true;
    }

    // user and other roles cannot create a room
    return false;
}
