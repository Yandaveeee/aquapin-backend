import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import client from '../api/client';

const screenWidth = Dimensions.get("window").width;

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const response = await client.get('/api/analytics/summary');
      setData(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchAnalytics().then(() => setRefreshing(false));
  }, []);

  if (!data) return <View style={styles.center}><Text>Loading Analytics...</Text></View>;

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
                ₱{data.total_revenue.toLocaleString()}
            </Text>
        </View>
        <View style={[styles.card, {backgroundColor: '#E3F2FD'}]}>
            <Text style={styles.cardLabel}>Total Harvest</Text>
            <Text style={[styles.cardValue, {color: '#1976D2'}]}>
                {data.total_kg} kg
            </Text>
        </View>
      </View>

      {/* CHART */}
      <Text style={styles.chartTitle}>Revenue Trend (Last 5 Harvests)</Text>
      
      {data.chart.data.length > 0 ? (
        <LineChart
            data={{
            labels: data.chart.labels,
            datasets: [{ data: data.chart.data }]
            }}
            width={screenWidth - 40} 
            height={220}
            yAxisLabel="₱"
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
          <Text style={{textAlign: 'center', marginTop: 20}}>No harvest data yet to show chart.</Text>
      )}

      <Text style={styles.hint}>* Pull down to refresh data</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  
  kpiContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  card: { width: '48%', padding: 20, borderRadius: 10, alignItems: 'center' },
  cardLabel: { fontSize: 14, color: '#555', marginBottom: 5 },
  cardValue: { fontSize: 18, fontWeight: 'bold' },

  chartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  chart: { marginVertical: 8, borderRadius: 16 },
  hint: { textAlign: 'center', marginTop: 20, color: '#aaa' }
});