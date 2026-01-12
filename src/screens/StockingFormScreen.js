import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "../api/client";
import { isOnline, queueAction, invalidateCache, getSmartData } from "../api/offline";

export default function StockingFormScreen({ route, navigation }) {
  const { pondId } = route.params || {};

  const [fryType, setFryType] = useState("Tilapia");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Checking...");
  const [showFrySuggestions, setShowFrySuggestions] = useState(false);

  const [dateError, setDateError] = useState("");
  const [quantityError, setQuantityError] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initial Connection Check
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (quantity || fryType !== "Tilapia") {
      setHasUnsavedChanges(true);
    }
  }, [quantity, fryType]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isSubmitting) return;
      if (!hasUnsavedChanges) return;

      e.preventDefault();
      Alert.alert(
        "Discard changes?",
        "You have unsaved stocking data. Are you sure you want to leave?",
        [
          { text: "Stay", style: "cancel", onPress: () => {} },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, isSubmitting]);

  const checkConnection = async () => {
    const online = await isOnline();
    setConnectionStatus(online ? "Online 🟢" : "Offline 🟠");
  };

  const validateQuantity = (value) => {
    setQuantity(value);
    setQuantityError("");

    if (!value) return;

    const qtyNum = parseInt(value);
    if (isNaN(qtyNum)) {
      setQuantityError("Must be a number");
    } else if (qtyNum <= 0) {
      setQuantityError("Must be greater than 0");
    } else if (qtyNum > 1000000) {
      setQuantityError("Value seems too high. Double check?");
    }
  };

  const validateDate = (value) => {
    setDate(value);
    setDateError("");

    if (!value) return;

    const dateParts = value.split("-");
    if (dateParts.length !== 3) {
      setDateError("Invalid date format (use YYYY-MM-DD)");
      return;
    }

    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const day = parseInt(dateParts[2]);

    const selectedDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (isNaN(selectedDate.getTime())) {
      setDateError("Invalid date format");
      return;
    }

    if (selectedDate > today) {
      setDateError("Date cannot be in the future");
      return;
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setHours(0, 0, 0, 0);

    if (selectedDate < oneYearAgo) {
      setDateError("Date is more than 1 year old. Is this correct?");
    }
  };

  const validateInputs = () => {
    if (!pondId) {
      Alert.alert(
        "Error",
        "Missing Pond ID. Please go back and select a pond."
      );
      return false;
    }

    const qtyNum = parseInt(quantity);
    if (!quantity || isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert("Invalid Input", "Quantity must be a positive number.");
      return false;
    }

    if (qtyNum > 1000000) {
      Alert.alert(
        "High Quantity",
        "The quantity seems unusually high. Please verify."
      );
      return false;
    }

    const dateParts = date.split("-");
    if (dateParts.length !== 3) {
      Alert.alert(
        "Invalid Date",
        "Please enter a valid date in YYYY-MM-DD format."
      );
      return false;
    }

    const selectedDate = new Date(date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      Alert.alert("Invalid Date", "Stocking date cannot be in the future.");
      return false;
    }

    if (!fryType.trim()) {
      Alert.alert("Missing Input", "Please enter the fry type.");
      return false;
    }

    return true;
  };

  // ✅ CHECK DUPLICATES: Only warn, do not block.
  const checkForDuplicates = async () => {
    try {
      const stockKey = `ACTIVE_STOCK_POND_${pondId}`;
      const cached = await AsyncStorage.getItem(stockKey);
      const existingStocks = cached ? JSON.parse(cached) : [];

      const duplicate = existingStocks.find(
        (stock) =>
          stock.fry_type.trim().toLowerCase() ===
            fryType.trim().toLowerCase() && stock.stocking_date === date
      );

      return duplicate;
    } catch (error) {
      console.error("Error checking duplicates:", error);
      return null;
    }
  };

  const handlePreSave = async () => {
    Keyboard.dismiss();

    if (!validateInputs()) return;
    if (isSubmitting) return;

    // ✅ Warn about similar entry, but allow proceeding
    const duplicate = await checkForDuplicates();
    if (duplicate) {
      Alert.alert(
        "Similar Record Found",
        `You already added ${fryType} on ${date} for this pond.\n\nDo you want to add another batch?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Yes, Add Batch",
            onPress: () => confirmAndSave(),
          },
        ]
      );
      return;
    }

    confirmAndSave();
  };

  const confirmAndSave = () => {
    const formattedQty = parseInt(quantity).toLocaleString();
    const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    Alert.alert(
      "Confirm Stocking",
      `Pond ID: ${pondId}\nType: ${fryType}\nQuantity: ${formattedQty} pcs\nDate: ${formattedDate}\n\nSave this record?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm & Save",
          onPress: async () => {
            if (isSubmitting) return;
            setIsSubmitting(true);
            await handleSave();
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      const payload = {
        pond_id: parseInt(pondId),
        stocking_date: date,
        fry_type: fryType.trim(),
        fry_quantity: parseInt(quantity),
      };

      const online = await isOnline();

      if (online) {
        await saveOnline(payload);
      } else {
        await saveOffline(payload);
      }
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveOnline = async (payload) => {
    try {
      const response = await client.post("/api/stocking/", payload);
      const savedStock = response.data;
      
      // 🔥 CRITICAL: Normalize stock response - backend returns fry_quantity, frontend expects current_quantity
      const normalizedStock = {
        ...savedStock,
        current_quantity: savedStock.current_quantity || savedStock.fry_quantity,
        quantity_stocked: savedStock.quantity_stocked || savedStock.fry_quantity,
        label: `${savedStock.fry_type} - ${savedStock.stocking_date} (${savedStock.fry_quantity || savedStock.current_quantity}pcs)`
      };

      await addToStockCache(normalizedStock);
      // Get the updated pond object to pass back
      const updatedPond = await updatePondAggregates(pondId);

      setHasUnsavedChanges(false);

      Alert.alert("Success ✓", "Stocking record saved successfully!", [
        {
          text: "OK",
          onPress: () =>
            navigation.navigate({
              name: "PondDetail",
              params: { pond: updatedPond, forceUpdate: Date.now() },
              merge: true,
            }),
        },
      ]);
    } catch (error) {
      console.error(error);
      const errorMsg =
        error.response?.data?.message ||
        "Could not save log. Please try again.";
      Alert.alert("Error", errorMsg);
      throw error;
    }
  };

  const saveOffline = async (payload) => {
    try {
      const tempId = -Date.now();

      const tempStock = {
        id: tempId,
        pond_id: payload.pond_id,
        fry_type: payload.fry_type,
        quantity_stocked: payload.fry_quantity,
        stocking_date: payload.stocking_date,
        current_quantity: payload.fry_quantity,
        label: `${payload.fry_type} - ${payload.stocking_date} (Offline)`,
        _offline: true,
        _created_at: Date.now(),
      };

      await queueAction("/api/stocking/", payload, "POST", tempId);
      await addToStockCache(tempStock);
      const updatedPond = await updatePondAggregates(pondId);

      setHasUnsavedChanges(false);

      Alert.alert(
        "Saved Offline ☁️",
        "Record saved locally! It will sync automatically when internet returns.",
        [
          {
            text: "OK",
            onPress: () =>
              navigation.navigate({
                name: "PondDetail",
                params: { pond: updatedPond, forceUpdate: Date.now() },
                merge: true,
              }),
          },
        ]
      );
    } catch (error) {
      console.error("Offline save error:", error);
      throw error;
    }
  };

  const addToStockCache = async (stockRecord) => {
    try {
      const stockKey = `ACTIVE_STOCK_POND_${pondId}`;
      const cached = await AsyncStorage.getItem(stockKey);
      const existingStocks = cached ? JSON.parse(cached) : [];

      // ✅ IMPORTANT: Only add stock if it has valid quantity
      if (stockRecord.current_quantity && stockRecord.current_quantity > 0) {
        const updatedStocks = [stockRecord, ...existingStocks];
        await AsyncStorage.setItem(stockKey, JSON.stringify(updatedStocks));
        console.log(
          `✅ Added stock to cache: ${stockRecord.fry_type} (${stockRecord.current_quantity})`
        );
      } else {
        console.warn(
          `⚠️ Skipped adding stock with invalid quantity:`,
          stockRecord
        );
      }
    } catch (error) {
      console.error("Failed to add to stock cache:", error);
    }
  };

  // Inside StockingFormScreen.js

  // CORRECTED updatePondAggregates function - PRIMARY: Fetch from server

  const updatePondAggregates = async (pondId) => {
    try {
      console.log(`🔄 Updating pond aggregates for Pond ${pondId}`);

      // STRATEGY 1: FETCH FROM SERVER (AUTHORITATIVE)
      const cacheKey = `POND_v2_${pondId}`;

      try {
        const serverPond = await getSmartData(
          cacheKey,
          () => client.get(`/api/ponds/${pondId}`),
          { forceRefresh: true }
        );

        if (serverPond) {
          console.log(`✅ Server aggregates fetched successfully`);
          console.log(`   Total Fish: ${serverPond.total_fish}`);
          console.log(`   Species: ${serverPond.current_fish_type}`);

          const aggregates = {
            total_fish: serverPond.total_fish || 0,
            current_fish_type: serverPond.current_fish_type || "",
            last_stocked_at: serverPond.last_stocked_at || null,
            _local_updated_at: Date.now(),
            _aggregates_version: 3,
            _source: "server",
          };

          const v2Key = `POND_v2_${pondId}`;
          const v1Key = `POND_${pondId}`;
          const listKey = "PONDS_LIST";

          const [cachedV2, cachedList] = await Promise.all([
            AsyncStorage.getItem(v2Key),
            AsyncStorage.getItem(listKey),
          ]);

          const basePondData = cachedV2 ? JSON.parse(cachedV2) : { id: pondId };
          const finalPond = {
            ...basePondData,
            ...aggregates,
          };

          const updatePromises = [
            AsyncStorage.setItem(v2Key, JSON.stringify(finalPond)),
            AsyncStorage.setItem(v1Key, JSON.stringify(finalPond)),
          ];

          if (cachedList) {
            const pondsList = JSON.parse(cachedList);
            const updatedList = pondsList.map((p) =>
              String(p.id) === String(pondId) ? finalPond : p
            );
            updatePromises.push(
              AsyncStorage.setItem(listKey, JSON.stringify(updatedList))
            );
          }

          await Promise.all(updatePromises);

          console.log(`✅ Pond ${pondId} aggregates updated from server`);
          return finalPond;
        }
      } catch (serverError) {
        console.warn(`⚠️ Server fetch failed, falling back to local calculation:`, serverError.message);
      }

      // STRATEGY 2: FALLBACK - CALCULATE LOCALLY
      return await updatePondAggregatesLocally(pondId);

    } catch (error) {
      console.error("❌ Fatal error updating aggregates:", error);
      return null;
    }
  };

  const updatePondAggregatesLocally = async (pondId) => {
    try {
      console.log(`📊 Calculating aggregates locally for Pond ${pondId}`);

      const stockKey = `ACTIVE_STOCK_POND_${pondId}`;
      const cachedStocks = await AsyncStorage.getItem(stockKey);
      let stocks = cachedStocks ? JSON.parse(cachedStocks) : [];

      console.log(`   Found ${stocks.length} cached stocks`);

      const activeStocks = stocks.filter((stock) => {
        const hasValidQuantity =
          stock.current_quantity !== undefined &&
          stock.current_quantity !== null &&
          stock.current_quantity > 0;
        const notDepleted = !stock.is_depleted && !stock._depleted;

        return hasValidQuantity && notDepleted;
      });

      console.log(`   Active stocks after filtering: ${activeStocks.length}`);

      if (activeStocks.length === 0) {
        console.log(`⚠️ No active stocks found, returning empty pond state`);
        return await savePondAggregates(pondId, {
          total_fish: 0,
          current_fish_type: "",
          last_stocked_at: null,
          _source: "local_cache_empty",
        });
      }

      const speciesMap = new Map();
      activeStocks.forEach((stock) => {
        if (stock.fry_type && stock.fry_type.trim()) {
          const normalized = stock.fry_type.trim();
          const lowerKey = normalized.toLowerCase();

          if (!speciesMap.has(lowerKey)) {
            speciesMap.set(lowerKey, normalized);
          }
        }
      });

      const speciesList = Array.from(speciesMap.values()).join(", ");

      const totalFish = activeStocks.reduce(
        (sum, stock) => sum + (stock.current_quantity || 0),
        0
      );

      console.log(`📈 Calculated: ${totalFish} fish, Species: "${speciesList}"`);

      let lastStockedAt = null;
      if (activeStocks.length > 0) {
        activeStocks.sort(
          (a, b) => new Date(b.stocking_date) - new Date(a.stocking_date)
        );
        lastStockedAt = activeStocks[0].stocking_date;
      }

      return await savePondAggregates(pondId, {
        total_fish: totalFish,
        current_fish_type: speciesList || "",
        last_stocked_at: lastStockedAt,
        _source: "local_cache",
      });

    } catch (error) {
      console.error("❌ Local aggregates calculation failed:", error);
      return null;
    }
  };

  const savePondAggregates = async (pondId, aggregates) => {
    try {
      const v2Key = `POND_v2_${pondId}`;
      const v1Key = `POND_${pondId}`;
      const listKey = "PONDS_LIST";

      const [cachedV2, cachedList] = await Promise.all([
        AsyncStorage.getItem(v2Key),
        AsyncStorage.getItem(listKey),
      ]);

      const basePondData = cachedV2 ? JSON.parse(cachedV2) : { id: pondId, name: `Pond ${pondId}` };
      const finalPond = {
        ...basePondData,
        ...aggregates,
        _local_updated_at: Date.now(),
        _aggregates_version: 3,
      };

      const updatePromises = [
        AsyncStorage.setItem(v2Key, JSON.stringify(finalPond)),
        AsyncStorage.setItem(v1Key, JSON.stringify(finalPond)),
      ];

      if (cachedList) {
        const list = JSON.parse(cachedList);
        const updated = list.map((p) =>
          String(p.id) === String(pondId) ? finalPond : p
        );
        updatePromises.push(
          AsyncStorage.setItem(listKey, JSON.stringify(updated))
        );
      }

      await Promise.all(updatePromises);

      console.log(`✅ Aggregates saved: total=${aggregates.total_fish}, species="${aggregates.current_fish_type}"`);
      return finalPond;
    } catch (error) {
      console.error("❌ Failed to save aggregates:", error);
      return null;
    }
  };

  const setToday = () => {
    const today = new Date().toISOString().split("T")[0];
    validateDate(today);
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    validateDate(yesterday.toISOString().split("T")[0]);
  };

  const formatQuantityDisplay = (value) => {
    if (!value) return "";
    const num = parseInt(value);
    return isNaN(num) ? value : num.toLocaleString();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.header}>Add Stocking</Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: connectionStatus.includes("Online")
                ? "#E8F5E9"
                : "#FFF3E0",
            },
          ]}
        >
          <Text style={styles.statusText}>{connectionStatus}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color="#1976D2" />
        <Text style={styles.infoText}>
          Record the initial stocking of fry into Pond {pondId}
        </Text>
      </View>

      <Text style={styles.label}>Target Pond ID:</Text>
      <TextInput
        style={[styles.input, styles.disabledInput]}
        value={String(pondId || "Unknown")}
        editable={false}
      />

      <Text style={styles.label}>Stocking Date:</Text>
      <TextInput
        style={[styles.input, dateError ? styles.inputError : null]}
        value={date}
        onChangeText={validateDate}
        placeholder="YYYY-MM-DD"
        maxLength={10}
      />
      {dateError ? <Text style={styles.errorText}>⚠️ {dateError}</Text> : null}

      <View style={styles.quickDateRow}>
        <TouchableOpacity style={styles.quickDateBtn} onPress={setToday}>
          <Text style={styles.quickDateText}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickDateBtn} onPress={setYesterday}>
          <Text style={styles.quickDateText}>Yesterday</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Fry Type:</Text>
      <TextInput
        style={styles.input}
        value={fryType}
        onChangeText={(text) => {
          setFryType(text);
          if (text.length > 0) setShowFrySuggestions(true);
        }}
        onFocus={() => setShowFrySuggestions(true)}
        placeholder="e.g., Tilapia, Bangus"
      />

      {showFrySuggestions && (
        <View style={styles.chipsContainer}>
          {["Tilapia", "Bangus", "Catfish", "Prawn"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, fryType === type && styles.chipSelected]}
              onPress={() => {
                setFryType(type);
                setShowFrySuggestions(false);
                Keyboard.dismiss();
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  fryType === type && styles.chipTextSelected,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Quantity (pieces):</Text>
      <TextInput
        style={[styles.input, quantityError ? styles.inputError : null]}
        placeholder="e.g., 5000"
        keyboardType="numeric"
        value={quantity}
        onChangeText={validateQuantity}
        maxLength={10}
      />
      {quantityError ? (
        <Text style={styles.errorText}>⚠️ {quantityError}</Text>
      ) : null}

      {quantity && !quantityError && (
        <View style={styles.helperCard}>
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          <Text style={styles.helperText}>
            Recording {formatQuantityDisplay(quantity)} fry of {fryType}
          </Text>
        </View>
      )}

      <View style={styles.btnContainer}>
        {isSubmitting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Saving record...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!quantity || !fryType || !!quantityError || !!dateError) &&
                styles.saveButtonDisabled,
            ]}
            onPress={handlePreSave}
            disabled={!quantity || !fryType || !!quantityError || !!dateError}
          >
            <Ionicons
              name="save-outline"
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.saveButtonText}>Save Stocking Record</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isSubmitting && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#f9f9f9",
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginLeft: 10,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: "#1976D2",
  },
  infoText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#1565C0",
    flex: 1,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    marginTop: 15,
    color: "#333",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 14,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#D32F2F",
    borderWidth: 2,
  },
  disabledInput: {
    backgroundColor: "#e0e0e0",
    color: "#666",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  quickDateRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 5,
  },
  quickDateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#E3F2FD",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BBDEFB",
  },
  quickDateText: {
    fontSize: 12,
    color: "#1976D2",
    fontWeight: "600",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#E3F2FD",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#BBDEFB",
  },
  chipSelected: {
    backgroundColor: "#1976D2",
    borderColor: "#1565C0",
  },
  chipText: {
    color: "#1976D2",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#fff",
  },
  helperCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
  },
  helperText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#2E7D32",
    fontStyle: "italic",
  },
  btnContainer: {
    marginTop: 30,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },
  saveButton: {
    flexDirection: "row",
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  saveButtonDisabled: {
    backgroundColor: "#ccc",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    marginTop: 12,
    padding: 14,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
  },
});
