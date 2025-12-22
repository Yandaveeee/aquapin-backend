import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker'; 
import client from '../api/client';
import { isOnline, queueAction, getSmartData } from '../api/offline';

// 1. ADD { route, navigation } TO RECEIVE POND ID
export default function MortalityScreen({ route, navigation }) {
  
  // 2. Extract pondId from the previous screen
  const { pondId } = route.params || {};

  const [activeStockings, setActiveStockings] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState(null);

  // FIX 1: Removed 'setDate' to stop the "value never read" warning
  const [date] = useState(new Date().toISOString().split('T')[0]);
  
  const [qty, setQty] = useState('');
  const [kg, setKg] = useState('');
  const [cause, setCause] = useState('Flood');
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    fetchActiveStockings();
  }, []);

  const fetchActiveStockings = async () => {
    try {
      const data = await getSmartData('ACTIVE_STOCK_CACHE', () => client.get('/api/stocking/active'));
      
      if (data) {
        // --- 3. FILTER LOGIC ---
        let filteredData = data;
        
        // If we opened this screen for a specific pond, hide other ponds' fish
        if (pondId) {
            filteredData = data.filter(item => item.pond_id === parseInt(pondId));
        }

        setActiveStockings(filteredData);
        
        if (filteredData.length > 0) {
          setSelectedStockId(filteredData[0].id);
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not fetch active fish batches.");
    }
  };

  const handleSave = async () => {
    if(!selectedStockId) { Alert.alert("Error", "Please select a fish batch."); return; }
    if(!qty || !kg) { Alert.alert("Missing Info", "Please enter quantity and weight lost."); return; }

    const payload = {
        stocking_id: parseInt(selectedStockId),
        loss_date: date,
        quantity_lost: parseInt(qty),
        weight_lost_kg: parseFloat(kg),
        cause: cause,
        action_taken: "Reported via App"
    };

    const online = await isOnline();

    if (online) {
      try {
        const response = await client.post('/api/mortality/', payload);
        setSuggestion(response.data.solution);
        // Note: We do NOT goBack() here immediately so the user can read the suggestion.
        Alert.alert("Incident Recorded", "See recommendation below.");
        setQty('');
        setKg('');
      } catch (error) {
        console.log(error);
        Alert.alert("Error", "Could not save report.");
      }
    } else {
      try {
        await queueAction('/api/mortality/', payload);
        // FIX 2: Better UX - Go back immediately for offline saves (nothing to read)
        Alert.alert(
            "Saved Offline ⚠️", 
            "Incident reported. Sync when you have internet to get AI suggestions.",
            [{ text: "OK", onPress: () => navigation.goBack() }] 
        );
        setQty('');
        setKg('');
      } catch (e) {
        Alert.alert("Error", "Could not save offline.");
      }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* HEADER WITH BACK BUTTON */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{fontSize: 24, color: '#666'}}>←</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Report Mortality</Text>
      </View>

      {/* POND ID DISPLAY */}
      {pondId && <Text style={styles.subHeader}>Reporting for Pond ID: {pondId}</Text>}

      <Text style={styles.label}>Select Affected Batch:</Text>
      <View style={styles.pickerBox}>
        {activeStockings.length > 0 ? (
            <Picker selectedValue={selectedStockId} onValueChange={(itemValue) => setSelectedStockId(itemValue)}>
                {activeStockings.map((stock) => (
                    <Picker.Item key={stock.id} label={stock.label} value={stock.id} />
                ))}
            </Picker>
        ) : (
            <Text style={{padding: 15, color: 'red', textAlign: 'center'}}>
                {pondId ? "No active fish in this pond." : "No active fish batches found."}
            </Text>
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
      <TextInput style={styles.input} placeholder="e.g. 1000" keyboardType="numeric" value={qty} onChangeText={setQty} />

      <Text style={styles.label}>Est. Weight Lost (kg):</Text>
      <TextInput style={styles.input} placeholder="e.g. 200" keyboardType="numeric" value={kg} onChangeText={setKg} />

      <View style={{marginTop: 20}}>
        <Button title="Report Loss" onPress={handleSave} color="#D32F2F" disabled={activeStockings.length === 0} />
      </View>

      {suggestion && (
        <View style={styles.card}>
            <Text style={{fontWeight:'bold', color: '#D32F2F', marginBottom: 5}}>🤖 System Recommendation:</Text>
            <Text style={{fontSize: 16}}>{suggestion}</Text>
            {/* Added a button to close after reading suggestion */}
            <View style={{marginTop: 15}}>
                <Button title="Done" onPress={() => navigation.goBack()} color="#555" />
            </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#D32F2F', marginLeft: 10 },
  subHeader: { fontSize: 14, color: '#666', marginBottom: 20, marginLeft: 34 },
  label: { marginTop: 10, fontWeight: 'bold', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 10, backgroundColor: 'white' },
  pickerBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 10, backgroundColor: 'white', overflow: 'hidden' },
  card: { marginTop: 30, padding: 20, backgroundColor: '#FFEBEE', borderRadius: 10, borderWidth: 1, borderColor: '#D32F2F' }
});