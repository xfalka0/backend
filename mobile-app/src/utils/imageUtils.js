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
 * Optimize Cloudinary URLs on-the-fly to reduce memory usage and prevent Fresco pool hard cap violations.
 */
const optimizeCloudinaryUrl = (url, type) => {
    if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
        return url;
    }
    
    // Define optimized transformations for different contexts
    let transformation = 'q_auto,f_auto';
    if (type === 'avatar') {
        transformation = 'c_fill,w_150,h_150,g_face,q_auto,f_auto';
    } else if (type === 'medium') {
        transformation = 'c_limit,w_600,q_auto,f_auto';
    } else if (type === 'large') {
        transformation = 'c_limit,w_1000,q_auto,f_auto';
    }
    
    return url.replace('/image/upload/', `/image/upload/${transformation}/`);
};

/**
 * Resolves a potentially relative image URL to an absolute one.
 * @param {string|null|undefined} url The image URL to resolve
 * @param {string} type Context type for optimization: 'avatar' | 'medium' | 'large'
 * @returns {string|null} The absolute URL or null
 */
export const resolveImageUrl = (url, type = 'medium') => {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
        return null;
    }

    let trimmedUrl = url.trim();

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
            trimmedUrl = `${baseUrl}${relativePart}`;
        }
    }

    // 2. Check if it's already an absolute URL (http/https)
    // Cloudinary etc. will pass through here
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        const resolvedUrl = safeEncodeUrl(trimmedUrl);
        return optimizeCloudinaryUrl(resolvedUrl, type);
    }

    // 3. Handle Cloudinary or other external absolute URLs that might miss http but start with //
    if (trimmedUrl.startsWith('//')) {
        const resolvedUrl = safeEncodeUrl(`https:${trimmedUrl}`);
        return optimizeCloudinaryUrl(resolvedUrl, type);
    }

    // 4. Resolve relative URLs (e.g., /uploads/...)
    const baseUrl = API_URL.replace('/api', '');
    const cleanRelativePath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;

    const resolvedUrl = safeEncodeUrl(`${baseUrl}${cleanRelativePath}`);
    return resolvedUrl;
};
