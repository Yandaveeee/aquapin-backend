import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker'; 
import client from '../api/client';
import { isOnline, queueAction, getSmartData } from '../api/offline';

// 1. ACCEPT PROPS (route, navigation)
export default function HarvestFormScreen({ route, navigation }) {
  
  // 2. GET POND ID FROM NAVIGATION
  const { pondId } = route.params || {};

  const [activeStockings, setActiveStockings] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState(null);
  
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('Standard'); 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchActiveStockings = async () => {
    try {
      const data = await getSmartData('ACTIVE_STOCK_CACHE', () => client.get('/api/stocking/active'));
      
      if (Array.isArray(data)) {
        // 3. FILTER LOGIC (CRITICAL FIX)
        // Only show fish belonging to the current pond
        let filteredData = data;
        if (pondId) {
            filteredData = data.filter(item => item.pond_id === parseInt(pondId));
        }

        setActiveStockings(filteredData);
        
        // Auto-select the first option
        if (filteredData.length > 0) {
          setSelectedStockId(filteredData[0].id);
        }
      } else {
        setActiveStockings([]); 
      }
    } catch (e) {
      console.log("Error loading stockings:", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchActiveStockings();
    }, [])
  );

  const handleSave = async () => {
    if (!selectedStockId) { Alert.alert("Error", "No active fish batch selected."); return; }
    if (!weight) { Alert.alert("Error", "Please enter the total weight."); return; }

    const payload = {
      stocking_id: parseInt(selectedStockId),
      harvest_date: date,
      total_weight_kg: parseFloat(weight),
      market_price_per_kg: parseFloat(price) || 0,
      fish_size: size
    };

    const online = await isOnline();

    if (online) {
        try {
            const response = await client.post('/api/harvest/', payload);
            Alert.alert(
              "✅ Harvest Recorded!", 
              `Profit: ₱${response.data.revenue?.toLocaleString()}`,
              [
                { text: "OK", onPress: () => navigation.goBack() } // Go back to refresh dashboard
              ]
            );
        } catch (error) {
            console.log(error);
            Alert.alert("Error", "Server Error. Try again.");
        }
    } else {
        await queueAction('/api/harvest/', payload);
        Alert.alert("Saved Offline ☁️", "Harvest saved. Sync later!", [
            { text: "OK", onPress: () => navigation.goBack() }
        ]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* CONFIRMATION OF POND ID */}
      {pondId && <Text style={styles.subHeader}>Harvesting Pond ID: {pondId}</Text>}
      
      <Text style={styles.label}>Select Batch to Harvest:</Text>
      <View style={styles.pickerContainer}>
        {activeStockings.length > 0 ? (
            <Picker selectedValue={selectedStockId} onValueChange={(itemValue) => setSelectedStockId(itemValue)}>
                {activeStockings.map((stock) => (
                    <Picker.Item key={stock.id} label={stock.label} value={stock.id} />
                ))}
            </Picker>
        ) : (
            <Text style={{padding: 15, color: '#666', textAlign: 'center'}}>
               {pondId ? "No active fish in this pond." : "No active fish batches found."}
            </Text>
        )}
      </View>

      <Text style={styles.label}>Harvest Date:</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} />
      
      <Text style={styles.label}>Total Weight (kg):</Text>
      <TextInput style={styles.input} placeholder="e.g. 1200" keyboardType="numeric" value={weight} onChangeText={setWeight} />
      
      <Text style={styles.label}>Price per Kg (₱):</Text>
      <TextInput style={styles.input} placeholder="e.g. 150" keyboardType="numeric" value={price} onChangeText={setPrice} />
      
      <Text style={styles.label}>Fish Size:</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={size} onValueChange={setSize}>
            <Picker.Item label="Standard (3-4 pcs/kg)" value="Standard" />
            <Picker.Item label="Large (2 pcs/kg)" value="Large" />
            <Picker.Item label="Fingerling (Early Harvest)" value="Fingerling" />
        </Picker>
      </View>
      
      <View style={styles.btnContainer}>
        <Button title="Save Harvest & Close Cycle" onPress={handleSave} color="green" disabled={activeStockings.length === 0} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  header: { fontSize: 24, fontWeight: 'bold', color: 'green', marginLeft: 10 },
  subHeader: { fontSize: 14, color: '#666', marginBottom: 20, marginLeft: 34 },
  label: { fontSize: 16, marginBottom: 5, marginTop: 10, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, fontSize: 16, backgroundColor: '#fff' },
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 5, backgroundColor: '#fff', overflow: 'hidden' },
  btnContainer: { marginTop: 30, marginBottom: 50 }
});