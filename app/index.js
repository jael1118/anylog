import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, FlatList, 
  TouchableOpacity, Dimensions, StatusBar, Modal, TextInput, Image, Alert, ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
// ✅ 補上這個路由套件，用來跳轉頁面
import { useRouter } from 'expo-router'; 

import { 
  joinSpaceByCode, subscribeToSpaceRecords, createNewSpace, 
  subscribeToUserSpaces 
} from './firebaseServices'; 

const windowWidth = Dimensions.get('window').width;
const numColumns = 3;
const imageSize = (windowWidth - (numColumns - 1) * 2) / numColumns;

// --- 空間管理視窗 ---
const SpaceActionModal = ({ visible, onClose, onJoin, onCreate }) => {
  const [mode, setMode] = useState('options'); 
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (visible) { setMode('options'); setInputValue(''); }
  }, [visible]);

  const handleConfirm = () => {
    if (mode === 'join') onJoin(inputValue);
    if (mode === 'create') onCreate(inputValue);
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => mode === 'options' ? onClose() : setMode('options')}>
              <Feather name={mode === 'options' ? "x" : "arrow-left"} size={24} color="black" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {mode === 'options' ? '空間管理' : mode === 'join' ? '加入空間' : '創建新空間'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {mode === 'options' && (
            <View>
              <TouchableOpacity style={styles.optionBtn} onPress={() => setMode('create')}>
                <Feather name="plus-circle" size={20} color="black" />
                <Text style={styles.optionBtnText}>創建新空間</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionBtn} onPress={() => setMode('join')}>
                <Feather name="log-in" size={20} color="black" />
                <Text style={styles.optionBtnText}>輸入邀請碼加入</Text>
              </TouchableOpacity>
            </View>
          )}

          {(mode === 'join' || mode === 'create') && (
            <View>
              <Text style={styles.modalSubtitle}>
                {mode === 'join' ? '請輸入朋友分享給您的 6 碼邀請碼' : '請為您的新紀錄空間取個名字'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={mode === 'join' ? "例如: A7X9WQ" : ""}
                placeholderTextColor="#CCC"
                value={inputValue}
                onChangeText={setInputValue}
                autoCapitalize={mode === 'join' ? "characters" : "none"}
                maxLength={mode === 'join' ? 6 : 20}
              />
              <TouchableOpacity 
                style={[styles.joinBtn, inputValue.trim().length > 0 ? styles.joinBtnActive : null]} 
                disabled={inputValue.trim().length === 0 || (mode === 'join' && inputValue.length !== 6)}
                onPress={handleConfirm}
              >
                <Text style={styles.joinBtnText}>確認</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default function App() {
  // ✅ 宣告 router
  const router = useRouter();

  const [myUserId, setMyUserId] = useState(null); 
  const [records, setRecords] = useState([]);
  const [mySpaces, setMySpaces] = useState([]);
  const [currentSpaceId, setCurrentSpaceId] = useState(null); 
  const [currentSpaceName, setCurrentSpaceName] = useState("選擇空間");
  
  const [isSpaceActionVisible, setIsSpaceActionVisible] = useState(false);
  const [isSpaceSwitcherVisible, setIsSpaceSwitcherVisible] = useState(false);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        let storedId = await AsyncStorage.getItem('@my_device_user_id');
        if (!storedId) {
          const randomString = Math.random().toString(36).substring(2, 10);
          storedId = `user_${Date.now()}_${randomString}`;
          await AsyncStorage.setItem('@my_device_user_id', storedId);
        }
        setMyUserId(storedId);
      } catch (e) {
        console.error("讀取身分失敗:", e);
      }
    };
    initializeUser();
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    const unsubscribe = subscribeToUserSpaces(myUserId, (spaces) => {
      setMySpaces(spaces);
      if (!currentSpaceId && spaces.length > 0) {
        setCurrentSpaceId(spaces[0].id);
        setCurrentSpaceName(spaces[0].name);
      }
    });
    return () => unsubscribe();
  }, [myUserId, currentSpaceId]);

  useEffect(() => {
    if (!currentSpaceId) {
      setRecords([]);
      return;
    }
    const unsubscribe = subscribeToSpaceRecords(currentSpaceId, (data) => {
      const sortedData = data.sort((a, b) => b.createdAt - a.createdAt);
      setRecords(sortedData);
    });
    return () => unsubscribe();
  }, [currentSpaceId]);

  const handleJoinSpace = async (code) => {
    if (!myUserId) return;
    const result = await joinSpaceByCode(code, myUserId);
    if (result) {
      setCurrentSpaceId(result.spaceId);
      setCurrentSpaceName(result.name);
      Alert.alert("成功加入", `已成功加入 ${result.name}`);
    }
  };

  const handleCreateSpace = async (name) => {
    if (!myUserId) return;
    const result = await createNewSpace(name, myUserId);
    if (result) {
      setCurrentSpaceId(result.spaceId);
      setCurrentSpaceName(result.name);
      Alert.alert("創建成功！", `邀請碼為：${result.inviteCode}\n快把代碼分享給朋友吧！`);
    }
  };

  // ✅ 渲染網格：點擊時跳轉到 detail.js，並帶上該筆資料
  const renderItem = ({ item }) => {
    const firstImage = item.imageUrls ? item.imageUrls[0] : item.imageUrl;
    const isMultiple = item.imageUrls && item.imageUrls.length > 1;

    return (
      <TouchableOpacity 
        style={styles.imageGrid}
        activeOpacity={0.8}
        onPress={() => {
          // 這裡就是跳轉的關鍵！
          router.push({
            pathname: '/detail',
            params: { record: JSON.stringify(item) }
          });
        }}
      >
        {firstImage ? (
          <>
            <Image source={{ uri: firstImage }} style={styles.recordImage} resizeMode="cover" />
            {isMultiple && (
              <View style={styles.multipleIcon}>
                <Feather name="layers" size={14} color="white" />
              </View>
            )}
          </>
        ) : (
          <View style={styles.placeholderGrid} />
        )}
      </TouchableOpacity>
    );
  };

  if (!myUserId) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <SpaceActionModal 
        visible={isSpaceActionVisible} 
        onClose={() => setIsSpaceActionVisible(false)} 
        onJoin={handleJoinSpace} 
        onCreate={handleCreateSpace}
      />

      {/* 切換空間 Modal */}
      <Modal visible={isSpaceSwitcherVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>切換空間</Text>
              <TouchableOpacity onPress={() => setIsSpaceSwitcherVisible(false)}>
                <Feather name="x" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {mySpaces.map(space => (
                <TouchableOpacity 
                  key={space.id} 
                  style={[styles.spaceListItem, currentSpaceId === space.id && styles.spaceListActive]}
                  onPress={() => {
                    setCurrentSpaceId(space.id);
                    setCurrentSpaceName(space.name);
                    setIsSpaceSwitcherVisible(false);
                  }}
                >
                  <Text style={[styles.spaceListText, currentSpaceId === space.id && {color: 'white'}]}>
                    {space.name}
                  </Text>
                  {currentSpaceId === space.id && <Feather name="check" size={20} color="white" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 頂部 Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.categorySelector} onPress={() => setIsSpaceSwitcherVisible(true)}>
            <Text style={styles.categoryText} numberOfLines={1}>{currentSpaceName}</Text>
            <Feather name="chevron-down" size={18} color="#333" />
          </TouchableOpacity>

          <View style={styles.friendsContainer}>
            <View style={[styles.avatar, { zIndex: 3 }]} />
            <View style={[styles.avatar, { zIndex: 2, marginLeft: -12, backgroundColor: '#D9D9D9' }]} />
            <TouchableOpacity style={styles.addFriendBtn} onPress={() => setIsSpaceActionVisible(true)}>
              <Feather name="plus" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconCircleBtn}>
            <Feather name="edit-2" size={18} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircleBtn}>
            <Feather name="search" size={18} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 預留給背景圖的大片留白 */}
      <View style={styles.topBlankSpace} />

      {/* 內容區塊 (白色底) */}
      <View style={styles.contentWrapper}>
        <View style={styles.contentHeader}>
          <Text style={styles.dateText}>2026.03</Text>
          <Text style={styles.titleText}>{currentSpaceName}</Text>
        </View>

        <FlatList
          data={records}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Feather name="image" size={60} color="#E0E0E0" />
              <Text style={styles.emptyStateText}>還沒有紀錄</Text>
            </View>
          }
        />
      </View>

      {/* 懸浮發佈按鈕 (FAB) - ✅ 點擊跳轉到 upload 頁面 */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          if (mySpaces.length === 0) {
            Alert.alert("提示", "請先創建或加入一個空間再新增紀錄！");
            return;
          }
          router.push({
            pathname: '/upload', // ⚠️ 注意這裡：通常檔名不用加 .js
            params: { currentSpaceId }
          });
        }}
      >
        <Feather name="plus" size={30} color="white" />
      </TouchableOpacity>

    </SafeAreaView>
  );
}

// 樣式表 (拿掉了上傳區塊的舊樣式)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAEAEA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row' },
  categorySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxWidth: 130 },
  categoryText: { fontSize: 15, fontWeight: '500', marginRight: 6, color: '#333' },
  friendsContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCCCCC', borderWidth: 2, borderColor: '#EAEAEA' },
  addFriendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginLeft: -12, borderWidth: 2, borderColor: '#EAEAEA' },
  iconCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  topBlankSpace: { height: 180 },
  contentWrapper: { flex: 1, backgroundColor: '#FFFFFF' },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 15, paddingVertical: 12 },
  dateText: { fontSize: 14, color: '#333', fontWeight: '500' },
  titleText: { fontSize: 18, color: '#333', fontWeight: '600' },
  imageGrid: { width: imageSize, height: imageSize, marginBottom: 2, marginRight: 2, backgroundColor: '#EBEBEB' },
  recordImage: { width: '100%', height: '100%' },
  placeholderGrid: { width: '100%', height: '100%', backgroundColor: '#EBEBEB' },
  
  multipleIcon: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4 },

  fab: { position: 'absolute', bottom: 110, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#7A7A7A', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, zIndex: 10 },
  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyStateText: { fontSize: 16, fontWeight: '600', color: '#BBB', marginTop: 15 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 15, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, marginBottom: 10 },
  optionBtnText: { fontSize: 16, fontWeight: '600', marginLeft: 10, color: '#000' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 12, fontSize: 16, textAlign: 'center', letterSpacing: 1, marginBottom: 20 },
  joinBtn: { backgroundColor: '#CCCCCC', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  joinBtnActive: { backgroundColor: '#333333' },
  joinBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  spaceListItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderRadius: 8, marginBottom: 8, backgroundColor: '#F5F5F5' },
  spaceListActive: { backgroundColor: '#333' },
  spaceListText: { fontSize: 16, fontWeight: '600', color: '#333' },
});