const crypto = require('crypto');
const axios = require('axios');

// PayerMax Credentials & Config
const MERCHANT_NO = process.env.PAYERMAX_MERCHANT_NO;
const APP_ID = process.env.PAYERMAX_APP_ID;
const PRIVATE_KEY = process.env.PAYERMAX_PRIVATE_KEY; // Merchant Private Key (RSA PEM format)
const BASE_URL = process.env.PAYERMAX_BASE_URL || 'https://pay-gate-uat.payermax.com';
const IS_ENABLED = process.env.PAYERMAX_ENABLED === 'true';

/**
 * Extracts 3-digit EFT bank code from Turkish IBAN.
 * @param {string} iban 
 * @returns {string} Standard 3-digit EFT bank code or default
 */
function getBankCodeFromIban(iban) {
    const clean = (iban || '').replace(/\s+/g, '').toUpperCase();
    if (clean.startsWith('TR') && clean.length === 26) {
        // TRXX BBBBB C...
        // BBBBB is bank code
        const codeStr = clean.substring(4, 9);
        const codeNum = parseInt(codeStr, 10);
        if (!isNaN(codeNum)) {
            return codeNum.toString().padStart(3, '0');
        }
    }
    return '010'; // Default to Ziraat Bank (010) if unable to parse
}

/**
 * Signs payload using SHA256withRSA.
 * @param {string} bodyStr 
 * @param {string} privateKeyPem 
 * @returns {string} Base64 encoded signature
 */
function generateSignature(bodyStr, privateKeyPem) {
    try {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(bodyStr);
        return sign.sign(privateKeyPem, 'base64');
    } catch (err) {
        console.error('[PAYERMAX-SIGN-ERROR]', err.message);
        throw new Error('PayerMax imza oluşturma hatası: ' + err.message);
    }
}

/**
 * Sends a automated payout request to PayerMax.
 * @param {object} params
 * @param {string} params.payoutId Unique payout/transaction ID
 * @param {number} params.amountTry Amount in TRY (e.g. 230.00)
 * @param {string} params.iban Payee's TR IBAN
 * @param {string} params.accountHolder Payee's name
 * @returns {Promise<{success: boolean, message: string, transactionId?: string}>}
 */
async function initiatePayout({ payoutId, amountTry, iban, accountHolder }) {
    if (!IS_ENABLED) {
        console.warn(`[PAYERMAX-MOCK] PayerMax is disabled or not configured in .env. Simulating payout success for ID: ${payoutId}`);
        return { 
            success: true, 
            message: `[MOCK] PayerMax devre dışı. Ödeme simüle edildi (Tutar: ${amountTry} TL, Alıcı: ${accountHolder}).` 
        };
    }

    if (!MERCHANT_NO || !APP_ID || !PRIVATE_KEY) {
        throw new Error('PayerMax entegrasyon ayarları (MERCHANT_NO, APP_ID, PRIVATE_KEY) eksik.');
    }

    const requestTime = new Date().toISOString(); // RFC 3339 compliant format (e.g., 2026-06-03T01:45:00.000Z)
    const formattedAmount = Number(amountTry).toFixed(2); // Two decimal places as string
    const bankCode = getBankCodeFromIban(iban);

    // Structure of PayerMax Disbursement (paymentOrderPay) Payload
    const payload = {
        merchantNo: MERCHANT_NO,
        appId: APP_ID,
        requestTime: requestTime,
        outTradeNo: payoutId,
        currency: 'TRY',
        amount: formattedAmount,
        paymentMethod: 'BANK_TRANSFER',
        country: 'TUR',
        payee: {
            name: accountHolder.trim(),
            accountNo: iban.replace(/\s+/g, '').toUpperCase(),
            bankCode: bankCode
        }
    };

    // Serialize payload exactly as it will be sent
    const bodyStr = JSON.stringify(payload);
    
    // Generate signature from serialized payload
    const signature = generateSignature(bodyStr, PRIVATE_KEY);

    try {
        console.log(`[PAYERMAX] Submitting payout request to ${BASE_URL}...`);
        
        const response = await axios.post(`${BASE_URL}/aggregate-pay/api/gateway/paymentOrderPay`, payload, {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'sign': signature
            },
            timeout: 15000 // 15 seconds timeout
        });

        const resData = response.data;
        console.log('[PAYERMAX-RESPONSE]', JSON.stringify(resData));

        // PayerMax returns response with code/msg
        // Status code success is typically 'APPLY_SUCCESS' for accepted payouts
        if (resData && (resData.code === 'APPLY_SUCCESS' || resData.code === 'SUCCESS')) {
            return {
                success: true,
                message: resData.msg || 'Ödeme talebi PayerMax tarafından başarıyla kabul edildi.',
                transactionId: resData.orderNo || resData.payerMaxOrderNo
            };
        } else {
            const errorMsg = resData ? `${resData.code} - ${resData.msg}` : 'Bilinmeyen PayerMax hatası.';
            return {
                success: false,
                message: `PayerMax ödeme hatası: ${errorMsg}`
            };
        }
    } catch (err) {
        console.error('[PAYERMAX-REQUEST-FAILED]', err.response ? err.response.data : err.message);
        const detailMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
        return {
            success: false,
            message: `PayerMax bağlantı/istek hatası: ${detailMsg}`
        };
    }
}

module.exports = {
    initiatePayout,
    getBankCodeFromIban
};
