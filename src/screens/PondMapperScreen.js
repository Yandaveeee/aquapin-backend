import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Button, Alert, TextInput, TouchableOpacity } from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker'; // Camera Library
import client from '../api/client'; 

export default function PondMapperScreen() {
  const [region, setRegion] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedPonds, setSavedPonds] = useState([]);
  
  // Form State
  const [pondName, setPondName] = useState('');
  const [pondImage, setPondImage] = useState(null); // Stores the photo string

  // 1. Fetch Ponds on Load
  const fetchPonds = async () => {
    try {
      const response = await client.get('/api/ponds/');
      setSavedPonds(response.data);
    } catch (error) {
      console.log("Error fetching ponds:", error);
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied');
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

  const handleMapPress = (e) => {
    if (!isDrawing) return;
    setCoordinates([...coordinates, e.nativeEvent.coordinate]);
  };

  // 2. CAMERA FUNCTION (Moved outside savePond so buttons can see it)
  const takePhoto = async () => {
    // A. Ask Permission
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Refused", "You need to allow camera access.");
      return;
    }

    // B. Open Camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3, // Low quality to keep DB happy
      base64: true, // We need the text string
    });

    if (!result.canceled) {
      setPondImage(result.assets[0].base64);
      Alert.alert("Photo Taken!", "Image attached successfully.");
    }
  };

  // 3. SAVE LOGIC
  const savePond = async () => {
    if (coordinates.length < 3) {
      Alert.alert("Error", "Draw at least 3 corners.");
      return;
    }
    
    if (!pondName.trim()) {
      Alert.alert("Missing Name", "Please name this pond.");
      return;
    }

    try {
      // A. Get Address
      let addressString = "Unknown Location";
      const firstPoint = coordinates[0];
      const addressList = await Location.reverseGeocodeAsync({ 
          latitude: firstPoint.latitude, 
          longitude: firstPoint.longitude 
      });

      if (addressList.length > 0) {
        const addr = addressList[0];
        addressString = `${addr.city || addr.subregion}, ${addr.region || addr.country}`;
      }

      console.log("Detected Address:", addressString);

      // B. Send to Backend
      const payload = {
        name: pondName,
        location_desc: addressString,
        coordinates: coordinates.map(c => [c.latitude, c.longitude]),
        image_base64: pondImage // Send the photo
      };

      const response = await client.post('/api/ponds/', payload);
      const area = response.data.area_sqm;
      
      Alert.alert(
          "Success", 
          `Saved: ${pondName}\nLocation: ${addressString}\nSize: ${area} sqm`
      );
      
      // C. Reset Form
      setCoordinates([]);
      setPondName('');
      setPondImage(null);
      setIsDrawing(false);
      fetchPonds();

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Could not save pond.");
    }
  };

  return (
    <View style={styles.container}>
      {region ? (
        <MapView
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
          {/* Saved Ponds */}
          {savedPonds.map((pond) => (
            <Polygon
              key={pond.id}
              coordinates={pond.coordinates.map(c => ({ latitude: c[0], longitude: c[1] }))}
              fillColor={pond.name.includes("(None)") ? "rgba(128, 128, 128, 0.5)" : "rgba(0, 255, 0, 0.4)"}
              strokeColor="rgba(255,255,255,0.8)"
              strokeWidth={2}
              tappable={true}
              onPress={() => !isDrawing && Alert.alert("Pond Info", `ID: ${pond.id}\nName: ${pond.name}\nSize: ${pond.area_sqm} sqm`)}
            />
          ))}

          {/* Current Drawing */}
          {coordinates.length > 0 && (
            <Polygon coordinates={coordinates} fillColor="rgba(0, 200, 255, 0.5)" strokeColor="rgba(0, 0, 255, 0.5)" />
          )}
          {coordinates.map((marker, index) => (
            <Marker key={index} coordinate={marker} />
          ))}
        </MapView>
      ) : (
        <Text style={{textAlign:'center', marginTop: 50}}>Locating...</Text>
      )}

      <View style={styles.controls}>
        {!isDrawing ? (
          <Button title=" + Add New Pond " onPress={() => setIsDrawing(true)} color="#007AFF" />
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.instruction}>Tap map to draw • Enter Name • Attach Photo</Text>
            
            <TextInput 
                style={styles.input}
                placeholder="Pond Name (e.g. North Sector)"
                value={pondName}
                onChangeText={setPondName}
            />

            {/* CAMERA BUTTON */}
            <TouchableOpacity 
                onPress={takePhoto} 
                style={{backgroundColor: pondImage ? '#e8f5e9' : '#eee', padding: 10, borderRadius: 8, marginBottom: 10, alignItems: 'center'}}
            >
                <Text style={{color: pondImage ? 'green' : 'black'}}>
                    {pondImage ? "✅ Photo Attached (Retake?)" : "📷 Attach Photo"}
                </Text>
            </TouchableOpacity>

            <View style={styles.buttons}>
                <Button title="Cancel" onPress={() => {setIsDrawing(false); setCoordinates([]); setPondName(''); setPondImage(null)}} color="red" />
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
  map: { width: '100%', height: '100%' },
  controls: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    width: '100%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
  },
  instruction: { textAlign: 'center', color: '#666', marginBottom: 10, fontSize: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 16, backgroundColor: '#f9f9f9' },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }
});