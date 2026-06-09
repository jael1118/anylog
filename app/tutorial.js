// app/tutorial.js
import React, { useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
  StatusBar, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from './ThemeContext';

export default function TutorialScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const darkMode = theme.darkMode;
  const isCyber = theme.themeMode === 'cyber';
  
  const [expandedId, setExpandedId] = useState(null);

  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: 'welcome', text: '你好！我是你的 App 說明書小精靈。有任何關於空間管理、貼圖解鎖、主題更換或文字排版的問題，都可以隨時問我唷！', isBot: true }
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

  // 🌟 教育 AI 的智慧核心：您可以透過增加 keywords 來擴充 AI 的大腦！
  // 這裡已經把「建、開、做、創、弄、改、換、變、讀、看」等各種日常問法同義詞都教育進去了
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

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // 🌟 AI 教育演算法：從「字詞精確比對」升級為「語意多重命中計分制」
  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const userMessage = { id: Date.now().toString(), text: userText, isBot: false };
    setChatMessages(prev => [...prev, userMessage]);
    
    const currentQuery = userText.toLowerCase();
    setChatInput('');
    setIsAiThinking(true);

    setTimeout(() => {
      let bestMatch = null;
      let highestScore = 0;

      // 智慧計分：使用者提問的句子中，命中的同義關鍵字越多，分數越高
      appKnowledgeBase.forEach(item => {
        let score = 0;
        item.keywords.forEach(keyword => {
          if (currentQuery.includes(keyword)) {
            score += 1; // 命中一個關鍵字加 1 分
          }
        });

        if (score > highestScore) {
          highestScore = score;
          bestMatch = item.answer;
        }
      });

      // 🛑 限制：只有分數大於 0（代表與 App 相關）才回答；若分數為 0（問無關問題）一律拒絕
      const finalBotResponse = highestScore > 0 
        ? bestMatch 
        : "我是本 App 的專屬精靈助理，只能為您解答有關空間建立、提醒設定、主題更換、貼圖解鎖、粗斜體文字編輯或拼圖別冊等軟體操作問題。其他無關的話題我是無法回答的喔！";

      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: finalBotResponse, isBot: true }]);
      setIsAiThinking(false);
    }, 600);
  };

  const renderChatItem = ({ item }) => (
    <View style={[styles.chatBubbleRow, item.isBot ? { justifyContent: 'flex-start' } : { justifyContent: 'flex-end' }]}>
      {item.isBot && (
        <View style={[styles.botAvatarCircle, { backgroundColor: isCyber ? '#FF007F' : (darkMode ? '#2C2C2E' : '#666666') }]}>
          <Feather name="cpu" size={12} color="#FFFFFF" />
        </View>
      )}
      <View style={[
        styles.chatBubble, 
        item.isBot 
          ? { backgroundColor: darkMode ? '#1E1E1E' : '#F0F0F2', borderTopLeftRadius: 4 } 
          : { backgroundColor: isCyber ? '#FF007F' : (darkMode ? '#FFFFFF' : '#111111'), borderTopRightRadius: 4 }
      ]}>
        <Text style={[
          styles.chatBubbleText, 
          item.isBot 
            ? { color: theme.text } 
            : { color: isCyber ? '#FFFF00' : (darkMode ? '#000000' : '#FFFFFF') }
        ]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      
      <View style={[
        styles.header, 
        { 
          backgroundColor: theme.bg,
          borderBottomWidth: (darkMode || isCyber) ? 0.5 : 1, 
          borderBottomColor: theme.inputBorder 
        }
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>常見問題與使用教學</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <FlatList
          ref={chatFlatListRef}
          data={chatMessages}
          keyExtractor={item => item.id}
          renderItem={renderChatItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          onContentSizeChange={() => chatFlatListRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View style={{ paddingTop: 20 }}>
              <Text style={[styles.introText, { color: theme.subText }]}>
                我們整理了一些最常見的問題與使用技巧，幫助你更快上手這個 App！
              </Text>

              <View style={{ marginBottom: 25 }}>
                {faqData.map((item) => (
                  <View 
                    key={item.id} 
                    style={[
                      styles.faqCard, 
                      { 
                        backgroundColor: theme.cardBg, 
                        borderColor: theme.inputBorder,
                        shadowColor: '#000000',
                        shadowOpacity: darkMode ? 0 : 0.04
                      }
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.faqHeader} 
                      activeOpacity={0.7} 
                      onPress={() => toggleExpand(item.id)}
                    >
                      <Text style={[styles.faqTitle, { color: theme.text }]}>{item.title}</Text>
                      <Feather 
                        name={expandedId === item.id ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={theme.subText} 
                      />
                    </TouchableOpacity>
                    
                    {expandedId === item.id && (
                      <View style={[styles.faqContent, { borderTopWidth: 0.5, borderTopColor: theme.inputBorder }]}>
                        <Text style={[styles.faqText, { color: theme.text }]}>{item.content}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              <View style={[styles.aiSectionTitleRow, { borderTopColor: theme.inputBorder }]}>
                <Feather name="message-circle" size={16} color={theme.text} style={{ marginRight: 8 }} />
                <Text style={[styles.aiSectionTitleText, { color: theme.text }]}>APP說明書小精靈</Text>
              </View>
            </View>
          }
          ListFooterComponent={
            isAiThinking ? (
              <View style={styles.thinkingWrapper}>
                <ActivityIndicator size="small" color={theme.text} />
                <Text style={{ fontSize: 12, color: theme.subText, marginLeft: 8 }}>精靈正在翻閱說明手冊...</Text>
              </View>
            ) : null
          }
        />

        <View style={[styles.chatInputRow, { borderTopColor: darkMode ? '#2C2C2E' : '#E5E5EA', backgroundColor: theme.bg }]}>
          <TextInput
            style={[styles.chatTextInput, { color: theme.text, backgroundColor: darkMode ? '#1E1E1E' : '#F5F5F7', borderColor: theme.inputBorder }]}
            placeholder="請輸入你遇到的軟體使用疑惑..."
            placeholderTextColor={darkMode ? '#555555' : '#999999'}
            value={chatInput}
            onChangeText={setChatInput}
            onSubmitEditing={handleSendChatMessage}
          />
          <TouchableOpacity 
            style={[styles.chatSendBtn, { backgroundColor: chatInput.trim() ? (isCyber ? '#FF007F' : (darkMode ? '#FFFFFF' : '#111111')) : '#CCCCCC' }]}
            disabled={!chatInput.trim()}
            onPress={handleSendChatMessage}
          >
            <Feather name="send" size={16} color={isCyber ? '#FFFF00' : (darkMode ? '#000000' : '#FFFFFF')} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    height: 60,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scrollContent: { padding: 20 },
  introText: { fontSize: 14, marginBottom: 20, lineHeight: 22, fontWeight: '500' },
  
  faqCard: {
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqTitle: { fontSize: 15, fontWeight: '700' },
  faqContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
  },
  faqText: { fontSize: 14, lineHeight: 22 },

  aiSectionTitleRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, borderTopWidth: 0.5, marginBottom: 15 },
  aiSectionTitleText: { fontSize: 15, fontWeight: 'bold' },

  chatBubbleRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 6, width: '100%' },
  botAvatarCircle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 4 },
  chatBubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  chatBubbleText: { fontSize: 14, lineHeight: 20 },
  thinkingWrapper: { flexDirection: 'row', alignItems: 'center', paddingLeft: 36, paddingVertical: 5 },

  chatInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1 },
  chatTextInput: { flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 16, fontSize: 14, borderWidth: 1 },
  chatSendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});