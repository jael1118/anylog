import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Dimensions, Image, StatusBar, ScrollView,
  Modal, Alert, Share // ✅ 新增引入 Modal, Alert, Share
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { deleteRecordFromSpace } from './firebaseServices';

const windowWidth = Dimensions.get('window').width;

export default function DetailScreen() {
  const router = useRouter();
  const { record: recordString } = useLocalSearchParams();
  const record = recordString ? JSON.parse(recordString) : null;

  const [activeIndex, setActiveIndex] = useState(0);
  
  // ✅ 新增：控制右上角小選單的顯示狀態
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  if (!record) return null;

  const images = record.imageUrls || (record.imageUrl ? [record.imageUrl] : []);

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

    if (isToday) {
      return `今日 ${timeStr}`;
    } else if (isYesterday) {
      return `昨日 ${timeStr}`;
    } else {
      const yyyy = d.getFullYear();
      const mm = (d.getMonth() + 1).toString().padStart(2, '0');
      const dd = d.getDate().toString().padStart(2, '0');
      return `${yyyy}.${mm}.${dd} ${timeStr}`;
    }
  };

  // ✅ 新增：拷貝功能 (暫時用 Alert 提示，若要真拷貝可安裝 expo-clipboard)
  const handleCopy = () => {
    setIsMenuVisible(false);
    Alert.alert("提示", "內文已拷貝！");
  };

  // ✅ 新增：呼叫手機內建的分享面板
  const handleShare = async () => {
    setIsMenuVisible(false);
    try {
      await Share.share({
        message: record.note || "分享這筆紀錄",
      });
    } catch (error) {
      console.log(error);
    }
  };

  // ✅ 新增：刪除防呆確認視窗
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
          // ✅ 重點在這裡：要加上 async
          onPress: async () => {
            try {
              // 🚀 這樣寫就沒問題了！
              await deleteRecordFromSpace(record.spaceId, record.id);
              
              Alert.alert("完成", "紀錄已成功刪除！", [
                { text: "OK", onPress: () => router.back() }
              ]);
            } catch (error) {
              Alert.alert("錯誤", "刪除失敗，請檢查網路或稍後再試！");
              console.log("刪除錯誤：", error);
            }
          } 
        }
      ]
    );
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
                params: { 
                  currentSpaceId: record.spaceId, 
                  editRecord: JSON.stringify(record) 
                }
              });
            }}
          >
            <Feather name="edit-2" size={18} color="#333" />
          </TouchableOpacity>

          {/* ✅ 點擊開啟選單 */}
          <TouchableOpacity style={styles.iconCircleBtn} onPress={() => setIsMenuVisible(true)}>
            <Feather name="more-horizontal" size={18} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

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
              <View 
                key={i} 
                style={[styles.dot, { backgroundColor: i === activeIndex ? '#D9D9D9' : '#F0F0F0' }]} 
              />
            ))}
          </View>
        )}

        <View style={styles.contentArea}>
          <Text style={styles.noteText}>
            {record.note || "這筆紀錄沒有文字描述。"}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.floatingBottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/')}>
          <Feather name="book" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/map')}>
          <Feather name="map" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/profile')}>
          <Feather name="user" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* ==============================================================
          ✅ 新增：右上角更多選項的小選單 (Popover Menu)
      ============================================================== */}
      <Modal visible={isMenuVisible} transparent={true} animationType="fade">
        {/* 透明背景遮罩，點擊選單外的地方會自動關閉 */}
        <TouchableOpacity 
          style={styles.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setIsMenuVisible(false)}
        >
          <SafeAreaView>
            <View style={styles.dropdownMenu}>
              
              {/* 拷貝按鈕 */}
              <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                <Feather name="copy" size={18} color="#333" />
                <Text style={styles.menuItemText}>拷貝</Text>
              </TouchableOpacity>

              {/* 分享按鈕 */}
              <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
                <Feather name="share" size={18} color="#333" />
                <Text style={styles.menuItemText}>分享</Text>
              </TouchableOpacity>

              {/* 分隔線 */}
              <View style={styles.menuDivider} />

              {/* 刪除按鈕 (紅色) */}
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

  floatingBottomNav: { position: 'absolute', bottom: 30, alignSelf: 'center', width: '85%', height: 60, backgroundColor: '#F5F5F5', borderRadius: 30, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  navItem: { padding: 10 },

  // ✅ 新增：小選單專屬樣式
  menuOverlay: { flex: 1, backgroundColor: 'transparent' }, // 透明背景
  dropdownMenu: { 
    position: 'absolute', 
    top: 60, // 距離頂部的高度，剛好在 Header 下方
    right: 15, // 距離右邊距
    width: 140, 
    backgroundColor: '#FFF', 
    borderRadius: 12, 
    paddingVertical: 4,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 10, 
    elevation: 8 
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 15, fontWeight: '500', color: '#333', marginLeft: 12 },
  menuDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16 }
});