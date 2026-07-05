import React from 'react';
import { Text } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

export default function GradientText({ colors = ['#a855f7', '#ec4899'], start = { x: 0, y: 0 }, end = { x: 1, y: 0 }, style, children, ...props }) {
    return (
        <MaskedView
            maskElement={
                <Text style={style} {...props}>
                    {children}
                </Text>
            }
        >
            <LinearGradient
                colors={colors}
                start={start}
                end={end}
            >
                <Text style={[style, { opacity: 0 }]} {...props}>
                    {children}
                </Text>
            </LinearGradient>
        </MaskedView>
    );
}
