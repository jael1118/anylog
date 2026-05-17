import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Dimensions, StatusBar, Modal, TextInput, Image, Alert, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { 
  joinSpaceByCode, subscribeToSpaceRecords, createNewSpace, 
  subscribeToUserSpaces, addRecordToSpace, uploadImageToGitHub 
} from './firebaseServices'; 

const windowWidth = Dimensions.get('window').width;
const numColumns = 3;
const imageSize = (windowWidth - (numColumns - 1) * 2) / numColumns;

const SpaceActionModal = ({ visible, onClose, onJoin, onCreate }) => {
  const [mode, setMode] = useState('options'); 
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (visible) { setMode('options'); setInputValue(''); }
  }, [visible]);

  const handleConfirm = () => {
    if (mode === 'join') onJoin(inputValue);
    if (mode === 'create') onCreate(inputValue);
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => mode === 'options' ? onClose() : setMode('options')}>
              <Feather name={mode === 'options' ? "x" : "arrow-left"} size={24} color="black" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {mode === 'options' ? '空間管理' : mode === 'join' ? '加入空間' : '創建新空間'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {mode === 'options' && (
            <View>
              <TouchableOpacity style={styles.optionBtn} onPress={() => setMode('create')}>
                <Feather name="plus-circle" size={20} color="black" />
                <Text style={styles.optionBtnText}>創建新空間</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionBtn} onPress={() => setMode('join')}>
                <Feather name="log-in" size={20} color="black" />
                <Text style={styles.optionBtnText}>輸入邀請碼加入</Text>
              </TouchableOpacity>
            </View>
          )}

          {(mode === 'join' || mode === 'create') && (
            <View>
              <Text style={styles.modalSubtitle}>
                {mode === 'join' ? '請輸入朋友分享給您的 6 碼邀請碼' : '請為您的新紀錄空間取個名字'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={mode === 'join' ? "例如: A7X9WQ" : "例如: 我們的咖啡廳地圖"}
                placeholderTextColor="#CCC"
                value={inputValue}
                onChangeText={setInputValue}
                autoCapitalize={mode === 'join' ? "characters" : "none"}
                maxLength={mode === 'join' ? 6 : 20}
              />
              <TouchableOpacity 
                style={[styles.joinBtn, inputValue.trim().length > 0 ? styles.joinBtnActive : null]} 
                disabled={inputValue.trim().length === 0 || (mode === 'join' && inputValue.length !== 6)}
                onPress={handleConfirm}
              >
                <Text style={styles.joinBtnText}>確認</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default function App() {
  const [myUserId, setMyUserId] = useState(null); 
  const [records, setRecords] = useState([]);
  const [mySpaces, setMySpaces] = useState([]);
  const [currentSpaceId, setCurrentSpaceId] = useState(null); 
  const [currentSpaceName, setCurrentSpaceName] = useState("選擇空間");
  
  const [isSpaceActionVisible, setIsSpaceActionVisible] = useState(false);
  const [isSpaceSwitcherVisible, setIsSpaceSwitcherVisible] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  
  // ✅ 改為陣列來存放多張圖片
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImagesBase64, setSelectedImagesBase64] = useState([]);
  const [uploadTargetSpaceId, setUploadTargetSpaceId] = useState(null); 
  // ✅ 新增上傳狀態，用來鎖定按鈕避免重複點擊
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        let storedId = await AsyncStorage.getItem('@my_device_user_id');
        if (!storedId) {
          const randomString = Math.random().toString(36).substring(2, 10);
          storedId = `user_${Date.now()}_${randomString}`;
          await AsyncStorage.setItem('@my_device_user_id', storedId);
        }
        setMyUserId(storedId);
      } catch (e) {
        console.error("讀取身分失敗:", e);
      }
    };
    initializeUser();
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (spaces) => {
      setMySpaces(spaces);
      if (!currentSpaceId && spaces.length > 0) {
        setCurrentSpaceId(spaces[0].id);
        setCurrentSpaceName(spaces[0].name);
      }
    });
    return () => unsubscribe();
  }, [myUserId, currentSpaceId]);

  useEffect(() => {
    if (!currentSpaceId) {
      setRecords([]);
      return;
    }
    const unsubscribe = subscribeToSpaceRecords(currentSpaceId, (data) => {
      const sortedData = data.sort((a, b) => b.createdAt - a.createdAt);
      setRecords(sortedData);
    });
    return () => unsubscribe();
  }, [currentSpaceId]);

  const handleJoinSpace = async (code) => {
    if (!myUserId) return;
    const result = await joinSpaceByCode(code, myUserId);
    if (result) {
      setCurrentSpaceId(result.spaceId);
      setCurrentSpaceName(result.name);
      Alert.alert("成功加入", `已成功加入 ${result.name}`);
    }
  };

  const handleCreateSpace = async (name) => {
    if (!myUserId) return;
    const result = await createNewSpace(name, myUserId);
    if (result) {
      setCurrentSpaceId(result.spaceId);
      setCurrentSpaceName(result.name);
      Alert.alert("創建成功！", `邀請碼為：${result.inviteCode}\n快把代碼分享給朋友吧！`);
    }
  };

  // ✅ 支援多選圖片
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // ⚠️ 開啟多選時，通常需關閉編輯裁切功能
      allowsMultipleSelection: true,
      selectionLimit: 10, // 像 IG 一樣最多選 10 張
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      // 提取所有選擇的圖片路徑和 Base64 代碼
      const uris = result.assets.map(asset => asset.uri);
      const base64s = result.assets.map(asset => asset.base64);
      setSelectedImages(uris); 
      setSelectedImagesBase64(base64s); 
    }
  };

  // ✅ 支援多圖上傳
  const handleUpload = async () => {
    if (selectedImagesBase64.length === 0 || !uploadTargetSpaceId) return;
    
    setIsUploading(true);
    try {
      console.log(`準備上傳 ${selectedImagesBase64.length} 張圖片到 GitHub...`); 
      
      // 使用 Promise.all 同時發送多個上傳請求
      const uploadPromises = selectedImagesBase64.map(base64 => uploadImageToGitHub(base64));
      const cloudImageUrls = await Promise.all(uploadPromises);
            
      // 將拿到的多個網址陣列存入資料庫
      await addRecordToSpace(uploadTargetSpaceId, cloudImageUrls);
      
      if (uploadTargetSpaceId !== currentSpaceId) {
        Alert.alert("上傳成功", "已發佈到其他空間！");
      } else {
        Alert.alert("成功", "紀錄已發佈！");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("失敗", "上傳照片時發生錯誤，請看終端機");
    } finally {
      setIsUploading(false);
      setIsUploadModalVisible(false);
      setSelectedImages([]);
      setSelectedImagesBase64([]);
    }
  };

  const openUploadModal = () => {
    if (mySpaces.length === 0) {
      Alert.alert("提示", "請先創建或加入一個空間再新增紀錄！");
      return;
    }
    setUploadTargetSpaceId(currentSpaceId);
    setSelectedImages([]);
    setSelectedImagesBase64([]);
    setIsUploadModalVisible(true);
  };

  // ✅ 網格渲染（支援舊單圖與新多圖）
  const renderItem = ({ item }) => {
    // 判斷是新版的多圖陣列，還是舊版的單圖字串
    const firstImage = item.imageUrls ? item.imageUrls[0] : item.imageUrl;
    const isMultiple = item.imageUrls && item.imageUrls.length > 1;

    return (
      <View style={styles.imageGrid}>
        {firstImage ? (
          <>
            <Image source={{ uri: firstImage }} style={styles.recordImage} resizeMode="cover" />
            {/* 如果有多張圖片，在右上角顯示疊圖小圖示 */}
            {isMultiple && (
              <View style={styles.multipleIcon}>
                <Feather name="layers" size={14} color="white" />
              </View>
            )}
          </>
        ) : (
          <View style={styles.placeholderGrid} />
        )}
      </View>
    );
  };

  if (!myUserId) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <SpaceActionModal 
        visible={isSpaceActionVisible} 
        onClose={() => setIsSpaceActionVisible(false)} 
        onJoin={handleJoinSpace} 
        onCreate={handleCreateSpace}
      />

      {/* 切換空間 Modal */}
      <Modal visible={isSpaceSwitcherVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>切換空間</Text>
              <TouchableOpacity onPress={() => setIsSpaceSwitcherVisible(false)}>
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {mySpaces.map(space => (
                <TouchableOpacity 
                  key={space.id} 
                  style={[styles.spaceListItem, currentSpaceId === space.id && styles.spaceListActive]}
                  onPress={() => {
                    setCurrentSpaceId(space.id);
                    setCurrentSpaceName(space.name);
                    setIsSpaceSwitcherVisible(false);
                  }}
                >
                  <Text style={[styles.spaceListText, currentSpaceId === space.id && {color: 'white'}]}>
                    {space.name}
                  </Text>
                  {currentSpaceId === space.id && <Feather name="check" size={20} color="white" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 上傳紀錄 Modal */}
      <Modal visible={isUploadModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>新增紀錄</Text>
              <TouchableOpacity onPress={() => setIsUploadModalVisible(false)} disabled={isUploading}>
                <Feather name="x" size={24} color={isUploading ? "#CCC" : "black"} />
              </TouchableOpacity>
            </View>

            {/* ✅ 多圖預覽區塊 */}
            {selectedImages.length > 0 ? (
              <View style={styles.previewContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
                  {selectedImages.map((uri, index) => (
                    <Image key={index} source={{ uri }} style={styles.previewImageMulti} />
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.reselectBtn} onPress={pickImage} disabled={isUploading}>
                  <Feather name="refresh-cw" size={14} color="#666" />
                  <Text style={styles.reselectText}>重新選擇</Text>
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

            <Text style={styles.modalSubtitle}>選擇要發佈的空間：</Text>
            
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

            <TouchableOpacity 
              style={[styles.joinBtn, selectedImages.length > 0 && !isUploading ? styles.joinBtnActive : null]} 
              disabled={selectedImages.length === 0 || isUploading}
              onPress={handleUpload}
            >
              <Text style={styles.joinBtnText}>
                {isUploading ? "圖片上傳中..." : "發佈"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 頂部 Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.categorySelector} onPress={() => setIsSpaceSwitcherVisible(true)}>
            <Text style={styles.categoryText} numberOfLines={1}>{currentSpaceName}</Text>
            <Feather name="chevron-down" size={18} color="#333" />
          </TouchableOpacity>

          <View style={styles.friendsContainer}>
            <View style={[styles.avatar, { zIndex: 3 }]} />
            <View style={[styles.avatar, { zIndex: 2, marginLeft: -12, backgroundColor: '#D9D9D9' }]} />
            <TouchableOpacity style={styles.addFriendBtn} onPress={() => setIsSpaceActionVisible(true)}>
              <Feather name="plus" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconCircleBtn}>
            <Feather name="edit-2" size={18} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircleBtn}>
            <Feather name="search" size={18} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 預留給背景圖的大片留白 */}
      <View style={styles.topBlankSpace} />

      {/* 內容區塊 (白色底) */}
      <View style={styles.contentWrapper}>
        <View style={styles.contentHeader}>
          <Text style={styles.dateText}>2026.03</Text>
          <Text style={styles.titleText}>{currentSpaceName}</Text>
        </View>

        <FlatList
          data={records}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Feather name="image" size={60} color="#E0E0E0" />
              <Text style={styles.emptyStateText}>還沒有紀錄</Text>
            </View>
          }
        />
      </View>

      {/* 懸浮發佈按鈕 (FAB) */}
      <TouchableOpacity style={styles.fab} onPress={openUploadModal}>
        <Feather name="plus" size={30} color="white" />
      </TouchableOpacity>

      {/* 懸浮底部導覽列 */}
      <View style={styles.floatingBottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="book" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="map" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="user" size={24} color="#333" />
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// 樣式表
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAEAEA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row' },
  categorySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxWidth: 130 },
  categoryText: { fontSize: 15, fontWeight: '500', marginRight: 6, color: '#333' },
  friendsContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCCCCC', borderWidth: 2, borderColor: '#EAEAEA' },
  addFriendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginLeft: -12, borderWidth: 2, borderColor: '#EAEAEA' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  topBlankSpace: { height: 180 },
  contentWrapper: { flex: 1, backgroundColor: '#FFFFFF' },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 15, paddingVertical: 12 },
  dateText: { fontSize: 14, color: '#333', fontWeight: '500' },
  titleText: { fontSize: 18, color: '#333', fontWeight: '600' },
  imageGrid: { width: imageSize, height: imageSize, marginBottom: 2, marginRight: 2, backgroundColor: '#EBEBEB' },
  recordImage: { width: '100%', height: '100%' },
  placeholderGrid: { width: '100%', height: '100%', backgroundColor: '#EBEBEB' },
  
  // ✅ 新增：多圖小圖示樣式
  multipleIcon: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4 },

  fab: { position: 'absolute', bottom: 110, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A7A7A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, zIndex: 10 },
  floatingBottomNav: { position: 'absolute', bottom: 30, alignSelf: 'center', width: '90%', height: 65, backgroundColor: '#F5F5F5', borderRadius: 35, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 },
  navItem: { padding: 10 },
  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyStateText: { fontSize: 16, fontWeight: '600', color: '#BBB', marginTop: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 15, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, marginBottom: 10 },
  optionBtnText: { fontSize: 16, fontWeight: '600', marginLeft: 10, color: '#000' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'center', letterSpacing: 1, marginBottom: 20 },
  joinBtn: { backgroundColor: '#CCCCCC', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  joinBtnActive: { backgroundColor: '#333333' },
  joinBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  spaceListItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderRadius: 8, marginBottom: 8, backgroundColor: '#F5F5F5' },
  spaceListActive: { backgroundColor: '#333' },
  spaceListText: { fontSize: 16, fontWeight: '600', color: '#333' },
  
  // ✅ 修改：支援多圖橫向滑動預覽的樣式
  previewContainer: { marginBottom: 20 },
  previewScroll: { flexDirection: 'row', paddingBottom: 10 },
  previewImageMulti: { width: 100, height: 100, borderRadius: 10, marginRight: 10, backgroundColor: '#EAEAEA' },
  reselectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: '#F5F5F5', borderRadius: 8, marginTop: 5 },
  reselectText: { fontSize: 14, color: '#666', marginLeft: 6, fontWeight: '500' },
  
  imageUploadArea: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', borderRadius: 10, overflow: 'hidden', marginBottom: 20 },
  imageUploadPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageUploadText: { color: '#999', marginTop: 10, fontSize: 16 },
  spaceSelector: { flexDirection: 'row', marginBottom: 10 },
  spaceChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0', marginRight: 10 },
  spaceChipActive: { backgroundColor: '#333', borderColor: '#333' },
  spaceChipText: { color: '#666', fontWeight: '600' },
});