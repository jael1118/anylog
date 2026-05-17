import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, TextInput, Modal, FlatList, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';

const colors = {
  primary: '#FBAFFE',         
  secondary: '#E2E0F9',       
  background: '#F8F8FC',      
  text: '#4A4A4A',            
  grayText: '#888888',        
  primaryText: '#A078D2',     
  heart: '#FBAFFE',           
  white: '#FFFFFF',
  tabbg: '#E7D7FB'
};

// 🌟 未來你想換背景圖，把這裡的網址改成 require('../assets/你的圖片.png') 就可以了
const backgroundUrl = require('../assets/bg.png');

export default function LogbookScreen() {
  const params = useLocalSearchParams();
  // 🌟 2. 判斷網址裡面有沒有 filterDate（如果有，代表是從日曆點進來的）
  const isFromCalendar = !!params.filterDate;

  const router = useRouter();
  const pathname = usePathname();
  
  const { filterDate } = useLocalSearchParams();

  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState('newest'); 
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchLogs = async () => {
        try {
          const storedLogs = await AsyncStorage.getItem('cafe_logs');
          if (storedLogs) {
            setLogs(JSON.parse(storedLogs));
          }
        } catch (error) {
          console.error("讀取紀錄失敗", error);
        }
      };
      fetchLogs();
    }, [])
  );

  const processedLogs = useMemo(() => {
    let filtered = logs;
    
    if (filterDate) {
        filtered = filtered.filter(log => log.date === filterDate);
    }

    filtered = filtered.filter(log => {
      const query = searchQuery.toLowerCase();
      const matchTitle = log.title?.toLowerCase().includes(query);
      const matchLocation = log.location?.toLowerCase().includes(query);
      const matchTags = log.tags?.toLowerCase().includes(query);
      const matchNote = log.note?.toLowerCase().includes(query);
      return matchTitle || matchLocation || matchTags || matchNote;
    });

    return filtered.sort((a, b) => {
      if (sortType === 'newest') return new Date(b.date) - new Date(a.date);
      else if (sortType === 'oldest') return new Date(a.date) - new Date(b.date);
      else if (sortType === 'rating') return b.rating - a.rating; 
      return 0;
    });
  }, [logs, searchQuery, sortType, filterDate]);

  const renderLogCard = ({ item }) => {
    const logDate = new Date(item.date);
    const month = logDate.getMonth() + 1;
    const day = String(logDate.getDate()).padStart(2, '0');
    const tagsArray = item.tags ? item.tags.split(' ').filter(t => t.trim() !== '') : [];

    return (
      <TouchableOpacity 
        style={styles.cardContainer} 
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: '/log', params: { id: item.id } })}
      >
        <View style={styles.cardImageWrapper}>
          <ImageBackground source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=300&auto=format&fit=crop' }} style={styles.cardImage}>
            <View style={styles.imageOverlay}>
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeMonth}>{month}月</Text>
                <Text style={styles.dateBadgeDay}>{day}</Text>
              </View>
              <View style={styles.imageBottomInfo}>
                <View style={styles.imageLocationRow}>
                  <Ionicons name="location-outline" size={12} color={colors.white} />
                  <Text style={styles.imageLocationText} numberOfLines={1}>{item.location || '秘密基地'}</Text>
                </View>
                <View style={styles.imageRatingRow}>
                  {[1, 2, 3, 4, 5].map((heart) => (
                    <Ionicons key={heart} name="heart" size={10} color={heart <= item.rating ? colors.heart : 'rgba(255,255,255,0.4)'} style={{ marginRight: 2 }} />
                  ))}
                  <Text style={styles.imageRatingText}>{Number(item.rating).toFixed(1)}</Text>
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>

        <View style={styles.cardTextWrapper}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          </View>
          <Text style={styles.cardNote} numberOfLines={3}>{item.note || '沒有留下筆記...'}</Text>
          
          <View style={styles.cardTagsRow}>
            {tagsArray.slice(0, 2).map((tag, idx) => (
              <View key={idx} style={styles.tagBadge}><Text style={styles.tagText}>{tag}</Text></View>
            ))}
            {tagsArray.length > 2 && <View style={styles.tagBadge}><Text style={styles.tagText}>...</Text></View>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const displayTitle = filterDate ? `${filterDate.split('-')[0]}年${parseInt(filterDate.split('-')[1])}月${parseInt(filterDate.split('-')[2])}日` : '紀錄本';

  return (
    // 🌟 拿掉動態計算，回歸最單純的樣式
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          // 🌟 從日曆來就右滑，從導覽列來就用極快的淡入淡出
          animation: isFromCalendar ? 'slide_from_right' : 'fade',
          animationDuration: 150 // 讓淡出的速度變快
        }} 
      />
      <ImageBackground source={ backgroundUrl } style={{ flex: 1 }} resizeMode="repeat" imageStyle={{ opacity: 1, transform: [{ scale: 2 }] }}>
       <Stack.Screen options={{ headerShown: false, headerTransparent: true }} />
              
        <View style={styles.header}>
          {filterDate && (
             <TouchableOpacity style={{ marginRight: 15 }} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
             </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{displayTitle}</Text>
        </View>

        {!filterDate && (
          <View style={styles.toolbarRow}>
            <View style={styles.searchPill}>
              <Ionicons name="search" size={16} color={colors.primaryText} />
              <TextInput style={styles.searchInput} placeholder="搜尋內容" placeholderTextColor={colors.grayText} value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <TouchableOpacity style={styles.sortPill} onPress={() => setIsSortModalVisible(true)}>
              <Ionicons name="list" size={16} color={colors.primaryText} />
              <Text style={styles.sortText}>{sortType === 'newest' ? '最新' : sortType === 'oldest' ? '最舊' : '評分'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {processedLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={60} color={'#EBE5F5'} style={{ marginBottom: 15 }} />
            <Text style={styles.emptyText}>{filterDate ? '這天沒有相關紀錄 ☕️' : '找不到相關紀錄 ☕️'}</Text>
            {filterDate && (
               <TouchableOpacity style={styles.emptyAddBtn} onPress={() => router.push('/addlog')}>
                  <Ionicons name="add" size={18} color={colors.white} style={{ marginRight: 5 }} />
                  <Text style={styles.emptyAddBtnText}>新增紀錄</Text>
               </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList data={processedLogs} keyExtractor={(item) => item.id} renderItem={renderLogCard} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
        )}

        <Modal visible={isSortModalVisible} transparent={true} animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsSortModalVisible(false)}>
            <View style={styles.sortModalCard}>
              <Text style={styles.sortModalTitle}>選擇排序方式</Text>
              <TouchableOpacity style={styles.sortOptionBtn} onPress={() => { setSortType('newest'); setIsSortModalVisible(false); }}>
                <Text style={[styles.sortOptionText, sortType === 'newest' && styles.sortOptionTextActive]}>最新紀錄優先</Text>
                {sortType === 'newest' && <Ionicons name="checkmark" size={20} color={colors.primaryText} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortOptionBtn} onPress={() => { setSortType('oldest'); setIsSortModalVisible(false); }}>
                <Text style={[styles.sortOptionText, sortType === 'oldest' && styles.sortOptionTextActive]}>最舊紀錄優先</Text>
                {sortType === 'oldest' && <Ionicons name="checkmark" size={20} color={colors.primaryText} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.sortOptionBtn} onPress={() => { setSortType('rating'); setIsSortModalVisible(false); }}>
                <Text style={[styles.sortOptionText, sortType === 'rating' && styles.sortOptionTextActive]}>最高評分優先</Text>
                {sortType === 'rating' && <Ionicons name="checkmark" size={20} color={colors.primaryText} />}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {!filterDate && (
          <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => router.push('/addlog')}>
            <Ionicons name="add" size={32} color={colors.white} />
          </TouchableOpacity>
        )}

        {!filterDate && (
          <View style={styles.tabBarWrapper}>
            <View style={styles.tabBar}>
              <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/')}>
                <Ionicons name="calendar-outline" size={22} color={pathname === '/' ? colors.primaryText : colors.grayText} />
                <Text style={[styles.tabText, pathname === '/' && styles.tabTextActive]}>主頁</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/map')}>
                <Ionicons name="map-outline" size={22} color={pathname === '/map' ? colors.primaryText : colors.grayText} />
                <Text style={[styles.tabText, pathname === '/map' && styles.tabTextActive]}>地圖</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/logbook')}>
                <View style={styles.tabItemActiveBg}><Ionicons name="book-outline" size={22} color={colors.primaryText} /></View>
                <Text style={[styles.tabText, styles.tabTextActive]}>紀錄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/setting')}>
                <Ionicons name="settings-outline" size={22} color={pathname === '/setting' ? colors.primaryText : colors.grayText} />
                <Text style={[styles.tabText, pathname === '/setting' && styles.tabTextActive]}>設定</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent'},
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 80, paddingBottom: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  toolbarRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15 },
  searchPill: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderColor: colors.secondary, borderWidth: 1, borderRadius: 25, paddingHorizontal: 15, height: 40, marginRight: 10 },
  
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.text, includeFontPadding: false, textAlignVertical: 'center', paddingBottom:4},
  
  sortPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 25, paddingHorizontal: 18, height: 40, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  sortText: { includeFontPadding: false, marginLeft: 5, fontSize: 14, color: colors.primaryText, fontWeight: 'bold' },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 }, 
  
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 0 },
  emptyText: { color: colors.grayText, fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
  emptyAddBtn: { flexDirection: 'row', backgroundColor: colors.primaryText, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, alignItems: 'center', elevation: 4 },
  emptyAddBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 15 },

  // 🌟 卡片升級：加上強烈的陰影，讓它浮出來的感覺更明顯
  cardContainer: { 
    flexDirection: 'row', 
    backgroundColor: colors.white, 
    borderRadius: 20, 
    marginBottom: 18, // 稍微拉開距離讓陰影有空間
    elevation: 8, // Android 陰影加強
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, // iOS 陰影往下掉一點
    shadowOpacity: 0.15, // iOS 陰影變深一點
    shadowRadius: 12, // iOS 陰影暈染範圍變大
    height: 180, // 🌟 照片放大：高度從 160 調成 180
  },
  cardImageWrapper: { 
    width: 170, 
    height: '100%',
    // 🌟 把裁切的工作交給照片的容器，而且只切左上跟左下，配合外層卡片的圓角
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  cardImage: { flex: 1, resizeMode: 'cover' },
  imageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'space-between', padding: 12 },
  dateBadge: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', alignItems: 'center' },
  dateBadgeMonth: { fontSize: 10, fontWeight: 'bold', color: colors.text },
  dateBadgeDay: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: -2 },
  imageBottomInfo: { justifyContent: 'flex-end' },
  imageLocationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  imageLocationText: { fontSize: 11, color: colors.white, fontWeight: '700', marginLeft: 2 },
  imageRatingRow: { flexDirection: 'row', alignItems: 'center' },
  imageRatingText: { fontSize: 11, color: colors.white, fontWeight: 'bold', marginLeft: 6 },
  
  cardTextWrapper: { flex: 1, padding: 15, justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, flex: 1, marginRight: 10 },
  cardNote: { fontSize: 12, color: colors.grayText, lineHeight: 18, flex: 1, marginTop: 8 },
  
  cardTagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  tagBadge: { backgroundColor: colors.secondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 4 },
  tagText: { color: colors.primaryText, fontSize: 10, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sortModalCard: { backgroundColor: colors.white, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 25, paddingBottom: 40 },
  sortModalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 20, textAlign: 'center' },
  sortOptionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sortOptionText: { fontSize: 16, color: colors.text },
  sortOptionTextActive: { color: colors.primaryText, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 110, right: 20, backgroundColor: colors.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, zIndex: 10 },
  tabBarWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent' },
  tabBar: { flexDirection: 'row', height: 85, backgroundColor: colors.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 15, paddingHorizontal: 15 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 15 },
  tabItemActiveBg: { backgroundColor: colors.tabbg, width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginTop: -8, marginBottom: 2 },
  tabText: { fontSize: 10, color: colors.grayText, marginTop: 4, fontWeight: 'bold' },
  tabTextActive: { color: colors.primaryText }
});