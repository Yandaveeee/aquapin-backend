import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons"; 
import client from "../api/client";
import { isOnline, queueAction, getSmartData } from '../api/offline';

export default function PondMapperScreen({ navigation }) {
  const mapRef = useRef(null);

  // Default to Cagayan
  const [region, setRegion] = useState({
    latitude: 18.2543,
    longitude: 121.9961,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedPonds, setSavedPonds] = useState([]);
  
  // DEBUG STATE: To see what your phone is actually reporting
  const [gpsDebug, setGpsDebug] = useState("Waiting for GPS...");

  const [pondName, setPondName] = useState("");
  const [pondImage, setPondImage] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [locationSubscription, setLocationSubscription] = useState(null);

  const fetchPonds = async () => {
    const data = await getSmartData('PONDS_LIST', () => client.get('/api/ponds/'));
    if (data) setSavedPonds(data);
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsDebug("Permission Denied");
        return;
      }

      try {
        // LIVE TRACKING
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation, // Highest Power
            timeInterval: 1000, 
            distanceInterval: 1, 
          },
          (location) => {
            const { latitude, longitude, accuracy } = location.coords;
            setGpsDebug(`Lat: ${latitude.toFixed(5)}\nLng: ${longitude.toFixed(5)}\nAccuracy: ${accuracy?.toFixed(1)} meters`);

            // Only move camera if not drawing
            if (!isDrawing && mapRef.current) {
               // mapRef.current.animateToRegion(...) 
            }
          }
        );
        setLocationSubscription(sub);

        // Immediate Jump
        let initialLoc = await Location.getCurrentPositionAsync({});
        const initialRegion = {
            latitude: initialLoc.coords.latitude,
            longitude: initialLoc.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        };
        setRegion(initialRegion);
        if (mapRef.current) {
            mapRef.current.animateToRegion(initialRegion, 2000);
        }

      } catch (error) {
        setGpsDebug(`GPS Error: ${error.message}`);
      }
      
      fetchPonds();
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

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
        if (mapRef.current) mapRef.current.animateToRegion(newRegion, 1000);
        setRegion(newRegion);
      } else {
        Alert.alert("Not Found");
      }
    } catch (error) {
      Alert.alert("Error", "Search failed.");
    }
  };

  const handleMapPress = (e) => {
    if (!isDrawing) return;
    setCoordinates([...coordinates, e.nativeEvent.coordinate]);
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) { Alert.alert("Permission Refused"); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled) {
      setPondImage(result.assets[0].base64);
      Alert.alert("Photo Attached");
    }
  };

  const savePond = async () => {
    if (coordinates.length < 3) { 
      Alert.alert("Error", "Draw at least 3 corners."); 
      return; 
    }
    if (!pondName.trim()) { 
      Alert.alert("Missing Name", "Please give your pond a name."); 
      return; 
    }

    const cleanCoordinates = coordinates.map((c) => {
        const lat = c.latitude !== undefined ? c.latitude : c[0];
        const lng = c.longitude !== undefined ? c.longitude : c[1];
        return [lat, lng];
    });

    const online = await isOnline();
    let addressString = "Pinned Location (Offline)";

    if (online) {
      try {
        const firstPoint = { latitude: cleanCoordinates[0][0], longitude: cleanCoordinates[0][1] };
        const addressList = await Location.reverseGeocodeAsync(firstPoint);
        if (addressList.length > 0) {
          const addr = addressList[0];
          addressString = `${addr.city || addr.subregion || ''}, ${addr.region || addr.country || ''}`;
        }
      } catch (e) { console.log("Geocode failed"); }
    }

    const payload = {
      name: pondName,
      location_desc: addressString,
      coordinates: cleanCoordinates,
      image_base64: pondImage,
    };

    if (online) {
      try {
        const response = await client.post("/api/ponds/", payload);
        Alert.alert("Success", `Saved! Size: ${response.data.area_sqm} sqm`);
        
        setCoordinates([]); 
        setPondName(""); 
        setPondImage(null); 
        setIsDrawing(false); 
        fetchPonds(); 

      } catch (error) {
        console.error("Save Error:", error);
        const serverMessage = error.response?.data?.detail 
          ? JSON.stringify(error.response.data.detail) 
          : error.message;
        Alert.alert("Save Failed", serverMessage);
      }
    } else {
      try {
        await queueAction("/api/ponds/", payload);
        Alert.alert("Saved Offline", "Will sync when internet returns.");
        setCoordinates([]); setPondName(""); setPondImage(null); setIsDrawing(false);
      } catch (e) { 
        Alert.alert("Error", "Could not save offline."); 
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.container}>
        {/* --- DEBUG BOX --- */}
        <View style={styles.debugBox}>
          <Text style={styles.debugText}>{gpsDebug}</Text>
        </View>

        {!isDrawing && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search location..."
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
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
          initialRegion={region} 
          onPress={handleMapPress}
          mapType="hybrid"
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
        >
          {savedPonds.map((pond) => (
            <Polygon
              key={pond.id}
              coordinates={pond.coordinates.map((c) => ({ latitude: c[0], longitude: c[1] }))}
              fillColor="rgba(0, 255, 0, 0.4)"
              strokeColor="rgba(255,255,255,0.8)"
              strokeWidth={2}
              tappable={true}
              onPress={() => {
                if (!isDrawing) {
                  console.log("Navigating to pond:", pond.id);
                  navigation.navigate("PondDetail", { pond: pond });
                }
              }}
            />
          ))}

          {coordinates.length > 0 && (
            <Polygon coordinates={coordinates} fillColor="rgba(0, 200, 255, 0.5)" strokeColor="rgba(0, 0, 255, 0.5)" />
          )}
          {coordinates.map((marker, index) => (
            <Marker key={index} coordinate={marker} />
          ))}
        </MapView>

        {/* --- FIXED CONTROLS SECTION --- */}
        <View style={styles.controls}>
          {!isDrawing ? (
            <Button title=" + Add New Pond " onPress={() => setIsDrawing(true)} color="#007AFF" />
          ) : (
            <ScrollView 
              style={styles.formScrollView}
              contentContainerStyle={styles.formContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.instruction}>Tap map to draw corners</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Pond Name" 
                value={pondName} 
                onChangeText={setPondName}
                returnKeyType="done"
                blurOnSubmit={true}
              />
              <TouchableOpacity onPress={takePhoto} style={styles.photoBtn}>
                <Text>{pondImage ? "✅ Photo Attached" : "📷 Attach Photo"}</Text>
              </TouchableOpacity>
              <View style={styles.buttons}>
                <Button title="Cancel" onPress={() => { setIsDrawing(false); setCoordinates([]); }} color="red" />
                <Button title="Save" onPress={savePond} color="green" />
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
    top: 30,
    left: 10,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8
  },
  debugText: { color: '#00FF00', fontSize: 12, fontWeight: 'bold' },
  
  // UPDATED CONTROLS STYLE
  controls: { 
    position: "absolute", 
    bottom: 20, 
    left: 20,
    right: 20,
    maxHeight: '40%', // Limit height so it doesn't cover too much map
    zIndex: 10
  },

  searchContainer: { 
    position: "absolute", 
    top: 100, 
    left: 20, 
    right: 20, 
    zIndex: 10, 
    flexDirection: "row", 
    backgroundColor: "white", 
    borderRadius: 8, 
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  searchInput: { flex: 1, padding: 10, fontSize: 16 },
  searchBtn: { 
    backgroundColor: "#007AFF", 
    padding: 10, 
    borderTopRightRadius: 8, 
    borderBottomRightRadius: 8, 
    justifyContent: "center" 
  },
  
  formScrollView: {
    maxHeight: '100%',
  },
  
  formContainer: { 
    backgroundColor: "white", 
    padding: 15, 
    borderRadius: 15, 
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  
  instruction: { 
    textAlign: "center", 
    color: "#666", 
    marginBottom: 10, 
    fontSize: 12 
  },
  
  input: { 
    borderWidth: 1, 
    borderColor: "#ddd", 
    borderRadius: 8, 
    padding: 10, 
    marginBottom: 10, 
    fontSize: 16, 
    backgroundColor: "#f9f9f9" 
  },
  
  photoBtn: { 
    backgroundColor: "#eee", 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 10, 
    alignItems: "center" 
  },
  
  buttons: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    gap: 10 
  },
});