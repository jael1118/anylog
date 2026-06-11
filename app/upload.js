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

// 🌟 引入全域主題 Context
import { useAppTheme } from './ThemeContext';

const { width: windowWidth } = Dimensions.get('window');

export default function UploadScreen() {
  const router = useRouter();
  
  // 🌟 從全域主題中撈取當前的 theme 設定
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;

  const { currentSpaceId, editRecord: editRecordString } = useLocalSearchParams();
  const editRecord = editRecordString ? JSON.parse(editRecordString) : null;

  const modalMapRef = useRef(null); 
  const searchTimeout = useRef(null); 
  const inputRefs = useRef([]);

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);
  
  const [uploadTargetSpaceIds, setUploadTargetSpaceIds] = useState(currentSpaceId ? [currentSpaceId] : []);
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

  const [selectedMood, setSelectedMood] = useState(null);

  const moodOptions = [
    { id: 0, source: require('../assets/1.jpg') },
    { id: 1, source: require('../assets/2.jpg') },
    { id: 2, source: require('../assets/3.jpg') },
    { id: 3, source: require('../assets/4.jpg') },
    { id: 4, source: require('../assets/5.jpg') },
  ];

  const combinedNote = notes.filter(n => n.trim() !== '').join('\n');
  const hasContent = selectedImages.length > 0 || combinedNote.trim() !== '' || selectedMood !== null;

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
      setUploadTargetSpaceIds([editRecord.spaceId || currentSpaceId]);
      setLocation(editRecord.location || '');
      setLatitude(editRecord.latitude || null);
      setLongitude(editRecord.longitude || null);
      setSelectedPoiName(editRecord.location || null);
      setSelectedMood(editRecord.mood !== undefined ? editRecord.mood : null);
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
      setUploadTargetSpaceIds(prev => {
        const currentArray = Array.isArray(prev) ? prev : (prev ? [prev] : []);
        if (currentArray.length === 0 && spaces.length > 0) {
          return [spaces[0].id];
        }
        return currentArray;
      });
    });
    return () => unsubscribe();
  }, [myUserId]);

  const toggleSpaceSelection = (id) => {
    if (editRecord) {
      Alert.alert("提示", "編輯模式下無法更改或多選發佈空間喔！");
      return;
    }
    setUploadTargetSpaceIds(prev => {
      const currentArray = Array.isArray(prev) ? prev : (prev ? [prev] : []);
      
      if (currentArray.includes(id)) {
        return currentArray.filter(spaceId => spaceId !== id); // 已選就取消
      } else {
        return [...currentArray, id]; // 未選就加入
      }
    });
  };

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
    if (!hasContent || uploadTargetSpaceIds.length === 0) {
      Alert.alert("提示", "請選擇空間再發佈喔！");
      return;
    }
    
    setIsUploading(true);
    try {
      const cloudImageUrls = [];
      let base64Idx = 0;
      
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
      
      // 🌟 提前抓取使用者資料，準備發通知用
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

      if (editRecord) {
        // 【編輯模式】：只針對單一空間更新
        const targetSpaceId = uploadTargetSpaceIds[0];
        await updateRecordInSpace(targetSpaceId, editRecord.id, cloudImageUrls, combinedNote, location, latitude, longitude, selectedMood);
        
        const targetSpace = mySpaces.find(s => s.id === targetSpaceId);
        if (targetSpace && targetSpace.members && targetSpace.members.length > 0) {
          const fakeRecordDataForDetail = {
             id: editRecord.id, spaceId: targetSpaceId, userId: myUserId, imageUrls: cloudImageUrls, note: combinedNote, location: location, latitude: latitude, longitude: longitude, mood: selectedMood !== undefined ? selectedMood : null, createdAt: Date.now()
          };
          await sendNotificationToMembers(targetSpace.members, myUserId, {
            userName: userName, userAvatar: userAvatar, spaceName: targetSpace.name, action: '更新了一篇舊紀錄 📝', recordData: JSON.stringify(fakeRecordDataForDetail) 
          });
        }
      } else {
        // 【新增模式】：迴圈發佈到所有選取的空間
        const { collection, addDoc } = require('firebase/firestore');
        const { db } = require('./firebaseConfig');
        const actionText = selectedImages.length > 0 ? '上傳了一篇新紀錄 📸' : '發表了一則新動態 ✍️';
        
        for (const spaceId of uploadTargetSpaceIds) {
          const newRecordRef = await addDoc(collection(db, "Records"), {
            spaceId: spaceId,
            userId: myUserId || null, 
            imageUrls: cloudImageUrls, 
            note: combinedNote || "",
            location: location || "",
            latitude: latitude !== undefined ? latitude : null,   
            longitude: longitude !== undefined ? longitude : null, 
            mood: selectedMood !== undefined ? selectedMood : null,
            createdAt: Date.now()
          });

          const targetSpace = mySpaces.find(s => s.id === spaceId);
          if (targetSpace && targetSpace.members && targetSpace.members.length > 0) {
            const fakeRecordDataForDetail = {
               id: newRecordRef.id, spaceId: spaceId, userId: myUserId, imageUrls: cloudImageUrls, note: combinedNote, location: location, latitude: latitude, longitude: longitude, mood: selectedMood !== undefined ? selectedMood : null, createdAt: Date.now()
            };
            await sendNotificationToMembers(targetSpace.members, myUserId, {
              userName: userName, userAvatar: userAvatar, spaceName: targetSpace.name, action: actionText, recordData: JSON.stringify(fakeRecordDataForDetail) 
            });
          }
        }
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      
      {/* 頂部導覽 */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomWidth: darkMode ? 0.5 : 0, borderBottomColor: '#2C2C2E' }]}>
        <TouchableOpacity onPress={() => router.back()} disabled={isUploading} style={{ zIndex: 1, padding: 5 }}>
          <Feather name="chevron-left" size={28} color={isUploading ? (darkMode ? "#444" : "#CCC") : theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={[styles.title, { color: theme.text }]}>{editRecord ? "編輯紀錄" : "新增紀錄"}</Text>
        </View>
        <TouchableOpacity onPress={handleUpload} disabled={!hasContent || isUploading} style={{ zIndex: 1, padding: 5 }}>
          <Text style={[styles.publishBtnText, (hasContent && !isUploading) ? (darkMode ? styles.publishBtnActiveDark : styles.publishBtnActive) : null]}>
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
                <Feather name="image" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>

            {selectedImages.length > 1 && (
              <View style={styles.dotsContainer}>
                {selectedImages.map((_, i) => (
                  <View 
                    key={i} 
                    style={[styles.dot, { backgroundColor: i === activeIndex ? (darkMode ? '#666' : '#D9D9D9') : (darkMode ? '#2C2C2E' : '#F0F0F0') }]} 
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={[styles.imageSection, { backgroundColor: darkMode ? '#1E1E1E' : '#D9D9D9' }]} onPress={pickImage}>
            <View style={styles.imageUploadPlaceholder}>
              <Feather name="camera" size={40} color={darkMode ? '#444' : '#999'} />
              <Text style={[styles.imageUploadText, { color: theme.valueText }]}>點擊選擇照片</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.formContainer}>
          <TouchableOpacity 
            style={[styles.locationRow, { borderColor: darkMode ? '#2C2C2E' : '#EAEAEA' }]} 
            onPress={() => setIsMapModalVisible(true)}
            disabled={isUploading}
            activeOpacity={0.7}
          >
            <Feather name="map-pin" size={16} color={theme.text} />
            <Text style={[styles.locationTextDisplay, { color: theme.text }, !location ? { color: theme.valueText } : null]}>
              {location || "選擇紀錄地點..."}
            </Text>
            <Feather name="chevron-right" size={18} color={theme.subText} />
          </TouchableOpacity>

          <View style={[styles.moodSelectorContainer, { borderColor: darkMode ? '#2C2C2E' : '#EAEAEA' }]}>
            <Text style={[styles.moodTitle, { color: theme.subText }]}>今天的心情：</Text>
            <View style={styles.moodIconsWrapper}>
              {moodOptions.map((mood) => {
                const isSelected = selectedMood === mood.id;
                return (
                  <TouchableOpacity
                    key={mood.id}
                    onPress={() => setSelectedMood(isSelected ? null : mood.id)}
                    activeOpacity={0.6}
                  >
                    <Image 
                      source={mood.source} 
                      style={[
                        styles.moodIconImage,
                        { 
                          opacity: isSelected ? 1 : (darkMode ? 0.2 : 0.3),
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

          <View style={[styles.inputContainer, { borderColor: darkMode ? '#2C2C2E' : '#EAEAEA' }]}>
            {notes.map((noteText, index) => (
              <TextInput
                key={index}
                ref={el => inputRefs.current[index] = el} 
                style={[styles.dynamicTextInput, { color: theme.text }]}
                placeholder={index === 0 && notes.length === 1 ? "寫點什麼紀錄這刻..." : ""}
                placeholderTextColor={darkMode ? "#444" : "#999"}
                value={noteText}
                onChangeText={(text) => handleNoteChange(text, index)}
                // 🌟 加碼這兩行：讓長句子可以自然往下換行，不會跑到螢幕外面！
                multiline={true} 
                scrollEnabled={false}
                
                onSubmitEditing={() => handleNoteSubmit(index)} 
                onKeyPress={(e) => handleNoteKeyPress(e, index)} 
                blurOnSubmit={false} 
                editable={!isUploading}
                returnKeyType="next"
              />
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.subText }]}>發佈至空間：</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spaceSelector}>
            {mySpaces.map(space => {
              // 🌟 判斷此空間是否在陣列中
              const isSelected = uploadTargetSpaceIds.includes(space.id);
              
              return (
                <TouchableOpacity 
                  key={space.id}
                  style={[
                    styles.spaceChip, 
                    { borderColor: darkMode ? '#333' : '#E0E0E0', backgroundColor: darkMode ? '#1E1E1E' : 'transparent' },
                    isSelected && (darkMode ? styles.spaceChipActiveDark : styles.spaceChipActive)
                  ]}
                  // 🌟 點擊觸發多選函式
                  onPress={() => toggleSpaceSelection(space.id)}
                  disabled={isUploading || editRecord !== null} 
                >
                  <Text style={[styles.spaceChipText, { color: theme.subText }, isSelected && { color: darkMode ? '#000' : '#FFF' }]}>
                    {space.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <View style={{ height: 60 }} />
        </View>

      </KeyboardAwareScrollView>

      {/* 地圖選點 Modal */}
      <Modal visible={isMapModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
          
          <View style={[styles.modalHeader, { backgroundColor: theme.bg, borderColor: darkMode ? '#2C2C2E' : '#F0F0F0' }]}>
            <TouchableOpacity onPress={() => { setIsMapModalVisible(false); setSearchResults([]); }} style={{ zIndex: 1, padding: 5 }}>
              <Feather name="x" size={24} color={theme.text} />
            </TouchableOpacity>
            
            <View style={styles.modalTitleContainer} pointerEvents="none">
              <Text style={[styles.modalTitle, { color: theme.text }]}>移動地圖選點</Text>
            </View>

            <TouchableOpacity style={[styles.modalConfirmBtn, { zIndex: 1, backgroundColor: theme.saveBtnBg }]} onPress={handleConfirmLocation}>
              <Text style={[styles.modalConfirmBtnText, { color: theme.saveBtnText }]}>確定</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.mapSearchBox, { backgroundColor: darkMode ? '#1E1E1E' : '#F5F5F5' }]}>
            <TextInput
              style={[styles.mapSearchInput, { color: theme.text }]}
              placeholder="搜尋想去的地點或景點..."
              placeholderTextColor={darkMode ? '#555' : '#999'}
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
              <Feather name={searchQuery.length > 0 ? "x-circle" : "search"} size={18} color={darkMode ? '#555' : '#999'} />
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
              <View style={[styles.searchResultsContainer, { backgroundColor: theme.modalBg, borderColor: darkMode ? '#333' : '#EAEAEA' }]}>
                <ScrollView keyboardShouldPersistTaps="handled">
                  {searchResults.map((item, index) => {
                    const shortName = item.name || item.display_name.split(',')[0].trim();
                    return (
                      <TouchableOpacity 
                        key={index} 
                        style={[styles.searchResultItem, { borderBottomColor: darkMode ? '#2C2C2E' : '#F5F5F5' }]}
                        onPress={() => handleSelectResult(item)}
                      >
                        <Feather name="map-pin" size={14} color={theme.subText} style={{ marginRight: 10 }} />
                        <Text style={[styles.searchResultText, { color: theme.subText }]} numberOfLines={2}>
                          <Text style={{ fontWeight: 'bold', color: theme.text }}>{shortName}</Text>
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
              userInterfaceStyle={darkMode ? 'dark' : 'light'}
              onRegionChangeComplete={(region) => setMapCenter(region)}
              onPanDrag={() => setSelectedPoiName(null)} 
              onPress={() => {
                Keyboard.dismiss();
                setSearchResults([]);
              }} 
            />

            <View style={styles.centerPinContainer} pointerEvents="none">
              <Feather name="map-pin" size={36} color={darkMode ? '#FFF' : '#333'} />
              <View style={styles.centerPinShadow} />
            </View>
          </View>

        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60 },
  headerTitleContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  title: { fontSize: 18, fontWeight: '600' },
  publishBtnText: { fontSize: 16, fontWeight: '600', color: '#CCC' },
  publishBtnActive: { color: '#007AFF' },
  publishBtnActiveDark: { color: '#FFFFFF' }, // 🌟 深色模式下啟動時發佈按鈕變為純白
  content: { flex: 1 }, 
  imageSection: { width: windowWidth, height: windowWidth },
  mainImage: { width: windowWidth, height: windowWidth },
  imageUploadPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  imageUploadText: { marginTop: 10, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  floatingReselectBtn: { position: 'absolute', bottom: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, marginBottom: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  formContainer: { paddingHorizontal: 20, paddingTop: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, marginBottom: 15 },
  locationTextDisplay: { flex: 1, fontSize: 16, marginLeft: 12 },
  inputContainer: { marginBottom: 30, borderBottomWidth: 1, paddingBottom: 10 },
  dynamicTextInput: { fontSize: 16, minHeight: 28, paddingVertical: 8, marginBottom: 2 },
  sectionTitle: { fontSize: 14, marginBottom: 10, fontWeight: '500' },
  spaceSelector: { flexDirection: 'row' },
  spaceChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 10 },
  spaceChipActive: { backgroundColor: '#111111', borderColor: '#111111' },
  spaceChipActiveDark: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }, // 🌟 深色模式下選取的膠囊底色變純白
  spaceChipText: { fontWeight: '600' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 55, borderBottomWidth: 1 },
  modalTitleContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  modalTitle: { fontSize: 16, fontWeight: '600' },
  modalConfirmBtn: { paddingHorizontal: 15, paddingVertical: 6, borderRadius: 15 },
  modalConfirmBtnText: { fontSize: 13, fontWeight: '600' },
  mapSearchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, margin: 12, paddingHorizontal: 12, height: 44 },
  mapSearchInput: { flex: 1, fontSize: 15, padding: 0 },
  mapSearchIcon: { padding: 5 },
  centerPinContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  centerPinShadow: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: -2 },
  searchOverlayMask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 998 },
  searchResultsContainer: { position: 'absolute', top: 5, left: 12, right: 12, borderRadius: 10, maxHeight: 250, zIndex: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, borderWidth: 1 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  searchResultText: { fontSize: 13, flex: 1, lineHeight: 20 },
  moodSelectorContainer: { 
    marginBottom: 20, 
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  moodTitle: {
    fontSize: 14, 
    marginBottom: 12, 
    fontWeight: '500'
  },
  moodIconsWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  moodIconImage: {
    width: 40,  
    height: 40,
  },
});