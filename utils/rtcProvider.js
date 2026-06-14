const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

// Base RtcProvider Interface
class RtcProvider {
    async createJoinToken(userId, roomId, role) {
        throw new Error('createJoinToken method must be implemented.');
    }
}

// 1. Mock RTC Provider (Default for local/mobile client tests)
class MockRtcProvider extends RtcProvider {
    async createJoinToken(userId, roomId, role) {
        const mockToken = `mock_token_${role}_usr_${userId.substring(0, 8)}_rm_${roomId.substring(0, 8)}_${Date.now()}`;
        return mockToken;
    }
}

// 2. Agora RTC Provider
class AgoraRtcProvider extends RtcProvider {
    async createJoinToken(userId, roomId, role) {
        const appId = process.env.AGORA_APP_ID || 'f80faf42fd0845a9816658ea7e16a755';
        const appCertificate = process.env.AGORA_APP_CERTIFICATE || 'e3361c06460541418754881b12bc3247';
        
        const channelName = `room_${roomId}`;
        
        // Agora classical token parameters
        const uid = 0; // 0 allows any numeric UID
        const expirationTimeInSeconds = 3600; // 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // Map role: host/speaker -> PUBLISHER, listener -> SUBSCRIBER
        const agoraRole = (role === 'listener') ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

        try {
            const token = RtcTokenBuilder.buildTokenWithUid(
                appId,
                appCertificate,
                channelName,
                uid,
                agoraRole,
                privilegeExpiredTs
            );
            return token;
        } catch (err) {
            console.error('[AgoraTokenError]:', err.message);
            throw new Error('Agora token oluşturulamadı.');
        }
    }
}

// 3. LiveKit RTC Provider
class LiveKitRtcProvider extends RtcProvider {
    async createJoinToken(userId, roomId, role) {
        // Simple JWT/Token stub for LiveKit
        const livekitToken = `livekit_stub_token_${role}_usr_${userId.substring(0, 8)}_rm_${roomId.substring(0, 8)}`;
        return livekitToken;
    }
}

// Provider Factory based on environment variables
function getRtcProvider() {
    const providerName = (process.env.RTC_PROVIDER || 'mock').toLowerCase();

    switch (providerName) {
        case 'agora':
            return new AgoraRtcProvider();
        case 'livekit':
            return new LiveKitRtcProvider();
        case 'mock':
        default:
            return new MockRtcProvider();
    }
}

module.exports = {
    RtcProvider,
    MockRtcProvider,
    AgoraRtcProvider,
    LiveKitRtcProvider,
    getRtcProvider
};
