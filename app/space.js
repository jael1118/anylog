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

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const numColumns = 3;
const imageSize = windowWidth / numColumns;

export default function App() {
  const router = useRouter();
  const { spaceId } = useLocalSearchParams();

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

  const [isSettingsMenuVisible, setIsSettingsMenuVisible] = useState(false);
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [editSpaceName, setEditSpaceName] = useState('');

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
  if (!myUserId) return;

  // 定義發送心跳的動作
  const sendHeartbeat = () => {
    // updateUserLastActive 是我們等下要在 firebaseServices 加的函式
    updateUserLastActive(myUserId); 
  };

  // 一進來先發送一次
  sendHeartbeat();

  // 每 1 分鐘 (60000 毫秒) 發送一次心跳
  const heartbeatInterval = setInterval(() => {
    if (AppState.currentState === 'active') {
      sendHeartbeat();
    }
  }, 60000);

  // 監聽 App 退到背景或回到前景
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      sendHeartbeat(); // 回到前景立刻更新一次
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

  // 固定成員名單 key，防止即時異步渲染漏洞
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
    // 1. 畫面剛載入時，先立刻抓取一次
    fetchMembers();

    // 2. 🌟 新增：每 30 秒自動重新抓取一次大家的狀態
    // 這樣別人的 lastActive 更新時，這邊的畫面才會跟著變綠燈！
    const refreshInterval = setInterval(() => {
      fetchMembers();
    }, 30000); 

    // 3. 清理定時器
    return () => {
      clearInterval(refreshInterval);
    };
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
      mediaTypes: ['images'], 
      allowsEditing: true, 
      aspect: [16, 9], 
      quality: 0.8,
      base64: true, 
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
    const timeMatch = dateStr.includes(query);
    return noteMatch || locMatch || timeMatch;
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
// ✅ 判斷這篇貼文有沒有文字
const hasNote = item.note && item.note.trim().length > 0;
// 在檔案上方（元件外面或裡面都可以）準備好這個陣列：
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
    style={styles.imageGrid}
    activeOpacity={0.8}
    onPress={() => {
      router.push({
        pathname: '/detail',
        params: { record: JSON.stringify(item) }
      });
    }}
  >
    {firstImage ? (
      // 🌟 情況 A：有圖片 (維持你原本的完美設計)
      <>
        <Image source={{ uri: firstImage }} style={styles.recordImage} resizeMode="cover" />
        {isMultiple && (
          <View style={styles.multipleIcon}>
            <Feather name="layers" size={14} color="white" />
          </View>
        )}
        <View style={styles.postCreatorAvatarContainer}>
          {realAvatarUrl ? (
            <Image source={{ uri: realAvatarUrl }} style={styles.postCreatorAvatar} />
          ) : (
            <View style={styles.postCreatorAvatarPlaceholder}>
              <Feather name="user" size={10} color="#FFF" />
            </View>
          )}
        </View>
      </>
    ) : (
      // 🌟 情況 B：沒有圖片，顯示「純文字/心情小卡」
      <View style={[styles.recordImage, styles.pureTextGrid]}>
        
        {/* 1. 插圖/Icon (如果組員有畫圖片，可以把 Feather 換成 <Image source={require('組員的圖.png')} />) */}
        {item.mood !== undefined && item.mood !== null ? (
          <Image source={getMoodImage(item.mood)} style={[styles.moodIcon, { width: 40, height: 40 }]} resizeMode="contain" />
        ) : (
          <Feather name="message-square" size={26} color="#D4D4D4" style={styles.moodIcon} />
        )}
        
        {/* 2. 顯示文字預覽 (最多顯示 3 行，超過會變成 ...) */}
        <Text style={styles.pureTextContent} numberOfLines={3}>
          {hasNote ? item.note : "分享了新動態"}
        </Text>

        {/* 3. 一樣保留大頭貼，讓整體版面跟有照片的一致！ */}
        <View style={styles.postCreatorAvatarContainer}>
          {realAvatarUrl ? (
            <Image source={{ uri: realAvatarUrl }} style={styles.postCreatorAvatar} />
          ) : (
            <View style={styles.postCreatorAvatarPlaceholder}>
              <Feather name="user" size={10} color="#FFF" />
            </View>
          )}
        </View>

      </View>
    )}
  </TouchableOpacity>
);
  };

  const renderMonthSection = ({ item }) => {
    return (
      <View style={styles.monthSectionContainer}>
        <View style={styles.monthHeaderBar}>
          <Text style={styles.monthHeaderText}>{item.month}</Text>
        </View>
        <View style={styles.monthGrid}>
          {item.data.map(record => renderRecordItem(record))}
        </View>
      </View>
    );
  };

  // 🌟 動態核心：計算成員列表的滑動與淡出動畫
  const blurOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // 當滑動距離達到 60px 到 160px 之間時，成員欄會流暢往上縮 45px 並化為透明
  const memberOpacity = scrollY.interpolate({
    inputRange: [60, 160],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const memberTranslateY = scrollY.interpolate({
    inputRange: [60, 160],
    outputRange: [0, -45],
    extrapolate: 'clamp',
  });

  if (!myUserId) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <View style={styles.fixedBackgroundLayer}>
        {isUploadingBg ? (
          <View style={styles.placeholderBackground}>
            <ActivityIndicator size="small" color="#333" />
          </View>
        ) : currentSpace?.backgroundImageUrl ? (
          <Image source={{ uri: currentSpace.backgroundImageUrl }} style={styles.backgroundImage} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderBackground}>
            <Feather name="image" size={32} color="#AAA" />
          </View>
        )}
        
        <LinearGradient colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.3)', 'transparent']} style={styles.topFaintGradient} pointerEvents="none" />
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255, 255, 255, 0.3)', '#FFFFFF']} style={styles.bottomFadeGradient} pointerEvents="none" />
        <Animated.View style={[styles.backgroundOverlay, { opacity: blurOpacity }]} pointerEvents="none" />
      </View>

      {/* 雙層懸浮導覽列 */}
      <View style={styles.fixedHeader} pointerEvents="box-none">
        {isSearchMode ? (
          <View style={styles.header}>
            <View style={styles.searchHeaderContainer}>
              <TouchableOpacity onPress={() => { setIsSearchMode(false); setSearchText(''); }}>
                <Feather name="arrow-left" size={24} color="#333" style={{ marginRight: 12 }} />
              </TouchableOpacity>
              <TextInput style={styles.searchInput} placeholder="搜尋地點、內容或日期..." placeholderTextColor="#999" autoFocus value={searchText} onChangeText={setSearchText} />
              {searchText && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Feather name="x-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.headerColumnWrapper} pointerEvents="box-none">
            
            {/* ⬆️ 上排元件：返回鍵與標題皆升級為透透黑底 */}
            <View style={styles.headerTopRow}>
              <View style={styles.headerTopLeft}>
                {/* 🌟 修正：返回鍵改成透明黑底圓鈕 */}
                <TouchableOpacity onPress={() => router.back()} style={styles.backCircleBtn}>
                  <Feather name="chevron-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                {/* 🌟 修正：空間名稱改成修長精緻的透明黑底膠囊 */}
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

            {/* ⬇️ 下排元件：成員列表（綁定滾動折疊動畫，且間距推開不碰到） */}
            <Animated.View 
              style={[
                styles.headerBottomRow, 
                { opacity: memberOpacity, transform: [{ translateY: memberTranslateY }] }
              ]}
            >
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', zIndex: 2 }} activeOpacity={0.7} onPress={() => currentSpace && setIsMembersModalVisible(true)}>
                {memberProfiles.slice(0, 3).map((profile, index) => (
                  // 🌟 修正：每個頭像右側加入間距，完全分離不重疊
                  <View key={index} style={[styles.avatarStackWrapper, { zIndex: 3 - index, marginLeft: index > 0 ? 6 : 0 }]}>
                    <View style={[styles.avatarBaseFrame, profile.isOnline && styles.avatarFrameOnline]}>
                      {profile.avatarUrl ? (
                        <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImageContent} />
                      ) : (
                        <Feather name="user" size={14} color="#FFF" />
                      )}
                    </View>
                    {profile.isOnline && <View style={styles.onlineStatusWhiteDot} />}
                  </View>
                ))}
                
                {memberProfiles.length > 3 && (
                   <View style={[styles.avatarStackWrapper, { zIndex: 0, marginLeft: 6 }]}>
                     <View style={styles.avatarMoreCircle}>
                       <Feather name="more-horizontal" size={14} color="#FFF" />
                     </View>
                   </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.addFriendCircleButton} 
                onPress={() => { currentSpace && currentSpace.inviteCode ? setIsInviteCodeVisible(true) : Alert.alert("提示", "請先切換到一個空間"); }}
              >
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
          <View style={styles.emptyStateContainer}>
            <Feather name={isSearchMode && searchText ? "search" : "image"} size={60} color="#E0E0E0" />
            <Text style={styles.emptyStateText}>{isSearchMode && searchText ? "找不到相符的紀錄" : "還沒有紀錄"}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => {
        if (!currentSpace) return Alert.alert("提示", "請先加入一個空間！");
        router.push({ pathname: '/upload', params: { currentSpaceId: currentSpace.id } });
      }}>
        <Feather name="plus" size={30} color="white" />
      </TouchableOpacity>

      {/* 選單與彈窗 */}
      {isSettingsMenuVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'transparent' }} activeOpacity={1} onPress={() => setIsSettingsMenuVisible(false)} />
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { 
              setIsSettingsMenuVisible(false); 
              setEditSpaceName(currentSpace?.name || ''); 
              setIsEditNameModalVisible(true); 
            }}>
              <Feather name="edit-2" size={18} color="#333" />
              <Text style={styles.menuItemText}>更改名稱</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => { 
              setIsSettingsMenuVisible(false); 
              handleSelectBackground(); 
            }}>
              <Feather name="image" size={18} color="#333" />
              <Text style={styles.menuItemText}>更換背景</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modals 保持功能穩定 */}
      <Modal visible={isEditNameModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>更改空間名稱</Text>
            <TextInput style={styles.modalInput} placeholder="輸入新名稱..." placeholderTextColor="#CCC" value={editSpaceName} onChangeText={setEditSpaceName} autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={[styles.modalCancelBtn, { flex: 1, marginRight: 10, backgroundColor: '#E0E0E0' }]} onPress={() => setIsEditNameModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: '#666' }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { flex: 1, marginLeft: 10, backgroundColor: '#333' }]} onPress={handleUpdateName}>
                <Text style={styles.modalConfirmText}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isInviteCodeVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <View style={styles.modalHeaderCloseRow}>
              <View style={{ width: 24 }} />
              <Text style={styles.modalTitleTextOnly}>邀請朋友加入</Text>
              <TouchableOpacity onPress={() => setIsInviteCodeVisible(false)}>
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>代碼分享給您的朋友：</Text>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText}>{currentSpace?.inviteCode || '------'}</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 15 }}>朋友可於空間列表輸入此代碼加入空間</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={isMembersModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <View style={styles.modalHeaderCloseRow}>
              <Text style={styles.modalTitleTextOnly}>空間成員 ({memberProfiles.length})</Text>
              <TouchableOpacity onPress={() => setIsMembersModalVisible(false)}>
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {memberProfiles.map((member, idx) => (
                <View key={idx} style={styles.memberListItem}>
                  <View style={styles.memberListAvatar}>
                    {member.avatarUrl ? <Image source={{ uri: member.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} /> : <Feather name="user" size={18} color="#FFF" />}
                  </View>
                  <Text style={styles.memberListText}>{member.name}</Text>
                  {member.isOnline && <Text style={{fontSize: 12, color: '#4CD964', marginLeft: 'auto', fontWeight: 'bold'}}>● 線上</Text>}
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
  container: { flex: 1, backgroundColor: '#FFFFFF' }, 
  fixedBackgroundLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: 380, backgroundColor: '#D9D9D9', zIndex: 1 },
  backgroundImage: { width: '100%', height: '100%' },
  placeholderBackground: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#D9D9D9' },
  backgroundOverlay: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, backgroundColor: 'rgba(255, 255, 255, 0.95)', zIndex: 4 },
  topFaintGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 220, zIndex: 3 },
  bottomFadeGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, zIndex: 2 },
  
  fixedHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: Platform.OS === 'ios' ? 55 : (StatusBar.currentHeight || 24) + 5 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 50 },
  headerColumnWrapper: { paddingHorizontal: 15, flexDirection: 'column' },
  
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 45, zIndex: 10 },
  headerTopLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  
  // 🌟 新增：返回鍵透透黑底樣式
  backCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  // 🌟 新增：空間名稱透透黑底膠囊樣式
  titlePillWrapper: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', maxWidth: windowWidth * 0.45 },
  spaceMainTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  
  headerRightButtons: { flexDirection: 'row', alignItems: 'center' },
  
  // 下排元件，zIndex 設低於上排，收縮時才會完美藏到後面
  headerBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingLeft: 46, zIndex: 1, height: 40 },
  
  avatarStackWrapper: { position: 'relative', width: 36, height: 36 }, 
  avatarBaseFrame: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCCCCC', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarFrameOnline: { borderWidth: 3.5, borderColor: '#FFFFFF' }, 
  avatarImageContent: { width: '100%', height: '100%', borderRadius: 16 },
  onlineStatusWhiteDot: { position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }, 
  avatarMoreCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#999', justifyContent: 'center', alignItems: 'center' },
  
  addFriendCircleButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', marginLeft: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', zIndex: 1 },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  searchHeaderContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, paddingHorizontal: 15, height: 40 },
  searchInput: { flex: 1, fontSize: 15, color: '#333', padding: 0 },
  
  flatListStyle: { flex: 1, zIndex: 10, backgroundColor: 'transparent' }, 
  listContentContainer: { paddingBottom: 120 },
  
  monthSectionContainer: { marginBottom: 12 },
  monthHeaderBar: { backgroundColor: '#FFFFFF', width: windowWidth, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 1, elevation: 1 },
  monthHeaderText: { fontSize: 14, color: '#111', fontWeight: '700' },
  
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  imageGrid: { width: imageSize, height: imageSize, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: '#EBEBEB', position: 'relative' },
  recordImage: { width: '100%', height: '100%' },
  placeholderGrid: { width: '100%', height: '100%', backgroundColor: '#EBEBEB' },
  multipleIcon: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4, zIndex: 5 },
  
  postCreatorAvatarContainer: { position: 'absolute', bottom: 8, left: 8, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#FFFFFF', overflow: 'hidden', backgroundColor: '#CCC', zIndex: 5 },
  postCreatorAvatar: { width: '100%', height: '100%' },
  postCreatorAvatarPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },

  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100, backgroundColor: '#FFFFFF' },
  emptyStateText: { fontSize: 16, fontWeight: '600', color: '#BBB', marginTop: 15 },
  fab: { position: 'absolute', bottom: 100, right: 25, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A7A7A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, zIndex: 90 },

  dropdownMenu: { position: 'absolute', top: Platform.OS === 'ios' ? 100 : 80, right: 15, width: 140, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 15, fontWeight: '500', color: '#333', marginLeft: 12 },
  menuDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 15, padding: 20 },
  modalHeaderCloseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20 },
  modalTitleTextOnly: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 15, textAlign: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 20, color: '#333' },
  modalCancelBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  modalCancelText: { fontSize: 16, color: '#666', fontWeight: '600' },
  modalConfirmBtn: { paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  modalConfirmText: { fontSize: 16, color: '#FFF', fontWeight: '600' },
  inviteCodeBox: { backgroundColor: '#F5F5F5', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, borderWidth: 2, borderColor: '#E0E0E0', borderStyle: 'dashed' },
  inviteCodeText: { fontSize: 32, fontWeight: '900', letterSpacing: 5, color: '#333' },
  memberListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  memberListAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', marginRight: 15, overflow: 'hidden' },
  memberListText: { fontSize: 16, color: '#333', fontWeight: '500' },
  // ✅ 純文字/心情小卡的底圖樣式
  pureTextGrid: {
    backgroundColor: '#F7F8FA', // 淡淡的質感灰底色
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF', // 加一點微弱的邊框看起來像小卡片
  },
  // ✅ 裡面的 Icon 或插圖樣式
  moodIcon: {
    marginBottom: 8,
    opacity: 0.8,
  },
  // ✅ 文字預覽樣式
  pureTextContent: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4,
  },
});