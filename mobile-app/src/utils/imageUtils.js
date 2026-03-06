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

    // 1. If it's a localhost URL leaking from backend, strip it to get the relative part
    if (trimmedUrl.includes('localhost:3000') || trimmedUrl.includes('127.0.0.1')) {
        const parts = trimmedUrl.split(':3000');
        const relativePart = parts.length > 1 ? parts[1] : trimmedUrl.split('127.0.0.1')[1];
        if (relativePart) {
            const baseUrl = API_URL.replace('/api', '');
            const cleanRelativePath = relativePart.startsWith('/') ? relativePart : `/${relativePart}`;
            return `${baseUrl}${cleanRelativePath}`;
        }
    }

    // 2. Check if it's already an absolute URL (http/https)
    // Cloudinary etc. will pass through here
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        return trimmedUrl;
    }

    // 3. Handle Cloudinary or other external absolute URLs that might miss http but start with //
    if (trimmedUrl.startsWith('//')) {
        return `https:${trimmedUrl}`;
    }

    // 4. Resolve relative URLs (e.g., /uploads/...)
    const baseUrl = API_URL.replace('/api', '');
    const cleanRelativePath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;

    return `${baseUrl}${cleanRelativePath}`;
};
