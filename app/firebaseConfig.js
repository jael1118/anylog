// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 貼上你在 Firebase 控制台拿到的金鑰
const firebaseConfig = {
  apiKey: "AIzaSyC88Ua1IKMRfLUOi-K2bZ9bP1HBY77N9ug",
  authDomain: "appfinal-984ba.firebaseapp.com",
  databaseURL: "https://appfinal-984ba-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "appfinal-984ba",
  storageBucket: "appfinal-984ba.firebasestorage.app",
  messagingSenderId: "973331140879",
  appId: "1:973331140879:web:17b511cfaaf3aa33316e7a"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化並導出 Firestore 資料庫，讓你可以在其他檔案中使用
export const db = getFirestore(app);