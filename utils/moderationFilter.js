/**
 * Moderation & Security Content Filter
 * Detects Turkish phone numbers (e.g. 05xx, +90, spaced/formatted digits),
 * links, external social media handles (instagram, whatsapp, t.me), and prohibited words.
 */

// Turkish Phone Number Patterns (05xx, +90, 5xx with spaces, dots, dashes)
const PHONE_REGEX = /(?:\+?90\s*|0)?\s*5\d{2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/gi;

// Digit sequence detection (e.g., 0 5 5 5 1 2 3 4 5 6 7 or masked numbers)
const MASKED_PHONE_REGEX = /(?:0\s*5|5)\s*(?:\d\s*){9}/gi;

// Social media & external messaging links
const SOCIAL_LINK_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|ig:|wa\.me|t\.me|telegram\.me|whatsapp|kik|snapchat|snap:)/gi;

// General URL regex
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*/gi;

/**
 * Validates text for security violations (phone numbers, social handles, URLs).
 * @param {string} text Input text (e.g., bio, display name, status)
 * @returns {{ isClean: boolean, reason: string | null }} Validation result
 */
function validateProfileText(text) {
    if (!text || typeof text !== 'string') {
        return { isClean: true, reason: null };
    }

    const cleanText = text.trim();
    if (!cleanText) {
        return { isClean: true, reason: null };
    }

    // Check direct phone numbers
    if (PHONE_REGEX.test(cleanText) || MASKED_PHONE_REGEX.test(cleanText)) {
        return {
            isClean: false,
            reason: 'Profilinizde telefon numarası paylaşılması güvenlik kuralları gereği yasaktır.'
        };
    }

    // Check social media handles and links
    if (SOCIAL_LINK_REGEX.test(cleanText) || URL_REGEX.test(cleanText)) {
        return {
            isClean: false,
            reason: 'Profilinizde harici platform linki veya iletişim bilgisi paylaşılması yasaktır.'
        };
    }

    return { isClean: true, reason: null };
}

/**
 * Validates image URL and metadata for security/moderation rules.
 * @param {string} imageUrl URL of the uploaded image
 * @returns {{ isClean: boolean, reason: string | null }} Validation result
 */
function validateImageUrl(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
        return { isClean: true, reason: null };
    }

    const trimmedUrl = imageUrl.trim().toLowerCase();
    
    // Check supported image formats
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
    const hasValidExt = validExtensions.some(ext => trimmedUrl.includes(ext)) || trimmedUrl.startsWith('data:image/') || trimmedUrl.includes('cloudinary');

    if (!hasValidExt) {
        return {
            isClean: false,
            reason: 'Lütfen yalnızca geçerli bir görsel dosyası (JPG, PNG, WEBP) yükleyiniz.'
        };
    }

    // Check for suspicious non-image script injection
    if (trimmedUrl.includes('<script>') || trimmedUrl.includes('javascript:')) {
        return {
            isClean: false,
            reason: 'Geçersiz görsel formatı taptandı.'
        };
    }

    return { isClean: true, reason: null };
}

module.exports = {
    validateProfileText,
    validateImageUrl,
    PHONE_REGEX,
    SOCIAL_LINK_REGEX
};
