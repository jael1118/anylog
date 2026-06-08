import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, Text, View, FlatList, SafeAreaView,
  TouchableOpacity, Dimensions, StatusBar, Modal, TextInput, Image, Alert, ScrollView,
  ActivityIndicator, Animated, Platform, AppState
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useRouter, useLocalSearchParams } from 'expo-router'; 
import * as ImagePicker from 'expo-image-picker'; 
import { LinearGradient } from 'expo-linear-gradient'; 

import { 
  joinSpaceByCode, subscribeToSpaceRecords, createNewSpace, 
  subscribeToUserSpaces, uploadImageToGitHub, updateSpaceBackground, getUserProfile,
  updateSpaceName, updateUserLastActive
} from './firebaseServices'; 

// 🌟 引入全域主題 Context
import { useAppTheme } from './ThemeContext';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const numColumns = 3;
const imageSize = windowWidth / numColumns; 

export default function App() {
  const router = useRouter();
  const { spaceId } = useLocalSearchParams();

  // 🌟 從全域主題中撈取當前的 theme 設定
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;

  const [memberProfiles, setMemberProfiles] = useState([]);
  const [isMembersModalVisible, setIsMembersModalVisible] = useState(false);

  const [myUserId, setMyUserId] = useState(null); 
  const [records, setRecords] = useState([]);
  const [mySpaces, setMySpaces] = useState([]);
  const [currentSpace, setCurrentSpace] = useState(null); 
  
  const [isSpaceModalVisible, setIsSpaceModalVisible] = useState(false);
  const [spaceModalMode, setSpaceModalMode] = useState('list'); 
  const [inputValue, setInputValue] = useState('');
  const [isInviteCodeVisible, setIsInviteCodeVisible] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');

  // 🌟 重新加回原本的三個點選單狀態與更改名稱狀態
  const [isSettingsMenuVisible, setIsSettingsMenuVisible] = useState(false);
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [editSpaceName, setEditSpaceName] = useState('');

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!myUserId) return;
    const sendHeartbeat = () => { updateUserLastActive(myUserId); };
    sendHeartbeat();
    const heartbeatInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        sendHeartbeat();
      }
    }, 60000);
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        sendHeartbeat(); 
      }
    });
    return () => {
      clearInterval(heartbeatInterval);
      subscription.remove();
    };
  }, [myUserId]);

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
      if (!currentSpace && spaces.length > 0) {
        if (spaceId) {
          const matchedSpace = spaces.find(s => s.id === spaceId);
          setCurrentSpace(matchedSpace || spaces[0]); 
        } else {
          setCurrentSpace(spaces[0]);
        }
      } else if (currentSpace) {
        const updatedSpace = spaces.find(s => s.id === currentSpace.id);
        if (updatedSpace) setCurrentSpace(updatedSpace);
      }
    });
    return () => unsubscribe();
  }, [myUserId, currentSpace?.id, spaceId]);

  const membersKey = currentSpace?.members ? currentSpace.members.join(',') : '';

  useEffect(() => {
    const fetchMembers = async () => {
      if (currentSpace && currentSpace.members && currentSpace.members.length > 0) {
        try {
          const now = Date.now();
          const ONLINE_THRESHOLD = 3 * 60 * 1000;
          const profiles = await Promise.all(
            currentSpace.members.map(async (id) => {
              const profile = await getUserProfile(id);
              return {
                id: id,
                name: profile?.name || '空間成員',
                avatarUrl: profile?.avatarUrl || null,
                isOnline: id === myUserId ? true : (profile?.lastActive ? (now - profile.lastActive < ONLINE_THRESHOLD) : false)
              };
            })
          );
          setMemberProfiles(profiles);
        } catch (error) {
          console.error("讀取成員大頭貼失敗:", error);
        }
      } else {
        setMemberProfiles([]);
      }
    };
    fetchMembers();
    const refreshInterval = setInterval(() => { fetchMembers(); }, 30000); 
    return () => clearInterval(refreshInterval);
  }, [membersKey, myUserId]);

  useEffect(() => {
    if (!currentSpace) {
      setRecords([]);
      return;
    }
    const unsubscribe = subscribeToSpaceRecords(currentSpace.id, (data) => {
      const sortedData = data.sort((a, b) => b.createdAt - a.createdAt);
      setRecords(sortedData);
    });
    return () => unsubscribe();
  }, [currentSpace?.id]);

  const handleUpdateName = async () => {
    if (!editSpaceName.trim()) {
      Alert.alert("提示", "空間名稱不能為空喔！");
      return;
    }
    try {
      await updateSpaceName(currentSpace.id, editSpaceName);
      setIsEditNameModalVisible(false);
    } catch (e) {
      Alert.alert("錯誤", "更改名稱失敗，請稍後再試。");
    }
  };

  const handleSelectBackground = async () => {
    if (!currentSpace) return;
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8, base64: true, 
    });
    if (!result.canceled && result.assets && result.assets[0].base64) {
      setIsUploadingBg(true);
      try {
        const githubUrl = await uploadImageToGitHub(result.assets[0].base64);
        await updateSpaceBackground(currentSpace.id, githubUrl);
      } catch (e) {
        Alert.alert("錯誤", "上傳背景失敗，請稍後再試。");
      } finally {
        setIsUploadingBg(false);
      }
    }
  };

  const filteredRecords = records.filter(record => {
    if (!searchText.trim()) return true; 
    const query = searchText.toLowerCase().trim();
    const noteMatch = record.note?.toLowerCase().includes(query);
    const locMatch = record.location?.toLowerCase().includes(query);
    const d = new Date(record.createdAt);
    const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    return noteMatch || locMatch || dateStr.includes(query);
  });

  const groupedRecords = useMemo(() => {
    const groups = [];
    filteredRecords.forEach(record => {
      const d = new Date(record.createdAt);
      const monthStr = `${d.getMonth() + 1}月`; 
      let group = groups.find(g => g.month === monthStr);
      if (!group) {
        group = { month: monthStr, data: [] };
        groups.push(group);
      }
      group.data.push(record);
    });
    return groups;
  }, [filteredRecords]);

  const renderRecordItem = (item) => {
    const firstImage = item.imageUrls ? item.imageUrls[0] : item.imageUrl;
    const isMultiple = item.imageUrls && item.imageUrls.length > 1;

    const targetUid = item.userId || item.creatorId || item.uid || item.authorId;
    const postCreator = memberProfiles.find(m => m.id === targetUid);
    const realAvatarUrl = postCreator?.avatarUrl || item.userAvatar || item.avatarUrl || null;
    const hasNote = item.note && item.note.trim().length > 0;

    const getMoodImage = (moodId) => {
      switch (moodId) {
        case 0: return require('../assets/1.jpg');
        case 1: return require('../assets/2.jpg');
        case 2: return require('../assets/3.jpg');
        case 3: return require('../assets/4.jpg');
        case 4: return require('../assets/5.jpg');
        default: return null;
      }
    };

    return (
      <TouchableOpacity 
        key={item.id}
        style={[styles.imageGrid, { borderColor: theme.bg, backgroundColor: darkMode ? '#1A1A1A' : '#EBEBEB' }]}
        activeOpacity={0.8}
        onPress={() => {
          router.push({
            pathname: '/detail',
            params: { record: JSON.stringify(item) }
          });
        }}
      >
        {firstImage ? (
          <>
            <Image source={{ uri: firstImage }} style={styles.recordImage} resizeMode="cover" />
            {isMultiple && (
              <View style={styles.multipleIcon}>
                <Feather name="layers" size={14} color="white" />
              </View>
            )}
          </>
        ) : hasNote ? (
          <View style={[styles.recordImage, styles.pureTextGridFallback, { backgroundColor: darkMode ? '#1C1C1E' : '#F9F9FB', borderColor: darkMode ? '#2C2C2E' : '#E5E5EA' }]}>
            <Text 
              style={[styles.fallbackNoteText, { color: darkMode ? '#FFFFFF' : '#1C1C1E' }]} 
              numberOfLines={4}
              adjustsFontSizeToFit
            >
              {item.note.trim()}
            </Text>
          </View>
        ) : item.mood !== undefined && item.mood !== null ? (
          <View style={[styles.recordImage, styles.pureMoodGridFill, { backgroundColor: darkMode ? '#1C1C1E' : '#F5F5F7' }]}>
            <Image 
              source={getMoodImage(item.mood)} 
              style={styles.fullGridMoodImage} 
              resizeMode="cover" 
            />
          </View>
        ) : (
          <View style={[styles.recordImage, styles.pureTextGridFallback, { justifyContent: 'center', backgroundColor: darkMode ? '#1C1C1E' : '#F9F9FB' }]}>
            <Feather name="edit-3" size={18} color={darkMode ? '#8E8E93' : '#8E8E93'} />
          </View>
        )}

        {/* 🌟 統一保留您的大頭貼定位結構 */}
        <View style={[styles.postCreatorAvatarContainer, { borderColor: theme.bg }]}>
          {realAvatarUrl ? (
            <Image source={{ uri: realAvatarUrl }} style={styles.postCreatorAvatar} />
          ) : (
            <View style={styles.postCreatorAvatarPlaceholder}>
              <Feather name="user" size={10} color="#FFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMonthSection = ({ item }) => {
    return (
      <View style={styles.monthSectionContainer}>
        <View style={[styles.monthHeaderBar, { backgroundColor: theme.bg }]}>
          <Text style={[styles.monthHeaderText, { color: theme.text }]} json-fallback='#111'>{item.month}</Text>
        </View>
        <View style={styles.monthGrid}>
          {item.data.map(record => renderRecordItem(record))}
        </View>
      </View>
    );
  };

  const blurOpacity = scrollY.interpolate({
    inputRange: [0, 150], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const memberOpacity = scrollY.interpolate({
    inputRange: [60, 160], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const memberTranslateY = scrollY.interpolate({
    inputRange: [60, 160], outputRange: [0, -45], extrapolate: 'clamp',
  });

  if (!myUserId) return <View style={[styles.container, { backgroundColor: theme.bg }]} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor="transparent" translucent={true} />
      
      <View style={styles.fixedBackgroundLayer}>
        {isUploadingBg ? (
          <View style={[styles.placeholderBackground, { backgroundColor: darkMode ? '#2C2C2E' : '#D9D9D9' }]}><ActivityIndicator size="small" color={theme.text} /></View>
        ) : currentSpace?.backgroundImageUrl ? (
          <Image source={{ uri: currentSpace.backgroundImageUrl }} style={styles.backgroundImage} resizeMode="cover" />
        ) : (
          <View style={[styles.placeholderBackground, { backgroundColor: darkMode ? '#2C2C2E' : '#D9D9D9' }]}><Feather name="image" size={32} color="#AAA" /></View>
        )}
        <LinearGradient colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.3)', 'transparent']} style={styles.topFaintGradient} pointerEvents="none" />
        <LinearGradient colors={['rgba(0,0,0,0)', darkMode ? 'rgba(18,18,18,0.3)' : 'rgba(255,255,255,0.3)', theme.bg]} style={styles.bottomFadeGradient} pointerEvents="none" />
        <Animated.View style={[styles.backgroundOverlay, { opacity: blurOpacity, backgroundColor: theme.bg }]} pointerEvents="none" />
      </View>

      <View style={styles.fixedHeader} pointerEvents="box-none">
        {isSearchMode ? (
          <View style={styles.header}>
            <View style={[styles.searchHeaderContainer, { backgroundColor: darkMode ? '#1E1E1E' : 'rgba(255,255,255,0.85)' }]}>
              <TouchableOpacity onPress={() => { setIsSearchMode(false); setSearchText(''); }}>
                <Feather name="arrow-left" size={24} color={theme.text} style={{ marginRight: 12 }} />
              </TouchableOpacity>
              <TextInput style={[styles.searchInput, { color: theme.text }]} placeholder="搜尋地點、內容或日期..." placeholderTextColor={darkMode ? '#666' : '#999'} autoFocus value={searchText} onChangeText={setSearchText} />
              {searchText && (
                <TouchableOpacity onPress={() => setSearchText('')}><Feather name="x-circle" size={18} color={darkMode ? '#666' : '#999'} /></TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.headerColumnWrapper} pointerEvents="box-none">
            <View style={styles.headerTopRow}>
              <View style={styles.headerTopLeft}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backCircleBtn}>
                  <Feather name="chevron-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.titlePillWrapper}>
                  <Text style={styles.spaceMainTitle} numberOfLines={1}>
                    {currentSpace ? currentSpace.name : "..."}
                  </Text>
                </View>
              </View>

              <View style={styles.headerRightButtons}>
                <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsSearchMode(true)}>
                  <Feather name="search" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsSettingsMenuVisible(true)}>
                  <Feather name="more-horizontal" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <Animated.View style={[styles.headerBottomRow, { opacity: memberOpacity, transform: [{ translateY: memberTranslateY }] }]}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', zIndex: 2 }} activeOpacity={0.7} onPress={() => currentSpace && setIsMembersModalVisible(true)}>
                {memberProfiles.slice(0, 3).map((profile, index) => (
                  <View key={index} style={[styles.avatarStackWrapper, { zIndex: 3 - index, marginLeft: index > 0 ? 6 : 0 }]}>
                    <View style={[styles.avatarBaseFrame, profile.isOnline && styles.avatarFrameOnline, { backgroundColor: darkMode ? '#333' : '#CCCCCC' }]}>
                      {profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImageContent} /> : <Feather name="user" size={14} color="#FFF" />}
                    </View>
                    {profile.isOnline && <View style={styles.onlineStatusWhiteDot} />}
                  </View>
                ))}
                {memberProfiles.length > 3 && (
                   <View style={[styles.avatarStackWrapper, { zIndex: 0, marginLeft: 6 }]}>
                     <View style={[styles.avatarMoreCircle, { backgroundColor: darkMode ? '#333' : '#999' }]}><Feather name="more-horizontal" size={14} color="#FFF" /></View>
                   </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.addFriendCircleButton} onPress={() => { currentSpace && currentSpace.inviteCode ? setIsInviteCodeVisible(true) : Alert.alert("提示", "請先切換到一個空間"); }}>
                <Feather name="plus" size={16} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </View>

      <Animated.FlatList
        data={groupedRecords}
        renderItem={renderMonthSection} 
        keyExtractor={item => item.month}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        style={styles.flatListStyle}
        contentContainerStyle={[styles.listContentContainer, records.length === 0 && { paddingBottom: windowHeight }]}
        ListHeaderComponent={<View><TouchableOpacity style={{ height: 330, width: '100%' }} activeOpacity={1} /></View>}
        ListEmptyComponent={
          <View style={[styles.emptyStateContainer, { backgroundColor: theme.bg }]}>
            <Feather name={isSearchMode && searchText ? "search" : "image"} size={60} color={darkMode ? '#333' : '#E0E0E0'} />
            <Text style={[styles.emptyStateText, { color: darkMode ? '#555' : '#BBB' }]}>{isSearchMode && searchText ? "找不到相符的紀錄" : "還沒有紀錄"}</Text>
          </View>
        }
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} onPress={() => {
        if (!currentSpace) return Alert.alert("提示", "請先加入一個空間！");
        router.push({ pathname: '/upload', params: { currentSpaceId: currentSpace.id } });
      }}>
        <Feather name="plus" size={30} color={darkMode ? '#000000' : '#FFFFFF'} />
      </TouchableOpacity>

      {/* 🌟 補回原本的三個點功能選單彈出視窗（對齊原有自定義的 dropdownMenu 風格，並融合黑白灰） */}
      {isSettingsMenuVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setIsSettingsMenuVisible(false)} />
          <View style={[styles.dropdownMenu, { backgroundColor: theme.modalBg, shadowColor: darkMode ? '#000' : '#000' }]}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { 
                setIsSettingsMenuVisible(false); 
                setEditSpaceName(currentSpace?.name || ''); 
                setIsEditNameModalVisible(true); 
              }}
            >
              <Feather name="edit-2" size={18} color={theme.text} />
              <Text style={[styles.menuItemText, { color: theme.text }]}>更改名稱</Text>
            </TouchableOpacity>
            
            <View style={[styles.menuDivider, { backgroundColor: darkMode ? '#2C2C2E' : '#F0F0F0' }]} />
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => { 
                setIsSettingsMenuVisible(false); 
                handleSelectBackground(); 
              }}
            >
              <Feather name="image" size={18} color={theme.text} />
              <Text style={[styles.menuItemText, { color: theme.text }]}>更換背景</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 更改空間名稱彈窗 */}
      <Modal visible={isEditNameModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.modalBg }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>更改空間名稱</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: darkMode ? '#2C2C2E' : '#F5F5F5', color: theme.text, borderColor: theme.inputBorder }]} placeholder="輸入新名稱..." placeholderTextColor={darkMode ? '#555' : '#CCC'} value={editSpaceName} onChangeText={setEditSpaceName} autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={[styles.modalCancelBtn, { flex: 1, marginRight: 10, backgroundColor: theme.cancelBtnBg }]} onPress={() => setIsEditNameModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: theme.cancelBtnText }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { flex: 1, marginLeft: 10, backgroundColor: theme.saveBtnBg }]} onPress={handleUpdateName}>
                <Text style={[styles.modalConfirmText, { color: theme.saveBtnText }]}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 邀請朋友彈窗 */}
      <Modal visible={isInviteCodeVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center', backgroundColor: theme.modalBg }]}>
            <View style={styles.modalHeaderCloseRow}>
              <View style={{ width: 24 }} />
              <Text style={[styles.modalTitleTextOnly, { color: theme.text }]}>邀請朋友加入</Text>
              <TouchableOpacity onPress={() => setIsInviteCodeVisible(false)}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: theme.subText }]}>代碼分享給您的朋友：</Text>
            <View style={[styles.inviteCodeBox, { backgroundColor: darkMode ? '#2C2C2E' : '#F5F5F5', borderColor: darkMode ? '#333333' : '#E0E0E0' }]}><Text style={[styles.inviteCodeText, { color: theme.text }]}>{currentSpace?.inviteCode || '------'}</Text></View>
            <Text style={{ fontSize: 12, color: theme.valueText, marginTop: 15 }}>朋友可於空間列表輸入此代碼加入空間</Text>
          </View>
        </View>
      </Modal>

      {/* 空間成員名單彈窗 */}
      <Modal visible={isMembersModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%', backgroundColor: theme.modalBg }]}>
            <View style={styles.modalHeaderCloseRow}>
              <Text style={[styles.modalTitleTextOnly, { color: theme.text }]}>空間成員 ({memberProfiles.length})</Text>
              <TouchableOpacity onPress={() => setIsMembersModalVisible(false)}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {memberProfiles.map((member, idx) => (
                <View key={idx} style={[styles.memberListItem, { borderBottomWidth: 0.5, borderColor: darkMode ? '#2C2C2E' : '#F2F2F7', paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={[styles.memberListAvatar, { width: 36, height: 36, borderRadius: 18, backgroundColor: darkMode ? '#333' : '#CCCCCC', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }]}>
                    {member.avatarUrl ? <Image source={{ uri: member.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 18 }} /> : <Feather name="user" size={18} color="#FFF" />}
                  </View>
                  <Text style={[styles.memberListText, { color: theme.text, fontSize: 15, fontWeight: '500' }]}>{member.name}</Text>
                  {member.isOnline && <Text style={{ fontSize: 12, color: theme.text, marginLeft: 'auto', fontWeight: 'bold' }}>● 線上</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, 
  fixedBackgroundLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: 380, zIndex: 1 },
  backgroundImage: { width: '100%', height: '100%' },
  placeholderBackground: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backgroundOverlay: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, zIndex: 4 },
  topFaintGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, zIndex: 3 },
  bottomFadeGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, zIndex: 2 },
  
  fixedHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: Platform.OS === 'ios' ? 55 : (StatusBar.currentHeight || 24) + 5 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 50 },
  headerColumnWrapper: { paddingHorizontal: 15, flexDirection: 'column' },
  
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 45, zIndex: 10 },
  headerTopLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  
  backCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  titlePillWrapper: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', maxWidth: Dimensions.get('window').width * 0.45 },
  spaceMainTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  
  headerRightButtons: { flexDirection: 'row', alignItems: 'center' },
  headerBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingLeft: 46, zIndex: 1, height: 40 },
  
  avatarStackWrapper: { position: 'relative', width: 36, height: 36 }, 
  avatarBaseFrame: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarFrameOnline: { borderWidth: 3.5, borderColor: '#FFFFFF' }, 
  avatarImageContent: { width: '100%', height: '100%', borderRadius: 16 },
  onlineStatusWhiteDot: { position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }, 
  avatarMoreCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  
  addFriendCircleButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', marginLeft: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', zIndex: 1 },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  searchHeaderContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 15, height: 40 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  
  flatListStyle: { flex: 1, zIndex: 10, backgroundColor: 'transparent' }, 
  listContentContainer: { paddingBottom: 120 },
  
  monthSectionContainer: { marginBottom: 12 },
  monthHeaderBar: { width: Dimensions.get('window').width, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 4 },
  monthHeaderText: { fontSize: 14, fontWeight: '700' },
  
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  imageGrid: { width: imageSize, height: imageSize, borderWidth: 1.5, position: 'relative' },
  recordImage: { width: '100%', height: '100%' },
  multipleIcon: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4, zIndex: 5 },
  
  postCreatorAvatarContainer: { position: 'absolute', bottom: 8, left: 8, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, overflow: 'hidden', backgroundColor: '#CCC', zIndex: 5 },
  postCreatorAvatar: { width: '100%', height: '100%' },
  postCreatorAvatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyStateText: { fontSize: 16, fontWeight: '600', marginTop: 15 },
  fab: { position: 'absolute', bottom: 100, right: 25, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, zIndex: 90 },

  // 🌟 補回原本定義的 dropdownMenu 懸浮彈窗選單定位與樣式
  menuOverlay: { flex: 1, backgroundColor: 'transparent' }, 
  dropdownMenu: { position: 'absolute', top: Platform.OS === 'ios' ? 100 : 80, right: 15, width: 140, borderRadius: 12, paddingVertical: 4, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 15, fontWeight: '500', marginLeft: 12 },
  menuDivider: { height: 1, marginHorizontal: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 15, padding: 20 },
  modalHeaderCloseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20 },
  modalTitleTextOnly: { fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 14, marginBottom: 15, textAlign: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalInput: { borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 20, borderWidth: 1 },
  modalCancelBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  modalCancelText: { fontSize: 16, fontWeight: '600' },
  modalConfirmBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  modalConfirmText: { fontSize: 16, color: '#FFF', fontWeight: '600' },

  inviteCodeBox: { paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed' },
  inviteCodeText: { fontSize: 32, fontWeight: '900', letterSpacing: 5 },

  pureTextGridFallback: { justifyContent: 'center', alignItems: 'center', padding: 10, borderWidth: 1 },
  fallbackNoteText: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 16, paddingHorizontal: 2 },
  pureMoodGridFill: { justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' },
  fullGridMoodImage: { width: '100%', height: '100%' }
});