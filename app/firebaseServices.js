import { 
  collection, query, where, onSnapshot, doc, orderBy,
  updateDoc, arrayUnion, addDoc, setDoc, getDocs, getDoc, deleteDoc 
} from 'firebase/firestore';
import { db } from './firebaseConfig';

// 1. 產生 6 碼隨機代碼
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 2. 創建新空間
export const createNewSpace = async (spaceName, userId) => {
  try {
    const newCode = generateInviteCode();
    const docRef = await addDoc(collection(db, "Spaces"), {
      name: spaceName || "未命名空間",
      inviteCode: newCode,
      members: [userId],
      createdAt: Date.now()
    });
    return { spaceId: docRef.id, inviteCode: newCode, name: spaceName };
  } catch (error) {
    console.error("創建空間失敗:", error);
    throw error;
  }
};

// 3. 加入空間
export const joinSpaceByCode = async (code, userId) => {
  try {
    const q = query(collection(db, "Spaces"), where("inviteCode", "==", code.toUpperCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("找不到這個邀請碼，請檢查是否輸入正確！");
      return null;
    }

    const spaceDoc = querySnapshot.docs[0];
    const spaceRef = doc(db, "Spaces", spaceDoc.id);

    await updateDoc(spaceRef, {
      members: arrayUnion(userId)
    });

    return { spaceId: spaceDoc.id, name: spaceDoc.data().name };
  } catch (error) {
    console.error("加入空間失敗:", error);
    alert("加入空間時發生錯誤");
    return null;
  }
};

// ✅ 新增：更新空間名稱
export const updateSpaceName = async (spaceId, newName) => {
  try {
    const spaceRef = doc(db, 'Spaces', spaceId);
    await updateDoc(spaceRef, { name: newName });
    console.log("空間名稱更新成功！");
    return true;
  } catch (error) {
    console.error("更新空間名稱失敗: ", error);
    throw error;
  }
};

// 4. 監聽空間紀錄
export const subscribeToSpaceRecords = (spaceId, callback) => {
  const q = query(collection(db, "Records"), where("spaceId", "==", spaceId));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const recordsData = [];
    querySnapshot.forEach((doc) => {
      recordsData.push({ id: doc.id, ...doc.data() });
    });
    callback(recordsData);
  });
  return unsubscribe;
};

// 5. 監聽使用者所屬的所有空間
export const subscribeToUserSpaces = (userId, callback) => {
  const q = query(collection(db, "Spaces"), where("members", "array-contains", userId));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const spaces = [];
    querySnapshot.forEach((doc) => {
      spaces.push({ id: doc.id, ...doc.data() });
    });
    callback(spaces);
  });
  return unsubscribe;
};

// ✅ 6. 支援多圖網址陣列與文字存入空間
export const addRecordToSpace = async (spaceId, imageUrls, note, location, latitude, longitude) => {
  try {
    await addDoc(collection(db, "Records"), {
      spaceId: spaceId,
      imageUrls: imageUrls, 
      note: note || "",
      location: location || "",
      latitude: latitude !== undefined ? latitude : null,   // 儲存緯度
      longitude: longitude !== undefined ? longitude : null, // 儲存經度
      createdAt: Date.now()
    });
  } catch (error) {
    console.error("新增紀錄失敗:", error);
    throw error;
  }
};

// ✅ 7. 升級版 GitHub 圖床上傳函數 (內建自動排隊防撞、防延遲重試機制)
export const uploadImageToGitHub = async (base64String, maxRetries = 3) => {
  const GITHUB_USERNAME = 'jael1118'; 
  const GITHUB_REPO = 'appimg';      
  const GITHUB_TOKEN = ''; 

  // 把隨機亂碼確實組合進檔名
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filename = `img_${Date.now()}_${randomStr}.jpg`;
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filename}`;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Upload image ${filename}`,
          content: base64String, 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return data.content.download_url; // 成功就直接回傳網址
      }

      // 🚨 如果遇到 GitHub 經典的佇列同步延遲錯誤，進行等待並重試
      if (data.message && data.message.includes('is at') && data.message.includes('expected')) {
        console.log(`偵測到 GitHub 佇列延遲，將於 1.5 秒後進行第 ${i + 1} 次自動重試...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue; // 進入下一次迴圈重試
      }

      throw new Error(data.message);
    } catch (error) {
      // 如果是最後一次重試也失敗了，才真正拋出錯誤
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
};

// ✅ 8. 更新空間專屬背景圖
export const updateSpaceBackground = async (spaceId, imageUrl) => {
  try {
    const spaceRef = doc(db, "Spaces", spaceId);
    await updateDoc(spaceRef, {
      backgroundImageUrl: imageUrl
    });
  } catch (error) {
    console.error("更新背景圖失敗:", error);
    throw error;
  }
};

// ✅ 9. 取得使用者個人資料
export const getUserProfile = async (userId) => {
  try {
    const docRef = doc(db, "Users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("讀取使用者資料失敗:", error);
    return null;
  }
};

// ✅ 10. 更新使用者資料 (姓名、頭貼等)
export const updateUserProfile = async (userId, data) => {
  try {
    const docRef = doc(db, "Users", userId);
    // { merge: true } 可以確保只更新傳入的欄位，不會把其他資料洗掉
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("更新使用者資料失敗:", error);
    throw error;
  }
};

// ✅ 新增：編輯/更新指定的紀錄
export const updateRecordInSpace = async (spaceId, recordId, imageUrls, note, location, latitude, longitude) => {
  try {
    // 取得該筆紀錄的參考位置 (假設你的資料庫結構是 spaces -> 空間ID -> records -> 紀錄ID)
    const recordRef = doc(db, 'Records', recordId);
    
    // 執行更新
    await updateDoc(recordRef, {
      imageUrls: imageUrls,
      imageUrl: imageUrls.length > 0 ? imageUrls[0] : null, // 為了相容舊版單圖
      note: note,
      location: location,
      latitude: latitude,
      longitude: longitude,
      updatedAt: Date.now(), // 紀錄最後修改時間
    });
    
    console.log("紀錄更新成功！");
    return true;
  } catch (error) {
    console.error("更新紀錄失敗: ", error);
    throw error;
  }
};

// ✅ 新增：刪除指定的紀錄
export const deleteRecordFromSpace = async (spaceId, recordId) => {
  try {
    // 找到那筆紀錄的準確地址
    const recordRef = doc(db, 'Records', recordId);
    
    // 呼叫 Firebase 的刪除指令
    await deleteDoc(recordRef);
    
    console.log("紀錄刪除成功！");
    return true;
  } catch (error) {
    console.error("刪除紀錄失敗: ", error);
    throw error;
  }
};

// ✅ 新增：把留言寫入特定紀錄的資料庫中
// ==========================================
export const addCommentToRecord = async (spaceId, recordId, userId, userName, text) => {
  try {
    // 建立路徑：spaces -> 空間ID -> records -> 紀錄ID -> comments
    const commentsRef = collection(db, 'spaces', spaceId, 'records', recordId, 'comments');
    await addDoc(commentsRef, {
      userId: userId,
      userName: userName,
      text: text,
      createdAt: Date.now(),
    });
    return true;
  } catch (error) {
    console.error("資料庫新增留言失敗: ", error);
    throw error;
  }
};

// ==========================================
// ✅ 新增：實時訂閱該紀錄的留言（有人留完言畫面立刻跳出來）
// ==========================================
export const subscribeToComments = (spaceId, recordId, callback) => {
  const commentsRef = collection(db, 'spaces', spaceId, 'records', recordId, 'comments');
  // 依時間正序排列（最早的在上面，最新的在最底下，符合聊天/留言直覺）
  const q = query(commentsRef, orderBy('createdAt', 'asc')); 
  
  return onSnapshot(q, (snapshot) => {
    const fetchedComments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(fetchedComments);
  });
};