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
        const uStr = String(userId);
        const rStr = String(roomId);
        const mockToken = `mock_token_${role}_usr_${uStr.substring(0, 8)}_rm_${rStr.substring(0, 8)}_${Date.now()}`;
        return mockToken;
    }
}

// 2. Agora RTC Provider
class AgoraRtcProvider extends RtcProvider {
    async createJoinToken(userId, roomId, role) {
        const appId = process.env.AGORA_APP_ID || 'f80faf42fd0845a9816658ea7e16a755';
        const appCertificate = process.env.AGORA_APP_CERTIFICATE || 'e3361c06460541418754881b12bc3247';
        
        const channelName = String(roomId).startsWith('room_') ? String(roomId) : `room_${roomId}`;
        
        const expirationTimeInSeconds = 3600; // 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // Map role parameter to Agora RtcRole
        const isSubscriber = (role || '').toLowerCase() === 'subscriber' || (role || '').toLowerCase() === 'listener';
        const agoraRole = isSubscriber ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

        try {
            const userStr = String(userId);
            const numUid = Number(userId);

            if (!isNaN(numUid) && numUid > 0) {
                return RtcTokenBuilder.buildTokenWithUid(
                    appId,
                    appCertificate,
                    channelName,
                    numUid,
                    agoraRole,
                    privilegeExpiredTs
                );
            } else if (userStr && userStr.trim() !== '') {
                // Support string user account/UUID
                return RtcTokenBuilder.buildTokenWithAccount(
                    appId,
                    appCertificate,
                    channelName,
                    userStr,
                    agoraRole,
                    privilegeExpiredTs
                );
            } else {
                // Fallback to wildcard 0
                return RtcTokenBuilder.buildTokenWithUid(
                    appId,
                    appCertificate,
                    channelName,
                    0,
                    agoraRole,
                    privilegeExpiredTs
                );
            }
        } catch (err) {
            console.error('[AgoraTokenError]:', err.message);
            throw new Error('Agora token oluşturulamadı: ' + err.message);
        }
    }
}

// 3. LiveKit RTC Provider
class LiveKitRtcProvider extends RtcProvider {
    async createJoinToken(userId, roomId, role) {
        const uStr = String(userId);
        const rStr = String(roomId);
        // Simple JWT/Token stub for LiveKit
        const livekitToken = `livekit_stub_token_${role}_usr_${uStr.substring(0, 8)}_rm_${rStr.substring(0, 8)}`;
        return livekitToken;
    }
}

// Provider Factory based on environment variables
function getRtcProvider() {
    let providerName = (process.env.RTC_PROVIDER || 'agora').toLowerCase();

    switch (providerName) {
        case 'livekit':
            return new LiveKitRtcProvider();
        case 'mock':
            return new MockRtcProvider();
        case 'agora':
        default:
            return new AgoraRtcProvider();
    }
}

// Agora Audio Profile Optimization Config (32kbps Bandwidth Standard)
const AGORA_AUDIO_CONFIG = {
    audioProfile: 2, // AUDIO_PROFILE_MUSIC_STANDARD (32kbps, 44.1 kHz, mono)
    audioScenario: 3, // AUDIO_SCENARIO_GAME_STREAMING (Low latency)
    bitrate: 32000
};

module.exports = {
    RtcProvider,
    MockRtcProvider,
    AgoraRtcProvider,
    LiveKitRtcProvider,
    getRtcProvider,
    AGORA_AUDIO_CONFIG
};
