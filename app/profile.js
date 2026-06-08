import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  ScrollView, StatusBar, Image, Switch, Alert, ActivityIndicator, Modal, TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import * as ImagePicker from 'expo-image-picker'; 

// 引入 Firebase 功能
import { 
  subscribeToUserSpaces, uploadImageToGitHub, 
  getUserProfile, updateUserProfile 
} from './firebaseServices'; 

// 🌟 引入全域主題 Context
import { useAppTheme } from './ThemeContext'; 

export default function ProfileScreen() {
  const router = useRouter();

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);

  // 個人資料狀態
  const [userName, setUserName] = useState("Name");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // 修改名字的 Modal 狀態
  const [isNameModalVisible, setIsNameModalVisible] = useState(false);
  const [editNameInput, setEditNameInput] = useState("");

  // 提醒功能開關狀態
  const [uploadReminder, setUploadReminder] = useState(false);
  const [timeReminder, setTimeReminder] = useState(false);
  const [joinSpaceReminder, setJoinSpaceReminder] = useState(false);
  
  // 🌟 從全域主題中撈取當前的 theme 設定與切換控制方法
  const { theme, toggleDarkMode } = useAppTheme();
  const darkMode = theme.darkMode; // 方便下方開關判斷使用

  // 初始化與取得個人資料
  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);

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

  // 訂閱使用者空間
  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (spaces) => {
      const sortedSpaces = [...spaces].sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeA - timeB;
      });
      setMySpaces(sortedSpaces);
    });
    return () => unsubscribe();
  }, [myUserId]);

  // 處理更換頭貼
  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("權限不足", "需要相簿權限才能更換頭貼喔！");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, 
      aspect: [1, 1], 
      quality: 0.5, 
      base64: true, 
    });

    if (!result.canceled && result.assets[0].base64) {
      setIsUploadingAvatar(true);
      try {
        const githubUrl = await uploadImageToGitHub(result.assets[0].base64);
        await updateUserProfile(myUserId, { avatarUrl: githubUrl });
        setAvatarUrl(githubUrl);
      } catch (e) {
        Alert.alert("錯誤", "上傳頭貼失敗，請稍後再試。");
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  // 處理儲存名字
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. 個人頭像區塊 */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.avatarContainer} 
            onPress={handlePickAvatar}
            disabled={isUploadingAvatar}
            activeOpacity={0.8}
          >
            <View style={styles.avatarPlaceholder}>
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={40} color="#FFF" />
              )}
            </View>
            
            <View style={styles.editIconBtn}>
              <Feather name="camera" size={10} color="#333" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.nameRow} 
            onPress={() => {
              setEditNameInput(userName);
              setIsNameModalVisible(true);
            }}
          >
            <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
            <Feather name="edit-2" size={14} color={darkMode ? "#666" : "#999"} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        {/* 2. 空間管理區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>空間管理</Text>
          
          <View style={styles.spaceListWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spaceList}>
              {mySpaces.map((space) => (
                <TouchableOpacity key={space.id} style={[styles.spaceCard, { backgroundColor: theme.cardBg }]} onPress={() => router.push({
                  pathname: '/spacesetting', 
                  params: { spaceId: space.id }
                })}>
                  {space.backgroundImageUrl ? (
                    <Image source={{ uri: space.backgroundImageUrl }} style={styles.spaceImagePlaceholder} />
                  ) : (
                    <View style={[styles.spaceImagePlaceholder, { backgroundColor: theme.cardImgBg }]} />
                  )}
                  <View style={[styles.spaceLabel, { backgroundColor: theme.cardLabelBg }]}>
                    <Text style={styles.spaceLabelText} numberOfLines={1}>{space.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {mySpaces.length === 0 && (
                <View style={[styles.spaceCard, { backgroundColor: theme.cardBg, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: theme.valueText, fontSize: 12 }}>尚無空間</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        {/* 3. 設定區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>設定</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>上傳</Text>
            <Switch 
              value={uploadReminder} 
              onValueChange={setUploadReminder}
              trackColor={{ false: darkMode ? "#333333" : "#E0E0E0", true: darkMode ? "#FFFFFF" : "#000000" }}
              thumbColor={darkMode && uploadReminder ? "#000000" : "#FFFFFF"}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>定時</Text>
            <Text style={[styles.settingValue, { color: theme.valueText }]}>9:00</Text>
            <Switch 
              value={timeReminder} 
              onValueChange={setTimeReminder}
              trackColor={{ false: darkMode ? "#333333" : "#E0E0E0", true: darkMode ? "#FFFFFF" : "#000000" }}
              thumbColor={darkMode && timeReminder ? "#000000" : "#FFFFFF"}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>加入空間</Text>
            <Switch 
              value={joinSpaceReminder} 
              onValueChange={setJoinSpaceReminder}
              trackColor={{ false: darkMode ? "#333333" : "#E0E0E0", true: darkMode ? "#FFFFFF" : "#000000" }}
              thumbColor={darkMode && joinSpaceReminder ? "#000000" : "#FFFFFF"}
            />
          </View>
        </View>

        {/* 4. 深色模式區塊（格式與「設定」完美一致） */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>深色模式</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>開啟深色外觀</Text>
            <Switch 
              value={darkMode} 
              onValueChange={toggleDarkMode} // 🌟 直接呼叫全域切換方法
              trackColor={{ false: darkMode ? "#333333" : "#E0E0E0", true: darkMode ? "#FFFFFF" : "#000000" }}
              thumbColor={darkMode ? "#000000" : "#FFFFFF"}
            />
          </View>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 修改名字的彈出視窗 */}
      <Modal visible={isNameModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>修改名字</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.inputBorder, color: theme.text }]}
              value={editNameInput}
              onChangeText={setEditNameInput}
              placeholder="請輸入新名字..."
              placeholderTextColor={darkMode ? "#666" : "#999"}
              autoFocus
              maxLength={15}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.cancelBtnBg }]} onPress={() => setIsNameModalVisible(false)}>
                <Text style={[styles.cancelBtnText, { color: theme.cancelBtnText }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.saveBtnBg }]} onPress={handleSaveName}>
                <Text style={[styles.saveBtnText, { color: theme.saveBtnText }]}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingTop: 40, paddingHorizontal: 20 },
  
  profileSection: { alignItems: 'center', marginBottom: 40 },
  avatarContainer: { position: 'relative' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#A3A3A3', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  editIconBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#EAEAEA', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  userName: { fontSize: 18, fontWeight: '600' },

  sectionContainer: { marginBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 15 },

  spaceListWrapper: { position: 'relative' },
  spaceList: { flexDirection: 'row' },
  spaceCard: { width: 110, height: 130, marginRight: 10, borderRadius: 0, overflow: 'hidden' }, 
  spaceImagePlaceholder: { flex: 1 },
  spaceLabel: { height: 30, justifyContent: 'center', paddingHorizontal: 8 },
  spaceLabelText: { color: '#FFF', fontSize: 12, fontWeight: '500' },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingLabel: { fontSize: 15, flex: 1 },
  settingValue: { fontSize: 15, marginRight: 15 },

  // Modal 樣式
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: 15, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, marginRight: 10 },
  cancelBtnText: { fontWeight: '600' },
  saveBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8 },
  saveBtnText: { fontWeight: '600' }
});