import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, FlatList, 
  TouchableOpacity, Dimensions, StatusBar, Modal, TextInput, Image, Alert, ScrollView,
  ActivityIndicator, Animated, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useRouter } from 'expo-router'; 
import * as ImagePicker from 'expo-image-picker'; 
// ✅ 引入漸層神器
import { LinearGradient } from 'expo-linear-gradient'; 

import { 
  joinSpaceByCode, subscribeToSpaceRecords, createNewSpace, 
  subscribeToUserSpaces, uploadImageToGitHub, updateSpaceBackground, getUserProfile 
} from './firebaseServices'; 

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const numColumns = 3;
const imageSize = windowWidth / numColumns;

export default function App() {
  const router = useRouter();

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
        setCurrentSpace(spaces[0]);
      } else if (currentSpace) {
        const updatedSpace = spaces.find(s => s.id === currentSpace.id);
        if (updatedSpace) setCurrentSpace(updatedSpace);
      }
    });
    return () => unsubscribe();
  }, [myUserId, currentSpace?.id]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (currentSpace && currentSpace.members && currentSpace.members.length > 0) {
        try {
          const profiles = await Promise.all(
            currentSpace.members.map(async (id) => {
              const profile = await getUserProfile(id);
              // ✅ 防呆機制：如果 firebase 沒大頭貼，給一個預設物件
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
    if (!currentSpace) {
      Alert.alert("提示", "請先選擇一個空間！");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("權限不足", "需要相簿權限才能更換背景圖喔！");
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, 
      aspect: [16, 9], 
      quality: 0.8,
      base64: true, 
    });
    if (!result.canceled && result.assets[0].base64) {
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
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const timeMatch = dateStr.includes(query) || timeStr.includes(query);
    return noteMatch || locMatch || timeMatch;
  });

  const renderItem = ({ item }) => {
    const firstImage = item.imageUrls ? item.imageUrls[0] : item.imageUrl;
    const isMultiple = item.imageUrls && item.imageUrls.length > 1;

    return (
      <TouchableOpacity 
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

  const blurOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (!myUserId) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* ==============================================================
          1. 固定在底層的背景區塊
      ============================================================== */}
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
        
        {/* ✅ 1. 頂部深色漸層 (從 40% 黑，越往下越變透明，無硬邊線) */}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent']}
          style={styles.topFaintGradient}
          pointerEvents="none"
        />

        {/* ✅ 2. 底部變淡漸層 (從透明，越往下變成跟貼文背景一樣的純白，讓圖片邊緣融化) */}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255, 255, 255, 0.3)', '#FFFFFF']}
          style={styles.bottomFadeGradient}
          pointerEvents="none"
        />
        
        {/* 滑動模糊遮罩層 */}
        <Animated.View style={[styles.backgroundOverlay, { opacity: blurOpacity }]} pointerEvents="none" />
      </View>

      {/* ==============================================================
          2. 頂部懸浮 Header
      ============================================================== */}
      <View style={styles.fixedHeader}>
        {isSearchMode ? (
          <View style={styles.header}>
            <View style={styles.searchHeaderContainer}>
              <TouchableOpacity onPress={() => { setIsSearchMode(false); setSearchText(''); }}>
                <Feather name="arrow-left" size={24} color="#333" style={{ marginRight: 12 }} />
              </TouchableOpacity>
              <TextInput
                style={styles.searchInput}
                placeholder="搜尋地點、內容或日期..."
                placeholderTextColor="#999"
                autoFocus
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText ? (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Feather name="x-circle" size={18} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity 
                style={styles.categorySelector} 
                onPress={() => { setSpaceModalMode('list'); setIsSpaceModalVisible(true); }}
              >
                <Text style={styles.categoryText} numberOfLines={1}>
                  {currentSpace ? currentSpace.name : "選擇空間"}
                </Text>
                <Feather name="chevron-down" size={18} color="#333" />
              </TouchableOpacity>

              <View style={styles.friendsContainer}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center' , zIndex: 2 }}
                  activeOpacity={0.7}
                  onPress={() => currentSpace && setIsMembersModalVisible(true)}
                >
                  {memberProfiles.slice(0, 3).map((profile, index) => (
                    <View 
                      key={index} 
                      style={[styles.avatar, { zIndex: 3 - index, marginLeft: index > 0 ? -12 : 0, justifyContent: 'center', alignItems: 'center', backgroundColor: profile.avatarUrl ? 'transparent' : '#CCC' }]}
                    >
                      {/* ✅ 判斷有沒有頭貼，沒有就給預設 icon */}
                      {profile.avatarUrl ? (
                        <Image source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 16 }} />
                      ) : (
                        <Feather name="user" size={16} color="#FFF" />
                      )}
                    </View>
                  ))}
                  {/* 人數超過 3 個，多顯示一個提示圈圈 */}
                  {memberProfiles.length > 3 && (
                     <View style={[styles.avatar, { zIndex: 0, marginLeft: -12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#999' }]}>
                       <Feather name="more-horizontal" size={14} color="#FFF" />
                     </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.addFriendBtn, { zIndex: 1 },memberProfiles.length === 0 && { marginLeft: 0 }]} 
                  onPress={() => {
                    if(currentSpace && currentSpace.inviteCode) {
                      setIsInviteCodeVisible(true);
                    } else {
                      Alert.alert("提示", "請先建立或切換到一個空間");
                    }
                  }}
                >
                  <Feather name="plus" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconCircleBtn} onPress={handleSelectBackground}>
                <Feather name="edit-2" size={18} color="#333" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsSearchMode(true)}>
                <Feather name="search" size={18} color="#333" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ==============================================================
          3. 滑動的內容區塊
      ============================================================== */}
      <Animated.FlatList
        data={filteredRecords}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        style={styles.flatListStyle}
        contentContainerStyle={[
          styles.listContentContainer,
          records.length === 0 && { paddingBottom: windowHeight }
        ]}
        
        ListHeaderComponent={
          <View>
            <TouchableOpacity 
               style={{ height: 260, width: '100%' }} // 設定這塊透明區塊高度，讓圖片透出來
               activeOpacity={1} 
               onPress={handleSelectBackground} 
            />
            
            <View style={styles.contentHeader}>
              {isSearchMode && searchText ? (
                <Text style={styles.searchResultText}>找到 {filteredRecords.length} 筆結果</Text>
              ) : null}
              <Text style={styles.titleText}>{currentSpace ? currentSpace.name : ""}</Text>
            </View>
          </View>
        }
        
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <Feather name={isSearchMode && searchText ? "search" : "image"} size={60} color="#E0E0E0" />
            <Text style={styles.emptyStateText}>
              {isSearchMode && searchText ? "找不到相符的紀錄" : "還沒有紀錄"}
            </Text>
          </View>
        }
      />

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          if (!currentSpace) {
            Alert.alert("提示", "請先創建或加入一個空間再新增紀錄！");
            return;
          }
          router.push({
            pathname: '/upload',
            params: { currentSpaceId: currentSpace.id }
          });
        }}
      >
        <Feather name="plus" size={30} color="white" />
      </TouchableOpacity>

      {/* ==============================================================
          Modals 區塊
      ============================================================== */}
      <Modal visible={isSpaceModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, spaceModalMode === 'list' && { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              {spaceModalMode === 'list' ? (
                <Text style={styles.modalTitle}>空間列表</Text>
              ) : (
                <TouchableOpacity onPress={() => setSpaceModalMode('list')}>
                  <Feather name="arrow-left" size={24} color="black" />
                </TouchableOpacity>
              )}
              {spaceModalMode !== 'list' && (
                 <Text style={styles.modalTitle}>{spaceModalMode === 'join' ? '加入空間' : '創建新空間'}</Text>
              )}
              <TouchableOpacity onPress={() => setIsSpaceModalVisible(false)}>
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>
            
            {spaceModalMode === 'list' && (
              <>
                <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 15 }}>
                  {mySpaces.map(space => (
                    <TouchableOpacity 
                      key={space.id} 
                      style={[styles.spaceListItem, currentSpace?.id === space.id && styles.spaceListActive]}
                      onPress={() => {
                        setCurrentSpace(space);
                        setIsSpaceModalVisible(false);
                      }}
                    >
                      <Text style={[styles.spaceListText, currentSpace?.id === space.id && {color: 'white'}]}>{space.name}</Text>
                      {currentSpace?.id === space.id && <Feather name="check" size={20} color="white" />}
                    </TouchableOpacity>
                  ))}
                  {mySpaces.length === 0 && <Text style={{ textAlign: 'center', color: '#999', padding: 20 }}>尚無空間</Text>}
                </ScrollView>
                <View style={{ borderTopWidth: 1, borderColor: '#EEEEEE', paddingTop: 15 }}>
                  <TouchableOpacity style={styles.optionBtn} onPress={() => { setSpaceModalMode('create'); setInputValue(''); }}>
                    <Feather name="plus-circle" size={20} color="#333" />
                    <Text style={styles.optionBtnText}>創建新空間</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.optionBtn} onPress={() => { setSpaceModalMode('join'); setInputValue(''); }}>
                    <Feather name="log-in" size={20} color="#333" />
                    <Text style={styles.optionBtnText}>輸入邀請碼加入</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {spaceModalMode !== 'list' && (
              <View>
                <Text style={styles.modalSubtitle}>{spaceModalMode === 'join' ? '請輸入邀請碼' : '為空間取個名字'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={spaceModalMode === 'join' ? "例如: A7X9WQ" : "輸入名稱..."}
                  placeholderTextColor="#CCC"
                  value={inputValue}
                  onChangeText={setInputValue}
                  autoCapitalize={spaceModalMode === 'join' ? "characters" : "none"}
                  maxLength={spaceModalMode === 'join' ? 6 : 20}
                />
                <TouchableOpacity 
                  style={[styles.joinBtn, inputValue.trim().length > 0 ? styles.joinBtnActive : null]} 
                  disabled={inputValue.trim().length === 0 || (spaceModalMode === 'join' && inputValue.length !== 6)}
                  onPress={handleConfirmAction}
                >
                  <Text style={styles.joinBtnText}>確認</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={isInviteCodeVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <View style={[styles.modalHeader, { width: '100%', marginBottom: 10 }]}>
              <View style={{ width: 24 }} />
              <Text style={styles.modalTitle}>邀請朋友加入</Text>
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

      {/* ✅ 顯示空間成員名單 Modal */}
      <Modal visible={isMembersModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>空間成員 ({memberProfiles.length})</Text>
              <TouchableOpacity onPress={() => setIsMembersModalVisible(false)}>
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {memberProfiles.map((member, idx) => (
                <View key={idx} style={styles.memberListItem}>
                  <View style={styles.memberListAvatar}>
                    {member.avatarUrl ? (
                      <Image source={{ uri: member.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
                    ) : (
                      <Feather name="user" size={18} color="#FFF" />
                    )}
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
  container: { flex: 1, backgroundColor: '#FFFFFF' }, // 背景為白，滑上去才能無縫接合
  
  // ==================== 底層背景區塊 ====================
  fixedBackgroundLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 380, // 加長讓漸層有空間發揮
    backgroundColor: '#D9D9D9', zIndex: 1
  },
  backgroundImage: { width: '100%', height: '100%' },
  placeholderBackground: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#D9D9D9' },
  backgroundOverlay: {
    position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', zIndex: 4 // 滑動模糊的純白遮罩
  },
  // ✅ 修改：完美的頂部無邊界漸層
  topFaintGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 130,
    zIndex: 3
  },
  // ✅ 新增：底部的白色漸層，讓圖片與貼文無縫融合
  bottomFadeGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, // 漸層的高度，越大漸層越平滑
    zIndex: 2
  },

  // ==================== 頂部懸浮 Header ====================
  fixedHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, 
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10, minHeight: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row' },
  searchHeaderContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, paddingHorizontal: 15, height: 40 },
  searchInput: { flex: 1, fontSize: 15, color: '#333', padding: 0 },
  
  categorySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxWidth: 130 },
  categoryText: { fontSize: 15, fontWeight: '500', marginRight: 6, color: '#333' },
  friendsContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCCCCC', borderWidth: 1, borderColor: '#FFF' },
  addFriendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', marginLeft: -12, borderWidth: 1, borderColor: '#FFF' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  // ==================== 滑動內容區塊 ====================
  flatListStyle: { flex: 1, zIndex: 10, backgroundColor: 'transparent' }, 
  listContentContainer: { paddingBottom: 120 },
  
  // 內容表頭 (白底，無縫連接貼文)
  contentHeader: { 
    alignItems: 'flex-end', justifyContent: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 15, 
// 與下面貼文白框同色，完美銜接
  },
  searchResultText: { fontSize: 13, color: '#666', marginBottom: 5 },
  titleText: { fontSize: 20, color: '#333', fontWeight: '700' }, 

  // 貼文區塊 (用白色邊框製造框線，保留灰底)
  imageGrid: { 
    width: imageSize, height: imageSize, 
    borderWidth: 1, borderColor: '#FFFFFF', 
    backgroundColor: '#EBEBEB' 
  },
  recordImage: { width: '100%', height: '100%' },
  placeholderGrid: { width: '100%', height: '100%', backgroundColor: '#EBEBEB' },
  multipleIcon: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4 },
  
  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100, backgroundColor: '#FFFFFF' },
  emptyStateText: { fontSize: 16, fontWeight: '600', color: '#BBB', marginTop: 15 },
  
  // ==================== FAB 與 Modals ====================
  fab: { position: 'absolute', bottom: 110, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A7A7A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, zIndex: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 15, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 15, textAlign: 'center' },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: '#EEEEEE', borderRadius: 10, marginBottom: 8, backgroundColor: '#FAFAFA' },
  optionBtnText: { fontSize: 15, fontWeight: '600', marginLeft: 10, color: '#333' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'center', letterSpacing: 1, marginBottom: 20 },
  joinBtn: { backgroundColor: '#CCCCCC', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  joinBtnActive: { backgroundColor: '#333333' },
  joinBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  spaceListItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderRadius: 8, marginBottom: 8, backgroundColor: '#F5F5F5' },
  spaceListActive: { backgroundColor: '#333' },
  spaceListText: { fontSize: 16, fontWeight: '600', color: '#333' },
  inviteCodeBox: { backgroundColor: '#F5F5F5', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 10, borderWidth: 2, borderColor: '#E0E0E0', borderStyle: 'dashed' },
  inviteCodeText: { fontSize: 32, fontWeight: '900', letterSpacing: 5, color: '#333' },

  // ✅ 成員列表 Modal 的樣式
  memberListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  memberListAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', marginRight: 15, overflow: 'hidden' },
  memberListText: { fontSize: 16, color: '#333', fontWeight: '500' }
});