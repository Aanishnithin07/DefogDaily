import { getDb, isConfigured } from "./firebase";

/**
 * Optional cloud backup of scan results. Every function no-ops cleanly when
 * Firebase is not configured, so the local-first path never has to branch.
 */

export const saveScore = async (userId, metrics, normalizedScores) => {
  if (!isConfigured || !userId) return;
  const client = await getDb();
  if (!client) return;
  try {
    const { collection, addDoc, serverTimestamp } = client.mod;
    await addDoc(collection(client.db, "users", userId, "scans"), {
      metrics,
      normalizedScores,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error saving score:", error);
  }
};

export const fetchUserHistory = async (userId) => {
  if (!isConfigured || !userId) return [];
  const client = await getDb();
  if (!client) return [];
  try {
    const { collection, getDocs, orderBy, query } = client.mod;
    const snapshot = await getDocs(
      query(collection(client.db, "users", userId, "scans"), orderBy("timestamp", "asc"))
    );
    const history = [];
    snapshot.forEach((doc) => history.push({ id: doc.id, ...doc.data() }));
    return history;
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
};
