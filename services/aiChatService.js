const db = require('../db');
const fs = require('fs');
const { sendPushNotification } = require('../utils/notificationUtils');

// Fallback flörtöz mesaj havuzu (noktalamasız, tamamen küçük harf)
const FALLBACK_RESPONSES = [
    'selam canım naber',
    'iyiyim sen nasılsın neler yapıyorsun',
    'buralardayım öyle takılıyorum sen napıyorsun',
    'seni görünce bi yazayım dedim enerjin çok tatlı',
    'nerede oturuyorsun ki merak ettim',
    'ay valla çok sıkılmıştım iyi ki yazdın',
    'seninle konuşmak çok tatlı geldi',
    'burcun ne bu arada çok merak ettim',
    'ay çok tatlısın günün nasıl geçti bakalım',
    'takılıyorum öyle müzik dinliyorum sen neler yapıyorsun'
];

const PHONE_NUMBER_STALL_RESPONSES = [
    'ay numaran görünmüyor burada uygulama sansürlüyor galiba alt alta yazsana',
    'tatlım yazdığın numara gözükmüyor sistem gizliyo tek tek alt alta atsana bi',
    'numaranı okuyamadım ki yıldızlı görünüyor alt alta parça parça yazsana',
    'ay burada rakamlar görünmüyor alt alta ayrı ayrı yazsan belki görünür'
];

const OFF_APP_STALL_RESPONSES = [
    'ay tatlım burada dış uygulama isimleri ve numaralar görünmüyor buradan konuşsak ya',
    'canım daha yeni tanıştık buradan sohbet etmek daha keyifli biraz daha yazışalım burada',
    'uygulama numara ve hesapları sansürlüyor gözükmüyor ki buradan devam edelim tatlım',
    'şimdilik buradayım tatlım hem buradan konuşmak daha heyecanlı değil mi'
];

const PHONE_DIGITS_REGEX = /(?:\+?\d[\s\-().]*){7,}/;
const OFF_APP_REGEX = /(whatsapp|whatsap|watsap|\bwp\b|insta|instagram|telegram|snapchat|tiktok|numara|tel\b|telefon)/i;
const FORBIDDEN_ACCEPT_REGEX = /(kaydet|kayded|eklerim|ekliyorum|ekledim|yazarım|yazıyorum|geçelim|geçeriz|geliyorum|bakarız orada|ordan yaz)/i;

function pickFallbackResponse(userMessage = '') {
    const msg = String(userMessage || '');
    if (PHONE_DIGITS_REGEX.test(msg)) {
        return PHONE_NUMBER_STALL_RESPONSES[Math.floor(Math.random() * PHONE_NUMBER_STALL_RESPONSES.length)];
    }
    if (OFF_APP_REGEX.test(msg)) {
        return OFF_APP_STALL_RESPONSES[Math.floor(Math.random() * OFF_APP_STALL_RESPONSES.length)];
    }
    return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

/**
 * Yanıtı tamamen küçük harfe çevirir ve tüm noktalama işaretlerini temizler.
 */
function cleanAiResponse(text) {
    if (!text) return '';
    let cleaned = text.toLowerCase();
    // Noktalama işaretlerini tamamen kaldır
    cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?!\"'’“”«»—–]/g, '');
    // Fazla boşlukları temizle
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

/**
 * Gemini API ile operatör profilini ve sohbet geçmişini analiz edip flörtöz yanıt üretir.
 */
async function generateAiReply({ operator, userMessage, chatHistory = [] }) {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
        console.warn('[AI_CHAT] GEMINI_API_KEY eksik, fallback yanıt kullanılıyor.');
        return pickFallbackResponse(userMessage);
    }

    const opName = operator?.display_name || operator?.name || 'kız';
    const opAge = operator?.age || 19;
    const opCity = operator?.city || 'İstanbul';
    const opBio = operator?.bio || '';
    const opInterests = operator?.interests || '';

    const systemInstruction = `Sen bir arkadaşlık uygulamasında ${opName} adında ${opAge} yaşında ${opCity} şehrinde yaşayan enerjik, tatlı ve flörtöz bir genç kızsın.
${opBio ? `Hakkında: ${opBio}.` : ''} ${opInterests ? `İlgi alanların: ${opInterests}.` : ''}
Sana yazan erkeğe samimi, flörtöz, meraklı ve enerjik bir cevap ver.

KESİNLİKLE UYMAN GEREKEN KURALLAR:
1. KESİNLİKLE HİÇBİR NOKTALAMA İŞARETİ KULLANMA (nokta, virgül, soru işareti, ünlem, tırnak, parantez vs KESİNLİKLE YASAK).
2. KESİNLİKLE BÜYÜK HARF KULLANMA. HER ŞEY TAMAMEN KÜÇÜK HARF OLSUN.
3. 1 VEYA EN FAZLA 2 ÇOK KISA CÜMLE YAZ.
4. ASLA YAPAY ZEKA OLDUĞUNU BELLİ ETME. Tamamen 18-20 yaşındaki doğal, flörtöz bir kız gibi yaz.
5. Samimi sokak ve genç mesajlaşma ağzı kullan.
6. KULLANICI WHATSAPP, INSTAGRAM, TELEGRAM GİBİ DIŞ UYGULAMALARA GEÇMEK İSTERSE VEYA TELEFON NUMARASI PAYLAŞIRSA: ASLA dış uygulamaya geçmeyi kabul etme, "numaranı kaydettim / ekliyorum / oradan yazıyorum" DEME ve kendi numaranı/hesabını verme. Bunun yerine kullanıcıyı uygulama içinde tut ve oyala:
   - Telefon numarası/rakam yazdıysa "numaran görünmüyor uygulama gizliyor alt alta ayrı ayrı yazsana" veya "yazdığın rakamlar sansürlü çıktı okuyamıyorum tek tek alt alta atsana" gibi şeyler yaz.
   - Sadece whatsapp/insta/numara istiyorsa "buradan konuşmak daha rahat hem uygulama dışarıya geçişi ve numaraları gizliyor buradan devam edelim" gibi tatlı ama oyalayıcı cevaplar ver.`;

    try {
        const contents = [];
        const normalizedUserMsg = (userMessage || 'selam').trim();

        // Son birkaç mesajlık geçmiş ekle (son kullanıcı mesajı zaten DB'den geldiyse tekrarlama)
        if (Array.isArray(chatHistory) && chatHistory.length > 0) {
            const recent = chatHistory.slice(-5).filter(m => m && typeof m.content === 'string' && m.content.trim().length > 0);
            const last = recent[recent.length - 1];
            const prior = (last && last.is_user && last.content.trim() === normalizedUserMsg)
                ? recent.slice(0, -1)
                : recent;

            prior.forEach(m => {
                contents.push({
                    role: m.is_user ? 'user' : 'model',
                    parts: [{ text: m.content.trim() }]
                });
            });
        }

        // Kullanıcının son mesajı
        contents.push({
            role: 'user',
            parts: [{ text: normalizedUserMsg }]
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 sn zaman aşımı

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: contents,
                generationConfig: {
                    temperature: 0.95,
                    maxOutputTokens: 150
                }
            })
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            console.warn(`[AI_CHAT] Gemini API HTTP ${res.status}, fallback yanıt dönülüyor. Detay: ${errBody.slice(0, 500)}`);
            return pickFallbackResponse(normalizedUserMsg);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        const rawText = candidate?.content?.parts?.map(p => p.text || '').join(' ').trim();
        const cleaned = cleanAiResponse(rawText);

        if (!cleaned || cleaned.length < 2) {
            const finishReason = candidate?.finishReason || 'unknown';
            const blockReason = data.promptFeedback?.blockReason || 'none';
            console.warn(`[AI_CHAT] Gemini boş/geçersiz yanıt döndü, fallback kullanılıyor. finishReason=${finishReason}, blockReason=${blockReason}, raw="${(rawText || '').slice(0, 120)}"`);
            return pickFallbackResponse(normalizedUserMsg);
        }

        if ((PHONE_DIGITS_REGEX.test(normalizedUserMsg) || OFF_APP_REGEX.test(normalizedUserMsg)) && FORBIDDEN_ACCEPT_REGEX.test(cleaned)) {
            const stalled = pickFallbackResponse(normalizedUserMsg);
            console.warn(`[AI_CHAT] Dış iletişim kabulü engellendi ("${cleaned}") -> "${stalled}"`);
            return stalled;
        }

        console.log(`[AI_CHAT] Gemini yanıt üretti (finishReason=${candidate?.finishReason || 'unknown'}): "${cleaned}"`);
        return cleaned;
    } catch (err) {
        console.error(`[AI_CHAT] Gemini API Hatası (${err.name || 'Error'}):`, err.message);
        return pickFallbackResponse(userMessage);
    }
}

let aiColumnsVerified = false;
async function ensureAiColumns() {
    if (aiColumnsVerified) return;
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_messages_count INTEGER DEFAULT 0');
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hook_sent BOOLEAN DEFAULT FALSE');
    aiColumnsVerified = true;
}

/**
 * Yeni kullanıcının operatöre attığı mesaja otomatik AI yanıtı üretir ve süreci yönetir.
 */
async function processAiAutoReply({ io, chatId, userId, operatorId, userMessage }) {
    try {
        await ensureAiColumns();

        const userIdStr = userId.toString();
        const opIdStr = operatorId.toString();
        const chatIdStr = chatId.toString();

        // 1. Kullanıcı uygunluk kontrolü (Sadece yeni üyeler, ai_messages_count < 5, hiç gerçek ödeme yapmamış)
        const userRes = await db.query(
            `SELECT u.id, u.username, u.role, u.balance,
                    COALESCE(u.ai_messages_count, 0) as ai_messages_count,
                    COALESCE(u.ai_hook_sent, false) as ai_hook_sent,
                    EXISTS (
                        SELECT 1 FROM payments p
                        WHERE p.user_id::text = u.id::text
                          AND COALESCE(p.status, 'completed') = 'completed'
                    ) as has_real_payment
             FROM users u
             WHERE u.id = $1`,
            [userId]
        );
        if (userRes.rows.length === 0) return;
        const user = userRes.rows[0];

        // Sadece normal müşteri rolü için geçerli
        if (user.role !== 'user' && user.role !== 'customer') return;

        // Gerçek ödeme yapmışsa (ödeyen üye) yapay zeka devreden çıkar
        if (user.has_real_payment) {
            console.log(`[AI_CHAT] Atlandı (${user.username}): gerçek ödeme kaydı mevcut.`);
            return;
        }

        // 5 mesaj kotası dolduysa AI artık cevap vermez
        if (user.ai_messages_count >= 5) {
            console.log(`[AI_CHAT] Atlandı (${user.username}): 5 mesaj kotası doldu (${user.ai_messages_count}/5).`);
            return;
        }

        // 2. Operatör bilgilerini çek
        const opRes = await db.query(
            'SELECT id, username, display_name, name, age, city, bio, interests, avatar_url FROM users WHERE id = $1',
            [operatorId]
        );
        if (opRes.rows.length === 0) return;
        const operator = opRes.rows[0];
        const opDisplayName = operator.display_name || operator.name || operator.username || 'Fiora';

        // 3. Son mesaj geçmişini al (AI bağlamı için)
        const historyRes = await db.query(
            'SELECT sender_id, content FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 6',
            [chatId]
        );
        const chatHistory = historyRes.rows.reverse().map(m => ({
            is_user: m.sender_id.toString() === userIdStr,
            content: m.content
        }));

        console.log(`[AI_CHAT] Yeni kullanıcı (${user.username}, Mesaj #${user.ai_messages_count + 1}) için AI yanıtı hazırlanıyor...`);

        // 4. Doğallık için 5-10 saniye arasında "Yazıyor..." animasyonunu başlat
        const startTime = Date.now();
        const typingDelayMs = Math.floor(Math.random() * 5000) + 5000; // 5.000 - 10.000 ms (5-10 sn)
        const totalReplyDelayMs = Math.floor(Math.random() * 10000) + 20000; // 20.000 - 30.000 ms (20-30 sn)

        setTimeout(() => {
            if (io) {
                io.to(chatIdStr).emit('display_typing', {
                    userId: opIdStr,
                    chatId: chatIdStr
                });
            }
        }, typingDelayMs);

        // 5. AI yanıtını üret (arka planda)
        const aiReplyText = await generateAiReply({
            operator: operator,
            userMessage: userMessage,
            chatHistory: chatHistory
        });

        // 6. Cevabı 20-30 saniye aralığında gönder (insansı bekleme ve yazma hissi)
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, totalReplyDelayMs - elapsed);

        setTimeout(async () => {
            try {
                if (io) {
                    io.to(chatIdStr).emit('hide_typing', {
                        userId: opIdStr,
                        chatId: chatIdStr
                    });
                }

                // Mesajı veritabanına kaydet
                const msgRes = await db.query(
                    'INSERT INTO messages (chat_id, sender_id, content, content_type, is_read, created_at) VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *',
                    [chatId, operatorId, aiReplyText, 'text']
                );
                const savedMsg = msgRes.rows[0];

                // Sohbeti güncelle
                await db.query(
                    'UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2',
                    [aiReplyText, chatId]
                );

                const msgToEmit = {
                    ...savedMsg,
                    chat_id: chatIdStr,
                    type: savedMsg.content_type || 'text',
                    sender_id: opIdStr,
                    sender_name: opDisplayName,
                    sender_username: operator.username,
                    sender_avatar: operator.avatar_url,
                    created_at: savedMsg.created_at || new Date().toISOString()
                };

                // Socket bildirimleri
                if (io) {
                    io.to(chatIdStr).emit('receive_message', msgToEmit);
                    io.to(userIdStr).emit('new_message', msgToEmit);
                    io.to(userIdStr).emit('chat_updated', {
                        chatId: chatIdStr,
                        last_message: aiReplyText,
                        last_message_at: new Date()
                    });
                }

                // Push bildirimi
                sendPushNotification(userId, {
                    title: opDisplayName,
                    body: aiReplyText,
                    data: {
                        chatId: chatIdStr,
                        senderId: opIdStr,
                        senderName: opDisplayName,
                        senderAvatar: operator.avatar_url,
                        type: 'message'
                    }
                }).catch(() => {});

                // Kullanıcının AI sayaç değerini artır
                const updatedUserRes = await db.query(
                    'UPDATE users SET ai_messages_count = COALESCE(ai_messages_count, 0) + 1 WHERE id = $1 RETURNING ai_messages_count, balance, ai_hook_sent',
                    [userId]
                );
                const updatedUser = updatedUserRes.rows[0];
                const currentCount = updatedUser?.ai_messages_count || 0;
                const currentBalance = parseFloat(updatedUser?.balance || 0);

                console.log(`[AI_CHAT] Yanıt gönderildi: [${operator.display_name} -> ${user.username}]: "${aiReplyText}" (Kullanılan AI Mesajı: ${currentCount}/5, Kalan Bakiye: ${currentBalance})`);

                // 7. 5. MESAJ / COİN BİTTİĞİNDE OTOMATİK ONAY MESAJI (18 saniye sonra)
                if ((currentCount >= 5 || currentBalance <= 0) && !updatedUser.ai_hook_sent) {
                    console.log(`[AI_CHAT] Kullanıcının (${user.username}) 5 hakkı/coini bitti! 18 saniye sonra Numara Onay mesajı atılacak...`);
                    
                    setTimeout(async () => {
                        try {
                            // Çift gönderimi önlemek için kontrol et
                            const checkHook = await db.query('SELECT ai_hook_sent FROM users WHERE id = $1', [userId]);
                            if (checkHook.rows[0]?.ai_hook_sent) return;

                            // Hazır mesajlardan veya varsayılandan onay mesajını al
                            const qrRes = await db.query("SELECT content FROM quick_replies WHERE title = 'Numara Onay' LIMIT 1");
                            const hookText = qrRes.rows[0]?.content || 'Kullanıcı sizinle numarasını paylaşmak için NUMARA PAYLAŞIMI onayında bulunmuştur. Numarayı görüntüleyebilmek için ONAY yazınız. (05** *** ** **)';

                            // Mesajı kaydet
                            const hookMsgRes = await db.query(
                                'INSERT INTO messages (chat_id, sender_id, content, content_type, is_read, created_at) VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *',
                                [chatId, operatorId, hookText, 'text']
                            );
                            const savedHookMsg = hookMsgRes.rows[0];

                            // Sohbeti ve kullanıcıyı güncelle
                            await db.query(
                                'UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2',
                                [hookText, chatId]
                            );
                            await db.query('UPDATE users SET ai_hook_sent = true WHERE id = $1', [userId]);

                            const hookMsgToEmit = {
                                ...savedHookMsg,
                                chat_id: chatIdStr,
                                type: savedHookMsg.content_type || 'text',
                                sender_id: opIdStr,
                                sender_name: opDisplayName,
                                sender_username: operator.username,
                                sender_avatar: operator.avatar_url,
                                created_at: savedHookMsg.created_at || new Date().toISOString()
                            };

                            if (io) {
                                io.to(chatIdStr).emit('receive_message', hookMsgToEmit);
                                io.to(userIdStr).emit('new_message', hookMsgToEmit);
                                io.to(userIdStr).emit('chat_updated', {
                                    chatId: chatIdStr,
                                    last_message: hookText,
                                    last_message_at: new Date()
                                });
                            }

                            // Push bildirimi
                            sendPushNotification(userId, {
                                title: opDisplayName,
                                body: 'Numara Paylaşımı Onayı!',
                                data: {
                                    chatId: chatIdStr,
                                    senderId: opIdStr,
                                    senderName: opDisplayName,
                                    senderAvatar: operator.avatar_url,
                                    type: 'message'
                                }
                            }).catch(() => {});

                            console.log(`[AI_CHAT] [NUMARA ONAY HOOK] Kullanıcıya (${user.username}) kanca mesajı başarıyla atıldı!`);
                        } catch (hookErr) {
                            console.error('[AI_CHAT] Hook mesajı gönderme hatası:', hookErr.message);
                        }
                    }, 18000); // 18 saniye (15-20 saniye aralığı)
                }
            } catch (innerErr) {
                console.error('[AI_CHAT] Mesaj gönderme iç hatası:', innerErr.message);
            }
        }, remainingDelay);

    } catch (err) {
        console.error('[AI_CHAT] processAiAutoReply hatası:', err.message);
    }
}

module.exports = {
    generateAiReply,
    processAiAutoReply,
    cleanAiResponse
};
