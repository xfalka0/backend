import { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // URL Configuration - Always use Production Backend (Render)
    const API_URL = 'https://backend-kj17.onrender.com';

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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Giriş başarısız.');
            }

            setToken(data.token);
            setUser(data.user);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            return { success: true };
        } catch (error) {
            console.error("Login Fail:", error);
            return { success: false, error: error.message };
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
