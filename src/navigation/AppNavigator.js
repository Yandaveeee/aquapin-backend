import React, { useEffect } from "react";
import { Alert } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";

// SCREENS
import PondMapperScreen from "../screens/PondMapperScreen";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import PondListScreen from "../screens/PondListScreen";
import PredictionScreen from "../screens/PredictionScreen";
import PondDetailScreen from "../screens/PondDetailScreen";
import StockingFormScreen from "../screens/StockingFormScreen";
import HarvestFormScreen from "../screens/HarvestFormScreen";
import MortalityScreen from "../screens/MortalityScreen";
import HistoryScreen from "../screens/HistoryScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 1. MAIN TABS
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === "Dashboard") iconName = focused ? "stats-chart" : "stats-chart-outline";
          else if (route.name === "Map") iconName = focused ? "map" : "map-outline";
          else if (route.name === "List") iconName = focused ? "list" : "list-outline";
          else if (route.name === "Predict") iconName = focused ? "trending-up" : "trending-up-outline";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "gray",
      })}
    >
      <Tab.Screen name="Map" component={PondMapperScreen} />
      <Tab.Screen name="Dashboard" component={AnalyticsScreen} />
      <Tab.Screen name="List" component={PondListScreen} />
      <Tab.Screen name="Predict" component={PredictionScreen} />
    </Tab.Navigator>
  );
}

// 2. APP NAVIGATOR
export default function AppNavigator() {

  // --- ✅ REAL PRODUCTION UPDATE LOGIC ---
  async function onFetchUpdateAsync() {
    try {
      // Check server for real updates
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        // Download the update
        await Updates.fetchUpdateAsync();
        
        // Ask user to restart
        Alert.alert(
          "Update Available",
          "A new version of AquaPin is available. Restart now to apply updates?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart Now",
              onPress: async () => {
                await Updates.reloadAsync(); // This actually restarts the app!
              },
            },
          ]
        );
      }
    } catch (error) {
      // It's normal for this to fail in Development or if Offline
      console.log("Error checking for updates:", error);
    }
  }

  useEffect(() => {
    // Only run this check in the Real App (Production), not in Expo Go
    if (!__DEV__) {
      onFetchUpdateAsync();
    }
  }, []);
  // ---------------------------------------

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="PondDetail" component={PondDetailScreen} options={{ title: "Pond Dashboard" }} />
        <Stack.Screen name="StockingForm" component={StockingFormScreen} options={{ title: "Add Stocking", headerShown: false }} />
        <Stack.Screen name="HarvestForm" component={HarvestFormScreen} options={{ title: "Record Harvest" }} />
        <Stack.Screen name="MortalityForm" component={MortalityScreen} options={{ title: "Report Mortality" }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}