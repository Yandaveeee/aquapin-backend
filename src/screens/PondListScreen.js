import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';

export default function PondListScreen() {
  const [ponds, setPonds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPonds = async () => {
    try {
      const response = await client.get('/api/ponds/');
      setPonds(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchPonds();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchPonds().then(() => setRefreshing(false));
  }, []);

  // Helper to determine status color based on fish type
  const getStatusColor = (name) => {
    if (name.includes("(None)")) return '#9E9E9E'; // Grey for Empty
    return '#4CAF50'; // Green for Active
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={[styles.statusStrip, { backgroundColor: getStatusColor(item.name) }]} />
      
      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <Text style={styles.pondName}>{item.name}</Text>
          <Text style={styles.pondId}>ID: {item.id}</Text>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="resize" size={16} color="#666" />
            <Text style={styles.detailText}>{item.area_sqm} sqm</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Ponds Directory</Text>
      
      {ponds.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No ponds found.</Text>
          <Text style={styles.subText}>Go to the Map tab to add one.</Text>
        </View>
      ) : (
        <FlatList
          data={ponds}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 50 },
  header: { fontSize: 24, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 15 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 2, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 }
  },
  statusStrip: { width: 6, height: '100%' },
  cardContent: { flex: 1, padding: 15 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pondName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  pondId: { fontSize: 12, color: '#999', backgroundColor: '#f0f0f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  
  detailsRow: { flexDirection: 'row', gap: 15 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { color: '#666', fontSize: 14 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#888' },
  subText: { fontSize: 14, color: '#aaa', marginTop: 5 }
});