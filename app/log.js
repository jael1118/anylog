import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, ImageBackground, View, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const colors = {
  primary: '#FBAFFE',         
  secondary: '#E2E0F9',       
  background: '#FFFFFF',      
  text: '#4A4A4A',            
  grayText: '#888888',        
  white: '#FFFFFF',
  heartActive: '#FCA5F1',     
  heart: '#E0E0E0',           
  primaryText: '#A078D2',     
};

export default function SingleLogScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  
  const [logData, setLogData] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchSingleLog = async () => {
        try {
          const storedLogs = await AsyncStorage.getItem('cafe_logs');
          if (storedLogs) {
            const parsed = JSON.parse(storedLogs);
            const foundLog = parsed.find(l => l.id === id);
            setLogData(foundLog || null);
          }
        } catch (error) {
          console.error("讀取單篇紀錄失敗", error);
        } finally {
          setLoading(false);
        }
      };
      if(id) fetchSingleLog();
    }, [id])
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!logData) {
    return (
        <View style={styles.center}>
            <Text style={{color: colors.grayText}}>找不到這篇紀錄喔🥲</Text>
            <TouchableOpacity style={styles.backBtnFallback} onPress={() => router.back()}>
                <Text style={{color: colors.white, fontWeight: 'bold'}}>返回</Text>
            </TouchableOpacity>
        </View>
    );
  }

  const imagesToShow = logData.largeImageUris && logData.largeImageUris.length > 0 
    ? logData.largeImageUris 
    : (logData.largeImageUrl ? [logData.largeImageUrl] : []);

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 🌟 引入圖片並當作背景 */}
      {/* 🌟 終極殺手鐧：放棄 ImageBackground，改用普通 View 包裝 */}
      <View style={styles.topNavRow}>
        
        {/* 🌟 2. 你的按鈕跟文字 (排在圖片後面，就會自動疊在圖片上方) */}
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        
        <Text style={styles.timeText}>{logData.displayTime || logData.date}</Text>

        <TouchableOpacity 
          style={styles.editBtn} 
          onPress={() => router.push({ pathname: '/addlog', params: { editLogData: JSON.stringify(logData) } })}
        >
          <Ionicons name="pencil" size={16} color={colors.white} />
        </TouchableOpacity>
        
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        
        <View style={styles.mainInfoContainer}>
          <Image 
            source={{ uri: logData.imageUrl || 'https://via.placeholder.com/150' }} 
            style={styles.largeThumbnailImage} 
          />

          <View style={styles.rightInfoColumn}>
            <Text style={styles.titleText} numberOfLines={2}>
              {logData.title || '無標題'}
            </Text>
            
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.grayText} />
              <Text style={styles.locationText} numberOfLines={1}>{logData.location || '沒有地點資訊'}</Text>
            </View>

            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((heart) => (
                <Ionicons 
                  key={heart} 
                  name="heart" 
                  size={14} 
                  color={heart <= logData.rating ? colors.heartActive : colors.heart} 
                  style={{ marginRight: 4 }}
                />
              ))}
              <Text style={styles.ratingNumber}>{Number(logData.rating || 0).toFixed(1)}</Text>
            </View>

            {logData.tags ? (
              <View style={styles.tagRow}>
                {logData.tags.split(' ').map((tag, idx) => tag.trim() !== '' && (
                  <View key={idx} style={styles.tagBadge}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{logData.note || '沒有留下筆記...'}</Text>
        </View>

        {imagesToShow.length > 0 && (
           <View style={styles.imagesContainer}>
              {imagesToShow.map((imgUri, index) => (
                 <Image key={index} source={{ uri: imgUri }} style={styles.largeImage} />
              ))}
           </View>
        )}

        <View style={{height: 60}} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, paddingHorizontal: 25, paddingTop: 10 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  backBtnFallback: { marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },

  topNavRow: { overflow: 'hidden', width: '100%',height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 15, marginBottom: 25 },
  timeText: { fontSize: 12, color: colors.primaryText, fontWeight: '600' ,justifyContent: 'center'},
  editBtn: { backgroundColor: colors.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },

  mainInfoContainer: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 25 },
  largeThumbnailImage: { width: 140, height: 140, backgroundColor: '#E0E0E0', borderRadius: 15, marginRight: 15, resizeMode: 'cover' },
  
  rightInfoColumn: { flex: 1, justifyContent: 'center', paddingVertical: 2 },
  titleText: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 10, lineHeight: 24 },
  
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  locationText: { fontSize: 12, color: colors.grayText, marginLeft: 4, flex: 1 },
  
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  ratingNumber: { fontSize: 12, color: colors.grayText, marginLeft: 6, fontWeight: 'bold' },
  
  tagRow: { flexDirection: 'row', marginTop: 4 },
  tagBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginRight: 8 },
  tagText: { fontSize: 10, color: colors.primaryText, fontWeight: 'bold' },

  noteBox: { marginBottom: 20 },
  noteText: { fontSize: 15, color: colors.text, lineHeight: 26 },

  imagesContainer: { marginTop: 10 },
  largeImage: { width: '100%', height: 250, borderRadius: 15, marginBottom: 15, resizeMode: 'cover', backgroundColor: '#F0F0F0' },
});