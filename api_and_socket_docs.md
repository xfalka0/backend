# FALKA Software - Backend API & Socket.io Dokümantasyonu

Bu doküman, human-operated sesli sohbet ve arkadaşlık uygulamasının tüm REST API uç noktalarını (endpoints) ve Socket.io gerçek zamanlı haberleşme olaylarını (events) listeler.

---

## 1. REST API Kılavuzu

Tüm REST API isteklerinde aksi belirtilmedikçe `Content-Type: application/json` başlığı kullanılmalıdır. Korunan (Private) uç noktalar için `Authorization: Bearer <JWT_TOKEN>` başlığı ile kimlik doğrulaması yapılması zorunludur.

### 1.1 Kimlik Doğrulama (Auth API)

#### 1.1.1 OTP Kodu İsteme
- **URL**: `POST /api/auth/request-otp`
- **Erişim**: Herkese Açık (Public)
- **İstek Gövdesi (Request Body)**:
```json
{
  "email": "kullanici@example.com"
}
```
- **Yanıt (Response) - 200 OK**:
```json
{
  "message": "OTP gönderildi. Lütfen e-postanızı kontrol edin."
}
```

#### 1.1.2 OTP Doğrulama ve Giriş/Kayıt
- **URL**: `POST /api/auth/verify-otp`
- **Erişim**: Herkese Açık (Public)
- **İstek Gövdesi**:
```json
{
  "email": "kullanici@example.com",
  "otp": "123456"
}
```
- **Yanıt (Response) - 200 OK**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "c917f7d6-cc44-4b04-8917-1dbbed0b1e9b",
    "email": "kullanici@example.com",
    "username": "kullanici_123",
    "role": "user",
    "balance": 100
  }
}
```

---

### 1.2 Sesli Parti Odaları API'leri

#### 1.2.1 Aktif Odaları Listeleme
- **URL**: `GET /api/party-rooms`
- **Erişim**: Yetkili (Bearer Token)
- **Yanıt (Response) - 200 OK**:
```json
[
  {
    "id": "e2a4cdcf-d985-48b2-b13c-0e704e6c382a",
    "title": "Gece Muhabbeti 🎙️",
    "host_id": "c917f7d6-cc44-4b04-8917-1dbbed0b1e9b",
    "host_name": "Ahmet Yılmaz",
    "host_avatar": "https://via.placeholder.com/150",
    "host_vip": 2,
    "room_level": 6,
    "is_private": false,
    "active_speakers": 3,
    "participants": [
      { "id": "user-id-1", "avatar_url": "https://..." },
      { "id": "user-id-2", "avatar_url": "https://..." }
    ],
    "created_at": "2026-06-14T01:00:00.000Z"
  }
]
```

#### 1.2.2 Oda Oluşturma
- **URL**: `POST /api/party-rooms`
- **Erişim**: Yetkili (Bearer Token)
- **İstek Gövdesi**:
```json
{
  "title": "Hafta Sonu Eğlencesi",
  "background_url": "https://images.unsplash.com/photo-...",
  "is_private": false,
  "password": ""
}
```
- **Yanıt (Response) - 200 OK**:
```json
{
  "id": "e2a4cdcf-d985-48b2-b13c-0e704e6c382a",
  "title": "Hafta Sonu Eğlencesi",
  "host_id": "c917f7d6-cc44-4b04-8917-1dbbed0b1e9b",
  "room_level": 1,
  "is_private": false,
  "created_at": "2026-06-14T01:20:00.000Z"
}
```

#### 1.2.3 Odadaki Koltukları Listeleme
- **URL**: `GET /api/party-rooms/:roomId/seats`
- **Erişim**: Yetkili (Bearer Token)
- **Yanıt (Response) - 200 OK**:
```json
[
  {
    "id": 1045,
    "room_id": "e2a4cdcf-d985-48b2-b13c-0e704e6c382a",
    "seat_number": 1,
    "user_id": "user-uuid-123",
    "is_locked": false,
    "is_muted": false,
    "username": "konusmacı1",
    "display_name": "Canan Dağ",
    "avatar_url": "https://...",
    "vip_level": 1
  }
]
```

#### 1.2.4 Agora RTC Ses Tokeni Alma
- **URL**: `POST /api/party-rooms/:roomId/token`
- **Erişim**: Yetkili (Bearer Token)
- **Yanıt (Response) - 200 OK**:
```json
{
  "provider": "agora",
  "token": "006f80faf42fd0845a9816658ea7e16a755IAC...",
  "channelName": "party_room_e2a4cdcf-d985-48b2-b13c-0e704e6c382a",
  "uid": 128456
}
```

#### 1.2.5 Odayı Kapatma (Host Sadece)
- **URL**: `DELETE /api/party-rooms/:roomId`
- **Erişim**: Yetkili (Oda Sahibi Sadece)
- **Yanıt (Response) - 200 OK**:
```json
{
  "message": "Oda başarıyla kapatıldı."
}
```

---

### 1.3 Moderasyon API'leri (REST Uç Noktaları)

#### 1.3.1 Kullanıcıyı Odadan At (Kick)
- **URL**: `POST /api/rooms/:id/moderation/kick`
- **Erişim**: Yetkili (Host veya Admin)
- **İstek Gövdesi**:
```json
{
  "targetUserId": "kullanici-uuid-999",
  "reason": "Kurallara aykırı davranış."
}
```
- **Yanıt (Response) - 200 OK**:
```json
{
  "message": "Kullanıcı odadan başarıyla atıldı."
}
```

#### 1.3.2 Kullanıcıyı Odada Sessize Al (Mute)
- **URL**: `POST /api/rooms/:id/moderation/mute`
- **Erişim**: Yetkili (Host veya Admin)
- **İstek Gövdesi**:
```json
{
  "targetUserId": "kullanici-uuid-999"
}
```
- **Yanıt (Response) - 200 OK**:
```json
{
  "message": "Kullanıcı mikrofon kilidi değiştirildi.",
  "isMuted": true
}
```

#### 1.3.3 Kullanıcıya Mesaj Engeli Koy (Chat Ban)
- **URL**: `POST /api/rooms/:id/moderation/chat-ban`
- **Erişim**: Yetkili (Host veya Admin)
- **İstek Gövdesi**:
```json
{
  "targetUserId": "kullanici-uuid-999"
}
```
- **Yanıt (Response) - 200 OK**:
```json
{
  "message": "Sohbet engeli uygulandı.",
  "isChatBanned": true
}
```

---

## 2. SOCKET.IO HABERLEŞME KILAVUZU

Soket bağlantısı başlatılırken, kimlik doğrulama tokenı `auth: { token: 'JWT_TOKEN' }` şeklinde gönderilmelidir.

### 2.1 İstemciden Sunucuya Gönderilen Olaylar (Client -> Server Emits)

| Olay Adı (Event Name) | Gönderilen Parametreler | Açıklama |
|---|---|---|
| `join_party_room` | `{ roomId: string }` | Belirtilen sesli parti odasına katılır. |
| `leave_party_room` | `{ roomId: string }` | Sesli odadan ayrılır ve ayrılan koltuğu boşaltır. |
| `request_seat` | `{ roomId: string, seatNumber: number }` | Belirtilen numaralı boş koltuğa oturma isteği yollar. |
| `leave_seat` | `{ roomId: string, seatNumber: number }` | Oturulan koltuktan kalkış yapar. |
| `toggle_seat_mute` | `{ roomId: string, seatNumber: number }` | Koltuğun ses durumunu değiştirir (Mute/Unmute). |
| `lock_seat` | `{ roomId: string, seatNumber: number, isLocked: boolean }` | Sadece Host: Belirtilen koltuğu kilitler veya kilidini açar. |
| `send_party_message` | `{ roomId: string, content: string, clientMessageId?: string }` | Odaya sohbet mesajı gönderir. |
| `send_party_gift` | `{ roomId: string, targetUserId: string, giftId: number, quantity: number, idempotencyKey: string }` | Koltuktaki kullanıcıya hediye yollar. Mükerrer istek engeli için idempotencyKey zorunludur. |

### 2.2 Sunucudan İstemciye İletilen Olaylar (Server -> Client Broadcasts)

| Olay Adı (Event Name) | Alınan Parametreler | Açıklama |
|---|---|---|
| `party_seats_state` | `[ { seat_number: number, user_id: string, is_locked: boolean, is_muted: boolean, username: string } ]` | Odaya girildiğinde mevcut koltukların tam listesini döner. |
| `party_seat_updated` | `{ seat_number: number, user_id: string/null, username: string/null, avatar_url: string/null, vip_level: number, is_muted: boolean }` | Bir koltuğa birisi oturduğunda veya koltuktan kalktığında tetiklenir. |
| `party_seat_mute_changed` | `{ seat_number: number, is_muted: boolean, user_id: string }` | Bir koltuğun mikrofon durumu değiştiğinde yayılır. |
| `party_seat_lock_changed` | `{ seat_number: number, is_locked: boolean }` | Bir koltuk kilitlendiğinde veya kilidi açıldığında yayılır. |
| `receive_party_message` | `{ id: string, content: string, sender: { id, username, display_name, avatar_url }, created_at: Date }` | Odaya yeni bir sohbet mesajı ulaştığında tüm oda üyelerine yayılır. |
| `user_joined_party` | `{ userId: string, username: string, avatar: string, vip_level: number }` | Odaya yeni bir izleyici girdiğinde tetiklenir. |
| `user_left_party` | `{ userId: string }` | Bir izleyici odadan çıktığında tetiklenir. |
| `party_gift_sent` | `{ gift_id, gift_name, gift_cost, gift_icon, sender: { id, username }, recipient_id }` | Hediye başarıyla gönderildiğinde ekranda hediye banner animasyonu göstermek üzere yayılır. |
| `party_chat_cleared` | `{ roomId: string }` | Oda sohbet geçmişi temizlendiğinde tetiklenir. |
| `moderation:kicked` | `{ roomId, targetUserId, reason }` | Bir kullanıcı odadan atıldığında yayılır. |
| `moderation:muted` | `{ roomId, targetUserId, isMuted }` | Bir kullanıcının ses durumu moderatörce güncellendiğinde yayılır. |
| `moderation:chat_banned` | `{ roomId, targetUserId, isChatBanned }` | Kullanıcıya chat banı atıldığında yayılır. |
| `gift_success` | `{ idempotencyKey: string, duplicate: boolean }` | İstemcinin hediye gönderme isteğinin durumunu ve mükerrer olup olmadığını onaylar. |
| `party_room_error` | `{ message: string }` | Yetkisiz koltuk alma, yetersiz bakiye gibi hatalarda istemciye özel gönderilir. |
| `balance_update` | `{ userId: string, newBalance: number }` | Hediye gönderimi sonrasında göndericinin yeni coin bakiyesini günceller. |
