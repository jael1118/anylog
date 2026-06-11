import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Dimensions, Image, StatusBar, ScrollView,
  Modal, Alert, Share, TextInput, Platform, Keyboard 
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { 
  deleteRecordFromSpace, addCommentToRecord, subscribeToComments, getUserProfile, sendNotificationToMembers, getSpaceData, updateUserProfile 
} from './firebaseServices';

// 🌟 引入全域主題 Context
import { useAppTheme } from './ThemeContext';

const windowWidth = Dimensions.get('window').width;

export default function DetailScreen() {
  const keyboardScrollRef = useRef(null);
  const router = useRouter();
  const { record: recordString } = useLocalSearchParams();
  
  // 🌟 從全域主題中撈取當前的 theme 設定
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;
  const currentMode = theme.themeMode;

  const [record, setRecord] = useState(() => {
    return recordString ? JSON.parse(recordString) : null;
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // 核心狀態管理
  const [myUserId, setMyUserId] = useState(null);
  const [myProfile, setMyProfile] = useState({ name: '我', avatarUrl: null });
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]); 

  // 萬用大頭貼核心字典池
  const [userProfiles, setUserProfiles] = useState({}); 
  const fetchedUidsRef = useRef(new Set());

  // 🌟 只要畫面重新出現，就去資料庫抓最新版本的這篇文章
  useFocusEffect(
    React.useCallback(() => {
      if (!record?.id) return;

      const fetchUpdatedRecord = async () => {
        try {
          const { doc, getDoc } = require('firebase/firestore');
          const { db } = require('./firebaseConfig');
          
          const docRef = doc(db, "Records", record.id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setRecord({ id: docSnap.id, ...docSnap.data() }); // 覆蓋成最新資料
          }
        } catch (error) {
          console.log("刷新紀錄失敗:", error);
        }
      };

      fetchUpdatedRecord();
    }, [record?.id])
  );
  
  if (!record) return null;
  const images = record.imageUrls || (record.imageUrl ? [record.imageUrl] : []);
  const tags = record?.tags || []; 
  const hasNotes = record.note && record.note.trim().length > 0;
  const hasImages = images.length > 0;
  const hasMood = record.mood !== undefined && record.mood !== null;

  // 1. 初始化使用者 ID 與個人頭像
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

        let profile = await getUserProfile(storedId);
        if (!profile) {
          const defaultAvatars = [
            "https://github.com/jael1118/appimg/blob/4b73a09cc6a2ee1195e5a5ee981411983f5a48c2/img_1780773969404_9wnp6d.jpg",
            "https://github.com/jael1118/appimg/blob/4b73a09cc6a2ee1195e5a5ee981411983f5a48c2/img_1780773970686_9xxhpq.jpg",
            "https://github.com/jael1118/appimg/blob/4b73a09cc6a2ee1195e5a5ee981411983f5a48c2/img_1780773971807_vchtqx.jpg",
          ];
          const randomIndex = Math.floor(Math.random() * defaultAvatars.length);
          profile = {
            name: "美麗陌生人", 
            avatarUrl: defaultAvatars[randomIndex], 
            isOnline: true,
            createdAt: Date.now()
          };
          await updateUserProfile(storedId, profile);
        }
        setMyProfile(profile);
      } catch (e) {
        console.error("讀取或註冊身分失敗:", e);
      }
    };
    initializeUser();
  }, []);

  // 2. 實時訂閱留言資料庫
  useEffect(() => {
    if (!record?.spaceId || !record?.id) return;
    const unsubscribe = subscribeToComments(record.spaceId, record.id, (firebaseComments) => {
      setComments(firebaseComments);
    });
    return () => unsubscribe();
  }, [record?.spaceId, record?.id]);

  // 3. 萬用字典快取頭像
  const authorId = record?.userId || record?.creatorId || record?.uid || record?.authorId || '';
  const commentUserIdsStr = comments ? comments.map(c => c.userId).join(',') : '';

  useEffect(() => {
    const uidsToFetch = [];
    if (authorId && !fetchedUidsRef.current.has(authorId)) uidsToFetch.push(authorId);
    if (comments && comments.length > 0) {
      comments.forEach(c => {
        if (c.userId && !fetchedUidsRef.current.has(c.userId)) uidsToFetch.push(c.userId);
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
      setUserProfiles(prev => ({ ...prev, ...batchResults }));
    };
    doFetchBatch();
  }, [authorId, commentUserIdsStr]);

  const formatTime = (ts) => {
    if (!ts) return '';
    const parsedTs = !isNaN(Number(ts)) ? Number(ts) : ts;
    const d = new Date(parsedTs);
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();

    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (isToday) return `今日 ${timeStr}`;
    if (isYesterday) return `昨日 ${timeStr}`;
    return `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')} ${timeStr}`;
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
    if (myUserId !== authorId) {
      Alert.alert("權限不足", "只有紀錄的作者可以刪除喔！");
      return;
    }
    setIsMenuVisible(false);
    Alert.alert("刪除紀錄", "確定要刪除這筆紀錄嗎？此動作無法復原。", [
      { text: "取消", style: "cancel" },
      { 
        text: "刪除", 
        style: "destructive", 
        onPress: async () => {
          try {
            await deleteRecordFromSpace(record.spaceId, record.id);
            Alert.alert("完成", "紀錄已成功刪除！", [{ text: "OK", onPress: () => router.back() }]);
          } catch (error) {
            Alert.alert("錯誤", "刪除失敗，請稍後再試！");
          }
        } 
      }
    ]);
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !myUserId) return;
    try {
      await addCommentToRecord(record.spaceId, record.id, myUserId, myProfile?.name || '神祕成員', commentText.trim());
      const spaceData = await getSpaceData(record.spaceId);
      if (spaceData && spaceData.members && spaceData.members.length > 0) {
        await sendNotificationToMembers(spaceData.members, myUserId, {
          userName: myProfile?.name || '神祕成員',
          userAvatar: myProfile?.avatarUrl || null,
          spaceName: spaceData.name || '空間',
          action: '新增了一則留言',
          recordData: JSON.stringify(record)
        });
      }
      setCommentText(''); 
      Keyboard.dismiss();
    } catch (e) {
      Alert.alert("提示", "留言發送失敗，請稍後再試。");
    }
  };

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      
      {/* 頂部 Header */}
      <View style={[styles.header, { backgroundColor: theme.bg }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={26} color={theme.text} />
          </TouchableOpacity>
          <View style={[styles.headerAuthorAvatarWrapper, { backgroundColor: darkMode ? '#1E1E1E' : '#F2F2F7' }]}>
            {finalCreatorAvatar ? (
              <Image source={{ uri: finalCreatorAvatar }} style={styles.headerAuthorAvatar} />
            ) : (
              <Feather name="user" size={16} color={theme.subText} />
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.timeText, { color: theme.text }]}>{formatTime(record.createdAt)}</Text>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={10} color={theme.subText} />
              <Text style={[styles.locationText, { color: theme.subText }]}>{record.location || "未知地點"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRightIcons}>
          {myUserId === authorId && (
            <TouchableOpacity 
              style={[styles.iconCircleBtn, { backgroundColor: darkMode ? '#1E1E1E' : '#F5F5F5' }]} 
              onPress={() => {
                router.push({
                  pathname: '/upload',
                  params: { currentSpaceId: record.spaceId, editRecord: JSON.stringify(record) }
                });
              }}
            >
              <Feather name="edit-2" size={18} color={theme.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: darkMode ? '#1E1E1E' : '#F5F5F5' }]} onPress={() => setIsMenuVisible(true)}>
            <Feather name="more-horizontal" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAwareScrollView 
        ref={keyboardScrollRef}
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 140 }} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraHeight={160}
      >
        {/* 動態隱藏圖片區塊 */}
        {hasImages && (
          <View>
            <View style={[styles.imageSection, { backgroundColor: theme.bg }]}>
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
            </View>
            {images.length > 1 && (
              <View style={styles.dotsContainer}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: i === activeIndex ? (darkMode ? '#666' : '#D9D9D9') : (darkMode ? '#2C2C2E' : '#F0F0F0') }]} />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.contentArea}>
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View key={index} style={[styles.tagBadge, { backgroundColor: darkMode ? '#1E1E1E' : '#EEEEEE' }]}><Text style={[styles.tagText, { color: theme.text }]}>#{tag}</Text></View>
              ))}
            </View>
          )}

          {/* 今天覺得... 心情區塊位置對調與變色 */}
          {hasMood && (
            <View style={[styles.detailMoodWrapper, { backgroundColor: darkMode ? '#1E1E1E' : '#F9F9F9' }]}>
              <Text style={[styles.detailMoodText, { color: theme.valueText }]}>今天覺得...</Text>
              <Image source={getMoodImage(record.mood)} style={styles.detailMoodImage} resizeMode="contain" />
            </View>
          )}

          {/* 動態隱藏文字內文 */}
          {hasNotes && (
            <Text style={[styles.noteText, { color: theme.text }]}>{record.note.trim()}</Text>
          )}

          <View style={[styles.commentDivider, { backgroundColor: darkMode ? '#1C1C1E' : '#E0E0E0' }]} />

          {/* 留言輸入區 */}
          <View style={styles.commentRow}>
            <View style={[styles.commentAvatar, { backgroundColor: darkMode ? '#1E1E1E' : '#F2F2F7' }]}>
              {finalMyAvatar ? (
                <Image source={{ uri: finalMyAvatar }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={16} color={theme.subText} />
              )}
            </View>
            <View style={[styles.commentInputWrapper, { backgroundColor: darkMode ? '#1C1C1E' : '#F0F0F0' }]}>
              <TextInput
                style={[styles.commentInput, { color: theme.text }]}
                placeholder="留下你的想法.."
                placeholderTextColor={darkMode ? "#444" : "#999"}
                value={commentText}
                onChangeText={setCommentText}
                multiline={true}
                onFocus={(e) => {
                  const targetNode = e.target || e.nativeEvent.target; 
                  setTimeout(() => {
                    if (keyboardScrollRef.current && targetNode) {
                      keyboardScrollRef.current.scrollToFocusedInput(targetNode);
                    }
                  }, 50); 
                }}
              />
              {commentText.length > 0 && (
                <TouchableOpacity onPress={handleSendComment} style={{ padding: 5 }}>
                  <Feather name="send" size={18} color={theme.text} />
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
                <View style={[styles.commentAvatar, { backgroundColor: darkMode ? '#1E1E1E' : '#F2F2F7' }]}>
                  {finalCommenterAvatar ? (
                    <Image source={{ uri: finalCommenterAvatar }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={16} color={theme.subText} />
                  )}
                </View>
                <View style={[styles.commentBubble, { backgroundColor: darkMode ? '#1E1E1E' : '#F5F5F5', borderColor: darkMode ? '#2C2C2E' : '#EAEAEA' }]}>
                  <Text style={[styles.commenterNameText, { color: theme.text }]}>{c.userName}</Text>
                  <Text style={[styles.commentBubbleText, { color: theme.text }]}>{c.text}</Text>
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
            <View style={[styles.dropdownMenu, { backgroundColor: theme.modalBg, borderColor: theme.inputBorder }]}>
              <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                <Feather name="copy" size={18} color={currentMode === 'cyber' ? '#FFFF00' : (theme.isCyber ? '#000000' : theme.subText)} />
                <Text style={[styles.menuItemText, { color: currentMode === 'cyber' ? '#FFFF00' : (theme.isCyber ? '#000000' : theme.subText) }]}>拷貝</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
                <Feather name="share" size={18} color={currentMode === 'cyber' ? '#FFFF00' : (theme.isCyber ? '#000000' : theme.subText)} />
                <Text style={[styles.menuItemText, { color: currentMode === 'cyber' ? '#FFFF00' : (theme.isCyber ? '#000000' : theme.subText) }]}>分享</Text>
              </TouchableOpacity>
              {myUserId === authorId && (
                <>
                  <View style={[styles.menuDivider, { backgroundColor: darkMode ? '#2C2C2E' : '#F0F0F0' }]} />
                  <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                    <Feather name="trash-2" size={18} color={currentMode === 'cyber' ? '#FFFF00' : (theme.isCyber ? '#000000' : theme.subText)} />
                    <Text style={[styles.menuItemText, { color: currentMode === 'cyber' ? '#FFFF00' : (theme.isCyber ? '#000000' : theme.subText) }]}>刪除</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 12 },
  headerAuthorAvatarWrapper: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  headerAuthorAvatar: { width: 36, height: 36, borderRadius: 18 }, 
  headerInfo: { justifyContent: 'center' },
  timeText: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 11, marginLeft: 4 },
  headerRightIcons: { flexDirection: 'row', alignItems: 'center' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  
  imageSection: { width: windowWidth, height: windowWidth * 1.1 },
  mainImage: { width: windowWidth, height: windowWidth * 1.1 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, marginBottom: 5 }, 
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  contentArea: { paddingHorizontal: 20, marginTop: 15 },
  noteText: { fontSize: 15, lineHeight: 26 },
  menuOverlay: { flex: 1, backgroundColor: 'transparent' }, 
  dropdownMenu: { position: 'absolute', top: 60, right: 15, width: 140, borderRadius: 12, paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8, borderWidth: Platform.OS === 'android' ? 1 : 0 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 15, fontWeight: '500', marginLeft: 12 },
  menuDivider: { height: 1, marginHorizontal: 16 },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 8 },
  tagText: { fontSize: 12, fontWeight: '500' },
  commentDivider: { height: 1, marginVertical: 20 },
  
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2, overflow: 'hidden' },
  avatarImage: { width: 36, height: 36, borderRadius: 18 }, 
  
  commentInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 6, minHeight: 40, paddingHorizontal: 12 },
  commentInput: { flex: 1, fontSize: 14, paddingVertical: 10, textAlignVertical: 'center' },
  
  commentBubble: { flex: 1, borderRadius: 6, padding: 12, borderWidth: 1 },
  commenterNameText: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  commentBubbleText: { fontSize: 14, lineHeight: 20 },

  detailMoodWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 15,
  },
  detailMoodImage: {
    width: 45,
    height: 45,
    marginLeft: 12, 
  },
  detailMoodText: {
    fontSize: 14,
    fontWeight: '500',
  },
});