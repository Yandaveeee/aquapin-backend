import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

import WelcomeScreen from '../screens/WelcomeScreen';
import SetupProfileScreen from '../screens/SetupProfileScreen';

const Stack = createStackNavigator();

export default function OnboardingNavigator({ handleFinish }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="SetupProfile">
          {(props) => <SetupProfileScreen {...props} handleFinish={handleFinish} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}