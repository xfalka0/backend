export const DARK_THEME = {
    mode: 'dark',
    colors: {
        background: '#0E0926',     // Rich Deep Midnight Violet
        surface: '#1B113B',        // Elegant Deep Violet Surface
        card: '#271C52',           // Premium Lighter Violet Card
        text: '#ffffff',
        textSecondary: '#BBB3DC',    // Soft Lavender Muted Text
        primary: '#A855F7',          // Vibrant Purple
        secondary: '#EC4899',        // Vibrant Pink
        accent: '#FBBF24',           // Premium Gold
        success: '#10B981',
        danger: '#F43F5E',
        glass: 'rgba(255, 255, 255, 0.05)',
        glassBorder: 'rgba(255, 255, 255, 0.12)',
        inputBg: 'rgba(39, 28, 82, 0.6)',
        border: 'rgba(255, 255, 255, 0.1)',
        backgroundSecondary: '#150D32',
    },
    gradients: {
        primary: ['#A855F7', '#EC4899'],
        dark: ['#241554', '#0E0926'], // Gorgeous glowing violet to midnight obsidian
        vip: ['#F59E0B', '#D97706'],
        glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)'],
        card: ['#271C52', '#1B113B'],
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
