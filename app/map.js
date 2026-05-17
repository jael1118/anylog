import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback, ActivityIndicator, Alert, Image, Linking, FlatList, Animated } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const colors = {
  primary: '#A078D2',
  secondary: '#E7D7FB',
  background: '#F8F8FC',
  text: '#4A4A4A',
  grayText: '#888888',
  white: '#FFFFFF',
  accentPink: '#FCA5F1',
  heart: '#FCA5F1',
};

const customMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#e0e3c8" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#523735" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f1e6" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#c6ccae" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#f0e6c5" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#e1d4b1" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#f5dfa2" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#e1c880" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#b9d3c2" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#92998d" }] },
  { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];

const placeholderImages = [
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=300&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=300&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1442512595331-e89e73853f31?q=80&w=300&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=300&auto=format&fit=crop'
];

let globalSavedRegion = null;
let globalSavedCafes = [];

const CafeMarker = ({ cafe, isSelected, isVisited, count, onPress }) => {
  // 🌟 1. 準備動畫變數與重繪開關
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  // 🌟 2. 剛載入地圖時，給它一點時間畫出圖標，然後關閉重繪以保持滑動順暢
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // 🌟 3. 監聽點擊狀態的改變
  useEffect(() => {
    if (isSelected) {
      // 【被選中時】開啟重繪 -> 縮小到 0.3 -> 彈回 1 -> 關閉重繪
      setTracksViewChanges(true);
      scaleAnim.setValue(0.3);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: false, // ⚠️ 在地圖圖標動畫中，關閉原生驅動反而能確保每一幀都被印到地圖上！
      }).start(() => {
        setTimeout(() => setTracksViewChanges(false), 100);
      });
    } else {
      // 【被取消選中時】開啟重繪 -> 讓它變回普通小圖標 -> 關閉重繪
      setTracksViewChanges(true);
      setTimeout(() => setTracksViewChanges(false), 100);
    }
  }, [isSelected]);

  return (
    <Marker 
      key={cafe.id} 
      coordinate={{ latitude: cafe.lat, longitude: cafe.lng }}
      onPress={onPress}
      style={{ zIndex: isSelected ? 999 : 1 }}
      tracksViewChanges={tracksViewChanges}
    >
      {/* 🌟 1. 結界（外框）：給地圖看的！固定 50x50，絕對不加動畫 */}
      <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
        
        {/* 🌟 2. 動畫層：給使用者看的！被關在結界裡面，不管怎麼彈都不會飛走 */}
        <Animated.View style={{ 
          transform: isSelected ? [{ scale: scaleAnim }] : [] 
        }}>
          {isSelected ? (
            <Ionicons name="location" size={46} color={colors.primary} />
          ) : isVisited ? (
            <View style={styles.visitedMarker}>
              <Text style={styles.visitCountText}>{count}</Text>
            </View>
          ) : (
            <View style={styles.unvisitedMarker}>
              <Ionicons name="cafe" size={14} color={colors.primary} />
            </View>
          )}
        </Animated.View>

      </View>
    </Marker>
  );
};

export default function MapScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const mapRef = useRef(null);

  const [allCafes, setAllCafes] = useState(globalSavedCafes);
  const [displayedCafes, setDisplayedCafes] = useState(globalSavedCafes);
  const [userRegion, setUserRegion] = useState(globalSavedRegion);
  const [currentMapRegion, setCurrentMapRegion] = useState(globalSavedRegion);

  const [isLoading, setIsLoading] = useState(!globalSavedRegion);
  const [selectedCafeId, setSelectedCafeId] = useState(null);

  const selectedCafe = allCafes.find(c => c.id === selectedCafeId);
  const [searchText, setSearchText] = useState('');
  const [showSearchHereBtn, setShowSearchHereBtn] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const [visitData, setVisitData] = useState({});
  const [isSearchListVisible, setIsSearchListVisible] = useState(false);

  const excludeKeywords = ['50嵐', '清心', '麻古', '可不可', '迷客夏', '茶湯會', '萬波', '得正', '八曜', '手搖', '茶飲', 'TEA', 'Tea', '大苑子', '龜記', 'CoCo', '鮮茶道'];

  useFocusEffect(
    useCallback(() => {
      const fetchVisited = async () => {
        try {
          const logsStr = await AsyncStorage.getItem('cafe_logs');
          if (logsStr) {
            const logs = JSON.parse(logsStr);
            const data = {};
            logs.forEach(log => {
              if (log.location) {
                const locName = log.location.toLowerCase().trim();
                if (!data[locName]) {
                  // 初始化計數器、總分、Tag 陣列
                  data[locName] = { count: 0, totalRating: 0, tags: [] };
                }
                data[locName].count += 1;
                data[locName].totalRating += Number(log.rating) || 0;
                
                // 收集自己打的 Tag (假設是用空白分隔)
                if (log.tags) {
                  const tagArray = log.tags.split(' ').filter(t => t.trim() !== '');
                  data[locName].tags.push(...tagArray);
                }
              }
            });

            // 2. 結算平均分數與過濾重複的 Tag
            Object.keys(data).forEach(key => {
              // 算平均
              data[key].averageRating = data[key].count > 0 ? (data[key].totalRating / data[key].count) : 0;
              // 去除重複的 Tag，並最多只取前 3 個顯示以免版面爆掉
              data[key].tags = [...new Set(data[key].tags)].slice(0, 3);
            });
            setVisitData(data);
          }
        } catch (error) {
          console.error("讀取去過的地點失敗", error);
        }
      };
      fetchVisited();
    }, [])
  );

  useEffect(() => {
    if (globalSavedRegion) {
      return;
    }

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限不足', '請開啟定位權限以顯示所在地點的咖啡廳');
        const defaultLoc = { latitude: 25.0330, longitude: 121.5654, latitudeDelta: 0.02, longitudeDelta: 0.02 };
        globalSavedRegion = defaultLoc;
        setUserRegion(defaultLoc);
        fetchRealCafes(defaultLoc.latitude, defaultLoc.longitude);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const currentLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

      globalSavedRegion = currentLoc;
      setUserRegion(currentLoc);
      setCurrentMapRegion(currentLoc);
      fetchRealCafes(currentLoc.latitude, currentLoc.longitude);
    })();
  }, []);

  const fetchRealCafes = async (lat, lng) => {
    try {
      setIsLoading(true);
      setShowSearchHereBtn(false);

      const query = `[out:json];node(around:3000,${lat},${lng})["amenity"="cafe"];out;`;
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);

      if (!response.ok) {
        console.log('API 忙碌中，請稍後再試');
        setIsLoading(false);
        return;
      }

      const text = await response.text();
      const data = JSON.parse(text);

      const realData = data.elements
        .filter(node => node.tags && node.tags.name)
        .filter(node => {
          const cafeName = node.tags.name;
          const isBubbleTea = excludeKeywords.some(keyword => cafeName.includes(keyword));
          return !isBubbleTea;
        })
        .map((node) => ({
          id: node.id.toString(),
          name: node.tags.name,
          lat: node.lat,
          lng: node.lon,
          imageUrl: placeholderImages[Math.floor(Math.random() * placeholderImages.length)],
          address: node.tags['addr:street'] ? `${node.tags['addr:street']}${node.tags['addr:housenumber'] || ''}` : `${node.lat.toFixed(5)}, ${node.lon.toFixed(5)}`,
          businessHours: node.tags.opening_hours || '營業時間未提供',
          rating: (Math.random() * (5.0 - 3.8) + 3.8).toFixed(1),
          tags: ['#真實店家', node.tags.internet_access === 'wlan' ? '#有WiFi' : '#新發現']
        }));

      globalSavedCafes = realData;
      setAllCafes(realData);
      setDisplayedCafes(realData);
      setIsLoading(false);
    } catch (error) {
      console.log("抓取失敗", error);
      setIsLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearchText(text);
    if (text) {
      const filtered = allCafes.filter(cafe =>
        cafe.name.toLowerCase().includes(text.toLowerCase())
      );
      setDisplayedCafes(filtered);
    } else {
      setDisplayedCafes(allCafes);
    }
    setSelectedCafeId(null); // 更新：搜尋時清除選中狀態
  };

  // 🌟 修改2：清除搜尋內容的函式
  const handleClearSearch = () => {
    setSearchText('');
    setDisplayedCafes(allCafes);
    Keyboard.dismiss();
  };

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
    setIsSearchListVisible(true);
  };

  const goToCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({});
      const currentLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

      mapRef.current?.animateToRegion(currentLoc, 800);
      globalSavedRegion = currentLoc;
      setCurrentMapRegion(currentLoc);
    } catch (error) {
      console.log("定位失敗", error);
    }
  };

  const openGoogleMaps = (cafe) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${cafe.lat},${cafe.lng}`;
    Linking.openURL(url).catch((err) => {
      console.error('無法打開地圖', err);
      Alert.alert('錯誤', '無法開啟地圖應用程式');
    });
  };

  const selectedVData = selectedCafe ? visitData[selectedCafe.name.toLowerCase().trim()] : null;
  const isSelectedVisited = selectedVData && selectedVData.count > 0;
  // 🌟 改用剛算好的平均分數
  const selectedUserRating = selectedVData ? selectedVData.averageRating : 0;
  // 🌟 抓出自己的 Tag
  const displayTags = isSelectedVisited ? selectedVData.tags : [];
  return (
    <TouchableWithoutFeedback onPress={() => {
      Keyboard.dismiss();
      setIsSearchListVisible(false);
    }}>
      <View style={styles.container}>

        {userRegion ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={userRegion}
            showsUserLocation={true}
            customMapStyle={customMapStyle}
            onPress={() => {
              setSelectedCafeId(null);
              setIsSearchListVisible(false);
            }}
            onRegionChangeComplete={(region) => {
              globalSavedRegion = region;
              setCurrentMapRegion(region);
              if (!isFirstLoad) {
                setShowSearchHereBtn(true);
              }
              setIsFirstLoad(false);
            }}
          >
            {displayedCafes.map((cafe) => {
              const vData = visitData[cafe.name.toLowerCase().trim()];
              const count = vData ? vData.count : 0;
              const isVisited = count > 0;
              const isSelected = selectedCafeId === cafe.id;

              return (
                <CafeMarker
                  key={`${cafe.id}-${isSelected}`} // 🌟 沿用你的設定
                  cafe={cafe}
                  isSelected={isSelected}
                  isVisited={isVisited}
                  count={count}
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedCafeId(cafe.id);
                    setIsSearchListVisible(false);
                    mapRef.current?.animateToRegion({
                      // 💡 貼心微調：緯度 (latitude) 稍微減去 0.003
                      // 這會讓地圖中心點偏下，確保你的圖標會完美出現在畫面「偏上方」
                      // 完全不會被下方的「白色資訊卡片」擋住！
                      latitude: cafe.lat, 
                      longitude: cafe.lng,
                      // 維持使用者當前的縮放比例，不要突然放大或縮小
                      latitudeDelta: currentMapRegion?.latitudeDelta || 0.01,
                      longitudeDelta: currentMapRegion?.longitudeDelta || 0.01
                    }, 500); // 500 毫秒的滑動時間，手感最滑順
                  }}
                />
              );
            })}
            
          </MapView>
        ) : (
          <View style={styles.loadingFull}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 10, color: colors.text }}>正在定位你的位置...</Text>
          </View>
        )}

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="點擊查詢店家..."
            placeholderTextColor={colors.grayText}
            value={searchText}
            onChangeText={handleSearch}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            onFocus={() => setIsSearchListVisible(true)}
          />
          {/* 🌟 修改3：加上「叉叉」按鈕，只有在搜尋框有字的時候才顯示 */}
          {searchText.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={{ marginRight: 15 }}>
              <Ionicons name="close-circle" size={18} color={colors.grayText} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSearchSubmit}>
            <Ionicons name="search" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {isSearchListVisible && (
          <View style={styles.searchListContainer}>
            <View style={styles.searchListHeader}>
              <Text style={styles.searchListTitle}>搜尋結果 ({displayedCafes.length})</Text>
            </View>
            <FlatList
              data={displayedCafes}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchListItem} onPress={() => {
                  setIsSearchListVisible(false);
                  setSelectedCafeId(item.id); // 更新：使用 ID
                  mapRef.current?.animateToRegion({
                    latitude: item.lat,
                    longitude: item.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01
                  }, 800);
                  Keyboard.dismiss();
                }}>
                  <Ionicons name="location-outline" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchListItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.searchListItemAddress} numberOfLines={1}>{item.address}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {userRegion && (
          <TouchableOpacity style={styles.locateButton} onPress={goToCurrentLocation}>
            <Ionicons name="locate" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}

        {showSearchHereBtn && currentMapRegion && !isLoading && (
          <TouchableOpacity
            style={styles.searchHereBtn}
            onPress={() => fetchRealCafes(currentMapRegion.latitude, currentMapRegion.longitude)}
          >
            <Ionicons name="refresh" size={16} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={styles.searchHereText}>在地圖此區域搜尋</Text>
          </TouchableOpacity>
        )}

        {isLoading && userRegion && (
          <View style={styles.loadingFloating}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingFloatingText}>搜尋附近店家...</Text>
          </View>
        )}

        {selectedCafe && (
          <View style={styles.detailCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cafeName} numberOfLines={1}>{selectedCafe.name}</Text>

              {isSelectedVisited ? (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((item, index) => (
                    <Ionicons key={index} name="heart" size={12} color={item <= selectedUserRating ? colors.heart : '#E0E0E0'} style={{ marginRight: 2 }} />
                  ))}
                  <Text style={styles.ratingScore}>{Number(selectedUserRating).toFixed(1)}</Text>
                </View>
              ) : (
                <View style={styles.ratingRow}></View>
              )}
            </View>

            <View style={styles.cardMainContent}>
              <Image source={{ uri: selectedCafe.imageUrl }} style={styles.cafeImage} />

              <View style={styles.cardInfoColumn}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>
                    {/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(selectedCafe.address) ? '座標:' : '地址:'}
                  </Text>
                  <Text style={styles.detailText} numberOfLines={2}>{selectedCafe.address}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>營業時間:</Text>
                  <Text style={styles.detailText} numberOfLines={1}>{selectedCafe.businessHours}</Text>
                </View>

                {isSelectedVisited && displayTags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {displayTags.map((tag, index) => (
                      <View key={index} style={styles.tagBadge}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actionButtonRow}>
                  <TouchableOpacity style={[styles.actionButton, styles.mapButton]} onPress={() => openGoogleMaps(selectedCafe)}>
                    <Text style={styles.mapButtonText}>開啟導航</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.logButton]}
                    onPress={() => router.push({
                      pathname: '/addlog',
                      params: { prefillTitle: selectedCafe.name, prefillLocation: selectedCafe.name }
                    })}
                  >
                    <Text style={styles.logButtonText}>寫紀錄</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
          </View>
        )}

        <View style={styles.tabBarWrapper}>
          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/')}>
              <Ionicons name="calendar-outline" size={22} color={colors.grayText} />
              <Text style={styles.tabText}>主頁</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/map')}>
              <View style={styles.tabItemActiveBg}>
                <Ionicons name="map-outline" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.tabText, styles.tabTextActive]}>地圖</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/logbook')}>
              <Ionicons name="book-outline" size={22} color={colors.grayText} />
              <Text style={styles.tabText}>紀錄</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/setting')}>
              <Ionicons name="settings-outline" size={22} color={colors.grayText} />
              <Text style={styles.tabText}>設定</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  loadingFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  searchContainer: { position: 'absolute', top: 80, left: 20, right: 20, flexDirection: 'row', backgroundColor: colors.white, borderRadius: 15, paddingHorizontal: 20, paddingVertical: 15, alignItems: 'center', justifyContent: 'space-between', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, marginRight: 10 },

  searchListContainer: { position: 'absolute', top: 135, left: 20, right: 20, maxHeight: 300, backgroundColor: colors.white, borderRadius: 15, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, zIndex: 20, overflow: 'hidden' },
  searchListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.secondary },
  searchListTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  searchListItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F8F8FC' },
  searchListItemName: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  searchListItemAddress: { fontSize: 12, color: colors.grayText, marginTop: 4 },

  locateButton: { position: 'absolute', top: 140, right: 20, backgroundColor: colors.white, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, zIndex: 10 },
  searchHereBtn: { position: 'absolute', top: 140, alignSelf: 'center', flexDirection: 'row', backgroundColor: colors.white, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, zIndex: 10 },
  searchHereText: { color: colors.primary, fontWeight: 'bold', fontSize: 14, includeFontPadding: false },

  loadingFloating: { position: 'absolute', top: 140, alignSelf: 'center', flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignItems: 'center', elevation: 3 },
  loadingFloatingText: { color: colors.primary, marginLeft: 8, fontWeight: 'bold', fontSize: 12 },

  unvisitedMarker: { backgroundColor: colors.white, borderColor: colors.primary, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, elevation: 3 },
  visitedMarker: { backgroundColor: colors.primary, borderColor: colors.white, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, elevation: 3 },
  visitCountText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },

  detailCard: { position: 'absolute', bottom: 120, left: 20, right: 20, backgroundColor: colors.white, borderRadius: 25, padding: 20, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  cafeName: { fontSize: 20, fontWeight: '900', color: colors.text, marginRight: 10, flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  ratingScore: { fontSize: 10, color: colors.grayText, marginLeft: 4, fontWeight: 'bold' },

  cardMainContent: { flexDirection: 'row' },
  cafeImage: { width: 100, height: 100, borderRadius: 15, marginRight: 15 },
  cardInfoColumn: { flex: 1, justifyContent: 'space-between' },

  detailItem: { flexDirection: 'row', marginBottom: 4 },
  detailLabel: { fontSize: 11, color: colors.text, fontWeight: 'bold', marginRight: 4 },
  detailText: { fontSize: 11, color: colors.grayText, flex: 1, textDecorationLine: 'underline' },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 8 },
  tagBadge: { backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 6, marginBottom: 6 },
  tagText: { color: colors.primary, fontSize: 10, fontWeight: 'bold' },

  actionButtonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' },
  actionButton: { paddingVertical: 8, borderRadius: 15, flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapButton: { backgroundColor: '#F0F0F0', marginRight: 10 }, // 加個右邊距分開兩顆按鈕
  logButton: { backgroundColor: colors.primary },
  mapButtonText: { color: colors.text, fontWeight: 'bold', fontSize: 13 },
  logButtonText: { color: colors.white, fontWeight: 'bold', fontSize: 13 },

  tabBarWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent' },
  tabBar: { flexDirection: 'row', height: 85, backgroundColor: colors.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 10, paddingHorizontal: 15 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 15 },
  tabItemActiveBg: { backgroundColor: colors.secondary, width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginTop: -8, marginBottom: 2 },
  tabText: { fontSize: 10, color: colors.grayText, marginTop: 4, fontWeight: 'bold' },
  tabTextActive: { color: colors.primary }
});