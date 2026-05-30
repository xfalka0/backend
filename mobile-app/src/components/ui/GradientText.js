import React from 'react';
import { Text } from 'react-native';

export default function GradientText({ colors, start, end, style, children, ...props }) {
    return (
        <Text style={[style, { color: '#ec4899' }]} {...props}>
            {children}
        </Text>
    );
}
