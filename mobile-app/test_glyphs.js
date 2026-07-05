try {
    const glyphMap = require('./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
    const icons = ['home', 'home-outline', 'compass', 'compass-outline', 'chatbubbles', 'chatbubbles-outline', 'person', 'person-outline'];
    for (const icon of icons) {
        const decimal = glyphMap[icon];
        if (decimal) {
            console.log(`${icon}: ${decimal} -> \\u${decimal.toString(16)} -> ${String.fromCharCode(decimal)}`);
        } else {
            console.log(`Icon ${icon} not found in glyphMap`);
        }
    }
    process.exit(0);
} catch (e) {
    console.error(e);
    process.exit(1);
}
