import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Button, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  TouchableOpacity, 
  Keyboard,
  ActivityIndicator 
} from 'react-native';
import { Picker } from '@react-native-picker/picker'; 
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { isOnline, queueAction, getSmartData } from '../api/offline';

export default function MortalityScreen({ route, navigation }) {
  
  // Extract pondId from navigation params
  const { pondId } = route.params || {};

  const [activeStockings, setActiveStockings] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState(null);
  
  // State for form inputs
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [qty, setQty] = useState('');
  const [kg, setKg] = useState('');
  const [cause, setCause] = useState('Flood');
  const [suggestion, setSuggestion] = useState(null);
  
  // UI State
  const [loading, setLoading] = useState(false);

  // Use useFocusEffect so data re-checks when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchActiveStockings();
    }, [pondId])
  );

  const fetchActiveStockings = async () => {
    try {
      const data = await getSmartData('ACTIVE_STOCK_CACHE', () => client.get('/api/stocking/active'));
      
      if (data && Array.isArray(data)) {
        let filteredData = data;
        
        // Robust filtering: compare as strings to avoid type mismatch (e.g. "5" vs 5)
        if (pondId) {
            filteredData = data.filter(item => String(item.pond_id) === String(pondId));
        }

        setActiveStockings(filteredData);
        
        // Auto-select the first option if nothing is selected yet
        if (filteredData.length > 0 && !selectedStockId) {
          setSelectedStockId(filteredData[0].id);
        }
      }
    } catch (error) {
      console.error(error);
      // Silent fail is better for UX here; the list will just be empty
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss(); // Close keyboard so user sees alerts/results

    // 1. Strict Validation
    if (!selectedStockId) { 
        Alert.alert("Error", "Please select a fish batch."); 
        return; 
    }
    
    const qtyNum = parseInt(qty);
    const kgNum = parseFloat(kg);

    // Validate numbers (must be positive and not NaN)
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) {
        Alert.alert("Invalid Input", "Quantity must be a valid positive number."); 
        return; 
    }
    if (!kg || isNaN(kgNum) || kgNum <= 0) {
        Alert.alert("Invalid Input", "Weight must be a valid positive number."); 
        return; 
    }

    setLoading(true); // Lock UI

    const payload = {
        stocking_id: parseInt(selectedStockId),
        loss_date: date,
        quantity_lost: qtyNum,
        weight_lost_kg: kgNum,
        cause: cause,
        action_taken: "Reported via App"
    };

    const online = await isOnline();

    if (online) {
      try {
        const response = await client.post('/api/mortality/', payload);
        setSuggestion(response.data.solution);
        Alert.alert("Incident Recorded", "See AI recommendation below.");
        
        // Clear inputs on success
        setQty('');
        setKg('');
      } catch (error) {
        console.log(error);
        Alert.alert("Error", "Could not save report. Please try again.");
      }
    } else {
      try {
        await queueAction('/api/mortality/', payload);
        // Offline success: Go back immediately as we can't show AI suggestions
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
    
    setLoading(false); // Unlock UI
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      
      {/* HEADER WITH BACK BUTTON */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 5}}>
            <Text style={{fontSize: 24, color: '#666'}}>←</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Report Mortality</Text>
      </View>

      {/* POND ID DISPLAY */}
      {pondId && <Text style={styles.subHeader}>Reporting for Pond ID: {pondId}</Text>}

      <Text style={styles.label}>Select Affected Batch:</Text>
      {activeStockings.length > 0 ? (
          <View style={styles.pickerBox}>
            <Picker selectedValue={selectedStockId} onValueChange={(itemValue) => setSelectedStockId(itemValue)}>
                {activeStockings.map((stock) => (
                    <Picker.Item key={stock.id} label={stock.label} value={stock.id} />
                ))}
            </Picker>
          </View>
      ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
                {pondId ? "No active fish in this pond." : "No active fish batches found."}
            </Text>
          </View>
      )}

      {/* READ ONLY DATE DISPLAY */}
      <Text style={styles.label}>Date of Loss:</Text>
      <View style={[styles.input, styles.readOnlyInput]}>
        <Text style={{color: '#555'}}>{date} (Today)</Text>
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
        {loading ? (
            <ActivityIndicator size="large" color="#D32F2F" />
        ) : (
            <Button 
                title="Report Loss" 
                onPress={handleSave} 
                color="#D32F2F" 
                disabled={activeStockings.length === 0} 
            />
        )}
      </View>

      {suggestion && (
        <View style={styles.card}>
            <Text style={{fontWeight:'bold', color: '#D32F2F', marginBottom: 5}}>🤖 System Recommendation:</Text>
            <Text style={{fontSize: 16, lineHeight: 22}}>{suggestion}</Text>
            
            <View style={{marginTop: 15}}>
                <Button title="Done" onPress={() => navigation.goBack()} color="#555" />
            </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 40, paddingBottom: 50 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#D32F2F', marginLeft: 10 },
  subHeader: { fontSize: 14, color: '#666', marginBottom: 20, marginLeft: 34 },
  label: { marginTop: 10, fontWeight: 'bold', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 10, backgroundColor: 'white' },
  readOnlyInput: { backgroundColor: '#f0f0f0', justifyContent: 'center' },
  pickerBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, marginBottom: 10, backgroundColor: 'white', overflow: 'hidden' },
  card: { marginTop: 30, padding: 20, backgroundColor: '#FFEBEE', borderRadius: 10, borderWidth: 1, borderColor: '#D32F2F' },
  emptyState: { padding: 15, backgroundColor: '#ffebee', borderRadius: 5, marginBottom: 10, borderWidth: 1, borderColor: '#ef9a9a' },
  emptyText: { color: '#c62828', textAlign: 'center' }
});