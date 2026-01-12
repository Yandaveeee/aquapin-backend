import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  TouchableOpacity, Dimensions, RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit'; // Install this

import client from '../api/client';
import { useOfflinePagination } from '../hooks/useOfflinePagination';
import { usePondAnalytics } from '../hooks/usePondAnalytics';
import { exportToCSV } from '../utils/csvExport';

const screenWidth = Dimensions.get("window").width;

export default function HistoryScreen({ route, navigation }) {
  const { pondId } = route.params; 
  const [chartMode, setChartMode] = useState('revenue'); // 'revenue' | 'weight' | 'survival'

  // 1. Use Pagination Hook
  const fetchHistoryPage = useCallback((page, limit) => {
    return client.get(`/api/history/${pondId}?page=${page}&limit=${limit}`);
  }, [pondId]);

  const { 
    data: history, 
    loading, 
    loadingMore, 
    refresh, 
    loadMore 
  } = useOfflinePagination(`HISTORY_${pondId}`, fetchHistoryPage, 10);

  // 2. Use Analytics Hook (Auto-calculates on data change)
  const { summary, charts, csvData } = usePondAnalytics(history);

  // --- RENDER HELPERS ---

  const renderChart = () => {
    if (history.length < 2) return null; // Need at least 2 points for a line chart

    let dataPoints = [];
    let legend = "";
    let color = (opacity = 1) => `rgba(0, 122, 255, ${opacity})`;

    switch (chartMode) {
      case 'revenue':
        dataPoints = charts.revenue;
        legend = "Revenue (₱)";
        color = (opacity = 1) => `rgba(76, 175, 80, ${opacity})`; // Green
        break;
      case 'weight':
        dataPoints = charts.weight;
        legend = "Harvest Weight (kg)";
        color = (opacity = 1) => `rgba(33, 150, 243, ${opacity})`; // Blue
        break;
      case 'survival':
        dataPoints = charts.survival;
        legend = "Survival Rate (%)";
        color = (opacity = 1) => `rgba(255, 152, 0, ${opacity})`; // Orange
        break;
    }

    if (dataPoints.length === 0) return null;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Trend Analysis</Text>
          <View style={styles.chartTabs}>
            <TouchableOpacity onPress={() => setChartMode('revenue')}>
              <Ionicons name="cash" size={20} color={chartMode === 'revenue' ? '#4CAF50' : '#ccc'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setChartMode('weight')}>
              <Ionicons name="scale" size={20} color={chartMode === 'weight' ? '#2196F3' : '#ccc'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setChartMode('survival')}>
              <Ionicons name="heart" size={20} color={chartMode === 'survival' ? '#FF9800' : '#ccc'} />
            </TouchableOpacity>
          </View>
        </View>

        <LineChart
          data={{
            labels: charts.labels,
            datasets: [{ data: dataPoints }]
          }}
          width={screenWidth - 40}
          height={220}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: color,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "4", strokeWidth: "2", stroke: "#ffa726" }
          }}
          bezier // Smooth curves
          style={styles.chartStyle}
        />
        <Text style={styles.chartLegend}>{legend}</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.fishType}>{item.fry_type}</Text>
          <Text style={styles.sizeBadge}>{item.fish_size || "Standard"}</Text> 
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.date}>{item.harvest_date}</Text>
          <Text style={styles.cycleBadge}>
             {/* Simple cycle calc here or rely on pre-calculated fields if available */}
             Harvested
          </Text>
        </View>
      </View>
      
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>Stocked</Text>
          <Text style={styles.value}>{item.quantity_stocked?.toLocaleString()} pcs</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>Harvested</Text>
          <Text style={styles.value}>{item.total_weight_kg?.toLocaleString()} kg</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>Revenue</Text>
          <Text style={[styles.value, {color: 'green'}]}>₱{item.revenue?.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Production History</Text>
        <TouchableOpacity 
          onPress={() => exportToCSV(csvData, `Pond_${pondId}_History`)} 
          style={styles.exportBtn}
        >
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* STATISTICS DASHBOARD */}
      {!loading && history.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{summary.totalHarvests}</Text>
            <Text style={styles.statLabel}>Harvests</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
              ₱{(summary.totalRevenue / 1000).toFixed(0)}k
            </Text>
            <Text style={styles.statLabel}>Total Rev</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{parseInt(summary.totalWeight).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total kg</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{summary.avgSurvival}%</Text>
            <Text style={styles.statLabel}>Avg Survival</Text>
          </View>
        </View>
      )}

      {/* LIST + CHARTS */}
      <FlatList 
        data={history}
        keyExtractor={(item) => (item.stocking_id || item.id).toString()}
        renderItem={renderItem}
        
        // Header is the Chart so it scrolls with list
        ListHeaderComponent={renderChart}
        
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        
        // Pagination Props
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#007AFF" style={{margin: 20}} /> : null
        }
        
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Ionicons name="fish-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No harvest history found.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 20, paddingTop: 50 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  backBtn: { padding: 5 },
  exportBtn: { padding: 5 },

  // Stats
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  statBox: { alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "bold", color: "#333" },
  statLabel: { fontSize: 10, color: "#666", marginTop: 2 },

  // Chart
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    marginBottom: 15,
    elevation: 2
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10
  },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  chartTabs: { flexDirection: 'row', gap: 15 },
  chartStyle: { marginVertical: 8, borderRadius: 16 },
  chartLegend: { textAlign: 'center', fontSize: 12, color: '#666', marginBottom: 5 },

  // Card
  card: { backgroundColor: 'white', padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    paddingBottom: 10,
    marginBottom: 10
  },
  fishType: { fontSize: 18, fontWeight: 'bold', color: '#007AFF' },
  sizeBadge: { 
    fontSize: 12, color: '#555', backgroundColor: '#F0F0F0', 
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, 
    alignSelf: 'flex-start', marginTop: 4 
  },
  date: { color: '#666', fontSize: 12 },
  cycleBadge: { fontSize: 11, color: '#999', marginTop: 2, textAlign: 'right' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  label: { fontSize: 12, color: '#888' },
  value: { fontSize: 14, fontWeight: '600', marginTop: 2 },

  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#888', marginTop: 10 }
});