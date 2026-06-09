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
  
  // 提醒設定核心狀態
  const [uploadReminder, setUploadReminder] = useState(false);
  const [timeReminder, setTimeReminder] = useState(false);
  const [joinSpaceReminder, setJoinSpaceReminder] = useState(false);
  
  // ✅ 新增：自訂定時時間的狀態與 Modal 控制
  const [reminderTime, setReminderTime] = useState("09:00");
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [tempTime, setTempTime] = useState("");

  // 從全域主題中撈取切換方法
  const { theme, changeThemeMode } = useAppTheme();
  const currentMode = theme.themeMode; // 'light' | 'dark' | 'cyber'

  // 🌟 表情管理資料配置（前 5 個目前全解鎖，後 2 個示範未來鎖住用純色取代）
  const moodManagementOptions = [
    { id: 0, source: require('../assets/1.jpg'), color: '#FF9A9E', isUnlocked: true },
    { id: 1, source: require('../assets/2.jpg'), color: '#FFB7B2', isUnlocked: true },
    { id: 2, source: require('../assets/3.jpg'), color: '#FFDAC1', isUnlocked: true },
    { id: 3, source: require('../assets/4.jpg'), color: '#E2F0CB', isUnlocked: true },
    { id: 4, source: require('../assets/5.jpg'), color: '#B5EAD7', isUnlocked: true },
    // ⬇️ 這裡示範您未來要新增的「鎖定狀態」，先不放圖片 (source: null)，直接顯示純色塊
    { id: 5, source: null, color: '#D9D9D9', isUnlocked: false, unlockCondition: "解鎖條件：空間紀錄累積達到 10 篇 ✨" },
    { id: 6, source: null, color: '#EAEAEA', isUnlocked: false, unlockCondition: "解鎖條件：完美收錄相框別冊第 1 輯 ✦" },
  ];

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

  // ✅ 處理儲存自訂定時提醒
  const handleSaveTime = () => {
    // 簡單驗證時間格式是否為 HH:mm (24小時制)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(tempTime)) {
      Alert.alert("格式錯誤", "請輸入有效的時間格式，例如 09:00 或 18:30");
      return;
    }
    setReminderTime(tempTime);
    setIsTimePickerVisible(false);
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
            <Feather name="edit-2" size={14} color={theme.subText} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        {/* 2. 空間管理區塊 (✅ 已加上優美的圓角設計 borderRadius: 16) */}
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

        {/* 3. 提醒設定區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>提醒</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>上傳</Text>
            <Switch 
              value={uploadReminder} 
              onValueChange={setUploadReminder}
              trackColor={{ false: theme.isCyber ? "#00FFFF" : (theme.darkMode ? "#333333" : "#E0E0E0"), true: theme.isCyber ? "#FF007F" : (theme.darkMode ? "#FFFFFF" : "#000000") }}
              thumbColor={theme.isCyber ? "#FFFF00" : "#FFFFFF"}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>定時</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* ✅ 新增：可點擊修改的定時時間按鈕 */}
              <TouchableOpacity 
                style={[styles.timePickerBtn, { backgroundColor: theme.cardBg, borderColor: theme.inputBorder }]}
                onPress={() => {
                  setTempTime(reminderTime);
                  setIsTimePickerVisible(true);
                }}
              >
                <Text style={[styles.settingValue, { color: theme.text, marginRight: 0 }]}>{reminderTime}</Text>
              </TouchableOpacity>
              <Switch 
                value={timeReminder} 
                onValueChange={setTimeReminder}
                trackColor={{ false: theme.isCyber ? "#00FFFF" : (theme.darkMode ? "#333333" : "#E0E0E0"), true: theme.isCyber ? "#FF007F" : (theme.darkMode ? "#FFFFFF" : "#000000") }}
                thumbColor={theme.isCyber ? "#FFFF00" : "#FFFFFF"}
              />
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>加入空間</Text>
            <Switch 
              value={joinSpaceReminder} 
              onValueChange={setJoinSpaceReminder}
              trackColor={{ false: theme.isCyber ? "#00FFFF" : (theme.darkMode ? "#333333" : "#E0E0E0"), true: theme.isCyber ? "#FF007F" : (theme.darkMode ? "#FFFFFF" : "#000000") }}
              thumbColor={theme.isCyber ? "#FFFF00" : "#FFFFFF"}
            />
          </View>
        </View>

        {/* 4. 主題外觀切換區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>主題外觀</Text>
          
          <View style={styles.themePillRow}>
            <TouchableOpacity 
              style={[styles.themeChip, { borderColor: theme.inputBorder }, currentMode === 'light' && styles.themeChipActiveLight]} 
              onPress={() => changeThemeMode('light')}
            >
              <Feather name="sun" size={14} color={currentMode === 'light' ? '#111111' : (theme.isCyber ? '#000000' : theme.subText)} />
              <Text style={[styles.themeChipText, { color: currentMode === 'light' ? '#111111' : (theme.isCyber ? '#000000' : theme.subText) }]}> 亮白</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.themeChip, { borderColor: theme.inputBorder }, currentMode === 'dark' && styles.themeChipActiveDark]} 
              onPress={() => changeThemeMode('dark')}
            >
              <Feather name="moon" size={14} color={currentMode === 'dark' ? '#000000' : (theme.isCyber ? '#000000' : theme.subText)} />
              <Text style={[styles.themeChipText, { color: currentMode === 'dark' ? '#000000' : (theme.isCyber ? '#000000' : theme.subText) }]}> 深黑</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.themeChip, { borderColor: theme.inputBorder }, currentMode === 'cyber' && styles.themeChipActiveCyber]} 
              onPress={() => changeThemeMode('cyber')}
            >
              <Feather name="zap" size={14} color={currentMode === 'cyber' ? '#FFFF00' : (theme.isCyber ? '#000000' : theme.subText)} />
              <Text style={[styles.themeChipText, { color: currentMode === 'cyber' ? '#FFFF00' : (theme.isCyber ? '#000000' : theme.subText) }]}> 現代</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. 表情管理區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>表情管理</Text>
          
          <View style={styles.moodManagementRow}>
            {moodManagementOptions.map((mood) => (
              <TouchableOpacity 
                key={mood.id} 
                activeOpacity={mood.isUnlocked ? 0.7 : 1}
                onPress={() => {
                  if (!mood.isUnlocked) {
                    Alert.alert("表情未解鎖 🔒", mood.unlockCondition);
                  } else {
                    Alert.alert("表情已啟用 📸", "您已經可以在空間紀錄、心情小卡中自由運用這個動態表情貼圖囉！");
                  }
                }}
                style={[
                  styles.moodManageCard, 
                  { 
                    backgroundColor: mood.isUnlocked ? theme.cardBg : mood.color, // 未解鎖時顯示您預設的純色背景
                    borderColor: theme.inputBorder 
                  }
                ]}
              >
                {/* 若有圖片才渲染，沒有圖片就純粹顯示色塊 */}
                {mood.source && (
                  <Image 
                    source={mood.source} 
                    style={[styles.moodManageImage, !mood.isUnlocked && { opacity: 0.25 }]} 
                    resizeMode="contain" 
                  />
                )}
                
                {/* 如果被鎖住，加上鎖頭圖示 */}
                {!mood.isUnlocked && (
                  <View style={styles.moodLockOverlay}>
                    <Feather name="lock" size={16} color={theme.isCyber ? '#FFFF00' : '#FF3B30'} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 修改名字的 Modal */}
      <Modal visible={isNameModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>修改名字</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.inputBorder, color: theme.isCyber ? '#000000' : theme.text, backgroundColor: theme.isCyber ? '#00FFFF' : 'transparent' }]}
              value={editNameInput}
              onChangeText={setEditNameInput}
              placeholder="請輸入新名字..."
              placeholderTextColor={theme.valueText}
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

      {/* ✅ 新增：選擇定時時間的 Modal */}
      <Modal visible={isTimePickerVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>設定提醒時間</Text>
            <TextInput
              style={[styles.input, { 
                borderColor: theme.inputBorder, 
                color: theme.isCyber ? '#000000' : theme.text, 
                backgroundColor: theme.isCyber ? '#00FFFF' : 'transparent',
                textAlign: 'center', 
                fontSize: 22, 
                fontWeight: 'bold',
                letterSpacing: 2
              }]}
              value={tempTime}
              onChangeText={setTempTime}
              placeholder="09:00"
              placeholderTextColor={theme.valueText}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <Text style={{color: theme.subText, textAlign: 'center', marginBottom: 20, fontSize: 12}}>
              請輸入 24 小時制時間，例如 09:00 或 18:30
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.cancelBtnBg }]} onPress={() => setIsTimePickerVisible(false)}>
                <Text style={[styles.cancelBtnText, { color: theme.cancelBtnText }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.saveBtnBg }]} onPress={handleSaveTime}>
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
  // ✅ 空間管理卡片圓角化 (borderRadius: 16)
  spaceCard: { width: 120, height: 140, marginRight: 12, borderRadius: 16, overflow: 'hidden' }, 
  spaceImagePlaceholder: { flex: 1 },
  spaceLabel: { height: 32, justifyContent: 'center', paddingHorizontal: 8 },
  spaceLabelText: { color: '#FFF', fontSize: 12, fontWeight: '500' },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingLabel: { fontSize: 15, flex: 1 },
  settingValue: { fontSize: 15, marginRight: 15 },
  timePickerBtn: { marginRight: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },

  // 主題選項按鈕列樣式
  themePillRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  themeChip: { flex: 1, flexDirection: 'row', height: 44, borderWidth: 1, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  themeChipText: { fontSize: 14, fontWeight: '600' },
  
  // 三種激活狀態顏色
  themeChipActiveLight: { backgroundColor: '#E5E5EA', borderColor: '#E5E5EA' },
  themeChipActiveDark: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  themeChipActiveCyber: { backgroundColor: '#FF007F', borderColor: '#FF007F' }, // 激活時變霓虹粉

  // 表情管理排版與格線樣式
  moodManagementRow: { flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 5, paddingHorizontal: 2, gap: 12 },
  moodManageCard: { width: 54, height: 54, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  moodManageImage: { width: 44, height: 44 },
  moodLockOverlay: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },

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