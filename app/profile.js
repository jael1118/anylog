import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  ScrollView, StatusBar, Image, Switch, Alert, ActivityIndicator, Modal, TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import * as ImagePicker from 'expo-image-picker'; 

// 引入新寫的這三個 Firebase 功能
import { 
  subscribeToUserSpaces, uploadImageToGitHub, 
  getUserProfile, updateUserProfile 
} from './firebaseServices'; 

export default function ProfileScreen() {
  const router = useRouter();

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);

  // ✅ 個人資料狀態
  const [userName, setUserName] = useState("Name");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // ✅ 修改名字的 Modal 狀態
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [editNameInput, setEditNameInput] = useState("");

  // 開關狀態設定
  const [uploadReminder, setUploadReminder] = useState(false);
  const [timeReminder, setTimeReminder] = useState(false);
  const [joinSpaceReminder, setJoinSpaceReminder] = useState(false);

  
  // 初始化與取得資料
  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);

      // 讀取 Firebase 上的個人資料
      if (storedId) {
        const profile = await getUserProfile(storedId);
        if (profile) {
          if (profile.name) setUserName(profile.name);
          if (profile.avatarUrl) setAvatarUrl(profile.avatarUrl);
        }
      }
    };
    initialize();
  }, []);

useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (spaces) => {
      // 🌟 複製一份並排序：把最新建立的排在最前面 (由大排到小)
      const sortedSpaces = [...spaces].sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA;
      });
      setMySpaces(sortedSpaces);
    });
    return () => unsubscribe();
  }, [myUserId]);

  // ✅ 處理更換頭貼
  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("權限不足", "需要相簿權限才能更換頭貼喔！");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, 
      aspect: [1, 1], // 頭貼裁切成正方形
      quality: 0.5, // 頭貼不需要太高清，降低解析度加快上傳
      base64: true, 
    });

    if (!result.canceled && result.assets[0].base64) {
      setIsUploadingAvatar(true);
      try {
        // 1. 上傳到 GitHub
        const githubUrl = await uploadImageToGitHub(result.assets[0].base64);
        // 2. 存入 Firebase
        await updateUserProfile(myUserId, { avatarUrl: githubUrl });
        // 3. 更新畫面
        setAvatarUrl(githubUrl);
      } catch (e) {
        Alert.alert("錯誤", "上傳頭貼失敗，請稍後再試。");
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  // ✅ 處理儲存名字
  const handleSaveName = async () => {
    if (!editNameInput.trim()) {
      Alert.alert("提示", "名字不能為空喔！");
      return;
    }
    try {
      await updateUserProfile(myUserId, { name: editNameInput.trim() });
      setUserName(editNameInput.trim());
      setIsNameModalVisible(false);
    } catch (e) {
      Alert.alert("錯誤", "儲存名字失敗");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. 個人頭像區塊 */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.avatarContainer} 
            onPress={handlePickAvatar}
            disabled={isUploadingAvatar}
            activeOpacity={0.8}
          >
            {/* 頭貼顯示邏輯 */}
            <View style={styles.avatarPlaceholder}>
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={40} color="#FFF" />
              )}
            </View>
            
            {/* 編輯小圖示 */}
            <View style={styles.editIconBtn}>
              <Feather name="camera" size={10} color="#333" />
            </View>
          </TouchableOpacity>
          
          {/* 點擊名字開啟編輯 Modal */}
          <TouchableOpacity 
            style={styles.nameRow} 
            onPress={() => {
              setEditNameInput(userName);
              setIsNameModalVisible(true);
            }}
          >
            <Text style={styles.userName}>{userName}</Text>
            <Feather name="edit-2" size={14} color="#999" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        {/* 2. 空間管理區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>空間管理</Text>
          
          <View style={styles.spaceListWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spaceList}>
              {mySpaces.map((space) => (
                <TouchableOpacity key={space.id} style={styles.spaceCard}onPress={() => router.push({
    pathname: '/spacesetting', 
    params: { spaceId: space.id } // 記得把你要管理的空間 ID 傳過去
  })}>
                  {/* 如果空間有背景圖，就在這裡顯示 */}
                  {space.backgroundImageUrl ? (
                    <Image source={{ uri: space.backgroundImageUrl }} style={styles.spaceImagePlaceholder} />
                  ) : (
                    <View style={styles.spaceImagePlaceholder} />
                  )}
                  <View style={styles.spaceLabel}>
                    <Text style={styles.spaceLabelText} numberOfLines={1}>{space.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {mySpaces.length === 0 && (
                <View style={[styles.spaceCard, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#999', fontSize: 12 }}>尚無空間</Text>
                </View>
              )}
            </ScrollView>
            
          </View>
        </View>

        {/* 3. 提醒設定區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>提醒</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>上傳</Text>
            <Switch 
              value={uploadReminder} 
              onValueChange={setUploadReminder}
              trackColor={{ false: "#E0E0E0", true: "#333333" }}
              thumbColor={"#FFFFFF"}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>定時</Text>
            <Text style={styles.settingValue}>9:00</Text>
            <Switch 
              value={timeReminder} 
              onValueChange={setTimeReminder}
              trackColor={{ false: "#E0E0E0", true: "#333333" }}
              thumbColor={"#FFFFFF"}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>加入空間</Text>
            <Switch 
              value={joinSpaceReminder} 
              onValueChange={setJoinSpaceReminder}
              trackColor={{ false: "#E0E0E0", true: "#333333" }}
              thumbColor={"#FFFFFF"}
            />
          </View>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ✅ 修改名字的彈出視窗 */}
      <Modal visible={isNameModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>修改名字</Text>
            <TextInput
              style={styles.input}
              value={editNameInput}
              onChangeText={setEditNameInput}
              placeholder="請輸入新名字..."
              placeholderTextColor="#999"
              autoFocus
              maxLength={15}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsNameModalVisible(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName}>
                <Text style={styles.saveBtnText}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingTop: 40, paddingHorizontal: 20 },
  
  profileSection: { alignItems: 'center', marginBottom: 40 },
  avatarContainer: { position: 'relative' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#A3A3A3', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  editIconBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#EAEAEA', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  userName: { fontSize: 18, fontWeight: '600', color: '#333' },

  sectionContainer: { marginBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 15 },

  spaceListWrapper: { position: 'relative' },
  spaceList: { flexDirection: 'row' },
  spaceCard: { width: 110, height: 130, marginRight: 10, backgroundColor: '#E0E0E0', borderRadius: 0, overflow: 'hidden' }, 
  spaceImagePlaceholder: { flex: 1, backgroundColor: '#D4D4D4' },
  spaceLabel: { height: 30, backgroundColor: '#999999', justifyContent: 'center', paddingHorizontal: 8 },
  spaceLabelText: { color: '#FFF', fontSize: 12, fontWeight: '500' },
  rightArrowContainer: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 5 },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingLabel: { fontSize: 15, color: '#666', flex: 1 },
  settingValue: { fontSize: 15, color: '#999', marginRight: 15 },

  // Modal 樣式
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 15, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 8, marginRight: 10 },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#333', borderRadius: 8 },
  saveBtnText: { color: '#FFF', fontWeight: '600' }
});