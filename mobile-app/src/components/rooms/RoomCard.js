import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RoomCardEqualizer from './RoomCardEqualizer';
import { resolveImageUrl } from '../../utils/imageUtils';

const DEFAULT_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
];

// ─── Sub-Component: RoomAvatar ───────────────────────────────────────────
function RoomAvatar({ hostAvatar, imageError, setImageError, initials, pulseAnim }) {
    return (
        <View style={styles.cardBgImageContainer}>
            {/* Underlay Initials Gradient: Displays if image fails to load */}
            <LinearGradient
                colors={['#7B2CFF', '#FF2F8B']}
                style={styles.avatarPlaceholder}
            >
                <Text style={styles.avatarInitials}>{initials}</Text>
            </LinearGradient>

            {hostAvatar && !imageError && (
                <Image
                    source={{ uri: resolveImageUrl(hostAvatar) }}
                    style={styles.cardBgImage}
                    onError={() => setImageError(true)}
                />
            )}
            
            {/* Seamless Horizontal Fade-out Transition */}
            <LinearGradient
                colors={[
                    'rgba(20, 13, 38, 0)',
                    'rgba(20, 13, 38, 0.35)',
                    'rgba(20, 13, 38, 0.85)',
                    '#140D26'
                ]}
                locations={[0, 0.4, 0.8, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cardBgGradient}
            />

            {/* LIVE Badge */}
            <View style={styles.hotBadge}>
                <Text style={styles.hotText}>LIVE</Text>
            </View>

            {/* Online indicator */}
            <View style={styles.onlineDot} />
        </View>
    );
}



// ─── Sub-Component: RoomBadges ───────────────────────────────────────────
function RoomBadges({ country, level, category }) {
    // Dynamically choose icon based on category name
    const getCategoryIcon = (cat) => {
        const lower = (cat || '').toLowerCase();
        if (lower.includes('sohbet') || lower.includes('chat')) return 'chatbubbles-outline';
        if (lower.includes('flört') || lower.includes('dating') || lower.includes('aşk')) return 'heart-outline';
        if (lower.includes('parti') || lower.includes('party') || lower.includes('eğlence')) return 'sparkles-outline';
        return 'radio-outline';
    };

    return (
        <View style={styles.chipsRow}>
            {/* Country & Level badge */}
            <View style={styles.flagAndLevelChip}>
                <Ionicons name="globe-outline" size={9} color="#00D5FF" />
                <Text style={styles.badgeText}>{country} <Text style={styles.levelHighlight}>Lv.{level}</Text></Text>
            </View>

            {/* Category badge */}
            <View style={[styles.chip, styles.categoryChip]}>
                <Ionicons name={getCategoryIcon(category)} size={9} color="#FF4D8D" />
                <Text style={[styles.badgeText, styles.categoryChipText]}>{category}</Text>
            </View>

            {/* Voice tag badge */}
            <View style={[styles.chip, styles.tagChip]}>
                <Ionicons name="mic-outline" size={9} color="rgba(255,255,255,0.5)" />
                <Text style={[styles.badgeText, styles.tagChipText]}>Sesli</Text>
            </View>
        </View>
    );
}

// ─── Sub-Component: RoomStats ────────────────────────────────────────────
function RoomStats({ onlineCount, speakerCount, maxSpeakers, diamondCount }) {
    return (
        <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <Ionicons name="people-outline" size={11} color="rgba(255, 255, 255, 0.45)" />
                <Text style={styles.statText}>{onlineCount}</Text>
            </View>
            <View style={styles.statItem}>
                <Ionicons name="mic-outline" size={11} color="#00D5FF" />
                <Text style={styles.statText}>{speakerCount}/{maxSpeakers}</Text>
            </View>
            <View style={styles.statItem}>
                <Ionicons name="sparkles-outline" size={11} color="#FF9B3D" />
                <Text style={[styles.statText, { color: '#FF9B3D' }]}>{diamondCount}</Text>
            </View>
        </View>
    );
}

// ─── Sub-Component: JoinRoomButton ───────────────────────────────────────
function JoinRoomButton({ level, onPress }) {
    return (
        <View style={styles.actionSection}>
            {/* VIP Badge */}
            <LinearGradient
                colors={['#FF9B3D', '#FF4D8D']}
                style={styles.premiumBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Text style={styles.premiumBadgeText}>VIP {level + 1}</Text>
            </LinearGradient>

            {/* Action Button */}
            <TouchableOpacity 
                style={styles.joinBtn} 
                onPress={onPress}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#FF4D8D', '#FF9B3D']}
                    style={styles.joinGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <Text style={styles.joinBtnText}>Katıl</Text>
                    <Ionicons name="chevron-forward" size={10} color="#FFF" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Decorative Equalizer */}
            <View style={styles.equalizer}>
                <RoomCardEqualizer />
            </View>
        </View>
    );
}

// ─── Main Component: PartyRoomCard (Default Export) ──────────────────────
export default function PartyRoomCard({ room, onPress }) {
    const title = room.title || 'Sohbet Odası';
    const level = room.room_level || 1;
    const category = room.category || 'Parti';
    const country = room.country || 'TR';
    const hostName = room.host_name || room.username || 'Host';
    const agencyName = room.agency_name || 'Star Agency';
    
    // Stats calculation
    const onlineCount = room.onlineCount || room.participants?.length || 12;
    const speakerCount = room.active_speakers || 3;
    const maxSpeakers = room.max_speakers || 8;
    const diamondCount = room.diamond_count || '1.8K';

    // Fallback avatar
    const defaultIndex = Math.abs(hostName.charCodeAt(0) % DEFAULT_AVATARS.length);
    
    const getCleanAvatar = (url) => {
        if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
            return null;
        }
        return url;
    };
    
    const rawAvatar = getCleanAvatar(room.background_url) || getCleanAvatar(room.host_avatar) || getCleanAvatar(room.avatar_url);
    const hostAvatar = rawAvatar || DEFAULT_AVATARS[defaultIndex];
    const [imageError, setImageError] = useState(false);
    const initials = hostName.charAt(0).toUpperCase();

    // Pulse animation
    const pulseAnim = useRef(new Animated.Value(1)).current;
    
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                })
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    return (
        <TouchableOpacity
            activeOpacity={0.92}
            onPress={onPress}
            style={styles.cardWrapper}
        >
            <LinearGradient
                colors={['#140D26', '#1F112E']} // Deep navy to rich plum gradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardBody}
            >
                {/* Visual Cover Avatar */}
                {/* Visual Cover Avatar */}
                <RoomAvatar
                    hostAvatar={hostAvatar}
                    imageError={imageError}
                    setImageError={setImageError}
                    initials={initials}
                    pulseAnim={pulseAnim}
                />

                {/* Isolated Room Title at the very top */}
                <Text style={styles.absoluteRoomTitle} numberOfLines={1}>
                    {title}
                </Text>

                {/* Middle details column (shifted down) */}
                <View style={styles.infoSection}>
                    <Text style={styles.hostSubText} numberOfLines={1}>
                        @{hostName}
                    </Text>
                    <RoomBadges 
                        country={country} 
                        level={level} 
                        category={category} 
                    />
                    <RoomStats 
                        onlineCount={onlineCount} 
                        speakerCount={speakerCount} 
                        maxSpeakers={maxSpeakers} 
                        diamondCount={diamondCount} 
                    />
                </View>

                {/* Right actions section */}
                <JoinRoomButton 
                    level={level} 
                    onPress={onPress} 
                />
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    cardBody: {
        flexDirection: 'row',
        paddingLeft: 18,
        paddingRight: 14,
        height: 148,
        alignItems: 'center',
    },
    cardBgImageContainer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 160,
        borderTopLeftRadius: 23,
        borderBottomLeftRadius: 23,
        overflow: 'hidden',
    },
    cardBgImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    cardBgGradient: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        right: 0,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
    },
    hotBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: '#FF4D8D',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        zIndex: 5,
    },
    hotText: {
        color: '#FFFFFF',
        fontSize: 7.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    onlineDot: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#00D5FF',
        borderWidth: 1.5,
        borderColor: '#140D26',
        zIndex: 5,
    },
    absoluteRoomTitle: {
        position: 'absolute',
        top: 10,
        left: 175,
        right: 90,
        color: '#F8F8FC',
        fontSize: 19.5,
        fontWeight: '700',
        letterSpacing: -0.2,
        zIndex: 10,
    },
    infoSection: {
        flex: 1,
        height: '100%',
        justifyContent: 'flex-start',
        paddingTop: 46, // Symmetrical vertical centering for the content block
        paddingLeft: 158,
        gap: 5,
    },
    hostSubText: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 11.5,
        fontWeight: '500',
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
        alignItems: 'center',
    },
    flagAndLevelChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 7,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        gap: 3.5,
    },
    badgeText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 9,
        fontWeight: '600',
    },
    levelHighlight: {
        color: '#00D5FF',
        fontWeight: '700',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 7,
        borderWidth: 0.5,
        gap: 3.5,
    },
    categoryChip: {
        backgroundColor: 'rgba(255, 77, 141, 0.06)',
        borderColor: 'rgba(255, 77, 141, 0.15)',
    },
    categoryChipText: {
        color: '#FF4D8D',
    },
    tagChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    tagChipText: {
        color: 'rgba(255, 255, 255, 0.5)',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 11,
        fontWeight: '600',
    },
    actionSection: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        paddingLeft: 4,
    },
    premiumBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 6,
    },
    premiumBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: '900',
    },
    joinBtn: {
        width: 62,
        height: 28,
        borderRadius: 14,
        overflow: 'hidden',
    },
    joinGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    joinBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
    },
    equalizer: {
        position: 'absolute',
        bottom: 12,
        right: 14,
        height: 18,
        justifyContent: 'center',
    },
});
