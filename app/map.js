import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  Dimensions, StatusBar, Image // ✅ 補上 Image 元件
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps'; 
import * as Location from 'expo-location'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { subscribeToUserSpaces, subscribeToSpaceRecords } from './firebaseServices'; 

const windowWidth = Dimensions.get('window').width;

// 定義不同使用者的代表顏色
const USER_COLORS = ['#E0E0E0', '#666666', '#A078D2', '#FCA5F1'];

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);
  const [currentSpaceId, setCurrentSpaceId] = useState(null); 
  const [currentSpaceName, setCurrentSpaceName] = useState("Name");
  
  const [records, setRecords] = useState([]);
  const [spaceMembers, setSpaceMembers] = useState([]);

  const [userRegion, setUserRegion] = useState({
    latitude: 25.0330,
    longitude: 121.5654,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        const currentLoc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setUserRegion(currentLoc);
        mapRef.current?.animateToRegion(currentLoc, 1000);
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (spaces) => {
      setMySpaces(spaces);
      if (!currentSpaceId && spaces.length > 0) {
        setCurrentSpaceId(spaces[0].id);
        setCurrentSpaceName(spaces[0].name);
        setSpaceMembers(spaces[0].members || []);
      }
    });
    return () => unsubscribe();
  }, [myUserId, currentSpaceId]);

  useEffect(() => {
    if (!currentSpaceId) return;
    const unsubscribe = subscribeToSpaceRecords(currentSpaceId, (data) => {
      const validRecords = data.filter(record => record.latitude && record.longitude);
      setRecords(validRecords);
    });
    return () => unsubscribe();
  }, [currentSpaceId]);

  const goToCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 800);
    } catch (error) {
      console.log("定位失敗", error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      {/* 1. 滿版地圖背景 */}
      <MapView 
        ref={mapRef}
        style={styles.map} 
        initialRegion={userRegion}
        showsUserLocation={true}
      >
        {/* 把 Firebase 抓到的紀錄變成地圖上的相片圈圈 */}
        {records.map((record, index) => {
          const memberIndex = spaceMembers.indexOf(record.createdBy) !== -1 ? spaceMembers.indexOf(record.createdBy) : 0;
          const markerColor = USER_COLORS[memberIndex % USER_COLORS.length];
          
          // 抓取紀錄的第一張相片作為大頭針圖案
          const firstImage = record.imageUrls ? record.imageUrls[0] : record.imageUrl;

          return (
            <Marker 
              key={record.id || index}
              coordinate={{ latitude: record.latitude, longitude: record.longitude }}
              // ✅ 新增：點擊地圖上的相片，直接跳轉到該紀錄的詳情頁面！
              onPress={() => {
                router.push({
                  pathname: '/detail',
                  params: { record: JSON.stringify(record) }
                });
              }}
            >
              {/* ✅ 修改：將原本的實心圓點改成 IG 風格的相片圓圈大頭針 */}
              <View style={[styles.imageMarkerWrapper, { borderColor: markerColor }]}>
                {firstImage ? (
                  <Image source={{ uri: firstImage }} style={styles.markerImage} resizeMode="cover" />
                ) : (
                  <View style={styles.markerPlaceholder}>
                    <Feather name="image" size={14} color="#999" />
                  </View>
                )}
              </View>
              {/* 小箭頭裝飾，讓它看起來更像地圖大頭針 */}
              <View style={[styles.markerArrow, { borderTopColor: markerColor }]} />
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
        
        {/* 2. 頂部懸浮空間選擇器 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.categorySelector}>
            <Text style={styles.categoryText} numberOfLines={1}>{currentSpaceName}</Text>
            <Feather name="chevron-down" size={18} color="#333" />
          </TouchableOpacity>
        </View>

        {/* 3. 左側使用者統計 */}
        <View style={styles.statsContainer}>
          <View style={styles.userRow}>
            <View style={[styles.colorDot, { backgroundColor: '#E0E0E0' }]} />
            <Text style={styles.userText}>person1</Text>
          </View>
          <View style={styles.userRow}>
            <View style={[styles.colorDot, { backgroundColor: '#666666' }]} />
            <Text style={styles.userText}>person2</Text>
          </View>
        </View>

        {/* 4. 右下角懸浮按鈕群 */}
        <View style={styles.rightFabContainer}>
          <TouchableOpacity style={styles.fabSmall} onPress={goToCurrentLocation}>
            <Feather name="navigation" size={20} color="#000" style={{ transform: [{ rotate: '315deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.fabLarge}
            onPress={() => router.push({ pathname: '/upload', params: { currentSpaceId } })}
          >
            <Feather name="plus" size={26} color="white" />
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%', position: 'absolute' },
  overlayContainer: { flex: 1, position: 'relative' },
  
  header: { alignItems: 'center', marginTop: 10 },
  categorySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxWidth: 150, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  categoryText: { fontSize: 15, fontWeight: '500', marginRight: 6, color: '#333' },

  statsContainer: { position: 'absolute', top: 100, left: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  userText: { fontSize: 13, color: '#333', fontWeight: '500' },

  // ✅ 新增：照片大頭針外圈框樣式
  imageMarkerWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  // ✅ 新增：大頭針內的圓形照片樣式
  markerImage: {
    width: '100%',
    height: '100%',
  },
  markerPlaceholder: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  // ✅ 新增：大頭針底部三角形小箭頭
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1, // 微調貼合度
  },

  rightFabContainer: { position: 'absolute', bottom: 120, right: 20, alignItems: 'center' },
  fabSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#C4C4C4', justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  fabLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A7A7A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },
});