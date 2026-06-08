// ThemeContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@user_dark_mode');
        if (savedTheme !== null) setDarkMode(JSON.parse(savedTheme));
      } catch (e) { console.error(e); }
    };
    loadTheme();
  }, []);

  const toggleDarkMode = async (value) => {
    try {
      setDarkMode(value);
      await AsyncStorage.setItem('@user_dark_mode', JSON.stringify(value));
    } catch (e) { console.error(e); }
  };

  const theme = {
    darkMode,
    bg: darkMode ? '#121212' : '#FFFFFF',
    text: darkMode ? '#FFFFFF' : '#333333',
    subText: darkMode ? '#AAAAAA' : '#666666',
    valueText: darkMode ? '#888888' : '#999999',
    cardBg: darkMode ? '#1E1E1E' : '#E0E0E0',
    cardImgBg: darkMode ? '#2D2D2D' : '#D4D4D4',
    cardLabelBg: darkMode ? '#2A2A2A' : '#999999',
    statusBar: darkMode ? 'light-content' : 'dark-content',
    modalBg: darkMode ? '#1E1E1E' : '#FFFFFF',
    inputBorder: darkMode ? '#333333' : '#E0E0E0',
    cancelBtnBg: darkMode ? '#2A2A2A' : '#F5F5F5',
    cancelBtnText: darkMode ? '#AAAAAA' : '#666666',
    saveBtnBg: darkMode ? '#FFFFFF' : '#000000',
    saveBtnText: darkMode ? '#000000' : '#FFFFFF',
    // 專為拼圖別冊、紀錄詳情頁優化的色彩字典
    placeholderBg: darkMode ? '#1E1E1E' : '#F9F9F9',
    primary: darkMode ? '#FFFFFF' : '#111111',
    secondary: darkMode ? '#333333' : '#E5E5EA',
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);