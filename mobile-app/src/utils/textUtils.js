/**
 * Automatically detects and masks contact information such as phone numbers,
 * Telegram, Instagram, WhatsApp, and Snapchat handles with asterisks.
 * 
 * @param {string} text - The input text (e.g. bio, caption)
 * @returns {string} The censored text with contact info starred out
 */
export const maskContactInfo = (text) => {
    if (!text) return '';
    
    let masked = text;

    // 1. Phone number detection (Turkish patterns & general 9-11 digit numbers)
    // Matches: 05xxxxxxxxx, 5xxxxxxxxx, 0 5xx xxx xx xx, etc.
    const phoneRegex = /(\+?90[\s-]?)?0?\s?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
    masked = masked.replace(phoneRegex, (match) => '*'.repeat(match.length));

    // General continuous digit groups of length 8+ (likely numbers)
    const longDigitsRegex = /\d[\d\s-]{7,}\d/g;
    masked = masked.replace(longDigitsRegex, (match) => {
        const digitCount = match.replace(/\D/g, '').length;
        if (digitCount >= 8) {
            return '*'.repeat(match.length);
        }
        return match;
    });

    // 2. Social Media Handles & Keywords
    // Capture patterns like: tg, tleg, telegram, tele, ig, insta, instagram, wp, whatsapp, snap, snapchat
    // followed by optional spaces, colon, hyphens, or "@" and then a username word [A-Za-z0-9_.-]+
    const socialKeywords = ['tleg', 'tg', 'telegram', 'tele', 'ig', 'insta', 'instagram', 'wp', 'whatsapp', 'snap', 'snapchat'];
    
    socialKeywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword}\\s*[:=-]?\\s*@?\\s*)([A-Za-z0-9_.-]{3,})`, 'gi');
        masked = masked.replace(regex, (match, prefix, username) => {
            return prefix + '*'.repeat(username.length);
        });
    });

    // 3. Generic "@username" mentions
    const mentionRegex = /@([A-Za-z0-9_.-]{3,})/g;
    masked = masked.replace(mentionRegex, (match, username) => {
        return '@' + '*'.repeat(username.length);
    });

    return masked;
};
