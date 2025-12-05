import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import client from '../api/client';

export default function StockingFormScreen() {
  const [pondId, setPondId] = useState(''); 
  const [fryType, setFryType] = useState('Tilapia');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Default: Today (YYYY-MM-DD)

  const handleSave = async () => {
    // 1. Validation
    if (!pondId || !quantity) {
      Alert.alert("Error", "Please fill in Pond ID and Quantity");
      return;
    }

    try {
      const payload = {
        pond_id: parseInt(pondId),
        stocking_date: date,
        fry_type: fryType,
        fry_quantity: parseInt(quantity)
      };

      // 2. Send to Backend
      const response = await client.post('/api/stocking/', payload);

      // 3. Success
      Alert.alert("Success", "Stocking Log Saved!");
      // Reset form
      setQuantity('');
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not save log. Check Pond ID.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Stocking Record</Text>

      <Text style={styles.label}>Pond ID:</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 1" 
        keyboardType="numeric"
        value={pondId}
        onChangeText={setPondId}
      />

      <Text style={styles.label}>Date (YYYY-MM-DD):</Text>
      <TextInput 
        style={styles.input} 
        value={date}
        onChangeText={setDate}
      />

      <Text style={styles.label}>Fry Type:</Text>
      <TextInput 
        style={styles.input} 
        value={fryType}
        onChangeText={setFryType}
      />

      <Text style={styles.label}>Quantity (pcs):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 5000" 
        keyboardType="numeric"
        value={quantity}
        onChangeText={setQuantity}
      />

      <View style={styles.btnContainer}>
        <Button title="Save Record" onPress={handleSave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 50 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 16, marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, fontSize: 16, backgroundColor: '#fff' },
  btnContainer: { marginTop: 30 }
});