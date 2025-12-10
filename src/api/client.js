import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Create the instance without a hardcoded baseURL
const client = axios.create();

// 2. Add an "Interceptor"
// This runs AUTOMATICALLY before every single API call (Save, Fetch, etc.)
client.interceptors.request.use(async (config) => {
  try {
    // A. Check if the user saved a custom IP in settings
    const savedIP = await AsyncStorage.getItem('SERVER_IP');
    
    // B. If yes, use it. If no, use your current default (Backup)
    // REPLACE '192.168.68.104' WITH YOUR CURRENT IP JUST AS A BACKUP
    const baseURL = savedIP ? `http://${savedIP}:8000` : '192.168.68.152:8000';
    
    config.baseURL = baseURL;
    return config;
  } catch (error) {
    return config;
  }
});

export default client;