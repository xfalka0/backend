import React from 'react';
import VideoCallScreenComponent from '../components/animated/VideoCallScreen';

export default function VideoCallScreen({ route, navigation }) {
    const { name, avatar_url } = route.params || {};

    const handleAccept = () => {
        // Handle accepting call
        console.log('Call accepted');
    };

    const handleDecline = () => {
        navigation.goBack();
    };

    return (
        <VideoCallScreenComponent
            callerName={name || 'Biri'}
            callerImage={avatar_url || 'https://via.placeholder.com/150'}
            onAccept={handleAccept}
            onDecline={handleDecline}
        />
    );
}

