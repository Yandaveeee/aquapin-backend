import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Keys for our storage
const QUEUE_KEY = 'OFFLINE_ACTION_QUEUE';

// 1. Check if we are connected
export const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable;
};

// 2. Save Data for Offline Viewing (Caching)
export const cacheData = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Cache Error", e);
  }
};

// 3. Get Data (Try Network first, fallback to Cache)
export const getSmartData = async (key, apiCall) => {
  const online = await isOnline();
  
  if (online) {
    try {
      const response = await apiCall();
      // If success, update cache
      await cacheData(key, response.data);
      return response.data;
    } catch (error) {
      console.log("Network failed, trying cache...");
    }
  }

  // If offline or error, load from cache
  const cached = await AsyncStorage.getItem(key);
  return cached ? JSON.parse(cached) : null;
};

// 4. Queue an Action (e.g., Save Harvest) when Offline
export const queueAction = async (endpoint, method, payload) => {
  const existingQueue = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = existingQueue ? JSON.parse(existingQueue) : [];
  
  queue.push({
    id: Date.now(), // Unique ID
    endpoint,
    method,
    payload,
    timestamp: new Date().toISOString()
  });

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// 5. Get the list of pending actions
export const getPendingActions = async () => {
  const json = await AsyncStorage.getItem(QUEUE_KEY);
  return json ? JSON.parse(json) : [];
};

// 6. Clear the queue (after syncing)
export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};