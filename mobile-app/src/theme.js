export const DARK_THEME = {
    mode: 'dark',
    colors: {
        background: '#05050A',     // Very Deep Purple/Black
        surface: '#110C24',        // Deep Plum Surface
        card: '#1A1435',           // Lighter Plum Card
        text: '#ffffff',
        textSecondary: '#A79FC4',    // Soft Muted Purple
        primary: '#A855F7',          // Vibrant Purple
        secondary: '#EC4899',        // Vibrant Pink
        accent: '#FBBF24',           // Premium Gold
        success: '#10B981',
        danger: '#F43F5E',
        glass: 'rgba(255, 255, 255, 0.04)',
        glassBorder: 'rgba(255, 255, 255, 0.08)',
        inputBg: 'rgba(26, 20, 53, 0.6)',
        border: 'rgba(255, 255, 255, 0.08)',
        backgroundSecondary: '#0B081A',
    },
    gradients: {
        primary: ['#9333EA', '#DB2777'],
        dark: ['#120924', '#05050A'],
        vip: ['#F59E0B', '#D97706'],
        glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)'],
        card: ['#1A1435', '#130E26'],
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
        shadowColor: "#A855F7",
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
