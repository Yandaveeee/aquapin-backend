import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location'; 
import client from './client';

const QUEUE_KEY = 'OFFLINE_ACTION_QUEUE';

// 1. Check Internet Connection
export const isOnline = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable;
};

// 2. Helper: Save Data to Cache
export const cacheData = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) { console.error("Cache Error", e); }
};

// 3. Smart Fetch with ForceRefresh Support
export const getSmartData = async (key, apiCall, options = {}) => {
  const { forceRefresh = false } = options;
  const online = await isOnline();
  
  // If forceRefresh is true, always fetch from API (skip cache)
  if (forceRefresh && online) {
    try {
      const response = await apiCall();
      await cacheData(key, response.data); 
      return response.data;
    } catch (error) { 
      console.log(`⚠️ Force refresh failed for ${key}. Using cache.`); 
      const cached = await AsyncStorage.getItem(key);
      return cached ? JSON.parse(cached) : null;
    }
  }
  
  // Otherwise, use cache-first strategy
  if (online) {
    try {
      const response = await apiCall();
      await cacheData(key, response.data); 
      return response.data;
    } catch (error) { 
      console.log(`⚠️ Network failed for ${key}. Using cache.`); 
    }
  }
  const cached = await AsyncStorage.getItem(key);
  return cached ? JSON.parse(cached) : null;
};

// 3.5 Cache Invalidation Utility
export const invalidateCache = async (keys) => {
  try {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    await Promise.all(
      keyArray.map(key => AsyncStorage.removeItem(key))
    );
    console.log(`✅ Cache invalidated: ${keyArray.join(', ')}`);
  } catch (error) {
    console.error('Cache invalidation failed:', error);
  }
};

// 4. Queue Action (UPDATED: Accepts Temp ID)
export const queueAction = async (endpoint, payload, method = 'POST', tempId = null) => {
  const existingQueue = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = existingQueue ? JSON.parse(existingQueue) : [];

  queue.push({
    id: Date.now(),
    endpoint,
    payload,
    method,
    tempId, // <--- Save the temp ID so we can map it later
    timestamp: new Date().toISOString()
  });

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// 5. Sync Data (UPDATED: ID Swapping Logic)
export const syncData = async () => {
  const online = await isOnline();
  if (!online) return { success: false, message: "No Internet Connection" };

  const json = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = json ? JSON.parse(json) : [];
  if (queue.length === 0) return { success: true, message: "Nothing to sync." };

  const failedItems = [];
  let successCount = 0;
  
  // MAP: Keeps track of { Old_Negative_ID : New_Real_ID }
  const idMap = {}; 

  console.log(`🔄 Syncing ${queue.length} items...`);

  for (const item of queue) {
    try {
      // A. ID SWAPPING MAGIC
      // If this item refers to a 'stocking_id' that we just created, update it!
      if (item.payload.stocking_id && idMap[item.payload.stocking_id]) {
          console.log(`   🔗 Swapping Temp ID ${item.payload.stocking_id} -> Real ID ${idMap[item.payload.stocking_id]}`);
          item.payload.stocking_id = idMap[item.payload.stocking_id];
      }

      // B. Address Auto-Fix (Keep your existing logic)
      if (item.endpoint.includes('/ponds/') && 
          item.payload.location_desc?.includes("Offline") && 
          item.payload.coordinates?.[0]) {
        try {
            const [lat, lng] = item.payload.coordinates[0];
            const list = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (list[0]) item.payload.location_desc = `${list[0].city}, ${list[0].region}`;
        } catch(e) {}
      }

      // C. Send Request
      const response = await client.request({
          method: item.method,
          url: item.endpoint,
          data: item.payload
      });

      // D. CAPTURE NEW ID
      // If this item had a Temp ID, and the server gave us a Real ID, save the mapping
      if (item.tempId && response.data && response.data.id) {
          console.log(`   ✅ Created! Mapped ${item.tempId} => ${response.data.id}`);
          idMap[item.tempId] = response.data.id;
      }

      successCount++;
    } catch (error) {
      console.error("❌ Sync Failed:", error.message);
      failedItems.push(item); 
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failedItems));
  return { success: true, message: `Synced ${successCount} items.` };
};

export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};