import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🌟 全面套用治癒系紫羅蘭/粉色系配色
const colors = {
  primary: '#A078D2',         // 深紫 (導覽列選中狀態)
  secondary: '#E7D7FB',       // 淺紫 (導覽列選中背景)
  background: '#F8F8FC',      // 極淺灰紫底色
  text: '#4A4A4A',            // 深棕色 (標題與名稱)
  grayText: '#888888',        // 次要灰色
  white: '#FFFFFF',
  accentPink: '#FBAFFE',      // 編輯按鈕的粉紅
  avatarBg: '#877D7D'         // 質感灰色頭像底色
};

export default function SettingsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    // 🌟 1. 滿版沉浸式設定
    <View style={[styles.container, ]}>
      <Stack.Screen options={{ headerShown: false, headerTransparent: true }} />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} /> 

      <View style={styles.header}>
        <Text style={styles.headerTitle}>設定</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{padding: 20}} showsVerticalScrollIndicator={false}>
        
        {/* 🌟 2. 個人資料大卡片 (依據截圖重新排版置中) */}
        <View style={styles.profileCard}>
          {/* 右上角編輯按鈕 */}
          <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={14} color={colors.white} />
          </TouchableOpacity>
          
          <View style={styles.avatar} />
          <Text style={styles.userName}>your name</Text>
        </View>

        {/* 🌟 3. 選項清單 (加入圖示與文字) */}
        <TouchableOpacity style={styles.optionCard} activeOpacity={0.7}>
          <View style={styles.optionLeft}>
            <Ionicons name="star-outline" size={20} color={colors.text} />
            <Text style={styles.optionText}>主題顏色</Text>
          </View>
          <View style={styles.optionRight}>
            <Text style={styles.optionSubText}>Light purple</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionCard} activeOpacity={0.7}>
          <View style={styles.optionLeft}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.text} />
            <Text style={styles.optionText}>應用程式資訊</Text>
          </View>
          <View style={styles.optionRight}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </View>
        </TouchableOpacity>

        {/* 截圖下方的空白卡片 */}
        <View style={styles.emptyOptionCard} />

        {/* 底部留白避免被導覽列遮擋 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 導覽列 */}
      <View style={styles.tabBarWrapper}>
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/')}>
             <Ionicons name="calendar-outline" size={22} color={colors.grayText} />
            <Text style={styles.tabText}>主頁</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/map')}>
            <Ionicons name="map-outline" size={22} color={colors.grayText} />
             <Text style={styles.tabText}>地圖</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/logbook')}>
            <Ionicons name="book-outline" size={22} color={colors.grayText} />
             <Text style={styles.tabText}>紀錄</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.tabItem} onPress={() => router.replace('/setting')}>
            <View style={styles.tabItemActiveBg}>
               <Ionicons name="settings-outline" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.tabText, styles.tabTextActive]}>設定</Text>
          </TouchableOpacity>
        </View>
      </View>
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 25, paddingBottom: 10, paddingTop: 80 }, // 配合 insets 微調
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  content: { flex: 1 },
  
  // 🌟 新版：置中個人資料卡片
  profileCard: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: colors.white, 
    borderRadius: 25, 
    paddingVertical: 35, // 讓上下空間寬裕一點
    marginBottom: 20, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 5,
    position: 'relative' // 為了讓編輯按鈕絕對定位
  },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: colors.avatarBg,
    marginBottom: 15 
  }, 
  editButton: { 
    position: 'absolute', 
    top: 20, 
    right: 20, 
    backgroundColor: colors.accentPink, 
    width: 26, 
    height: 26, 
    borderRadius: 13, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 3
  },
  userName: { 
    fontSize: 22, 
    fontWeight: '900', 
    color: colors.text 
  },
  
  // 🌟 新版：選項卡片
  optionCard: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white, 
    borderRadius: 20, 
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 15, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 5 
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  optionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 12
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  optionSubText: {
    fontSize: 12,
    color: colors.text,
    marginRight: 8
  },
  emptyOptionCard: { 
    backgroundColor: colors.white, 
    borderRadius: 20, 
    height: 60, 
    marginBottom: 15, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 5 
  },
  
  // 底部導覽列
  tabBarWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'transparent' },
  tabBar: { flexDirection: 'row', height: 85, backgroundColor: colors.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 10, paddingHorizontal: 15 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 15 },
  tabItemActiveBg: { backgroundColor: colors.secondary, width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginTop: -8, marginBottom: 2 },
  tabText: { fontSize: 10, color: colors.grayText, marginTop: 4, fontWeight: 'bold' },
  tabTextActive: { color: colors.primary }
});