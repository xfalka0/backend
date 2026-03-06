import { API_URL } from '../config';

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

    // 1. Check if it's already an absolute URL (http/https)
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        return trimmedUrl;
    }

    // 2. Handle Cloudinary or other external absolute URLs that might missing http but start with //
    if (trimmedUrl.startsWith('//')) {
        return `https:${trimmedUrl}`;
    }

    // 3. Resolve relative URLs (e.g., /uploads/...)
    // We derive the base URL from API_URL by stripping the /api suffix
    const baseUrl = API_URL.replace('/api', '');
    const cleanRelativePath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;

    return `${baseUrl}${cleanRelativePath}`;
};
