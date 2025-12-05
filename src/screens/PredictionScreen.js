import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import client from '../api/client';

export default function PredictionScreen() {
  const [area, setArea] = useState('');
  const [fry, setFry] = useState('');
  const [days, setDays] = useState('120'); // Default 4 months
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handlePredict = async () => {
    if (!area || !fry || !days) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    setLoading(true);
    setResult(null); // Hide previous result

    try {
      const payload = {
        fry_quantity: parseInt(fry),
        days_cultured: parseInt(days),
        area_sqm: parseFloat(area)
      };

      const response = await client.post('/api/predict/', payload);
      setResult(response.data);
      
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Prediction failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>🌱 AI Yield Predictor</Text>
      <Text style={styles.subHeader}>Plan your harvest before you start.</Text>

      <Text style={styles.label}>Pond Area (sqm):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 500" 
        keyboardType="numeric"
        value={area}
        onChangeText={setArea}
      />

      <Text style={styles.label}>Fry Quantity (pcs):</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 5000" 
        keyboardType="numeric"
        value={fry}
        onChangeText={setFry}
      />

      <Text style={styles.label}>Days to Culture:</Text>
      <TextInput 
        style={styles.input} 
        placeholder="e.g. 120" 
        keyboardType="numeric"
        value={days}
        onChangeText={setDays}
      />

      <View style={styles.btnContainer}>
        {loading ? (
            <ActivityIndicator size="large" color="#007AFF" />
        ) : (
            <Button title="Analyze Potential Yield" onPress={handlePredict} />
        )}
      </View>

      {/* RESULT CARD */}
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Prediction Results</Text>
          
          <View style={styles.row}>
            <Text>Est. Harvest Weight:</Text>
            <Text style={styles.value}>{result.predicted_yield_kg} kg</Text>
          </View>

          <View style={styles.row}>
            <Text>Est. Gross Revenue:</Text>
            <Text style={[styles.value, {color: 'green'}]}>
                ₱{result.estimated_revenue.toLocaleString()}
            </Text>
          </View>
          
          <Text style={styles.disclaimer}>
            *Based on historical data. Actual results may vary due to weather or disease.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 50 },
  header: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#007AFF' },
  subHeader: { textAlign: 'center', color: '#666', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, fontSize: 16, backgroundColor: '#fff' },
  btnContainer: { marginTop: 20 },
  
  resultCard: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBDEFB'
  },
  resultTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  value: { fontWeight: 'bold', fontSize: 18 },
  disclaimer: { marginTop: 15, fontSize: 12, fontStyle: 'italic', color: '#666' }
});