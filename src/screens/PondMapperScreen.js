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
} from "react-native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons"; 
import client from "../api/client";
import { isOnline, queueAction, getSmartData } from '../api/offline';

export default function PondMapperScreen() {
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
            
            // UPDATE DEBUG TEXT
            setGpsDebug(`Lat: ${latitude.toFixed(5)}\nLng: ${longitude.toFixed(5)}\nAccuracy: ${accuracy?.toFixed(1)} meters`);

            const userRegion = {
              latitude: latitude,
              longitude: longitude,
              latitudeDelta: 0.002,
              longitudeDelta: 0.002,
            };

            // Only move camera if not drawing
            if (!isDrawing && mapRef.current) {
               // mapRef.current.animateToRegion(userRegion, 1000); 
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
    if (coordinates.length < 3) { Alert.alert("Error", "Draw 3 corners."); return; }
    if (!pondName.trim()) { Alert.alert("Missing Name"); return; }

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
          addressString = `${addr.city || addr.subregion}, ${addr.region || addr.country}`;
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
        setCoordinates([]); setPondName(""); setPondImage(null); setIsDrawing(false); fetchPonds();
      } catch (error) { Alert.alert("Error", "Could not save."); }
    } else {
      try {
        await queueAction("/api/ponds/", payload);
        Alert.alert("Saved Offline", "Will sync later.");
        setCoordinates([]); setPondName(""); setPondImage(null); setIsDrawing(false);
      } catch (e) { Alert.alert("Error", "Could not save offline."); }
    }
  };

  return (
    <View style={styles.container}>
      {/* --- DEBUG BOX (NEW) --- */}
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
            onPress={() => !isDrawing && Alert.alert("Pond Info", `${pond.name}\n${pond.area_sqm} sqm`)}
          />
        ))}

        {coordinates.length > 0 && (
          <Polygon coordinates={coordinates} fillColor="rgba(0, 200, 255, 0.5)" strokeColor="rgba(0, 0, 255, 0.5)" />
        )}
        {coordinates.map((marker, index) => (
          <Marker key={index} coordinate={marker} />
        ))}
      </MapView>

      <View style={styles.controls}>
        {!isDrawing ? (
          <Button title=" + Add New Pond " onPress={() => setIsDrawing(true)} color="#007AFF" />
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.instruction}>Tap map to draw corners</Text>
            <TextInput style={styles.input} placeholder="Pond Name" value={pondName} onChangeText={setPondName} />
            <TouchableOpacity onPress={takePhoto} style={styles.photoBtn}>
              <Text>{pondImage ? "✅ Photo Attached" : "📷 Attach Photo"}</Text>
            </TouchableOpacity>
            <View style={styles.buttons}>
              <Button title="Cancel" onPress={() => { setIsDrawing(false); setCoordinates([]); }} color="red" />
              <Button title="Save" onPress={savePond} color="green" />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  debugBox: {
    position: 'absolute',
    top: 30, // Adjust if you have a notch
    left: 10,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8
  },
  debugText: { color: '#00FF00', fontSize: 12, fontWeight: 'bold' },
  controls: { position: "absolute", bottom: 30, width: "100%", alignItems: "center", paddingHorizontal: 20 },
  searchContainer: { position: "absolute", top: 100, left: 20, right: 20, zIndex: 10, flexDirection: "row", backgroundColor: "white", borderRadius: 8, elevation: 5 },
  searchInput: { flex: 1, padding: 10, fontSize: 16 },
  searchBtn: { backgroundColor: "#007AFF", padding: 10, borderTopRightRadius: 8, borderBottomRightRadius: 8, justifyContent: "center" },
  formContainer: { backgroundColor: "white", padding: 15, borderRadius: 15, width: "100%", elevation: 5 },
  instruction: { textAlign: "center", color: "#666", marginBottom: 10, fontSize: 12 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 16, backgroundColor: "#f9f9f9" },
  photoBtn: { backgroundColor: "#eee", padding: 10, borderRadius: 8, marginBottom: 10, alignItems: "center" },
  buttons: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
});