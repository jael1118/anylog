import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  ScrollView, StatusBar, Share, ActivityIndicator, Image, Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig'; 
import { subscribeToUserSpaces } from './firebaseServices';

import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

// 🌟 1. 雜誌級照片牆排版 (完美間距與錯落設計)
const LEVEL_CONFIG = {
  1: {
    target: 3, 
    reward: "專屬空間背景主題", 
    pieces: [
      // 🌟 Lv1：不對稱的大區塊，經典雜誌風 (保留完美的 5% 間距)
      { top: '15%', left: '10%', width: '37.5%', height: '70%' },  // 左側直立大圖
      { top: '15%', left: '52.5%', width: '37.5%', height: '32.5%' }, // 右上橫式
      { top: '52.5%', left: '52.5%', width: '37.5%', height: '32.5%' }, // 右下方塊
    ]
  },
  2: {
    target: 8, // 累積 8 篇 (此級需 5 篇)
    reward: "解鎖特殊心情貼紙",
    pieces: [
      // 🌟 Lv2：保留你喜歡的錯落版型，這組的 5% 間距非常漂亮
      { top: '5%', left: '5%', width: '30%', height: '60%' }, 
      { top: '5%', left: '40%', width: '55%', height: '25%' }, 
      { top: '35%', left: '40%', width: '25%', height: '30%' }, 
      { top: '35%', left: '70%', width: '25%', height: '60%' }, 
      { top: '70%', left: '5%', width: '60%', height: '25%' }, 
    ]
  },
  3: {
    target: 16, // 目標篇數可以依據你的需求調整
    reward: "自訂介面顏色",
    pieces: [
      // 🌟 完美還原：8 塊錯落藝術拼貼 (對應你提供的截圖)
      { top: '15%', left: '35%', width: '30%', height: '15%' }, 
      { top: '28%', left: '55%', width: '25%', height: '15%' },
      { top: '35%', left: '15%', width: '15%', height: '22%' },
      { top: '35%', left: '35%', width: '15%', height: '15%' },
      { top: '48%', left: '50%', width: '15%', height: '20%' },
      { top: '48%', left: '70%', width: '15%', height: '30%' },
      { top: '62%', left: '10%', width: '25%', height: '15%' },
      { top: '70%', left: '38%', width: '20%', height: '15%' },
    ]
  },
  4: {
    target: 28, // 累積 33 篇 (此級需 15 篇)
    reward: "專屬徽章",
    pieces: [
      // 🌟 Lv4：15 塊拼圖的高級畫廊排版 (2% 間距)
      { top: '8%', left: '5%', width: '18%', height: '18%' }, // Top Left
      { top: '12%', left: '30%', width: '30%', height: '15%' }, // Top Mid
      { top: '5%', left: '70%', width: '20%', height: '22%' }, // Top Right
      { top: '32%', left: '8%', width: '15%', height: '20%' }, // Mid Left
      { top: '38%', left: '28%', width: '18%', height: '18%' }, // Mid Center-Left
      { top: '45%', left: '50%', width: '25%', height: '25%' }, // Mid Center-Right
      { top: '35%', left: '80%', width: '12%', height: '28%' }, // Mid Right
      { top: '65%', left: '22%', width: '20%', height: '15%' }, // Lower Center
      { top: '72%', left: '55%', width: '15%', height: '10%' }, // Lower Right
      { top: '85%', left: '8%', width: '15%', height: '8%' }, // Bottom Left
      { top: '80%', left: '30%', width: '25%', height: '12%' }, // Bottom Center
      { top: '88%', left: '65%', width: '20%', height: '10%' }, // Bottom Right
    ]
  },
  5: {
    target: 43, // 累積 53 篇 (此級需 20 篇)
    reward: "隱藏版終極成就",
    pieces: [
      // 🌟 Lv5：終極 20 塊回憶牆，緊湊但不雜亂
      { top: '0%', left: '0%', width: '38.8%', height: '38.8%' },     // 左上巨型方塊
      { top: '0%', left: '40.8%', width: '38.8%', height: '18.4%' },  // 中上大橫幅
      { top: '0%', left: '81.6%', width: '18.4%', height: '18.4%' },  // 右上角落
      { top: '20.4%', left: '40.8%', width: '18.4%', height: '38.8%' },// 正中間長直
      { top: '20.4%', left: '61.2%', width: '38.8%', height: '38.8%' },// 右側巨型方塊
      { top: '40.8%', left: '0%', width: '18.4%', height: '38.8%' },  // 左側長直
      { top: '40.8%', left: '20.4%', width: '18.4%', height: '18.4%' },// 左中小格
      { top: '61.2%', left: '20.4%', width: '38.8%', height: '18.4%' },// 中下大橫幅
      { top: '61.2%', left: '61.2%', width: '18.4%', height: '18.4%' },// 右下偏中小格
      { top: '61.2%', left: '81.6%', width: '18.4%', height: '18.4%' },// 右下邊緣小格
      { top: '81.6%', left: '0%', width: '18.4%', height: '18.4%' },  // 底部區塊 1
      { top: '81.6%', left: '20.4%', width: '18.4%', height: '18.4%' },// 底部區塊 2
      { top: '81.6%', left: '40.8%', width: '18.4%', height: '18.4%' },// 底部區塊 3
      { top: '81.6%', left: '61.2%', width: '18.4%', height: '18.4%' },// 底部區塊 4
      { top: '81.6%', left: '81.6%', width: '18.4%', height: '18.4%' },// 底部區塊 5
    ]
  }
};

// 🌟 2. 獨立的成就相框卡片元件 (支援左右滑動與照片載入)
const AchievementCard = ({ spaceName, currentPosts, spaceImages }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const puzzleRef = useRef(null);
  // 計算該空間最高解鎖到第幾級
  const levelKeys = Object.keys(LEVEL_CONFIG).map(Number);
  let maxUnlockedLevel = 1;
  for (let level of levelKeys) {
    if (currentPosts >= LEVEL_CONFIG[level].target) {
      maxUnlockedLevel = level + 1;
    }
  }
  const maxConfiguredLevel = Math.max(...levelKeys);
  const highestVisibleLevel = Math.min(maxUnlockedLevel, maxConfiguredLevel);

  const [viewingLevel, setViewingLevel] = useState(highestVisibleLevel);

  useEffect(() => {
    setViewingLevel(highestVisibleLevel);
  }, [highestVisibleLevel]);

  const config = LEVEL_CONFIG[viewingLevel];
  
  const baseTarget = viewingLevel > 1 ? LEVEL_CONFIG[viewingLevel - 1].target : 0;
  const postsInThisLevel = Math.max(0, currentPosts - baseTarget);
  const requiredForThisLevel = config.target - baseTarget;
  const progressCount = Math.min(postsInThisLevel, requiredForThisLevel);
  const remaining = requiredForThisLevel - progressCount;
  const isLevelCompleted = remaining <= 0;

  const handlePrevLevel = () => {
    if (viewingLevel > 1) setViewingLevel(viewingLevel - 1);
  };

  const handleNextLevel = () => {
    if (viewingLevel < highestVisibleLevel) setViewingLevel(viewingLevel + 1);
  };

  const handleShareOrDownload = async () => {
    try {
      // 1. 執行截圖，取得圖片的暫存 URI
      const uri = await puzzleRef.current.capture();
      
      Alert.alert("分享回憶", "要把這面專屬相框牆存下來或分享給朋友嗎？", [
        { 
          text: "分享圖片", 
          onPress: async () => {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
              await Sharing.shareAsync(uri);
            } else {
              Alert.alert("提示", "你的設備不支援分享功能");
            }
          }
        },
        { 
          text: "下載到相簿", 
          onPress: async () => {
            // 請求相簿權限
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              await MediaLibrary.saveToLibraryAsync(uri);
              Alert.alert("成功", "這片回憶牆已經存到你的相簿囉！");
            } else {
              Alert.alert("提示", "需要允許相簿權限才能下載圖片喔！");
            }
          }
        },
        { text: "取消", style: "cancel" }
      ]);
    } catch (e) {
      console.error("截圖或分享失敗", e);
      Alert.alert("錯誤", "處理圖片時發生錯誤");
    }
  };

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity 
        style={styles.cardHeader} 
        activeOpacity={0.7} 
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.cardSubtitle}>{spaceName}</Text>
          <Text style={styles.cardLevelTitle}>Lv.{maxUnlockedLevel}</Text>
        </View>
        <View style={styles.headerRight}>
          {!isExpanded && (
            <Text style={styles.collapsedProgressText}>{currentPosts} 篇</Text>
          )}
          <View style={styles.iconCircle}>
            <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#666" />
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.cardBody}>
          
          {/* 🌟 左右滑動控制列 */}
          <View style={styles.levelControlRow}>
            <TouchableOpacity onPress={handlePrevLevel} disabled={viewingLevel === 1} style={styles.arrowBtn}>
              <Feather name="chevron-left" size={24} color={viewingLevel === 1 ? "#DDD" : "#333"} />
            </TouchableOpacity>
            
            <Text style={styles.viewingLevelText}>Lv.{viewingLevel}</Text>

            <TouchableOpacity 
              onPress={handleNextLevel} 
              disabled={viewingLevel === highestVisibleLevel} 
              style={styles.arrowBtn}
            >
              <Feather name="chevron-right" size={24} color={viewingLevel === highestVisibleLevel ? "#DDD" : "#333"} />
            </TouchableOpacity>
          </View>

          {/* 🌟 相框顯示區塊 */}
          <ViewShot ref={puzzleRef} options={{ format: "jpg", quality: 0.9 }}>
          <View style={styles.puzzleContainer}>
            {config.pieces.map((piece, index) => {
              const isUnlocked = index < progressCount;
              const imageIndex = baseTarget + index;
              const photoUrl = spaceImages[imageIndex];

              return (
                <View 
                  key={index} 
                  style={[
                    styles.puzzlePiece,
                    { 
                      top: piece.top, left: piece.left, 
                      width: piece.width, height: piece.height,
                      backgroundColor: isUnlocked ? '#EAEAEA' : '#F7F7F7', 
                    }
                  ]} 
                >
                  {isUnlocked ? (
                    photoUrl ? (
                      <Image 
                        source={{ uri: photoUrl }} 
                        style={styles.puzzleImage} 
                        resizeMode="cover" 
                      />
                    ) : (
                      <View style={[styles.puzzleImage, { justifyContent: 'center', alignItems: 'center' }]}>
                        <Feather name="type" size={14} color="#999" />
                      </View>
                    )
                  ) : (
                    <View style={[styles.puzzleImage, { justifyContent: 'center', alignItems: 'center' }]}>
                      <Feather name="lock" size={14} color="#CCC" />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          </ViewShot>

          <View style={styles.progressRow}>
            <Text style={styles.progressValue}>{progressCount}</Text>
            <Text style={styles.progressDivider}> / </Text>
            <Text style={styles.progressMax}>{requiredForThisLevel}</Text>
          </View>

          <View style={styles.hintBox}>
            <Feather name={isLevelCompleted ? "unlock" : "lock"} size={16} color="#666" />
            {isLevelCompleted ? (
              <Text style={styles.hintText}>
                已完成 Lv.{viewingLevel}！獲得獎勵：<Text style={{fontWeight:'bold'}}>{config.reward}</Text>
              </Text>
            ) : (
              <Text style={styles.hintText}>
                再 <Text style={{fontWeight:'bold', color:'#333'}}>{remaining}</Text> 則貼文 完成Lv.{viewingLevel} 解鎖新的相框版型！
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShareOrDownload}>
            <Feather name="upload" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// 🌟 3. 主頁面結構
export default function AchievementsScreen() {
  const router = useRouter();

  const [spaces, setSpaces] = useState([]);
  const [spaceDataCache, setSpaceDataCache] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const storedId = await AsyncStorage.getItem('@my_device_user_id');
      if (!storedId) return;

      const unsubscribe = subscribeToUserSpaces(storedId, async (fetchedSpaces) => {
        setSpaces(fetchedSpaces);
        
        const cache = {};
        for (const space of fetchedSpaces) {
          try {
            const q = query(
              collection(db, 'Records'), 
              where('spaceId', '==', space.id)
            );
            const snapshot = await getDocs(q);
            
            const records = snapshot.docs.map(doc => doc.data());
            records.sort((a, b) => a.createdAt - b.createdAt);

            const images = records.map(r => {
              if (r.imageUrls && r.imageUrls.length > 0) return r.imageUrls[0];
              if (r.imageUrl) return r.imageUrl;
              return null;
            });

            cache[space.id] = {
              postCount: snapshot.size,
              images: images
            };
          } catch (e) {
            console.error(`讀取 ${space.name} 資料失敗`, e);
            cache[space.id] = { postCount: 0, images: [] };
          }
        }
        
        setSpaceDataCache(cache);
        setIsLoading(false);
      });
      
      return () => unsubscribe();
    };
    init();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Feather name="chevron-left" size={26} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>空間成就</Text>
        </View>
        <TouchableOpacity>
          <Feather name="help-circle" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#333" />
          <Text style={styles.loadingText}>讀取相框成品中...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {spaces.map((space) => {
            const data = spaceDataCache[space.id] || { postCount: 0, images: [] };
            return (
              <AchievementCard 
                key={space.id}
                spaceName={space.name} 
                currentPosts={data.postCount}
                spaceImages={data.images} 
              />
            );
          })}

          {spaces.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 50 }}>
              目前還沒有空間喔，快去建立一個開始收集相框吧！
            </Text>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },

  cardContainer: { backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  cardSubtitle: { fontSize: 13, color: '#666', marginBottom: 4 },
  cardLevelTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  collapsedProgressText: { fontSize: 16, color: '#333', marginRight: 15, fontWeight: '500' },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },

  cardBody: { paddingHorizontal: 20, paddingBottom: 20 },
  
  levelControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  arrowBtn: { padding: 10 },
  viewingLevelText: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  puzzleContainer: { width: '100%', aspectRatio: 1, position: 'relative', marginVertical: 10 },
  puzzlePiece: { position: 'absolute', borderRadius: 6, overflow: 'hidden' }, 
  puzzleImage: { width: '100%', height: '100%' }, 

  progressRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', marginBottom: 15 },
  progressValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  progressDivider: { fontSize: 14, color: '#999', marginHorizontal: 2 },
  progressMax: { fontSize: 16, color: '#333' },

  hintBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  hintText: { fontSize: 13, color: '#666', marginLeft: 10 },

  shareBtn: { alignSelf: 'flex-end', marginTop: 20, marginRight: 5, padding: 5 }
});