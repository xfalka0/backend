const fs = require('fs');
let code = fs.readFileSync('backend/mobile-app/src/screens/AuthScreen.js', 'utf8');

// 1. Add Linking import
if (!code.includes('Linking,')) {
    code = code.replace("ActivityIndicator,", "ActivityIndicator,\n    Linking,");
}

// 2. Add placeholder constants before AuthScreen export
const placeholderCode = `// =========================================================================
// YASAL VE POLİTİKA BAĞLANTI ADRESLERİ (YER TUTUCULAR - DÜZENLENEBİLİR)
// Dosya: backend/mobile-app/src/screens/AuthScreen.js
// =========================================================================
export const TERMS_OF_SERVICE_URL = 'https://fivachat.com/terms'; // [YER TUTUCU: Kullanım Koşulları URL'si]
export const PRIVACY_POLICY_URL = 'https://fivachat.com/privacy'; // [YER TUTUCU: Gizlilik Politikası URL'si]
export const KVKK_CONSENT_URL = 'https://fivachat.com/kvkk'; // [YER TUTUCU: Açık Rıza / KVKK Metni URL'si]
// =========================================================================\n\n`;

if (!code.includes('TERMS_OF_SERVICE_URL')) {
    code = code.replace("export default function AuthScreen({ navigation, route }) {", placeholderCode + "export default function AuthScreen({ navigation, route }) {");
}

// 3. Add consent state and helper inside AuthScreen component
const stateHook = `    const [consentChecked, setConsentChecked] = useState(false);

    const handleActionWithConsent = (action) => {
        if (!consentChecked) {
            setAlert({
                visible: true,
                title: 'Onay Zorunludur ⚠️',
                message: 'Devam edebilmek için lütfen Kullanım Şartları ve Gizlilik Politikasını okuyup onay kutusunu işaretleyiniz.',
                type: 'warning'
            });
            return;
        }
        action();
    };`;

if (!code.includes('consentChecked')) {
    code = code.replace("const [isRegisterMode, setIsRegisterMode] = useState(false);", "const [isRegisterMode, setIsRegisterMode] = useState(false);\n" + stateHook);
}

// 4. Update WelcomeButtons to require consent
const oldButtons = `<WelcomeButton
                title="Telefon ile devam et"
                icon="call-outline"
                onPress={() => { setAuthMethod('phone'); setStep(1); }}
            />
            <WelcomeButton
                title="Google ile devam et"
                icon="logo-google"
                onPress={handleGoogleLogin}
            />
            <WelcomeButton
                title="E-posta ile devam et"
                icon="mail-outline"
                variant="gradient"
                onPress={() => { setAuthMethod('email'); setStep(1); }}
            />`;

const newButtons = `<WelcomeButton
                title="Telefon ile devam et"
                icon="call-outline"
                onPress={() => handleActionWithConsent(() => { setAuthMethod('phone'); setStep(1); })}
            />
            <WelcomeButton
                title="Google ile devam et"
                icon="logo-google"
                onPress={() => handleActionWithConsent(handleGoogleLogin)}
            />
            <WelcomeButton
                title="E-posta ile devam et"
                icon="mail-outline"
                variant="gradient"
                onPress={() => handleActionWithConsent(() => { setAuthMethod('email'); setStep(1); })}
            />

            {/* Açık Rıza ve Yasal Onay Kutusu */}
            <View style={styles.legalConsentContainer}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.checkboxTouchable}
                    onPress={() => setConsentChecked(prev => !prev)}
                >
                    <View style={[styles.checkboxBox, consentChecked && styles.checkboxBoxChecked]}>
                        {consentChecked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                </TouchableOpacity>

                <View style={styles.legalTextWrapper}>
                    <Text style={styles.legalText}>
                        Kaydolarak{' '}
                        <Text
                            style={styles.legalLink}
                            onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL).catch(() => navigation.navigate('Legal', { type: 'terms' }))}
                        >
                            Kullanım Şartları
                        </Text>
                        'nı ve{' '}
                        <Text
                            style={styles.legalLink}
                            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => navigation.navigate('Legal', { type: 'privacy' }))}
                        >
                            Gizlilik Politikası
                        </Text>
                        'nı okuduğumu ve kabul ettiğimi beyan ederim.
                    </Text>
                </View>
            </View>`;

if (code.includes(oldButtons)) {
    code = code.replace(oldButtons, newButtons);
}

// 5. Add styles at the bottom of StyleSheet
const newStyles = `    legalConsentContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 18,
        paddingHorizontal: 8,
        gap: 10,
    },
    checkboxTouchable: {
        paddingTop: 2,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxBoxChecked: {
        backgroundColor: '#a855f7',
        borderColor: '#ec4899',
    },
    legalTextWrapper: {
        flex: 1,
    },
    legalText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        lineHeight: 18,
    },
    legalLink: {
        color: '#ec4899',
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
});`;

if (!code.includes('legalConsentContainer')) {
    code = code.replace(/\}\);\s*$/, newStyles);
}

fs.writeFileSync('backend/mobile-app/src/screens/AuthScreen.js', code, 'utf8');
console.log('Successfully updated backend/mobile-app/src/screens/AuthScreen.js');
