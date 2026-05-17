import { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
// 🌟 1. 多引入 Animated 跟 StyleSheet
import { View, Image, StyleSheet, StatusBar, Text, Animated } from 'react-native';

export default function RootLayout() {
  const [isSplashUnmounted, setIsSplashUnmounted] = useState(false);
  
  // 🌟 2. 準備一個用來控制「透明度」的動畫變數，初始值為 1 (完全不透明)
  const fadeAnim = useRef(new Animated.Value(1)).current; 

  useEffect(() => {
    // 讓啟動畫面停留 1.5 秒後，開始執行「淡出動畫」
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,         // 目標透明度變成 0 (完全透明)
        duration: 500,      // 動畫持續時間 500 毫秒 (0.5秒的漸層)
        useNativeDriver: true, // 使用手機底層效能跑動畫，會更順
      }).start(() => {
        // 🌟 動畫跑完之後，才把這塊畫布真正從系統中卸載
        setIsSplashUnmounted(true);
      });
    }, 1500); // 這裡可以微調，1500 + 500 = 剛好 2 秒

    return () => clearTimeout(timer);
  }, [fadeAnim]);

  return (
    // 最外層包一個 View
    <View style={{ flex: 1 }}>
      
      {/* 🌟 3. 底層：你的正式 App 畫面 (讓它在後面先準備好) */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8F8FC' },
          animation: 'slide_from_right', 
        }}
      >
        {/* 🌟 加上極短的淡入淡出動畫，取代原本的生硬切換 */}
      <Stack.Screen 
        name="index" 
        options={{ animation: 'fade', animationDuration: 150 }} 
      />
      <Stack.Screen 
        name="map" 
        options={{ animation: 'fade', animationDuration: 150 }} 
      />
      <Stack.Screen 
        name="setting" 
        options={{ animation: 'fade', animationDuration: 150 }} 
      />
      {/* 🌟 在大總管這邊，利用 route 參數「提早」決定要哪種視窗！ */}
      <Stack.Screen 
        name="addlog" 
        options={({ route }) => ({ 
          // 如果傳進來的參數有 id，代表是「編輯」 -> 給他卡片 (modal)
          // 如果沒有 id，代表是「新增」 -> 給他全螢幕 (fullScreenModal)
          presentation: route.params?.id ? 'modal' : 'fullScreenModal',
          
          // 動畫也一起在這裡判斷
          animation: route.params?.id ? 'fade' : 'slide_from_bottom',
          animationDuration: 150 
        })} 
      />
        <Stack.Screen 
          name="log" 
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }} 
        />
      </Stack>

      {/* 🌟 4. 上層：改成 Animated.View，並且套用 opacity 動畫 */}
      {!isSplashUnmounted && (
        <Animated.View 
          style={[
            styles.splashContainer, 
            { opacity: fadeAnim } // 綁定剛剛設定的透明度變數
          ]}
        >
          <StatusBar hidden={true} />
          <Image 
            source={require('../assets/icon.png')} 
            style={styles.splashImage} 
            resizeMode="contain" 
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 🌟 5. 加入 absoluteFillObject，讓啟動畫面變成「絕對定位」蓋滿全螢幕
  splashContainer: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: '#F8F8FC', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 999, // 確保它永遠疊在最上面
  },
  splashImage: { width: 160, height: 160, marginBottom: 20 },
});