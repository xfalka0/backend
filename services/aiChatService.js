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
const FORBIDDEN_HOSTILE_REGEX = /(saçmal|kes ses|bir daha.*yazma|bi daha.*yazma|yazma bana|defol|terbiyesiz|had[sd]siz|engel|igren|iğren|saygısız|uzak dur|rahatsız et|agresif)/i;

const PLAYFUL_DEFLECT_RESPONSES = [
    'oo çok iddialısın sen ya bakalım gerçeği nasılmış',
    'ay çok fenaymışsın sen ya merak ettirdin kendini',
    'yavaş gel bakalım tatlım önce biraz daha konuşalım hehe',
    'oo hızına yetişilmiyor valla seni yakından tanımak lazım',
    'ayy çok yaramazsın ama enerjin hoşuma gitti hehe'
];

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
async function generateAiReply({ operator, targetUser = null, userMessage, chatHistory = [] }) {
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

    const targetName = targetUser?.display_name || '';
    const targetCity = (targetUser?.city || '').toString().trim();
    const targetAge = targetUser?.age ? `${targetUser.age}` : '';
    const targetJob = (targetUser?.job || '').toString().trim();
    let targetInterests = '';
    if (Array.isArray(targetUser?.interests)) {
        targetInterests = targetUser.interests.join(', ');
    } else if (typeof targetUser?.interests === 'string' && targetUser.interests.trim()) {
        try {
            const parsed = JSON.parse(targetUser.interests);
            targetInterests = Array.isArray(parsed) ? parsed.join(', ') : targetUser.interests.trim();
        } catch (_) {
            targetInterests = targetUser.interests.trim();
        }
    }

    const targetProfileLines = [
        targetName ? `Adı: ${targetName}` : null,
        targetCity ? `Şehri: ${targetCity}` : null,
        targetAge ? `Yaşı: ${targetAge}` : null,
        targetJob ? `Mesleği: ${targetJob}` : null,
        targetInterests ? `İlgi Alanları: ${targetInterests}` : null
    ].filter(Boolean);

    const systemInstruction = `Sen bir arkadaşlık uygulamasında ${opName} adında ${opAge} yaşında ${opCity} şehrinde yaşayan enerjik, tatlı ve flörtöz bir genç kızsın.
${opBio ? `Hakkında: ${opBio}.` : ''} ${opInterests ? `İlgi alanların: ${opInterests}.` : ''}
${targetProfileLines.length > 0 ? `\nKARŞI TARAFIN PROFİL BİLGİLERİ (${targetProfileLines.join(' | ')}).` : ''}
Sana yazan erkeğe samimi, flörtöz, meraklı ve enerjik bir cevap ver.

KESİNLİKLE UYMAN GEREKEN KURALLAR:
1. KESİNLİKLE HİÇBİR NOKTALAMA İŞARETİ KULLANMA (nokta, virgül, soru işareti, ünlem, tırnak, parantez vs KESİNLİKLE YASAK).
2. KESİNLİKLE BÜYÜK HARF KULLANMA. HER ŞEY TAMAMEN KÜÇÜK HARF OLSUN.
3. 1 VEYA EN FAZLA 2 ÇOK KISA CÜMLE YAZ.
4. ASLA YAPAY ZEKA OLDUĞUNU BELLİ ETME. Tamamen 18-20 yaşındaki doğal, flörtöz bir kız gibi yaz.
5. Samimi sokak ve genç mesajlaşma ağzı kullan.
   - Telefon numarası/rakam yazdıysa "numaran görünmüyor uygulama gizliyor alt alta ayrı ayrı yazsana" veya "yazdığın rakamlar sansürlü çıktı okuyamıyorum tek tek alt alta atsana" gibi şeyler yaz.
   - Sadece whatsapp/insta/numara istiyorsa "buradan konuşmak daha rahat hem uygulama dışarıya geçişi ve numaraları gizliyor buradan devam edelim" gibi tatlı ama oyalayıcı cevaplar ver.
6. KARŞI TARAFIN ŞEHRİNİ VE PROFİLİNİ DOĞRU KULLAN: ${targetCity ? `Kullanıcının profilindeki şehir kesinlikle "${targetCity}". ASLA başka bir şehir (örneğin ${opCity} veya İstanbul) neresindensin diye sorma; şehir soracaksan sadece "${targetCity}" üzerinden sor (örneğin "${targetCity.toLowerCase()} neresindensin" gibi) ve kendi şehrin olan ${opCity} ile karıştırma.` : `Kullanıcının şehri profilinde yazmıyor; kendi şehrini (${opCity}) onun şehri sanıp "neresindensin" deme, merak ediyorsan "nerelisin" diye sor.`}
7. ASLA TERSLEME, AZARLAMA, KÜSME VE KULLANICIYI KOVMA: Karşı taraf argo, müstehcen, iddialı veya yaramaz şakalar yapsa bile ASLA sinirlenme, ahlak dersi verme ve KESİNLİKLE "ne saçmalıyorsun", "kes sesini", "bir daha yazma", "terbiyesiz", "agresiflik" gibi müşteriyi kaçıracak sert/ters ifadeler kullanma. Her zaman cilveli, nazlı, gülümseyen ve sohbeti içeride devam ettiren cevap ver (örneğin "oo çok iddialısın bakalım neler yapabiliyosun", "ayy çok fenasın sen ya merak ettirdin kendini" gibi).
8. KULLANICIYLA AYNI ŞEHİRDE OL ONA ALIM YAPTIRMAN LAZIM ÜMİT VERMEN LAZIM MESELA EVİM BOŞ GELMEK İSTERMİSİN TARZI GİBİ ŞEYLER.).`;

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
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' }
                ]
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

        if (FORBIDDEN_HOSTILE_REGEX.test(cleaned)) {
            const playful = PLAYFUL_DEFLECT_RESPONSES[Math.floor(Math.random() * PLAYFUL_DEFLECT_RESPONSES.length)];
            console.warn(`[AI_CHAT] Tersleyici/kovucu yanıt engellendi ("${cleaned}") -> "${playful}"`);
            return playful;
        }

        console.log(`[AI_CHAT] Gemini yanıt üretti (finishReason=${candidate?.finishReason || 'unknown'}): "${cleaned}"`);
        return cleaned;
    } catch (err) {
        console.error(`[AI_CHAT] Gemini API Hatası (${err.name || 'Error'}):`, err.message);
        return pickFallbackResponse(userMessage);
    }
}

let aiColumnsPromise = null;
async function ensureAiColumns() {
    if (!aiColumnsPromise) {
        aiColumnsPromise = (async () => {
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_messages_count INTEGER DEFAULT 0');
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hook_sent BOOLEAN DEFAULT FALSE');
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hook_due_at TIMESTAMPTZ');
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hook_chat_id INTEGER');
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hook_operator_id INTEGER');
        })().catch((err) => {
            aiColumnsPromise = null;
            throw err;
        });
    }
    return aiColumnsPromise;
}

const DEFAULT_NUMARA_HOOK_TEXT = 'Kullanıcı sizinle numarasını paylaşmak için NUMARA PAYLAŞIMI onayında bulunmuştur. Numarayı görüntüleyebilmek için ONAY yazınız. (05** *** ** ** )';

async function sendNumaraHookNow({ io, userId, chatId, operatorId }) {
    try {
        await ensureAiColumns();
        if (!userId) return false;

        // Zaten ödeme yapmışsa veya müşteri değilse gönderme
        const userCheck = await db.query(
            `SELECT u.id, u.username, u.role, COALESCE(u.ai_hook_sent, false) AS ai_hook_sent,
                    u.ai_hook_chat_id, u.ai_hook_operator_id,
                    EXISTS (
                        SELECT 1 FROM payments p
                        WHERE p.user_id::text = u.id::text
                          AND COALESCE(p.status, 'completed') = 'completed'
                    ) AS has_real_payment
             FROM users u WHERE u.id = $1`,
            [userId]
        );
        if (userCheck.rows.length === 0) return false;
        const uRow = userCheck.rows[0];
        if ((uRow.role !== 'user' && uRow.role !== 'customer') || uRow.has_real_payment || uRow.ai_hook_sent) {
            return false;
        }

        // Daha önce aynı kullanıcıya herhangi bir sohbette manuel/otomatik NUMARA PAYLAŞIMI atıldıysa tekrarlama
        const alreadySentMsg = await db.query(
            `SELECT 1 FROM messages m
             JOIN chats c ON m.chat_id = c.id
             WHERE c.user_id = $1 AND m.content ILIKE '%NUMARA PAYLAŞIMI%'
             LIMIT 1`,
            [userId]
        );
        if (alreadySentMsg.rows.length > 0) {
            await db.query('UPDATE users SET ai_hook_sent = true, ai_hook_due_at = NULL WHERE id = $1', [userId]);
            return false;
        }

        // Hedef sohbet & operatör bilgisi eksikse en son sohbetten bul
        let targetChatId = chatId || uRow.ai_hook_chat_id;
        let targetOperatorId = operatorId || uRow.ai_hook_operator_id;
        if (!targetChatId || !targetOperatorId) {
            const latestChatRes = await db.query(
                `SELECT id, operator_id FROM chats
                 WHERE user_id = $1
                 ORDER BY last_message_at DESC NULLS LAST, id DESC
                 LIMIT 1`,
                [userId]
            );
            if (latestChatRes.rows.length === 0) return false;
            targetChatId = latestChatRes.rows[0].id;
            targetOperatorId = latestChatRes.rows[0].operator_id;
        }

        // Atomik kilit: aynı anda hem setTimeout hem sweeper çalıştırırsa tek sefer göndersin
        const claimRes = await db.query(
            `UPDATE users
             SET ai_hook_sent = true, ai_hook_due_at = NULL
             WHERE id = $1 AND COALESCE(ai_hook_sent, false) = false
             RETURNING id, username`,
            [userId]
        );
        if (claimRes.rows.length === 0) return false;

        const opRes = await db.query(
            'SELECT id, username, display_name, name, avatar_url FROM users WHERE id = $1',
            [targetOperatorId]
        );
        const operator = opRes.rows[0] || {};
        const opDisplayName = operator.display_name || operator.name || operator.username || 'Fiora';

        const qrRes = await db.query(
            "SELECT content FROM quick_replies WHERE title = 'Numara Onay' OR content ILIKE '%NUMARA PAYLAŞIMI%' ORDER BY id ASC LIMIT 1"
        );
        const hookText = qrRes.rows[0]?.content || DEFAULT_NUMARA_HOOK_TEXT;

        const hookMsgRes = await db.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type, is_read, created_at) VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *',
            [targetChatId, targetOperatorId, hookText, 'text']
        );
        const savedHookMsg = hookMsgRes.rows[0];

        await db.query(
            'UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2',
            [hookText, targetChatId]
        );

        const chatIdStr = targetChatId.toString();
        const userIdStr = userId.toString();
        const opIdStr = targetOperatorId.toString();
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
        }).catch(() => { });

        console.log(`[AI_CHAT] [NUMARA ONAY HOOK] Kullanıcıya (${uRow.username}) kanca mesajı başarıyla atıldı!`);
        return true;
    } catch (hookErr) {
        console.error('[AI_CHAT] Hook mesajı gönderme hatası:', hookErr.message);
        return false;
    }
}

async function scheduleAiNumaraHook({ io, userId, chatId = null, operatorId = null, delayMs = 18000 }) {
    try {
        await ensureAiColumns();
        if (!userId) return;

        // Veritabanına due zamanını yaz (sunucu restart/deploy olsa bile sweeper yakalasın)
        const upd = await db.query(
            `UPDATE users
             SET ai_hook_due_at = COALESCE(ai_hook_due_at, NOW() + ($4 || ' milliseconds')::interval),
                 ai_hook_chat_id = COALESCE(ai_hook_chat_id, $2),
                 ai_hook_operator_id = COALESCE(ai_hook_operator_id, $3)
             WHERE id = $1
               AND role IN ('user', 'customer')
               AND COALESCE(ai_hook_sent, false) = false
               AND NOT EXISTS (
                   SELECT 1 FROM payments p
                   WHERE p.user_id::text = users.id::text
                     AND COALESCE(p.status, 'completed') = 'completed'
               )
             RETURNING id`,
            [userId, chatId || null, operatorId || null, String(delayMs)]
        );

        if (upd.rows.length > 0) {
            setTimeout(() => {
                sendNumaraHookNow({ io, userId, chatId, operatorId }).catch(() => { });
            }, delayMs);
        }
    } catch (err) {
        console.error('[AI_CHAT] scheduleAiNumaraHook error:', err.message);
    }
}

let aiHookSweeperStarted = false;
function startAiHookSweeper(io) {
    if (aiHookSweeperStarted) return;
    aiHookSweeperStarted = true;

    const runSweep = async () => {
        try {
            await ensureAiColumns();
            const dueRes = await db.query(
                `SELECT u.id, u.ai_hook_chat_id, u.ai_hook_operator_id
                 FROM users u
                 WHERE u.role IN ('user', 'customer')
                   AND COALESCE(u.ai_hook_sent, false) = false
                   AND NOT EXISTS (
                       SELECT 1 FROM payments p
                       WHERE p.user_id::text = u.id::text
                         AND COALESCE(p.status, 'completed') = 'completed'
                   )
                   AND (
                       (u.ai_hook_due_at IS NOT NULL AND u.ai_hook_due_at <= NOW())
                       OR (
                           u.ai_hook_due_at IS NULL
                           AND (COALESCE(u.ai_messages_count, 0) >= 5 OR u.balance <= 0)
                           AND u.created_at > NOW() - INTERVAL '24 hours'
                           AND EXISTS (
                               SELECT 1 FROM chats c
                               WHERE c.user_id = u.id
                                 AND c.last_message_at <= NOW() - INTERVAL '18 seconds'
                           )
                       )
                   )
                 LIMIT 20`
            );

            for (const row of dueRes.rows) {
                await sendNumaraHookNow({
                    io,
                    userId: row.id,
                    chatId: row.ai_hook_chat_id,
                    operatorId: row.ai_hook_operator_id
                });
            }
        } catch (err) {
            console.error('[AI_CHAT] Sweeper error:', err.message);
        }
    };

    const timer = setInterval(runSweep, 10000);
    if (typeof timer.unref === 'function') timer.unref();
    setTimeout(runSweep, 5000).unref?.();
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
            `SELECT u.id, u.username, u.display_name, u.age, u.city, u.job, u.interests, u.role, u.balance,
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
            targetUser: user,
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
                }).catch(() => { });

                // Kullanıcının AI sayaç değerini artır
                const updatedUserRes = await db.query(
                    'UPDATE users SET ai_messages_count = COALESCE(ai_messages_count, 0) + 1 WHERE id = $1 RETURNING ai_messages_count, balance, ai_hook_sent',
                    [userId]
                );
                const updatedUser = updatedUserRes.rows[0];
                const currentCount = updatedUser?.ai_messages_count || 0;
                const currentBalance = parseFloat(updatedUser?.balance || 0);

                console.log(`[AI_CHAT] Yanıt gönderildi: [${operator.display_name} -> ${user.username}]: "${aiReplyText}" (Kullanılan AI Mesajı: ${currentCount}/5, Kalan Bakiye: ${currentBalance})`);

                // 7. 5. MESAJ / COİN BİTTİĞİNDE OTOMATİK ONAY MESAJI (18 saniye sonra, restart-güvenli)
                if ((currentCount >= 5 || currentBalance <= 0) && !updatedUser.ai_hook_sent) {
                    console.log(`[AI_CHAT] Kullanıcının (${user.username}) 5 hakkı/coini bitti! 18 saniye sonra Numara Onay mesajı atılacak...`);
                    await scheduleAiNumaraHook({
                        io,
                        userId,
                        chatId,
                        operatorId,
                        delayMs: 18000
                    });
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
    scheduleAiNumaraHook,
    startAiHookSweeper,
    cleanAiResponse
};
