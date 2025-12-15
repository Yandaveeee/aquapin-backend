import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import client from './client'; // <--- Added import so Sync works automatically

const QUEUE_KEY = 'OFFLINE_ACTION_QUEUE';

// 1. Check Internet Connection (UPDATED FIX)
export const isOnline = async () => {
  const state = await NetInfo.fetch();
  // FIX: Only check if connected to Wi-Fi/Data. 
  // We remove 'isInternetReachable' because it often fails on local networks.
  return state.isConnected; 
};

// 2. Helper: Save Data to Cache
export const cacheData = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Cache Error", e);
  }
};

// 3. Smart Fetch: Tries Network First -> Falls back to Cache
export const getSmartData = async (key, apiCall) => {
  const online = await isOnline();

  if (online) {
    try {
      const response = await apiCall();
      await cacheData(key, response.data); // Save fresh data
      return response.data;
    } catch (error) {
      console.log(`⚠️ Network failed for ${key}. Falling back to cache.`);
      // Optional: Log real error for debugging
      if (error.response) console.log("Server Error:", error.response.status);
    }
  } else {
    console.log(`📱 Offline (or Local Network). Loading ${key} from cache.`);
  }

  // Fallback: Load from storage
  const cached = await AsyncStorage.getItem(key);
  return cached ? JSON.parse(cached) : null;
};

// 4. Queue Action: Save data locally when offline
export const queueAction = async (endpoint, payload) => {
  const existingQueue = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = existingQueue ? JSON.parse(existingQueue) : [];

  queue.push({
    id: Date.now(),
    endpoint,
    payload,
    timestamp: new Date().toISOString()
  });

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// 5. Sync: Upload all queued data
export const syncData = async () => {
  // Check connection using our relaxed rule
  const online = await isOnline();
  if (!online) return { success: false, message: "No Wi-Fi Connection" };

  const json = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = json ? JSON.parse(json) : [];

  if (queue.length === 0) return { success: true, message: "Nothing to sync." };

  const failedItems = [];
  let successCount = 0;

  for (const item of queue) {
    try {
      await client.post(item.endpoint, item.payload);
      successCount++;
    } catch (error) {
      console.error("❌ Sync Failed for item:", item);
      if (error.response) {
          console.error("   Server replied:", error.response.status);
          console.error("   Server message:", error.response.data);
      } else {
          console.error("   Network/Connection Error:", error.message);
      }
      failedItems.push(item); 
    }
  }

  // Update queue with only failed items
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failedItems));
  
  return { 
    success: true, 
    message: `Synced ${successCount} items. ${failedItems.length} failed.` 
  };
};
export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};