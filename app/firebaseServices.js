import { 
  collection, query, where, onSnapshot, doc, 
  updateDoc, arrayUnion, addDoc, getDocs 
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

// ✅ 6. 修改：支援多圖網址陣列存入空間
export const addRecordToSpace = async (spaceId, imageUrls) => {
  try {
    await addDoc(collection(db, "Records"), {
      spaceId: spaceId,
      imageUrls: imageUrls, // 這裡改成存入陣列
      createdAt: Date.now()
    });
  } catch (error) {
    console.error("新增紀錄失敗:", error);
    throw error;
  }
};

// ✅ 7. GitHub 圖床上傳函數
export const uploadImageToGitHub = async (base64String) => {
  try {
    // ⚠️ 請記得把這三個變數換成你的 GitHub 資訊！
    const GITHUB_USERNAME = 'jael1118'; 
    const GITHUB_REPO = 'appimg';      
    const GITHUB_TOKEN = 'token'; 

    const filename = `img_${Date.now()}.jpg`;
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filename}`;

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
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("GitHub 上傳失敗:", error);
    throw error;
  }
};