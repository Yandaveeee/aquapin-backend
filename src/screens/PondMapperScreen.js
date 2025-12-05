import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Button, Alert } from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import client from '../api/client'; // Import our API setup

export default function PondMapperScreen() {
  const [region, setRegion] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // 1. Get User Location on Load
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005, // Zoom level
        longitudeDelta: 0.005,
      });
    })();
  }, []);

  // 2. Handle Tap on Map
  const handleMapPress = (e) => {
    if (!isDrawing) return;
    const newCoord = e.nativeEvent.coordinate;
    setCoordinates([...coordinates, newCoord]);
  };

  // 3. Send to Backend
  const savePond = async () => {
    if (coordinates.length < 3) {
      Alert.alert("Error", "A pond needs at least 3 points!");
      return;
    }

    try {
      // Transform data to match Pydantic Schema
      const payload = {
        name: "My New Pond", // Hardcoded for now
        coordinates: coordinates.map(c => [c.latitude, c.longitude])
      };

      const response = await client.post('/api/ponds/', payload);
      
      Alert.alert("Success", `Pond Saved! ID: ${response.data.id}`);
      setCoordinates([]);
      setIsDrawing(false);
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Could not save pond. Check backend connection.");
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
          {/* Draw the Polygon as user taps */}
          {coordinates.length > 0 && (
            <Polygon
              coordinates={coordinates}
              fillColor="rgba(0, 200, 255, 0.5)"
              strokeColor="rgba(0, 0, 255, 0.5)"
            />
          )}
          
          {/* Show markers at tap points */}
          {coordinates.map((marker, index) => (
            <Marker key={index} coordinate={marker} />
          ))}
        </MapView>
      ) : (
        <Text style={{textAlign:'center', marginTop: 50}}>Locating you...</Text>
      )}

      <View style={styles.controls}>
        {!isDrawing ? (
          <Button title="Start Mapping" onPress={() => setIsDrawing(true)} />
        ) : (
          <View style={{flexDirection: 'row', gap: 10}}>
            <Button title="Clear" onPress={() => setCoordinates([])} color="red" />
            <Button title="Save Pond" onPress={savePond} />
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
    bottom: 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
  }
});