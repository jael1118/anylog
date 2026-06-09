// firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 貼上你在 Firebase 控制台拿到的金鑰
const firebaseConfig = {
  
};

let app;
if (getApps().length === 0) {
  // 如果目前陣列裡沒有任何 Firebase App，才初始化一個新的
  app = initializeApp(firebaseConfig);
} else {
  // 如果已經有了，就直接抓現成的來用，不要重複建立
  app = getApp();
}

// 初始化並導出 Firestore 資料庫，讓你可以在其他檔案中使用
export const db = getFirestore(app);