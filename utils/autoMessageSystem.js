const db = require('../db');
const { sendPushNotification } = require('./notificationUtils');

/**
 * Otomatik Bot / Operatör Mesajlaşma Sistemi
 * 
 * Kurallar:
 * 1. Onboarding tamamlanmadan (onboarding_completed !== true) ASLA mesaj gitmez.
 * 2. Profil tamamlandıktan sonra ilk mesaj 45-60 saniye sonra gelir (yavaş ve doğal).
 * 3. Bir operatör bir kullanıcıya ASLA 2. kez otomatik mesaj atamaz; her mesaj kesinlikle farklı bir kişiden gelir.
 * 4. Mesajlar doğal, emojisiz ve noktalama işaretsiz sade günlük konuşma dilindedir.
 * 5. Kullanıcı uygulamadan çıkarsa (socket bağlantısı kesilirse) zamanlayıcılar anında durdurulur.
 */

// Aktif kullanıcı oturumları: userId -> { socketIds: Set, timers: Set, intervalId: Timer, usedOpIds: Set }
const activeUserSessions = new Map();

// Doğal ilk tanışma mesajları (emojisiz, noktalama işaretsiz)
const REALISTIC_FIRST_MESSAGES = [
    "Selam yenisin sanırım",
    "Profilin iyimiş bi selam vereyim dedim",
    "Selam günün nası geçiyor",
    "Buralarda yeni misin",
    "Selam fotoğrafın çok güzel nerede çekildin acaba",
    "Enerjin fotoğraflarından bile çok tatlı duruyor yazmadan duramadım",
    "Merhaba buralarda mısın biraz sohbet edelimmi",
    "Selam sende benim gibi sıcakladınmı",
    "Nerde yaşıyosun",
    "Sevgilin varmı",
    "Nerelisin",
    "Selam",
    "Selamm nabeerr"
];

// Doğal devam mesajları (emojisiz, noktalama işaretsiz)
const REALISTIC_ONGOING_MESSAGES = [
    "Naber nasıl gidiyor",
    "Napıyosun neler yapıyosun",
    "Sıkıldım biraz laflayalım mı",
    "Hangi şehirdesin bu arada",
    "Burcun ne senin",
    "Müzik dinliyorum öyle sen napıyosun",
    "Çok tatlı duruyosun yazayım dedim",
    "Buralarda mısın hala",
    "Uyumadın mı daha",
    "Nelerle uğraşıyosun günün nasıl geçti",
    "Senin gibi birine denk gelmek şaşırttı beni",
    "Konuşacak kafa dengi birini arıyodum",
    "Gözlerin çok güzelmiş bu arada",
    "Yaş kaçtı senin",
    "Kahve yaptım kendime sen napıyosun",
    "Burda mısın sohbet edelim biraz",
    "Tarzın çok hoşuma gitti",
    "Bi selam vereyim dedim naber",
    "Tanışalım mı ne dersin",
    "Bugün çok yoruldum biraz kafa dağıtalım",
    "Ne işle meşgulsün",
    "Mesajımı görmedin mi",
    "Dışarıdaydım yeni geldim sen napıyosun",
    "Sohbetin sarar gibi duruyor",
    "Boyun kaç merak ettim",
    "Gece kuşu musun sende benim gibi",
    "Sessiz buralar biraz konuşalım mı"
];

/**
 * Kullanıcıya tek bir otomatik bot/operatör mesajı gönderir
 * Kural: Kesinlikle daha önce bu kullanıcıya mesaj atmamış FARKLI bir operatör seçilir.
 */
async function sendSingleAutoMessage(io, userId, isFirstRound = false) {
    try {
        const userIdStr = userId.toString();
        const session = activeUserSessions.get(userIdStr);
        if (!session || session.socketIds.size === 0) {
            return; // Kullanıcı artık uygulamada değil
        }

        // 1. Kullanıcının durumunu ve onboarding kontrolünü yap
        const userRes = await db.query(
            "SELECT id, username, display_name, gender, role, onboarding_completed, account_status FROM users WHERE id = $1",
            [userId]
        );
        if (userRes.rows.length === 0) return;

        const user = userRes.rows[0];
        if (user.role !== 'user' || user.account_status !== 'active') return;

        // KRİTİK: Kullanıcı onboarding'i tamamlamadıysa ("Sen kimsin?" vs. ekranındaysa) ASLA mesaj gönderme!
        if (user.onboarding_completed !== true) {
            console.log(`[AUTO-MSG] Kullanıcı ${userId} henüz onboarding'i bitirmedi, mesaj gönderimi iptal edildi.`);
            return;
        }

        // Cinsiyet kontrolü
        const userGenderRaw = (user.gender || 'erkek').toLowerCase();
        const userGender = (userGenderRaw === 'male' || userGenderRaw === 'erkek') ? 'erkek' : 'kadin';
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';

        // 2. KESİN KURAL: Bu kullanıcıya DAHA ÖNCE ASLA MESAJ ATMAMIŞ ve bu oturumda kullanılmamış operatör seç
        const opQuery = `
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
              )
            ORDER BY RANDOM()
            LIMIT 10
        `;

        const opsRes = await db.query(opQuery, [targetGender, userId]);

        if (opsRes.rows.length === 0) {
            console.log(`[AUTO-MSG] Kullanıcı ${userId} için daha önce mesaj atmamış uygun ${targetGender} operatör kalmadı.`);
            return;
        }

        // Bu oturumda hafızada bekleyen veya yeni kullanılan operatörleri de filtrele
        const unusedOps = opsRes.rows.filter(op => !session.usedOpIds.has(op.id.toString()));
        const candidateOps = unusedOps.length > 0 ? unusedOps : opsRes.rows;

        // Rastgele 1 operatör seç
        const selectedOp = candidateOps[Math.floor(Math.random() * candidateOps.length)];
        session.usedOpIds.add(selectedOp.id.toString());

        // 3. Mesaj metnini seç
        const messagePool = isFirstRound ? REALISTIC_FIRST_MESSAGES : REALISTIC_ONGOING_MESSAGES;
        const msgText = messagePool[Math.floor(Math.random() * messagePool.length)];

        // 4. Sohbet kaydı oluştur veya bul
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

        // 6. Sohbeti güncelle
        await db.query(
            'UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2',
            [msgText, chatId]
        );

        // 7. Socket.IO Canlı Bildirimleri
        if (io) {
            const msgToEmit = {
                ...savedMsg,
                chat_id: chatId.toString(),
                sender_name: selectedOp.display_name,
                sender_username: selectedOp.username,
                sender_avatar: selectedOp.avatar_url,
                created_at: savedMsg.created_at || new Date().toISOString()
            };

            // Sohbet odasındaysa mesaj anında düşer
            io.to(chatId.toString()).emit('receive_message', msgToEmit);

            // Sohbetler listesindeyse konuşma en üste zıplar, okunmamış rozeti güncellenir
            io.to(userIdStr).emit('new_message', msgToEmit);
            io.to(userIdStr).emit('chat_updated', {
                chatId: chatId.toString(),
                last_message: msgText,
                last_message_at: new Date()
            });

            console.log(`[AUTO-MSG] Gönderildi: [${selectedOp.display_name}] (${selectedOp.id}) -> Kullanıcı ${user.username} (${userId}): "${msgText}"`);
        }

        // 8. Push Bildirimi Gönder
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
 * Kullanıcı ana uygulamadayken süreci başlatır
 * Yalnızca onboarding tamamlandıysa ve kullanıcı gerçekten uygulamadaysa çalışır.
 */
async function startUserAutoEngagement(io, userId, socketId) {
    if (!userId) return;
    const userIdStr = userId.toString();

    try {
        // Kullanıcının onboarding durumunu kontrol et
        const check = await db.query('SELECT onboarding_completed, role FROM users WHERE id = $1', [userId]);
        if (check.rows.length === 0) return;
        if (check.rows[0].role !== 'user') return;

        // Henüz profil açma adımlarındaysa başlatma!
        if (check.rows[0].onboarding_completed !== true) {
            console.log(`[AUTO-ENGAGEMENT] Kullanıcı ${userIdStr} onboarding tamamlamadığı için bekletiliyor.`);
            return;
        }

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

        // Eğer zaten zamanlayıcılar çalışıyorsa tekrar başlatma
        if (session.timers.size > 0 || session.intervalId) {
            return;
        }

        console.log(`[AUTO-ENGAGEMENT] Başlatıldı (Doğal ve Yavaş Akış): Kullanıcı ID ${userIdStr}`);

        // --- 1. AŞAMA: PROFİL AÇILDIKTAN / GİRDİKTEN SONRA YAVAŞ VE DOĞAL BAŞLANGIÇ ---
        // 1. Mesaj: 45 - 60 saniye sonra (hemen ilk saniyede değil!)
        // 2. Mesaj: ~2.5 - 3.5 dakika sonra (FARKLI bir kişiden)
        // 3. Mesaj: ~5.5 - 7 dakika sonra (YİNE FARKLI bir kişiden)
        const initialDelays = [
            Math.floor(Math.random() * 15000) + 45000,   // 45 - 60 saniye
            Math.floor(Math.random() * 60000) + 150000,  // 2.5 - 3.5 dakika
            Math.floor(Math.random() * 90000) + 330000   // 5.5 - 7 dakika
        ];

        initialDelays.forEach((delay) => {
            const timer = setTimeout(async () => {
                session.timers.delete(timer);
                if (activeUserSessions.has(userIdStr)) {
                    await sendSingleAutoMessage(io, userIdStr, true);
                }
            }, delay);
            session.timers.add(timer);
        });

        // --- 2. AŞAMA: UYGULAMADA KALDIĞI SÜRECE DEVAM EDEN YAVAŞ AKIŞ ---
        // Her 8 - 12 dakikada bir, tek bir yeni ve farklı kişiden mesaj
        const ONGOING_INTERVAL = (Math.floor(Math.random() * 4) + 8) * 60 * 1000; // 8 - 11 dakika

        session.intervalId = setInterval(async () => {
            if (!activeUserSessions.has(userIdStr) || session.socketIds.size === 0) {
                clearInterval(session.intervalId);
                session.intervalId = null;
                return;
            }

            console.log(`[AUTO-ENGAGEMENT] Devam döngüsü tetiklendi: Kullanıcı ID ${userIdStr}`);
            await sendSingleAutoMessage(io, userIdStr, false);

        }, ONGOING_INTERVAL);

    } catch (err) {
        console.error('[AUTO-ENGAGEMENT START ERROR]:', err.message);
    }
}

/**
 * Kullanıcı onboarding'i bitirdiğinde (PUT /profile) tetiklenebilir
 */
function onUserCompletedOnboarding(io, userId) {
    if (!userId) return;
    const userIdStr = userId.toString();
    const session = activeUserSessions.get(userIdStr);
    // Eğer socket açıksa hemen zamanlayıcıları başlat
    if (session && session.socketIds.size > 0) {
        startUserAutoEngagement(io, userId, Array.from(session.socketIds)[0]);
    }
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
    onUserCompletedOnboarding,
    sendSingleAutoMessage
};
