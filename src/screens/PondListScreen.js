import React, { useState, useCallback } from "react";
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Alert, Image, Modal, ScrollView, ActivityIndicator, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from "../api/client";
import { getSmartData, syncData, clearQueue, cacheData } from "../api/offline";

// --- HELPER LOGIC (Extracted) ---
const getPondStatus = (pond) => {
  if (!pond) return {};
  const stockDate = pond.last_stocked_at ? new Date(pond.last_stocked_at) : new Date();
  const diffTime = Math.abs(new Date() - stockDate);
  const daysActive = pond.last_stocked_at ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
  
  const isInactive = pond.name.includes("(None)");
  const isReady = !isInactive && daysActive >= 120; 

  return {
    daysActive,
    isReady,
    isInactive,
    statusColor: isInactive ? "#9E9E9E" : isReady ? "#FF5252" : "#2196F3",
    badgeText: isReady ? "READY" : `${daysActive} DAYS`,
    badgeBg: isReady ? "#FFEBEE" : "#E3F2FD",
    badgeColor: isReady ? "#D32F2F" : "#1976D2"
  };
};

// --- MEMOIZED COMPONENT (Performance Win) ---
const PondCard = React.memo(({ item, onPress }) => {
  const { statusColor, badgeBg, badgeColor, badgeText, isInactive } = getPondStatus(item);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.7}>
      <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.headerRow}>
          <Text style={styles.pondName}>{item.name}</Text>
          {!isInactive && (
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={{ color: badgeColor, fontSize: 10, fontWeight: "bold" }}>
                {badgeText}
              </Text>
            </View>
          )}
        </View>
        {item.image_base64 && (
          <Image
            source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }}
            style={styles.pondImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.locationRow}>
          <Ionicons name="location-sharp" size={14} color="#D32F2F" />
          <Text style={styles.locationText}>{item.location_desc || "No Address"}</Text>
        </View>
        <View style={styles.detailsRow}>
          <Text style={styles.pondId}>ID: {item.id}</Text>
          <Text style={styles.detailText}>{item.area_sqm} sqm</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// --- NEW: Stats Component ---
const StatsCard = ({ ponds }) => {
  const totalPonds = ponds.length;
  const activePonds = ponds.filter(p => !p.name.includes("(None)")).length;
  const readyToHarvest = ponds.filter(p => {
    const { isReady, isInactive } = getPondStatus(p);
    return !isInactive && isReady;
  }).length;
  const totalArea = ponds.reduce((sum, p) => sum + (p.area_sqm || 0), 0);

  return (
    <View style={styles.statsContainer}>
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{totalPonds}</Text>
        <Text style={styles.statLabel}>Total Ponds</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{activePonds}</Text>
        <Text style={styles.statLabel}>Active</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={[styles.statNumber, { color: '#FF5252' }]}>{readyToHarvest}</Text>
        <Text style={styles.statLabel}>Ready</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{totalArea}</Text>
        <Text style={styles.statLabel}>sqm</Text>
      </View>
    </View>
  );
};

export default function PondListScreen() {
  const [ponds, setPonds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPond, setSelectedPond] = useState(null);
  
  // --- NEW: Search & Filter States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all, ready, active, inactive
  const [sortBy, setSortBy] = useState("name"); // name, age, size
  const [showFilters, setShowFilters] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // --- DATA LOADING ---
  const fetchAllData = async () => {
    try {
      // 1. Get Ponds (Smart: Cache first, then Network)
      const pondsData = await getSmartData("PONDS_LIST", () => client.get("/api/ponds/"));
      if (pondsData) {
        setPonds(pondsData);
        setLastSyncTime(new Date());
      }

      // 2. Background fetch for dropdowns
      try {
        const stockRes = await client.get('/api/stocking/active');
        await cacheData('ACTIVE_STOCK_CACHE', stockRes.data);
      } catch (e) { /* Silent fail for background tasks */ }

    } catch (e) {
      console.log("Fetch error:", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadLocal = async () => {
        const cached = await AsyncStorage.getItem("PONDS_LIST");
        if (cached) setPonds(JSON.parse(cached));
        
        // Load last sync time
        const syncTime = await AsyncStorage.getItem("LAST_SYNC_TIME");
        if (syncTime) setLastSyncTime(new Date(syncTime));
        
        fetchAllData(); 
      };
      loadLocal();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncData();
    setSyncing(false);
    if (result.success) {
      Alert.alert("Sync Complete", result.message);
      await AsyncStorage.setItem("LAST_SYNC_TIME", new Date().toISOString());
      setLastSyncTime(new Date());
      onRefresh(); // Refresh UI after sync
    } else {
      Alert.alert("Sync Failed", result.message || "Check connection");
    }
  };

  const handlePondClick = useCallback((item) => {
    setSelectedPond(item);
    setModalVisible(true);
  }, []);

  // --- NEW: Filter & Search Logic ---
  const getFilteredAndSortedPonds = useCallback(() => {
    let filtered = [...ponds];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pond => 
        pond.name.toLowerCase().includes(query) ||
        pond.id.toString().includes(query) ||
        (pond.location_desc && pond.location_desc.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(pond => {
        const { isReady, isInactive } = getPondStatus(pond);
        if (filterStatus === "ready") return !isInactive && isReady;
        if (filterStatus === "active") return !isInactive && !isReady;
        if (filterStatus === "inactive") return isInactive;
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "age") {
        const aDays = getPondStatus(a).daysActive;
        const bDays = getPondStatus(b).daysActive;
        return bDays - aDays; // Newest first
      }
      if (sortBy === "size") return b.area_sqm - a.area_sqm; // Largest first
      return 0;
    });

    return filtered;
  }, [ponds, searchQuery, filterStatus, sortBy]);

  const filteredPonds = getFilteredAndSortedPonds();

  const generatePDF = async () => {
    if (ponds.length === 0) return Alert.alert("No Data", "No ponds to print.");
    
    try {
      const tableRows = ponds.map((pond) => {
        const { daysActive, isReady, isInactive } = getPondStatus(pond);
        const statusText = isInactive ? "Inactive" : isReady ? "Ready to Harvest" : `${daysActive} Days Old`;
        return `<tr>
          <td>${pond.id}</td>
          <td>${pond.name}</td>
          <td>${pond.location_desc || "N/A"}</td>
          <td>${pond.area_sqm} sqm</td>
          <td>${statusText}</td>
        </tr>`;
      }).join("");

      const html = `
        <html>
          <head><style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style></head>
          <body>
            <h1>Farm Report</h1>
            <table><tr><th>ID</th><th>Name</th><th>Location</th><th>Size</th><th>Status</th></tr>${tableRows}</table>
          </body>
        </html>`;
        
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
    } catch (error) {
      Alert.alert("Error", "Could not generate PDF");
    }
  };

  const renderItem = useCallback(({ item }) => (
    <PondCard item={item} onPress={handlePondClick} />
  ), [handlePondClick]);

  // --- NEW: Format last sync time ---
  const formatSyncTime = () => {
    if (!lastSyncTime) return "Never";
    const now = new Date();
    const diff = Math.floor((now - lastSyncTime) / 1000 / 60); // minutes
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return lastSyncTime.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>My Ponds</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: "#FFA000", opacity: syncing ? 0.7 : 1 }]}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="cloud-upload-outline" size={20} color="white" />}
            <Text style={styles.exportText}>Sync</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportBtn} onPress={generatePDF}>
            <Ionicons name="print-outline" size={20} color="white" />
            <Text style={styles.exportText}>Report</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* NEW: Last Sync Indicator */}
      <Text style={styles.lastSyncText}>Last synced: {formatSyncTime()}</Text>

      {/* NEW: Stats Dashboard */}
      <StatsCard ponds={ponds} />

      {/* NEW: Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ponds by name, ID, or location..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* NEW: Filter & Sort Controls */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options-outline" size={18} color="#007AFF" />
          <Text style={styles.filterToggleText}>Filters</Text>
        </TouchableOpacity>

        <Text style={styles.resultCount}>{filteredPonds.length} ponds</Text>
      </View>

      {/* NEW: Expandable Filter Panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Status:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
              {['all', 'ready', 'active', 'inactive'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterChip, filterStatus === status && styles.filterChipActive]}
                  onPress={() => setFilterStatus(status)}
                >
                  <Text style={[styles.filterChipText, filterStatus === status && styles.filterChipTextActive]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Sort by:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
              {[
                { key: 'name', label: 'Name' },
                { key: 'age', label: 'Age' },
                { key: 'size', label: 'Size' }
              ].map(sort => (
                <TouchableOpacity
                  key={sort.key}
                  style={[styles.filterChip, sortBy === sort.key && styles.filterChipActive]}
                  onPress={() => setSortBy(sort.key)}
                >
                  <Text style={[styles.filterChipText, sortBy === sort.key && styles.filterChipTextActive]}>
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <FlatList
        data={filteredPonds}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="water-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery ? "No ponds match your search" : "No ponds found"}
            </Text>
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchText}>Clear Search</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        initialNumToRender={5}
        windowSize={5}
        removeClippedSubviews={true}
      />

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {selectedPond && (
                <>
                  {selectedPond.image_base64 && (
                    <Image source={{ uri: `data:image/jpeg;base64,${selectedPond.image_base64}` }} style={styles.modalImage} resizeMode="contain" />
                  )}
                  <View style={styles.modalBody}>
                    <Text style={styles.modalTitle}>{selectedPond.name}</Text>
                    <Text style={{marginBottom: 5}}>ID: {selectedPond.id} | Size: {selectedPond.area_sqm} sqm</Text>
                    <Text>Location: {selectedPond.location_desc}</Text>
                    
                    {/* NEW: Status in Modal */}
                    <View style={styles.modalStatusContainer}>
                      <Text style={styles.modalStatusLabel}>Status:</Text>
                      <View style={[styles.badge, { backgroundColor: getPondStatus(selectedPond).badgeBg }]}>
                        <Text style={{ color: getPondStatus(selectedPond).badgeColor, fontSize: 12, fontWeight: "bold" }}>
                          {getPondStatus(selectedPond).badgeText}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", paddingTop: 50 },
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 10 },
  header: { fontSize: 28, fontWeight: "bold" },
  exportBtn: { backgroundColor: "#007AFF", flexDirection: "row", alignItems: "center", padding: 8, borderRadius: 20 },
  exportText: { color: "white", marginLeft: 5 },
  
  // NEW: Last Sync Text
  lastSyncText: { 
    fontSize: 12, 
    color: "#999", 
    textAlign: "center", 
    marginBottom: 10 
  },

  // NEW: Stats Container
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },

  // NEW: Search Bar
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },

  // NEW: Filter Container
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  filterToggleText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  resultCount: {
    fontSize: 13,
    color: "#666",
  },

  // NEW: Filter Panel
  filterPanel: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  filterRow: {
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 13,
    color: "#666",
  },
  filterChipTextActive: {
    color: "white",
    fontWeight: "600",
  },

  // NEW: Enhanced Empty State
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
  },
  clearSearchBtn: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 20,
  },
  clearSearchText: {
    color: "white",
    fontWeight: "600",
  },

  list: { paddingHorizontal: 20, paddingBottom: 30 },
  card: { backgroundColor: "white", borderRadius: 16, marginBottom: 16, flexDirection: "row", overflow: "hidden", elevation: 3 },
  statusStrip: { width: 6, height: "100%" },
  cardContent: { flex: 1, padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  pondName: { fontSize: 18, fontWeight: "700" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pondImage: { width: "100%", height: 140, borderRadius: 8, marginBottom: 10, backgroundColor: "#eee" },
  locationRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  locationText: { color: "#666", fontSize: 14, marginLeft: 4 },
  pondId: { fontSize: 12, color: "#777", backgroundColor: "#f1f3f5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  detailsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  detailText: { color: "#555", fontSize: 14, fontWeight: "500" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", maxHeight: "80%", backgroundColor: "white", borderRadius: 20, overflow: "hidden", elevation: 10 },
  modalImage: { width: "100%", height: 300, backgroundColor: "black" },
  modalBody: { padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  
  // NEW: Modal Status Display
  modalStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    gap: 10,
  },
  modalStatusLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },

  closeButton: { marginTop: 20, backgroundColor: "#007AFF", padding: 15, borderRadius: 10, alignItems: "center" },
  closeButtonText: { color: "white", fontWeight: "bold" },
});