import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  Image, Alert, ScrollView, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import * as ImagePicker from 'expo-image-picker';

import { db } from './firebaseConfig';
import { 
  getSpaceData, getUserProfile, updateSpaceName, 
  updateSpaceBackground, uploadImageToGitHub, removeMemberFromSpace, deleteSpace 
} from './firebaseServices';
import { doc, onSnapshot } from 'firebase/firestore';

export default function SpaceSettingsScreen() {
  const router = useRouter();
  const { spaceId } = useLocalSearchParams();

  const [myUserId, setMyUserId] = useState(null);
  const [spaceData, setSpaceData] = useState(null);
  const [membersProfile, setMembersProfile] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 修改名稱用的 Modal 狀態
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');

  // 1. 取得自己的 ID
  useEffect(() => {
    const fetchUserId = async () => {
      const storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);
    };
    fetchUserId();
  }, []);

  // 2. 即時監聽空間資料 (這樣改名字或踢人時，畫面會瞬間更新)
  useEffect(() => {
    if (!spaceId) return;
    const spaceRef = doc(db, "Spaces", spaceId);
    const unsubscribe = onSnapshot(spaceRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setSpaceData(data);
        
        // 去抓每個成員的大頭貼和名字
        if (data.members && data.members.length > 0) {
          const profiles = await Promise.all(
            data.members.map(async (uid) => {
              const p = await getUserProfile(uid);
              return p ? p : { id: uid, name: '未命名成員', avatarUrl: null };
            })
          );
          setMembersProfile(profiles);
        }
      } else {
        // 如果空間被刪除了，會被強制退回首頁
        Alert.alert("提示", "此空間已解散。");
        router.replace('/');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [spaceId]);

  if (isLoading || !spaceData || !myUserId) {
    return <SafeAreaView style={styles.centerContainer}><ActivityIndicator size="large" color="#333" /></SafeAreaView>;
  }

  // 👑 權限判斷：陣列的第一個人就是房主
  const isOwner = spaceData.members[0] === myUserId;

  // ========== 動作區 ==========

  // 修改背景圖片
  const handleEditBackground = async () => {
    if (!isOwner) return Alert.alert("提示", "只有房主可以更改背景圖片喔！");
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setIsLoading(true);
      try {
        const cloudUrl = await uploadImageToGitHub(result.assets[0].base64);
        await updateSpaceBackground(spaceId, cloudUrl);
        Alert.alert("成功", "背景圖片已更新！");
      } catch (error) {
        Alert.alert("錯誤", "上傳失敗，請稍後再試。");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 修改空間名稱
  const handleSaveName = async () => {
    if (!newSpaceName.trim()) return;
    try {
      await updateSpaceName(spaceId, newSpaceName.trim());
      setIsEditNameModalVisible(false);
    } catch (error) {
      Alert.alert("錯誤", "名稱更新失敗");
    }
  };

  // 退出空間 (自己離開)
  const handleLeaveSpace = () => {
    Alert.alert("退出空間", "確定要離開這個空間嗎？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: async () => {
          await removeMemberFromSpace(spaceId, myUserId);
          router.replace('/'); // 退回首頁
      }}
    ]);
  };

  // 踢出成員 (房主特權)
  const handleKickMember = (memberId, memberName) => {
    Alert.alert("移除成員", `確定要將 ${memberName} 移出空間嗎？`, [
      { text: "取消", style: "cancel" },
      { text: "移除", style: "destructive", onPress: async () => {
          await removeMemberFromSpace(spaceId, memberId);
      }}
    ]);
  };

  // 刪除空間 (房主特權)
  const handleDeleteSpace = () => {
    Alert.alert("危險動作", "確定要解散這個空間嗎？所有紀錄將無法復原！", [
      { text: "取消", style: "cancel" },
      { text: "解散", style: "destructive", onPress: async () => {
          await deleteSpace(spaceId);
          router.back();
      }}
    ]);
  };

  // ========== 時間格式化工具 ==========
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 標題列 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
          <Feather name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>空間管理</Text>
        <View style={{ width: 38 }} /> 
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* 背景圖與空間基本資訊 */}
        <View style={styles.coverContainer}>
          <Image 
            source={{ uri: spaceData.backgroundImageUrl }} 
            style={styles.coverImage} 
          />
          <View style={styles.coverOverlay} />
          
          <View style={styles.spaceInfoOverlay}>
            <Text style={styles.spaceNameText}>{spaceData.name}</Text>
            <Text style={styles.inviteCodeText}>邀請碼：{spaceData.inviteCode}</Text>
            <Text style={styles.dateText}>建立於 {formatDate(spaceData.createdAt)}</Text>
          </View>

          {isOwner && (
            <View style={styles.ownerControlsOnCover}>
              <TouchableOpacity style={styles.coverBtn} onPress={handleEditBackground}>
                <Feather name="image" size={16} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.coverBtn} onPress={() => {
                setNewSpaceName(spaceData.name);
                setIsEditNameModalVisible(true);
              }}>
                <Feather name="edit-2" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 成員列表 */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>空間成員 ({membersProfile.length})</Text>
          
          {membersProfile.map((member, index) => {
            const isMe = member.id === myUserId;
            const isThisMemberOwner = index === 0;

            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberLeft}>
                  {member.avatarUrl ? (
                    <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatar} />
                  ) : (
                    <View style={styles.memberAvatarPlaceholder}>
                      <Feather name="user" size={18} color="#999" />
                    </View>
                  )}
                  <View>
                    <Text style={styles.memberName}>
                      {member.name} {isMe ? '(我)' : ''}
                    </Text>
                    {isThisMemberOwner && <Text style={styles.ownerTag}>房主</Text>}
                  </View>
                </View>

                {/* 踢人按鈕：我是房主、且對方不是房主時才顯示 */}
                {isOwner && !isThisMemberOwner && (
                  <TouchableOpacity 
                    style={styles.kickBtn}
                    onPress={() => handleKickMember(member.id, member.name)}
                  >
                    <Text style={styles.kickBtnText}>移除</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* 底部危險區域 */}
        <View style={styles.dangerZone}>
          {!isOwner && (
            <TouchableOpacity style={styles.dangerBtn} onPress={handleLeaveSpace}>
              <Text style={styles.dangerBtnText}>退出空間</Text>
            </TouchableOpacity>
          )}

          {isOwner && (
            <TouchableOpacity style={[styles.dangerBtn, { backgroundColor: '#FFF5F5', borderColor: '#FF3B30' }]} onPress={handleDeleteSpace}>
              <Text style={[styles.dangerBtnText, { color: '#FF3B30' }]}>解散此空間</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* 修改名稱用的 Modal */}
      <Modal visible={isEditNameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>修改空間名稱</Text>
            <TextInput
              style={styles.modalInput}
              value={newSpaceName}
              onChangeText={setNewSpaceName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setIsEditNameModalVisible(false)}>
                <Text style={styles.modalBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#333' }]} onPress={handleSaveName}>
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>儲存</Text>
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, backgroundColor: '#FFF' },
  title: { fontSize: 18, fontWeight: '600', color: '#333' },
  
  coverContainer: { width: '100%', height: 220, position: 'relative', backgroundColor: '#666' },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  
  spaceInfoOverlay: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  spaceNameText: { fontSize: 24, fontWeight: 'bold', color: '#FFF', marginBottom: 6 },
  inviteCodeText: { fontSize: 14, color: '#EEE', marginBottom: 4, letterSpacing: 1 },
  dateText: { fontSize: 12, color: '#CCC' },

  ownerControlsOnCover: { position: 'absolute', top: 15, right: 15, flexDirection: 'row' },
  coverBtn: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 20, marginLeft: 10 },

  sectionContainer: { backgroundColor: '#FFF', marginTop: 15, paddingHorizontal: 20, paddingVertical: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 15 },
  
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  memberLeft: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 15 },
  memberAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFEFEF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  memberName: { fontSize: 16, color: '#333', fontWeight: '500' },
  ownerTag: { fontSize: 11, color: '#007AFF', backgroundColor: '#E5F1FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start', overflow: 'hidden' },
  
  kickBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F0F0F0', borderRadius: 15 },
  kickBtnText: { fontSize: 13, color: '#666', fontWeight: '500' },

  dangerZone: { marginTop: 30, paddingHorizontal: 20, paddingBottom: 40 },
  dangerBtn: { backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EAEAEA' },
  dangerBtnText: { fontSize: 16, fontWeight: '600', color: '#333' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 15, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  modalBtnText: { fontSize: 16, fontWeight: '500', color: '#333' }
});