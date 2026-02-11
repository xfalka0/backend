export const DARK_THEME = {
    mode: 'dark',
    colors: {
        background: '#030712', // Near Black from HomeScreen Gradient
        surface: '#0f172a',    // Deep Slate from HomeScreen Gradient
        card: '#111827',       // Slate 900
        text: '#ffffff',
        textSecondary: '#94a3b8', // Slate 400
        primary: '#8b5cf6',       // Violet 500
        secondary: '#d946ef',    // Fuchsia 500
        accent: '#f59e0b',        // Amber 500 - Gold Accent
        success: '#10b981',
        danger: '#f43f5e',
        glass: 'rgba(255, 255, 255, 0.05)',
        glassBorder: 'rgba(255, 255, 255, 0.1)',
        inputBg: 'rgba(24, 24, 27, 0.6)',
        border: 'rgba(255, 255, 255, 0.1)',
        backgroundSecondary: '#0f172a',
    },
    gradients: {
        primary: ['#7c3aed', '#db2777'],
        dark: ['#18181b', '#09090b'],
        vip: ['#f59e0b', '#d97706'],
        glass: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)'],
    }
};

export const LIGHT_THEME = {
    mode: 'light',
    colors: {
        background: '#f8fafc', // Slate 50
        surface: '#ffffff',    // Plain white
        card: '#ffffff',       // Plain white
        text: '#0f172a',       // Slate 900
        textSecondary: '#64748b', // Slate 400
        primary: '#8b5cf6',       // Violet 500
        secondary: '#d946ef',    // Fuchsia 500
        accent: '#f59e0b',        // Amber 500
        success: '#10b981',
        danger: '#f43f5e',
        glass: 'rgba(0, 0, 0, 0.05)',
        glassBorder: 'rgba(0, 0, 0, 0.1)',
        inputBg: 'rgba(241, 245, 249, 0.8)',
        border: 'rgba(0, 0, 0, 0.05)',
        backgroundSecondary: '#f1f5f9',
    },
    gradients: {
        primary: ['#8b5cf6', '#d946ef'],
        dark: ['#f8fafc', '#f1f5f9'],
        vip: ['#fbbf24', '#f59e0b'],
        glass: ['rgba(255,255,255,1)', 'rgba(255,255,255,0.95)'],
    }
};

// Legacy support (to avoid immediate crashes)
export const COLORS = DARK_THEME.colors;
export const GRADIENTS = DARK_THEME.gradients;

export const SHADOWS = {
    medium: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    glow: {
        shadowColor: "#8b5cf6",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    }
};
