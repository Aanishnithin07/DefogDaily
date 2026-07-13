import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db, isConfigured } from "./firebase";

export const saveScore = async (userId, rawScores, normalizedScores) => {
  if (!isConfigured || !db) return;
  try {
    const userScansRef = collection(db, "users", userId, "scans");
    await addDoc(userScansRef, {
      rawScores,
      normalizedScores,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Error saving score:", err);
  }
};

export const fetchUserHistory = async (userId) => {
  if (!isConfigured || !db) return [];
  try {
    const q = query(
      collection(db, "users", userId, "scans"),
      orderBy("timestamp", "asc")
    );
    const querySnapshot = await getDocs(q);
    const history = [];
    querySnapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() });
    });
    return history;
  } catch (err) {
    console.error("Error fetching history:", err);
    return [];
  }
};
