const db = require('../db');
const { sendPushNotification } = require('./notificationUtils');

/**
 * Otomatik Bot / Operatör Mesajlaşma Sistemi
 * - Kullanıcı uygulamaya girdiğinde ilk 1 dakika içinde 2-3 gerçekçi mesaj gönderir.
 * - Uygulamada aktif kaldığı sürece her 5-8 dakikada bir 2-3 yeni mesaj gelmeye devam eder.
 * - Kullanıcı uygulamayı kapattığında (bağlantı koptuğunda) zamanlayıcılar durdurulur.
 * - Cinsiyete uygun ve doğal Türkçeyle yazılmış mesajlar kullanılır.
 */

// Aktif kullanıcı oturumları: userId -> { socketIds: Set, timers: Set, intervalId: Timer, usedOpIds: Set }
const activeUserSessions = new Map();

// Gerçekçi, samimi ve doğal Türkçe mesaj havuzu
const REALISTIC_FIRST_MESSAGES = [
    "Selam! Yeni katıldın sanırım, hoş geldin :)",
    "Profilin dikkatimi çekti, selam vermek istedim ✨",
    "Selamlar, günün nasıl geçiyor?",
    "Hey, buralarda yeni misin? 😊",
    "Selam :) Fotoğrafın çok güzel, nerede çekildin acaba?",
    "Enerjin fotoğraflarından bile çok tatlı duruyor, yazmadan duramadım 🌸",
    "Merhaba! Buralarda mısın, biraz sohbet edelim mi?",
    "Selam :) Profiline bakmadan geçemedim açıkçası.",
    "Hey! Buraların yabancısı gibisin, eşlik etmemi ister misin?",
    "Selamlar! Profilini gördüm ve kayıtsız kalamadım ✨",
    "Merhaba, tarzını çok beğendim. Nerelisin?",
    "İyi akşamlar :) Umarım günün güzel geçiyordur, tanışalım mı?",
    "Selam, profiline denk geldim de çok tatlı duruyorsun :)"
];

const REALISTIC_ONGOING_MESSAGES = [
    "Günün nasıl gidiyor? Biraz laflayalım mı? :)",
    "Müzik dinliyorum öyle, sen neler yapıyorsun?",
    "Burada senin gibi birine denk gelmek şaşırttı beni 🙈",
    "Sohbetin de profilin kadar keyifli mi acaba? Merak ettim :)",
    "Selam :) Hangi şehirdesin bu arada?",
    "Bugün hava da modum da biraz durgun, bana iyi gelecek bir sohbet lazım :Yukarı",
    "Hey, buralarda mısın hala? 😊",
    "Profilinde burcun yazmıyordu sanırım, nedir burcun?",
    "Selam! Kahvemi aldım oturdum, sen nelerle meşgulsün?",
    "Tanışmak için iyi bir zaman gibi geldi bana, ne dersin? ✨",
    "Gülüşün çok samimi geldi, enerjin hoşuma gitti doğrusu :)",
    "Biraz buralarda takılayım dedim, seni görünce selam vereyim dedim 👋",
    "Selamm, günün yorgunluğunu atmak için biraz sohbet? :)",
    "Fotoğraflarına bakıyordum da cidden çok hoşsun 🌸",
    "Sıkıldım biraz, konuşacak samimi birini arıyordum, tam denk geldin :)",
    "Umarım günün harika geçiyordur, sana bir selam bırakayım dedim 💫"
];

/**
 * Kullanıcıya tek bir otomatik bot/operatör mesajı gönderir
 */
async function sendSingleAutoMessage(io, userId, isFirstRound = false) {
    try {
        const session = activeUserSessions.get(userId.toString());
        if (!session || session.socketIds.size === 0) {
            return; // Kullanıcı artık bağlı değil
        }

        // 1. Kullanıcının cinsiyet ve durumunu al
        const userRes = await db.query(
            "SELECT id, username, display_name, gender, role FROM users WHERE id = $1 AND role = 'user' AND account_status = 'active'",
            [userId]
        );
        if (userRes.rows.length === 0) return;

        const user = userRes.rows[0];
        const userGenderRaw = (user.gender || 'erkek').toLowerCase();
        const userGender = (userGenderRaw === 'male' || userGenderRaw === 'erkek') ? 'erkek' : 'kadin';
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';

        // 2. Karşı cinsiyetten uygun operatör / bot seç
        // Öncelik: Son 24 saatte bu kullanıcıya mesaj atmamış operatörler
        let opQuery = `
            SELECT u.id, u.username, COALESCE(u.display_name, u.name, u.username) as display_name, 
                   u.avatar_url, u.gender, u.vip_level, u.is_verified
            FROM users u
            JOIN operators o ON u.id = o.user_id
            WHERE u.account_status = 'active'
              AND u.role = 'operator'
              AND u.gender = $1
              AND u.gender != 'coin_bayisi'
              AND u.id NOT IN (
                  SELECT sender_id FROM messages m
                  JOIN chats c ON m.chat_id = c.id
                  WHERE (c.user_id = $2 OR c.operator_id = $2)
                    AND m.created_at > NOW() - INTERVAL '24 hours'
              )
            ORDER BY RANDOM()
            LIMIT 5
        `;

        let opsRes = await db.query(opQuery, [targetGender, userId]);

        // Eğer 24 saat içinde hepsi mesaj atmışsa, son 2 saate düşür
        if (opsRes.rows.length === 0) {
            const fallbackQuery = `
                SELECT u.id, u.username, COALESCE(u.display_name, u.name, u.username) as display_name, 
                       u.avatar_url, u.gender, u.vip_level, u.is_verified
                FROM users u
                JOIN operators o ON u.id = o.user_id
                WHERE u.account_status = 'active'
                  AND u.role = 'operator'
                  AND u.gender = $1
                  AND u.gender != 'coin_bayisi'
                ORDER BY RANDOM()
                LIMIT 5
            `;
            opsRes = await db.query(fallbackQuery, [targetGender]);
        }

        if (opsRes.rows.length === 0) {
            console.log(`[AUTO-MSG] Hedef cinsiyette (${targetGender}) uygun operatör bulunamadı.`);
            return;
        }

        // Bu oturumda yakın zamanda kullanılmamış bir operatör seç
        const availableOps = opsRes.rows.filter(op => !session.usedOpIds.has(op.id.toString()));
        const selectedOp = availableOps.length > 0
            ? availableOps[Math.floor(Math.random() * availableOps.length)]
            : opsRes.rows[Math.floor(Math.random() * opsRes.rows.length)];

        session.usedOpIds.add(selectedOp.id.toString());
        // Hafızada çok şişmemesi için son 15 operatörü tut
        if (session.usedOpIds.size > 15) {
            const firstAdded = session.usedOpIds.values().next().value;
            session.usedOpIds.delete(firstAdded);
        }

        // 3. Mesaj metnini seç
        const messagePool = isFirstRound ? REALISTIC_FIRST_MESSAGES : REALISTIC_ONGOING_MESSAGES;
        const msgText = messagePool[Math.floor(Math.random() * messagePool.length)];

        // 4. Sohbeti kontrol et veya oluştur
        let chatRes = await db.query(
            'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
            [userId, selectedOp.id]
        );

        let chatId;
        if (chatRes.rows.length === 0) {
            const newChat = await db.query(
                'INSERT INTO chats (user_id, operator_id, last_message, last_message_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
                [userId, selectedOp.id, msgText]
            );
            chatId = newChat.rows[0].id;
        } else {
            chatId = chatRes.rows[0].id;
        }

        // 5. Mesajı veritabanına ekle
        const msgResult = await db.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type, is_read, created_at) VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *',
            [chatId, selectedOp.id, msgText, 'text']
        );
        const savedMsg = msgResult.rows[0];

        // 6. Sohbetin son mesajını ve zamanını güncelle
        await db.query(
            'UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2',
            [msgText, chatId]
        );

        // 7. Socket.IO Gerçek Zamanlı Bildirimleri
        if (io) {
            const msgToEmit = {
                ...savedMsg,
                chat_id: chatId.toString(),
                sender_name: selectedOp.display_name,
                sender_username: selectedOp.username,
                sender_avatar: selectedOp.avatar_url,
                created_at: savedMsg.created_at || new Date().toISOString()
            };

            // Sohbet odasındaysa mesajı göster
            io.to(chatId.toString()).emit('receive_message', msgToEmit);

            // Kullanıcının kişisel odasına yeni mesaj uyarısı gönder (Sohbetler listesi anında güncellenir)
            io.to(userId.toString()).emit('new_message', msgToEmit);
            io.to(userId.toString()).emit('chat_updated', {
                chatId: chatId.toString(),
                last_message: msgText,
                last_message_at: new Date()
            });

            console.log(`[AUTO-MSG] Gönderildi: [${selectedOp.display_name}] -> Kullanıcı: ${user.username} (${userId}): "${msgText}"`);
        }

        // 8. Push Bildirimi Gönder (Kullanıcı uygulamada değilse veya arka plandaysa)
        sendPushNotification(userId, {
            title: selectedOp.display_name,
            body: msgText,
            data: {
                chatId: chatId.toString(),
                senderId: selectedOp.id.toString(),
                senderName: selectedOp.display_name,
                senderAvatar: selectedOp.avatar_url,
                type: 'message'
            }
        }).catch(() => {});

    } catch (err) {
        console.error('[AUTO-MSG ERROR]:', err.message);
    }
}

/**
 * Kullanıcı bağlandığında otomatik mesaj sürecini başlatır
 */
function startUserAutoEngagement(io, userId, socketId) {
    if (!userId) return;
    const userIdStr = userId.toString();

    let session = activeUserSessions.get(userIdStr);
    if (!session) {
        session = {
            socketIds: new Set(),
            timers: new Set(),
            intervalId: null,
            usedOpIds: new Set()
        };
        activeUserSessions.set(userIdStr, session);
    }

    session.socketIds.add(socketId);

    // Eğer zaten zamanlayıcılar çalışıyorsa (aynı kullanıcının 2. socket bağlantısı vs.) tekrar başlatma
    if (session.timers.size > 0 || session.intervalId) {
        return;
    }

    console.log(`[AUTO-ENGAGEMENT] Başlatıldı: Kullanıcı ID ${userIdStr}`);

    // --- 1. AŞAMA: İLK GİRİŞTE (İLK 1 DAKİKA) 2-3 MESAJ ---
    // Mesaj 1: 10 - 15 saniye sonra
    // Mesaj 2: 30 - 45 saniye sonra
    // Mesaj 3: 60 - 75 saniye sonra
    const initialDelays = [
        Math.floor(Math.random() * 5000) + 10000, // 10-15 sn
        Math.floor(Math.random() * 15000) + 30000, // 30-45 sn
        Math.floor(Math.random() * 15000) + 60000  // 60-75 sn
    ];

    initialDelays.forEach((delay, idx) => {
        const timer = setTimeout(async () => {
            session.timers.delete(timer);
            if (activeUserSessions.has(userIdStr)) {
                await sendSingleAutoMessage(io, userIdStr, true);
            }
        }, delay);
        session.timers.add(timer);
    });

    // --- 2. AŞAMA: UYGULAMADA KALDIĞI SÜRECE (HER 5-8 DAKİKADA BİR 2-3 MESAJ) ---
    // İlk 1 dakikadan sonra başlar
    const ONGOING_INTERVAL = (Math.floor(Math.random() * 3) + 5) * 60 * 1000; // 5 - 7 dakika

    session.intervalId = setInterval(async () => {
        if (!activeUserSessions.has(userIdStr) || session.socketIds.size === 0) {
            clearInterval(session.intervalId);
            session.intervalId = null;
            return;
        }

        console.log(`[AUTO-ENGAGEMENT] Devam döngüsü tetiklendi: Kullanıcı ID ${userIdStr}`);

        // Bu turda 2 veya 3 mesajı birkaç dakikaya yayarak planla
        const batchCount = Math.random() > 0.3 ? 3 : 2;
        for (let i = 0; i < batchCount; i++) {
            const subDelay = (i * 40000) + Math.floor(Math.random() * 20000) + 5000; // 5s, 45-65s, 85-105s
            const subTimer = setTimeout(async () => {
                session.timers.delete(subTimer);
                if (activeUserSessions.has(userIdStr) && session.socketIds.size > 0) {
                    await sendSingleAutoMessage(io, userIdStr, false);
                }
            }, subDelay);
            session.timers.add(subTimer);
        }
    }, ONGOING_INTERVAL);
}

/**
 * Kullanıcı uygulamadan çıktığında (socket koptuğunda) durdurur
 */
function stopUserAutoEngagement(userId, socketId) {
    if (!userId) return;
    const userIdStr = userId.toString();

    const session = activeUserSessions.get(userIdStr);
    if (!session) return;

    if (socketId) {
        session.socketIds.delete(socketId);
    }

    // Kullanıcının başka açık socket'i kalmadıysa tüm zamanlayıcıları temizle
    if (session.socketIds.size === 0) {
        console.log(`[AUTO-ENGAGEMENT] Kullanıcı çevrimdışı, zamanlayıcılar durduruluyor: ${userIdStr}`);

        session.timers.forEach(t => clearTimeout(t));
        session.timers.clear();

        if (session.intervalId) {
            clearInterval(session.intervalId);
            session.intervalId = null;
        }

        activeUserSessions.delete(userIdStr);
    }
}

module.exports = {
    startUserAutoEngagement,
    stopUserAutoEngagement,
    sendSingleAutoMessage
};
