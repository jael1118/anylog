import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  TextInput, Image, Alert, StatusBar, Modal, Keyboard, Platform,
  Dimensions, FlatList, ScrollView 
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import MapView from 'react-native-maps'; 
import * as Location from 'expo-location'; 

import { 
  subscribeToUserSpaces, addRecordToSpace, uploadImageToGitHub, sendNotificationToMembers,
  updateRecordInSpace, getUserProfile 
} from './firebaseServices'; 

const { width: windowWidth } = Dimensions.get('window');

export default function UploadScreen() {
  const router = useRouter();
  
  const { currentSpaceId, editRecord: editRecordString } = useLocalSearchParams();
  const editRecord = editRecordString ? JSON.parse(editRecordString) : null;

  const modalMapRef = useRef(null); 
  const searchTimeout = useRef(null); 
  const inputRefs = useRef([]);

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);
  
  const [uploadTargetSpaceId, setUploadTargetSpaceId] = useState(currentSpaceId || null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImagesBase64, setSelectedImagesBase64] = useState([]);
  const [notes, setNotes] = useState(['']); 
  const [isUploading, setIsUploading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPoiName, setSelectedPoiName] = useState(null);

  const [mapCenter, setMapCenter] = useState({
    latitude: 25.0330,
    longitude: 121.5654,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01
  });

  // 加上這行：用來記錄選中的心情 (0~4 代表 5 個表情，null 代表沒選)
  const [selectedMood, setSelectedMood] = useState(null);

  // 定義你的 5 張心情圖片 (⚠️ 請確認你的圖片名稱和路徑是對的，如果是放在 assets 裡的話)
  const moodOptions = [
    { id: 0, source: require('../assets/1.jpg') },
    { id: 1, source: require('../assets/2.jpg') },
    { id: 2, source: require('../assets/3.jpg') },
    { id: 3, source: require('../assets/4.jpg') },
    { id: 4, source: require('../assets/5.jpg') },
  ];

  // ✅ 檢查目前欄位是否有任何內容 (有照片 OR 有打字)
  const combinedNote = notes.filter(n => n.trim() !== '').join('\n');
  const hasContent = selectedImages.length > 0 || combinedNote.trim() !== ''|| selectedMood !== null;

  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);

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
    if (editRecord) {
      setUploadTargetSpaceId(editRecord.spaceId || currentSpaceId);
      setLocation(editRecord.location || '');
      setLatitude(editRecord.latitude || null);
      setLongitude(editRecord.longitude || null);
      setSelectedPoiName(editRecord.location || null);
      
      if (editRecord.note) {
        setNotes([...editRecord.note.split('\n'), '']);
      }
      if (editRecord.latitude && editRecord.longitude) {
        const coords = {
          latitude: editRecord.latitude,
          longitude: editRecord.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008
        };
        setMapCenter(coords);
      }
      
      const remoteImages = editRecord.imageUrls || (editRecord.imageUrl ? [editRecord.imageUrl] : []);
      setSelectedImages(remoteImages);
    }
  }, [editRecordString]);

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
      setActiveIndex(0); 
    }
  };

  const handleSearchInputChange = (text) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5`);
        const data = await res.json();
        if (data && data.length > 0) {
          setSearchResults(data);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.log("即時搜尋失敗", error);
      }
    }, 500);
  };

  const handleSelectResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const shortName = item.name || item.display_name.split(',')[0].trim();
    
    Keyboard.dismiss(); 
    setSearchResults([]); 
    setSelectedPoiName(shortName); 

    modalMapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005
    }, 800);

    setMapCenter({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005
    });
  };

  const handleConfirmLocation = async () => {
    try {
      const targetLat = mapCenter.latitude;
      const targetLng = mapCenter.longitude;
      
      setLatitude(targetLat);
      setLongitude(targetLng);

      if (selectedPoiName) {
        setLocation(selectedPoiName);
        setIsMapModalVisible(false);
        return;
      }

      const response = await Location.reverseGeocodeAsync({ latitude: targetLat, longitude: targetLng });
      if (response.length > 0) {
        const place = response[0];
        let placeName = place.name;
        if (!placeName || placeName === place.street || placeName === `${place.streetNumber} ${place.street}`) {
            placeName = `${place.street || ''}${place.streetNumber || ''}`;
        }
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
    // ✅ 修正限制：只要有內容 (照片或文字選一) 且有選擇空間，就可以發佈
    if (!hasContent || !uploadTargetSpaceId) {
      Alert.alert("提示", "請輸入文字或選擇照片再發佈喔！");
      return;
    }
    
    setIsUploading(true);
    try {
      const cloudImageUrls = [];
      let base64Idx = 0;
      
      // 如果有選擇照片才跑上傳圖床迴圈
      if (selectedImages.length > 0) {
        for (const uri of selectedImages) {
          if (uri.startsWith('http')) {
            cloudImageUrls.push(uri);
          } else {
            const base64 = selectedImagesBase64[base64Idx++];
            if (base64) {
              const url = await uploadImageToGitHub(base64);
              cloudImageUrls.push(url);
            }
          }
        }
      }
      
      const combinedNote = notes.filter(n => n.trim() !== '').join('\n');
            
      if (editRecord) {
        await updateRecordInSpace(uploadTargetSpaceId, editRecord.id, cloudImageUrls, combinedNote, location, latitude, longitude, selectedMood);
      } else {
        await addRecordToSpace(uploadTargetSpaceId, cloudImageUrls, combinedNote, location, latitude, longitude, myUserId, selectedMood);
      }
      
      const targetSpace = mySpaces.find(s => s.id === uploadTargetSpaceId);
      if (targetSpace && targetSpace.members && targetSpace.members.length > 0) {
        let userName = '神祕成員';
        let userAvatar = null;
        
        try {
          const profile = await getUserProfile(myUserId);
          if (profile) {
            userName = profile.name || userName;
            userAvatar = profile.avatarUrl || userAvatar;
          }
        } catch (pError) {
          console.log("發送通知前抓取個人檔案失敗:", pError);
        }

        // ✅ 精細化通知文字：區分「新紀錄」、「純文字動態」、「更新」
        let actionText = '';
        if (editRecord) {
          actionText = '更新了一篇舊紀錄 📝';
        } else {
          actionText = selectedImages.length > 0 ? '上傳了一篇新紀錄 📸' : '發表了一則純文字心情 ✍️';
        }

        await sendNotificationToMembers(
          targetSpace.members, 
          myUserId, 
          {
            userName: userName,
            userAvatar: userAvatar,
            spaceName: targetSpace.name,
            action: actionText
          }
        );
      }

      Alert.alert("成功", editRecord ? "紀錄已更新！" : "紀錄已發佈！", [
        { text: "OK", onPress: () => router.back() } 
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert("失敗", `操作失敗：\n${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleNoteChange = (text, index) => {
    const newNotes = [...notes];
    newNotes[index] = text;
    if (index === newNotes.length - 1 && text.trim() !== '') {
      newNotes.push('');
    }
    setNotes(newNotes);
  };

  const handleNoteSubmit = (index) => {
    if (inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleNoteKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && notes[index] === '') {
      if (index > 0) {
        const newNotes = [...notes];
        newNotes.splice(index, 1);
        setNotes(newNotes);
        
        setTimeout(() => {
          if (inputRefs.current[index - 1]) {
            inputRefs.current[index - 1].focus();
          }
        }, 50);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* 頂部導覽 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} disabled={isUploading} style={{ zIndex: 1, padding: 5 }}>
          <Feather name="chevron-left" size={28} color={isUploading ? "#CCC" : "#333"} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={styles.title}>{editRecord ? "編輯紀錄" : "新增紀錄"}</Text>
        </View>
        {/* ✅ 按鈕啟用邏輯修改：只要有內容 (hasContent) 且沒在儲存中，就亮起藍色並可點擊 */}
        <TouchableOpacity onPress={handleUpload} disabled={!hasContent || isUploading} style={{ zIndex: 1, padding: 5 }}>
          <Text style={[styles.publishBtnText, (hasContent && !isUploading) ? styles.publishBtnActive : null]}>
            {isUploading ? "處理中" : (editRecord ? "儲存" : "發佈")}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}              
        enableAutomaticScroll={true}        
        extraScrollHeight={140}             
      >
        
        {selectedImages.length > 0 ? (
          <View>
            <View style={styles.imageSection}>
              <FlatList
                data={selectedImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const offset = e.nativeEvent.contentOffset.x;
                  setActiveIndex(Math.round(offset / windowWidth));
                }}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.mainImage} resizeMode="cover" />
                )}
                keyExtractor={(item, index) => index.toString()}
              />
              <TouchableOpacity style={styles.floatingReselectBtn} onPress={pickImage} disabled={isUploading}>
                <Feather name="refresh-cw" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedImages.length > 1 && (
              <View style={styles.dotsContainer}>
                {selectedImages.map((_, i) => (
                  <View 
                    key={i} 
                    style={[styles.dot, { backgroundColor: i === activeIndex ? '#D9D9D9' : '#F0F0F0' }]} 
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          /* ✅ 修改相機預設區塊：微調提示文字，讓使用者知道「不選照片也可以」 */
          <TouchableOpacity style={styles.imageSection} onPress={pickImage}>
            <View style={styles.imageUploadPlaceholder}>
              <Feather name="camera" size={40} color="#999" />
              <Text style={styles.imageUploadText}>點擊選擇照片</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.formContainer}>
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

          <View style={styles.moodSelectorContainer}>
            <Text style={styles.moodTitle}>今天的心情：</Text>
            <View style={styles.moodIconsWrapper}>
              {moodOptions.map((mood) => {
                const isSelected = selectedMood === mood.id;
                return (
                  <TouchableOpacity
                    key={mood.id}
                    onPress={() => setSelectedMood(isSelected ? null : mood.id)} // 點選中，再點一次可取消
                    activeOpacity={0.6}
                  >
                    <Image 
                      source={mood.source} 
                      style={[
                        styles.moodIconImage,
                        // 如果沒被選中，就變半透明；選中的話就恢復 100% 顯示，並加上一點點放大效果
                        { 
                          opacity: isSelected ? 1 : 0.3,
                          transform: [{ scale: isSelected ? 1.1 : 1 }]
                        }
                      ]} 
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.inputContainer}>
            {notes.map((noteText, index) => (
              <TextInput
                key={index}
                ref={el => inputRefs.current[index] = el} 
                style={styles.dynamicTextInput}
                placeholder={index === 0 && notes.length === 1 ? "寫點什麼紀錄這刻..." : ""}
                placeholderTextColor="#999"
                value={noteText}
                onChangeText={(text) => handleNoteChange(text, index)}
                onSubmitEditing={() => handleNoteSubmit(index)} 
                onKeyPress={(e) => handleNoteKeyPress(e, index)} 
                blurOnSubmit={false} 
                editable={!isUploading}
                returnKeyType="next"
              />
            ))}
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
          <View style={{ height: 60 }} />
        </View>

      </KeyboardAwareScrollView>

      {/* 地圖選點 Modal */}
      <Modal visible={isMapModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
          
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setIsMapModalVisible(false); setSearchResults([]); }} style={{ zIndex: 1, padding: 5 }}>
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
            
            <View style={styles.modalTitleContainer} pointerEvents="none">
              <Text style={styles.modalTitle}>移動地圖選點</Text>
            </View>

            <TouchableOpacity style={[styles.modalConfirmBtn, { zIndex: 1 }]} onPress={handleConfirmLocation}>
              <Text style={styles.modalConfirmBtnText}>確定</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapSearchBox}>
            <TextInput
              style={styles.mapSearchInput}
              placeholder="搜尋想去的地點或景點..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={handleSearchInputChange} 
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()} 
            />
            <TouchableOpacity 
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                Keyboard.dismiss();
              }} 
              style={styles.mapSearchIcon}
            >
              <Feather name={searchQuery.length > 0 ? "x-circle" : "search"} size={18} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, position: 'relative' }}>
            
            {searchResults.length > 0 && (
              <TouchableOpacity 
                style={styles.searchOverlayMask} 
                activeOpacity={1} 
                onPress={() => {
                  Keyboard.dismiss();
                  setSearchResults([]);
                }} 
              />
            )}

            {searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  {searchResults.map((item, index) => {
                    const shortName = item.name || item.display_name.split(',')[0].trim();
                    return (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.searchResultItem}
                        onPress={() => handleSelectResult(item)}
                      >
                        <Feather name="map-pin" size={14} color="#666" style={{ marginRight: 10 }} />
                        <Text style={styles.searchResultText} numberOfLines={2}>
                          <Text style={{ fontWeight: 'bold' }}>{shortName}</Text>
                          {`\n${item.display_name}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <MapView
              ref={modalMapRef}
              style={{ width: '100%', height: '100%' }}
              initialRegion={mapCenter}
              showsUserLocation={true}
              onRegionChangeComplete={(region) => setMapCenter(region)}
              onPanDrag={() => setSelectedPoiName(null)} 
              onPress={() => {
                Keyboard.dismiss();
                setSearchResults([]);
              }} 
            />

            <View style={styles.centerPinContainer} pointerEvents="none">
              <Feather name="map-pin" size={36} color="#333" />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, backgroundColor: '#FFF' },
  headerTitleContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  title: { fontSize: 18, fontWeight: '600', color: '#333' },
  publishBtnText: { fontSize: 16, fontWeight: '600', color: '#CCC' },
  publishBtnActive: { color: '#007AFF' },
  content: { flex: 1 }, 
  imageSection: { width: windowWidth, height: windowWidth, backgroundColor: '#D9D9D9' },
  mainImage: { width: windowWidth, height: windowWidth },
  imageUploadPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  imageUploadText: { color: '#999', marginTop: 10, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  floatingReselectBtn: { position: 'absolute', bottom: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, marginBottom: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  formContainer: { paddingHorizontal: 20, paddingTop: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#EAEAEA', marginBottom: 15 },
  locationTextDisplay: { flex: 1, fontSize: 16, color: '#333', marginLeft: 12 },
  inputContainer: { marginBottom: 30, borderBottomWidth: 1, borderColor: '#EAEAEA', paddingBottom: 10 },
  dynamicTextInput: { fontSize: 16, lineHeight: 28, color: '#333', minHeight: 28, textAlignVertical: 'center', marginBottom: 2 },
  sectionTitle: { fontSize: 14, color: '#666', marginBottom: 10, fontWeight: '500' },
  spaceSelector: { flexDirection: 'row' },
  spaceChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 10 },
  spaceChipActive: { backgroundColor: '#333', borderColor: '#333' },
  spaceChipText: { color: '#666', fontWeight: '600' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 55, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  modalTitleContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  modalConfirmBtn: { backgroundColor: '#333', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 15 },
  modalConfirmBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  mapSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 10, margin: 12, paddingHorizontal: 12, height: 44 },
  mapSearchInput: { flex: 1, fontSize: 15, color: '#333', padding: 0 },
  mapSearchIcon: { padding: 5 },
  centerPinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  centerPinShadow: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: -2 },
  searchOverlayMask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 998 },
  searchResultsContainer: { position: 'absolute', top: 5, left: 12, right: 12, backgroundColor: '#FFFFFF', borderRadius: 10, maxHeight: 250, zIndex: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, borderWidth: 1, borderColor: '#EAEAEA' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  searchResultText: { fontSize: 13, color: '#666', flex: 1, lineHeight: 20 },
  // 🌟 心情選擇列的樣式
  moodSelectorContainer: { 
    marginBottom: 20, // 跟下面的內文保持一點距離
    paddingVertical: 10,
    borderBottomWidth: 1, 
    borderColor: '#EAEAEA'
  },
  moodTitle: {
    fontSize: 14, 
    color: '#666', 
    marginBottom: 12, 
    fontWeight: '500'
  },
  moodIconsWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between', // 讓五個表情平均分散
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  moodIconImage: {
    width: 40,  // 設定表情圖片的大小，你可以依據你畫的圖調整
    height: 40,
  },
});