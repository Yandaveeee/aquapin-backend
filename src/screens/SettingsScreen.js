import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios'; // Import axios directly for testing

export default function SettingsScreen() {
  const [ip, setIp] = useState('');
  const [currentIp, setCurrentIp] = useState('Loading...');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCurrentIp();
  }, []);

  const loadCurrentIp = async () => {
    const saved = await AsyncStorage.getItem('SERVER_IP');
    setCurrentIp(saved || "No IP Saved");
    if(saved) setIp(saved);
  };

  const saveIp = async () => {
    if (!ip.trim()) {
      await AsyncStorage.removeItem('SERVER_IP');
      Alert.alert("Reset", "Removed custom IP.");
      loadCurrentIp();
      return;
    }
    try {
      // Remove any accidental spaces
      const cleanIp = ip.trim(); 
      await AsyncStorage.setItem('SERVER_IP', cleanIp);
      Alert.alert("Saved", `IP updated to: ${cleanIp}`);
      loadCurrentIp();
    } catch (error) {
      Alert.alert("Error", "Could not save IP.");
    }
  };

  // --- NEW: TEST FUNCTION ---
  // --- STRICTER TEST FUNCTION ---
  const testConnection = async () => {
    // 1. Force the URL to use exactly what is typed
    const cleanIp = ip.trim();
    if (!cleanIp) {
        Alert.alert("Input Error", "Please type an IP address first.");
        return;
    }

    setLoading(true);
    const targetUrl = `http://${cleanIp}:8000`; 
    
    console.log(`Attempting to connect to: ${targetUrl}`);

    try {
      // 2. Add a random timestamp to prevent the phone from using "Cached" answers
      const response = await axios.get(`${targetUrl}/?t=${Date.now()}`, { timeout: 3000 });
      
      console.log("Raw Response:", response.data);

      // 3. VERIFY IT IS ACTUALLY YOUR SERVER
      // We check if the reply contains the words "AquaPin"
      if (response.data && response.data.message && response.data.message.includes("AquaPin")) {
          Alert.alert("✅ CONFIRMED", `Successfully connected to YOUR server at ${cleanIp}\n\nReply: "${response.data.message}"`);
      } else {
          Alert.alert("⚠️ CONNECTED WRONG SERVER", `We reached ${cleanIp}, but it didn't reply correctly.\n\nReply: ${JSON.stringify(response.data)}`);
      }
    
    } catch (error) {
      console.error(error);
      Alert.alert(
        "❌ FAILED", 
        `Could not reach: ${cleanIp}\n\nReason: ${error.message}\n\nCheck: Is the backend running? Is the IP correct?`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>⚙️ Connection Setup</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Active Server IP:</Text>
        <Text style={styles.value}>{currentIp}</Text>
      </View>

      <Text style={styles.label}>New IP Address:</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 192.168.1.5" 
        keyboardType="numeric"
        value={ip} 
        onChangeText={setIp} 
      />

      <View style={styles.btnRow}>
        <Button title="Save IP" onPress={saveIp} />
        <View style={{width: 20}} />
        {loading ? (
            <ActivityIndicator color="blue" />
        ) : (
            <Button title="Test Connection" onPress={testConnection} color="orange" />
        )}
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="help-circle" size={24} color="#007AFF" />
        <Text style={styles.infoText}>
          1. Enter IP (Numbers only).{'\n'}
          2. Click "Save IP".{'\n'}
          3. Click "Test Connection".
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f5f5f5' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 20, elevation: 2 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  value: { fontSize: 18, color: '#007AFF', marginTop: 5 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', marginBottom: 20, fontSize: 18 },
  btnRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  infoBox: { flexDirection: 'row', backgroundColor: '#E3F2FD', padding: 15, borderRadius: 10, marginTop: 30 },
  infoText: { flex: 1, marginLeft: 10, color: '#0D47A1', fontSize: 14, lineHeight: 20 }
});