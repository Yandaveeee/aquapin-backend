import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Import your MAIN App (The Tabs)
import AppNavigator from './src/navigation/AppNavigator';

// 2. Import your ONBOARDING App (The Welcome Screens)
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import UpdateChecker from './src/components/UpdateChecker';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const profile = await AsyncStorage.getItem('USER_PROFILE');
        if (profile === null) {
          setIsFirstLaunch(true); // New User -> Show Welcome
        } else {
          setIsFirstLaunch(false); // Existing User -> Show Tabs
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  const handleOnboardingFinish = () => {
    setIsFirstLaunch(false); // Switch to Main App
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <UpdateChecker />
      </View>
    );
  }

  // RENDER LOGIC:
  if (isFirstLaunch) {
    return <OnboardingNavigator handleFinish={handleOnboardingFinish} />;
  } else {
    return <AppNavigator />;
  }
}