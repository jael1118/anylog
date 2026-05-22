import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  ScrollView, StatusBar, Image, Switch 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { subscribeToUserSpaces } from './firebaseServices'; 

export default function ProfileScreen() {
  const router = useRouter();

  const [myUserId, setMyUserId] = useState(null);
  const [mySpaces, setMySpaces] = useState([]);

  // 開關狀態設定
  const [uploadReminder, setUploadReminder] = useState(false);
  const [timeReminder, setTimeReminder] = useState(false);
  const [joinSpaceReminder, setJoinSpaceReminder] = useState(false);

  // 初始化與取得所屬空間
  useEffect(() => {
    const initialize = async () => {
      let storedId = await AsyncStorage.getItem('@my_device_user_id');
      setMyUserId(storedId);
    };
    initialize();
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (spaces) => {
      setMySpaces(spaces);
    });
    return () => unsubscribe();
  }, [myUserId]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. 個人頭像區塊 */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder} />
            <TouchableOpacity style={styles.editIconBtn}>
              <Feather name="edit-2" size={10} color="#333" />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>Name</Text>
        </View>

        {/* 2. 空間管理區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>空間管理</Text>
          
          <View style={styles.spaceListWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spaceList}>
              {/* 渲染從資料庫抓來的空間 */}
              {mySpaces.map((space) => (
                <TouchableOpacity key={space.id} style={styles.spaceCard}>
                  <View style={styles.spaceImagePlaceholder} />
                  <View style={styles.spaceLabel}>
                    <Text style={styles.spaceLabelText} numberOfLines={1}>{space.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* 如果還沒加入任何空間的預設提示 */}
              {mySpaces.length === 0 && (
                <View style={[styles.spaceCard, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#999', fontSize: 12 }}>尚無空間</Text>
                </View>
              )}
            </ScrollView>
            
            {/* 右側箭頭裝飾 */}
            <View style={styles.rightArrowContainer} pointerEvents="none">
              <Feather name="chevron-right" size={24} color="#333" />
            </View>
          </View>
        </View>

        {/* 3. 提醒設定區塊 */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>提醒</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>上傳</Text>
            <Switch 
              value={uploadReminder} 
              onValueChange={setUploadReminder}
              trackColor={{ false: "#E0E0E0", true: "#333333" }}
              thumbColor={"#FFFFFF"}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>定時</Text>
            <Text style={styles.settingValue}>9:00</Text>
            <Switch 
              value={timeReminder} 
              onValueChange={setTimeReminder}
              trackColor={{ false: "#E0E0E0", true: "#333333" }}
              thumbColor={"#FFFFFF"}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>加入空間</Text>
            <Switch 
              value={joinSpaceReminder} 
              onValueChange={setJoinSpaceReminder}
              trackColor={{ false: "#E0E0E0", true: "#333333" }}
              thumbColor={"#FFFFFF"}
            />
          </View>
        </View>
        
        {/* 底部預留空間給懸浮列 */}
        <View style={{ height: 100 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

// 樣式表
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingTop: 40, paddingHorizontal: 20 },
  
  // 個人頭像
  profileSection: { alignItems: 'center', marginBottom: 40 },
  avatarContainer: { position: 'relative' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#A3A3A3' },
  editIconBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#EAEAEA', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  userName: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 15 },

  // 區塊共用
  sectionContainer: { marginBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 15 },

  // 空間管理卡片
  spaceListWrapper: { position: 'relative' },
  spaceList: { flexDirection: 'row' },
  spaceCard: { width: 110, height: 130, marginRight: 10, backgroundColor: '#E0E0E0', borderRadius: 0, overflow: 'hidden' }, // 照視覺圖做直角
  spaceImagePlaceholder: { flex: 1, backgroundColor: '#D4D4D4' },
  spaceLabel: { height: 30, backgroundColor: '#999999', justifyContent: 'center', paddingHorizontal: 8 },
  spaceLabelText: { color: '#FFF', fontSize: 12, fontWeight: '500' },
  rightArrowContainer: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 5 },

  // 設定選項
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  settingLabel: { fontSize: 15, color: '#666', flex: 1 },
  settingValue: { fontSize: 15, color: '#999', marginRight: 15 },

  });