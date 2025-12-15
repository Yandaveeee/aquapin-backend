import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // <--- Dropdown Library
import client from '../api/client';
// 1. IMPORT THE OFFLINE HELPERS
import { isOnline, queueAction, getSmartData } from '../api/offline'; 

export default function HarvestFormScreen() {
  // Lists for the Dropdown
  const [activeStockings, setActiveStockings] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState(null);
  
  // Form Data
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('Standard'); // Default Size
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // 1. Fetch "Active" Stockings (Fish still in water)
  // --- UPDATED: Use Smart Data to work offline ---
  const fetchActiveStockings = async () => {
    try {
      // Use 'ACTIVE_STOCK_CACHE' key to save/load this list
      const data = await getSmartData('ACTIVE_STOCK_CACHE', '/api/stocking/active');
      
      if (data) {
        setActiveStockings(data);
        // Auto-select the first item if available
        if (data.length > 0) {
          setSelectedStockId(data[0].id);
        } else {
          setSelectedStockId(null);
        }
      }
    } catch (error) {
      console.error("Error fetching active stockings:", error);
    }
  };

  // Run this when screen loads
  useEffect(() => {
    fetchActiveStockings();
  }, []);

  const handleSave = async () => {
    // Validation
    if (!selectedStockId) {
      Alert.alert("Error", "No active fish batch selected.");
      return;
    }
    if (!weight) {
      Alert.alert("Error", "Please enter the total weight.");
      return;
    }

    const payload = {
      stocking_id: parseInt(selectedStockId),
      harvest_date: date,
      total_weight_kg: parseFloat(weight),
      market_price_per_kg: parseFloat(price) || 0,
      fish_size: size // <--- Sending the size to backend
    };

    // --- UPDATED: Check Connection First ---
    const online = await isOnline();

    if (online) {
      // --- ONLINE MODE: Normal Behavior ---
      try {
        const response = await client.post('/api/harvest/', payload);

        Alert.alert(
          "✅ Harvest Recorded!", 
          `Profit: ₱${response.data.revenue?.toLocaleString()}\nDays Cultured: ${response.data.days_cultured} days`
        );
        
        // Reset Form & Refresh List
        setWeight('');
        setPrice('');
        fetchActiveStockings(); // <--- Update list so the harvested batch disappears

      } catch (error) {
        console.error(error);
        if (error.response) {
           Alert.alert("Error", JSON.stringify(error.response.data));
        } else {
           Alert.alert("Error", "Network Error");
        }
      }
    } else {
      // --- OFFLINE MODE: Queue It ---
      try {
        await queueAction('/api/harvest/', payload);
        
        Alert.alert(
          "Saved Offline ☁️", 
          "No internet connection. Your harvest has been saved to the device and will be uploaded when you sync."
        );
        
        // Reset Form locally so user can continue working
        setWeight('');
        setPrice('');
      } catch (e) {
        Alert.alert("Error", "Could not save offline data.");
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Harvest Record</Text>

      {/* --- STOCKING ID DROPDOWN --- */}
      <Text style={styles.label}>Select Batch to Harvest:</Text>
      <View style={styles.pickerContainer}>
        {activeStockings.length > 0 ? (
            <Picker
                selectedValue={selectedStockId}
                onValueChange={(itemValue) => setSelectedStockId(itemValue)}
            >
                {activeStockings.map((stock) => (
                    <Picker.Item 
                        key={stock.id} 
                        label={stock.label} // Shows "Pond Name - Fish Type"
                        value={stock.id} 
                    />
                ))}
            </Picker>
        ) : (
            <Text style={{padding: 15, color: 'red'}}>No active fish batches found.</Text>
        )}
      </View>

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

      {/* --- FISH SIZE DROPDOWN --- */}
      <Text style={styles.label}>Fish Size:</Text>
      <View style={styles.pickerContainer}>
        <Picker
            selectedValue={size}
            onValueChange={(itemValue) => setSize(itemValue)}
        >
            <Picker.Item label="Standard (3-4 pcs/kg)" value="Standard" />
            <Picker.Item label="Large (2 pcs/kg)" value="Large" />
            <Picker.Item label="Fingerling (Early Harvest)" value="Fingerling" />
        </Picker>
      </View>

      <View style={styles.btnContainer}>
        <Button 
            title="Save Harvest" 
            onPress={handleSave} 
            color="green" 
            disabled={activeStockings.length === 0} // Disable if nothing to harvest
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 50 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 16, marginBottom: 5, marginTop: 10, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, fontSize: 16, backgroundColor: '#fff' },
  // Style for the Picker Box
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 5, backgroundColor: '#fff', overflow: 'hidden' },
  btnContainer: { marginTop: 30, marginBottom: 50 }
});