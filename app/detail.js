import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Dimensions, Image, StatusBar, ScrollView 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

const windowWidth = Dimensions.get('window').width;

export default function DetailScreen() {
  const router = useRouter();
  const { record: recordString } = useLocalSearchParams();
  const record = recordString ? JSON.parse(recordString) : null;

  const [activeIndex, setActiveIndex] = useState(0);

  if (!record) return null;

  // 確保圖片格式是陣列
  const images = record.imageUrls || (record.imageUrl ? [record.imageUrl] : []);

  // 格式化時間 (例如: 今日13:10)
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `今日${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
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
              {/* ✅ 修改：改為動態讀取資料庫存入的地點文字 */}
              <Text style={styles.locationText}>{record.location || "未知地點"}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity>
          <Feather name="smile" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* 2. 圖片輪播區 (灰底大圖) */}
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

        {/* 3. 分頁圓點 */}
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

        {/* 4. 文字內容區 */}
        <View style={styles.contentArea}>
          <Text style={styles.noteText}>
            {record.note || "這筆紀錄沒有文字描述。"}
          </Text>
        </View>
      </ScrollView>

      {/* 5. 底部藥丸導覽列 */}
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

  imageSection: { width: windowWidth, height: windowWidth * 1.1, backgroundColor: '#D9D9D9' },
  mainImage: { width: windowWidth, height: windowWidth * 1.1 },
  dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, marginBottom: 15 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },

  contentArea: { paddingHorizontal: 20 },
  noteText: { fontSize: 13, lineHeight: 20, color: '#333' },

  floatingBottomNav: { position: 'absolute', bottom: 30, alignSelf: 'center', width: '85%', height: 60, backgroundColor: '#F5F5F5', borderRadius: 30, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  navItem: { padding: 10 },
});