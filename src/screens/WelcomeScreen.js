// ============================================
// IMPROVED WelcomeScreen.js
// ============================================
import React, { useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Dimensions, Animated, ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.content,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Enhanced Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBg}>
              <Text style={styles.logoEmoji}>🐟</Text>
            </View>
            <View style={styles.ripple1} />
            <View style={styles.ripple2} />
          </View>
          
          <Text style={styles.title}>AquaPin 3.0</Text>
          <Text style={styles.subtitle}>
            Smart Aquaculture Management
          </Text>

          {/* Feature Cards */}
          <View style={styles.featuresContainer}>
            <FeatureCard 
              icon="map"
              color="#007AFF"
              title="Pond Mapping"
              description="Draw and track your ponds with GPS precision"
            />
            <FeatureCard 
              icon="analytics"
              color="#34C759"
              title="Yield Tracking"
              description="Monitor harvests and calculate ROI"
            />
            <FeatureCard 
              icon="bulb"
              color="#FF9500"
              title="AI Predictions"
              description="Get smart yield forecasts"
            />
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.navigate('SetupProfile')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.linkButton}
          onPress={() => {/* Navigate to demo/tour */}}
        >
          <Text style={styles.linkText}>Take a Quick Tour</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FeatureCard({ icon, color, title, description }) {
  return (
    <View style={styles.featureCard}>
      <View style={[styles.featureIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F2F7FF'
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 30,
    paddingTop: 60
  },
  
  // Enhanced Logo
  logoContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative'
  },
  logoBg: {
    width: 120,
    height: 120,
    backgroundColor: '#007AFF',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8
  },
  logoEmoji: {
    fontSize: 50
  },
  ripple1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#007AFF',
    opacity: 0.2,
    zIndex: 1
  },
  ripple2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#007AFF',
    opacity: 0.1,
    zIndex: 0
  },
  
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    color: '#1a1a1a', 
    textAlign: 'center', 
    marginBottom: 8
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '500'
  },
  
  // Features
  featuresContainer: {
    width: '100%',
    gap: 15
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  featureText: {
    flex: 1
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4
  },
  featureDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18
  },
  
  // Footer
  footer: { 
    padding: 30, 
    paddingBottom: 50,
    backgroundColor: 'transparent'
  },
  button: { 
    backgroundColor: '#007AFF', 
    paddingVertical: 16, 
    borderRadius: 16, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  buttonText: { 
    color: 'white', 
    fontSize: 18, 
    fontWeight: 'bold'
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center'
  },
  linkText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600'
  }
});