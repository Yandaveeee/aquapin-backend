import AsyncStorage from '@react-native-async-storage/async-storage';

// Save data to phone
export const storeData = async (key, value) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
    console.log(`Saved ${key} to local storage.`);
  } catch (e) {
    console.error("Error saving data", e);
  }
};

// Load data from phone
export const getData = async (key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("Error reading data", e);
    return null;
  }
};