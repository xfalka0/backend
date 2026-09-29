export const STORE_THEME = {
    colors: {
        backgroundGradient: ['#1A050B', '#0A0305'],
        primaryGradient: ['#FF3D6E', '#C2185B'],
        accentGold: '#FFC53D',
        goldGlow: 'rgba(255, 197, 61, 0.25)',
        surfaceDark: 'rgba(255, 255, 255, 0.05)',
        surfaceDarkBorder: 'rgba(255, 255, 255, 0.1)',
        surfaceSelectedBg: 'rgba(255, 197, 61, 0.06)',
        textWhite: '#FFFFFF',
        textMuted: '#C5B3B8',
        textGray: '#8E7C82',
        cardBorderMuted: 'rgba(255, 255, 255, 0.08)',
    },
    typography: {
        titleLarge: {
            fontSize: 28,
            fontWeight: 'bold',
            color: '#FFFFFF',
            letterSpacing: -0.5,
        },
        titleMedium: {
            fontSize: 20,
            fontWeight: 'bold',
            color: '#FFFFFF',
        },
        bodyText: {
            fontSize: 15,
            fontWeight: 'normal',
            color: '#C5B3B8',
        },
        priceText: {
            fontSize: 20,
            fontWeight: 'bold',
            color: '#FFC53D',
        },
        subtextSmall: {
            fontSize: 12,
            color: '#8E7C82',
        },
    },
    spacing: {
        paddingHorizontal: 20,
        cardGap: 12,
        borderRadius: 18,
    },
    shadows: {
        goldCardGlow: {
            shadowColor: '#FFC53D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 8,
        },
        buttonShadow: {
            shadowColor: '#FF3D6E',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 10,
        },
    },
    animations: {
        particleCount: 8,
        particleMinDuration: 6000,
        particleMaxDuration: 10000,
        buttonPulseScaleMax: 1.03,
        buttonPulseScaleMin: 0.97,
        buttonPulseDuration: 1600,
        cardSelectionDuration: 250,
        cardScaleMax: 1.02,
        staggerDelay: 60,
    },
};
