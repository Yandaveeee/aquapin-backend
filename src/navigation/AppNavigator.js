import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons'; // Built-in icons
import PredictionScreen from '../screens/PredictionScreen';

// Import your screens
import PondMapperScreen from '../screens/PondMapperScreen';
import StockingFormScreen from '../screens/StockingFormScreen';
import HarvestFormScreen from '../screens/HarvestFormScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import PondListScreen from '../screens/PondListScreen';
import MortalityScreen from '../screens/MortalityScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
            
          // 1. Setup Icons based on route name
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Map') {
              iconName = focused ? 'map' : 'map-outline';
            } else if (route.name === 'Stocking') {
              iconName = focused ? 'fish' : 'fish-outline';
            } else if (route.name === 'Harvest') {
              iconName = focused ? 'cash' : 'cash-outline';
            } else if (route.name === 'Predict') {
              iconName = focused ? 'trending-up' : 'trending-up-outline';
            }
            else if (route.name === 'Dashboard') {
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
            }
            else if (route.name === 'List') {
              iconName = focused ? 'list' : 'list-outline';
            }
            else if (route.name === 'Loss') {
              iconName = focused ? 'warning' : 'warning-outline';
            }
            else if (route.name === 'Config') {
              iconName = focused ? 'settings' : 'settings-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        {/* 2. Define the Tabs */}
        <Tab.Screen name="Dashboard" component={AnalyticsScreen} />
        <Tab.Screen name="Map" component={PondMapperScreen} />
        <Tab.Screen name="List" component={PondListScreen} />
        <Tab.Screen name="Stocking" component={StockingFormScreen} />
        <Tab.Screen name="Harvest" component={HarvestFormScreen} />
        <Tab.Screen name="Predict" component={PredictionScreen} />
        <Tab.Screen name="Loss" component={MortalityScreen} />
        <Tab.Screen name="Config" component={SettingsScreen} />

      </Tab.Navigator>
    </NavigationContainer>
  );
}