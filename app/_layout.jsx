import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function Layout() {
  const pathname = usePathname();
  const router = useRouter();

  // 設定「哪些頁面」需要顯示底部的懸浮導覽列
  const showNavBarPages = ['/', '/space', '/map', '/profile'];
const showNavBar = showNavBarPages.some(page => {
  if (page === '/') return pathname === '/'; 
  return pathname.startsWith(page);          
});

  return (
    <View style={{ flex: 1 }}>
      {/* 讓裡面的頁面維持原本的切換與動畫 */}
      <Stack screenOptions={{ headerShown: false, animation: 'fade',animationDuration: 250 }} />
      
      {/* 全域懸浮導覽列：只在我們設定的頁面中顯示 */}
      {showNavBar && (
        <View style={styles.floatingBottomNav}>
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/' && styles.navItemActive]} 
            onPress={() => router.replace('/')}
          >
            <Feather name="book" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/map' && styles.navItemActive]} 
            onPress={() => router.replace('/map')}
          >
            <Feather name="map" size={24} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, pathname === '/profile' && styles.navItemActive]} 
            onPress={() => router.replace('/profile')}
          >
            <Feather name="user" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});