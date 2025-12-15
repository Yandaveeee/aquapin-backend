import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'OFFLINE_ACTION_QUEUE';

// 1. Check Internet Connection
export const isOnline = async () => {
  const state = await NetInfo.fetch();
  // We check both isConnected AND isInternetReachable to be sure
  return state.isConnected && (state.isInternetReachable !== false);
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
// FIX: 'apiCall' must be a function like () => client.get(...)
export const getSmartData = async (key, apiCall) => {
  const online = await isOnline();

  if (online) {
    try {
      const response = await apiCall();
      await cacheData(key, response.data); // Save fresh data
      return response.data;
    } catch (error) {
      console.log(`⚠️ Network failed for ${key}. Falling back to cache.`);
    }
  } else {
    console.log(`📱 Offline. Loading ${key} from cache.`);
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
// You need to pass the 'client' import to this function to avoid circular dependencies
export const syncData = async (client) => {
  const online = await isOnline();
  if (!online) return { success: false, message: "No Internet Connection" };

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
      console.error("Sync failed for item:", item);
      failedItems.push(item); // Keep it if it fails
    }
  }

  // Update queue with only failed items
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failedItems));
  
  return { 
    success: true, 
    message: `Synced ${successCount} items. ${failedItems.length} failed.` 
  };
};