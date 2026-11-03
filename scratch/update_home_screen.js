const fs = require('fs');
let code = fs.readFileSync('backend/mobile-app/src/screens/HomeScreen.js', 'utf8');

// 1. Add import for DISCOVERY_TABS
if (!code.includes('DISCOVERY_TABS')) {
    code = "import { DISCOVERY_TABS, DEFAULT_TAB } from '../constants/tabs';\n" + code;
}

// 2. Change initial state of activeTab
code = code.replace(
    "const [activeTab, setActiveTab] = useState('Önerilen');",
    "const [activeTab, setActiveTab] = useState(DEFAULT_TAB);"
);

// 3. Update fetchOperators with limit=20, serverHasMore and detailed logging
const oldFetchCall = `            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(\`\${API_URL}/discovery?tab=\${requestedTab}&page=\${pageNum}&limit=50&gender=\${currentFilters.gender}\`, {
                headers: token ? { Authorization: \`Bearer \${token}\` } : {},
                signal: abortControllerRef.current.signal
            });
            
            clearTimeout(timeoutId);
            
            if (currentRequestId !== requestIdRef.current) return;

            const data = res.data?.data || res.data || [];
            console.log('[DEBUG FETCH OPERATORS] Loaded length:', data.length);
            
            if (pageNum === 1) {
                setOperators(data);
                const featured = data.filter(op => op.is_boosted || op.vip_level > 0).slice(0, 15);
                setFeaturedOperators(featured);
                setPage(1);
                setHasMore(data.length >= 50);
            } else {
                if (data.length > 0) {
                    setOperators(prev => {
                        const existingIds = new Set(prev.map(item => item.id));
                        const uniqueNewData = data.filter(item => !existingIds.has(item.id));
                        return [...prev, ...uniqueNewData];
                    });
                    setPage(pageNum);
                    setHasMore(data.length >= 50);
                } else {
                    setHasMore(false);
                }
            }`;

const newFetchCall = `            console.log(\`[DISCOVERY_FETCH_START] RequestId: \${currentRequestId} | Tab: \${requestedTab} | Page: \${pageNum} | Limit: 20\`);
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(\`\${API_URL}/discovery?tab=\${requestedTab}&page=\${pageNum}&limit=20\`, {
                headers: token ? { Authorization: \`Bearer \${token}\` } : {},
                signal: abortControllerRef.current.signal
            });
            
            clearTimeout(timeoutId);
            
            if (currentRequestId !== requestIdRef.current) {
                console.log(\`[DISCOVERY_FETCH_CANCEL] RequestId: \${currentRequestId} superseded by \${requestIdRef.current}\`);
                return;
            }

            const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            const serverHasMore = res.data?.hasMore !== undefined ? res.data.hasMore : (data.length >= 20);
            console.log(\`[DISCOVERY_FETCH_FINISH] RequestId: \${currentRequestId} | Tab: \${requestedTab} | Raw Loaded: \${data.length} | HasMore: \${serverHasMore} | Page: \${pageNum}\`);
            
            if (pageNum === 1) {
                setOperators(data);
                const featured = data.filter(op => op.is_boosted || op.vip_level > 0).slice(0, 15);
                setFeaturedOperators(featured);
                setPage(1);
                setHasMore(serverHasMore);
            } else {
                if (data.length > 0) {
                    setOperators(prev => {
                        const existingIds = new Set(prev.map(item => item.id));
                        const uniqueNewData = data.filter(item => !existingIds.has(item.id));
                        return [...prev, ...uniqueNewData];
                    });
                    setPage(pageNum);
                    setHasMore(serverHasMore);
                } else {
                    setHasMore(false);
                }
            }`;

if (code.includes(oldFetchCall)) {
    code = code.replace(oldFetchCall, newFetchCall);
}

// 4. Update handleLoadMore
code = code.replace(
    "fetchOperators(page + 1);",
    "fetchOperators(page + 1, false, activeTab);"
);

// 5. Update tabs rendering
const oldTabsRender = `<View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {['Önerilen', 'Çevrimiçi', 'Yeni', 'Popüler'].map(tab => {
                        const isActive = activeTab === tab;
                        return (
                            <TouchableOpacity 
                                key={tab} 
                                onPress={() => handleTabPress(tab)} 
                                style={styles.tab}
                                activeOpacity={0.75}
                            >
                                {isActive ? (
                                    <GradientText
                                        colors={['#a855f7', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.tabText, styles.activeTabText]}
                                    >
                                        {tab}
                                    </GradientText>
                                ) : (
                                    <Text style={[
                                        styles.tabText, 
                                        styles.inactiveTabText,
                                        { 
                                            color: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : '#64748B' 
                                        }
                                    ]}>
                                        {tab}
                                    </Text>
                                )}
                                {isActive && (
                                    <LinearGradient
                                        colors={['#a855f7', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.tabIndicator}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>`;

const newTabsRender = `<View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {DISCOVERY_TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <TouchableOpacity 
                                key={tab.id} 
                                onPress={() => handleTabPress(tab.id)} 
                                style={styles.tab}
                                activeOpacity={0.75}
                            >
                                {isActive ? (
                                    <GradientText
                                        colors={['#a855f7', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.tabText, styles.activeTabText]}
                                    >
                                        {tab.label}
                                    </GradientText>
                                ) : (
                                    <Text style={[
                                        styles.tabText, 
                                        styles.inactiveTabText,
                                        { 
                                            color: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : '#64748B' 
                                        }
                                    ]}>
                                        {tab.label}
                                    </Text>
                                )}
                                {isActive && (
                                    <LinearGradient
                                        colors={['#a855f7', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.tabIndicator}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>`;

if (code.includes(oldTabsRender)) {
    code = code.replace(oldTabsRender, newTabsRender);
}

// 6. Fix FlatList clipping and render configuration
code = code.replace("removeClippedSubviews={Platform.OS === 'android'}", "removeClippedSubviews={false}");
code = code.replace("initialNumToRender={6}", "initialNumToRender={10}");
code = code.replace("maxToRenderPerBatch={6}", "maxToRenderPerBatch={10}");
code = code.replace("windowSize={7}", "windowSize={11}");

fs.writeFileSync('backend/mobile-app/src/screens/HomeScreen.js', code, 'utf8');
console.log('Successfully updated backend/mobile-app/src/screens/HomeScreen.js');

