import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  ScrollView, StatusBar, ActivityIndicator, Image, Alert
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

// 🌟 引入全域主題 Context
import { useAppTheme } from './ThemeContext';

const LEVEL_CONFIG = {
  1: {
    target: 3, 
    reward: "專專空間背景主題", 
    pieces: [
      { top: '5%', left: '5%', width: '42.5%', height: '90%' },  
      { top: '5%', left: '52.5%', width: '42.5%', height: '42.5%' }, 
      { top: '52.5%', left: '52.5%', width: '42.5%', height: '42.5%' }, 
    ]
  },
  2: {
    target: 7, 
    reward: "解鎖特殊心情貼紙",
    pieces: [
      { top: '5%', left: '5%', width: '42.5%', height: '42.5%' }, 
      { top: '5%', left: '52.5%', width: '42.5%', height: '42.5%' }, 
      { top: '52.5%', left: '5%', width: '90%', height: '42.5%' }, 
    ]
  },
  3: {
    target: 12, 
    reward: "自訂介面顏色",
    pieces: [
      { top: '5%', left: '5%', width: '35%', height: '55%' }, 
      { top: '5%', left: '45%', width: '50%', height: '25%' }, 
      { top: '35%', left: '45%', width: '50%', height: '25%' }, 
      { top: '65%', left: '5%', width: '55%', height: '30%' }, 
      { top: '65%', left: '65%', width: '30%', height: '30%' }, 
    ]
  },
  4: {
    target: 18, 
    reward: "專屬徽章",
    pieces: [
      { top: '5%', left: '5%', width: '28%', height: '42.5%' }, 
      { top: '5%', left: '36%', width: '59%', height: '20%' }, 
      { top: '28%', left: '36%', width: '59%', height: '20%' }, 
      { top: '52.5%', left: '5%', width: '42.5%', height: '42.5%' }, 
      { top: '52.5%', left: '50%', width: '45%', height: '20%' }, 
      { top: '75%', left: '50%', width: '45%', height: '20%' }, 
    ]
  },
  5: {
    target: 26, 
    reward: "隱藏版終極成就",
    pieces: [
      { top: '5%', left: '5%', width: '42.5%', height: '42.5%' },    
      { top: '5%', left: '50%', width: '20%', height: '20%' },
      { top: '5%', left: '72%', width: '23%', height: '20%' },
      { top: '27%', left: '50%', width: '45%', height: '20.5%' },
      { top: '50%', left: '5%', width: '20%', height: '45%' },
      { top: '50%', left: '27%', width: '20%', height: '21%' },
      { top: '74%', left: '27%', width: '41%', height: '21%' },
      { top: '50%', left: '50%', width: '45%', height: '21%' },
    ]
  }
};

const AchievementCard = ({ spaceName, currentPosts, spaceImages, spaceTexts }) => {
  // 🌟 子元件也同步取用全域主題方案
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;

  const [isExpanded, setIsExpanded] = useState(true);
  const puzzleRef = useRef(null);

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

  const progressPercent = (progressCount / requiredForThisLevel) * 100;

  const handleShareOrDownload = async () => {
    try {
      const uri = await puzzleRef.current.capture();
      Alert.alert("匯出相框", "要把這面專屬相框牆存下來或分享給朋友嗎？", [
        { 
          text: "分享圖片", 
          onPress: async () => {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) await Sharing.shareAsync(uri);
          }
        },
        { 
          text: "儲存到相簿", 
          onPress: async () => {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
              await MediaLibrary.saveToLibraryAsync(uri);
              Alert.alert("成功", "這片相框牆已經存到你的相簿囉！");
            }
          }
        },
        { text: "取消", style: "cancel" }
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    // 🌟 卡片外框底色根據深色模式自動切換 (darkMode ? '#1E1E1E' : '#FFFFFF')
    <View style={[styles.cardContainer, { backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF' }]}>
      <TouchableOpacity 
        style={styles.cardHeader} 
        activeOpacity={0.7} 
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardSubtitle, { color: theme.text }]}>{spaceName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={[styles.cardLevelTitle, { color: theme.subText }]}>相框別冊 第 {maxUnlockedLevel} 輯</Text>
            {isLevelCompleted && viewingLevel === maxConfiguredLevel && (
              <Text style={[styles.editorialTag, { color: theme.text }]}>✦ 完美收錄</Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          {!isExpanded && (
            <Text style={[styles.collapsedProgressText, { color: theme.subText }]}>{currentPosts} 篇生活紀錄</Text>
          )}
          <View style={[styles.iconCircle, { backgroundColor: darkMode ? '#2C2C2E' : '#F2F2F7' }]}>
            <Feather name={isExpanded ? "minus" : "plus"} size={16} color={theme.text} />
          </View>
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.cardBody}>
          <View style={[styles.levelControlRowContainer, { borderColor: darkMode ? '#2C2C2E' : '#E5E5EA' }]}>
            <TouchableOpacity onPress={() => viewingLevel > 1 && setViewingLevel(viewingLevel - 1)} disabled={viewingLevel === 1} style={styles.arrowBtn}>
              <Feather name="arrow-left" size={16} color={viewingLevel === 1 ? (darkMode ? '#48484A' : '#C7C7CC') : theme.text} />
            </TouchableOpacity>
            <Text style={[styles.viewingLevelText, { color: theme.text }]}>第 0{viewingLevel} 輯 <Text style={styles.slashText}>/</Text> 共 0{maxConfiguredLevel} 輯</Text>
            <TouchableOpacity onPress={() => viewingLevel < highestVisibleLevel && setViewingLevel(viewingLevel + 1)} disabled={viewingLevel === highestVisibleLevel} style={styles.arrowBtn}>
              <Feather name="arrow-right" size={16} color={viewingLevel === highestVisibleLevel ? (darkMode ? '#48484A' : '#C7C7CC') : theme.text} />
            </TouchableOpacity>
          </View>

          {/* 拍立得照片質感外框：保持純白導出才漂亮，但內部的格子做微調 */}
          <ViewShot ref={puzzleRef} options={{ format: "jpg", quality: 0.9 }}>
            <View style={styles.photoFrameContainer}>
              <View style={styles.exportHeader}>
                <Text style={styles.exportSpaceName}>{spaceName}</Text>
                <Text style={styles.exportVolumeText}>VOL.0{viewingLevel}</Text>
              </View>

              <View style={styles.puzzleContainer}>
                {config.pieces.map((piece, index) => {
                  const isUnlocked = index < progressCount;
                  const imageIndex = baseTarget + index;
                  const photoUrl = spaceImages[imageIndex];
                  const logText = spaceTexts && spaceTexts[imageIndex] ? spaceTexts[imageIndex] : "";

                  return (
                    <View 
                      key={index} 
                      style={[
                        styles.puzzlePiece,
                        { 
                          top: piece.top, left: piece.left, 
                          width: piece.width, height: piece.height,
                          backgroundColor: isUnlocked ? '#F2F2F7' : '#F9F9F9', 
                          borderStyle: isUnlocked ? 'solid' : 'dashed',
                          borderColor: isUnlocked ? '#FFFFFF' : '#E5E5EA'
                        }
                      ]} 
                    >
                      {isUnlocked ? (
                        photoUrl ? (
                          <Image source={{ uri: photoUrl }} style={styles.puzzleImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.puzzleImage, styles.centerContent, styles.textPieceFallback]}>
                            <Text style={styles.fallbackPieceText} numberOfLines={4} adjustsFontSizeToFit>
                              {logText && logText.trim() ? logText.trim() : "…"}
                            </Text>
                          </View>
                        )
                      ) : (
                        <View style={[styles.puzzleImage, styles.centerContent]}><View style={styles.minimalDot} /></View>
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={styles.exportFooter}>
                <Text style={styles.exportBrandText}>AnyLog · 專專相框排版別冊</Text>
              </View>
            </View>
          </ViewShot>

          {/* 進度與提示 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressInfoRow}>
              <Text style={[styles.progressLabelText, { color: theme.text }]}>本輯收集進度</Text>
              <Text style={[styles.progressValueText, { color: theme.text }]}>已收集 {progressCount} <Text style={styles.progressSlash}>/</Text> {requiredForThisLevel} 片碎片</Text>
            </View>
            {/* 動態讀取全域進度條顏色方案 */}
            <View style={[styles.progressBarTrack, { backgroundColor: theme.secondary }]}><View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: theme.primary }]} /></View>
          </View>

          {/* 狀態提示 */}
          <View style={[
            styles.hintBox, 
            { backgroundColor: darkMode ? '#2C2C2E' : '#F2F2F7', borderColor: theme.text },
            isLevelCompleted && styles.completedHintBox
          ]}>
            <Text style={[
              styles.hintText, 
              { color: theme.text },
              isLevelCompleted && styles.completedHintText
            ]}>
              {isLevelCompleted ? `本輯已完成！獲得：${config.reward}` : `再增添 ${remaining} 則空間紀錄，即可完全填滿第 0${viewingLevel} 輯的相框版型。`}
            </Text>
          </View>

          {/* 底部按鈕依深色模式動態變色 */}
          <TouchableOpacity 
            style={[
              styles.primaryShareBtn, 
              { 
                borderColor: theme.text, 
                backgroundColor: darkMode ? '#121212' : '#FFFFFF' 
              }
            ]} 
            onPress={handleShareOrDownload}
          >
            <Feather name="arrow-up-right" size={16} color={theme.text} style={{ marginRight: 6 }} />
            <Text style={[styles.primaryShareBtnText, { color: theme.text }]}>匯出這面相框牆</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default function AchievementsScreen() {
  const [spaces, setSpaces] = useState([]);
  const [spaceDataCache, setSpaceDataCache] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 核心：從全域中取用色彩變數
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;

  useEffect(() => {
    const init = async () => {
      const storedId = await AsyncStorage.getItem('@my_device_user_id');
      if (!storedId) return;
      const unsubscribe = subscribeToUserSpaces(storedId, async (fetchedSpaces) => {
        setSpaces(fetchedSpaces);
        const cache = {};
        for (const space of fetchedSpaces) {
          try {
            const q = query(collection(db, 'Records'), where('spaceId', '==', space.id));
            const snapshot = await getDocs(q);
            const records = snapshot.docs.map(doc => doc.data());
            records.sort((a, b) => a.createdAt - b.createdAt);
            const images = records.map(r => {
              if (r.imageUrls && r.imageUrls.length > 0) return r.imageUrls[0];
              if (r.imageUrl) return r.imageUrl;
              return null;
            });
            const texts = records.map(r => r.text || r.content || "");
            cache[space.id] = { postCount: snapshot.size, images: images, texts: texts };
          } catch (e) {
            cache[space.id] = { postCount: 0, images: [], texts: [] };
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
    // 🌟 全域底色無縫對齊
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>相框別冊</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="small" color={theme.text} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {spaces.map((space) => {
            const data = spaceDataCache[space.id] || { postCount: 0, images: [], texts: [] };
            return (
              <AchievementCard key={space.id} spaceName={space.name} currentPosts={data.postCount} spaceImages={data.images} spaceTexts={data.texts} />
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  
  cardContainer: { borderRadius: 20, marginBottom: 25, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16 },
  cardSubtitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  cardLevelTitle: { fontSize: 13, fontWeight: '500', marginTop: 3 },
  editorialTag: { fontSize: 12, fontWeight: '700', marginLeft: 10, letterSpacing: 0.5 },
  collapsedProgressText: { fontSize: 13, marginRight: 10, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16 },
  levelControlRowContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, marginBottom: 16 },
  arrowBtn: { padding: 4 },
  viewingLevelText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  slashText: { color: '#AEAEB2', fontWeight: '300' },
  
  // 匯出圖表核心外框：固定高質感拍立得純白底
  photoFrameContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2 },
  exportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, paddingHorizontal: 2, borderBottomWidth: 0.5, borderColor: '#E5E5EA', paddingBottom: 8 },
  exportSpaceName: { fontSize: 14, fontWeight: 'bold', color: '#1C1C1E', letterSpacing: 0.3 },
  exportVolumeText: { fontSize: 10, fontWeight: '800', color: '#8E8E93' },
  exportFooter: { alignItems: 'center', marginTop: 14, paddingBottom: 2 },
  exportBrandText: { fontSize: 10, color: '#AEAEB2', fontWeight: '600', letterSpacing: 1 },
  puzzleContainer: { width: '100%', aspectRatio: 1, position: 'relative', backgroundColor: '#FFFFFF' },
  puzzlePiece: { position: 'absolute', borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' }, 
  puzzleImage: { width: '100%', height: '100%' }, 
  minimalDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D1D6' },
  textPieceFallback: { backgroundColor: '#F2F2F7', padding: 10, justifyContent: 'center', alignItems: 'center' },
  fallbackPieceText: { color: '#1C1C1E', fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 17, letterSpacing: 0.2 },
  
  progressContainer: { marginTop: 24, marginBottom: 12 },
  progressInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  progressLabelText: { fontSize: 13, fontWeight: '500' },
  progressValueText: { fontSize: 13, fontWeight: '600' },
  progressSlash: { color: '#AEAEB2', fontWeight: '300', marginHorizontal: 1 },
  progressBarTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' }, 
  progressBarFill: { height: '100%', borderRadius: 2 }, 
  
  hintBox: { paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 3, marginTop: 6, borderRadius: 4 },
  completedHintBox: { backgroundColor: '#1C1C1E', borderColor: '#1C1C1E', borderLeftWidth: 0, borderRadius: 8 },
  hintText: { fontSize: 12, lineHeight: 18, letterSpacing: 0.2 },
  completedHintText: { color: '#FFFFFF', fontWeight: '600' },
  primaryShareBtn: { flexDirection: 'row', borderWidth: 1, height: 46, justifyContent: 'center', alignItems: 'center', marginTop: 18, borderRadius: 12 },
  primaryShareBtnText: { fontSize: 13, fontWeight: '700' }
});