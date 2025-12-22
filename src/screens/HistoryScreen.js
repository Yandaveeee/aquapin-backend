import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { getSmartData } from '../api/offline';

export default function HistoryScreen({ route, navigation }) {
  const { pondId } = route.params; 
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      // Use Smart Data to cache history so it works offline too
      const data = await getSmartData(`HISTORY_${pondId}`, () => client.get(`/api/history/${pondId}`));
      if (data) {
        setHistory(data);
      }
    } catch (error) {
      console.log("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {/* LEFT SIDE: Fish Name & Size */}
        <View>
            <Text style={styles.fishType}>{item.fry_type}</Text>
            {/* ✅ NEW: Display Fish Size */}
            <Text style={styles.sizeBadge}>
              {item.fish_size || "Standard"}
            </Text> 
        </View>

        {/* RIGHT SIDE: Date */}
        <Text style={styles.date}>{item.harvest_date}</Text>
      </View>
      
      <View style={styles.row}>
        <View style={styles.stat}>
            <Text style={styles.label}>Stocked</Text>
            <Text style={styles.value}>{item.quantity_stocked.toLocaleString()} pcs</Text>
        </View>
        <View style={styles.stat}>
            <Text style={styles.label}>Harvested</Text>
            <Text style={styles.value}>{item.total_weight_kg.toLocaleString()} kg</Text>
        </View>
        <View style={styles.stat}>
            <Text style={styles.label}>Revenue</Text>
            <Text style={[styles.value, {color: 'green'}]}>₱{item.revenue.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Production History</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={{marginTop: 50}} />
      ) : (
        <FlatList 
            data={history}
            keyExtractor={(item) => item.stocking_id.toString()}
            renderItem={renderItem}
            ListEmptyComponent={
                <Text style={styles.emptyText}>No completed harvests found for this pond.</Text>
            }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 50 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', marginLeft: 15, color: '#333' },
  
  card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  
  // Updated Header to support stacking name + size
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', // Align to top
    marginBottom: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    paddingBottom: 10 
  },
  
  fishType: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  
  // ✅ NEW STYLE FOR THE BADGE
  sizeBadge: { 
    fontSize: 12, 
    color: '#555', 
    backgroundColor: '#F0F0F0', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6, 
    alignSelf: 'flex-start',
    marginTop: 4,
    overflow: 'hidden' 
  },

  date: { color: '#666', fontSize: 12, marginTop: 4 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  label: { fontSize: 12, color: '#888' },
  value: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  
  emptyText: { textAlign: 'center', marginTop: 50, color: '#888', fontSize: 16 }
});