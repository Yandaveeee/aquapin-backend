import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Button, Alert, TextInput } from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import client from '../api/client'; 

export default function PondMapperScreen() {
  const [region, setRegion] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedPonds, setSavedPonds] = useState([]);
  
  // NEW: State for the custom name
  const [pondName, setPondName] = useState('');

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

  // 2. Updated Save Logic
  const savePond = async () => {
    if (coordinates.length < 3) {
      Alert.alert("Error", "Draw at least 3 corners on the map.");
      return;
    }
    
    // NEW: Validation to ensure name is not empty
    if (!pondName.trim()) {
      Alert.alert("Missing Name", "Please give this pond a name (e.g., 'North Pond').");
      return;
    }

    try {
      const payload = {
        name: pondName, // <--- SEND THE CUSTOM NAME HERE
        coordinates: coordinates.map(c => [c.latitude, c.longitude])
      };

      const response = await client.post('/api/ponds/', payload);
      const area = response.data.area_sqm;
      
      Alert.alert("Success", `Saved "${pondName}"!\nSize: ${area} sqm`);
      
      // Reset everything
      setCoordinates([]);
      setPondName(''); // Clear the name box
      setIsDrawing(false);
      fetchPonds(); // Refresh map to show new color

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
          mapType="satellite"
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

      {/* 3. Updated Controls with Input Box */}
      <View style={styles.controls}>
        {!isDrawing ? (
          <Button title=" + Add New Pond " onPress={() => setIsDrawing(true)} color="#007AFF" />
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.instruction}>Tap the map to draw corners</Text>
            
            {/* NEW: Input Box */}
            <TextInput 
                style={styles.input}
                placeholder="Enter Pond Name (e.g. North Sector)"
                value={pondName}
                onChangeText={setPondName}
            />

            <View style={styles.buttons}>
                <Button title="Cancel" onPress={() => {setIsDrawing(false); setCoordinates([]); setPondName('')}} color="red" />
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
  // New Styles for the Input Box Container
  formContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    width: '100%',
    elevation: 5, // Shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
  },
  instruction: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 10,
    fontSize: 12
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9'
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  }
});