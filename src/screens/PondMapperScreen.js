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
  Image,
} from "react-native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons"; // For Search Icon
import client from "../api/client";
// 1. IMPORT OFFLINE HELPERS
import { isOnline, queueAction, getSmartData } from '../api/offline';

export default function PondMapperScreen() {
  const mapRef = useRef(null); // <--- Reference to control the map
  const [region, setRegion] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedPonds, setSavedPonds] = useState([]);

  // Form State
  const [pondName, setPondName] = useState("");
  const [pondImage, setPondImage] = useState(null);

  // Search State
  const [searchText, setSearchText] = useState("");

  // --- UPDATED: Works Offline ---
  const fetchPonds = async () => {
    // We use the SAME cache key as the List Screen so they share data
    const data = await getSmartData('PONDS_LIST', '/api/ponds/');
    if (data) {
      setSavedPonds(data);
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied");
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      fetchPonds();
    })();
  }, []);

  // --- NEW: SEARCH FUNCTION ---
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    
    // Check connection for search
    const online = await isOnline();
    if (!online) {
        Alert.alert("Offline", "Search requires internet connection.");
        return;
    }

    Keyboard.dismiss(); // Hide keyboard

    try {
      // 1. Convert Text to Coordinates
      const geocodedLocation = await Location.geocodeAsync(searchText);

      if (geocodedLocation.length > 0) {
        const result = geocodedLocation[0];
        const newRegion = {
          latitude: result.latitude,
          longitude: result.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };

        // 2. Fly the Map to that location
        mapRef.current.animateToRegion(newRegion, 1000);
        setRegion(newRegion);
      } else {
        Alert.alert("Not Found", "Could not find that location.");
      }
    } catch (error) {
      Alert.alert("Error", "Search failed. Check your internet.");
    }
  };

  const handleMapPress = (e) => {
    if (!isDrawing) return;
    setCoordinates([...coordinates, e.nativeEvent.coordinate]);
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Refused", "You need to allow camera access.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled) {
      setPondImage(result.assets[0].base64);
      Alert.alert("Photo Taken!", "Image attached successfully.");
    }
  };

  const savePond = async () => {
    if (coordinates.length < 3) {
      Alert.alert("Error", "Draw at least 3 corners.");
      return;
    }
    if (!pondName.trim()) {
      Alert.alert("Missing Name", "Please name this pond.");
      return;
    }

    // Check connection first
    const online = await isOnline();
    let addressString = "Pinned Location (Offline)";

    // Only try to get address if online
    if (online) {
      try {
        const firstPoint = coordinates[0];
        const addressList = await Location.reverseGeocodeAsync({
          latitude: firstPoint.latitude,
          longitude: firstPoint.longitude,
        });

        if (addressList.length > 0) {
          const addr = addressList[0];
          addressString = `${addr.city || addr.subregion}, ${
            addr.region || addr.country
          }`;
        }
      } catch (e) {
        console.log("Geocode failed");
      }
    }

    const payload = {
      name: pondName,
      location_desc: addressString,
      coordinates: coordinates.map((c) => [c.latitude, c.longitude]),
      image_base64: pondImage,
    };

    if (online) {
      // --- ONLINE MODE ---
      try {
        const response = await client.post("/api/ponds/", payload);
        const area = response.data.area_sqm;

        Alert.alert("Success", `Saved: ${pondName}\nSize: ${area} sqm`);

        setCoordinates([]);
        setPondName("");
        setPondImage(null);
        setIsDrawing(false);
        fetchPonds();
      } catch (error) {
        console.error(error);
        Alert.alert("Error", "Could not save pond.");
      }
    } else {
      // --- OFFLINE MODE ---
      try {
        await queueAction("/api/ponds/", payload);
        Alert.alert(
          "Saved Offline ☁️",
          "Pond map saved to device. Area size will be calculated when you Sync."
        );

        // Cleanup locally
        setCoordinates([]);
        setPondName("");
        setPondImage(null);
        setIsDrawing(false);
      } catch (e) {
        Alert.alert("Error", "Could not save offline.");
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* SEARCH BAR (Only shows when NOT drawing) */}
      {!isDrawing && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search location (e.g. Gonzaga)..."
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}>
            <Ionicons name="search" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {region ? (
        <MapView
          ref={mapRef} // <--- CONNECT REF HERE
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={region}
          onPress={handleMapPress}
          mapType="hybrid"
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={true}
          showsCompass={true}
        >
          {savedPonds.map((pond) => (
            <Polygon
              key={pond.id}
              coordinates={pond.coordinates.map((c) => ({
                latitude: c[0],
                longitude: c[1],
              }))}
              // FIX: Force green color for everyone
              fillColor="rgba(0, 255, 0, 0.4)"
              strokeColor="rgba(255,255,255,0.8)"
              strokeWidth={2}
              tappable={true}
              onPress={() =>
                !isDrawing &&
                Alert.alert(
                  "Pond Info",
                  `ID: ${pond.id}\nName: ${pond.name}\nSize: ${pond.area_sqm} sqm`
                )
              }
            />
          ))}

          {coordinates.length > 0 && (
            <Polygon
              coordinates={coordinates}
              fillColor="rgba(0, 200, 255, 0.5)"
              strokeColor="rgba(0, 0, 255, 0.5)"
            />
          )}
          {coordinates.map((marker, index) => (
            <Marker key={index} coordinate={marker} />
          ))}
        </MapView>
      ) : (
        <Text style={{ textAlign: "center", marginTop: 50 }}>Locating...</Text>
      )}

      <View style={styles.controls}>
        {!isDrawing ? (
          <Button
            title=" + Add New Pond "
            onPress={() => setIsDrawing(true)}
            color="#007AFF"
          />
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.instruction}>
              Tap map to draw • Enter Name • Attach Photo
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Pond Name (e.g. North Sector)"
              value={pondName}
              onChangeText={setPondName}
            />

            <TouchableOpacity
              onPress={takePhoto}
              style={{
                backgroundColor: pondImage ? "#e8f5e9" : "#eee",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: pondImage ? "green" : "black" }}>
                {pondImage ? "✅ Photo Attached (Retake?)" : "📷 Attach Photo"}
              </Text>
            </TouchableOpacity>

            <View style={styles.buttons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setIsDrawing(false);
                  setCoordinates([]);
                  setPondName("");
                  setPondImage(null);
                }}
                color="red"
              />
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
  controls: {
    position: "absolute",
    bottom: 30,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  // Search Bar Styles
  searchContainer: {
    position: "absolute",
    top: 50, // Below status bar
    left: 20,
    right: 20,
    zIndex: 10, // Float on top of map
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: "#007AFF",
    padding: 10,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: "center",
  },

  formContainer: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 15,
    width: "100%",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
  },
  instruction: {
    textAlign: "center",
    color: "#666",
    marginBottom: 10,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  buttons: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
});