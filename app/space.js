import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, Text, View, FlatList, SafeAreaView,
  TouchableOpacity, Dimensions, StatusBar, Modal, TextInput, Image, Alert, ScrollView,
  ActivityIndicator, Animated, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useRouter, useLocalSearchParams } from 'expo-router'; 
import * as ImagePicker from 'expo-image-picker'; 
import { LinearGradient } from 'expo-linear-gradient'; 

import { 
  joinSpaceByCode, subscribeToSpaceRecords, createNewSpace, 
  subscribeToUserSpaces, uploadImageToGitHub, updateSpaceBackground, getUserProfile,
  updateSpaceName 
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

  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    const fetchMembers = async () => {
      if (currentSpace && currentSpace.members && currentSpace.members.length > 0) {
        try {
          const profiles = await Promise.all(
            currentSpace.members.map(async (id) => {
              const profile = await getUserProfile(id);
              return profile || { id, name: '空間成員', avatarUrl: null };
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
  }, [currentSpace?.members]);

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

  const handleConfirmAction = async () => {
    if (!myUserId) return;
    if (spaceModalMode === 'join') {
      const result = await joinSpaceByCode(inputValue, myUserId);
      if (result) {
        setCurrentSpace({ id: result.spaceId, name: result.name }); 
        Alert.alert("成功加入", `已成功加入 ${result.name}`);
        setIsSpaceModalVisible(false); 
      }
    } else {
      const result = await createNewSpace(inputValue, myUserId);
      if (result) {
        setCurrentSpace({ id: result.spaceId, name: result.name, inviteCode: result.inviteCode });
        Alert.alert("創建成功！", `邀請碼為：${result.inviteCode}\n快把代碼分享給朋友吧！`);
        setIsSpaceModalVisible(false); 
      }
    }
    setInputValue('');
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
          <>
            <Image source={{ uri: firstImage }} style={styles.recordImage} resizeMode="cover" />
            {isMultiple && (
              <View style={styles.multipleIcon}>
                <Feather name="layers" size={14} color="white" />
              </View>
            )}
          </>
        ) : (
          <View style={styles.placeholderGrid} />
        )}
      </TouchableOpacity>
    );
  };

  const renderMonthSection = ({ item }) => {
    return (
      <View style={styles.monthSectionContainer}>
        <Text style={styles.monthHeaderText}>{item.month}</Text>
        <View style={styles.monthGrid}>
          {item.data.map(record => renderRecordItem(record))}
        </View>
      </View>
    );
  };

  const blurOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [0, 1],
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
          <Image 
            source={{ uri: currentSpace.backgroundImageUrl }} 
            style={styles.backgroundImage} 
            resizeMode="cover" 
          />
        ) : (
          <View style={styles.placeholderBackground}>
            <Feather name="image" size={32} color="#AAA" />
          </View>
        )}
        
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent']} style={styles.topFaintGradient} pointerEvents="none" />
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255, 255, 255, 0.3)', '#FFFFFF']} style={styles.bottomFadeGradient} pointerEvents="none" />
        <Animated.View style={[styles.backgroundOverlay, { opacity: blurOpacity }]} pointerEvents="none" />
      </View>

      <View style={styles.fixedHeader}>
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
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
                <Feather name="chevron-left" size={28} color="#111" />
              </TouchableOpacity>

              <View style={styles.spaceNamePill}>
                <Text style={styles.categoryText} numberOfLines={1}>
                  {currentSpace ? currentSpace.name : "..."}
                </Text>
              </View>

              <View style={styles.friendsContainer}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' , zIndex: 2 }} activeOpacity={0.7} onPress={() => currentSpace && setIsMembersModalVisible(true)}>
                  {memberProfiles.slice(0, 3).map((profile, index) => (
                    <View key={index} style={[styles.avatar, { zIndex: 3 - index, marginLeft: index > 0 ? -12 : 0, justifyContent: 'center', alignItems: 'center', backgroundColor: profile.avatarUrl ? 'transparent' : '#CCC' }]}>
                      {profile.avatarUrl ? (
                        <Image source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 16 }} />
                      ) : (
                        <Feather name="user" size={16} color="#FFF" />
                      )}
                    </View>
                  ))}
                  {memberProfiles.length > 3 && (
                     <View style={[styles.avatar, { zIndex: 0, marginLeft: -12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#999' }]}>
                       <Feather name="more-horizontal" size={14} color="#FFF" />
                     </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.addFriendBtn, { zIndex: 1 },memberProfiles.length === 0 && { marginLeft: 0 }]} 
                  onPress={() => { currentSpace && currentSpace.inviteCode ? setIsInviteCodeVisible(true) : Alert.alert("提示", "請先切換到一個空間"); }}
                >
                  <Feather name="plus" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsSearchMode(true)}>
                <Feather name="search" size={18} color="#333" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsSettingsMenuVisible(true)}>
                <Feather name="more-horizontal" size={18} color="#333" />
              </TouchableOpacity>
            </View>
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
        ListHeaderComponent={<View><TouchableOpacity style={{ height: 260, width: '100%' }} activeOpacity={1} /></View>}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <Feather name={isSearchMode && searchText ? "search" : "image"} size={60} color="#E0E0E0" />
            <Text style={styles.emptyStateText}>{isSearchMode && searchText ? "找不到相符的紀錄" : "還沒有紀錄"}</Text>
          </View>
        }
      />

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          if (!currentSpace) return Alert.alert("提示", "請先加入一個空間！");
          router.push({ pathname: '/upload', params: { currentSpaceId: currentSpace.id } });
        }}
      >
        <Feather name="plus" size={30} color="white" />
      </TouchableOpacity>

      {isSettingsMenuVisible && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]}>
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'transparent' }} 
            activeOpacity={1} 
            onPress={() => setIsSettingsMenuVisible(false)}
          />
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

      {/* Modals */}
      <Modal visible={isEditNameModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>更改空間名稱</Text>
            <TextInput style={styles.modalInput} placeholder="輸入新名稱..." placeholderTextColor="#CCC" value={editSpaceName} onChangeText={setEditSpaceName} autoFocus />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={[styles.modalCancelBtn, { flex: 1, marginRight: 10, backgroundColor: '#E0E0E0' }]} onPress={() => setIsEditNameModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: '#666' }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, styles.joinBtnActive, { flex: 1, marginLeft: 10 }]} onPress={handleUpdateName}>
                <Text style={styles.modalConfirmText}>儲存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isInviteCodeVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <View style={styles.modalHeader}>
              <View style={{ width: 24 }} />
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>邀請朋友加入</Text>
              <TouchableOpacity onPress={() => setIsInviteCodeVisible(false)}>
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>代碼分享給您的朋友：</Text>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText}>{currentSpace?.inviteCode || '------'}</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#999', marginTop: 15 }}>朋友可於左上角輸入此代碼加入空間</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={isMembersModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>空間成員 ({memberProfiles.length})</Text>
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
  topFaintGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 130, zIndex: 3 },
  bottomFadeGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, zIndex: 2 },
  fixedHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10, minHeight: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row' },
  searchHeaderContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, paddingHorizontal: 15, height: 40 },
  searchInput: { flex: 1, fontSize: 15, color: '#333', padding: 0 },
  spaceNamePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxWidth: 130 },
  categoryText: { fontSize: 15, fontWeight: '600', color: '#111' },
  friendsContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCCCCC', borderWidth: 1, borderColor: '#FFF' },
  addFriendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', marginLeft: -12, borderWidth: 1, borderColor: '#FFF' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  flatListStyle: { flex: 1, zIndex: 10, backgroundColor: 'transparent' }, 
  listContentContainer: { paddingBottom: 120 },
  monthSectionContainer: { marginBottom: 5 },
  monthHeaderText: { fontSize: 13, color: '#333', fontWeight: '600', paddingHorizontal: 20, paddingVertical: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  imageGrid: { width: imageSize, height: imageSize, borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: '#EBEBEB' },
  recordImage: { width: '100%', height: '100%' },
  placeholderGrid: { width: '100%', height: '100%', backgroundColor: '#EBEBEB' },
  multipleIcon: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4 },
  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100, backgroundColor: '#FFFFFF' },
  emptyStateText: { fontSize: 16, fontWeight: '600', color: '#BBB', marginTop: 15 },
  
  // ✅ 修改：FAB 往上抬一點，避開導覽列
  fab: { position: 'absolute', bottom: 100, right: 25, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A7A7A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, zIndex: 90 },

  dropdownMenu: { position: 'absolute', top: Platform.OS === 'ios' ? 100 : 80, right: 15, width: 140, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 15, fontWeight: '500', color: '#333', marginLeft: 12 },
  menuDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 15, padding: 20 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 15, textAlign: 'center' },
  
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 20, color: '#333' },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalCancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', marginRight: 10, borderRadius: 10, backgroundColor: '#F0F0F0' },
  modalCancelText: { fontSize: 16, color: '#666', fontWeight: '600' },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', marginLeft: 10, borderRadius: 10, backgroundColor: '#333' },
  modalConfirmText: { fontSize: 16, color: '#FFF', fontWeight: '600' },
  joinBtn: { backgroundColor: '#CCCCCC', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  joinBtnActive: { backgroundColor: '#333333' },
  joinBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  inviteCodeBox: { backgroundColor: '#F5F5F5', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, borderWidth: 2, borderColor: '#E0E0E0', borderStyle: 'dashed' },
  inviteCodeText: { fontSize: 32, fontWeight: '900', letterSpacing: 5, color: '#333' },
  memberListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  memberListAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', marginRight: 15, overflow: 'hidden' },
  memberListText: { fontSize: 16, color: '#333', fontWeight: '500' }
});