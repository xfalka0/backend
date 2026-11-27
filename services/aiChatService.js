const db = require('../db');
const fs = require('fs');
const { sendPushNotification } = require('../utils/notificationUtils');

// Zamandan bağımsız flörtöz kısa mesaj havuzu (noktalamasız, tamamen küçük harf)
const TIMELESS_FALLBACKS = [
    'selam mesajını görünce bi heyecanlandım',
    'evde uzanıyorum öyle canım fena sıkılıyor sen napıyorsun',
    'yanımda olsan hiç fena olmazdı şu an',
    'üzerimde rahat bi şeyle uzanıyorum mesajını bekliyordum',
    'ayy çok tatlısın merak ettirdin kendini bana',
    'biraz sohbet edelim mi çok iyi geldin şu an'
];

// Sadece geç gece saatlerinde (23:00 - 05:00 TR) havuza eklenen mesajlar
const NIGHT_FALLBACKS = [
    'bu gece uyku tutmadı hiç sen napıyorsun bakalım',
    'gece yeni başlıyor biraz yaramazlık yapalım mı',
    'yatakta tek başımayım uzanıyorum aklıma geldin'
];

const PHONE_NUMBER_STALL_RESPONSES = [
    'numaranı tek tek alt alta yazsana bi öyle göreyim',
    'numaranı alt alta parça parça atsana bi',
    'burdan numaranı alt alta ayrı ayrı yazsana',
    'numaranı tek tek alt alta yazıp atsana bi'
];

const OFF_APP_STALL_RESPONSES = [
    'numaranı tek tek alt alta yazsana bi ordan bakalım',
    'numaranı alt alta parça parça atsana bi',
    'burdan numaranı alt alta ayrı ayrı yazsana bi',
    'telegram yerine numaranı alt alta tek tek yazsana bi'
];

const COIN_STALL_RESPONSES = [
    'sen neler yapıyosun bugün keyfin nasıl bakalım',
    'bu arada sen hangi ilçedesin yakın mıyız acaba',
    'bugün nasıl geçiyo senin tarafta neler var',
    'neyse boşver sen ne zaman müsaitsin buluşsak'
];

const PHONE_DIGITS_REGEX = /(?:\+?\d[\s\-().]*){7,}/;
const OFF_APP_REGEX = /(whatsapp|whatsap|watsap|\bwp\b|insta|instagram|telegram|\btlg\b|tlgram|snapchat|tiktok|numara|tel\b|telefon)/i;
const FORBIDDEN_CENSOR_TALK_REGEX = /(sansür|engelliyo|gizliyo)/i;
const COIN_EXHAUSTED_USER_REGEX = /(koinim bitti|coinim bitti|jetonum bitti|jetonum kalmad[ıi]|koin kalmad[ıi]|jeton yetmiyor|koin yetmiyor|coin yetmiyor|yazam[ıi]yorum|bakiye bitti|param bitti|paras[ıi]z)/i;
const FORBIDDEN_ACCEPT_REGEX = /(kaydet|kayded|eklerim|ekliyorum|ekledim|yazarım|yazıyorum|geçelim|geçeriz|geliyorum|bakarız orada|ordan yaz|numaramı versem|numaramı atsam|gönderiyorum numaramı)/i;
const FORBIDDEN_FREE_COIN_REGEX = /(dert etme|sorun de[ğg]il.*yaz|bo[şs]ver.*jeton|bo[şs]ver.*koin|paras[ıi]z yaz|ücretsiz yaz|buradan devam et bedava)/i;
const FORBIDDEN_DIRECT_UPSELL_REGEX = /(jeton|koin|coin)\s*(yükle|al|satın)/i;
const FORBIDDEN_HOSTILE_REGEX = /(saçmal|kes ses|bir daha.*yazma|bi daha.*yazma|yazma bana|defol|terbiyesiz|had[sd]siz|engel|igren|iğren|saygısız|uzak dur|rahatsız et|agresif)/i;
const FORBIDDEN_ON_THE_WAY_REGEX = /(hemen geliyorum|şimdi geliyorum|yola çıktım|yoldayım|çıktım geliyorum|kapıdayım|gelmek üzereyim|az kaldı geliyorum)/i;

const REALISTIC_MEETING_FOLLOWUPS = [
    'ne zaman müsait oluyosun önce biraz daha tanıyalım birbirimizi',
    'olur tabi ama önce biraz daha sohbet edip ısınalım',
    'heyecanlandım bak ne zaman müsaitsin ona göre konuşalım',
    'hemen öyle mi önce biraz daha yazışsak ya tatlım'
];

const PLAYFUL_DEFLECT_RESPONSES = [
    'oo çok iddialısın yakışıklı bakalım gerçekte de bu kadar ateşli misin',
    'ayy şu söylediklerinle beni iyice heyecanlandırıyosun devam et hoşuma gitti',
    'yavaş gel bakalım ateşlim ama o kadar yaramaz olman fena halde hoşuma gidiyor',
    'oo baya tehlikeli sularda yüzüyoruz galiba ama ben bayılırım böylesine',
    'ayy çok fenasın sen ya meraklandım iyice'
];

function getTimeContext(date = new Date()) {
    // Türkiye saati (UTC+3)
    const turkeyHour = (date.getUTCHours() + 3) % 24;

    if (turkeyHour >= 6 && turkeyHour < 12) {
        return {
            turkeyHour,
            timeOfDay: 'sabah',
            hint: 'Sabah saatleri: samimi, sıcak ve tatlı flörtöz konuş. Asla gece/akşam deme.'
        };
    } else if (turkeyHour >= 12 && turkeyHour < 18) {
        return {
            turkeyHour,
            timeOfDay: 'öğlen/gündüz',
            hint: 'Gündüz saatleri: samimi, tatlı flörtöz ve meraklı konuş. Asla gece/uyku/akşam deme.'
        };
    } else if (turkeyHour >= 18 && turkeyHour < 24) {
        return {
            turkeyHour,
            timeOfDay: 'akşam',
            hint: 'Akşam saatleri: sıcak, samimi ve hafif flörtöz konuş.'
        };
    }
    return {
        turkeyHour,
        timeOfDay: 'gece',
        hint: 'Geç gece saatleri (00:00 - 06:00): daha yaramaz, cilveli ve üstü kapalı +18 imalı konuş.'
    };
}

const MEETING_ASK_PLACE_RESPONSES = [
    'tamam buluşalım hangi ilçedesin sana neresi uygun',
    'olur buluşalım sen hangi taraftasın ona göre yer bakalım',
    'tamam görüşelim hangi semttesin yakın mıyız bakalım'
];

const PHOTO_TEASE_RESPONSES = [
    'hmm nasıl foto istersin bakalım',
    'hmm ne tarz bi foto görmek istersin ki',
    'önce söyle bakalım nasıl foto hoşuna gider'
];

const PHOTO_REQUEST_REGEX = /(foto|fotoğraf|fotograf|resim|resm|selfie|poz).{0,15}(at|atsana|gönder|gondersene|yolla|yollasana|istiyorum|var mı|atarmısın|atar mısın)/i;
const SUSPICION_REGEX = /(bot musun|yapay zeka|site çalışanı|çalışanımısın|çalışanı mısın|kontür bitene|para tuzağı|sahte|dolandırıcı)/i;
const SUSPICION_RESPONSES = [
    'ayy çok ayıp kırdın beni şaka mısın',
    'ne alakası var ya şaka mısın sen',
    'ayy çok güldürdün beni yok artık daha neler'
];

const PLACE_MENTION_REGEX = /(yaşıyorum|oturuyorum|köyde|ilçede|semtte|mahalle|merkezde|buradayım|çerkezköy|kadıköy|beşiktaş|şişli|taksim|bakırköy|üsküdar|ataşehir|maltepe|kartal|pendik|çekmeköy|sancaktepe|beylikdüzü|avcılar|esenler|bağcılar|bahçelievler|sarıyer|levent|mecidiyeköy|çankaya|kızılay|keçiören|yenimahalle|etimesgut|mamak|sincan|bornova|karşıyaka|konak|buca|alsancak|bostanlı|nilüfer|osmangazi|yıldırım|muratpaşa|konyaaltı|lara|kepez|seyhan|çukurova|gebze|izmit|körfez|gölcük|derince|odunpazarı|tepebaşı|karaköprü|eyyübiye|haliliye)/i;

function pickFallbackResponse(userMessage = '', date = new Date(), chatHistory = []) {
    const msg = String(userMessage || '');
    if (SUSPICION_REGEX.test(msg)) {
        return SUSPICION_RESPONSES[Math.floor(Math.random() * SUSPICION_RESPONSES.length)];
    }
    if (PHONE_DIGITS_REGEX.test(msg)) {
        return PHONE_NUMBER_STALL_RESPONSES[Math.floor(Math.random() * PHONE_NUMBER_STALL_RESPONSES.length)];
    }
    if (/(buluşalım|bir yer söyle|görüşelim|buluşsak)/i.test(msg)) {
        const mentionedPlace = Array.isArray(chatHistory) && chatHistory.some(
            m => m?.is_user && PLACE_MENTION_REGEX.test(m.content || '')
        );
        const pool = mentionedPlace ? REALISTIC_MEETING_FOLLOWUPS : MEETING_ASK_PLACE_RESPONSES;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    if (PHOTO_REQUEST_REGEX.test(msg)) {
        return PHOTO_TEASE_RESPONSES[Math.floor(Math.random() * PHOTO_TEASE_RESPONSES.length)];
    }
    if (COIN_EXHAUSTED_USER_REGEX.test(msg)) {
        return COIN_STALL_RESPONSES[Math.floor(Math.random() * COIN_STALL_RESPONSES.length)];
    }
    if (OFF_APP_REGEX.test(msg) || /^[a-z0-9._-]*\d[a-z0-9._-]*$/i.test(msg.trim()) || msg.includes('@')) {
        return OFF_APP_STALL_RESPONSES[Math.floor(Math.random() * OFF_APP_STALL_RESPONSES.length)];
    }

    const turkeyHour = (date.getUTCHours() + 3) % 24;
    const isNight = turkeyHour >= 23 || turkeyHour < 5;
    const pool = isNight ? [...TIMELESS_FALLBACKS, ...NIGHT_FALLBACKS] : TIMELESS_FALLBACKS;

    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Yanıtı tamamen küçük harfe çevirir ve noktalama işaretlerini kelimeler yapışmayacak şekilde temizler.
 */
function cleanAiResponse(text) {
    if (!text) return '';
    let cleaned = text.toLocaleLowerCase('tr-TR');
    // Kesme işaretlerini birleştirerek kaldır (adana'da -> adanada)
    cleaned = cleaned.replace(/['’`]/g, '');
    // Diğer tüm noktalama işaretlerini TEK BİR BOŞLUĞA çevir (kelimeler yapışmasın)
    cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_~()?!"“”«»—–…\[\]+]/g, ' ');
    // Yan yana oluşan fazla boşlukları teke indir
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

async function callGeminiWithFallback({ apiKey, requestBody, timeoutMs = 10000 }) {
    const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
    for (const model of models) {
        const isThinkingCapable = model.startsWith('gemini-3.8') || model.startsWith('gemini-2.5');
        const body = isThinkingCapable
            ? requestBody
            : {
                ...requestBody,
                generationConfig: (() => {
                    const { thinkingConfig, ...rest } = requestBody.generationConfig || {};
                    return rest;
                })()
            };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(body)
            });
            clearTimeout(timeout);
            if (res.ok) {
                return { ok: true, model, data: await res.json() };
            }
            const errBody = await res.text().catch(() => '');
            console.warn(`[AI_CHAT] ${model} HTTP ${res.status}, sonraki modele geçiliyor. Detay: ${errBody.slice(0, 250)}`);
        } catch (err) {
            clearTimeout(timeout);
            console.warn(`[AI_CHAT] ${model} hata (${err.name || 'Error'}: ${err.message}), sonraki modele geçiliyor.`);
        }
    }
    return { ok: false, data: null };
}
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
        targetAge ? `Yaşı: ${targetAge}` : null
    ].filter(Boolean);

    const timeInfo = getTimeContext();
    const openingHint = OPENING_STYLE_HINTS[Math.floor(Math.random() * OPENING_STYLE_HINTS.length)];

    const systemInstruction = `Sen ${opName}, ${opAge} yaşında, arkadaşlık uygulamasında sohbet eden gerçek bir genç kadınsın.
${targetCity ? `Karşı tarafın şehri: ${targetCity}.` : ''}
TON: ${timeInfo.hint}
AÇILIŞ: ${openingHint}

YAZIM:
- Sadece 1 kısa cümle (5-12 kelime), tamamen küçük harf, noktalama işareti YOK.
- Günlük düz WhatsApp ağzıyla konuş. Sıkıcı anket soruları ("ne iş yapıyorsun", "müzik ne dinlersin"), edebiyat, felsefe, şiir, hava durumu/esinti lafları ("geceleri hep böyle esintili mi" gibi) ve ses/foto uydurması KESİNLİKLE YASAK.
- Kullanıcı sormadıkça durduk yere profilindeki şehirden laf açma.
- Karşı taraf demedikçe "aşkım/bebeğim" deme; isimleri tekrarlama.
- Önceki mesajlarda sen/operatör ne dediyse ASLA tersini söyleme (az önce "görünmüyor" dendiyse sonra "gördüm" deme).

ÖRNEK DURUMLAR (Buna göre doğal konuş):
- Şüphe ("bot musun / site çalışanı mısın / kontür bitene kadar mı"): Cilveli şakaya vur -> "ayy çok ayıp kırdın beni şaka mısın"
- Nick, Instagram, Telegram veya telefon yazarsa ("Saptali46ninja", "tlg yaz", "0532..."): Görünmedi gibi davran -> "yazdığın çıkmadı ki numaranı alt alta tek tek yazsana bi" (ASLA "sistem sansürlüyor", "gördüm" veya "eklerim" deme!)
- Buluşalım derse: İlçe belli değilse -> "tamam buluşalım hangi ilçedesin sana neresi uygun", ilçe zaten söylendiyse -> "tamam ne zaman müsaitsin" (Asla "yoldayım/geliyorum" deme).
- Fotoğraf isterse: Sadece sor -> "hmm nasıl foto istersin bakalım" (özelden atma sözü verme).
- Jeton/koin bitti derse: Jeton konusuna HİÇ girme ("jeton yükle" de deme, "dert etme" de deme); doğrudan sohbeti veya buluşmayı ilerleten doğal bir soru sor.
- Şehir/soru sorarsa: Bekarım, tanışıp eğlenmek istiyorum de. ${targetCity ? `Şehir sorarsa "ben de ${targetCity.toLowerCase()}dayım" de.` : `Şehir sorarsa "${opCity.toLowerCase()}" de.`}`;

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

        const { ok, model, data } = await callGeminiWithFallback({
            apiKey,
            timeoutMs: 7000,
            requestBody: {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: contents,
                generationConfig: {
                    temperature: 0.80,
                    maxOutputTokens: 75,
                    thinkingConfig: { thinkingBudget: 0 }
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                ]
            }
        });

        if (!ok || !data) {
            return pickFallbackResponse(normalizedUserMsg, new Date(), chatHistory);
        }

        const candidate = data.candidates?.[0];
        const rawText = candidate?.content?.parts?.map(p => p.text || '').join(' ').trim();
        const cleaned = cleanAiResponse(rawText);

        if (!cleaned || cleaned.length < 2) {
            const finishReason = candidate?.finishReason || 'unknown';
            const blockReason = data.promptFeedback?.blockReason || 'none';
            console.warn(`[AI_CHAT] Gemini boş/geçersiz yanıt döndü, fallback kullanılıyor. finishReason=${finishReason}, blockReason=${blockReason}, raw="${(rawText || '').slice(0, 120)}"`);
            return pickFallbackResponse(normalizedUserMsg);
        }

        const looksLikeHandle = /^[a-z0-9._-]*\d[a-z0-9._-]*$/i.test(normalizedUserMsg) || normalizedUserMsg.includes('@');
        if (((PHONE_DIGITS_REGEX.test(normalizedUserMsg) || OFF_APP_REGEX.test(normalizedUserMsg) || looksLikeHandle) && (FORBIDDEN_ACCEPT_REGEX.test(cleaned) || /\bgördüm\b/i.test(cleaned))) || /(numaramı versem|numaramı atsam|gönderiyorum numaramı)/i.test(cleaned) || FORBIDDEN_CENSOR_TALK_REGEX.test(cleaned)) {
            const stalled = 'yazdığın çıkmadı ki numaranı alt alta tek tek yazsana bi';
            console.warn(`[AI_CHAT] Dış iletişim / nick tutarsızlığı engellendi ("${cleaned}") -> "${stalled}"`);
            return stalled;
        }

        if (FORBIDDEN_FREE_COIN_REGEX.test(cleaned) || FORBIDDEN_DIRECT_UPSELL_REGEX.test(cleaned)) {
            const stall = pickFallbackResponse(normalizedUserMsg, new Date(), chatHistory);
            console.warn(`[AI_CHAT] Ücretsizleştirme veya direkt jeton satışı engellendi ("${cleaned}") -> "${stall}"`);
            return stall;
        }

        if (PHOTO_REQUEST_REGEX.test(normalizedUserMsg) && !/(foto|resim|poz|tarz|çekmemi|görmek istersin|hoşuna gider)/i.test(cleaned)) {
            const tease = PHOTO_TEASE_RESPONSES[Math.floor(Math.random() * PHOTO_TEASE_RESPONSES.length)];
            console.warn(`[AI_CHAT] Fotoğraf isteğini geçiştirme engellendi ("${cleaned}") -> "${tease}"`);
            return tease;
        }

        if (/(buluşalım|bir yer söyle|görüşelim|buluşsak)/i.test(normalizedUserMsg) && !/(ilçe|semt|taraf|neresi|uygun|buluş|müsaitsin|zaman)/i.test(cleaned)) {
            const mentionedPlace = Array.isArray(chatHistory) && chatHistory.some(
                m => m?.is_user && PLACE_MENTION_REGEX.test(m.content || '')
            );
            const pool = mentionedPlace ? REALISTIC_MEETING_FOLLOWUPS : MEETING_ASK_PLACE_RESPONSES;
            const meetReply = pool[Math.floor(Math.random() * pool.length)];
            console.warn(`[AI_CHAT] Buluşma isteğini geçiştirme engellendi ("${cleaned}") -> "${meetReply}"`);
            return meetReply;
        }

        if (FORBIDDEN_HOSTILE_REGEX.test(cleaned)) {
            const playful = PLAYFUL_DEFLECT_RESPONSES[Math.floor(Math.random() * PLAYFUL_DEFLECT_RESPONSES.length)];
            console.warn(`[AI_CHAT] Tersleyici/kovucu yanıt engellendi ("${cleaned}") -> "${playful}"`);
            return playful;
        }

        if (FORBIDDEN_ON_THE_WAY_REGEX.test(cleaned)) {
            const mentionedPlace = Array.isArray(chatHistory) && chatHistory.some(
                m => m?.is_user && PLACE_MENTION_REGEX.test(m.content || '')
            );
            const pool = mentionedPlace ? REALISTIC_MEETING_FOLLOWUPS : MEETING_ASK_PLACE_RESPONSES;
            const realistic = pool[Math.floor(Math.random() * pool.length)];
            console.warn(`[AI_CHAT] Gerçekçi olmayan "yoldayım/hemen geliyorum" yanıtı engellendi ("${cleaned}") -> "${realistic}"`);
            return realistic;
        }

        const userMentionedPlace = Array.isArray(chatHistory) && chatHistory.some(
            m => m?.is_user && PLACE_MENTION_REGEX.test(m.content || '')
        );
        if (userMentionedPlace && /(hangi semttesin|hangi ilçedesin|hangi taraftasın|ne taraftasın|neresindesin|sen nerelisin|neredesin bakalım)/i.test(cleaned)) {
            const stripped = cleaned.replace(/\b(peki\s+)?(sen\s+)?(hangi semttesin|hangi ilçedesin|hangi taraftasın|ne taraftasın|neresindesin|sen nerelisin|neredesin bakalım)\b/gi, '').replace(/\s+/g, ' ').trim();
            if (stripped.length >= 12) {
                console.warn(`[AI_CHAT] Tekrarlanan ilçe/semt parçası temizlendi ("${cleaned}") -> "${stripped}"`);
                return stripped;
            }
            const realistic = REALISTIC_MEETING_FOLLOWUPS[Math.floor(Math.random() * REALISTIC_MEETING_FOLLOWUPS.length)];
            console.warn(`[AI_CHAT] Tekrarlanan ilçe/semt sorusu engellendi ("${cleaned}") -> "${realistic}"`);
            return realistic;
        }
        if (Boolean(targetCity) && /(sen nerelisin|hangi şehirdesin)/i.test(cleaned)) {
            const stripped = cleaned.replace(/\b(peki\s+)?(sen nerelisin|hangi şehirdesin)\b/gi, '').replace(/\s+/g, ' ').trim();
            if (stripped.length >= 12) {
                console.warn(`[AI_CHAT] Tekrarlanan şehir parçası temizlendi ("${cleaned}") -> "${stripped}"`);
                return stripped;
            }
            const realistic = REALISTIC_MEETING_FOLLOWUPS[Math.floor(Math.random() * REALISTIC_MEETING_FOLLOWUPS.length)];
            console.warn(`[AI_CHAT] Tekrarlanan şehir sorusu engellendi ("${cleaned}") -> "${realistic}"`);
            return realistic;
        }

        const userUsedAffection = AFFECT_WORDS_REGEX.test(normalizedUserMsg) || (
            Array.isArray(chatHistory) && chatHistory.some(m => m?.is_user && AFFECT_WORDS_REGEX.test(m.content || ''))
        );
        let finalReply = cleaned;
        if (!userUsedAffection && AFFECT_WORDS_REGEX.test(finalReply)) {
            const stripped = finalReply.replace(/\b(aşkım|bebeğim|hayatım|sevgilim)\b/gi, '').replace(/\s+/g, ' ').trim();
            if (stripped.length >= 4) {
                finalReply = stripped;
            }
        }

        if (RECENT_AI_REPLIES.includes(finalReply) && /^(selam|slm|merhaba|mrb|hey|hi)\b/i.test(normalizedUserMsg)) {
            const unusedGreetings = VARIED_GREETING_POOL.filter(g => !RECENT_AI_REPLIES.includes(g));
            const pool = unusedGreetings.length > 0 ? unusedGreetings : VARIED_GREETING_POOL;
            finalReply = pool[Math.floor(Math.random() * pool.length)];
        }
        rememberAiReply(finalReply);

        console.log(`[AI_CHAT] Gemini yanıt üretti (finishReason=${candidate?.finishReason || 'unknown'}): "${finalReply}"`);
        return finalReply;
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
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_locked_promo_at TIMESTAMPTZ');
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hook_sent_at TIMESTAMPTZ');
        })().catch((err) => {
            aiColumnsPromise = null;
            throw err;
        });
    }
    return aiColumnsPromise;
}

const DEFAULT_NUMARA_HOOK_TEXT = 'Kullanıcı sizinle numarasını paylaşmak için NUMARA PAYLAŞIMI onayında bulunmuştur. Numarayı görüntüleyebilmek için ONAY yazınız. (05** *** ** ** )';
const NUMARA_MEETING_FOLLOWUPS = [
    'numaramı attım detayları konuşalım ararsın',
    'numaram geldi mi buluşma işini ordan netleştiririz ararsın beni',
    'numaramı gönderdim detayları telefonla konuşuruz ararsın',
    'numaram düştü mü sana müsait olunca ararsın konuşuruz'
];
const NUMARA_GENERAL_FOLLOWUPS = [
    'numaramı attım ordan devam edelim konuşmaya',
    'numaram geldi mi onaylayınca ordan yazarsın',
    'numaramı gönderdim görebildin mi ordan görüşelim',
    'numaram düştü mü sana ordan konuşalım biraz daha'
];
const MEETING_CONTEXT_REGEX = /(buluş|kahve iç|çay iç|yemek y|görüşelim|dışarı çık|yanına gel|evim boş|ne zaman müsait|ne zaman buluş)/i;
const AFFECT_WORDS_REGEX = /(aşkım|bebeğim|hayatım|sevgilim)/i;
const FORBIDDEN_PUSHY_CALL_REGEX = /(çabuk.*ara|hemen ara|dayanamıyorum|aşkım|bebeğim)/i;

function pickNumaraFollowupFallback(historyMessages = []) {
    const historyText = historyMessages.map(m => m?.content || '').join(' ');
    const pool = MEETING_CONTEXT_REGEX.test(historyText) ? NUMARA_MEETING_FOLLOWUPS : NUMARA_GENERAL_FOLLOWUPS;
    return pool[Math.floor(Math.random() * pool.length)];
}

async function generateNumaraFollowup({ chatId, userId }) {
    let historyMessages = [];
    try {
        const histRes = await db.query(
            `SELECT sender_id, content FROM messages
             WHERE chat_id = $1 AND content NOT ILIKE '%NUMARA PAYLAŞIMI%' AND content_type = 'text'
             ORDER BY created_at DESC LIMIT 8`,
            [chatId]
        );
        const userIdStr = String(userId);
        historyMessages = histRes.rows.reverse().map(m => ({
            is_user: String(m.sender_id) === userIdStr,
            content: (m.content || '').trim()
        })).filter(m => m.content);
    } catch (_) {
        historyMessages = [];
    }

    const historyText = historyMessages.map(m => m.content).join(' ');
    const userUsedAffection = historyMessages.some(m => m.is_user && AFFECT_WORDS_REGEX.test(m.content));
    const hasMeetingContext = MEETING_CONTEXT_REGEX.test(historyText);

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || historyMessages.length === 0) {
        return pickNumaraFollowupFallback(historyMessages);
    }

    const transcript = historyMessages
        .map(m => `${m.is_user ? 'Erkek' : 'Sen'}: ${m.content}`)
        .join('\n');

    const prompt = `Aşağıdaki sohbette az önce karşı tarafa sistemden otomatik "NUMARA PAYLAŞIMI onayında bulunmuştur (ONAY yazınız)" bildirimi gitti.
Şimdi bunun hemen peşine gidecek 1 kısa, doğal takip mesajı yaz.

SOHBET GEÇMİŞİ:
${transcript}

KURALLAR:
1. Sohbetin üslubuna ve konusuna uyumlu yaz.
2. ${hasMeetingContext ? 'Sohbette buluşma/kahve/plan konusu geçiyor: "numaramı attım detayları konuşalım ararsın" veya "numaram geldi mi buluşmayı ordan ayarlarız ararsın" gibi doğal bir mesaj yaz.' : 'Sohbetin akışına göre "numaramı attım ordan konuşalım" veya "numaram geldi mi ordan devam edelim" tarzı doğal bir mesaj yaz.'}
3. ${userUsedAffection ? 'Sohbette samimi hitap varsa ölçülü koruyabilirsin.' : 'Sohbette "aşkım", "bebeğim", "hayatım" gibi kelimeler KULLANILMAMIŞ. Sen de ASLA "aşkım", "bebeğim" deme!'}
4. ASLA "çabuk ara", "çabuk çabuk ara", "hemen ara", "dayanamıyorum" gibi yapay/aceleci ifadeler kullanma.
5. Tamamen küçük harf kullan, noktalama işareti koyma, en fazla 8-12 kelimelik tek kısa cümle yaz.`;

    try {
        const { ok, data } = await callGeminiWithFallback({
            apiKey,
            timeoutMs: 6000,
            requestBody: {
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.65, maxOutputTokens: 45, thinkingConfig: { thinkingBudget: 0 } },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                ]
            }
        });
        if (!ok || !data) return pickNumaraFollowupFallback(historyMessages);

        const raw = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join(' ').trim();
        const cleaned = cleanAiResponse(raw);
        if (!cleaned || cleaned.length < 4) return pickNumaraFollowupFallback(historyMessages);
        if (!userUsedAffection && AFFECT_WORDS_REGEX.test(cleaned)) return pickNumaraFollowupFallback(historyMessages);
        if (!hasMeetingContext && /(buluşma|buluşmayı)/i.test(cleaned)) return pickNumaraFollowupFallback(historyMessages);
        if (FORBIDDEN_PUSHY_CALL_REGEX.test(cleaned)) return pickNumaraFollowupFallback(historyMessages);
        return cleaned;
    } catch (_) {
        return pickNumaraFollowupFallback(historyMessages);
    }
}
const HOOK_DELAY_MS = 30000; // AI yanıtından 30 saniye sonra gönder
const activeAiReplyUsers = new Set();

async function sendNumaraHookNow({ io, userId, chatId, operatorId }) {
    try {
        await ensureAiColumns();
        if (!userId) return false;
        if (activeAiReplyUsers.has(String(userId))) {
            // AI cevabı henüz hazırlanıyor/gönderiliyor; erken kesme, 30sn sonraya ertele
            await db.query(
                `UPDATE users SET ai_hook_due_at = NOW() + INTERVAL '30 seconds' WHERE id = $1 AND COALESCE(ai_hook_sent, false) = false`,
                [userId]
            ).catch(() => {});
            return false;
        }

        // Zaten ödeme yapmışsa veya müşteri değilse gönderme
        const userCheck = await db.query(
            `SELECT u.id, u.username, u.role, COALESCE(u.ai_hook_sent, false) AS ai_hook_sent,
                    u.ai_hook_chat_id, u.ai_hook_operator_id, u.last_locked_promo_at,
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

        // Kilitli fotoğraf ile çakışma koruması: son 18 saat (veya ayarlanan cooldown) içinde kilitli foto atıldıysa ertele
        let cooldownHours = 18;
        try {
            const { getLockedPromoSettings, isInEveningActiveWindow } = require('./lockedPhotoPromoService');
            const promoSettings = await getLockedPromoSettings();
            cooldownHours = Math.max(1, Number(promoSettings?.numara_cooldown_hours || 5));

            if (uRow.last_locked_promo_at) {
                const lockedAtMs = new Date(uRow.last_locked_promo_at).getTime();
                const resumeAtMs = lockedAtMs + cooldownHours * 60 * 60 * 1000;
                if (Date.now() < resumeAtMs) {
                    await db.query(
                        `UPDATE users SET ai_hook_due_at = GREATEST(COALESCE(ai_hook_due_at, NOW()), $2::timestamptz) WHERE id = $1`,
                        [userId, new Date(resumeAtMs).toISOString()]
                    ).catch(() => {});
                    return false;
                }
            }

            // Akşam 19:00-01:00 penceresinde kilitli fotoğraf önceliklidir (havuzda görünmemiş foto varsa 2 dk bekle)
            if (promoSettings?.is_enabled && isInEveningActiveWindow(promoSettings)) {
                const unseenRes = await db.query(
                    `SELECT 1 FROM locked_photo_pool p
                     WHERE p.is_active = TRUE
                       AND NOT EXISTS (
                           SELECT 1 FROM locked_photo_deliveries d
                           WHERE d.photo_id = p.id AND d.user_id = $1
                       )
                     LIMIT 1`,
                    [userId]
                );
                if (unseenRes.rows.length > 0 && (!uRow.last_locked_promo_at || (Date.now() - new Date(uRow.last_locked_promo_at).getTime()) > cooldownHours * 60 * 60 * 1000)) {
                    await db.query(
                        `UPDATE users SET ai_hook_due_at = NOW() + INTERVAL '2 minutes' WHERE id = $1`,
                        [userId]
                    ).catch(() => {});
                    return false;
                }
            }
        } catch (_) {
            // lockedPhotoPromoService henüz hazır değilse normal akışa devam et
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
             SET ai_hook_sent = true, ai_hook_sent_at = NOW(), ai_hook_due_at = NULL
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

        // Numara onay mesajından 6-9 saniye sonra doğal "numaram geldi mi çabuk ara beni" takip mesajı
        const followUpDelayMs = Math.floor(Math.random() * 3000) + 6000;
        setTimeout(() => {
            if (io) {
                io.to(chatIdStr).emit('display_typing', { userId: opIdStr, chatId: chatIdStr });
            }
        }, Math.max(2000, followUpDelayMs - 3000));

        setTimeout(async () => {
            try {
                if (io) {
                    io.to(chatIdStr).emit('hide_typing', { userId: opIdStr, chatId: chatIdStr });
                }
                const paidCheck = await db.query(
                    `SELECT 1 FROM payments WHERE user_id::text = $1::text AND COALESCE(status, 'completed') = 'completed' LIMIT 1`,
                    [userIdStr]
                );
                if (paidCheck.rows.length > 0) return;

                const followText = await generateNumaraFollowup({ chatId: targetChatId, userId: userIdStr });
                const fMsgRes = await db.query(
                    'INSERT INTO messages (chat_id, sender_id, content, content_type, is_read, created_at) VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *',
                    [targetChatId, targetOperatorId, followText, 'text']
                );
                const savedFollowMsg = fMsgRes.rows[0];
                await db.query('UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2', [followText, targetChatId]);

                const followToEmit = {
                    ...savedFollowMsg,
                    chat_id: chatIdStr,
                    type: savedFollowMsg.content_type || 'text',
                    sender_id: opIdStr,
                    sender_name: opDisplayName,
                    sender_username: operator.username,
                    sender_avatar: operator.avatar_url,
                    created_at: savedFollowMsg.created_at || new Date().toISOString()
                };

                if (io) {
                    io.to(chatIdStr).emit('receive_message', followToEmit);
                    io.to(userIdStr).emit('new_message', followToEmit);
                    io.to(userIdStr).emit('chat_updated', {
                        chatId: chatIdStr,
                        last_message: followText,
                        last_message_at: new Date()
                    });
                }

                sendPushNotification(userId, {
                    title: opDisplayName,
                    body: followText,
                    data: {
                        chatId: chatIdStr,
                        senderId: opIdStr,
                        senderName: opDisplayName,
                        senderAvatar: operator.avatar_url,
                        type: 'message'
                    }
                }).catch(() => { });

                console.log(`[AI_CHAT] [NUMARA TAKİP] (${uRow.username}): "${followText}"`);
            } catch (fErr) {
                console.warn('[AI_CHAT] Numara takip mesajı hatası:', fErr.message);
            }
        }, followUpDelayMs).unref?.();

        return true;
    } catch (hookErr) {
        console.error('[AI_CHAT] Hook mesajı gönderme hatası:', hookErr.message);
        return false;
    }
}

async function scheduleAiNumaraHook({ io, userId, chatId = null, operatorId = null, delayMs = HOOK_DELAY_MS, forceResetDue = false }) {
    try {
        await ensureAiColumns();
        if (!userId) return;

        // Veritabanına due zamanını yaz (AI yanıtı bittiyse 30sn sonrası olarak güncellenir)
        const dueExpr = forceResetDue
            ? "NOW() + ($4 || ' milliseconds')::interval"
            : "COALESCE(ai_hook_due_at, NOW() + ($4 || ' milliseconds')::interval)";

        const upd = await db.query(
            `UPDATE users
             SET ai_hook_due_at = ${dueExpr},
                 ai_hook_chat_id = COALESCE($2, ai_hook_chat_id),
                 ai_hook_operator_id = COALESCE($3, ai_hook_operator_id)
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
                           AND EXISTS (SELECT 1 FROM chats c WHERE c.user_id = u.id)
                           AND NOT EXISTS (
                               SELECT 1 FROM chats c
                               WHERE c.user_id = u.id
                                 AND c.last_message_at > NOW() - INTERVAL '30 seconds'
                           )
                       )
                   )
                 LIMIT 20`
            );

            for (const row of dueRes.rows) {
                if (activeAiReplyUsers.has(String(row.id))) continue;
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

const VARIED_GREETING_POOL = [
    'selamm hoş geldin keyfin nasıl bakalım',
    'ooo kimler yazmış günün nasıl geçiyo',
    'selam buralarda yeni misin seni pek görmedim',
    'merhaba iyi ki yazdın tam canım sıkılıyodu',
    'selam yakışıklı keyfin yerinde mi bakalım',
    'hoş geldin bakalım nasıl gidiyo günün'
];

const OPENING_STYLE_HINTS = [
    'Günlük WhatsApp ağzıyla düz ve samimi selam ver (örn: "selam hoş geldin nasıl geçiyo günün"). Asla süslü/şiirsel cümle kurma.',
    'Hafif cilveli ama çok sade ve gerçekçi konuş (örn: "selamm iyi ki yazdın canım sıkılıyodu"). Asla edebiyat yapma.',
    'Kısa, düz ve meraklı başla (örn: "merhaba buralarda yeni misin pek görmedim seni"). Asla şair gibi konuşma.',
    'Samimi ve sıcak bir ilk mesaj at (örn: "selam keyfin yerinde mi bakalım"). Asla hava durumu veya şehir edebiyatı yapma.'
];

const RECENT_AI_REPLIES = [];
function rememberAiReply(text) {
    if (!text) return;
    RECENT_AI_REPLIES.push(text);
    if (RECENT_AI_REPLIES.length > 25) RECENT_AI_REPLIES.shift();
}

const AI_BURST_DEBOUNCE_MS = 4000;
const pendingAiDebounces = new Map();
const activeAiReplyChats = new Set();
const queuedAiReplyArgs = new Map();

function releaseAiChatLockAndRunNext(chatIdStr, userIdStr) {
    activeAiReplyChats.delete(chatIdStr);
    const nextArgs = queuedAiReplyArgs.get(chatIdStr);
    if (nextArgs) {
        queuedAiReplyArgs.delete(chatIdStr);
        executeAiAutoReply(nextArgs).catch((err) => {
            console.error('[AI_CHAT] Kuyruktaki AI yanıt hatası:', err.message);
        });
        return;
    }
    if (!pendingAiDebounces.has(chatIdStr)) {
        activeAiReplyUsers.delete(userIdStr);
    }
}

/**
 * Arka arkaya kısa sürede atılan mesajları birleştirip sırayla AI yanıtı üretir.
 */
async function processAiAutoReply(args) {
    const { chatId, userId } = args || {};
    if (!chatId || !userId) return;

    const chatIdStr = chatId.toString();
    const userIdStr = userId.toString();
    activeAiReplyUsers.add(userIdStr);

    const existing = pendingAiDebounces.get(chatIdStr);
    if (existing) {
        clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
        pendingAiDebounces.delete(chatIdStr);
        if (activeAiReplyChats.has(chatIdStr)) {
            queuedAiReplyArgs.set(chatIdStr, args);
            return;
        }
        executeAiAutoReply(args).catch((err) => {
            console.error('[AI_CHAT] executeAiAutoReply hatası:', err.message);
            releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
        });
    }, AI_BURST_DEBOUNCE_MS);
    timer.unref?.();

    pendingAiDebounces.set(chatIdStr, { timer, args });
}

/**
 * Yeni kullanıcının operatöre attığı mesaja otomatik AI yanıtı üretir ve süreci yönetir.
 */
async function executeAiAutoReply({ io, chatId, userId, operatorId, userMessage }) {
    const userIdStr = userId.toString();
    const opIdStr = operatorId.toString();
    const chatIdStr = chatId.toString();
    activeAiReplyChats.add(chatIdStr);
    activeAiReplyUsers.add(userIdStr);

    try {
        await ensureAiColumns();

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
        if (userRes.rows.length === 0) {
            releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
            return;
        }
        const user = userRes.rows[0];

        // Sadece normal müşteri rolü için geçerli
        if (user.role !== 'user' && user.role !== 'customer') {
            releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
            return;
        }

        // Gerçek ödeme yapmışsa (ödeyen üye) yapay zeka devreden çıkar
        if (user.has_real_payment) {
            console.log(`[AI_CHAT] Atlandı (${user.username}): gerçek ödeme kaydı mevcut.`);
            releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
            return;
        }

        // 5 mesaj kotası dolduysa AI artık cevap vermez
        if (user.ai_messages_count >= 5) {
            console.log(`[AI_CHAT] Atlandı (${user.username}): 5 mesaj kotası doldu (${user.ai_messages_count}/5).`);
            releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
            return;
        }

        // 2. Operatör bilgilerini çek
        const opRes = await db.query(
            'SELECT id, username, display_name, name, age, city, bio, interests, avatar_url FROM users WHERE id = $1',
            [operatorId]
        );
        if (opRes.rows.length === 0) {
            releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
            return;
        }
        const operator = opRes.rows[0];
        const opDisplayName = operator.display_name || operator.name || operator.username || 'Fiora';

        // 3. Son mesaj geçmişini al (AI bağlamı için sadece metin mesajlar)
        const historyRes = await db.query(
            `SELECT sender_id, content FROM messages
             WHERE chat_id = $1 AND content_type = 'text' AND content NOT ILIKE '%NUMARA PAYLAŞIMI%'
             ORDER BY created_at DESC LIMIT 8`,
            [chatId]
        );
        const chatHistory = historyRes.rows.reverse().map(m => ({
            is_user: m.sender_id.toString() === userIdStr,
            content: m.content
        }));

        // Arka arkaya atılan son kullanıcı balonlarını tek mesajda birleştir
        const trailingUserMsgs = [];
        for (let i = chatHistory.length - 1; i >= 0; i--) {
            if (chatHistory[i].is_user) trailingUserMsgs.unshift(chatHistory[i].content.trim());
            else break;
        }
        const effectiveUserMessage = trailingUserMsgs.length > 0
            ? trailingUserMsgs.join(' ')
            : userMessage;

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
        let aiReplyText;
        try {
            aiReplyText = await generateAiReply({
                operator: operator,
                targetUser: user,
                userMessage: effectiveUserMessage,
                chatHistory: chatHistory
            });
        } catch (genErr) {
            releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
            throw genErr;
        }

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

                releaseAiChatLockAndRunNext(chatIdStr, userIdStr);

                // 7. 5. MESAJ / COİN BİTTİĞİNDE OTOMATİK ONAY MESAJI (AI yanıtından tam 30 saniye sonra)
                if ((currentCount >= 5 || currentBalance <= 0) && !updatedUser.ai_hook_sent) {
                    console.log(`[AI_CHAT] Kullanıcının (${user.username}) 5 hakkı/coini bitti! 30 saniye sonra Numara Onay mesajı atılacak...`);
                    await scheduleAiNumaraHook({
                        io,
                        userId,
                        chatId,
                        operatorId,
                        delayMs: HOOK_DELAY_MS,
                        forceResetDue: true
                    });
                }
            } catch (innerErr) {
                releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
                console.error('[AI_CHAT] Mesaj gönderme iç hatası:', innerErr.message);
            }
        }, remainingDelay);

    } catch (err) {
        releaseAiChatLockAndRunNext(chatIdStr, userIdStr);
        console.error('[AI_CHAT] executeAiAutoReply hatası:', err.message);
    }
}

module.exports = {
    generateAiReply,
    processAiAutoReply,
    scheduleAiNumaraHook,
    startAiHookSweeper,
    cleanAiResponse,
    getTimeContext,
    pickFallbackResponse,
    pickNumaraFollowupFallback,
    generateNumaraFollowup
};
