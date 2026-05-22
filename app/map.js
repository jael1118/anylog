import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  Dimensions, StatusBar 
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps'; 
import * as Location from 'expo-location'; // 引入定位功能
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
  
  // 存放從 Firebase 抓下來的該空間所有紀錄
  const [records, setRecords] = useState([]);
  // 存放該空間目前的成員列表 (用來繪製左上角的圖例)
  const [spaceMembers, setSpaceMembers] = useState([]);

  // 預設地圖初始位置 (設定在台北)
  const [userRegion, setUserRegion] = useState({
    latitude: 25.0330,
    longitude: 121.5654,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // 1. 初始化與取得空間
  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);

      // 順便請求定位權限並定位到當前位置
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

  // 2. 監聽所屬空間
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

  // 3. 監聽當前空間的紀錄 (以便在地圖上畫 Marker)
  useEffect(() => {
    if (!currentSpaceId) return;
    const unsubscribe = subscribeToSpaceRecords(currentSpaceId, (data) => {
      // 這裡過濾出「有帶座標」的紀錄，目前我們上傳時還沒帶入座標，所以這裡暫時可能為空
      const validRecords = data.filter(record => record.latitude && record.longitude);
      setRecords(validRecords);
    });
    return () => unsubscribe();
  }, [currentSpaceId]);

  // 定位到當前位置的按鈕功能
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
        {/* 把 Firebase 抓到的紀錄變成地圖上的點 */}
        {records.map((record, index) => {
          // 根據建立者的 ID 來決定大頭針顏色
          const memberIndex = spaceMembers.indexOf(record.createdBy) !== -1 ? spaceMembers.indexOf(record.createdBy) : 0;
          const markerColor = USER_COLORS[memberIndex % USER_COLORS.length];

          return (
            <Marker 
              key={record.id || index}
              coordinate={{ latitude: record.latitude, longitude: record.longitude }}
            >
              <View style={[styles.customMarker, { backgroundColor: markerColor }]} />
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

        {/* 3. 左側使用者統計 (絕對定位) */}
        <View style={styles.statsContainer}>
          {/* 目前先用假資料模擬視覺圖，未來可換成 spaceMembers.map */}
          <View style={styles.userRow}>
            <View style={[styles.colorDot, { backgroundColor: '#E0E0E0' }]} />
            <Text style={styles.userText}>person1</Text>
          </View>
          <View style={styles.userRow}>
            <View style={[styles.colorDot, { backgroundColor: '#666666' }]} />
            <Text style={styles.userText}>person2</Text>
          </View>
        </View>

        {/* 4. 右下角懸浮按鈕群 (絕對定位) */}
        <View style={styles.rightFabContainer}>
          <TouchableOpacity style={styles.fabSmall} onPress={goToCurrentLocation}>
            {/* 使用導航箭頭 Icon，並旋轉讓它朝上 */}
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

// 樣式表
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%', position: 'absolute' },
  
  // 覆蓋層容器 (讓裡面的元素可以絕對定位，但不阻擋地圖滑動)
  overlayContainer: { flex: 1, position: 'relative' },
  
  header: { alignItems: 'center', marginTop: 10 },
  categorySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxWidth: 150, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  categoryText: { fontSize: 15, fontWeight: '500', marginRight: 6, color: '#333' },

  // 左側統計
  statsContainer: { position: 'absolute', top: 100, left: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  userText: { fontSize: 13, color: '#333', fontWeight: '500' },

  // 自訂地圖標記點 (實心小圓點)
  customMarker: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 },

  // 右下角 FAB 按鈕群
  rightFabContainer: { position: 'absolute', bottom: 120, right: 20, alignItems: 'center' },
  fabSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#C4C4C4', justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  fabLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A7A7A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },

  });