import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Dimensions, Image, StatusBar, ScrollView,
  Modal, Alert, Share, TextInput, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// ✅ 引入剛剛寫好的留言串接服務
import { 
  deleteRecordFromSpace, addCommentToRecord, subscribeToComments, getUserProfile, sendNotificationToMembers, getSpaceData 
} from './firebaseServices';

const windowWidth = Dimensions.get('window').width;

export default function DetailScreen() {
  const router = useRouter();
  const { record: recordString } = useLocalSearchParams();
  const record = recordString ? JSON.parse(recordString) : null;

  const [activeIndex, setActiveIndex] = useState(0);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // ==========================================
  // 核心狀態管理
  // ==========================================
  const [myUserId, setMyUserId] = useState(null);
  const [myProfile, setMyProfile] = useState({ name: '我', avatarUrl: null });
  const [commentText, setCommentText] = useState('');
  
  // 留言列表改由 Firebase 實時同步
  const [comments, setComments] = useState([]); 
  // 大頭貼字典暫存器 (結構如：{ 'user_123': 'http://...', 'user_456': null })
  const [commenterProfiles, setCommenterProfiles] = useState({});

  if (!record) return null;
  const images = record.imageUrls || (record.imageUrl ? [record.imageUrl] : []);
  const tags = record?.tags || []; 

  // 1. 初始化拿取目前使用者 ID 與個人頭像
  useEffect(() => {
    const initializeUser = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);
      if (storedId) {
        try {
          const profile = await getUserProfile(storedId);
          if (profile) setMyProfile(profile);
        } catch (e) {
          console.log("無法載入個人頭像", e);
        }
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

  // 3. 智慧動態分析：當有新留言時，自動去撈留言者的真實頭像
  useEffect(() => {
    const fetchCommentersAvatars = async () => {
      if (comments.length === 0) return;
      
      const newProfiles = { ...commenterProfiles };
      let hasUpdates = false;

      // 找出畫面上所有留言者的真實 UserID
      const userIdsInComments = new Set(comments.map(c => c.userId));

      for (const id of userIdsInComments) {
        // 如果這個留言者的資料在暫存器裡還沒記錄，就去資料庫撈一次
        if (newProfiles[id] === undefined) {
          try {
            const profile = await getUserProfile(id);
            newProfiles[id] = profile?.avatarUrl || null; // 有圖給圖，沒圖給 null
            hasUpdates = true;
          } catch (e) {
            newProfiles[id] = null;
          }
        }
      }

      if (hasUpdates) setCommenterProfiles(newProfiles);
    };

    fetchCommentersAvatars();
  }, [comments]);

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

  // ✅ 處理送出留言（正式寫入 Firebase）
  // ✅ 處理送出留言（正式寫入 Firebase + 正確發送通知）
  const handleSendComment = async () => {
    if (!commentText.trim() || !myUserId) return;
    
    try {
      // 1. 成功寫入留言到資料庫
      await addCommentToRecord(
        record.spaceId, 
        record.id, 
        myUserId, 
        myProfile?.name || '神祕成員', 
        commentText.trim()
      );

      // 2. 正確去資料庫拿「這個空間的成員名單」
      const spaceData = await getSpaceData(record.spaceId);

      // 3. 如果有拿到成員名單，就發送通知
      if (spaceData && spaceData.members && spaceData.members.length > 0) {
        await sendNotificationToMembers(
          spaceData.members, // 傳入正確的成員陣列
          myUserId,          // 自己不要收到自己的通知
          {
            userName: myProfile?.name || '神祕成員',
            userAvatar: myProfile?.avatarUrl || null,
            spaceName: spaceData.name || '空間',
            action: '新增了一則留言',
            recordData: JSON.stringify(record)
          }
        );
      }

      setCommentText(''); // 成功後清空輸入框
    } catch (e) {
      console.error("留言發生錯誤:", e); // 如果還出錯，這裡會印出真正的原因
      Alert.alert("提示", "留言發送失敗，請稍後再試。");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* 1. 頂部 Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={26} color="#000" />
          </TouchableOpacity>
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
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

            <Text style={styles.noteText}>{record.note || "這筆紀錄沒有文字描述。"}</Text>

            <View style={styles.commentDivider} />

            {/* 留言輸入區 */}
            <View style={styles.commentRow}>
              <View style={styles.commentAvatar}>
                {/* ✅ 自己有設定頭像就顯示，沒有就給預設灰底人頭 */}
                {myProfile?.avatarUrl ? (
                  <Image source={{ uri: myProfile.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Feather name="user" size={16} color="#FFF" />
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
              // ✅ 從快取字典拿取這個留言者的真實頭像
              const commenterAvatarUrl = commenterProfiles[c.userId];

              return (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    {commenterAvatarUrl ? (
                      <Image source={{ uri: commenterAvatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <Feather name="user" size={16} color="#FFF" />
                    )}
                  </View>
                  <View style={styles.commentBubble}>
                    {/* 順便在留言上方粗體顯示留言者名稱，這樣更清楚是誰留的 */}
                    <Text style={styles.commenterNameText}>{c.userName}</Text>
                    <Text style={styles.commentBubbleText}>{c.text}</Text>
                  </View>
                </View>
              );
            })}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  backBtn: { marginRight: 15 },
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
  // ✅ 大頭貼容器加上置中與裁切
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#CCC', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  
  commentInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 6, minHeight: 40, paddingHorizontal: 12 },
  commentInput: { flex: 1, fontSize: 14, color: '#333', paddingVertical: 10 },
  
  // 留言對話框
  commentBubble: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 6, padding: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  commenterNameText: { fontSize: 12, fontWeight: '700', color: '#111', marginBottom: 4 },
  commentBubbleText: { fontSize: 14, color: '#333', lineHeight: 20 },
});