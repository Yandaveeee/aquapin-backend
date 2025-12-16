import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import client from '../api/client';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // <--- NEW IMPORT
import { getSmartData } from '../api/offline';

const screenWidth = Dimensions.get("window").width;

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("Farmer"); // <--- Default name

  // 1. Function to Load Profile Name
  const loadProfile = async () => {
    try {
      const json = await AsyncStorage.getItem('USER_PROFILE');
      if (json) {
        const profile = JSON.parse(json);
        if (profile.name) {
          setUserName(profile.name);
        }
      }
    } catch (e) {
      console.log("Error loading profile:", e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Use Smart Data to cache the analytics result
      const result = await getSmartData('ANALYTICS_CACHE', () => client.get('/api/analytics/summary'));
      if (result) {
          setData(result);
      }
    } catch (error) {
      console.error("Analytics Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
      loadProfile(); // <--- Load name every time screen opens
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics().then(() => setRefreshing(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{marginTop: 15, fontSize: 16, color: '#555', fontWeight: 'bold'}}>
          Connecting to AquaPin Cloud...
        </Text>
        <Text style={{marginTop: 5, fontSize: 12, color: '#999'}}>
          (This may take a moment if waking up)
        </Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text>No data available (Offline).</Text>
        <Text style={{marginTop: 10, color: 'blue'}} onPress={fetchAnalytics}>Tap to Retry</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* --- NEW PERSONALIZED HEADER --- */}
      <View style={{marginBottom: 20}}>
         <Text style={{fontSize: 16, color: '#666'}}>Welcome back,</Text>
         <Text style={{fontSize: 28, fontWeight: 'bold', color: '#1565C0'}}>{userName} 👋</Text>
      </View>

      {/* --- EXISTING KPI CARDS --- */}
      <View style={styles.kpiContainer}>
        <View style={[styles.card, {backgroundColor: '#E8F5E9'}]}>
            <Text style={styles.cardLabel}>Total Revenue</Text>
            <Text style={[styles.cardValue, {color: 'green'}]}>
                ₱{data.total_revenue?.toLocaleString() || 0}
            </Text>
        </View>
        <View style={[styles.card, {backgroundColor: '#E3F2FD'}]}>
            <Text style={styles.cardLabel}>Total Harvest</Text>
            <Text style={[styles.cardValue, {color: '#1976D2'}]}>
                {data.total_kg || 0} kg
            </Text>
        </View>
      </View>

      <View style={styles.kpiContainer}>
        <View style={[styles.card, {backgroundColor: '#FFEBEE'}]}>
            <Text style={styles.cardLabel}>Total Lost Qty</Text>
            <Text style={[styles.cardValue, {color: '#D32F2F'}]}>
                {data.total_loss_qty || 0} pcs
            </Text>
        </View>
        <View style={[styles.card, {backgroundColor: '#FFEBEE'}]}>
            <Text style={styles.cardLabel}>Weight Lost</Text>
            <Text style={[styles.cardValue, {color: '#D32F2F'}]}>
                {data.total_loss_kg || 0} kg
            </Text>
        </View>
      </View>

      {/* --- EXISTING RECOMMENDATION BOX --- */}
      <View style={styles.alertBox}>
        <Text style={styles.alertTitle}>⚠️ System Recommendation</Text>
        <Text style={styles.alertText}>
            {data.system_recommendation || "No data for analysis."}
        </Text>
      </View>

      <Text style={styles.chartTitle}>Yearly Harvest Trends</Text>
      
      {data.yearly_chart && data.yearly_chart.data && data.yearly_chart.data.length > 0 ? (
        <LineChart
            data={{
                labels: data.yearly_chart.labels,
                datasets: [{ data: data.yearly_chart.data }]
            }}
            width={screenWidth - 40} 
            height={220}
            yAxisLabel=""
            yAxisSuffix="kg"
            chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0, 
                color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: { r: "6", strokeWidth: "2", stroke: "#007AFF" }
            }}
            bezier
            style={styles.chart}
        />
      ) : (
          <View style={styles.noDataBox}>
            <Text>No harvest records found for chart.</Text>
          </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Header styles updated in-line, but you can add them here if you prefer
  kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  card: { width: '48%', padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2 },
  cardLabel: { fontSize: 13, color: '#555', marginBottom: 5 },
  cardValue: { fontSize: 16, fontWeight: 'bold' },
  alertBox: { backgroundColor: '#FFF3E0', padding: 15, borderRadius: 10, marginBottom: 20, borderLeftWidth: 5, borderLeftColor: '#FF9800' },
  alertTitle: { color: '#E65100', fontWeight: 'bold', marginBottom: 5 },
  alertText: { color: '#BF360C' },
  chartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  chart: { marginVertical: 8, borderRadius: 16 },
  noDataBox: { height: 100, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 10 }
});