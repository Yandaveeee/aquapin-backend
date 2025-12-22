import React, { useState } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    Button, 
    StyleSheet, 
    ScrollView, 
    ActivityIndicator, 
    TouchableOpacity, 
    FlatList, 
    Alert,
    KeyboardAvoidingView, 
    Platform,
    Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import client from '../api/client';
import { isOnline } from '../api/offline';
import { sendToAquaBot } from '../api/chat'; 

export default function PredictionScreen() {
  const [mode, setMode] = useState('advisor'); 

  // --- CALCULATOR STATE ---
  const [area, setArea] = useState('');
  const [fry, setFry] = useState('');
  const [days, setDays] = useState('120');
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // --- CHAT STATE ---
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I am AquaBot. Ask me anything about fisheries, or send a photo of your pond!", sender: 'bot' }
  ]);
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); 

  // --- HANDLER: CALCULATOR ---
  const handlePredict = async () => {
    if (!area || !fry || !days) return;

    const online = await isOnline();
    if (!online) {
        Alert.alert("Offline", "Prediction requires an internet connection.");
        return;
    }

    setCalcLoading(true);
    try {
      const payload = { fry_quantity: parseInt(fry), days_cultured: parseInt(days), area_sqm: parseFloat(area) };
      const response = await client.post('/api/predict/', payload);
      setCalcResult(response.data);
    } catch (error) {
      alert("Error calculating.");
    } finally {
      setCalcLoading(false);
    }
  };

  // --- NEW: PICK IMAGE FUNCTION ---
  const pickImage = async () => {
    console.log("📸 Camera Button Pressed!"); 

    try {
        // --- COMPATIBILITY FIX ---
        // We use 'MediaTypeOptions' because your installed library version requires it.
        // If we use 'MediaType', the app crashes.
        let result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images, 
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.5,
        });

        if (!result.canceled) {
          setSelectedImage(result.assets[0]);
        }
    } catch (error) {
        console.log("Error picking image:", error);
        alert("Could not open gallery.");
    }
  };

  // --- HANDLER: CHAT ---
  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const online = await isOnline();
    if (!online) {
        const errorMsg = { id: Date.now(), text: "I need an internet connection to answer that.", sender: 'bot' };
        setMessages(prev => [...prev, { id: Date.now(), text: inputText, sender: 'user' }, errorMsg]);
        setInputText('');
        return;
    }

    // 1. Add User Message to Chat
    const newMsg = { 
        id: Date.now(), 
        text: inputText, 
        image: selectedImage ? selectedImage.uri : null, 
        sender: 'user' 
    };
    
    setMessages(prev => [...prev, newMsg]);
    setChatLoading(true);
    
    // Clear input immediately
    const textToSend = inputText;
    const imageToSend = selectedImage;
    setInputText('');
    setSelectedImage(null);

    try {
      // 2. Send to Backend
      const botReplyText = await sendToAquaBot(textToSend, imageToSend);

      const botMsg = { id: Date.now() + 1, text: botReplyText, sender: 'bot' };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      const errorMsg = { id: Date.now() + 1, text: "Sorry, I can't reach the server right now.", sender: 'bot' };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const renderCalculator = () => (
    <ScrollView style={styles.content}>
      <Text style={styles.label}>Pond Area (sqm):</Text>
      <TextInput style={styles.input} placeholder="500" keyboardType="numeric" value={area} onChangeText={setArea} />
      <Text style={styles.label}>Fry Quantity:</Text>
      <TextInput style={styles.input} placeholder="5000" keyboardType="numeric" value={fry} onChangeText={setFry} />
      <Text style={styles.label}>Days:</Text>
      <TextInput style={styles.input} placeholder="120" keyboardType="numeric" value={days} onChangeText={setDays} />
      <Button title={calcLoading ? "Calculating..." : "Predict Yield"} onPress={handlePredict} />
      {calcResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Predicted Yield: {calcResult.predicted_yield_kg} kg</Text>
          <Text style={{color:'green', fontWeight:'bold', fontSize:16}}>Est. Revenue: ₱{calcResult.estimated_revenue.toLocaleString()}</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderChat = () => (
    <View style={{flex: 1}}>
      <FlatList
        data={messages}
        keyExtractor={item => item.id.toString()}
        style={{flex: 1, padding: 10}}
        renderItem={({ item }) => (
          <View style={[
            styles.msgBubble, 
            item.sender === 'user' ? styles.userBubble : styles.botBubble
          ]}>
            {/* Show Image if User Sent one */}
            {item.image && (
                <Image source={{ uri: item.image }} style={styles.chatImage} />
            )}
            <Text style={item.sender === 'user' ? styles.userText : styles.botText}>{item.text}</Text>
          </View>
        )}
      />

      {/* Preview Image before sending */}
      {selectedImage && (
          <View style={styles.previewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removePreview}>
                  <Ionicons name="close-circle" size={24} color="red" />
              </TouchableOpacity>
          </View>
      )}

      <View style={styles.chatInputContainer}>
        {/* Camera Button */}
        <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
            <Ionicons name="camera" size={24} color="#007AFF" />
        </TouchableOpacity>

        <TextInput 
            style={styles.chatInput} 
            placeholder={selectedImage ? "Add a caption..." : "Ask a question..."}
            value={inputText}
            onChangeText={setInputText} 
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
            {chatLoading ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="send" size={20} color="white" />}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, mode === 'advisor' && styles.activeTab]} onPress={() => setMode('advisor')}>
            <Text style={[styles.tabText, mode === 'advisor' && styles.activeTabText]}>🤖 AI Advisor</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'calculator' && styles.activeTab]} onPress={() => setMode('calculator')}>
            <Text style={[styles.tabText, mode === 'calculator' && styles.activeTabText]}>🧮 Calculator</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0} 
      >
        {mode === 'calculator' ? renderCalculator() : renderChat()}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 40 },
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', elevation: 2 },
  tab: { flex: 1, padding: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#007AFF' },
  tabText: { fontSize: 16, color: '#666' },
  activeTabText: { color: '#007AFF', fontWeight: 'bold' },
  content: { padding: 20 },
  label: { fontSize: 16, marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 5, backgroundColor: 'white', marginBottom: 15 },
  resultCard: { marginTop: 20, padding: 20, backgroundColor: '#E3F2FD', borderRadius: 10, borderWidth: 1, borderColor: '#2196F3' },
  resultTitle: { fontSize: 18, fontWeight: 'bold' },
  
  // Chat Styles
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 15, marginBottom: 10 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  botBubble: { alignSelf: 'flex-start', backgroundColor: '#E0E0E0' },
  userText: { color: 'white' },
  botText: { color: '#333' },
  chatInputContainer: { flexDirection: 'row', padding: 10, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  chatInput: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10, height: 40 },
  sendBtn: { backgroundColor: '#007AFF', padding: 10, borderRadius: 50, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  
  // --- UPDATED BUTTON STYLE ---
  iconBtn: { 
    marginRight: 10, 
    padding: 10,       
    backgroundColor: '#E3F2FD', 
    borderRadius: 50,  
  },

  // New Image Styles
  chatImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 5 },
  previewContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#eee', alignItems: 'center' },
  previewImage: { width: 50, height: 50, borderRadius: 5, marginRight: 10 },
  removePreview: { marginLeft: 'auto' }
});