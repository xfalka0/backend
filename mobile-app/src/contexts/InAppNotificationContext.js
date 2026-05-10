import React, { createContext, useState, useContext, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import InAppNotification from '../components/ui/InAppNotification';

const InAppNotificationContext = createContext();

export const InAppNotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);
    const timeoutRef = useRef(null);

    const showNotification = useCallback(({ title, body, icon, data, onPress }) => {
        // Clear existing timeout if any
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setNotification({ title, body, icon, data, onPress });

        // Auto-hide after 5 seconds
        timeoutRef.current = setTimeout(() => {
            setNotification(null);
        }, 5000);
    }, []);

    const hideNotification = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setNotification(null);
    }, []);

    return (
        <InAppNotificationContext.Provider value={{ showNotification, hideNotification }}>
            {children}
            {notification && (
                <InAppNotification 
                    {...notification} 
                    onClose={hideNotification} 
                />
            )}
        </InAppNotificationContext.Provider>
    );
};

export const useInAppNotification = () => {
    const context = useContext(InAppNotificationContext);
    if (!context) {
        throw new Error('useInAppNotification must be used within an InAppNotificationProvider');
    }
    return context;
};
