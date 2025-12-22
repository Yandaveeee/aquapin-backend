import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { isOnline, queueAction } from '../api/offline';

// 1. Add { route, navigation } to receive data from the previous screen
export default function StockingFormScreen({ route, navigation }) {
  
  // 2. Extract the pondId passed from PondDetailScreen
  const { pondId } = route.params || {}; 

  const [fryType, setFryType] = useState('Tilapia');
  const [quantity, setQuantity] = useState('');
  // Default to today's date
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); 

  const handleSave = async () => {
    if (!pondId || !quantity) {
      Alert.alert("Error", "Please enter quantity.");
      return;
    }

    const payload = {
      pond_id: parseInt(pondId),
      stocking_date: date,
      fry_type: fryType,
      fry_quantity: parseInt(quantity)
    };

    const online = await isOnline();

    if (online) {
        // --- ONLINE MODE ---
        try {
          await client.post('/api/stocking/', payload);
          Alert.alert("Success", "Stocking Log Saved!", [
            { text: "OK", onPress: () => navigation.goBack() } // Go back to Dashboard
          ]);
        } catch (error) {
          console.error(error);
          Alert.alert("Error", "Could not save log.");
        }
    } else {
        // --- OFFLINE MODE ---
        try {
            await queueAction('/api/stocking/', payload);
            Alert.alert("Saved Offline ☁️", "Data will sync when internet returns.", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (e) {
            Alert.alert("Error", "Could not save offline.");
        }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.header}>Add Stocking</Text>
      </View>

      {/* FORM FIELDS */}
      <Text style={styles.label}>Target Pond ID:</Text>
      {/* Locked Input (User cannot change ID) */}
      <TextInput 
        style={[styles.input, styles.disabledInput]} 
        value={String(pondId || "Unknown")} 
        editable={false} 
      />

      <Text style={styles.label}>Date (YYYY-MM-DD):</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} />

      <Text style={styles.label}>Fry Type:</Text>
      <TextInput style={styles.input} value={fryType} onChangeText={setFryType} />

      <Text style={styles.label}>Quantity (pcs):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 5000" 
        keyboardType="numeric" 
        value={quantity} 
        onChangeText={setQuantity} 
      />

      <View style={styles.btnContainer}>
        <Button title="Save Record" onPress={handleSave} color="#007AFF"/>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 50, backgroundColor: '#f9f9f9', flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginLeft: 10 },
  label: { fontSize: 16, marginBottom: 5, marginTop: 15, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, fontSize: 16, backgroundColor: '#fff' },
  disabledInput: { backgroundColor: '#e0e0e0', color: '#666' },
  btnContainer: { marginTop: 40 }
});