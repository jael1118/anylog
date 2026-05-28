import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  TextInput, Image, Alert, ScrollView, StatusBar, Modal, Keyboard, Platform,
  Dimensions, FlatList
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import MapView from 'react-native-maps'; 
import * as Location from 'expo-location'; 

import { 
  subscribeToUserSpaces, addRecordToSpace, uploadImageToGitHub,
  updateRecordInSpace // ✅ 確保你的 firebaseServices 有提供或可呼叫更新特性的方法
} from './firebaseServices'; 

const { width: windowWidth } = Dimensions.get('window');

export default function UploadScreen() {
  const router = useRouter();
  
  // ✅ 接收從 detail 頁面傳過來的編輯資料
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

  // ✅ 新增：如果是「編輯模式」，一進來就把舊資料全部填入對應的 State
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

  // ✅ 修改：支援資料更新的上傳邏輯
  const handleUpload = async () => {
    if (selectedImages.length === 0 || !uploadTargetSpaceId) return;
    
    setIsUploading(true);
    try {
      const cloudImageUrls = [];
      let base64Idx = 0;
      
      // 💡 智慧防呆過濾：如果是原本就在 GitHub 上的網址(http開頭)，直接保留；如果是本機選的新照片，才轉 base64 上傳！
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
      
      const combinedNote = notes.filter(n => n.trim() !== '').join('\n');
            
      if (editRecord) {
        // 📝 模式 A：編輯更新舊資料
        await updateRecordInSpace(uploadTargetSpaceId, editRecord.id, cloudImageUrls, combinedNote, location, latitude, longitude);
      } else {
        // 🚀 模式 B：發佈全新資料
        await addRecordToSpace(uploadTargetSpaceId, cloudImageUrls, combinedNote, location, latitude, longitude);
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
          {/* ✅ 標題自動跟著模式更換 */}
          <Text style={styles.title}>{editRecord ? "編輯紀錄" : "新增紀錄"}</Text>
        </View>
        <TouchableOpacity onPress={handleUpload} disabled={selectedImages.length === 0 || isUploading} style={{ zIndex: 1, padding: 5 }}>
          <Text style={[styles.publishBtnText, (selectedImages.length > 0 && !isUploading) ? styles.publishBtnActive : null]}>
            {isUploading ? "處理中" : (editRecord ? "儲存" : "發佈")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
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
          <TouchableOpacity style={styles.imageSection} onPress={pickImage}>
            <View style={styles.imageUploadPlaceholder}>
              <Feather name="camera" size={40} color="#999" />
              <Text style={styles.imageUploadText}>點擊選擇照片 (最多 10 張)</Text>
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

      </ScrollView>

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
  
  imageUploadPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageUploadText: { color: '#999', marginTop: 10, fontSize: 16 },

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
  
  searchResultsContainer: { 
    position: 'absolute', 
    top: 5, 
    left: 12, 
    right: 12, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    maxHeight: 250, 
    zIndex: 999, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 8, 
    elevation: 5,
    borderWidth: 1,
    borderColor: '#EAEAEA'
  },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  searchResultText: { fontSize: 13, color: '#666', flex: 1, lineHeight: 20 }
});