import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  FlatList, StatusBar, Modal, TextInput, Alert, Image,
  TouchableWithoutFeedback, Keyboard // ✅ 處理鍵盤收起
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { subscribeToUserSpaces, createNewSpace, getUserProfile, joinSpaceByCode, subscribeToMyNotifications, updateUserProfile } from './firebaseServices'; 

// 🌟 引入全域主題 Context
import { useAppTheme } from './ThemeContext';

export default function SpaceListScreen() {
  const router = useRouter();
  
  // 🌟 從全域主題中撈取當前的 theme 設定
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;

  const [myUserId, setMyUserId] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [memberProfiles, setMemberProfiles] = useState({});
  
  // 改回三種狀態：'options' (選單), 'create' (建立), 'join' (加入)
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('options'); 
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (fetchedSpaces) => {
      // 加上這段排序邏輯：把最新建立的排在最上面
      const sortedSpaces = [...fetchedSpaces].sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeA - timeB; 
      });
      setSpaces(sortedSpaces);
    });
    return () => unsubscribe();
  }, [myUserId]);

  useEffect(() => {
    if (!myUserId) return;
    
    const unsubscribe = subscribeToMyNotifications(myUserId, (notifs) => {
      const hasUnread = notifs.some(n => n.isRead === false);
      setHasUnreadNotifications(hasUnread);
    });
    
    return () => unsubscribe();
  }, [myUserId]);
  
  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      if (!storedId) {
        storedId = 'user_' + Date.now();
        await AsyncStorage.setItem('@my_device_user_id', storedId);
      }
      setMyUserId(storedId);
      let profile = await getUserProfile(storedId);
      
      if (!profile) {
        const defaultAvatars = [
          "https://raw.githubusercontent.com/jael1118/appimg/main/img_1780773971807_vchtqx.jpg?raw=true",
          "https://raw.githubusercontent.com/jael1118/appimg/main/img_1780773970686_9xxhpq.jpg?raw=true",
          "https://raw.githubusercontent.com/jael1118/appimg/main/img_1780773969404_9wnp6d.jpg?raw=true"
        ];
        const randomIndex = Math.floor(Math.random() * defaultAvatars.length);

        const newProfile = {
          name: "美麗陌生人", 
          avatarUrl: defaultAvatars[randomIndex], 
          isOnline: true,
          createdAt: Date.now()
        };
        
        await updateUserProfile(storedId, newProfile);
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    const fetchAvatars = async () => {
      if (spaces.length === 0) return;
      
      const newProfiles = { ...memberProfiles };
      let hasNew = false;
      
      const allMemberIds = new Set();
      spaces.forEach(space => {
        if (space.members) space.members.forEach(id => allMemberIds.add(id));
      });

      for (const id of allMemberIds) {
        if (newProfiles[id] === undefined) {
          try {
            const profile = await getUserProfile(id);
            newProfiles[id] = profile?.avatarUrl || null;
            hasNew = true;
          } catch (error) {
            newProfiles[id] = null;
          }
        }
      }

      if (hasNew) setMemberProfiles(newProfiles);
    };

    fetchAvatars();
  }, [spaces]);

  const handleConfirmAction = async () => {
    if (!inputValue.trim()) {
      Alert.alert("提示", modalMode === 'create' ? "請輸入空間名稱！" : "請輸入邀請碼！");
      return;
    }
    
    setIsProcessing(true);
    try {
      if (modalMode === 'create') {
        const result = await createNewSpace(inputValue, myUserId);
        if (result) {
          Alert.alert("建立成功", `快把邀請碼 ${result.inviteCode} 分享給朋友吧！`);
        }
      } else {
        const result = await joinSpaceByCode(inputValue, myUserId);
        if (result) {
          Alert.alert("加入成功", `已成功加入 ${result.name}！`);
        }
      }
      setIsAddModalVisible(false);
      setInputValue('');
    } catch (error) {
      Alert.alert("錯誤", modalMode === 'create' ? "建立空間失敗" : "加入空間失敗，請確認邀請碼是否正確。");
    } finally {
      setIsProcessing(false);
    }
  };

  const renderSpaceCard = ({ item }) => {
    const membersList = Array.isArray(item.members) && item.members.length > 0 ? item.members : [myUserId];

    return (
      <TouchableOpacity 
        style={[styles.spaceCard, { backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF' }]}
        activeOpacity={0.8}
        onPress={() => {
          router.push({
            pathname: '/space',
            params: { spaceId: item.id, spaceName: item.name }
          });
        }}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.cardImagePlaceholder, !item.backgroundImageUrl && { backgroundColor: darkMode ? '#2C2C2E' : '#EBEBEB' }]}>
            {item.backgroundImageUrl && (
              <Image source={{ uri: item.backgroundImageUrl }} style={styles.cardBgImage} resizeMode="cover" />
            )}
            <View style={[styles.cardNameOverlay, { backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)' }]}>
              <Text style={[styles.cardSpaceName, { color: darkMode ? '#FFFFFF' : '#111111' }]} numberOfLines={1}>{item.name}</Text>
            </View>
          </View>
          
          <View style={styles.avatarGroup} key={JSON.stringify(memberProfiles)}>
            {membersList.slice(0, 3).map((memberId, index) => {
              const avatarUrl = memberProfiles[memberId];

              return (
                <View key={index} style={[styles.avatarWrapper, { backgroundColor: darkMode ? '#333333' : '#CCCCCC' }, index > 0 && { marginLeft: 8 }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={16} color="#FFF" />
                  )}
                </View>
              );
            })}

            {membersList.length > 3 && (
               <View style={[styles.avatarWrapper, { marginLeft: 8, backgroundColor: darkMode ? '#444446' : '#999999' }]}>
                 <Feather name="more-horizontal" size={14} color="#FFF" />
               </View>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={20} color={theme.text} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>空間列表</Text>
          <TouchableOpacity 
            style={[styles.addSpaceBtn, { backgroundColor: darkMode ? '#1E1E1E' : '#E5E5EA' }]} 
            onPress={() => {
              setModalMode('options'); 
              setInputValue('');
              setIsAddModalVisible(true);
            }}
          >
            <Feather name="plus" size={14} color={theme.text} />
            <Text style={[styles.addSpaceBtnText, { color: theme.text }]}>新增空間</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: darkMode ? '#1E1E1E' : '#E5E5EA' }]} onPress={() => router.push('/notifications')}>
            <Feather name="bell" size={18} color={theme.text} />
            {hasUnreadNotifications && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        renderItem={renderSpaceCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.valueText }]}>Currently, there are no spaces. Create one now!</Text>
          </View>
        }
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} activeOpacity={0.8} onPress={() => router.push('/upload')}>
        <Feather name="plus" size={30} color={darkMode ? '#000000' : '#FFFFFF'} />
      </TouchableOpacity>

      {/* 兩階段式 Modal */}
      <Modal visible={isAddModalVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {
            Keyboard.dismiss(); 
            setIsAddModalVisible(false);
          }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[styles.modalContent, { backgroundColor: theme.modalBg }]}>
              
              {modalMode === 'options' ? (
                // 🔹 第一階段：選單模式
                <View>
                  <View style={styles.modalHeader}>
                    <View style={{ width: 24 }} /> 
                    <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>新增或加入</Text>
                    <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                      <Feather name="x" size={24} color={theme.text} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={[styles.optionBtn, { backgroundColor: darkMode ? '#2C2C2E' : '#FAFAFA', borderColor: theme.inputBorder }]} onPress={() => setModalMode('create')}>
                    <Feather name="plus-circle" size={20} color={theme.text} />
                    <Text style={[styles.optionBtnText, { color: theme.text }]}>建立新空間</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.optionBtn, { backgroundColor: darkMode ? '#2C2C2E' : '#FAFAFA', borderColor: theme.inputBorder }]} onPress={() => setModalMode('join')}>
                    <Feather name="log-in" size={20} color={theme.text} />
                    <Text style={[styles.optionBtnText, { color: theme.text }]}>輸入邀請碼加入</Text>
                  </TouchableOpacity>
                </View>

              ) : (
                // 🔹 第二階段：輸入模式 (建立 or 加入)
                <View>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setModalMode('options')}>
                      <Feather name="arrow-left" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>
                      {modalMode === 'create' ? '建立新空間' : '加入空間'}
                    </Text>
                    <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                      <Feather name="x" size={24} color={theme.text} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.modalSubtitle, { color: theme.subText }]}>
                    {modalMode === 'create' ? '為空間取個名字' : '請輸入邀請碼'}
                  </Text>

                  <TextInput
                    style={[styles.modalInput, { backgroundColor: darkMode ? '#2C2C2E' : '#F5F5F5', color: theme.text, borderColor: theme.inputBorder }]}
                    placeholder={modalMode === 'create' ? "輸入名稱..." : "例如: A7X9WQ"}
                    placeholderTextColor={darkMode ? '#555555' : '#CCCCCC'}
                    value={inputValue}
                    onChangeText={setInputValue}
                    autoCapitalize={modalMode === 'join' ? "characters" : "none"}
                    maxLength={modalMode === 'join' ? 6 : 20}
                    autoFocus
                  />

                  <TouchableOpacity 
                    style={[
                      styles.joinBtn, 
                      inputValue.trim().length > 0 ? (darkMode ? styles.joinBtnActiveDark : styles.joinBtnActive) : null
                    ]} 
                    disabled={inputValue.trim().length === 0 || isProcessing || (modalMode === 'join' && inputValue.length !== 6)}
                    onPress={handleConfirmAction}
                  >
                    <Text style={[styles.joinBtnText, inputValue.trim().length > 0 && { color: darkMode ? '#000000' : '#FFFFFF' }]}>
                      {isProcessing ? "處理中..." : "確認"}
                    </Text>
                  </TouchableOpacity>
                </View>
                
              )}

            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent:'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', marginRight: 15 },
  addSpaceBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  addSpaceBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 4 },

  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  notificationDot: { 
    position: 'absolute', 
    top: 6, 
    right: 8, 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#FF3B30' 
  },
  listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  
  spaceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 12, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  
  cardImagePlaceholder: { width: 100, height: 60, borderRadius: 8, overflow: 'hidden' },
  cardBgImage: { position: 'absolute', width: '100%', height: '100%' },
  cardNameOverlay: { flex: 1, justifyContent: 'flex-end', padding: 8 },
  cardSpaceName: { fontSize: 13, fontWeight: '700' },
  
  avatarGroup: { flexDirection: 'row', alignItems: 'center', marginLeft: 15 },
  avatarWrapper: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyStateText: { fontSize: 15 },

  fab: { position: 'absolute', right: 25, bottom: 100, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', borderRadius: 20, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 14, marginBottom: 15, textAlign: 'center' },
  
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderWidth: 1, borderRadius: 10, marginBottom: 10 },
  optionBtnText: { fontSize: 16, fontWeight: '600', marginLeft: 12 },

  modalInput: { borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 20, borderWidth: 1 },
  
  joinBtn: { backgroundColor: '#CCCCCC', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  joinBtnActive: { backgroundColor: '#111111' },
  joinBtnActiveDark: { backgroundColor: '#FFFFFF' }, // 深色模式下啟動時按鈕轉純白
  joinBtnText: { color: '#8E8E93', fontWeight: 'bold', fontSize: 16 },
});