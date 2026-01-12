// utils/csvExport.js

// ✅ FIX: Import from 'legacy' to use writeAsStringAsync in SDK 52+
import * as FileSystem from 'expo-file-system/legacy'; 
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const exportToCSV = async (data, filename = 'export') => {
  if (!data || data.length === 0) {
    Alert.alert("No Data", "There is no history to export.");
    return;
  }

  try {
    const headers = Object.keys(data[0]).join(',');
    
    const rows = data.map(obj => 
      Object.values(obj).map(val => {
        const safeVal = val === null || val === undefined ? '' : String(val);
        return `"${safeVal.replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvString = `${headers}\n${rows.join('\n')}`;

    const fileUri = `${FileSystem.cacheDirectory}${filename}_${Date.now()}.csv`;
    
    // This will now work correctly with the legacy import
    await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: 'utf8' });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Export ${filename}`,
        UTI: 'public.comma-separated-values-text'
      });
    } else {
      Alert.alert("Error", "Sharing is not available on this device");
    }
  } catch (error) {
    console.error("CSV Export Failed:", error);
    Alert.alert("Export Failed", "Could not generate CSV file.");
  }
};