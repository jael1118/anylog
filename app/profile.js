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
  
  // 自訂定時時間的狀態與 Modal 控制
  const [reminderTime, setReminderTime] = useState("09:00");
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [tempTime, setTempTime] = useState("");

  // 表情放大檢視 Modal 的獨立狀態
  const [isPreviewMoodVisible, setIsPreviewMoodVisible] = useState(false);
  const [selectedPreviewMood, setSelectedPreviewMood] = useState(null);

  // 從全域主題中撈取切換方法
  const { theme, changeThemeMode } = useAppTheme();
  const currentMode = theme.themeMode; // 'light' | 'dark' | 'cyber'
  const isDarkEnv = currentMode === 'dark'; 

  // 表情管理資料配置
  const moodManagementOptions = [
    { id: 0, source: require('../assets/1.jpg'), color: '#FF9A9E', isUnlocked: true, name: "魂飛魄散" },
    { id: 1, source: require('../assets/2.jpg'), color: '#FFB7B2', isUnlocked: true, name: "蛤?" },
    { id: 2, source: require('../assets/3.jpg'), color: '#FFDAC1', isUnlocked: true, name: "哭哭" },
    { id: 3, source: require('../assets/4.jpg'), color: '#E2F0CB', isUnlocked: true, name: "普普soso" },
    { id: 4, source: require('../assets/5.jpg'), color: '#B5EAD7', isUnlocked: true, name: "笑笑" },
    { id: 5, source: null, color: isDarkEnv ? '#2C2C2E' : '#D9D9D9', isUnlocked: false, name: "未來擴充表情 🔒", unlockCondition: "解鎖條件：空間紀錄累積達到 10 篇 ✨" },
    { id: 6, source: null, color: isDarkEnv ? '#3A3A3C' : '#EAEAEA', isUnlocked: false, name: "未來擴充表情 🔒", unlockCondition: "解鎖條件：完美收錄相框別冊第 1 輯 ✦" },
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

  // 處理儲存自訂定時提醒
  const handleSaveTime = () => {
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

        {/* 3. 提醒設定區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>提醒</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>上傳</Text>
            <Switch 
              value={uploadReminder} 
              onValueChange={setUploadReminder}
              trackColor={{ false: theme.isCyber ? "#00FFFF" : (isDarkEnv ? "#333333" : "#E0E0E0"), true: theme.isCyber ? "#FF007F" : (isDarkEnv ? "#FFFFFF" : "#000000") }}
              thumbColor={theme.isCyber ? "#FFFF00" : "#FFFFFF"}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>定時</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                trackColor={{ false: theme.isCyber ? "#00FFFF" : (isDarkEnv ? "#333333" : "#E0E0E0"), true: theme.isCyber ? "#FF007F" : (isDarkEnv ? "#FFFFFF" : "#000000") }}
                thumbColor={theme.isCyber ? "#FFFF00" : "#FFFFFF"}
              />
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.subText }]}>加入空間</Text>
            <Switch 
              value={joinSpaceReminder} 
              onValueChange={setJoinSpaceReminder}
              trackColor={{ false: theme.isCyber ? "#00FFFF" : (isDarkEnv ? "#333333" : "#E0E0E0"), true: theme.isCyber ? "#FF007F" : (isDarkEnv ? "#FFFFFF" : "#000000") }}
              thumbColor={theme.isCyber ? "#FFFF00" : "#FFFFFF"}
            />
          </View>
        </View>

        {/* 4. 主題外觀切換區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>主題外觀</Text>
          <View style={styles.themePillRow}>
            <TouchableOpacity style={[styles.themeChip, { borderColor: theme.inputBorder }, currentMode === 'light' && styles.themeChipActiveLight]} onPress={() => changeThemeMode('light')}>
              <Feather name="sun" size={14} color={currentMode === 'light' ? '#111111' : (theme.isCyber ? '#000000' : theme.subText)} />
              <Text style={[styles.themeChipText, { color: currentMode === 'light' ? '#111111' : (theme.isCyber ? '#000000' : theme.subText) }]}> 亮白</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.themeChip, { borderColor: theme.inputBorder }, currentMode === 'dark' && styles.themeChipActiveDark]} onPress={() => changeThemeMode('dark')}>
              <Feather name="moon" size={14} color={currentMode === 'dark' ? '#000000' : (theme.isCyber ? '#000000' : theme.subText)} />
              <Text style={[styles.themeChipText, { color: currentMode === 'dark' ? '#000000' : (theme.isCyber ? '#000000' : theme.subText) }]}> 深黑</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.themeChip, { borderColor: theme.inputBorder }, currentMode === 'cyber' && styles.themeChipActiveCyber]} onPress={() => changeThemeMode('cyber')}>
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
                activeOpacity={0.7}
                onPress={() => {
                  setSelectedPreviewMood(mood);
                  setIsPreviewMoodVisible(true);
                }}
                style={[
                  styles.moodManageCard, 
                  { 
                    backgroundColor: mood.isUnlocked ? theme.cardBg : mood.color,
                    borderColor: theme.inputBorder 
                  }
                ]}
              >
                {mood.source && (
                  <Image 
                    source={mood.source} 
                    style={[styles.moodManageImage, !mood.isUnlocked && { opacity: 0.25 }]} 
                    resizeMode="contain" 
                  />
                )}
                {!mood.isUnlocked && (
                  <View style={styles.moodLockOverlay}>
                    <Feather name="lock" size={16} color={theme.isCyber ? '#FFFF00' : '#FF3B30'} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 6. 常見問題與教學區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>幫助與支援</Text>
          <TouchableOpacity 
            style={[styles.faqClickRow, { backgroundColor: theme.cardBg, borderColor: theme.inputBorder }]} 
            activeOpacity={0.7}
            onPress={() => router.push('/tutorial')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="help-circle" size={18} color={theme.subText} style={{ marginRight: 12 }} />
              <Text style={[styles.settingLabel, { color: theme.text }]}>常見問題與使用教學</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.subText} />
          </TouchableOpacity>
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

      {/* 選擇定時時間的 Modal */}
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

      {/* 🌟 表情放大檢視 Modal (已移除底下一條的大按鈕，改為右上角乾淨的叉叉關閉) */}
      <Modal visible={isPreviewMoodVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.modalBg, padding: 25, position: 'relative' }]}>
            
            {/* 右上角優雅的叉叉按鈕 */}
            <TouchableOpacity 
              style={styles.modalCloseCornerBtn} 
              onPress={() => setIsPreviewMoodVisible(false)}
            >
              <Feather name="x" size={20} color={theme.text} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', width: '100%' }}>
              <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 20 }]}>表情詳細檢視</Text>
              
              <View style={[
                styles.previewMoodCardFrame, 
                { 
                  backgroundColor: selectedPreviewMood?.isUnlocked ? (isDarkEnv ? '#121212' : '#F5F5F7') : selectedPreviewMood?.color,
                  borderColor: theme.inputBorder
                }
              ]}>
                {selectedPreviewMood?.source ? (
                  <Image 
                    source={selectedPreviewMood.source} 
                    style={[styles.previewMoodLargeImage, !selectedPreviewMood.isUnlocked && { opacity: 0.15 }]} 
                    resizeMode="contain" 
                  />
                ) : (
                  <Feather name="lock" size={48} color={theme.isCyber ? '#FFFF00' : '#FF3B30'} />
                )}
              </View>

              {/* 下排註解文字與解鎖條件 */}
              <Text style={[styles.previewMoodName, { color: theme.text }]}>
                {selectedPreviewMood?.name}
              </Text>
              
              {!selectedPreviewMood?.isUnlocked && (
                <Text style={[styles.previewMoodCondition, { color: theme.isCyber ? '#000000' : '#FF3B30', backgroundColor: theme.isCyber ? '#00FF66' : 'transparent' }]}>
                  {selectedPreviewMood?.unlockCondition}
                </Text>
              )}
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
  spaceCard: { width: 120, height: 140, marginRight: 12, borderRadius: 16, overflow: 'hidden' }, 
  spaceImagePlaceholder: { flex: 1 },
  spaceLabel: { height: 32, justifyContent: 'center', paddingHorizontal: 8 },
  spaceLabelText: { color: '#FFF', fontSize: 12, fontWeight: '500' },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingLabel: { fontSize: 15, flex: 1 },
  settingValue: { fontSize: 15, marginRight: 15 },
  timePickerBtn: { marginRight: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },

  themePillRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  themeChip: { flex: 1, flexDirection: 'row', height: 44, borderWidth: 1, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  themeChipText: { fontSize: 14, fontWeight: '600' },
  themeChipActiveLight: { backgroundColor: '#E5E5EA', borderColor: '#E5E5EA' },
  themeChipActiveDark: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  themeChipActiveCyber: { backgroundColor: '#FF007F', borderColor: '#FF007F' }, 

  moodManagementRow: { flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 5, paddingHorizontal: 2, gap: 12 },
  moodManagementRow: { flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 5, paddingHorizontal: 2, gap: 12 },
  moodManageCard: { width: 54, height: 54, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  moodManageImage: { width: 44, height: 44 },
  moodLockOverlay: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },

  faqClickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingRight: 15 },

  // 🌟 新增：右上角絕對定位的關閉叉叉按鈕樣式
  modalCloseCornerBtn: { position: 'absolute', top: 15, right: 15, padding: 5, zIndex: 10 },

  // 表情預覽樣式
  previewMoodCardFrame: { width: 120, height: 120, borderRadius: 24, borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 15 },
  previewMoodLargeImage: { width: 90, height: 90 },
  previewMoodName: { fontSize: 16, fontWeight: '700', marginTop: 5, textAlign: 'center' },
  previewMoodCondition: { fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },

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