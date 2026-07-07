import React from 'react';
import { Image } from 'react-native';

const VIP_IMAGES = {
    1: require('../../../assets/vip1.png'),
    2: require('../../../assets/vip2.png'),
    3: require('../../../assets/vip3.png'),
    4: require('../../../assets/vip4.png'),
    5: require('../../../assets/vip5.png'),
    6: require('../../../assets/vip6.png'),
};

export default function VipBadge({ level, style, size = 50 }) {
    if (!level || level < 1 || level > 6) return null;

    const scale = size / 60;
    const computedStyle = {
        width: size,
        height: size,
        resizeMode: 'stretch',
        marginLeft: -4 * scale,
        marginRight: -4 * scale,
        marginTop: -18 * scale,
        marginBottom: -18 * scale,
    };

    return (
        <Image
            source={VIP_IMAGES[level]}
            style={[computedStyle, style]}
        />
    );
}
