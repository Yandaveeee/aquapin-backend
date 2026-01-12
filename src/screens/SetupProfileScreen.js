// ============================================
// IMPROVED SetupProfileScreen.js
// ============================================
import React, { useState, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Alert, KeyboardAvoidingView, 
  Platform, ScrollView, Animated 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SetupProfileScreen({ handleFinish }) {
  const [name, setName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [location, setLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateStep = (direction) => {
    Animated.timing(slideAnim, {
      toValue: direction === 'next' ? -20 : 20,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(0);
    });
  };

  const handleNext = () => {
    if (currentStep === 1 && !name.trim()) {
      Alert.alert("Missing Info", "Please enter your name.");
      return;
    }
    
    if (currentStep < 3) {
      animateStep('next');
      setCurrentStep(currentStep + 1);
    } else {
      onSave();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      animateStep('back');
      setCurrentStep(currentStep - 1);
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("Missing Info", "Please enter your name.");
      return;
    }

    setIsSaving(true);

    const userProfile = {
      name: name.trim(),
      farmName: farmName.trim() || "My Farm",
      location: location.trim() || "",
      phoneNumber: phoneNumber.trim() || "",
      joinedDate: new Date().toISOString(),
      isSetup: true,
      onboardingCompleted: true,
      version: "3.0"
    };

    try {
      await AsyncStorage.setItem('USER_PROFILE', JSON.stringify(userProfile));
      
      // Optional: Track analytics
      console.log('User profile created:', userProfile);
      
      if (handleFinish) {
        handleFinish(); 
      }
    } catch (e) {
      Alert.alert("Error", "Could not save profile. Please try again.");
      console.error('Profile save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return (
          <Animated.View style={[styles.stepContainer, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="person" size={32} color="#007AFF" />
            </View>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepSubtitle}>This will personalize your experience</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Enter your full name" 
              value={name} 
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleNext}
            />
          </Animated.View>
        );
      
      case 2:
        return (
          <Animated.View style={[styles.stepContainer, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="business" size={32} color="#34C759" />
            </View>
            <Text style={styles.stepTitle}>Farm Details</Text>
            <Text style={styles.stepSubtitle}>Help us know your operation better</Text>
            
            <Text style={styles.inputLabel}>Farm Name (Optional)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Cagayan Fishery" 
              value={farmName} 
              onChangeText={setFarmName}
              returnKeyType="next"
            />
            
            <Text style={styles.inputLabel}>Location (Optional)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Bantay, Ilocos Sur" 
              value={location} 
              onChangeText={setLocation}
              returnKeyType="next"
              onSubmitEditing={handleNext}
            />
          </Animated.View>
        );
      
      case 3:
        return (
          <Animated.View style={[styles.stepContainer, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="call" size={32} color="#FF9500" />
            </View>
            <Text style={styles.stepTitle}>Contact Info</Text>
            <Text style={styles.stepSubtitle}>Optional but helpful for records</Text>
            
            <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 09XX XXX XXXX" 
              value={phoneNumber} 
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              returnKeyType="done"
              onSubmitEditing={onSave}
            />
            
            <View style={styles.benefitsBox}>
              <Text style={styles.benefitsTitle}>🎉 You're all set!</Text>
              <Text style={styles.benefitsText}>
                • Track unlimited ponds{'\n'}
                • Record harvests & sales{'\n'}
                • Get AI-powered insights{'\n'}
                • Export reports anytime
              </Text>
            </View>
          </Animated.View>
        );
      
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(currentStep / 3) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>Step {currentStep} of 3</Text>
        </View>

        {/* Back Button */}
        {currentStep > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}

        {/* Step Content */}
        <View style={styles.content}>
          {renderStep()}
        </View>

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.button, isSaving && styles.buttonDisabled]} 
            onPress={handleNext}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <Text style={styles.buttonText}>Setting up...</Text>
            ) : (
              <>
                <Text style={styles.buttonText}>
                  {currentStep === 3 ? "Complete Setup 🚀" : "Continue"}
                </Text>
                {currentStep < 3 && (
                  <Ionicons name="arrow-forward" size={20} color="white" />
                )}
              </>
            )}
          </TouchableOpacity>

          {currentStep < 3 && (
            <TouchableOpacity 
              style={styles.skipButton}
              onPress={() => setCurrentStep(3)}
            >
              <Text style={styles.skipText}>Skip to end</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F2F7FF'
  },
  scrollContent: {
    flexGrow: 1,
    padding: 30,
    paddingTop: 60
  },
  
  // Progress
  progressContainer: {
    marginBottom: 30
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
  },
  
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start'
  },
  
  content: {
    flex: 1,
    justifyContent: 'center'
  },
  
  // Step Content
  stepContainer: {
    alignItems: 'center'
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32
  },
  
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
    marginTop: 16,
    alignSelf: 'flex-start',
    width: '100%'
  },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#1a1a1a'
  },
  
  // Benefits Box
  benefitsBox: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 12,
    marginTop: 24,
    width: '100%',
    borderLeftWidth: 3,
    borderLeftColor: '#34C759'
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 12
  },
  benefitsText: {
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 22
  },
  
  // Footer
  footer: {
    marginTop: 30,
    paddingTop: 20
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
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
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold'
  },
  skipButton: {
    marginTop: 16,
    alignItems: 'center'
  },
  skipText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600'
  }
});