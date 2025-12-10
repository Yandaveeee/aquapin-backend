import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const [ip, setIp] = useState('');
  const [currentIp, setCurrentIp] = useState('Loading...');

  useEffect(() => {
    loadCurrentIp();
  }, []);

  const loadCurrentIp = async () => {
    const saved = await AsyncStorage.getItem('SERVER_IP');
    setCurrentIp(saved || "Default (Hardcoded)");
    if(saved) setIp(saved);
  };

  const saveIp = async () => {
    if (!ip.trim()) {
      // Allow clearing to reset to default
      await AsyncStorage.removeItem('SERVER_IP');
      Alert.alert("Reset", "Reverted to default IP.");
      loadCurrentIp();
      return;
    }

    try {
      await AsyncStorage.setItem('SERVER_IP', ip.trim());
      Alert.alert("Success", "New Server IP Saved!\nThe app will now talk to this address.");
      loadCurrentIp();
    } catch (error) {
      Alert.alert("Error", "Could not save IP.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>⚙️ System Configuration</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Current Server Address:</Text>
        <Text style={styles.value}>{currentIp}</Text>
      </View>

      <Text style={styles.label}>New IP Address:</Text>
      <Text style={styles.subtext}>Find this on your laptop (ipconfig)</Text>
      
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 192.168.1.5" 
        keyboardType="numeric"
        value={ip} 
        onChangeText={setIp} 
      />

      <Button title="Update Connection" onPress={saveIp} />

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={24} color="#007AFF" />
        <Text style={styles.infoText}>
          Use this screen on Defense Day if the Wi-Fi network changes. You do not need to reinstall the app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f5f5f5' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 20, elevation: 2 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  value: { fontSize: 18, color: '#007AFF', marginTop: 5 },
  subtext: { color: '#666', marginBottom: 10, fontSize: 12 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', marginBottom: 20, fontSize: 18 },
  infoBox: { flexDirection: 'row', backgroundColor: '#E3F2FD', padding: 15, borderRadius: 10, marginTop: 30, alignItems: 'center' },
  infoText: { flex: 1, marginLeft: 10, color: '#0D47A1', fontSize: 14 }
});