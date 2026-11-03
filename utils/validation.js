/**
 * Shared Backend Validation Utilities
 */

/**
 * Validates age for users (Strict Dating App Rules: 18-99).
 * @param {any} age 
 * @returns {{ valid: boolean, error: string | null, value: number | null }}
 */
function validateAge(age) {
    if (age === undefined || age === null || age === '') {
        return { valid: true, error: null, value: null };
    }
    
    // Check if it's a valid integer (reject floats, NaN, strings with non-numeric chars)
    const str = String(age).trim();
    if (!/^-?\d+$/.test(str)) {
        return {
            valid: false,
            error: 'Geçersiz yaş değeri. Yaş yalnızca 18 ile 99 arasında bir tam sayı olmalıdır.',
            value: null
        };
    }

    const num = parseInt(str, 10);
    if (isNaN(num) || num < 18 || num > 99) {
        return {
            valid: false,
            error: 'Yaş sınırı kuralı: Yaşınız 18 ile 99 arasında olmalıdır.',
            value: null
        };
    }

    return { valid: true, error: null, value: num };
}

module.exports = {
    validateAge
};

