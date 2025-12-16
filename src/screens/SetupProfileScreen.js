import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SetupProfileScreen({ handleFinish }) {
  const [name, setName] = useState('');
  const [farmName, setFarmName] = useState('');

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing Info", "Please enter your name.");
      return;
    }

    const userProfile = {
      name: name,
      farmName: farmName || "My Farm",
      joinedDate: new Date().toISOString(),
      isSetup: true
    };

    try {
      // 1. Save to Storage
      await AsyncStorage.setItem('USER_PROFILE', JSON.stringify(userProfile));
      
      // 2. Flip the switch in App.js
      if (handleFinish) {
        handleFinish(); 
      }
    } catch (e) {
      Alert.alert("Error", "Could not save profile.");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.header}>Let's set up your profile</Text>
        <Text style={styles.subHeader}>We will personalize your dashboard based on this info.</Text>

        <Text style={styles.label}>Your Name</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Juan dela Cruz" 
          value={name} 
          onChangeText={setName} 
        />

        <Text style={styles.label}>Farm Name (Optional)</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Cagayan Fishery" 
          value={farmName} 
          onChangeText={setFarmName} 
        />

        <TouchableOpacity style={styles.button} onPress={onSave}>
          <Text style={styles.buttonText}>Go to Dashboard 🚀</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 30, justifyContent: 'center' },
  content: { marginTop: -50 },
  header: { fontSize: 26, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  subHeader: { fontSize: 16, color: '#666', marginBottom: 30 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#1565C0', marginBottom: 5, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 15, fontSize: 16, backgroundColor: '#F9F9F9' },
  button: { marginTop: 40, backgroundColor: '#00C853', paddingVertical: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});