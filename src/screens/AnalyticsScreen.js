import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Dimensions, Alert, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import client from '../api/client';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { getSmartData } from '../api/offline';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const screenWidth = Dimensions.get("window").width;

export default function AnalyticsScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("Farmer"); 
  const [lastSynced, setLastSynced] = useState(null);
  const [error, setError] = useState(null); // NEW: Error state
  const [dateRange, setDateRange] = useState('year'); // NEW: Date range filter

  const loadProfile = async () => {
    try {
      const json = await AsyncStorage.getItem('USER_PROFILE');
      if (json) {
        const profile = JSON.parse(json);
        if (profile.name) setUserName(profile.name);
      }
    } catch (e) {
      console.log("Error loading profile:", e);
    }
  };

  const fetchAnalytics = async () => {
    setError(null); // NEW: Clear previous errors
    try {
      // Use Smart Data to cache the analytics result
      const result = await getSmartData('ANALYTICS_CACHE', () => client.get('/api/analytics/summary'));
      if (result) {
        setData(result);
        setLastSynced(new Date());
      } else {
        // NEW: Handle null result
        setError("No data returned from server");
      }
    } catch (error) {
      console.error("Analytics Error:", error);
      setError(error.message || "Failed to load analytics"); // NEW: Set error message
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
      loadProfile(); 
    }, [])
  );

  const onRefresh = useCallback(async () => { // NEW: Made async
    setRefreshing(true);
    try {
      await fetchAnalytics();
    } finally {
      setRefreshing(false); // NEW: Ensure it stops even on error
    }
  }, []);

  // Calculate Derived Metrics safely
  const lossRate = useMemo(() => {
    if (!data) return "0.0";
    const harvest = parseFloat(data.total_kg || 0);
    const loss = parseFloat(data.total_loss_kg || 0);
    const total = harvest + loss;
    if (total === 0) return "0.0";
    return ((loss / total) * 100).toFixed(1);
  }, [data]);

  // NEW: Format sync time with useMemo for performance
  const formattedSyncTime = useMemo(() => {
    return lastSynced?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }, [lastSynced]);

  // NEW: Check if data is empty (no revenue/harvest recorded)
  const isEmptyData = useMemo(() => {
    if (!data) return true;
    return (!data.total_revenue || data.total_revenue === 0) && 
           (!data.total_kg || data.total_kg === 0);
  }, [data]);

  // Export Functionality
  const handleExport = async () => {
    if (!data) return Alert.alert("No Data", "Nothing to export.");
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #1565C0; }
              .metric { margin: 10px 0; }
              .metric strong { color: #333; }
            </style>
          </head>
          <body>
            <h1>Farm Analytics Report</h1>
            <p><strong>Generated for:</strong> ${userName}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <hr/>
            <h3>Performance Summary</h3>
            <div class="metric"><strong>Revenue:</strong> ₱${data.total_revenue?.toLocaleString() || 0}</div>
            <div class="metric"><strong>Harvest:</strong> ${data.total_kg || 0} kg</div>
            <div class="metric"><strong>Loss Rate:</strong> ${lossRate}%</div>
            <div class="metric"><strong>Weight Lost:</strong> ${data.total_loss_kg || 0} kg</div>
            <h3>System Recommendation</h3>
            <p>${data.system_recommendation || "N/A"}</p>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      console.error("Export error:", e);
      Alert.alert("Error", "Could not generate report. Please check if sharing is available.");
    }
  };

  // Loading State
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          Connecting to AquaPin Cloud...
        </Text>
      </View>
    );
  }

  // NEW: Error State
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>⚠️ Connection Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          onPress={fetchAnalytics} 
          style={styles.retryBtn}
          accessibilityLabel="Retry loading analytics"
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // NEW: Empty State (when data exists but is empty)
  if (isEmptyData) {
    return (
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateIcon}>📊</Text>
          <Text style={styles.emptyStateTitle}>No Data Yet</Text>
          <Text style={styles.emptyStateText}>
            Start recording harvests to see your analytics and insights
          </Text>
        </View>
      </ScrollView>
    );
  }

  // No data available (offline)
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.offlineText}>No data available (Offline).</Text>
        <TouchableOpacity onPress={fetchAnalytics} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Tap to Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header with Export & Timestamp */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{userName} 👋</Text>
          {lastSynced && (
            <Text style={styles.syncTime}>
              Updated: {formattedSyncTime}
            </Text>
          )}
        </View>
        <TouchableOpacity 
          onPress={handleExport} 
          style={styles.exportBtn}
          accessibilityLabel="Export analytics report"
          accessibilityHint="Generates and shares a PDF report"
        >
          <Text style={styles.exportBtnText}>📤 Share</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiContainer}>
        <View style={[styles.card, styles.revenueCard]}>
          <Text style={styles.cardLabel}>Total Revenue</Text>
          <Text style={[styles.cardValue, styles.revenueValue]}>
            ₱{data.total_revenue?.toLocaleString() || 0}
          </Text>
          {/* NEW: You can add trend indicator here if backend provides it */}
        </View>
        <View style={[styles.card, styles.harvestCard]}>
          <Text style={styles.cardLabel}>Total Harvest</Text>
          <Text style={[styles.cardValue, styles.harvestValue]}>
            {data.total_kg || 0} kg
          </Text>
        </View>
      </View>

      <View style={styles.kpiContainer}>
        <View style={[styles.card, styles.lossRateCard]}>
          <Text style={styles.cardLabel}>Loss Rate</Text>
          <Text style={[
            styles.cardValue, 
            {color: parseFloat(lossRate) > 10 ? '#D32F2F' : '#E65100'}
          ]}>
            {lossRate}%
          </Text>
        </View>
        <View style={[styles.card, styles.lossCard]}>
          <Text style={styles.cardLabel}>Weight Lost</Text>
          <Text style={[styles.cardValue, styles.lossValue]}>
            {data.total_loss_kg || 0} kg
          </Text>
        </View>
      </View>

      {/* System Recommendation Box */}
      <View style={styles.alertBox}>
        <Text style={styles.alertTitle}>⚠️ System Recommendation</Text>
        <Text style={styles.alertText}>
          {data.system_recommendation || "No data for analysis."}
        </Text>
      </View>

      {/* NEW: Date Range Selector (optional - implement backend filtering) */}
      <View style={styles.dateRangeContainer}>
        <Text style={styles.chartTitle}>Harvest Trends</Text>
        <View style={styles.dateRangeSelector}>
          {['Month', 'Quarter', 'Year'].map(range => (
            <TouchableOpacity 
              key={range}
              onPress={() => setDateRange(range.toLowerCase())}
              style={[
                styles.rangeBtn, 
                dateRange === range.toLowerCase() && styles.rangeBtnActive
              ]}
            >
              <Text style={[
                styles.rangeBtnText,
                dateRange === range.toLowerCase() && styles.rangeBtnTextActive
              ]}>
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Chart */}
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
          onDataPointClick={({ value, index }) => {
            const month = data.yearly_chart.labels[index];
            Alert.alert("Harvest Details", `${month}: ${value} kg harvested`);
          }}
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
          <Text style={styles.noDataText}>📈 No harvest records found for chart.</Text>
          <Text style={styles.noDataSubtext}>Data will appear here once you log harvests</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    paddingTop: 50, 
    backgroundColor: '#fff' 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20 
  },
  loadingText: {
    marginTop: 15, 
    fontSize: 16, 
    color: '#555', 
    fontWeight: 'bold'
  },
  // NEW: Error styles
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 10
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    elevation: 2
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
  offlineText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20
  },
  // NEW: Empty state styles
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40
  },
  // Header styles
  header: {
    marginBottom: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center'
  },
  welcomeText: {
    fontSize: 16, 
    color: '#666'
  },
  userName: {
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#1565C0'
  },
  syncTime: {
    fontSize: 10, 
    color: '#aaa', 
    marginTop: 2
  },
  exportBtn: { 
    backgroundColor: '#E3F2FD', 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 8,
    elevation: 1
  },
  exportBtnText: { 
    color: '#1976D2', 
    fontWeight: 'bold', 
    fontSize: 13 
  },
  // KPI Cards
  kpiContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 15 
  },
  card: { 
    width: '48%', 
    padding: 15, 
    borderRadius: 12, 
    alignItems: 'center', 
    elevation: 2 
  },
  revenueCard: { backgroundColor: '#E8F5E9' },
  harvestCard: { backgroundColor: '#E3F2FD' },
  lossRateCard: { backgroundColor: '#FFF3E0' },
  lossCard: { backgroundColor: '#FFEBEE' },
  cardLabel: { 
    fontSize: 13, 
    color: '#555', 
    marginBottom: 5 
  },
  cardValue: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  revenueValue: { color: 'green' },
  harvestValue: { color: '#1976D2' },
  lossValue: { color: '#D32F2F' },
  // Alert Box
  alertBox: { 
    backgroundColor: '#FFF3E0', 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 20, 
    borderLeftWidth: 5, 
    borderLeftColor: '#FF9800' 
  },
  alertTitle: { 
    color: '#E65100', 
    fontWeight: 'bold', 
    marginBottom: 5 
  },
  alertText: { 
    color: '#BF360C',
    lineHeight: 20
  },
  // NEW: Date range selector
  dateRangeContainer: {
    marginBottom: 15
  },
  dateRangeSelector: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10
  },
  rangeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5'
  },
  rangeBtnActive: {
    backgroundColor: '#1565C0'
  },
  rangeBtnText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500'
  },
  rangeBtnTextActive: {
    color: '#fff',
    fontWeight: 'bold'
  },
  // Chart
  chartTitle: { 
    fontSize: 18, 
    fontWeight: 'bold'
  },
  chart: { 
    marginVertical: 8, 
    borderRadius: 16 
  },
  noDataBox: { 
    height: 120, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f9f9f9', 
    borderRadius: 10,
    marginVertical: 10
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5
  },
  noDataSubtext: {
    fontSize: 12,
    color: '#999'
  }
});