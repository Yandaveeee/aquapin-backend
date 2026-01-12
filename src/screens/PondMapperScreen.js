import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Button,
  Alert,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from "react-native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons"; 
import 'react-native-get-random-values'; // Required for uuid
import { v4 as uuidv4 } from 'uuid'; // Fix #3: Client-side Idempotency

import client from "../api/client";
import { isOnline, queueAction, getSmartData } from '../api/offline';

// Helper: Calculate Polygon Centroid
const getCentroid = (coords) => {
  if (!coords.length) return null;
  const x = coords.reduce((a, b) => a + b.latitude, 0) / coords.length;
  const y = coords.reduce((a, b) => a + b.longitude, 0) / coords.length;
  return { latitude: x, longitude: y };
};

export default function PondMapperScreen({ navigation }) {
  const mapRef = useRef(null);
  const locationSubRef = useRef(null);

  // Map State
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedPonds, setSavedPonds] = useState([]);
  
  // Form State
  const [pondName, setPondName] = useState("");
  const [pondImage, setPondImage] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fix #1: Track Keyboard Visibility Manually
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Debug State
  const [gpsDebug, setGpsDebug] = useState("Initializing...");

  // Fix #1: Keyboard Listeners
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Fix #4: Safer Data Fetching Pattern
  const fetchPonds = useCallback(async () => {
    try {
      // We pass the raw client.get but getSmartData handles the .data extraction
      const data = await getSmartData('PONDS_LIST', () => client.get('/api/ponds/'));
      if (data) setSavedPonds(data);
    } catch (e) {
      console.warn("Failed to load ponds", e);
    }
  }, []);

  // --- GPS LOGIC ---
  const startTracking = useCallback(async (highAccuracy = false) => {
    // Cleanup existing subscription
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }

    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setGpsDebug("Permission Denied");
      return;
    }

    try {
      const sub = await Location.watchPositionAsync(
        {
          // Adaptive Accuracy: BestForNavigation (High) vs Balanced (Low)
          accuracy: highAccuracy ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
          timeInterval: highAccuracy ? 1000 : 5000, 
          distanceInterval: highAccuracy ? 2 : 10, 
        },
        (location) => {
          const { latitude, longitude, accuracy } = location.coords;
          if (__DEV__) {
            setGpsDebug(`Lat: ${latitude.toFixed(5)}\nLng: ${longitude.toFixed(5)}\nAcc: ${accuracy?.toFixed(1)}m`);
          }
        }
      );
      locationSubRef.current = sub;
    } catch (error) {
      setGpsDebug(`GPS Error: ${error.message}`);
    }
  }, []);

  // Fix #2: Optimized Lifecycle
  useEffect(() => {
    (async () => {
      // REMOVED: await startTracking(false); 
      // Reason: The `isDrawing` effect below runs on mount and sets it to false.
      
      // Initial Camera Jump
      try {
        const location = await Location.getCurrentPositionAsync({});
        const initialRegion = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        mapRef.current?.animateToRegion(initialRegion, 1000);
      } catch (e) { /* Ignore initial location errors */ }
      
      fetchPonds();
    })();

    return () => {
      if (locationSubRef.current) {
        locationSubRef.current.remove();
      }
    };
  }, []);

  // Effect: Switch GPS mode when Drawing changes
  useEffect(() => {
    startTracking(isDrawing); 
  }, [isDrawing, startTracking]);

  // --- HANDLERS ---

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    const online = await isOnline();
    if (!online) { Alert.alert("Offline", "Search requires internet."); return; }
    
    Keyboard.dismiss(); 
    try {
      const geocodedLocation = await Location.geocodeAsync(searchText);
      if (geocodedLocation.length > 0) {
        const result = geocodedLocation[0];
        const newRegion = {
          latitude: result.latitude,
          longitude: result.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        mapRef.current?.animateToRegion(newRegion, 1000);
      } else {
        Alert.alert("Not Found", "Could not locate that place.");
      }
    } catch (error) {
      Alert.alert("Error", "Search failed.");
    }
  };

  const handleMapPress = (e) => {
    if (!isDrawing) return;
    
    // Fix #1: Use state-based visibility check
    if (keyboardVisible) {
        Keyboard.dismiss();
        return;
    }

    const newCoordinate = e.nativeEvent.coordinate;
    setCoordinates(prev => [...prev, newCoordinate]);
  };

  const handleUndo = () => {
    setCoordinates(prev => prev.slice(0, -1));
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) { Alert.alert("Permission Refused"); return; }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
      base64: true,
    });
    
    if (!result.canceled) {
      setPondImage(result.assets[0].base64);
    }
  };

  const savePond = async () => {
    if (isSubmitting) return;
    
    if (coordinates.length < 3) { 
      Alert.alert("Invalid Pond", "Please draw at least 3 corners."); 
      return; 
    }
    if (!pondName.trim()) { 
      Alert.alert("Missing Info", "Please provide a name for the pond."); 
      return; 
    }

    setIsSubmitting(true);

    const apiCoordinates = coordinates.map(c => [c.latitude, c.longitude]);
    const online = await isOnline();
    let addressString = null;

    if (online) {
      try {
        const centroid = getCentroid(coordinates);
        if (centroid) {
            const addressList = await Location.reverseGeocodeAsync(centroid);
            if (addressList.length > 0) {
            const addr = addressList[0];
            addressString = `${addr.street || ''} ${addr.city || ''}, ${addr.region || ''}`.trim();
            }
        }
      } catch (e) { console.log("Geocode failed, using raw coords"); }
    }

    const payload = {
      client_request_id: uuidv4(), // Fix #3: Critical for offline idempotency
      name: pondName,
      location_desc: addressString || "Pending address update...", 
      coordinates: apiCoordinates,
      image_base64: pondImage,
    };

    try {
      if (online) {
        const response = await client.post("/api/ponds/", payload);
        Alert.alert("Success", `Saved! Area: ${response.data.area_sqm} sqm`);
        fetchPonds(); 
      } else {
        await queueAction("/api/ponds/", payload);
        Alert.alert("Saved Offline", "Pond saved locally. Will sync when online.");
      }
      
      setCoordinates([]); 
      setPondName(""); 
      setPondImage(null); 
      setIsDrawing(false); 

    } catch (error) {
      console.error("Save Error:", error);
      Alert.alert("Save Failed", "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        
        {__DEV__ && (
          <View style={styles.debugBox}>
            <Text style={styles.debugText}>{gpsDebug}</Text>
          </View>
        )}

        {!isDrawing && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search location..."
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}>
              <Ionicons name="search" size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}

        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: 18.2543,
            longitude: 121.9961,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          // Fix #5: Disable map interaction when not drawing to prevent android accidents
          onPress={isDrawing ? handleMapPress : undefined}
          mapType="hybrid"
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
        >
          {savedPonds.map((pond) => (
            <Polygon
              key={pond.id}
              coordinates={pond.coordinates.map(c => ({ latitude: c[0], longitude: c[1] }))}
              fillColor="rgba(0, 255, 0, 0.4)"
              strokeColor="rgba(255,255,255,0.8)"
              strokeWidth={2}
              tappable={!isDrawing}
              onPress={() => {
                if (!isDrawing) navigation.navigate("PondDetail", { pond });
              }}
            />
          ))}

          {coordinates.length > 0 && (
            <Polygon 
              coordinates={coordinates} 
              fillColor="rgba(0, 200, 255, 0.5)" 
              strokeColor="rgba(0, 0, 255, 0.8)" 
              strokeWidth={3}
            />
          )}
          {coordinates.map((marker, index) => (
            <Marker key={index} coordinate={marker} anchor={{x: 0.5, y: 0.5}}>
               <View style={styles.markerDot} />
            </Marker>
          ))}
        </MapView>

        <View style={styles.controls}>
          {!isDrawing ? (
            <Button 
              title=" + Add New Pond " 
              onPress={() => setIsDrawing(true)} 
              color="#007AFF" 
            />
          ) : (
            <ScrollView 
              style={styles.formScrollView}
              contentContainerStyle={styles.formContainer}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.drawHeader}>
                <Text style={styles.instruction}>Tap map to add points ({coordinates.length})</Text>
                {coordinates.length > 0 && (
                  <TouchableOpacity onPress={handleUndo}>
                    <Text style={styles.undoText}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput 
                style={styles.input} 
                placeholder="Pond Name (e.g. North Sector 1)" 
                value={pondName} 
                onChangeText={setPondName}
              />
              
              <TouchableOpacity onPress={takePhoto} style={styles.photoBtn}>
                <Ionicons name={pondImage ? "checkmark-circle" : "camera"} size={20} color="#333" />
                <Text style={{marginLeft: 8}}>
                  {pondImage ? "Photo Attached" : "Attach Photo"}
                </Text>
              </TouchableOpacity>

              <View style={styles.buttons}>
                <TouchableOpacity 
                  style={[styles.actionBtn, {backgroundColor: '#FF3B30'}]}
                  onPress={() => { setIsDrawing(false); setCoordinates([]); }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionBtn, {backgroundColor: '#34C759'}, isSubmitting && {opacity: 0.6}]}
                  onPress={savePond}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.btnText}>Save Pond</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  debugBox: {
    position: 'absolute',
    top: 40,
    left: 10,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 6
  },
  debugText: { color: '#00FF00', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF'
  },
  controls: { 
    position: "absolute", 
    bottom: 30, 
    left: 20,
    right: 20,
    zIndex: 10
  },
  searchContainer: { 
    position: "absolute", 
    top: 60, 
    left: 20, 
    right: 20, 
    zIndex: 10, 
    flexDirection: "row", 
    backgroundColor: "white", 
    borderRadius: 8, 
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  searchInput: { flex: 1, padding: 12, fontSize: 16 },
  searchBtn: { 
    backgroundColor: "#007AFF", 
    paddingHorizontal: 15,
    borderTopRightRadius: 8, 
    borderBottomRightRadius: 8, 
    justifyContent: "center" 
  },
  formScrollView: { maxHeight: 300 },
  formContainer: { 
    backgroundColor: "white", 
    padding: 16, 
    borderRadius: 16, 
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  drawHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  instruction: { 
    color: "#666", 
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase' 
  },
  undoText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 12
  },
  input: { 
    borderWidth: 1, 
    borderColor: "#E0E0E0", 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12, 
    fontSize: 16, 
    backgroundColor: "#F9F9F9" 
  },
  photoBtn: { 
    backgroundColor: "#F0F0F0", 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 16, 
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: 'center'
  },
  buttons: { 
    flexDirection: "row", 
    gap: 12 
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  }
});