const fs = require('fs');

const path = 'd:/dating/backend/mobile-app/src/screens/ChatScreen.js';
let content = fs.readFileSync(path, 'utf8');

const marker = '{/* renderIcebreakers() is now handled by QuickActionsModal */}';
const idx = content.indexOf(marker);

if (idx !== -1) {
    const head = content.substring(0, idx + marker.length);
    const tail = `
                    <GlassCard intensity={40} tint="dark" style={styles.glassInputContainer}>
                        <View style={styles.inputRow}>
                              <Animated.View 
                                  {...(!isFamilyChat ? panResponder.panHandlers : {})}
                                  style={[styles.quickMsgToggle, { transform: [{ translateX: slideAnim }] }]} 
                              >
                                  <Ionicons 
                                      name={isFamilyChat ? "people" : (isCancelling ? "trash" : "mic")} 
                                      size={18} 
                                      color={isRecording ? (isCancelling ? "#ef4444" : "#ec4899") : "rgba(255,255,255,0.4)"} 
                                  />
                                  {isRecording && (
                                      <Animated.View style={[styles.recordingRipple, {
                                          transform: [{ scale: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                                          opacity: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] })
                                      }]} />
                                  )}
                              </Animated.View>
                             
                             <View style={styles.inputFlexContainer}>
                                 {isRecording ? (
                                     <View style={styles.recordingRow}>
                                         <View style={styles.recordingIndicator}>
                                             <Animated.View style={[styles.recordingDot, { opacity: blinkAnim }]} />
                                             <Text style={styles.recordTimerText}>{isCancelling ? 'İptal etmek için bırak' : recordTime}</Text>
                                         </View>
                                         {!isCancelling && (
                                             <View style={styles.waveformContainer}>
                                                 {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                                     <Animated.View 
                                                         key={i}
                                                         style={[
                                                             styles.waveBar,
                                                             {
                                                                 height: waveAnim.interpolate({
                                                                     inputRange: [0, 1],
                                                                     outputRange: [8, 12 + (i % 4) * 6]
                                                                 })
                                                             }
                                                         ]}
                                                     />
                                                 ))}
                                             </View>
                                         )}
                                         {!isCancelling && <Text style={styles.slideHintText}>Sağa kaydır ›</Text>}
                                     </View>
                                 ) : (
                                     <>
                                      <TextInput
                                          style={[styles.input, { color: theme.colors.text }]}
                                          value={input}
                                          onChangeText={handleTyping}
                                          placeholder="Mesaj yaz..."
                                          placeholderTextColor="rgba(255,255,255,0.4)"
                                          multiline
                                          maxHeight={100}
                                          cursorColor={theme.colors.primary}
                                      />
                                     </>
                                 )}
                             </View>

                             {!isRecording && (
                                 <TouchableOpacity onPress={sendMessage} style={styles.sendButton} activeOpacity={0.7}>
                                     <LinearGradient colors={theme.gradients.primary} style={styles.sendGradient}>
                                         <Ionicons name="send" size={20} color="white" />
                                     </LinearGradient>
                                 </TouchableOpacity>
                             )}
                        </View>

                        {/* Bottom Action Bar */}
                        {!isFamilyChat && <View style={styles.actionBar}>
                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => handleFakeCall('video')}>
                                <View style={styles.btnBlur}>
                                    <Ionicons name="videocam" size={22} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => handleFakeCall('voice')}>
                                <View style={styles.btnBlur}>
                                    <Ionicons name="call" size={22} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.giftIconContainer} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setShowGiftModal(true);
                            }}>
                                <Animated.View style={{
                                    transform: [{
                                        translateY: giftAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, -8]
                                        })
                                    }]
                                }}>
                                    <Image
                                        source={require('../assets/gift_icon.webp')}
                                        style={styles.giftLogoLarge}
                                        resizeMode="contain"
                                    />
                                </Animated.View>
                            </TouchableOpacity>
 
                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Keyboard.dismiss();
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowQuickActions(true);
                            }}>
                                <View style={[styles.btnBlur, showQuickActions && { backgroundColor: 'rgba(250, 204, 21, 0.2)', borderColor: 'rgba(250, 204, 21, 0.4)' }]}>
                                    <Ionicons name="flash" size={22} color={showQuickActions ? "#facc15" : "rgba(255,255,255,0.8)"} />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleSendLocation();
                            }}>
                                <View style={styles.btnBlur}>
                                    <Ionicons name="location" size={22} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modernActionBtn} onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                handleSendImage();
                            }}>
                                <View style={styles.btnBlur}>
                                    <Ionicons name="image" size={22} color="rgba(255,255,255,0.8)" />
                                </View>
                            </TouchableOpacity>
                        </View>}
                    </GlassCard>
                </View>
            </KeyboardAvoidingView>

            {/* OPTIONS MENU */}
            {
                showOptions && (
                    <View style={[styles.optionsMenu, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.glassBorder }]}>
                        <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptions(false); setShowReportModal(true); }}>
                            <Ionicons name="flag-outline" size={20} color={theme.colors.text} />
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>Şikayet Et</Text>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.optionItem} onPress={handleBlock}>
                            <Ionicons name="ban-outline" size={20} color="#ef4444" />
                            <Text style={[styles.optionText, { color: '#ef4444' }]}>Engelle</Text>
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* LIGHTBOX MODAL */}
            <ImageLightbox 
                visible={!!selectedImage}
                imageUri={resolveImageUrl(selectedImage)}
                onClose={() => setSelectedImage(null)}
            />

            {/* REPORT MODAL */}
            <ReportModal
                visible={showReportModal}
                onClose={() => setShowReportModal(false)}
                reporterId={user.id}
                reportedId={operatorId}
                onReportSubmitted={() => {
                    setShowReportModal(false);
                    navigation.goBack();
                }}
            />

            {/* GIFT MODAL */}
            <GiftPickerModal
                visible={showGiftModal}
                onClose={() => setShowGiftModal(false)}
                onSelectGift={handleSendGift}
                userBalance={currentBalance}
            />

            {/* GIFT ANIMATION OVERLAY */}
            <GiftOverlay
                gift={activeGift}
                receiver={{ avatar_url: resolveImageUrl(avatar_url), display_name: name, username: name }}
                onFinish={() => setActiveGift(null)}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F080A', // Fallback color
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    messagesList: {
        paddingHorizontal: 8,
        paddingTop: 10,
        paddingBottom: 90,
    },
    dateSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 34,
        paddingVertical: 14,
        gap: 10,
    },
    dateSeparatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.10)',
    },
    dateSeparatorText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    messageBubble: {
        maxWidth: '75%',
        marginBottom: 16,
        borderRadius: 24,
        overflow: 'hidden',
        ...SHADOWS.medium,
    },
    userBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    operatorBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
    },
    bubbleGradient: {
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    messageText: {
        fontSize: 13,
        lineHeight: 22,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    modernInputWrapper: {
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        backgroundColor: 'transparent',
    },
    glassInputContainer: {
        marginHorizontal: 12,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 8,
        fontSize: 15,
        minHeight: 44,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
    },
    sendGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionsMenu: {
        position: 'absolute',
        top: 60,
        right: 20,
        borderRadius: 16,
        borderWidth: 1,
        padding: 8,
        minWidth: 160,
        zIndex: 1000,
        ...SHADOWS.large,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 4,
    },
    quickMsgToggle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        position: 'relative'
    },
    recordingRipple: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 20,
        backgroundColor: '#ec4899',
    },
    inputFlexContainer: {
        flex: 1,
    },
    recordingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
        paddingRight: 10,
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },
    recordTimerText: {
        color: 'white',
        fontSize: 14,
        fontVariant: ['tabular-nums'],
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 24,
    },
    waveBar: {
        width: 3,
        backgroundColor: '#ec4899',
        borderRadius: 2,
    },
    slideHintText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginRight: 10,
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    modernActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
    },
    btnBlur: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 22,
    },
    giftIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    giftLogoLarge: {
        width: 55,
        height: 55,
        marginBottom: 8
    },
    voiceContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 180,
    },
    voicePlayButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ec4899',
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.small
    },
    voiceDurationText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    fakeCallModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fakeCallContent: {
        alignItems: 'center',
        padding: 40,
    },
    fakeCallAvatarContainer: {
        marginBottom: 30,
        alignItems: 'center',
    },
    fakeCallAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: '#22c55e',
    },
    fakeCallTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    fakeCallStatus: {
        color: '#22c55e',
        fontSize: 16,
        marginBottom: 40,
    },
    fakeCallActions: {
        flexDirection: 'row',
        gap: 40,
    },
    fakeCallEndBtn: {
        alignItems: 'center',
        gap: 10,
    },
    fakeCallEndIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.medium
    },
    fakeCallEndText: {
        color: 'white',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    imageLockCard: {
        width: '100%',
        maxWidth: 400,
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
    },
    imageLockTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    imageLockSub: {
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        fontSize: 13,
        marginBottom: 20,
    },
    imageLockPreview: {
        width: 140,
        height: 140,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 2,
        borderColor: 'rgba(236,72,153,0.3)',
    },
    pricingPillContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 24,
    },
    pricingPill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pricingPillActive: {
        backgroundColor: 'rgba(236,72,153,0.15)',
        borderColor: '#ec4899',
    },
    pricingPillText: {
        color: '#fff',
        fontWeight: '600',
    },
    pricingPillTextActive: {
        color: '#ec4899',
    },
    imageLockBtnRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    imageLockCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    imageLockCancelBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    imageLockSubmitBtn: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    imageLockSubmitGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    imageLockSubmitBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    agencyInviteCard: {
        position: 'absolute',
        top: 100, // Below header
        left: 20,
        right: 20,
        backgroundColor: 'rgba(15, 8, 10, 0.95)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ec4899',
        zIndex: 999,
        ...SHADOWS.large
    },
    agencyInviteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10
    },
    agencyInviteTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    agencyInviteText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        marginBottom: 16,
        lineHeight: 20
    },
    agencyInviteActions: {
        flexDirection: 'row',
        gap: 12
    },
    agencyInviteBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center'
    },
    agencyInviteBtnReject: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 1,
        borderColor: '#ef4444'
    },
    agencyInviteBtnAccept: {
        backgroundColor: '#ec4899',
    },
    agencyInviteBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    }
});
`
    fs.writeFileSync(path, head + tail);
}
