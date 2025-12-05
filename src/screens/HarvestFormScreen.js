import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import client from '../api/client';

export default function HarvestFormScreen() {
  const [stockingId, setStockingId] = useState('');
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = async () => {
    if (!stockingId || !weight) {
      Alert.alert("Error", "Please fill required fields");
      return;
    }

    try {
      const payload = {
        stocking_id: parseInt(stockingId),
        harvest_date: date,
        total_weight_kg: parseFloat(weight),
        market_price_per_kg: parseFloat(price) || 0
      };

      const response = await client.post('/api/harvest/', payload);

      Alert.alert(
        "Harvest Recorded!", 
        `Profit: ₱${response.data.revenue}\nDays Cultured: ${response.data.days_cultured} days`
      );
      
      setWeight('');
      setPrice('');
    } catch (error) {
      console.error(error);
      if (error.response) {
         Alert.alert("Error", error.response.data.detail);
      } else {
         Alert.alert("Error", "Network Error");
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Harvest Record</Text>

      <Text style={styles.label}>Stocking ID (Batch #):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 1" 
        keyboardType="numeric"
        value={stockingId}
        onChangeText={setStockingId}
      />

      <Text style={styles.label}>Harvest Date:</Text>
      <TextInput 
        style={styles.input} 
        value={date}
        onChangeText={setDate}
      />

      <Text style={styles.label}>Total Weight (kg):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 1200" 
        keyboardType="numeric"
        value={weight}
        onChangeText={setWeight}
      />

      <Text style={styles.label}>Price per Kg (₱):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 150" 
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />

      <View style={styles.btnContainer}>
        <Button title="Save Harvest" onPress={handleSave} color="green" />
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