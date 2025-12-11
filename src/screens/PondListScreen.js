import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert, Image, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import client from '../api/client';

export default function PondListScreen() {
  const [ponds, setPonds] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPond, setSelectedPond] = useState(null);

  const fetchPonds = async () => {
    try {
      const response = await client.get('/api/ponds/');
      setPonds(response.data);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => { fetchPonds(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPonds().then(() => setRefreshing(false));
  }, []);

  const getDaysActive = (dateString) => {
    if (!dateString) return 0;
    const stockDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - stockDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const generatePDF = async () => {
    if (ponds.length === 0) { Alert.alert("No Data", "No ponds."); return; }
    try {
      const tableRows = ponds.map(pond => {
        const days = getDaysActive(pond.last_stocked_at);
        const isReady = days >= 120;
        let statusText = pond.name.includes("(None)") ? "Inactive" : (isReady ? "Ready to Harvest" : `${days} Days Old`);
        return `<tr><td>${pond.id}</td><td>${pond.name}</td><td>${pond.location_desc || "N/A"}</td><td>${pond.area_sqm} sqm</td><td>${statusText}</td></tr>`;
      }).join('');
      const html = `<html><body><h1>Farm Report</h1><table><tr><th>ID</th><th>Name</th><th>Location</th><th>Size</th><th>Status</th></tr>${tableRows}</table></body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { Alert.alert("Error", "PDF Failed"); }
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
                    <Text style={{ color: isReady ? '#D32F2F' : '#1976D2', fontSize: 10, fontWeight: 'bold' }}>{isReady ? 'READY' : `${daysActive} DAYS`}</Text>
                </View>
            )}
          </View>
          {item.image_base64 && <Image source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} style={styles.pondImage} resizeMode="cover"/>}
          <View style={styles.locationRow}><Ionicons name="location-sharp" size={14} color="#D32F2F" /><Text style={styles.locationText}>{item.location_desc || "No Address"}</Text></View>
          <View style={styles.detailsRow}><Text style={styles.pondId}>ID: {item.id}</Text><Text style={styles.detailText}>{item.area_sqm} sqm</Text></View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>My Ponds</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={generatePDF}><Ionicons name="print-outline" size={20} color="white" /><Text style={styles.exportText}>Report</Text></TouchableOpacity>
      </View>
      <FlatList data={ponds} keyExtractor={(item) => item.id.toString()} renderItem={renderItem} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />
      
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
                {selectedPond && (
                    <>
                        {selectedPond.image_base64 ? <Image source={{ uri: `data:image/jpeg;base64,${selectedPond.image_base64}` }} style={styles.modalImage} resizeMode="contain" /> : null}
                        <View style={styles.modalBody}>
                            <Text style={styles.modalTitle}>{selectedPond.name}</Text>
                            <Text>ID: {selectedPond.id} | Size: {selectedPond.area_sqm} sqm</Text>
                            <Text>Location: {selectedPond.location_desc}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 50 },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  header: { fontSize: 28, fontWeight: 'bold' },
  exportBtn: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 20 },
  exportText: { color:'white', marginLeft: 5 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  card: { backgroundColor: 'white', borderRadius: 16, marginBottom: 16, flexDirection: 'row', overflow: 'hidden', elevation: 3 },
  statusStrip: { width: 6, height: '100%' },
  cardContent: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pondName: { fontSize: 18, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pondImage: { width: '100%', height: 140, borderRadius: 8, marginBottom: 10, backgroundColor: '#eee' },
  locationRow: { flexDirection:'row', alignItems:'center', marginBottom: 8 },
  locationText: { color: '#666', fontSize: 14, marginLeft: 4 },
  pondId: { fontSize: 12, color: '#777', backgroundColor: '#f1f3f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  detailText: { color: '#555', fontSize: 14, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 20, overflow: 'hidden', elevation: 10 },
  modalImage: { width: '100%', height: 300, backgroundColor: 'black' },
  modalBody: { padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
  closeButton: { marginTop: 20, backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { color: 'white', fontWeight: 'bold' }
});