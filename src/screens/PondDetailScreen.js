import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import client from "../api/client";
import { getSmartData, invalidateCache } from "../api/offline";
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const isSmallScreen = screenHeight < 700;

export default function PondDetailScreen({ route, navigation }) {
  const { pond: initialPondData } = route.params || {};
  const [pond, setPond] = useState(initialPondData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const requestIdRef = useRef(0);
  const latestPondDataRef = useRef(initialPondData);

  // Calculate pond metrics - memoized for performance
  const metrics = useMemo(() => {
    if (!pond) return null;

    // ACTIVE LOGIC: If we have fish types listed, it IS active, even if dates are weird.
    const hasCurrentFish =
      pond.current_fish_type && pond.current_fish_type !== "";
    const hasStockingDate =
      pond.last_stocked_at !== null && pond.last_stocked_at !== undefined;

    // Calculate days active if possible
    const daysActive = hasStockingDate
      ? Math.floor(
          (new Date() - new Date(pond.last_stocked_at)) / (1000 * 60 * 60 * 24)
        )
      : 0;

    // IMPORTANT: Prioritize the existence of fish type string
    const isActive = hasCurrentFish || (hasStockingDate && daysActive >= 0);

    return {
      isActive,
      daysActive,
      stockingAge: isActive && hasStockingDate ? `${daysActive} days` : "N/A",
      statusColor: isActive ? "#34C759" : "#8E8E93",
      statusIcon: isActive ? "checkmark-circle" : "ellipse-outline",
    };
  }, [pond?.current_fish_type, pond?.last_stocked_at]);

  // Add a ref to track if we should ignore the next server fetch
  const skipNextRefreshRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const pondId = pond?.id || initialPondData?.id;

      if (!pondId) {
        console.warn("⚠️ No pond ID available");
        return;
      }

      // ============ PART 1: Check for direct operation results ============
      // When returning from StockingForm, HarvestForm, etc., they pass the updated pond
      if (route.params?.pond) {
        const directPond = route.params.pond;

        // Verify this update is for the current pond
        if (String(directPond.id) === String(pondId)) {
          console.log("⚡ Applying operation result directly");
          console.log(
            `   Fish: ${directPond.total_fish}, Species: ${directPond.current_fish_type}`
          );

          // Apply the update immediately without waiting for server
          latestPondDataRef.current = {
            ...directPond,
            _local_updated_at: Date.now(),
            _source: directPond._source || "local_cache",
          };
          setPond(latestPondDataRef.current);
          setLastRefreshed(new Date());

          // Clear the params to prevent re-application on future focus
          navigation.setParams({
            pond: undefined,
            skipNextRefresh: undefined,
            forceUpdate: undefined,
          });

          // If skipNextRefresh is set, skip the network call
          if (route.params.skipNextRefresh) {
            console.log("🚫 Skipping network refresh (local data trusted)");
            skipNextRefreshRef.current = true;
            return;
          }
        }
      }

      // ============ PART 2: Normal focus behavior - refresh from server ============
      // But respect the skip flag if set
      if (skipNextRefreshRef.current) {
        console.log("⏭️ Skipping refresh cycle (flag was set)");
        skipNextRefreshRef.current = false;
      } else {
        // Normal refresh - use smart caching
        console.log("🔄 Refreshing pond data from server (smart cache)");
        refreshPondData(false); // Don't force, use cache if recent
      }
    }, [pond?.id, initialPondData?.id, refreshPondData])
  );

  const formatDate = useCallback((dateString) => {
    if (!dateString) return "Not available";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const formatRefreshTime = useMemo(() => {
    if (!lastRefreshed) return "";
    return lastRefreshed.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastRefreshed]);

  const refreshPondData = useCallback(
    async (forceRefresh = false) => {
      setIsRefreshing(true);
      setError(null);
      setIsOffline(false);

      const pondId = pond?.id || initialPondData?.id;
      if (!pondId) {
        setError("No pond ID available");
        setIsRefreshing(false);
        return;
      }

      const currentRequestId = ++requestIdRef.current;

      try {
        const cacheKey = `POND_v2_${pondId}`;

        // Smart cache checking
        const cachedData = await AsyncStorage.getItem(cacheKey);
        let shouldForceRefresh = forceRefresh;

        if (cachedData && !forceRefresh) {
          const parsed = JSON.parse(cachedData);
          const cacheAge = Date.now() - (parsed._local_updated_at || 0);

          // IMPROVED: Different thresholds based on data source
          let threshold;
          if (parsed._source === "local_cache") {
            // Local cache: refresh sooner (3s) to sync with server
            threshold = 3000;
          } else if (parsed._source === "server") {
            // Server cache: more stable (10s)
            threshold = 10000;
          } else {
            // Unknown source: default to safe threshold (5s)
            threshold = 5000;
          }

          if (cacheAge < threshold) {
            console.log(
              `📦 Cache is fresh (${Math.round(cacheAge / 1000)}s, threshold ${Math.round(threshold / 1000)}s)`
            );
            shouldForceRefresh = false;
          } else {
            console.log(
              `🔄 Cache is stale (${Math.round(cacheAge / 1000)}s > ${Math.round(threshold / 1000)}s), fetching fresh`
            );
            shouldForceRefresh = true;
          }
        }

        // Fetch from server or cache
        const updatedPond = await getSmartData(
          cacheKey,
          () => client.get(`/api/ponds/${pondId}`),
          { forceRefresh: shouldForceRefresh }
        );

        // Only update if this is the latest request (prevents race conditions)
        if (currentRequestId === requestIdRef.current && updatedPond) {
          // Normalize response
          const normalizedPond = {
            id: updatedPond.id,
            name: updatedPond.name || "Unnamed Pond",
            location_desc: updatedPond.location_desc || "",
            area_sqm: updatedPond.area_sqm || 0,
            current_fish_type: updatedPond.current_fish_type || "",
            total_fish: updatedPond.total_fish || 0,
            last_stocked_at: updatedPond.last_stocked_at || null,
            ...updatedPond,
            _local_updated_at: Date.now(),
            _source: "server",
          };

          // Only update state if this is newer than what we have
          const currentAge = latestPondDataRef.current?._local_updated_at || 0;
          const newAge = normalizedPond._local_updated_at || 0;

          if (newAge >= currentAge || !latestPondDataRef.current) {
            console.log(
              `✅ Updating pond state (${shouldForceRefresh ? "fresh" : "cached"} data)`
            );
            console.log(
              `   Total Fish: ${normalizedPond.total_fish}, Species: ${normalizedPond.current_fish_type}`
            );
            latestPondDataRef.current = normalizedPond;
            setPond(normalizedPond);
            setLastRefreshed(new Date());
          } else {
            console.log(`⏭️ Keeping current data (already newer)`);
          }
        }
      } catch (error) {
        console.error("❌ Refresh error:", error);
        const isNetworkError =
          error.message?.includes("Network") ||
          error.message?.includes("offline") ||
          !navigator.onLine;

        if (isNetworkError) {
          setIsOffline(true);
          setError("Using cached data - offline mode");
        } else {
          setError(error.message || "Failed to refresh pond data");
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [pond?.id, initialPondData?.id]
  );

  // Fetch active batches for this pond
  const fetchActiveBatches = useCallback(
    async (pondId) => {
      if (!pondId) return;
      
      try {
        setBatchesLoading(true);
        const response = await client.get(`/api/stocking/pond/${pondId}/batches`);
        setBatches(response.data || []);
        console.log(`📦 Fetched ${response.data?.length || 0} active batches`);
      } catch (error) {
        console.warn("⚠️ Failed to fetch batches:", error.message);
        setBatches([]); // Fallback to empty list
      } finally {
        setBatchesLoading(false);
      }
    },
    []
  );

  // Fetch batches when pond data updates
  useEffect(() => {
    const pondId = pond?.id || initialPondData?.id;
    if (pondId) {
      fetchActiveBatches(pondId);
    }
  }, [pond?.id, initialPondData?.id, fetchActiveBatches]);

  const handleActionPress = useCallback(
    (action, navigateTo, params) => {
      if (action === "Report Loss") {
        Alert.alert(
          "Report Mortality",
          "Record fish loss or mortality for this pond?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Continue",
              onPress: () => navigation.navigate(navigateTo, params),
            },
          ]
        );
      } else {
        navigation.navigate(navigateTo, params);
      }
    },
    [navigation]
  );

  const handleShowPondInfo = useCallback(() => {
    Alert.alert(
      pond.name,
      `Location: ${pond.location_desc || "Not set"}\n` +
        `Area: ${pond.area_sqm ? `${pond.area_sqm} sqm` : "Not calculated"}\n` +
        `Total Stock: ${
          pond.total_fish ? pond.total_fish.toLocaleString() : "0"
        }\n` +
        `Status: ${metrics.isActive ? "Active" : "Empty"}\n` +
        `Current Fish: ${pond.current_fish_type || "None"}`,
      [{ text: "OK" }]
    );
  }, [pond, metrics]);

  // Handler functions for buttons
  const handleAddStock = useCallback(
    () => navigation.navigate("StockingForm", { pondId: pond.id }),
    [navigation, pond?.id]
  );
  const handleReportLoss = useCallback(
    () =>
      handleActionPress("Report Loss", "MortalityForm", { pondId: pond.id }),
    [handleActionPress, pond?.id]
  );
  const handleHarvest = useCallback(
    () => navigation.navigate("HarvestForm", { pondId: pond.id }),
    [navigation, pond?.id]
  );
  const handleHistory = useCallback(
    () => navigation.navigate("History", { pondId: pond.id }),
    [navigation, pond?.id]
  );

  // Memoized UI sections
  const statusCardContent = useMemo(() => {
    if (!pond || !metrics) return null;

    return (
      <View
        style={[styles.statusCard, { borderLeftColor: metrics.statusColor }]}
      >
        <View style={styles.statusHeader}>
          <View style={styles.statusLabelRow}>
            <Text style={styles.cardLabel}>Current Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${metrics.statusColor}20` },
              ]}
            >
              <Ionicons
                name={metrics.statusIcon}
                size={14}
                color={metrics.statusColor}
              />
              <Text
                style={[styles.statusBadgeText, { color: metrics.statusColor }]}
              >
                {metrics.isActive ? "Active" : "Empty"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statusDetails}>
          {metrics.isActive ? (
            <>
              <View style={styles.statusRow}>
                <Ionicons name="fish" size={20} color="#007AFF" />
                <Text style={styles.statusText}>
                  {pond.current_fish_type || "Fish"}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Ionicons name="apps" size={20} color="#666" />
                <Text style={[styles.statusSubtext, { marginLeft: 0 }]}>
                  {pond.total_fish ? pond.total_fish.toLocaleString() : "0"}{" "}
                  total stock
                </Text>
              </View>
              {pond.last_stocked_at && (
                <Text style={styles.statusSubtext}>
                  Last Stocked: {formatDate(pond.last_stocked_at)}
                </Text>
              )}
            </>
          ) : (
            <View style={styles.emptyStatus}>
              <Text style={styles.emptyStatusText}>
                Pond is ready for stocking
              </Text>
              <TouchableOpacity
                style={styles.quickStockBtn}
                onPress={handleAddStock}
              >
                <Text style={styles.quickStockText}>Stock Now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }, [pond, metrics, formatDate, handleAddStock]);

  const metricsCards = useMemo(() => {
    if (!pond || !metrics?.isActive) return null;

    return (
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Ionicons name="calendar-outline" size={24} color="#007AFF" />
          <Text style={styles.metricValue}>
            {metrics.daysActive > 0 ? metrics.daysActive : "—"}
          </Text>
          <Text style={styles.metricLabel}>Days Active</Text>
        </View>

        <View style={styles.metricCard}>
          <Ionicons name="apps-outline" size={24} color="#FF9500" />
          <Text style={styles.metricValue}>
            {pond.total_fish
              ? pond.total_fish > 1000
                ? (pond.total_fish / 1000).toFixed(1) + "k"
                : pond.total_fish
              : "0"}
          </Text>
          <Text style={styles.metricLabel}>Count</Text>
        </View>

        <View style={styles.metricCard}>
          <Ionicons name="fish-outline" size={24} color="#34C759" />
          <Text style={styles.metricValue} numberOfLines={1}>
            {pond.current_fish_type
              ? pond.current_fish_type.split(",")[0]
              : "N/A"}
          </Text>
          <Text style={styles.metricLabel}>Species</Text>
        </View>
      </View>
    );
  }, [pond, metrics]);

  if (!pond) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={60} color="#FF3B30" />
        <Text style={styles.errorTitle}>No Pond Data</Text>
        <Text style={styles.errorText}>Could not load pond information.</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const content = (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Ionicons name="water" size={36} color="#007AFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{pond.name}</Text>
              <TouchableOpacity onPress={handleShowPondInfo}>
                <Ionicons
                  name="information-circle-outline"
                  size={28}
                  color="#007AFF"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>
              ID: {pond.id} •{" "}
              {pond.area_sqm
                ? `${pond.area_sqm.toLocaleString()} sqm`
                : "Area pending..."}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#888" />
              <Text style={styles.location}>
                {pond.location_desc || "Location not pinned"}
              </Text>
            </View>
          </View>
        </View>
        {lastRefreshed && (
          <Text style={styles.lastUpdated}>
            {isOffline ? "📡 Offline • " : ""}Updated: {formatRefreshTime}
          </Text>
        )}
      </View>

      {isRefreshing && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Refreshing...</Text>
        </View>
      )}

      {error && !isRefreshing && (
        <View style={[styles.errorBanner, isOffline && styles.offlineBanner]}>
          <Ionicons
            name={isOffline ? "cloud-offline" : "warning"}
            size={20}
            color={isOffline ? "#FF9500" : "#D32F2F"}
          />
          <Text
            style={[styles.errorBannerText, isOffline && styles.offlineText]}
          >
            {error}
          </Text>
          {!isOffline && (
            <TouchableOpacity onPress={refreshPondData}>
              <Text style={styles.retryLink}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {statusCardContent}
      {metricsCards}

      {/* ACTIVE BATCHES SECTION */}
      {batches && batches.length > 0 && (
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Batches</Text>
            <Text style={styles.sectionSubtitle}>{batches.length} {batches.length === 1 ? 'batch' : 'batches'} in pond</Text>
          </View>
          
          {batches.map((batch) => {
            const statusColor = 
              batch.status === "Ready" ? "#34C759" :
              batch.status === "Growing" ? "#FF9500" :
              "#007AFF";
            
            return (
              <View key={batch.id} style={styles.batchCard}>
                <View style={styles.batchHeader}>
                  <View style={styles.batchInfo}>
                    <Text style={styles.batchSpecies}>{batch.fry_type}</Text>
                    <Text style={styles.batchQuantity}>{batch.fry_quantity?.toLocaleString()} pcs</Text>
                  </View>
                  <View style={[styles.batchStatusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.batchStatusText}>{batch.status}</Text>
                  </View>
                </View>
                
                <View style={styles.batchDetails}>
                  <View style={styles.batchDetailItem}>
                    <Text style={styles.batchDetailLabel}>Stocked:</Text>
                    <Text style={styles.batchDetailValue}>
                      {new Date(batch.stocking_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.batchDetailItem}>
                    <Text style={styles.batchDetailLabel}>Age:</Text>
                    <Text style={styles.batchDetailValue}>{batch.days_in_pond} days</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Text style={styles.sectionSubtitle}>Manage pond operations</Text>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.btn, styles.btnBlue]}
          onPress={handleAddStock}
          activeOpacity={0.8}
        >
          <View style={styles.btnIconCircle}>
            <Ionicons name="add-circle" size={28} color="white" />
          </View>
          <Text style={styles.btnText}>Add Stock</Text>
          <Text style={styles.btnSubtext}>Record new fry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnRed]}
          onPress={handleReportLoss}
          activeOpacity={0.8}
        >
          <View style={styles.btnIconCircle}>
            <Ionicons name="alert-circle" size={28} color="white" />
          </View>
          <Text style={styles.btnText}>Report Loss</Text>
          <Text style={styles.btnSubtext}>Log mortality</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnGreen]}
          onPress={handleHarvest}
          activeOpacity={0.8}
        >
          <View style={styles.btnIconCircle}>
            <Ionicons name="basket" size={28} color="white" />
          </View>
          <Text style={styles.btnText}>Harvest</Text>
          <Text style={styles.btnSubtext}>Record sales</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnGray]}
          onPress={handleHistory}
          activeOpacity={0.8}
        >
          <View style={styles.btnIconCircle}>
            <Ionicons name="time" size={28} color="white" />
          </View>
          <Text style={styles.btnText}>History</Text>
          <Text style={styles.btnSubtext}>View records</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>💡 Tips</Text>
        <Text style={styles.infoText}>
          • Pull down to refresh pond data{"\n"}• Tap the info icon for complete
          details
        </Text>
      </View>
    </>
  );

  if (isSmallScreen) {
    return (
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshPondData}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <View style={styles.containerNoScroll}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshPondData}
          />
        }
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {content}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  containerNoScroll: { flex: 1, backgroundColor: "#F2F2F7" },
  container: {
    flexGrow: 1,
    padding: isSmallScreen ? 16 : 20,
    paddingTop: isSmallScreen ? 50 : 60,
    backgroundColor: "#F2F2F7",
    paddingBottom: isSmallScreen ? 20 : 30,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F2F2F7",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  retryBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  headerContainer: { marginBottom: isSmallScreen ? 14 : 18 },
  header: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: isSmallScreen ? 60 : 70,
    height: isSmallScreen ? 60 : 70,
    borderRadius: isSmallScreen ? 30 : 35,
    backgroundColor: "#E1F0FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    borderWidth: 2,
    borderColor: "#007AFF20",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontSize: isSmallScreen ? 22 : 26,
    fontWeight: "bold",
    color: "#000",
    flex: 1,
  },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2, fontWeight: "500" },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  location: { fontSize: 12, color: "#888", fontStyle: "italic", marginLeft: 4 },
  lastUpdated: {
    fontSize: 11,
    color: "#999",
    marginTop: 8,
    textAlign: "right",
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F4FF",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#007AFF",
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE5E5",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#FF3B30",
  },
  offlineBanner: { backgroundColor: "#FFF4E5", borderLeftColor: "#FF9500" },
  errorBannerText: { flex: 1, marginLeft: 10, fontSize: 13, color: "#D32F2F" },
  offlineText: { color: "#B36200" },
  retryLink: { color: "#007AFF", fontWeight: "600", fontSize: 13 },
  statusCard: {
    backgroundColor: "white",
    padding: isSmallScreen ? 14 : 16,
    borderRadius: 14,
    marginBottom: isSmallScreen ? 12 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderLeftWidth: 4,
  },
  statusHeader: { marginBottom: 12 },
  statusLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#888",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: { fontSize: 12, fontWeight: "600" },
  statusDetails: { gap: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusText: { fontSize: 17, fontWeight: "700", color: "#007AFF" },
  statusSubtext: { fontSize: 13, color: "#666", marginLeft: 30 },
  emptyStatus: { alignItems: "center", paddingVertical: 12 },
  emptyStatusText: {
    fontSize: 15,
    color: "#999",
    marginTop: 8,
    marginBottom: 12,
  },
  quickStockBtn: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  quickStockText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: isSmallScreen ? 12 : 16,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "white",
    padding: isSmallScreen ? 10 : 12,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  metricValue: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 6,
    marginBottom: 2,
  },
  metricLabel: { fontSize: 10, color: "#888", textAlign: "center" },
  sectionHeader: { marginBottom: isSmallScreen ? 10 : 12 },
  sectionTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: "bold",
    color: "#333",
  },
  sectionSubtitle: { fontSize: 12, color: "#888", marginTop: 2 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: isSmallScreen ? 12 : 16,
  },
  btn: {
    width: "48%",
    minHeight: isSmallScreen ? 110 : 130,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: isSmallScreen ? 10 : 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    padding: 12,
  },
  btnBlue: { backgroundColor: "#007AFF" },
  btnRed: { backgroundColor: "#FF3B30" },
  btnGreen: { backgroundColor: "#34C759" },
  btnGray: { backgroundColor: "#8E8E93" },
  btnIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  btnText: { color: "white", marginTop: 4, fontSize: 15, fontWeight: "700" },
  btnSubtext: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 2 },
  infoSection: {
    backgroundColor: "#FFF9E6",
    padding: isSmallScreen ? 12 : 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#FFD700",
    marginBottom: isSmallScreen ? 12 : 16,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#8B7500",
    marginBottom: 6,
  },
  infoText: { fontSize: 12, color: "#6B5500", lineHeight: 18 },
  
  // BATCH STYLES
  batchCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  batchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  batchInfo: {
    flex: 1,
  },
  batchSpecies: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  batchQuantity: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  batchStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  batchStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  batchDetails: {
    flexDirection: "row",
    gap: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  batchDetailItem: {
    flex: 1,
  },
  batchDetailLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "500",
    marginBottom: 3,
  },
  batchDetailValue: {
    fontSize: 13,
    color: "#333",
    fontWeight: "600",
  },
});
