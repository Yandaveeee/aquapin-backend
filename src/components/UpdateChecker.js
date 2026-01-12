import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function UpdateChecker() {
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      // EMERGENCY CIRCUIT BREAKER: Check how many times we've checked today
      const today = new Date().toDateString();
      const checkKey = `updateChecks_${today}`;
      const checksToday = await AsyncStorage.getItem(checkKey);
      const checkCount = checksToday ? parseInt(checksToday) : 0;

      // If we've already checked 3 times today, STOP
      if (checkCount >= 3) {
        console.log("Already checked 3 times today, stopping to prevent loop");
        return;
      }

      // Increment check counter
      await AsyncStorage.setItem(checkKey, String(checkCount + 1));

      // Don't check in dev mode
      if (__DEV__) {
        console.log("Dev mode, skipping");
        return;
      }

      // Skip emergency launches
      if (Updates.isEmergencyLaunch) {
        console.log("Emergency launch, skipping");
        return;
      }

      // Wait 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        const currentUpdateId = Updates.updateId;
        const manifestUpdateId = update.manifest?.id;

        if (currentUpdateId === manifestUpdateId) {
          console.log("Already on latest version");
          return;
        }

        Alert.alert(
          "Update Available",
          "A new version of AquaPin is ready. Update now?",
          [
            { text: "Later", style: "cancel" },
            { 
              text: "Update Now", 
              onPress: () => startDownload()
            }
          ]
        );
      }
    } catch (error) {
      console.log("Error checking updates:", error);
    }
  };

  const startDownload = async () => {
    setIsDownloading(true);

    try {
      await Updates.fetchUpdateAsync();
      
      setIsDownloading(false);

      setTimeout(() => {
        Alert.alert(
          "Update Ready! 🚀",
          "The app needs to restart to finish.",
          [
            { 
              text: "Restart Now", 
              onPress: async () => { 
                await Updates.reloadAsync(); 
              } 
            }
          ],
          { cancelable: false }
        );
      }, 500);

    } catch (error) {
      setIsDownloading(false);
      Alert.alert("Error", "Could not download update.");
      console.error("Update download error:", error);
    }
  };

  if (!isDownloading) return null;

  return (
    <Modal transparent={true} visible={isDownloading} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>AquaPin 3.0</Text>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.text}>Updating AquaPin...</Text>
          <Text style={styles.subText}>Please wait...</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 220,
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 15,
  },
  text: { 
    marginTop: 15, 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  subText: { 
    marginTop: 5, 
    fontSize: 12, 
    color: '#666' 
  }
});