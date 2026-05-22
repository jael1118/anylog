// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 貼上你在 Firebase 控制台拿到的金鑰
const firebaseConfig = {

};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化並導出 Firestore 資料庫，讓你可以在其他檔案中使用
export const db = getFirestore(app);