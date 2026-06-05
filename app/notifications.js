import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeToMyNotifications, markNotificationsAsRead } from './firebaseServices';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [myUserId, setMyUserId] = useState(null);

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

  // ✅ 點擊通知的處理：標記單筆為已讀並跳轉
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
        style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)} 
      >
        {item.userAvatar ? (
          <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center' }]}>
             <Feather name="user" size={20} color="#FFF" />
          </View>
        )}
        
        {/* ✅ 修改這裡：把文字拆開，不再包在一起，並確保垂直排列 */}
        <View style={styles.textContainer}>
          <View style={styles.actionRow}>
            {/* 強調名字 */}
            <Text style={styles.boldText}>{item.userName || '神祕成員'}</Text>
            {/* 說明動作 */}
            <Text style={styles.normalText}> 在 {item.spaceName} {item.action}</Text>
          </View>
          <Text style={styles.timeText}>{timeText}</Text>
        </View>

        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>通知</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={48} color="#CCC" />
            <Text style={styles.emptyText}>目前沒有新通知喔</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  listContainer: { paddingVertical: 10 },
  
  // ✅ 確保卡片內容置頂對齊，避免文字多時大頭貼被推到中間
  notificationCard: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    paddingVertical: 15, 
    paddingHorizontal: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F9F9F9' 
  },
  unreadCard: { backgroundColor: '#F4F8FF' }, 
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0E0E0', marginRight: 15 },
  
  // ✅ 文字容器樣式調整
  textContainer: { 
    flex: 1, 
    justifyContent: 'flex-start',
    marginTop: 2 // 稍微往下推一點跟頭像對齊
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap', // ✅ 如果字太長允許換行
    alignItems: 'center',
    marginBottom: 4
  },
  boldText: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  normalText: { fontSize: 15, color: '#333' },
  
  timeText: { fontSize: 12, color: '#999' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginLeft: 10, marginTop: 18 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 15 }
});