import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import client from '../api/client';
import { getSmartData } from '../api/offline';

export default function PondDetailScreen({ route, navigation }) {
  const { pond: initialPondData } = route.params || {};
  const [pond, setPond] = useState(initialPondData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!pond) {
    return (
      <View style={styles.center}>
        <Text>Error: No pond data loaded.</Text>
      </View>
    );
  }

  // Auto-refresh whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const refreshPondData = async () => {
        if (!initialPondData?.id) return;
        
        setIsRefreshing(true);
        try {
          const updatedPond = await getSmartData(
            `POND_${initialPondData.id}`, 
            () => client.get(`/api/ponds/${initialPondData.id}`)
          );
          
          if (updatedPond) {
            setPond(updatedPond);
            console.log('Pond data refreshed:', updatedPond);
          }
        } catch (error) {
          console.log("Could not refresh pond details", error);
        } finally {
          setIsRefreshing(false);
        }
      };

      refreshPondData();
    }, [initialPondData?.id])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="water" size={40} color="#007AFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{pond.name}</Text>
          <Text style={styles.subtitle}>
             ID: {pond.id} • {pond.area_sqm ? `${pond.area_sqm} sqm` : "Area Calculating..."}
          </Text>
          <Text style={styles.location}>{pond.location_desc || "Location not pinned"}</Text>
        </View>
      </View>

      {/* STATUS CARD */}
      <View style={styles.statusCard}>
        <Text style={styles.cardLabel}>Current Status</Text>
        <Text style={styles.statusText}>
          {pond.last_stocked_at 
            ? `🐟 Active: ${pond.current_fish_type || 'Fish'}\nStarted: ${pond.last_stocked_at}` 
            : "⚪ Empty / Ready to Stock"}
        </Text>
        {isRefreshing && (
          <Text style={styles.refreshingText}>Refreshing...</Text>
        )}
      </View>

      {/* ACTION BUTTONS */}
      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.grid}>
        
        <TouchableOpacity 
          style={[styles.btn, styles.btnBlue]} 
          onPress={() => navigation.navigate("StockingForm", { pondId: pond.id })}
        >
          <Ionicons name="fish" size={32} color="white" />
          <Text style={styles.btnText}>Add Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, styles.btnRed]} 
          onPress={() => navigation.navigate("MortalityForm", { pondId: pond.id })}
        >
          <Ionicons name="alert-circle" size={32} color="white" />
          <Text style={styles.btnText}>Report Loss</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, styles.btnGreen]} 
          onPress={() => navigation.navigate("HarvestForm", { pondId: pond.id })}
        >
          <Ionicons name="cash" size={32} color="white" />
          <Text style={styles.btnText}>Harvest</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, styles.btnGray]} 
          onPress={() => navigation.navigate("History", { pondId: pond.id })}
        >
          <Ionicons name="time" size={32} color="white" />
          <Text style={styles.btnText}>History</Text>
        </TouchableOpacity>

      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  iconBox: { 
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#E1F0FF', 
    justifyContent: 'center', alignItems: 'center', marginRight: 15 
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  location: { fontSize: 12, color: '#888', marginTop: 2, fontStyle: 'italic' },

  statusCard: { 
    backgroundColor: 'white', padding: 20, borderRadius: 12, marginBottom: 30,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 
  },
  cardLabel: { fontSize: 12, textTransform: 'uppercase', color: '#888', marginBottom: 5 },
  statusText: { fontSize: 18, fontWeight: '600', color: '#007AFF' },
  refreshingText: { fontSize: 12, color: '#999', marginTop: 5, fontStyle: 'italic' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  
  btn: { 
    width: '48%', aspectRatio: 1.1, borderRadius: 16, 
    justifyContent: 'center', alignItems: 'center', marginBottom: 15,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 
  },
  btnBlue: { backgroundColor: '#007AFF' },
  btnRed: { backgroundColor: '#FF3B30' },
  btnGreen: { backgroundColor: '#34C759' },
  btnGray: { backgroundColor: '#8E8E93' },
  
  btnText: { color: 'white', marginTop: 8, fontSize: 15, fontWeight: '600' }
});