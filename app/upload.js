import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  TextInput, Image, Alert, ScrollView, StatusBar, Modal, Keyboard, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import MapView from 'react-native-maps'; // 引入地圖
import * as Location from 'expo-location'; // 引入定位與編碼功能

import { 
  subscribeToUserSpaces, addRecordToSpace, uploadImageToGitHub 
} from './firebaseServices'; 

export default function UploadScreen() {
  const router = useRouter();
  const { currentSpaceId } = useLocalSearchParams();
  const modalMapRef = useRef(null); // 地圖控制遙控器

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);
  
  // 紀錄發布狀態
  const [uploadTargetSpaceId, setUploadTargetSpaceId] = useState(currentSpaceId || null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImagesBase64, setSelectedImagesBase64] = useState([]);
  const [note, setNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // 📍 地點與選點地圖狀態
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  
  // 搜尋與地圖中心點追蹤
  const [searchQuery, setSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState({
    latitude: 25.0330,
    longitude: 121.5654,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  });

  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);

      // 先私下取得手機目前GPS當作初始預設地圖位置
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setMapCenter({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008
        });
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (spaces) => {
      setMySpaces(spaces);
      if (!uploadTargetSpaceId && spaces.length > 0) {
        setUploadTargetSpaceId(spaces[0].id);
      }
    });
    return () => unsubscribe();
  }, [myUserId]);

  // 📸 選照片
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      allowsMultipleSelection: true,
      selectionLimit: 10, 
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      const base64s = result.assets.map(asset => asset.base64);
      setSelectedImages(uris); 
      setSelectedImagesBase64(base64s); 
    }
  };

  // 🚀 執行地圖搜尋功能（文字轉座標並飛過去）
  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    try {
      // 使用 Expo 免費內建地理編碼搜尋
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        const { latitude: lat, longitude: lng } = results[0];
        
        // 遙控地圖絲滑地飛過去選定地點 ✅
        modalMapRef.current?.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005
        }, 800);
      } else {
        Alert.alert("提示", "找不到該地點，請換個關鍵字試試！");
      }
    } catch (error) {
      Alert.alert("搜尋失敗", "請確認網路連線是否正常");
    }
  };

  // 📍 確認選點，並換算成人類看得懂的地址地名
  const handleConfirmLocation = async () => {
    try {
      const targetLat = mapCenter.latitude;
      const targetLng = mapCenter.longitude;
      
      setLatitude(targetLat);
      setLongitude(targetLng);

      // 將座標逆向換算成地名
      const response = await Location.reverseGeocodeAsync({ latitude: targetLat, longitude: targetLng });
      if (response.length > 0) {
        const place = response[0];
        // 優先取店家/景點名，沒有的話就組合路名與門牌
        const placeName = place.name || `${place.street || ''}${place.streetNumber || ''}`;
        setLocation(placeName || `${place.city || ''}未知地點`);
      } else {
        setLocation(`${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`);
      }
      setIsMapModalVisible(false);
    } catch (error) {
      setIsMapModalVisible(false);
    }
  };

  const handleUpload = async () => {
    if (selectedImagesBase64.length === 0 || !uploadTargetSpaceId) return;
    
    setIsUploading(true);
    try {
      const cloudImageUrls = [];
      for (const base64 of selectedImagesBase64) {
        const url = await uploadImageToGitHub(base64);
        cloudImageUrls.push(url);
      }
            
      // 整包資料（圖片+筆記+地點文字+經緯度座標）一併寫入 Firebase
      await addRecordToSpace(uploadTargetSpaceId, cloudImageUrls, note, location, latitude, longitude);
      
      Alert.alert("成功", "紀錄已發佈！", [
        { text: "OK", onPress: () => router.back() } 
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("失敗", `上傳失敗：\n${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* 頂部導覽 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} disabled={isUploading}>
          <Feather name="chevron-left" size={28} color={isUploading ? "#CCC" : "#333"} />
        </TouchableOpacity>
        <Text style={styles.title}>新增紀錄</Text>
        <TouchableOpacity onPress={handleUpload} disabled={selectedImages.length === 0 || isUploading}>
          <Text style={[styles.publishBtnText, (selectedImages.length > 0 && !isUploading) ? styles.publishBtnActive : null]}>
            {isUploading ? "發佈中" : "發佈"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* 照片選擇區 */}
        {selectedImages.length > 0 ? (
          <View style={styles.previewContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
              {selectedImages.map((uri, index) => (
                <Image key={index} source={{ uri }} style={styles.previewImageMulti} />
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.reselectBtn} onPress={pickImage} disabled={isUploading}>
              <Feather name="refresh-cw" size={14} color="#666" />
              <Text style={styles.reselectText}>重新選擇照片</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.imageUploadArea} onPress={pickImage}>
            <View style={styles.imageUploadPlaceholder}>
              <Feather name="camera" size={40} color="#999" />
              <Text style={styles.imageUploadText}>點擊選擇照片 (最多 10 張)</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 📍 地點觸發按鈕（改成觸發滿版地圖 Modal） */}
        <TouchableOpacity 
          style={styles.locationRow} 
          onPress={() => setIsMapModalVisible(true)}
          disabled={isUploading}
          activeOpacity={0.7}
        >
          <Feather name="map-pin" size={16} color="#333" />
          <Text style={[styles.locationTextDisplay, !location ? { color: '#999' } : null]}>
            {location || "選擇紀錄地點..."}
          </Text>
          <Feather name="chevron-right" size={18} color="#666" />
        </TouchableOpacity>

        {/* 筆記文字輸入 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="寫點什麼紀錄這刻..."
            placeholderTextColor="#999"
            multiline
            value={note}
            onChangeText={setNote}
            editable={!isUploading}
          />
        </View>

        {/* 空間選擇 */}
        <Text style={styles.sectionTitle}>發佈至空間：</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spaceSelector}>
          {mySpaces.map(space => (
            <TouchableOpacity 
              key={space.id}
              style={[styles.spaceChip, uploadTargetSpaceId === space.id && styles.spaceChipActive]}
              onPress={() => setUploadTargetSpaceId(space.id)}
              disabled={isUploading}
            >
              <Text style={[styles.spaceChipText, uploadTargetSpaceId === space.id && {color: 'white'}]}>
                {space.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ==================== 📍 模式A：全域選點地圖視窗 ==================== */}
      <Modal visible={isMapModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
          
          {/* 地圖 Modal 的頂部 Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsMapModalVisible(false)}>
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>移動地圖選點</Text>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleConfirmLocation}>
              <Text style={styles.modalConfirmBtnText}>確定</Text>
            </TouchableOpacity>
          </View>

          {/* 🔍 地圖搜尋輸入框 */}
          <View style={styles.mapSearchBox}>
            <TextInput
              style={styles.mapSearchInput}
              placeholder="搜尋想去的地點或景點..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearchLocation} // 按下鍵盤搜尋鈕觸發
            />
            <TouchableOpacity onPress={handleSearchLocation} style={styles.mapSearchIcon}>
              <Feather name="search" size={18} color="#333" />
            </TouchableOpacity>
          </View>

          {/* 地圖主體貨櫃 */}
          <View style={{ flex: 1, position: 'relative' }}>
            <MapView
              ref={modalMapRef}
              style={{ width: '100%', height: '100%' }}
              initialRegion={mapCenter}
              showsUserLocation={true}
              // 背景地圖被拖動時，即時更新中心點位置
              onRegionChangeComplete={(region) => setMapCenter(region)}
            />

            {/* 🎯 模式 A 靈魂：畫面正中央永不動彈的「絕對定位大頭針準星」 */}
            <View style={styles.centerPinContainer} pointerEvents="none">
              <Feather name="map-pin" size={36} color="#333" />
              {/* 準星陰影點 */}
              <View style={styles.centerPinShadow} />
            </View>
          </View>

        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderColor: '#EAEAEA', backgroundColor: '#FFF' },
  title: { fontSize: 18, fontWeight: '600', color: '#333' },
  publishBtnText: { fontSize: 16, fontWeight: '600', color: '#CCC' },
  publishBtnActive: { color: '#007AFF' },
  content: { flex: 1, padding: 20 },
  
  imageUploadArea: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', borderRadius: 15, overflow: 'hidden', marginBottom: 20 },
  imageUploadPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageUploadText: { color: '#999', marginTop: 10, fontSize: 16 },
  
  previewContainer: { marginBottom: 20 },
  previewScroll: { flexDirection: 'row', paddingBottom: 10 },
  previewImageMulti: { width: 120, height: 120, borderRadius: 10, marginRight: 10, backgroundColor: '#EAEAEA' },
  reselectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#F5F5F5', borderRadius: 8, marginTop: 5 },
  reselectText: { fontSize: 14, color: '#666', marginLeft: 6, fontWeight: '500' },
  
  // 地點按鈕樣式
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#EAEAEA', marginBottom: 15 },
  locationTextDisplay: { flex: 1, fontSize: 16, color: '#333', marginLeft: 12 },

  inputContainer: { marginBottom: 30, borderBottomWidth: 1, borderColor: '#EAEAEA', paddingBottom: 10 },
  textInput: { fontSize: 16, lineHeight: 24, color: '#333', minHeight: 80, textAlignVertical: 'top' },
  
  sectionTitle: { fontSize: 14, color: '#666', marginBottom: 10, fontWeight: '500' },
  spaceSelector: { flexDirection: 'row' },
  spaceChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 10 },
  spaceChipActive: { backgroundColor: '#333', borderColor: '#333' },
  spaceChipText: { color: '#666', fontWeight: '600' },

  // 地圖 Modal 專屬樣式
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  modalConfirmBtn: { backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 15 },
  modalConfirmBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  
  mapSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 10, margin: 12, paddingHorizontal: 12, height: 44 },
  mapSearchInput: { flex: 1, fontSize: 15, color: '#333', padding: 0 },
  mapSearchIcon: { padding: 5 },

  // 畫面中央固定大頭針
  centerPinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  centerPinShadow: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: -2 }
});