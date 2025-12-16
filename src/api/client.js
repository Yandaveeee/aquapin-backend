import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://aquapin-backend-igvj.onrender.com';

// 1. Create the Axios Instance
const api = axios.create({
  baseURL: API_URL,
});

// 2. Add an "Interceptor"
// This runs BEFORE every single request you make (e.g., api.get('/ponds'))
api.interceptors.request.use(async (config) => {
  try {
    // 3. Retrieve the User ID from the phone's storage
    const userId = await AsyncStorage.getItem('user_id');

    // 4. If we found an ID, attach it to the headers
    if (userId) {
      config.headers['x-user-id'] = userId;
      console.log(`[API] Attaching User ID: ${userId}`);
    }
  } catch (error) {
    console.error("Error retrieving User ID:", error);
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;