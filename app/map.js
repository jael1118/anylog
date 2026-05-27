import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  Dimensions, StatusBar, Image, Modal, ScrollView, Platform 
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps'; 
import * as Location from 'expo-location'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { LinearGradient } from 'expo-linear-gradient';

import { 
  subscribeToUserSpaces, subscribeToSpaceRecords, getUserProfile // ✅ 引入 getUserProfile
} from './firebaseServices'; 

const windowWidth = Dimensions.get('window').width;

// 定義不同成員的專屬顏色
const USER_COLORS = ['#E0E0E0', '#666666', '#A078D2', '#FCA5F1', '#88C0D0', '#EBCB8B'];

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);
  const [currentSpaceId, setCurrentSpaceId] = useState(null); 
  const [currentSpaceName, setCurrentSpaceName] = useState("Name");
  
  const [records, setRecords] = useState([]);
  const [spaceMembers, setSpaceMembers] = useState([]);
  
  // ✅ 新增：用來存放取得的空間成員個人資料 (包含名字)
  const [memberProfiles, setMemberProfiles] = useState([]);

  const [isSpaceSwitcherVisible, setIsSpaceSwitcherVisible] = useState(false);

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
      } else if (currentSpaceId) {
        // 如果有切換空間，確保 members 陣列有跟著更新
        const updatedSpace = spaces.find(s => s.id === currentSpaceId);
        if(updatedSpace) setSpaceMembers(updatedSpace.members || []);
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

  // ✅ 新增：抓取空間成員的真實名字與大頭貼
  useEffect(() => {
    const fetchMembers = async () => {
      if (spaceMembers && spaceMembers.length > 0) {
        try {
          const profiles = await Promise.all(
            spaceMembers.map(async (id) => {
              const profile = await getUserProfile(id);
              return profile || { id, name: '空間成員', avatarUrl: null };
            })
          );
          setMemberProfiles(profiles);
        } catch (error) {
          console.error("讀取成員資料失敗:", error);
        }
      } else {
        setMemberProfiles([]);
      }
    };
    fetchMembers();
  }, [spaceMembers]);

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
      
      {/* 滿版地圖背景 */}
      <MapView 
        ref={mapRef}
        style={styles.map} 
        initialRegion={userRegion}
        showsUserLocation={true}
      >
        {records.map((record, index) => {
          // ✅ 自動配對這篇貼文作者對應的專屬顏色
          const memberIndex = spaceMembers.indexOf(record.createdBy) !== -1 ? spaceMembers.indexOf(record.createdBy) : 0;
          const markerColor = USER_COLORS[memberIndex % USER_COLORS.length];
          
          const firstImage = record.imageUrls ? record.imageUrls[0] : record.imageUrl;

          return (
            <Marker 
              key={record.id || index}
              coordinate={{ latitude: record.latitude, longitude: record.longitude }}
              onPress={() => {
                router.push({
                  pathname: '/detail',
                  params: { record: JSON.stringify(record) }
                });
              }}
            >
              <View style={[styles.imageMarkerWrapper, { borderColor: markerColor }]}>
                {firstImage ? (
                  <Image source={{ uri: firstImage }} style={styles.markerImage} resizeMode="cover" />
                ) : (
                  <View style={styles.markerPlaceholder}>
                    <Feather name="image" size={14} color="#999" />
                  </View>
                )}
              </View>
              {/* 地標底部的倒三角形指針，也要跟著變色 */}
              <View style={[styles.markerArrow, { borderTopColor: markerColor }]} />
            </Marker>
          );
        })}
      </MapView>

      <LinearGradient
        colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.5)', 'transparent']}
        style={styles.topWhiteGradient}
        pointerEvents="none" 
      />

      <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
        
        {/* 頂部懸浮空間選擇器 */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.categorySelector} 
            onPress={() => setIsSpaceSwitcherVisible(true)}
          >
            <Text style={styles.categoryText} numberOfLines={1}>{currentSpaceName}</Text>
            <Feather name="chevron-down" size={18} color="#333" />
          </TouchableOpacity>
        </View>

        {/* ✅ 左側使用者統計 (動態抓取 memberProfiles 並顯示對應顏色) */}
        <View style={styles.statsContainer}>
          {memberProfiles.map((member, index) => {
            const dotColor = USER_COLORS[index % USER_COLORS.length];
            return (
              <View key={index} style={styles.userRow}>
                <View style={[styles.colorDot, { backgroundColor: dotColor }]} />
                <Text style={styles.userText} numberOfLines={1}>{member.name}</Text>
              </View>
            );
          })}
        </View>

        {/* 右下角懸浮按鈕群 */}
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

      {/* 切換空間的彈出視窗 (Modal) */}
      <Modal visible={isSpaceSwitcherVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>切換空間</Text>
              <TouchableOpacity onPress={() => setIsSpaceSwitcherVisible(false)}>
                <Feather name="x" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {mySpaces.map(space => (
                <TouchableOpacity 
                  key={space.id} 
                  style={[styles.spaceListItem, currentSpaceId === space.id && styles.spaceListActive]}
                  onPress={() => {
                    setCurrentSpaceId(space.id);
                    setCurrentSpaceName(space.name);
                    // 切換完自動關閉視窗
                    setIsSpaceSwitcherVisible(false);
                  }}
                >
                  <Text style={[styles.spaceListText, currentSpaceId === space.id && {color: 'white'}]}>
                    {space.name}
                  </Text>
                  {currentSpaceId === space.id && <Feather name="check" size={20} color="white" />}
                </TouchableOpacity>
              ))}
              {mySpaces.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#999', padding: 20 }}>尚無空間</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topWhiteGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 260 : 160, 
    zIndex: 1,
  },

  map: { width: '100%', height: '100%', position: 'absolute' },
  overlayContainer: { flex: 1, position: 'relative', zIndex: 2, elevation: 2 },
  
  header: { alignItems: 'center', marginTop: 10, zIndex: 2 },
  categorySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxWidth: 150, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  categoryText: { fontSize: 15, fontWeight: '500', marginRight: 6, color: '#333' },

  statsContainer: { position: 'absolute', top: 100, left: 20, zIndex: 2, maxWidth: 120 }, // 加個最大寬度避免名字太長破版
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  userText: { fontSize: 13, color: '#333', fontWeight: '500' },

  imageMarkerWrapper: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  markerImage: { width: '100%', height: '100%' },
  markerPlaceholder: { flex: 1, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' },
  markerArrow: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', alignSelf: 'center', marginTop: -1 },

  rightFabContainer: { position: 'absolute', bottom: 120, right: 20, alignItems: 'center' },
  fabSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#C4C4C4', justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  fabLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A7A7A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  spaceListItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 8, backgroundColor: '#F5F5F5' },
  spaceListActive: { backgroundColor: '#333' },
  spaceListText: { fontSize: 16, fontWeight: '600', color: '#333' },
});