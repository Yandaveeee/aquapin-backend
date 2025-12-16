import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Placeholder for Logo - You can add <Image source={...} /> here */}
        <View style={styles.logoPlaceholder}>
            <Text style={{fontSize: 40}}>🐟</Text>
        </View>
        
        <Text style={styles.title}>Welcome to AquaPin</Text>
        <Text style={styles.subtitle}>
          Your smart companion for pond mapping, harvest tracking, and AI-driven yield prediction.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.navigate('SetupProfile')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E3F2FD', justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  logoPlaceholder: { width: 100, height: 100, backgroundColor: '#BBDEFB', borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1565C0', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#555', textAlign: 'center', lineHeight: 24 },
  footer: { padding: 30, paddingBottom: 50 },
  button: { backgroundColor: '#1565C0', paddingVertical: 15, borderRadius: 30, alignItems: 'center', elevation: 5 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});