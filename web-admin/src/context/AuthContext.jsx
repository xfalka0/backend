import { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // URL Configuration - Always use Production Backend (Render)
    const API_URL = '';

    useEffect(() => {
        const verifyToken = async () => {
            if (token) {
                try {
                    const res = await fetch(`${API_URL}/api/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!res.ok) {
                        throw new Error('Token expired or invalid');
                    }

                    const userData = await res.json();
                    setUser(userData); // Update user data with fresh info
                    localStorage.setItem('user', JSON.stringify(userData));
                } catch (err) {
                    console.error("Token verification failed (FIXED):", err);
                    logout();
                }
            }
            setLoading(false);
        };

        verifyToken();
    }, [token]);

    const login = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                let errorMsg = 'Giriş başarısız.';
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch {
                    if (response.status === 504 || response.status === 502 || response.status === 500) {
                        errorMsg = 'Backend sunucusuna bağlanılamadı (Port 5000 kapalı). Lütfen backend sunucusunu başlatın.';
                    }
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            setToken(data.token);
            setUser(data.user);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            return { success: true };
        } catch (error) {
            console.error("Login Fail:", error);
            const userFriendlyMsg = error.message.includes('fetch') 
                ? 'Backend sunucusuna bağlanılamadı (Port 5000 kapalı). Lütfen backend sunucusunu başlatın.'
                : error.message;
            return { success: false, error: userFriendlyMsg };
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
