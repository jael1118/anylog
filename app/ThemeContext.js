// ThemeContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  // 控制三種模式: 'light' (亮色黑白灰) | 'dark' (深色全黑) | 'cyber' (現代螢光)
  const [themeMode, setThemeMode] = useState('light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('@user_theme_mode');
        if (savedMode !== null) setThemeMode(savedMode);
      } catch (e) { console.error("讀取主題失敗", e); }
    };
    loadTheme();
  }, []);

  const changeThemeMode = async (mode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem('@user_theme_mode', mode);
    } catch (e) { console.error("儲存主題失敗", e); }
  };

  const darkMode = themeMode === 'dark';
  const cyberMode = themeMode === 'cyber';

  // 🌟 色彩字典：瘋狂大集結！【粉紅、黃、綠、藍、橘、紫】全數到齊，極致刺眼
  const theme = {
    themeMode,
    darkMode: darkMode, 
    isCyber: cyberMode,
    
    // 🎨 1. 背景與主要文字【螢光黃 ＋ 螢光粉紅】
    bg: cyberMode ? '#FFFF00' : (darkMode ? '#121212' : '#FFFFFF'), // 現代模式：高飽和螢光黃底
    text: cyberMode ? '#FF007F' : (darkMode ? '#FFFFFF' : '#333333'), // 現代模式：激亮螢光粉紅字
    subText: cyberMode ? '#000000' : (darkMode ? '#AAAAAA' : '#666666'), // 純黑
    
    // 🎨 2. 卡片與網格元件【螢光藍 ＋ 螢光紫 ＋ 螢光綠】
    cardBg: cyberMode ? '#00FFFF' : (darkMode ? '#1E1E1E' : '#FFFFFF'), // 現代模式：極光螢光藍卡片
    cardImgBg: cyberMode ? '#FF00FF' : (darkMode ? '#2D2D2D' : '#D4D4D4'), // 現代模式：電幻螢光紫
    cardLabelBg: cyberMode ? '#00FF66' : (darkMode ? '#2A2A2A' : '#999999'), // 現代模式：劇毒螢光綠標籤
    
    // 🎨 3. 狀態列與輔助數值【螢光橘 ＋ 螢光綠】
    valueText: cyberMode ? '#FF5500' : (darkMode ? '#888888' : '#999999'), // 現代模式：強烈螢光橘色數值
    statusBar: cyberMode ? 'dark-content' : (darkMode ? 'light-content' : 'dark-content'),
    
    // 🎨 4. 彈出視窗 Modal【螢光粉紅 ＋ 螢光黃 ＋ 螢光藍】
    modalBg: cyberMode ? '#FF007F' : (darkMode ? '#1E1E1E' : '#FFFFFF'), // 現代模式：激亮螢光粉紅背景
    inputBorder: cyberMode ? '#FFFF00' : (darkMode ? '#333333' : '#E0E0E0'), // 現代模式：螢光黃線邊框
    cancelBtnBg: cyberMode ? '#00FFFF' : (darkMode ? '#2A2A2A' : '#F5F5F5'), // 現代模式：螢光藍按鈕
    cancelBtnText: cyberMode ? '#000000' : (darkMode ? '#AAAAAA' : '#666666'),
    saveBtnBg: cyberMode ? '#FFFF00' : (darkMode ? '#FFFFFF' : '#000000'), // 現代模式：螢光黃儲存鈕
    saveBtnText: cyberMode ? '#FF007F' : (darkMode ? '#000000' : '#FFFFFF'),
    
    // 🎨 5. 進度條與拼圖別冊留白【螢光藍 ＋ 螢光粉紅 ＋ 螢光綠】
    placeholderBg: cyberMode ? '#00FFFF' : (darkMode ? '#1E1E1E' : '#F9F9F9'),
    primary: cyberMode ? '#FF007F' : (darkMode ? '#FFFFFF' : '#111111'),
    secondary: cyberMode ? '#00FF66' : (darkMode ? '#333333' : '#E5E5EA'),
  };

  return (
    <ThemeContext.Provider value={{ theme, changeThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: { themeMode: 'light', darkMode: false, bg: '#FFFFFF', text: '#333333', subText: '#666666', valueText: '#999999', cardBg: '#FFFFFF', statusBar: 'dark-content', modalBg: '#FFFFFF', inputBorder: '#E0E0E0', cancelBtnBg: '#F5F5F5', cancelBtnText: '#666666', saveBtnBg: '#000000', saveBtnText: '#FFFFFF', placeholderBg: '#F9F9F9', primary: '#111111', secondary: '#E5E5EA' },
      changeThemeMode: () => {}
    };
  }
  return context;
};