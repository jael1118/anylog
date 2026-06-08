import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, SafeAreaView, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeToMyNotifications, markNotificationsAsRead } from './firebaseServices';

// 🌟 引入全域主題 Context
import { useAppTheme } from './ThemeContext';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [myUserId, setMyUserId] = useState(null);

  // 🌟 從全域主題中撈取當前的 theme 設定
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;

  useEffect(() => {
    const getUserId = async () => {
      const storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);
    };
    getUserId();
  }, []);

  useEffect(() => {
    if (!myUserId) return;

    const unsubscribe = subscribeToMyNotifications(myUserId, (notifs) => {
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [myUserId]);

  // 點擊通知的處理：標記單筆為已讀並跳轉
  const handleNotificationPress = async (item) => {
    if (!item.isRead) {
      await markNotificationsAsRead(myUserId, [item]); 
    }

    if (item.recordData) {
      router.push({
        pathname: '/detail',
        params: { record: item.recordData }
      });
    }
  };

  const renderItem = ({ item }) => {
    const timeDiff = Math.floor((Date.now() - item.createdAt) / 60000); 
    const timeText = timeDiff < 60 ? `${timeDiff} 分鐘前` : 
                     timeDiff < 1440 ? `${Math.floor(timeDiff/60)} 小時前` : 
                     `${Math.floor(timeDiff/1440)} 天前`;

    return (
      <TouchableOpacity 
        style={[
          styles.notificationCard, 
          { borderBottomColor: darkMode ? '#1C1C1E' : '#F9F9F9' },
          !item.isRead && (darkMode ? styles.unreadCardDark : styles.unreadCard)
        ]}
        onPress={() => handleNotificationPress(item)} 
      >
        {item.userAvatar ? (
          <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center', backgroundColor: darkMode ? '#2C2C2E' : '#E0E0E0' }]}>
             <Feather name="user" size={20} color={darkMode ? '#8E8E93' : '#FFF'} />
          </View>
        )}
        
        {/* 文字容器樣式調整 */}
        <View style={styles.textContainer}>
          <View style={styles.actionRow}>
            {/* 強調名字 */}
            <Text style={[styles.boldText, { color: theme.text }]}>{item.userName || '神祕成員'}</Text>
            {/* 說明動作 */}
            <Text style={[styles.normalText, { color: theme.text }]}> 在 {item.spaceName} {item.action}</Text>
          </View>
          <Text style={[styles.timeText, { color: theme.valueText }]}>{timeText}</Text>
        </View>

        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      
      <View style={[styles.header, { borderBottomColor: darkMode ? '#1C1C1E' : '#F0F0F0' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>通知</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color={darkMode ? '#2C2C2E' : '#CCC'} />
            <Text style={[styles.emptyText, { color: theme.valueText }]}>目前沒有新通知喔</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1 },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  listContainer: { paddingVertical: 10 },
  
  notificationCard: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    paddingVertical: 15, 
    paddingHorizontal: 20, 
    borderBottomWidth: 1
  },
  unreadCard: { backgroundColor: '#F4F8FF' }, 
  unreadCardDark: { backgroundColor: '#1A2235' }, // 🌟 新增深色模式下未讀通知的高質感暗藍底色
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 15 },
  
  textContainer: { 
    flex: 1, 
    justifyContent: 'flex-start',
    marginTop: 2 
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', 
    alignItems: 'center',
    marginBottom: 4
  },
  boldText: { fontSize: 15, fontWeight: 'bold' },
  normalText: { fontSize: 15 },
  
  timeText: { fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginLeft: 10, marginTop: 18 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, marginTop: 15 }
});