import React, { createContext, useState, useContext, useCallback } from 'react';
import ModernAlert from '../components/ui/ModernAlert';

const AlertContext = createContext();

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

export const AlertProvider = ({ children }) => {
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        showCancel: false,
        cancelText: 'İPTAL',
        confirmText: 'TAMAM',
        onConfirm: null,
        onCancel: null,
    });

    const showAlert = useCallback((config) => {
        setAlertConfig({
            visible: true,
            title: config.title || 'Uyarı',
            message: config.message || '',
            type: config.type || 'info',
            showCancel: config.showCancel || false,
            cancelText: config.cancelText || 'İPTAL',
            confirmText: config.confirmText || 'TAMAM',
            onConfirm: config.onConfirm || null,
            onCancel: config.onCancel || null,
        });
    }, []);

    const hideAlert = useCallback(() => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            <ModernAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                showCancel={alertConfig.showCancel}
                cancelText={alertConfig.cancelText}
                confirmText={alertConfig.confirmText}
                onConfirm={alertConfig.onConfirm}
                onCancel={alertConfig.onCancel}
                onClose={hideAlert}
            />
        </AlertContext.Provider>
    );
};
