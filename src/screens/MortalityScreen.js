import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker'; 
import client from '../api/client';

export default function MortalityScreen() {
  // --- NEW: DROPDOWN STATE ---
  const [activeStockings, setActiveStockings] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [qty, setQty] = useState('');
  const [kg, setKg] = useState('');
  const [cause, setCause] = useState('Flood');
  const [suggestion, setSuggestion] = useState(null);

  // 1. Fetch Active Batches on Load
  useEffect(() => {
    fetchActiveStockings();
  }, []);

  const fetchActiveStockings = async () => {
    try {
      // Re-using the same API we built for Harvest!
      const response = await client.get('/api/stocking/active');
      setActiveStockings(response.data);
      
      // Auto-select first item
      if (response.data.length > 0) {
        setSelectedStockId(response.data[0].id);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not fetch active fish batches.");
    }
  };

  const handleSave = async () => {
    if(!selectedStockId) {
        Alert.alert("Error", "Please select a fish batch.");
        return;
    }
    if(!qty || !kg) {
        Alert.alert("Missing Info", "Please enter quantity and weight lost.");
        return;
    }

    try {
      const payload = {
        stocking_id: parseInt(selectedStockId),
        loss_date: date,
        quantity_lost: parseInt(qty),
        weight_lost_kg: parseFloat(kg),
        cause: cause,
        action_taken: "Reported via App"
      };

      const response = await client.post('/api/mortality/', payload);
      
      setSuggestion(response.data.solution);
      Alert.alert("Incident Recorded", "See recommendation below.");
      
      setQty('');
      setKg('');
      
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Could not save report.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>⚠️ Report Incident</Text>
      
      {/* --- NEW: DROPDOWN SELECTION --- */}
      <Text style={styles.label}>Select Affected Batch:</Text>
      <View style={styles.pickerBox}>
        {activeStockings.length > 0 ? (
            <Picker
                selectedValue={selectedStockId}
                onValueChange={(itemValue) => setSelectedStockId(itemValue)}
            >
                {activeStockings.map((stock) => (
                    <Picker.Item 
                        key={stock.id} 
                        label={stock.label} // Shows "Pond 1 - Tilapia..."
                        value={stock.id} 
                    />
                ))}
            </Picker>
        ) : (
            <Text style={{padding: 15, color: 'red'}}>No active fish batches found to report.</Text>
        )}
      </View>

      <Text style={styles.label}>Cause of Loss:</Text>
      <View style={styles.pickerBox}>
        <Picker selectedValue={cause} onValueChange={setCause}>
            <Picker.Item label="Flood / Typhoon" value="Flood" />
            <Picker.Item label="Disease / Fish Kill" value="Disease" />
            <Picker.Item label="Extreme Heat" value="Heat" />
            <Picker.Item label="Theft" value="Theft" />
            <Picker.Item label="Other" value="Unknown" />
        </Picker>
      </View>

      <Text style={styles.label}>Quantity Lost (pcs):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 1000" 
        keyboardType="numeric" 
        value={qty} 
        onChangeText={setQty} 
      />

      <Text style={styles.label}>Est. Weight Lost (kg):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 200" 
        keyboardType="numeric" 
        value={kg} 
        onChangeText={setKg} 
      />

      <View style={{marginTop: 20}}>
        <Button 
            title="Report Loss" 
            onPress={handleSave} 
            color="#D32F2F" 
            disabled={activeStockings.length === 0}
        />
      </View>

      {suggestion && (
        <View style={styles.card}>
            <Text style={{fontWeight:'bold', color: '#D32F2F', marginBottom: 5}}>🤖 System Recommendation:</Text>
            <Text style={{fontSize: 16}}>{suggestion}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 40 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#D32F2F' },
  label: { marginTop: 10, fontWeight: 'bold', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 10, backgroundColor: 'white' },
  pickerBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 10, backgroundColor: 'white', overflow: 'hidden' },
  card: { marginTop: 30, padding: 20, backgroundColor: '#FFEBEE', borderRadius: 10, borderWidth: 1, borderColor: '#D32F2F' }
});