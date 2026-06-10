import { 
  collection, query, where, onSnapshot, doc, orderBy, writeBatch,
  updateDoc, arrayUnion, addDoc, setDoc, getDocs, getDoc, deleteDoc, arrayRemove 
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
  if (!userId) return null;
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
  if (!code || !userId) return null;
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

// ✅ 更新空間名稱
export const updateSpaceName = async (spaceId, newName) => {
  if (!spaceId) return false;
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
  if (!spaceId) return () => {};
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
  if (!userId) return () => {};
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
export const addRecordToSpace = async (spaceId, imageUrls, note, location, latitude, longitude, userId, mood) => {
  if (!spaceId) {
    console.warn("發布失敗：缺少目標空間 ID");
    return;
  }
  try {
    await addDoc(collection(db, "Records"), {
      spaceId: spaceId,
      userId: userId || null, // 確保發文者 ID 被安全寫入
      imageUrls: imageUrls, 
      note: note || "",
      location: location || "",
      latitude: latitude !== undefined ? latitude : null,   
      longitude: longitude !== undefined ? longitude : null, 
      mood: mood !== undefined ? mood : null,
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
        return data.content.download_url; 
      }

      if (data.message && data.message.includes('is at') && data.message.includes('expected')) {
        console.log(`偵測到 GitHub 佇列延遲，將於 1.5 秒後進行第 ${i + 1} 次自動重試...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue; 
      }

      throw new Error(data.message);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
};

// ✅ 8. 更新空間專屬背景圖
export const updateSpaceBackground = async (spaceId, imageUrl) => {
  if (!spaceId) return;
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

// 🌟 9. 核心修正：取得使用者個人資料 (注入安全攔截閘，防止 undefined 導致發文崩潰)
export const getUserProfile = async (userId) => {
  // 🛡️ 超級安全鎖：如果傳進來的 userId 是空的或未定義，立刻安全回傳 null，防阻閃退！
  if (!userId || typeof userId !== 'string') return null; 
  try {
    const docRef = doc(db, "Users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id, // 補回關鍵識別 docId
        ...data,
        avatarUrl: data?.avatarUrl || data?.avatar || data?.photoUrl || data?.imageUrl || null
      };
    }
    return null;
  } catch (error) {
    console.error("讀取使用者資料失敗:", error);
    return null;
  }
};

// ✅ 10. 更新使用者資料 (姓名、頭貼等)
export const updateUserProfile = async (userId, data) => {
  if (!userId) return;
  try {
    const docRef = doc(db, "Users", userId);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("更新使用者資料失敗:", error);
    throw error;
  }
};

// ✅ 編輯/更新指定的紀錄
export const updateRecordInSpace = async (spaceId, recordId, imageUrls, note, location, latitude, longitude, mood) => {
  if (!recordId) return false;
  try {
    const recordRef = doc(db, 'Records', recordId);
    
    await updateDoc(recordRef, {
      imageUrls: imageUrls,
      imageUrl: imageUrls.length > 0 ? imageUrls[0] : null, 
      note: note,
      location: location,
      latitude: latitude,
      longitude: longitude,
      mood: mood !== undefined ? mood : null,
      updatedAt: Date.now(), 
    });
    
    console.log("紀錄更新成功！");
    return true;
  } catch (error) {
    console.error("更新紀錄失敗: ", error);
    throw error;
  }
};

// ✅ 刪除指定的紀錄
export const deleteRecordFromSpace = async (spaceId, recordId) => {
  if (!recordId) return false;
  try {
    const recordRef = doc(db, 'Records', recordId);
    await deleteDoc(recordRef);
    console.log("紀錄刪除成功！");
    return true;
  } catch (error) {
    console.error("刪除紀錄失敗: ", error);
    throw error;
  }
};

// ✅ 新增留言到特定紀錄 
export const addCommentToRecord = async (spaceId, recordId, userId, userName, text) => {
  if (!spaceId || !recordId) return false;
  try {
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

// ✅ 實時訂閱該紀錄的留言 
export const subscribeToComments = (spaceId, recordId, callback) => {
  if (!spaceId || !recordId) return () => {};
  const commentsRef = collection(db, 'spaces', spaceId, 'records', recordId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'asc')); 
  
  return onSnapshot(q, (snapshot) => {
    const fetchedComments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(fetchedComments);
  });
};

// ✅ 通知系統 - 發送通知给空間成員
export const sendNotificationToMembers = async (memberIds, senderId, notificationData) => {
  try {
    const batch = writeBatch(db); 
    
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
        console.warn("沒有成員名單，無法發送通知");
        return;
    }

    memberIds.forEach(memberId => {
      // 🛡️ 確保排隊發通知的成員 ID 也是合法的 string
      if (memberId && memberId !== senderId && typeof memberId === 'string') {
        const notifRef = doc(collection(db, 'Users', memberId, 'notifications'));
        batch.set(notifRef, {
          ...notificationData,
          isRead: false,
          createdAt: Date.now()
        });
      }
    });
    
    await batch.commit();
    console.log("成功發送通知給其他成員！");
  } catch (error) {
    console.error("發送通知失敗:", error);
  }
};

// ✅ 即時監聽我的通知
export const subscribeToMyNotifications = (userId, callback) => {
  if (!userId) return () => {};
  
  const q = query(
    collection(db, 'Users', userId, 'notifications'), 
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(notifs);
  }, (error) => {
    console.error("監聽通知失敗:", error);
  });
};

// ✅ 把未讀通知標記為「已讀」
export const markNotificationsAsRead = async (userId, unreadNotifs) => {
  if (!userId || !unreadNotifs || unreadNotifs.length === 0) return;
  try {
    const batch = writeBatch(db);
    unreadNotifs.forEach(notif => {
      const notifRef = doc(db, 'Users', userId, 'notifications', notif.id);
      batch.update(notifRef, { isRead: true });
    });
    await batch.commit();
  } catch (error) {
    console.error("標記已讀失敗:", error);
  }
};

// ✅ 取得特定空間的詳細資料 
export const getSpaceData = async (spaceId) => {
  if (!spaceId) return null;
  try {
    const spaceRef = doc(db, "Spaces", spaceId);
    const docSnap = await getDoc(spaceRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("讀取空間資料失敗:", error);
    return null;
  }
};

// ✅ 退出空間或踢出成員 (共用同一個邏輯)
export const removeMemberFromSpace = async (spaceId, userId) => {
  if (!spaceId || !userId) return false;
  try {
    const spaceRef = doc(db, 'Spaces', spaceId);
    await updateDoc(spaceRef, {
      members: arrayRemove(userId) // 從陣列中拔除該名成員
    });
    console.log("成員移除成功！");
    return true;
  } catch (error) {
    console.error("移除成員失敗: ", error);
    throw error;
  }
};

// ✅ 刪除整個空間 (房主專屬)
export const deleteSpace = async (spaceId) => {
  if (!spaceId) return false;
  try {
    // 註：這只會刪除空間本體。實務上如果紀錄很多，可能需要寫 Cloud Function 來刪除底下的 Records，但目前先刪除空間入口即可。
    const spaceRef = doc(db, 'Spaces', spaceId);
    await deleteDoc(spaceRef);
    console.log("空間解散成功！");
    return true;
  } catch (error) {
    console.error("解散空間失敗: ", error);
    throw error;
  }
};