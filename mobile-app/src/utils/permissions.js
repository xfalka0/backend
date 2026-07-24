/**
 * Helper logic for live chat room permissions
 * Roles supported: admin, agency_owner, agency_host, moderator, user
 */
export function canCreateRoom(user) {
    if (!user) return false;
    // Allow all authenticated users to access room creation (non-agency owners can pay 5000 coins)
    return true;
}

export function isAgencyOwnerOrStaff(user) {
    if (!user) return false;
    return (
        user.role === 'agency_owner' ||
        user.role === 'admin' ||
        user.role === 'super_admin' ||
        Boolean(user.agency_id)
    );
}
