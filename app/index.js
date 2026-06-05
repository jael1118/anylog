import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  FlatList, StatusBar, Modal, TextInput, Alert, Image,
  TouchableWithoutFeedback, Keyboard // ✅ 引入這兩個來處理鍵盤收起
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { subscribeToUserSpaces, createNewSpace, getUserProfile, joinSpaceByCode, subscribeToMyNotifications } from './firebaseServices'; 

export default function SpaceListScreen() {
  const router = useRouter();
  
  const [myUserId, setMyUserId] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [memberProfiles, setMemberProfiles] = useState({});
  
  // ✅ 改回三種狀態：'options' (選單), 'create' (建立), 'join' (加入)
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('options'); 
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  useEffect(() => {
    if (!myUserId) return;
    
    const unsubscribe = subscribeToMyNotifications(myUserId, (notifs) => {
      // 檢查有沒有任何一筆是未讀的 (isRead === false)
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
    };
    initialize();
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (fetchedSpaces) => {
      setSpaces(fetchedSpaces);
    });
    return () => unsubscribe();
  }, [myUserId]);

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
        style={styles.spaceCard}
        activeOpacity={0.8}
        onPress={() => {
          router.push({
            pathname: '/space',
            params: { spaceId: item.id, spaceName: item.name }
          });
        }}
      >
        <View style={styles.cardLeft}>
          <View style={[styles.cardImagePlaceholder, !item.backgroundImageUrl && { backgroundColor: '#EBEBEB' }]}>
            {item.backgroundImageUrl && (
              <Image source={{ uri: item.backgroundImageUrl }} style={styles.cardBgImage} resizeMode="cover" />
            )}
            <View style={styles.cardNameOverlay}>
              <Text style={styles.cardSpaceName} numberOfLines={1}>{item.name}</Text>
            </View>
          </View>
          
          <View style={styles.avatarGroup}>
            {membersList.slice(0, 3).map((memberId, index) => {
              const avatarUrl = memberProfiles[memberId];

              return (
                <View key={index} style={[styles.avatarWrapper, index > 0 && { marginLeft: 8 }]}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={16} color="#FFF" />
                  )}
                </View>
              );
            })}

            {membersList.length > 3 && (
               <View style={[styles.avatarWrapper, { marginLeft: 8, backgroundColor: '#999' }]}>
                 <Feather name="more-horizontal" size={14} color="#FFF" />
               </View>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={20} color="#333" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>空間列表</Text>
        <TouchableOpacity 
          style={styles.addSpaceBtn} 
          onPress={() => {
            setModalMode('options'); // 點擊新增，先回到選項模式
            setInputValue('');
            setIsAddModalVisible(true);
          }}
        >
          <Feather name="plus" size={14} color="#333" />
          <Text style={styles.addSpaceBtnText}>新增空間</Text>
        </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
                      <TouchableOpacity style={styles.iconCircleBtn} onPress={() => router.push('/notifications')}>
                                <Feather name="bell" size={18} color="#333" />
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
            <Text style={styles.emptyStateText}>目前還沒有空間，趕快建立一個吧！</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => router.push('/upload')}>
        <Feather name="plus" size={30} color="#FFF" />
      </TouchableOpacity>


      {/* ✅ 兩階段式 Modal，加上點擊空白處收起鍵盤功能 */}
      <Modal visible={isAddModalVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {
            Keyboard.dismiss(); // 點擊半透明背景也能收鍵盤
            setIsAddModalVisible(false);
          }}
        >
          {/* ✅ 用 TouchableWithoutFeedback 包住內容，點擊白色區塊的空白處會收鍵盤，但不會關閉視窗 */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              
              {modalMode === 'options' ? (
                // 🔹 第一階段：選單模式
                <View>
                  <View style={styles.modalHeader}>
                    {/* 左邊留個空 View 讓標題置中 */}
                    <View style={{ width: 24 }} /> 
                    <Text style={[styles.modalTitle, { marginBottom: 0 }]}>新增或加入</Text>
                    <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                      <Feather name="x" size={24} color="black" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.optionBtn} onPress={() => setModalMode('create')}>
                    <Feather name="plus-circle" size={20} color="#333" />
                    <Text style={styles.optionBtnText}>建立新空間</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optionBtn} onPress={() => setModalMode('join')}>
                    <Feather name="log-in" size={20} color="#333" />
                    <Text style={styles.optionBtnText}>輸入邀請碼加入</Text>
                  </TouchableOpacity>
                </View>

              ) : (
                // 🔹 第二階段：輸入模式 (建立 or 加入)
                <View>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setModalMode('options')}>
                      <Feather name="arrow-left" size={24} color="black" />
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { marginBottom: 0 }]}>
                      {modalMode === 'create' ? '建立新空間' : '加入空間'}
                    </Text>
                    <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                      <Feather name="x" size={24} color="black" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalSubtitle}>
                    {modalMode === 'create' ? '為空間取個名字' : '請輸入邀請碼'}
                  </Text>

                  <TextInput
                    style={styles.modalInput}
                    placeholder={modalMode === 'create' ? "輸入名稱..." : "例如: A7X9WQ"}
                    placeholderTextColor="#CCC"
                    value={inputValue}
                    onChangeText={setInputValue}
                    autoCapitalize={modalMode === 'join' ? "characters" : "none"}
                    maxLength={modalMode === 'join' ? 6 : 20}
                    autoFocus
                  />

                  <TouchableOpacity 
                    style={[styles.joinBtn, inputValue.trim().length > 0 ? styles.joinBtnActive : null]} 
                    disabled={inputValue.trim().length === 0 || isProcessing || (modalMode === 'join' && inputValue.length !== 6)}
                    onPress={handleConfirmAction}
                  >
                    <Text style={styles.joinBtnText}>{isProcessing ? "處理中..." : "確認"}</Text>
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
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent:'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111', marginRight: 15 },
  addSpaceBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E5E5EA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  addSpaceBtnText: { fontSize: 13, fontWeight: '600', color: '#333', marginLeft: 4 },

  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  
  spaceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  
  cardImagePlaceholder: { width: 100, height: 60, borderRadius: 8, overflow: 'hidden' },
  cardBgImage: { position: 'absolute', width: '100%', height: '100%' },
  cardNameOverlay: { flex: 1, justifyContent: 'flex-end', padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  cardSpaceName: { fontSize: 13, fontWeight: '700', color: '#111' },
  
  avatarGroup: { flexDirection: 'row', alignItems: 'center', marginLeft: 15 },
  avatarWrapper: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyStateText: { color: '#999', fontSize: 15 },

  fab: { position: 'absolute', right: 25, bottom: 100, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7C7C7C', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },

  bottomNavContainer: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' },
  floatingBottomNav: { width: '85%', height: 60, backgroundColor: '#F4F4F4', borderRadius: 30, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navItem: { padding: 10, borderRadius: 20 },
  navItemActive: { backgroundColor: '#E0E0E0' }, 

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 15, textAlign: 'center' },
  
  // ✅ 恢復按鈕樣式
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderWidth: 1, borderColor: '#EEEEEE', borderRadius: 10, marginBottom: 10, backgroundColor: '#FAFAFA' },
  optionBtnText: { fontSize: 16, fontWeight: '600', marginLeft: 12, color: '#333' },

  modalInput: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 20, color: '#333' },
  
  joinBtn: { backgroundColor: '#CCCCCC', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  joinBtnActive: { backgroundColor: '#333333' },
  joinBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});