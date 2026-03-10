import { API_URL } from '../config';

/**
 * Safely encodes URL components, specifically spaces, to avoid breaking Image rendering
 * while preserving valid URL structures like http:// and ://
 */
const safeEncodeUrl = (u) => {
    if (!u || typeof u !== 'string') return u;
    const trimmed = u.trim();
    // Only replace spaces with %20. encodeURI can sometimes double-encode or break Cloudinary URLs in older RN versions.
    if (trimmed.includes(' ')) {
        return trimmed.replace(/ /g, '%20');
    }
    return trimmed;
};

/**
 * Resolves a potentially relative image URL to an absolute one.
 * @param {string|null|undefined} url The image URL to resolve
 * @returns {string|null} The absolute URL or null
 */
export const resolveImageUrl = (url) => {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return null;
    }

    const trimmedUrl = url.trim();

    // 1. If it's a localhost/emulator URL leaking from backend, strip it to get the relative part
    const isLocalUrl =
        trimmedUrl.includes('localhost') ||
        trimmedUrl.includes('127.0.0.1') ||
        trimmedUrl.includes('10.0.2.2') ||
        trimmedUrl.includes('192.168.');

    if (isLocalUrl && (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://'))) {
        const parts = trimmedUrl.split('/');
        if (parts.length > 3) {
            const relativePart = '/' + parts.slice(3).join('/');
            const baseUrl = API_URL.replace('/api', '');
            return safeEncodeUrl(`${baseUrl}${relativePart}`);
        }
    }

    // 2. Check if it's already an absolute URL (http/https)
    // Cloudinary etc. will pass through here
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        return safeEncodeUrl(trimmedUrl);
    }

    // 3. Handle Cloudinary or other external absolute URLs that might miss http but start with //
    if (trimmedUrl.startsWith('//')) {
        return safeEncodeUrl(`https:${trimmedUrl}`);
    }

    // 4. Resolve relative URLs (e.g., /uploads/...)
    const baseUrl = API_URL.replace('/api', '');
    const cleanRelativePath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;

    return safeEncodeUrl(`${baseUrl}${cleanRelativePath}`);
};
