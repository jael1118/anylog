import React, { useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  StatusBar, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from './ThemeContext';
import axios from 'axios';
import knowledgeBase from '../aiKnowledgeBase.json';

export default function TutorialScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;
  const isCyber = theme.themeMode === 'cyber';
  
  const [expandedId, setExpandedId] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: 'welcome', text: '你好！我是你的 App 說明小精靈，有問題都可以問我！', isBot: true }
  ]);
  const chatFlatListRef = useRef(null);

   const faqData = [
    {
      id: 1,
      title: "如何建立新空間？",
      content: "點擊首頁上排空間列表旁的『新增空間』或『+』，輸入空間名稱即可建立專屬空間。你還可以將空間邀請代碼分享給朋友，邀請他們加入！"
    },
    {
      id: 2,
      title: "如何解鎖隱藏表情？",
      content: "表情需要達成特定成就。目前 app 內基礎表情皆已為您開啟！未來若有新增的擴充表情，可以點擊個人頁面的表情管理格子查看特定的解鎖條件喔！"
    },
    {
      id: 3,
      title: "相框別冊是什麼？",
      content: "每當你在空間內上傳紀錄或文字心情，相框別冊的拼圖就會逐漸解鎖。當碎片填滿之後，即可下載、儲存或分享專屬的排版相框牆！"
    },
    {
      id: 4,
      title: "如何更改主題外觀？",
      content: "請到『個人檔案』頁面，找到『主題外觀』區塊，我們提供亮白、深黑以及極具視覺衝擊的現代 (Cyber) 三種不同的風格供您自由切換。"
    }
  ];

  const appKnowledgeBase = [
    { 
      keywords: ['空間', '建立', '新增', '加入', '代碼', '邀請', '邀請碼', '開空間', '建空間', '做空間', '創空間', '弄空間', '群組', '朋友', '分享'], 
      answer: "建立空間很簡單！請到首頁點擊空間列表旁邊的『新增空間』或『+』號，輸入名稱即可。若要邀請朋友，可在空間首頁頂部點擊成員頭像旁的『+』號複製邀請碼分享給朋友！" 
    },
    { 
      keywords: ['表情', '解鎖', '鎖住', '擴充', '貼圖', '心情', '鎖', '打不開', '換表情', '頭像', '任務', '成就', '拿到', '獲得'], 
      answer: "表情管理中前 5 個基礎心情是完全免費啟用的！後續的擴充灰色格子需要滿足特定解鎖任務（如空間紀錄累積滿 10 篇或集滿拼圖別冊）。點擊個人頁對應格子即可檢視解鎖條件！" 
    },
    { 
      keywords: ['主題', '外觀', '現代', '深黑', '亮白', '換膚', '變色', '改膚', '換主題', '顏色', '背景', '改色', '亮色', '暗色', '刺眼', '紫色'], 
      answer: "在個人檔案的『主題外觀』區塊，提供『亮白』、『深黑』與激亮螢光色調的『現代』三種風格，點選後全 App 的介面都會同步自動變換配色喔！" 
    },
    { 
      keywords: ['拼圖', '別冊', '相框', '成就', '下載', '分享', '進度條', '進度', '照片牆', '完成', '碎片', '解鎖拼圖'], 
      answer: "每當你在空間發表新紀錄或心情小卡，首頁的相框拼圖就會自動填入隨機碎片。當拼圖進度 100% 滿格後，即可前往成就別冊頁面下載並儲存專屬排版相框牆！" 
    },
    { 
      keywords: ['留言', '討論', '回覆', '發表'], 
      answer: "只要點擊貼文，就能看到留言區，可以自由討論！" 
    },
    { 
      keywords: ['貼文', '發文', '新貼文'], 
      answer: "只要點擊首頁/空間頁右下角加號+，就能新建貼文！" 
    },
    { 
      keywords: ['TXT', '兔巴兔', '歐巴', '嘻嘻', '鋼球鋼', '鋼球剛'], 
      answer: "你可真有品味，鋼球剛阿爺爺" 
    },
  ];

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { id: Date.now().toString(), text: userText, isBot: false }]);
    setChatInput('');
    setIsAiThinking(true);

    // 1. 準備知識庫內容
    const knowledgeString = JSON.stringify(appKnowledgeBase);

    try {
      // 2. 呼叫 API，將知識庫注入 system prompt
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.1-8b-instant',
          messages: [
            { 
              role: 'system', 
              content: `你是一個共享空間紀錄 App 的專業客服小精靈。
              請依據以下知識庫回答使用者問題：
              ${knowledgeString}
              
              規則：
              - 只能回答與 App 功能有關的問題。
              - 若問題與 App 無關，或知識庫中沒有答案，請禮貌回覆：「抱歉，我目前只負責回答關於空間、表情、拼圖或主題設定的問題喔！」
              - 回答請簡潔，使用繁體中文。` 
            },
            { role: 'user', content: userText }
          ]
        },
        { 
          headers: { 
            'Authorization': 'Bearer ', 
            'Content-Type': 'application/json' 
          } 
        }
      );
      
      const aiResponse = response.data.choices[0].message.content;
      setChatMessages(prev => [...prev, { id: Date.now().toString(), text: aiResponse, isBot: true }]);
      
    } catch (error) {
      console.error("API Error:", error.response?.data || error.message);
      setChatMessages(prev => [...prev, { id: Date.now().toString(), text: "精靈現在連線有點累，請稍後再試！", isBot: true }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      
      <View style={[styles.header, { borderBottomColor: theme.inputBorder }]}>
        <TouchableOpacity onPress={() => router.back()}><Feather name="chevron-left" size={26} color={theme.text} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>常見問題與教學</Text>
        <View style={{ width: 24 }} />
      </View>

     {/* 🌟 鍵盤避讓區塊：behavior 改為 padding，且只包住 FlatList 和輸入框 */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={chatFlatListRef}
          data={chatMessages}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 15 }}
          onContentSizeChange={() => chatFlatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.chatBubbleRow, item.isBot ? { justifyContent: 'flex-start' } : { justifyContent: 'flex-end' }]}>
              {item.isBot && <View style={styles.botAvatar}><Feather name="cpu" size={12} color="#FFF" /></View>}
              <View style={[styles.chatBubble, item.isBot ? { backgroundColor: darkMode ? '#333' : '#eee' } : { backgroundColor: isCyber ? '#FF007F' : '#111' }]}>
                <Text style={{ color: item.isBot ? theme.text : '#FFF' }}>{item.text}</Text>
              </View>
            </View>
          )}
          ListHeaderComponent={
            <View style={{ paddingBottom: 20 }}>
              <Text style={{ color: theme.subText, marginBottom: 20 }}>我們整理了一些最常見的問題與使用技巧！</Text>
              {faqData.map(item => (
                <View key={item.id} style={[styles.faqCard, { backgroundColor: theme.cardBg, borderColor: theme.inputBorder }]}>
                  <TouchableOpacity style={styles.faqHeader} onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>{item.title}</Text>
                    <Feather name={expandedId === item.id ? "chevron-up" : "chevron-down"} size={20} color={theme.subText} />
                  </TouchableOpacity>
                  {expandedId === item.id && <Text style={{ padding: 15, paddingTop: 0, color: theme.text }}>{item.content}</Text>}
                </View>
              ))}
              <View style={styles.aiSectionTitleRow}>
                <Feather name="message-circle" size={16} color={theme.text} style={{ marginRight: 8 }} />
                <Text style={{ color: theme.text, fontWeight: 'bold' }}>AI 說明小精靈</Text>
              </View>
            </View>
          }
          ListFooterComponent={isAiThinking ? <ActivityIndicator style={{ margin: 10 }} color={theme.text} /> : null}
        />

        <View style={[styles.inputContainer, { backgroundColor: theme.bg, borderTopColor: theme.inputBorder }]}>
          <TextInput
            style={[styles.chatTextInput, { color: theme.text, borderColor: theme.inputBorder, backgroundColor: darkMode ? '#1E1E1E' : '#F5F5F7' }]}
            placeholder="詢問小精靈..."
            placeholderTextColor={darkMode ? '#555' : '#999'}
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={handleSendChatMessage}
          />
          <TouchableOpacity onPress={handleSendChatMessage} style={styles.sendBtn}>
            <Feather name="send" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  faqCard: { marginBottom: 10, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  aiSectionTitleRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 20 },
  chatBubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 6 },
  botAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#666', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  chatBubble: { maxWidth: '70%', padding: 12, borderRadius: 15 },
  inputContainer: { flexDirection: 'row', padding: 15, borderTopWidth: 1, alignItems: 'center' },
  chatTextInput: { flex: 1, height: 45, borderRadius: 22, paddingHorizontal: 15, borderWidth: 1 },
  sendBtn: { width: 45, height: 45, borderRadius: 22, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});