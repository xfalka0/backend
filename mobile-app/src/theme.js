export const DARK_THEME = {
    mode: 'dark',
    colors: {
        background: '#0F080A',     // Blackened ember background
        surface: '#1B0C11',        // Deep wine surface
        card: '#281017',           // Dark warm card
        text: '#ffffff',
        textSecondary: '#C7A6A6',    // Warm muted text
        primary: '#E83E50',          // Deep coral red
        secondary: '#B5123E',        // Dark dating crimson
        accent: '#FFB020',           // Warm gold
        success: '#10B981',
        danger: '#F43F5E',
        glass: 'rgba(255, 255, 255, 0.06)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        inputBg: 'rgba(40, 16, 23, 0.82)',
        border: 'rgba(255, 255, 255, 0.1)',
        backgroundSecondary: '#160A0F',
    },
    gradients: {
        primary: ['#E83E50', '#991B4D'],
        dark: ['#0F080A', '#29101A'],
        vip: ['#F59E0B', '#D97706'],
        glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'],
        card: ['#281017', '#1B0C11'],
    }
};

export const LIGHT_THEME = {
    mode: 'light',
    colors: {
        background: '#F8FAFC',
        surface: '#FFFFFF',
        card: '#FFFFFF',
        text: '#0F172A',
        textSecondary: '#64748B',
        primary: '#8B5CF6',
        secondary: '#D946EF',
        accent: '#F59E0B',
        success: '#10B981',
        danger: '#F43F5E',
        glass: 'rgba(0, 0, 0, 0.03)',
        glassBorder: 'rgba(0, 0, 0, 0.08)',
        inputBg: 'rgba(241, 245, 249, 0.8)',
        border: 'rgba(0, 0, 0, 0.05)',
        backgroundSecondary: '#F1F5F9',
    },
    gradients: {
        primary: ['#8B5CF6', '#D946EF'],
        dark: ['#F8FAFC', '#F1F5F9'],
        vip: ['#FBBF24', '#F59E0B'],
        glass: ['rgba(255,255,255,1)', 'rgba(255,255,255,0.9)'],
        card: ['#FFFFFF', '#F8FAFC'],
    }
};

// Legacy support (to avoid immediate crashes)
export const COLORS = DARK_THEME.colors;
export const GRADIENTS = DARK_THEME.gradients;

export const SHADOWS = {
    medium: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    glow: {
        shadowColor: "#D92F4F",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 15,
        elevation: 12,
    },
    goldGlow: {
        shadowColor: "#FBBF24",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 15,
    }
};
