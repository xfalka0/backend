const axios = require('axios');

const forbiddenWords = [
    'sex', 'sexs', 'seks', 'sikiş', 'sikis', 'siki', 'sik', 'amcik', 'amcık', 'am', 
    'yarrak', 'yarak', 'meme', 'memeler', 'vajina', 'penis', 'eskort', 'escort', 'jigolo', 
    'porn', 'porno', 'orospu', 'göt', 'got', 'götveren', 'gotveren', 'kahpe', 'pic', 'piç',
    'cinsel', 'adult', 'swinger', 'seksüel', 'seksuel'
];

const numberWords = [
    'sifir', 'bir', 'iki', 'uc', 'ucl', 'dort', 'bes', 'alti', 'yedi', 'sekiz', 'dokuz', 
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'
];

/**
 * Validates text fields (name, bio, etc.) for phone numbers and inappropriate content.
 * @param {string} text - The input text to check.
 * @returns {object} { safe: boolean, reason?: string }
 */
function checkProfileText(text) {
    if (!text || typeof text !== 'string') return { safe: true };

    // 1. Clean and normalize Turkish characters
    const normalizedText = text.toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g');

    // 2. Check for explicit words
    for (const word of forbiddenWords) {
        const regex = new RegExp('\\b' + word + '\\b', 'i');
        if (regex.test(normalizedText)) {
            return { safe: false, reason: 'Profil bilgilerinde uygunsuz veya cinsel içerik tespit edildi.' };
        }
    }

    // 3. Check for phone numbers written in digits
    const digitsOnly = text.replace(/\D/g, '');
    if (digitsOnly.length >= 9) {
        return { safe: false, reason: 'Profil bilgilerinde telefon numarası paylaşılamaz.' };
    }

    // 4. Check for phone numbers written in words
    let wordNumberCount = 0;
    const words = normalizedText.split(/[^a-z0-9]+/);
    for (const w of words) {
        if (numberWords.includes(w) || /^\d+$/.test(w)) {
            wordNumberCount += w.length > 3 ? 1 : 1; // Count standard digits/number words
        }
    }

    if (wordNumberCount >= 9) {
        return { safe: false, reason: 'Profil bilgilerinde yazılı telefon numarası paylaşılamaz.' };
    }

    return { safe: true };
}

/**
 * Checks an image URL for inappropriate explicit content (NSFW) and embedded phone numbers.
 * @param {string} url - The Cloudinary or local image URL.
 * @returns {object} { safe: boolean, reason?: string }
 */
async function checkPhotoSecurity(url) {
    if (!url) return { safe: true };

    console.log(`[AUTO-MODERATION] Scanning image: ${url}`);

    // 1. NSFW Image Classification Check
    try {
        const mcApiKey = process.env.MODERATECONTENT_API_KEY || 'd4e5a9ee6cb1613adcd42807f7c4613c';
        const mcUrl = `http://api.moderatecontent.com/moderate/?key=${mcApiKey}&url=${encodeURIComponent(url)}`;
        const mcRes = await axios.get(mcUrl, { timeout: 8000 });
        
        if (mcRes.data && mcRes.data.rating_letter) {
            const rating = mcRes.data.rating_letter.toUpperCase();
            console.log(`[AUTO-MODERATION] ModerateContent rating: ${rating} for ${url}`);
            if (rating === 'R') {
                return { safe: false, reason: 'Yüklenen görsel uygunsuz veya cinsel içerik barındırıyor.' };
            }
        }
    } catch (mcErr) {
        console.error('[AUTO-MODERATION] ModerateContent classification API failed:', mcErr.message);
        // Fail open to avoid blocking uploads if external check fails
    }

    // 2. OCR Text Analysis (Phone numbers / NSFW text in image)
    try {
        const ocrApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';
        const ocrUrl = `https://api.ocr.space/parse/imageurl?apikey=${ocrApiKey}&url=${encodeURIComponent(url)}&language=tur`;
        const ocrRes = await axios.get(ocrUrl, { timeout: 8000 });
        
        if (ocrRes.data && ocrRes.data.ParsedResults && ocrRes.data.ParsedResults[0]) {
            const parsedText = ocrRes.data.ParsedResults[0].ParsedText || '';
            console.log(`[AUTO-MODERATION] OCR extracted text: "${parsedText.trim()}"`);
            
            if (parsedText.trim().length > 0) {
                const textCheck = checkProfileText(parsedText);
                if (!textCheck.safe) {
                    return { safe: false, reason: `Görselde telefon numarası veya uygunsuz yazılar tespit edildi.` };
                }
            }
        }
    } catch (ocrErr) {
        console.error('[AUTO-MODERATION] OCR Space API failed:', ocrErr.message);
        // Fail open to prevent service disruption if external OCR is down
    }

    return { safe: true };
}

module.exports = {
    checkProfileText,
    checkPhotoSecurity
};
