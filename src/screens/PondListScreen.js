import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert, Image, Modal, ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import client from '../api/client';
// --- IMPORT STORAGE HELPER ---
import { storeData, getData } from '../utils/storage';

export default function PondListScreen() {
  const [ponds, setPonds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false); // Track connection status
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPond, setSelectedPond] = useState(null);

  const fetchPonds = async () => {
    try {
      // 1. Try Network First
      const response = await client.get('/api/ponds/');
      
      // 2. If success, save to phone
      setPonds(response.data);
      await storeData('PONDS_CACHE', response.data);
      setIsOffline(false); // We are online
      
    } catch (error) {
      console.log("Network failed, switching to offline mode...");
      
      // 3. If fail, load from phone
      const cachedPonds = await getData('PONDS_CACHE');
      if (cachedPonds) {
        setPonds(cachedPonds);
        setIsOffline(true); // Show offline warning
        Alert.alert("Offline Mode", "Showing saved data. Connect to server to update.");
      } else {
        Alert.alert("Error", "No internet and no saved data.");
      }
    }
  };

  useEffect(() => {
    fetchPonds();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPonds().then(() => setRefreshing(false));
  }, []);

  // ... (Helper logic stays the same) ...
  const getDaysActive = (dateString) => {
    if (!dateString) return 0;
    const stockDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - stockDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const generatePDF = async () => {
    if (ponds.length === 0) { Alert.alert("No Data", "No ponds to report."); return; }
    try {
      const tableRows = ponds.map(pond => {
        const days = getDaysActive(pond.last_stocked_at);
        const isReady = days >= 120;
        let statusText = pond.name.includes("(None)") ? "Inactive" : (isReady ? "Ready to Harvest" : `${days} Days Old`);
        let statusColor = isReady ? "#D32F2F" : "#333";
        return `<tr><td>${pond.id}</td><td><strong>${pond.name}</strong></td><td>${pond.location_desc || "N/A"}</td><td>${pond.area_sqm} sqm</td><td style="color:${statusColor}">${statusText}</td></tr>`;
      }).join('');
      const html = `<html><head><style>body{font-family:'Helvetica';padding:20px;}h1{color:#007AFF;text-align:center;}table{width:100%;border-collapse:collapse;margin-top:20px;}th,td{border:1px solid #ddd;padding:8px;}th{background-color:#007AFF;color:white;}</style></head><body><h1>AquaPin Farm Report</h1><table><tr><th>ID</th><th>Name</th><th>Location</th><th>Size</th><th>Status</th></tr>${tableRows}</table></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { Alert.alert("Error", "Could not generate report."); }
  };

  const handlePondClick = (item) => {
    setSelectedPond(item);
    setModalVisible(true);
  };

  const renderItem = ({ item }) => {
    const daysActive = getDaysActive(item.last_stocked_at);
    const isReady = daysActive >= 120; 
    const isInactive = item.name.includes("(None)");

    return (
      <TouchableOpacity style={styles.card} onPress={() => handlePondClick(item)} activeOpacity={0.7}>
        <View style={[styles.statusStrip, { backgroundColor: isInactive ? '#9E9E9E' : (isReady ? '#FF5252' : '#2196F3') }]} />
        <View style={styles.cardContent}>
          <View style={styles.headerRow}>
            <Text style={styles.pondName}>{item.name}</Text>
            {!isInactive && (
                <View style={[styles.badge, { backgroundColor: isReady ? '#FFEBEE' : '#E3F2FD' }]}>
                    <Text style={{ color: isReady ? '#D32F2F' : '#1976D2', fontSize: 10, fontWeight: 'bold' }}>
                        {isReady ? 'READY' : `${daysActive} DAYS`}
                    </Text>
                </View>
            )}
          </View>
          {item.image_base64 && <Image source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} style={styles.pondImage} resizeMode="cover"/>}
          <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={14} color="#D32F2F" />
              <Text style={styles.locationText} numberOfLines={1}>{item.location_desc || "No Address Provided"}</Text>
          </View>
          <View style={styles.detailsRow}>
             <View style={styles.detailItem}><Text style={styles.pondId}>ID: {item.id}</Text></View>
             <View style={styles.detailItem}><Ionicons name="resize-outline" size={16} color="#666" /><Text style={styles.detailText}>{item.area_sqm} sqm</Text></View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* OFFLINE BANNER */}
      {isOffline && (
        <View style={{backgroundColor: '#D32F2F', padding: 10, alignItems: 'center'}}>
            <Text style={{color: 'white', fontWeight: 'bold'}}>⚠️ OFFLINE MODE - Showing Saved Data</Text>
        </View>
      )}

      <View style={styles.headerContainer}>
        <Text style={styles.header}>My Ponds</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={generatePDF}>
            <Ionicons name="print-outline" size={20} color="white" />
            <Text style={styles.exportText}>Report</Text>
        </TouchableOpacity>
      </View>
      
      {ponds.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="water-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No ponds found</Text>
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

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
                {selectedPond && (
                    <>
                        {selectedPond.image_base64 ? (
                            <Image source={{ uri: `data:image/jpeg;base64,${selectedPond.image_base64}` }} style={styles.modalImage} resizeMode="contain" />
                        ) : (
                            <View style={[styles.modalImage, {backgroundColor:'#eee', justifyContent:'center', alignItems:'center'}]}><Ionicons name="image-outline" size={50} color="#ccc" /><Text style={{color:'#999'}}>No Photo Available</Text></View>
                        )}
                        <View style={styles.modalBody}>
                            <Text style={styles.modalTitle}>{selectedPond.name}</Text>
                            <Text style={styles.modalId}>Pond ID: {selectedPond.id}</Text>
                            <View style={styles.modalRow}><Ionicons name="location" size={20} color="#D32F2F" /><Text style={styles.modalText}>{selectedPond.location_desc || "Unknown Location"}</Text></View>
                            <View style={styles.modalRow}><Ionicons name="resize" size={20} color="#666" /><Text style={styles.modalText}>Area: {selectedPond.area_sqm} sqm</Text></View>
                            <View style={styles.modalRow}><Ionicons name="calendar" size={20} color="#666" /><Text style={styles.modalText}>Last Stocked: {selectedPond.last_stocked_at || "Not active"}</Text></View>
                            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}><Text style={styles.closeButtonText}>Close</Text></TouchableOpacity>
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

// ... (Copy Styles from previous step, or keep them if you didn't delete them)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 50 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  header: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  exportBtn: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, elevation: 3 },
  exportText: { color:'white', fontWeight:'600', marginLeft: 5 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  card: { backgroundColor: 'white', borderRadius: 16, marginBottom: 16, flexDirection: 'row', overflow: 'hidden', elevation: 3 },
  statusStrip: { width: 6, height: '100%' },
  cardContent: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pondName: { fontSize: 18, fontWeight: '700', color: '#333' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pondImage: { width: '100%', height: 140, borderRadius: 8, marginBottom: 10, backgroundColor: '#eee' },
  locationRow: { flexDirection:'row', alignItems:'center', marginBottom: 8 },
  locationText: { color: '#666', fontSize: 14, marginLeft: 4, flex: 1 },
  pondId: { fontSize: 12, color: '#777', backgroundColor: '#f1f3f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, borderTopWidth: 1, borderTopColor: '#f1f1f1', paddingTop: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { color: '#555', fontSize: 14, fontWeight: '500' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#888', marginTop: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 20, overflow: 'hidden', elevation: 10 },
  modalImage: { width: '100%', height: 300, backgroundColor: 'black' },
  modalBody: { padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  modalId: { fontSize: 14, color: '#888', marginBottom: 20, backgroundColor: '#f0f0f0', alignSelf:'flex-start', paddingHorizontal:8, borderRadius:4 },
  modalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 10 },
  modalText: { fontSize: 16, color: '#555' },
  closeButton: { marginTop: 20, backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});