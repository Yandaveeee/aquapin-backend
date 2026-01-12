import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { Picker } from '@react-native-picker/picker'; 
import client from '../api/client';
import { isOnline, queueAction, getSmartData, invalidateCache } from '../api/offline';

export default function HarvestFormScreen({ route, navigation }) {
  
  const { pondId } = route.params || {};

  const [activeStockings, setActiveStockings] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState(null);
  
  const [weight, setWeight] = useState('');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('Standard'); 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // 🔥 NEW: State for loading indicator
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🔥 NEW: Real-time Revenue Calculation
  const estimatedRevenue = (parseFloat(weight) || 0) * (parseFloat(price) || 0);

  const fetchActiveStockings = async () => {
    try {
      const data = await getSmartData('ACTIVE_STOCK_CACHE', () => client.get('/api/stocking/active'));
      
      if (Array.isArray(data)) {
        let filteredData = data;
        if (pondId) {
            filteredData = data.filter(item => item.pond_id === parseInt(pondId));
        }

        setActiveStockings(filteredData);
        
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

  // 🔥 NEW: Wrapper to handle confirmation and validation safely
  const handlePreCheck = () => {
    Keyboard.dismiss();

    // 1. Validation Guards
    if (!selectedStockId) { Alert.alert("Error", "No active fish batch selected."); return; }
    
    const w = parseFloat(weight);
    const p = parseFloat(price);

    if (!weight || isNaN(w) || w <= 0) { Alert.alert("Validation Error", "Please enter a valid total weight (kg)."); return; }
    if (!price || isNaN(p) || p < 0) { Alert.alert("Validation Error", "Please enter a valid price per kg."); return; }

    // 2. Confirmation Dialog
    Alert.alert(
        "Confirm Harvest",
        `Records indicate:\n\nWeight: ${w} kg\nPrice: ₱${p}/kg\nTotal: ₱${estimatedRevenue.toLocaleString()}\n\nIs this correct?`,
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Yes, Save it", 
                onPress: async () => {
                    setIsSubmitting(true);
                    await handleSave(); 
                    setIsSubmitting(false);
                }
            }
        ]
    );
  };

  const handleSave = async () => {
    // Existing logic is preserved exactly as requested
    const payload = {
      stocking_id: parseInt(selectedStockId),
      harvest_date: date,
      total_weight_kg: parseFloat(weight),
      market_price_per_kg: parseFloat(price) || 0,
      fish_size: size
    };

    const online = await isOnline();
    
    const isTempId = payload.stocking_id < 0;

    try {
      if (online && !isTempId) {
        const response = await client.post('/api/harvest/', payload);
        
        // 🔥 CRITICAL: After harvest, fetch fresh pond data to show remaining stock
        try {
          const freshPondData = await client.get(`/api/ponds/${pondId}`);
          console.log(`✅ Fresh pond data after harvest: total_fish=${freshPondData.data.total_fish}, species=${freshPondData.data.current_fish_type}`);
          
          // Invalidate all pond-related caches
          await invalidateCache([
            `POND_v2_${pondId}`,
            `POND_${pondId}`,
            'PONDS_LIST',
            'ACTIVE_STOCK_CACHE'
          ]);
          
          Alert.alert("✅ Harvest Recorded!", `Profit: ₱${response.data.revenue?.toLocaleString()}`, [{
            text: "OK",
            onPress: () => navigation.goBack({ params: { pond: freshPondData.data, forceRefresh: true } })
          }]);
        } catch (fetchError) {
          console.error("Error fetching fresh pond data:", fetchError);
          // Fall back to just invalidating cache
          await invalidateCache([
            `POND_v2_${pondId}`,
            `POND_${pondId}`,
            'PONDS_LIST',
            'ACTIVE_STOCK_CACHE'
          ]);
          Alert.alert("✅ Harvest Recorded!", `Profit: ₱${response.data.revenue?.toLocaleString()}`, [{
            text: "OK",
            onPress: () => navigation.goBack({ params: { forceRefresh: true } })
          }]);
        }
      } else {
        await queueAction('/api/harvest/', payload);
        
        // 🔥 Also invalidate cache in offline mode so sync will refresh the UI
        await invalidateCache([
          `POND_v2_${pondId}`,
          `POND_${pondId}`,
          'PONDS_LIST',
          'ACTIVE_STOCK_CACHE'
        ]);
        
        Alert.alert("Saved Offline ☁️", "Harvest saved. Sync later!", [{
          text: "OK",
          onPress: () => navigation.goBack({ params: { forceRefresh: true } })
        }]);
      }
    } catch (error) {
      console.error('Harvest save error:', error);
      Alert.alert("Error", "Server Error. Try again.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

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
            // 🔥 UPDATED: Better empty state
            <View style={{padding: 20, alignItems: 'center'}}>
               <Text style={{color: '#666', textAlign: 'center', marginBottom: 5}}>
                  {pondId ? "No active fish in this pond." : "No active fish batches found."}
               </Text>
               <Text style={{fontSize: 12, color: '#999'}}>(Try syncing if data is missing)</Text>
            </View>
        )}
      </View>

      <Text style={styles.label}>Harvest Date:</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
      
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

      {/* 🔥 NEW: Revenue Preview Card */}
      {parseFloat(weight) > 0 && parseFloat(price) > 0 && (
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>Estimated Revenue</Text>
            <Text style={styles.revenueValue}>
                ₱{estimatedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
      )}
      
      <Text style={styles.label}>Fish Size:</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={size} onValueChange={setSize}>
            <Picker.Item label="Standard (3-4 pcs/kg)" value="Standard" />
            <Picker.Item label="Large (2 pcs/kg)" value="Large" />
            <Picker.Item label="Fingerling (Early Harvest)" value="Fingerling" />
        </Picker>
      </View>
      
      <View style={styles.btnContainer}>
        {/* 🔥 UPDATED: Use handlePreCheck instead of handleSave directly, and show loading */}
        {isSubmitting ? (
            <ActivityIndicator size="large" color="green" />
        ) : (
            <Button 
                title="Save Harvest & Close Cycle" 
                onPress={handlePreCheck} 
                color="green" 
                disabled={activeStockings.length === 0} 
            />
        )}
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
  btnContainer: { marginTop: 30, marginBottom: 50 },
  // 🔥 NEW Styles
  revenueCard: { backgroundColor: '#E8F5E9', padding: 15, borderRadius: 8, marginTop: 15, borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  revenueLabel: { color: '#388E3C', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  revenueValue: { fontSize: 22, fontWeight: 'bold', color: '#1B5E20', marginTop: 2 }
});