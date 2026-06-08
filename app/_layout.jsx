import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';

// 🌟 引入全域主題設定
import { ThemeProvider, useAppTheme } from './ThemeContext';

// 防止系統預設的靜態閃屏自動消失
SplashScreen.preventAutoHideAsync();

// 🌟 新增一個內部元件，用來讀取與響應全域主題色，讓底下的導覽列也能同步變深色！
function MainAppContent({ pathname, router, isVideoFinished, handlePlaybackStatusUpdate, showNavBar }) {
  // 這裡就能安全使用 useAppTheme 了，因為此元件已經在 ThemeProvider 的裡面
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* 1. 最底層：你的 App 畫面內容 */}
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 250 }} />
      
      {/* 2. 中間層：全域懸浮導覽列 */}
      {showNavBar && (
        <View style={[
          styles.floatingBottomNav, 
          { 
            backgroundColor: darkMode ? '#1E1E1E' : '#F5F5F5',
            shadowColor: darkMode ? '#000000' : '#000000'
          }
        ]}>
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/' && (darkMode ? styles.navItemActiveDark : styles.navItemActive)]} 
            onPress={() => router.replace('/')}
          >
            <Feather name="book" size={24} color={theme.text} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/achievements' && (darkMode ? styles.navItemActiveDark : styles.navItemActive)]} 
            onPress={() => router.replace('/achievements')}
          >
            <Feather name="layout" size={24} color={theme.text} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/profile' && (darkMode ? styles.navItemActiveDark : styles.navItemActive)]} 
            onPress={() => router.replace('/profile')}
          >
            <Feather name="user" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* 3. 最頂層：影片動畫層 */}
      {!isVideoFinished && (
        <View style={[styles.videoOverlay, { backgroundColor: darkMode ? '#121212' : '#ffffff' }]}>
          <Video
            style={{ width: 200, height: 200 }}
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

export default function Layout() {
  const pathname = usePathname();
  const router = useRouter();

  // === 影片閃屏狀態管理 ===
  const [isVideoFinished, setIsVideoFinished] = useState(false);

  const handlePlaybackStatusUpdate = (status) => {
    if (status.isLoaded && !status.isPlaying && status.positionMillis === 0) {
      SplashScreen.hideAsync();
    }
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

  // 🌟 修正核心：用 <ThemeProvider> 把整個主要渲染的 App 元件包裹住並 return 
  return (
    <ThemeProvider>
      <MainAppContent 
        pathname={pathname}
        router={router}
        isVideoFinished={isVideoFinished}
        handlePlaybackStatusUpdate={handlePlaybackStatusUpdate}
        showNavBar={showNavBar}
      />
    </ThemeProvider>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  floatingBottomNav: { 
    position: 'absolute', 
    bottom: 30, 
    alignSelf: 'center', 
    width: '90%', 
    height: 65, 
    borderRadius: 35, 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center', 
    shadowOffset: { width: 0, height: 5 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    elevation: 8 
  },
  navItem: { padding: 12, borderRadius: 20 },
  navItemActive: { backgroundColor: '#D4D4D4' },
  navItemActiveDark: { backgroundColor: '#333333' }, // 🌟 新增深色模式下導覽列點選時的灰色背景
  
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, 
    elevation: 9999,
    justifyContent: 'center', 
    alignItems: 'center',
  }
});