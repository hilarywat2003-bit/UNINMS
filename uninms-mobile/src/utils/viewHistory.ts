import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@uninms_recent_docs';
const MAX = 10;

export type RecentDoc = {
  id: string;
  title: string;
  doc_type: string;
  uploader_name?: string;
  viewedAt: number;
};

export async function saveRecentDoc(doc: Omit<RecentDoc, 'viewedAt'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: RecentDoc[] = raw ? JSON.parse(raw) : [];
    // Remove existing entry for this doc (so it moves to top)
    const filtered = list.filter(d => d.id !== doc.id);
    const updated = [{ ...doc, viewedAt: Date.now() }, ...filtered].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
}

export async function getRecentDocs(): Promise<RecentDoc[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
