import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Dimensions, Image, StatusBar, ScrollView,
  Modal, Alert, Share, TextInput, Platform, Keyboard 
} from 'react-native';
// 🌟 1. 引入全自動避開鍵盤的滾動組件
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { 
  deleteRecordFromSpace, addCommentToRecord, subscribeToComments, getUserProfile, sendNotificationToMembers, getSpaceData, updateUserProfile 
} from './firebaseServices';

const windowWidth = Dimensions.get('window').width;

export default function DetailScreen() {
  const router = useRouter();
  const { record: recordString } = useLocalSearchParams();
  
  const record = useMemo(() => {
    return recordString ? JSON.parse(recordString) : null;
  }, [recordString]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // ==========================================
  // 核心狀態管理
  // ==========================================
  const [myUserId, setMyUserId] = useState(null);
  const [myProfile, setMyProfile] = useState({ name: '我', avatarUrl: null });
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]); 

  // 萬用大頭貼核心字典池
  const [userProfiles, setUserProfiles] = useState({}); 
  
  // 穩定鎖定軌道 Ref，防止非同步重複抓取造成破圖
  const fetchedUidsRef = useRef(new Set());

  if (!record) return null;
  const images = record.imageUrls || (record.imageUrl ? [record.imageUrl] : []);
  const tags = record?.tags || []; 

  // 1. 初始化拿取目前使用者 ID 與個人頭像
  // 請在 App.js 頂部確認或更換 initializeUser 函式：
useEffect(() => {
  const initializeUser = async () => {
    try {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');

      // 第一次進 app
      if (!storedId) {
        const randomString = Math.random().toString(36).substring(2, 10);
        storedId = `user_${Date.now()}_${randomString}`;

        await AsyncStorage.setItem('@my_device_user_id', storedId);
      }

      setMyUserId(storedId);

      // 讀取 Firebase 使用者資料
      let profile = await getUserProfile(storedId);

      // 如果沒有資料就建立預設帳號
      if (!profile) {
  const defaultAvatars = [
    "https://github.com/jael1118/appimg/blob/4b73a09cc6a2ee1195e5a5ee981411983f5a48c2/img_1780773969404_9wnp6d.jpg",
    "https://github.com/jael1118/appimg/blob/4b73a09cc6a2ee1195e5a5ee981411983f5a48c2/img_1780773970686_9xxhpq.jpg",
    "https://github.com/jael1118/appimg/blob/4b73a09cc6a2ee1195e5a5ee981411983f5a48c2/img_1780773971807_vchtqx.jpg",
  ];
  const randomIndex = Math.floor(Math.random() * defaultAvatars.length);

  // 1. 在記憶體裡填好表格
  profile = {
    name: "美麗陌生人", 
    avatarUrl: defaultAvatars[randomIndex], 
    isOnline: true,
    createdAt: Date.now()
  };

  // 2. 🌟 送交櫃檯存檔！(這行絕對不能刪)
  await updateUserProfile(storedId, profile);
}

      
      // ⭐⭐ 最重要的一行
      setMyProfile(profile);

    } catch (e) {
      console.error("讀取或註冊身分失敗:", e);
    }
  };

  initializeUser();
}, []);

   // 2. 實時訂閱 Firebase 留言資料庫
  useEffect(() => {
    if (!record?.spaceId || !record?.id) return;
    
    const unsubscribe = subscribeToComments(record.spaceId, record.id, (firebaseComments) => {
      setComments(firebaseComments);
    });
    
    return () => unsubscribe();
  }, [record?.spaceId, record?.id]);


  // 3. 萬用字典快取器！超穩定指針防閉包，精準渲染所有頭像
  const authorId = record?.userId || record?.creatorId || record?.uid || record?.authorId || '';
  const commentUserIdsStr = comments ? comments.map(c => c.userId).join(',') : '';

  useEffect(() => {
    const uidsToFetch = [];
    
    if (authorId && !fetchedUidsRef.current.has(authorId)) {
      uidsToFetch.push(authorId);
    }
    
    if (comments && comments.length > 0) {
      comments.forEach(c => {
        if (c.userId && !fetchedUidsRef.current.has(c.userId)) {
          uidsToFetch.push(c.userId);
        }
      });
    }

    if (uidsToFetch.length === 0) return;

    uidsToFetch.forEach(id => fetchedUidsRef.current.add(id));

    const doFetchBatch = async () => {
      const batchResults = {};
      
      await Promise.all(
        uidsToFetch.map(async (id) => {
          try {
            const profile = await getUserProfile(id);
            batchResults[id] = profile?.avatarUrl || null;
          } catch (e) {
            batchResults[id] = null;
          }
        })
      );

      setUserProfiles(prev => ({
        ...prev,
        ...batchResults
      }));
    };

    doFetchBatch();
  }, [authorId, commentUserIdsStr]);

  // 時間格式化
  const formatTime = (ts) => {
    if (!ts) return '';
    const parsedTs = !isNaN(Number(ts)) ? Number(ts) : ts;
    const d = new Date(parsedTs);
    const now = new Date();

    const isToday = d.getFullYear() === now.getFullYear() &&
                    d.getMonth() === now.getMonth() &&
                    d.getDate() === now.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() &&
                        d.getMonth() === yesterday.getMonth() &&
                        d.getDate() === yesterday.getDate();

    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (isToday) return `今日 ${timeStr}`;
    if (isYesterday) return `昨日 ${timeStr}`;
    
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${timeStr}`;
  };

  const handleCopy = () => {
    setIsMenuVisible(false);
    Alert.alert("提示", "內文已拷貝！");
  };

  const handleShare = async () => {
    setIsMenuVisible(false);
    try {
      await Share.share({ message: record.note || "分享這筆紀錄" });
    } catch (error) {
      console.log(error);
    }
  };

  const handleDelete = () => {
    setIsMenuVisible(false);
    Alert.alert(
      "刪除紀錄", 
      "確定要刪除這筆紀錄嗎？此動作無法復原。", 
      [
        { text: "取消", style: "cancel" },
        { 
          text: "刪除", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteRecordFromSpace(record.spaceId, record.id);
              Alert.alert("完成", "紀錄已成功刪除！", [{ text: "OK", onPress: () => router.back() }]);
            } catch (error) {
              Alert.alert("錯誤", "刪除失敗，請檢查網路或稍後再試！");
            }
          } 
        }
      ]
    );
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !myUserId) return;
    
    try {
      await addCommentToRecord(
        record.spaceId, 
        record.id, 
        myUserId, 
        myProfile?.name || '神祕成員', 
        commentText.trim()
      );

      const spaceData = await getSpaceData(record.spaceId);

      if (spaceData && spaceData.members && spaceData.members.length > 0) {
        await sendNotificationToMembers(
          spaceData.members, 
          myUserId,          
          {
            userName: myProfile?.name || '神祕成員',
            userAvatar: myProfile?.avatarUrl || null,
            spaceName: spaceData.name || '空間',
            action: '新增了一則留言',
            recordData: JSON.stringify(record)
          }
        );
      }
      setCommentText(''); 
      Keyboard.dismiss(); // 發送成功後自動收起鍵盤
    } catch (e) {
      console.error("留言發生錯誤:", e); 
      Alert.alert("提示", "留言發送失敗，請稍後再試。");
    }
  };

  // 安全防呆頭像過濾
  const rawCreatorAvatar = userProfiles[authorId] || record?.userAvatar || record?.avatarUrl || null;
  const finalCreatorAvatar = (typeof rawCreatorAvatar === 'string' && rawCreatorAvatar.trim() !== '') ? rawCreatorAvatar : null;

  const rawMyAvatar = myProfile?.avatarUrl || userProfiles[myUserId] || null;
  const finalMyAvatar = (typeof rawMyAvatar === 'string' && rawMyAvatar.trim() !== '') ? rawMyAvatar : null;

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* 頂部 Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={26} color="#000" />
          </TouchableOpacity>
          
          <View style={styles.headerAuthorAvatarWrapper}>
            {finalCreatorAvatar ? (
              <Image source={{ uri: finalCreatorAvatar }} style={styles.headerAuthorAvatar} />
            ) : (
              <Feather name="user" size={16} color="#666" />
            )}
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.timeText}>{formatTime(record.createdAt)}</Text>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={10} color="#666" />
              <Text style={styles.locationText}>{record.location || "未知地點"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRightIcons}>
          <TouchableOpacity 
            style={styles.iconCircleBtn} 
            onPress={() => {
              router.push({
                pathname: '/upload',
                params: { currentSpaceId: record.spaceId, editRecord: JSON.stringify(record) }
              });
            }}
          >
            <Feather name="edit-2" size={18} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsMenuVisible(true)}>
            <Feather name="more-horizontal" size={18} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🌟 2. 核心修改：移除舊的 KeyboardAvoidingView，全面置換為 KeyboardAwareScrollView 外殼 */}
      <KeyboardAwareScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 140 }} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}              // 完美適配 Android
        enableAutomaticScroll={true}        // 啟用自動跟隨滾動
        extraScrollHeight={140}             // 關鍵拉抬：打字時自動把整條留言欄送到中央位置
      >
        <View style={styles.imageSection}>
          {images.length > 0 ? (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const offset = e.nativeEvent.contentOffset.x;
                setActiveIndex(Math.round(offset / windowWidth));
              }}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.mainImage} resizeMode="cover" />
              )}
              keyExtractor={(item, index) => index.toString()}
            />
          ) : (
            <View style={styles.mainImage} />
          )}
        </View>

        {images.length > 1 && (
          <View style={styles.dotsContainer}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === activeIndex ? '#D9D9D9' : '#F0F0F0' }]} />
            ))}
          </View>
        )}

        <View style={styles.contentArea}>
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View key={index} style={styles.tagBadge}><Text style={styles.tagText}>#{tag}</Text></View>
              ))}
            </View>
          )}
          {record.mood !== undefined && record.mood !== null && (
            <View style={styles.detailMoodWrapper}>
              <Image source={getMoodImage(record.mood)} style={styles.detailMoodImage} resizeMode="contain" />
              <Text style={styles.detailMoodText}>今天覺得...</Text>
            </View>
          )}

          <Text style={styles.noteText}>{record.note || "這筆紀錄沒有文字描述。"}</Text>
          <View style={styles.commentDivider} />

          {/* 留言輸入區 (現在打字會全自動精準抬高) */}
          <View style={styles.commentRow}>
            <View style={styles.commentAvatar}>
              {finalMyAvatar ? (
                <Image source={{ uri: finalMyAvatar }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={16} color="#666" />
              )}
            </View>
            <View style={styles.commentInputWrapper}>
              <TextInput
                style={styles.commentInput}
                placeholder="留下你的想法.."
                placeholderTextColor="#999"
                value={commentText}
                onChangeText={setCommentText}
                multiline={true}
              />
              {commentText.length > 0 && (
                <TouchableOpacity onPress={handleSendComment} style={{ padding: 5 }}>
                  <Feather name="send" size={18} color="#333" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 歷史留言列表 */}
          {comments.map((c) => {
            const commenterAvatarUrl = userProfiles[c.userId];
            const finalCommenterAvatar = (typeof commenterAvatarUrl === 'string' && commenterAvatarUrl.trim() !== '') ? commenterAvatarUrl : null;
            
            return (
              <View key={c.id} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  {finalCommenterAvatar ? (
                    <Image source={{ uri: finalCommenterAvatar }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={16} color="#666" />
                  )}
                </View>
                <View style={styles.commentBubble}>
                  <Text style={styles.commenterNameText}>{c.userName}</Text>
                  <Text style={styles.commentBubbleText}>{c.text}</Text>
                </View>
              </View>
            );
          })}

        </View>
      </KeyboardAwareScrollView>

      {/* 下拉選單 Modal */}
      <Modal visible={isMenuVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setIsMenuVisible(false)}>
          <SafeAreaView>
            <View style={styles.dropdownMenu}>
              <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                <Feather name="copy" size={18} color="#333" />
                <Text style={styles.menuItemText}>拷貝</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
                <Feather name="share" size={18} color="#333" />
                <Text style={styles.menuItemText}>分享</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Feather name="trash-2" size={18} color="#FF3B30" />
                <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>刪除</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#FFF' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 12 },
  
  headerAuthorAvatarWrapper: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  headerAuthorAvatar: { width: 36, height: 36, borderRadius: 18 }, 
  
  headerInfo: { justifyContent: 'center' },
  timeText: { fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 11, color: '#666', marginLeft: 4 },
  headerRightIcons: { flexDirection: 'row', alignItems: 'center' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  imageSection: { width: windowWidth, height: windowWidth * 1.1, backgroundColor: '#D9D9D9' },
  mainImage: { width: windowWidth, height: windowWidth * 1.1 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, marginBottom: 5 }, 
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  contentArea: { paddingHorizontal: 20, marginTop: 15 },
  noteText: { fontSize: 15, lineHeight: 26, color: '#333' },
  menuOverlay: { flex: 1, backgroundColor: 'transparent' }, 
  dropdownMenu: { position: 'absolute', top: 60, right: 15, width: 140, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 15, fontWeight: '500', color: '#333', marginLeft: 12 },
  menuDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  tagBadge: { backgroundColor: '#EEEEEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 8 },
  tagText: { fontSize: 12, color: '#333', fontWeight: '500' },
  commentDivider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 20 },
  
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2, overflow: 'hidden' },
  avatarImage: { width: 36, height: 36, borderRadius: 18 }, 
  
  commentInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 6, minHeight: 40, paddingHorizontal: 12 },
  commentInput: { flex: 1, fontSize: 14, color: '#333', paddingVertical: 10 },
  
  commentBubble: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 6, padding: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  commenterNameText: { fontSize: 12, fontWeight: '700', color: '#111', marginBottom: 4 },
  commentBubbleText: { fontSize: 14, color: '#333', lineHeight: 20 },
  noteText: { fontSize: 15, lineHeight: 26, color: '#333' },
  
  // 🌟 補上這三段樣式
  detailMoodWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 10,
    borderRadius: 12,
    marginBottom: 15, // 跟下面的內文隔開
  },
  detailMoodImage: {
    width: 45,
    height: 45,
    marginRight: 12,
  },
  detailMoodText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
});