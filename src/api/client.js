import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid'; // Run: npm install uuid react-native-get-random-values

const API_URL = 'https://aquapin-backend-igvj.onrender.com';

const client = axios.create({
  baseURL: API_URL,
});

// Interceptor: Before sending any request, attach the User ID
client.interceptors.request.use(async (config) => {
  let userId = await AsyncStorage.getItem('USER_ID');
  
  // If no ID exists, create one permanently
  if (!userId) {
    userId = uuidv4();
    await AsyncStorage.setItem('USER_ID', userId);
  }

  config.headers['x-user-id'] = userId;
  return config;
});

export default client;