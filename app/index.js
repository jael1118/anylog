import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  FlatList, StatusBar, Modal, TextInput, Alert, Image 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ 記得補上 getUserProfile
import { subscribeToUserSpaces, createNewSpace, getUserProfile } from './firebaseServices'; 

export default function SpaceListScreen() {
  const router = useRouter();
  
  const [myUserId, setMyUserId] = useState(null);
  const [spaces, setSpaces] = useState([]);
  
  // ✅ 新增：用來暫存所有成員大頭貼的字典 (例如 { 'user_1': 'http...', 'user_2': null })
  const [memberProfiles, setMemberProfiles] = useState({});
  
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 初始化拿 UserId
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

  // 訂閱空間列表
  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (fetchedSpaces) => {
      setSpaces(fetchedSpaces);
    });
    return () => unsubscribe();
  }, [myUserId]);

  // ✅ 新增：當空間列表更新時，自動去抓取所有成員的大頭貼
  useEffect(() => {
    const fetchAvatars = async () => {
      if (spaces.length === 0) return;
      
      const newProfiles = { ...memberProfiles };
      let hasNew = false;
      
      // 收集畫面上所有空間裡的所有成員 ID
      const allMemberIds = new Set();
      spaces.forEach(space => {
        if (space.members) space.members.forEach(id => allMemberIds.add(id));
      });

      // 針對每一個成員，如果還沒抓過他的資料，就去 Firebase 抓
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

      // 如果有抓到新的大頭貼，就更新畫面
      if (hasNew) setMemberProfiles(newProfiles);
    };

    fetchAvatars();
  }, [spaces]);

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) {
      Alert.alert("提示", "請輸入空間名稱！");
      return;
    }
    setIsCreating(true);
    try {
      await createNewSpace(newSpaceName, myUserId);
      setIsAddModalVisible(false);
      setNewSpaceName('');
    } catch (error) {
      Alert.alert("錯誤", "建立空間失敗");
    } finally {
      setIsCreating(false);
    }
  };

  const renderSpaceCard = ({ item }) => {
    // 空間背景
    const coverUrl = item.backgroundImageUrl || 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=200&auto=format&fit=crop'; 
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
              // ✅ 從我們剛才抓下來的字典裡，尋找這個人的大頭貼網址
              const avatarUrl = memberProfiles[memberId];

              return (
                <View key={index} style={[styles.avatarWrapper, index > 0 && { marginLeft: 8 }]}>
                  {/* 有網址就顯示圖片，沒網址就顯示灰色預設 Icon */}
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
        <Text style={styles.headerTitle}>空間列表</Text>
        <TouchableOpacity style={styles.addSpaceBtn} onPress={() => setIsAddModalVisible(true)}>
          <Feather name="plus" size={14} color="#333" />
          <Text style={styles.addSpaceBtnText}>新增空間</Text>
        </TouchableOpacity>
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

      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => router.push('/upload')} 
      >
        <Feather name="plus" size={28} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.bottomNavContainer}>
        <View style={styles.floatingBottomNav}>
          <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
            <Feather name="book" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/map')}>
            <Feather name="map" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/profile')}>
            <Feather name="user" size={22} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isAddModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>建立新空間</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="給這個空間取個名字吧..."
              placeholderTextColor="#999"
              value={newSpaceName}
              onChangeText={setNewSpaceName}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCreateSpace} disabled={isCreating}>
                <Text style={styles.modalConfirmText}>{isCreating ? "建立中..." : "建立"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111', marginRight: 15 },
  addSpaceBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E5E5EA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  addSpaceBtnText: { fontSize: 13, fontWeight: '600', color: '#333', marginLeft: 4 },

  listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  
  spaceCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  
  cardImagePlaceholder: { width: 100, height: 60, borderRadius: 8, overflow: 'hidden' },
  cardBgImage: { position: 'absolute', width: '100%', height: '100%' },
  cardNameOverlay: { flex: 1, justifyContent: 'flex-end', padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  cardSpaceName: { fontSize: 13, fontWeight: '700', color: '#111' },
  
  avatarGroup: { flexDirection: 'row', alignItems: 'center', marginLeft: 15 },
  avatarWrapper: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  // ✅ 補回 avatarImage 樣式，確保圖片填滿
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 20, color: '#333' },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalCancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', marginRight: 10, borderRadius: 10, backgroundColor: '#F0F0F0' },
  modalCancelText: { fontSize: 16, color: '#666', fontWeight: '600' },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', marginLeft: 10, borderRadius: 10, backgroundColor: '#333' },
  modalConfirmText: { fontSize: 16, color: '#FFF', fontWeight: '600' }
});