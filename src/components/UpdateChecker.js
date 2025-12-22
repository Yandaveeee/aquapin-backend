import React, { useEffect, useState } from 'react';
import { View, Text, Alert, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';

export default function UpdateChecker() {
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    checkUpdates();
  }, []);

  const checkUpdates = async () => {
    try {
      // 1. Check if an update is available
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        // 2. Popup: Ask user if they want to update
        Alert.alert(
          "Update Available",
          "A new version of AquaPin with new features is ready. Would you like to update?",
          [
            { text: "Later", style: "cancel" },
            { 
              text: "Update Now", 
              onPress: () => startDownload() // User clicked Update
            }
          ]
        );
      }
    } catch (error) {
      // Ignore errors (like being offline) quietly
      console.log("Update check failed:", error);
    }
  };

  const startDownload = async () => {
    // 3. Show the "Progress" Modal
    setIsDownloading(true);

    try {
      // 4. Download the update (This takes a few seconds)
      await Updates.fetchUpdateAsync();
    } catch (error) {
      Alert.alert("Error", "Could not download update. Please try again later.");
      setIsDownloading(false);
      return;
    }

    // 5. Hide Modal and Ask to Restart
    setIsDownloading(false);
    
    setTimeout(() => {
        Alert.alert(
            "Update Ready! 🚀",
            "The app needs to restart to apply the changes.",
            [
              { 
                text: "Restart App", 
                onPress: async () => {
                  await Updates.reloadAsync();
                } 
              }
            ]
          );
    }, 200);
  };

  // If not downloading, return nothing (invisible)
  if (!isDownloading) return null;

  // 6. The "Progress" UI
  return (
    <Modal transparent={true} animationType="fade" visible={isDownloading}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.text}>Updating AquaPin...</Text>
          <Text style={styles.subText}>Please wait a moment.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Semi-transparent black background
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 200,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 5, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  text: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  subText: {
    marginTop: 5,
    fontSize: 12,
    color: '#666',
  }
});