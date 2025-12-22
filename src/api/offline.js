import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location'; // <--- NEW IMPORT for fixing addresses
import client from './client';

const QUEUE_KEY = 'OFFLINE_ACTION_QUEUE';

// 1. Check Internet Connection
export const isOnline = async () => {
  const state = await NetInfo.fetch();
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
      await cacheData(key, response.data); 
      return response.data;
    } catch (error) {
      console.log(`⚠️ Network failed for ${key}. Falling back to cache.`);
      if (error.response) console.log("Server Error:", error.response.status);
    }
  } else {
    console.log(`📱 Offline. Loading ${key} from cache.`);
  }

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

// 5. Sync: Upload all queued data (WITH ADDRESS FIXER)
export const syncData = async () => {
  const online = await isOnline();
  if (!online) return { success: false, message: "No Internet Connection" };

  const json = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = json ? JSON.parse(json) : [];

  if (queue.length === 0) return { success: true, message: "Nothing to sync." };

  const failedItems = [];
  let successCount = 0;

  console.log(`🔄 Starting Sync for ${queue.length} items...`);

  for (const item of queue) {
    try {
      // --- START: AUTO-FIX ADDRESS LOGIC ---
      // If this is a Pond Save AND it has the "Offline" placeholder text...
      if (item.endpoint.includes('/ponds/') && 
          item.payload.location_desc === "Pinned Location (Offline)" &&
          item.payload.coordinates && 
          item.payload.coordinates.length > 0) {
        
        console.log(`📍 Fixing address for item ${item.id}...`);
        
        // Get the first coordinate point [lat, lng]
        const [lat, lng] = item.payload.coordinates[0];
        
        // Ask Google/Expo for the real name now that we are online
        const addressList = await Location.reverseGeocodeAsync({ 
            latitude: lat, 
            longitude: lng 
        });

        if (addressList.length > 0) {
           const addr = addressList[0];
           // Update the payload with the real city/region
           item.payload.location_desc = `${addr.city || addr.subregion || ''}, ${addr.region || addr.country || ''}`;
           console.log("   ✅ Address updated to:", item.payload.location_desc);
        }
      }
      // --- END: AUTO-FIX ADDRESS LOGIC ---

      // Send the (potentially updated) item to the server
      await client.post(item.endpoint, item.payload);
      successCount++;
      
    } catch (error) {
      console.error("❌ Sync Failed for item:", item.id);
      if (error.response) {
          console.error("   Server replied:", error.response.status);
      } else {
          console.error("   Network Error:", error.message);
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