import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  TextInput, Image, Alert, ScrollView, StatusBar, Modal, Keyboard, Platform
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { 
  subscribeToUserSpaces, addRecordToSpace, uploadImageToGitHub 
} from './firebaseServices'; 

export default function UploadScreen() {
  const router = useRouter();
  const { currentSpaceId } = useLocalSearchParams();

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);
  
  const [uploadTargetSpaceId, setUploadTargetSpaceId] = useState(currentSpaceId || null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImagesBase64, setSelectedImagesBase64] = useState([]);
  const [note, setNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // 📍 鍵盤高度 State
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // 監聽鍵盤彈出與收起，即時更新高度
  useEffect(() => {
    // iOS 建議用 keyboardWillShow 比較滑順，Android 只能用 keyboardDidShow
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardDidShowListener = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardDidHideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // 📍 地點相關 State
  const [location, setLocation] = useState('');
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [recentLocations, setRecentLocations] = useState([]);

  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);
      
      // 讀取手機裡存過的歷史地點
      try {
        const storedLocs = await AsyncStorage.getItem('@recent_locations');
        if (storedLocs) {
          setRecentLocations(JSON.parse(storedLocs));
        }
      } catch (error) {
        console.log("讀取歷史地點失敗", error);
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

  const handleUpload = async () => {
    if (selectedImagesBase64.length === 0 || !uploadTargetSpaceId) return;
    
    setIsUploading(true);
    try {
      const cloudImageUrls = [];
      
      for (const base64 of selectedImagesBase64) {
        const url = await uploadImageToGitHub(base64);
        cloudImageUrls.push(url);
      }
            
      // ✅ 將地點 (location) 一併傳入資料庫
      await addRecordToSpace(uploadTargetSpaceId, cloudImageUrls, note, location);
      
      // ✅ 順便把這次輸入的地點存進歷史紀錄裡 (避免重複)
      if (location.trim()) {
        const updatedLocs = [location.trim(), ...recentLocations.filter(l => l !== location.trim())].slice(0, 10); // 最多存10個
        setRecentLocations(updatedLocs);
        await AsyncStorage.setItem('@recent_locations', JSON.stringify(updatedLocs));
      }

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
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} disabled={isUploading}>
          <Feather name="chevron-left" size={28} color={isUploading ? "#CCC" : "#333"} />
        </TouchableOpacity>
        <Text style={styles.title}>新增紀錄</Text>
        <TouchableOpacity 
          onPress={handleUpload} 
          disabled={selectedImages.length === 0 || isUploading}
        >
          <Text style={[styles.publishBtnText, (selectedImages.length > 0 && !isUploading) ? styles.publishBtnActive : null]}>
            {isUploading ? "發佈中" : "發佈"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

        {/* 📍 地點選擇區塊 */}
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={16} color="#666" />
          <TextInput
            style={styles.locationInput}
            placeholder="輸入地點..."
            placeholderTextColor="#999"
            value={location}
            onChangeText={setLocation}
            editable={!isUploading}
          />
          <TouchableOpacity 
            onPress={() => {
              Keyboard.dismiss();
              setIsLocationModalVisible(true);
            }} 
            style={styles.dropdownBtn}
            disabled={isUploading}
          >
            <Feather name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>

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
        <View style={{ height: keyboardHeight + 20 }} />
      </ScrollView>

      {/* 📍 歷史地點彈出視窗 Modal */}
      <Modal visible={isLocationModalVisible} transparent={true} animationType="fade">
        <View style={styles.centerModalOverlay}>
          <TouchableOpacity style={styles.centerModalBgClose} activeOpacity={1} onPress={() => setIsLocationModalVisible(false)} />
          <View style={styles.centerModalCard}>
            <Text style={styles.centerModalTitle}>選擇去過的地點</Text>
            <ScrollView style={{maxHeight: 250}} showsVerticalScrollIndicator={false}>
              {recentLocations.length > 0 ? (
                recentLocations.map((loc, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.locationOptionBtn} 
                    onPress={() => { 
                      setLocation(loc); 
                      setIsLocationModalVisible(false); 
                    }}
                  >
                    <Feather name="map-pin" size={14} color="#333" style={{marginRight: 10}} />
                    <Text style={styles.locationOptionText}>{loc}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{color: '#999', textAlign: 'center', padding: 20}}>還沒有地點紀錄喔，請直接輸入！</Text>
              )}
            </ScrollView>
          </View>
        </View>
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
  
  // 📍 地點輸入框樣式
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#EAEAEA', marginBottom: 15 },
  locationInput: { flex: 1, fontSize: 16, color: '#333', marginLeft: 10, padding: 0 },
  dropdownBtn: { padding: 5 },

  inputContainer: { marginBottom: 30, borderBottomWidth: 1, borderColor: '#EAEAEA', paddingBottom: 10 },
  textInput: { fontSize: 16, lineHeight: 24, color: '#333', minHeight: 80, textAlignVertical: 'top' },
  
  sectionTitle: { fontSize: 14, color: '#666', marginBottom: 10, fontWeight: '500' },
  spaceSelector: { flexDirection: 'row' },
  spaceChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 10 },
  spaceChipActive: { backgroundColor: '#333', borderColor: '#333' },
  spaceChipText: { color: '#666', fontWeight: '600' },

  // 📍 Modal 樣式
  centerModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerModalBgClose: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)' }, 
  centerModalCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, width: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  centerModalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 15, textAlign: 'center' },
  locationOptionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  locationOptionText: { fontSize: 15, color: '#333' }
});