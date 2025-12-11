import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import client from '../api/client';

const screenWidth = Dimensions.get("window").width;

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const response = await client.get('/api/analytics/summary');
      setData(response.data);
    } catch (error) {
      console.error("Analytics Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics().then(() => setRefreshing(false));
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text>Could not load data. Check connection.</Text>
        <Text style={{marginTop: 10, color: 'blue'}} onPress={fetchAnalytics}>Tap to Retry</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.header}>Farm Dashboard</Text>

      {/* KPI CARDS */}
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

      {/* RISK RECOMMENDATION */}
      <View style={styles.alertBox}>
        <Text style={styles.alertTitle}>⚠️ System Recommendation</Text>
        <Text style={styles.alertText}>
            {data.system_recommendation || "No data for analysis."}
        </Text>
      </View>

      {/* CHART */}
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
  header: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
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