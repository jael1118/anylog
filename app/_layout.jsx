import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';

// 防止系統預設的靜態閃屏自動消失
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const pathname = usePathname();
  const router = useRouter();

  // === 影片閃屏狀態管理 ===
  const [isVideoFinished, setIsVideoFinished] = useState(false);

  const handlePlaybackStatusUpdate = (status) => {
    // 影片準備好開始播的瞬間，把系統靜態圖片藏起來
    if (status.isLoaded && !status.isPlaying && status.positionMillis === 0) {
      SplashScreen.hideAsync();
    }
    // 影片播完時，觸發狀態改變，讓這層影片消失
    if (status.didJustFinish && !isVideoFinished) {
      setIsVideoFinished(true);
    }
  };

  // === 導覽列顯示邏輯 ===
  const showNavBarPages = ['/', '/space', '/achievements', '/profile'];
  const showNavBar = showNavBarPages.some(page => {
    if (page === '/') return pathname === '/'; 
    return pathname.startsWith(page);          
  });

  return (
    <View style={styles.container}>
      {/* 1. 最底層：你的 App 畫面內容 */}
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 250 }} />
      
      {/* 2. 中間層：全域懸浮導覽列 */}
      {showNavBar && (
        <View style={styles.floatingBottomNav}>
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/' && styles.navItemActive]} 
            onPress={() => router.replace('/')}
          >
            <Feather name="book" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/achievements' && styles.navItemActive]} 
            onPress={() => router.replace('/achievements')}
          >
            <Feather name="layout" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/profile' && styles.navItemActive]} 
            onPress={() => router.replace('/profile')}
          >
            <Feather name="user" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      )}

      {/* 3. 最頂層：影片動畫層 (只要影片還沒播完，就蓋在最上面擋住後面的所有東西) */}
      {!isVideoFinished && (
        <View style={styles.videoOverlay}>
          <Video
            style={{width: 200, height: 200}}
            source={require('../assets/icon.mp4')} // ⚠️ 務必確認你的影片路徑是否正確
            resizeMode={ResizeMode.COVER}
            shouldPlay={true}
            isLooping={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          />
        </View>
      )}
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#000', // 影片還沒出來前墊個黑底，防止閃白
  },
  floatingBottomNav: { 
    position: 'absolute', 
    bottom: 30, 
    alignSelf: 'center', 
    width: '90%', 
    height: 65, 
    backgroundColor: '#F5F5F5', 
    borderRadius: 35, 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 5 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    elevation: 8 
  },
  navItem: { padding: 12, borderRadius: 20 },
  navItemActive: { backgroundColor: '#D4D4D4' },
  
  // 影片層的樣式：絕對定位，蓋滿整個螢幕，z-index 設很高確保它在最前面
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff', // 防止影片比例不同時露出後面的導覽列
    zIndex: 9999, 
    elevation: 9999,
    justifyContent: 'center', 
    alignItems: 'center',
  }
});