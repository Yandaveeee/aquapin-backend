import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    StyleSheet, 
    ScrollView, 
    ActivityIndicator, 
    TouchableOpacity, 
    FlatList, 
    Alert,
    KeyboardAvoidingView, 
    Platform,
    Image,
    Modal,
    SafeAreaView,
    StatusBar // <--- ADDED: Required to calculate top padding on Android
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import client from '../api/client';
import { isOnline } from '../api/offline';
import { sendToAquaBot } from '../api/chat'; 

export default function PredictionScreen() {
  const [mode, setMode] = useState('advisor'); 
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // --- CALCULATOR STATE ---
  const [area, setArea] = useState('');
  const [fry, setFry] = useState('');
  const [days, setDays] = useState('120');
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcErrors, setCalcErrors] = useState({});

  // --- CHAT STATE ---
  const [allMessages, setAllMessages] = useState([]); 
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentFilter, setCurrentFilter] = useState('All Time');
  const [historyLoading, setHistoryLoading] = useState(true);

  // Refs
  const flatListRef = useRef(null);
  const isSendingRef = useRef(false);
  const isCalculatingRef = useRef(false);

  // --- CHECK NETWORK STATUS ---
  useEffect(() => {
    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkNetworkStatus = async () => {
    const online = await isOnline();
    setIsOffline(!online);
  };

  // --- FETCH HISTORY ---
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await client.get('/api/chat/history');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const validMessages = response.data
          .filter(msg => msg.id && msg.timestamp && msg.text)
          .map(msg => ({
            ...msg,
            timestamp: msg.timestamp || new Date().toISOString()
          }));
        setAllMessages(validMessages);
      } else {
        const welcome = [{ 
          id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
          text: "Hello! I am AquaBot. 🧠 Ask me anything about aquaculture!", 
          sender: 'bot', 
          timestamp: new Date().toISOString() 
        }];
        setAllMessages(welcome);
      }
    } catch (error) {
      console.log("Could not fetch history:", error);
      const welcome = [{ 
        id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
        text: "Hello! I am AquaBot. 🧠 (Offline mode - history unavailable)", 
        sender: 'bot', 
        timestamp: new Date().toISOString() 
      }];
      setAllMessages(welcome);
    } finally {
      setHistoryLoading(false);
    }
  };

  // --- DERIVED STATE ---
  const filteredMessages = useMemo(() => {
    if (currentFilter === 'All Time') {
      return allMessages;
    }
    return allMessages.filter(msg => {
      try {
        const msgDate = new Date(msg.timestamp).toDateString();
        return msgDate === currentFilter;
      } catch {
        return false;
      }
    });
  }, [allMessages, currentFilter]);

  const sidebarDateGroups = useMemo(() => {
    const groups = {};
    allMessages.forEach(msg => {
      try {
        const date = new Date(msg.timestamp).toDateString();
        if (!groups[date]) groups[date] = 0;
        groups[date]++;
      } catch {
        // Skip invalid timestamps
      }
    });
    return Object.entries(groups)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .map(([date, count]) => ({ date, count }));
  }, [allMessages]);

  const filterChatByDate = useCallback((dateString) => {
    setCurrentFilter(dateString === 'All' ? 'All Time' : dateString);
    setSidebarVisible(false);
  }, []);

  // --- CALCULATOR VALIDATION ---
  const validateCalculatorInputs = useCallback(() => {
    const errors = {};
    const areaNum = parseFloat(area);
    const fryNum = parseInt(fry);
    const daysNum = parseInt(days);

    if (!area || isNaN(areaNum) || areaNum <= 0) {
      errors.area = 'Area must be greater than 0';
    } else if (areaNum > 100000) {
      errors.area = 'Area seems unreasonably large';
    }

    if (!fry || isNaN(fryNum) || fryNum <= 0) {
      errors.fry = 'Fry quantity must be greater than 0';
    } else if (fryNum > 10000000) {
      errors.fry = 'Fry quantity seems unreasonably high';
    }

    if (!days || isNaN(daysNum) || daysNum <= 0) {
      errors.days = 'Days must be greater than 0';
    } else if (daysNum > 365) {
      errors.days = 'Days cultured exceeds 1 year';
    }

    setCalcErrors(errors);
    return Object.keys(errors).length === 0;
  }, [area, fry, days]);

  const handlePredict = async () => {
    if (isCalculatingRef.current || calcLoading) return;

    if (!validateCalculatorInputs()) {
      Alert.alert('Invalid Input', 'Please correct the errors before calculating.');
      return;
    }

    if (isOffline) {
      Alert.alert('Offline', 'Calculator requires internet connection.');
      return;
    }

    isCalculatingRef.current = true;
    setCalcLoading(true);
    setCalcResult(null);

    try {
      const payload = { 
        fry_quantity: parseInt(fry), 
        days_cultured: parseInt(days), 
        area_sqm: parseFloat(area) 
      };
      
      const response = await client.post('/api/predict/', payload);
      
      if (response.data) {
        setCalcResult(response.data);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Prediction error:', error);
      Alert.alert(
        'Calculation Failed', 
        error.response?.data?.message || 'Could not calculate yield. Please try again.'
      );
    } finally {
      setCalcLoading(false);
      isCalculatingRef.current = false;
    }
  };

  useEffect(() => {
    if (calcResult) {
      setCalcResult(null);
    }
  }, [area, fry, days]);

  // --- IMAGE PICKER ---
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera roll permission is needed to pick images.');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true, 
        aspect: [4, 3], 
        quality: 0.5, 
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not open image gallery.');
    }
  };

  // --- SEND MESSAGE ---
  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;
    if (isSendingRef.current || chatLoading) return;

    if (isOffline) {
      Alert.alert('Offline', 'Chat requires internet connection to send messages.');
      return;
    }

    isSendingRef.current = true;
    setChatLoading(true);

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const userMsgId = `user_${timestamp}_${randomId}`;
    const botMsgId = `bot_${timestamp + 1}_${randomId}`;

    const userMsg = { 
      id: userMsgId,
      text: inputText.trim() || '[Image]',
      image: selectedImage ? selectedImage.uri : null, 
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setAllMessages(prev => [...prev, userMsg]);

    const textToSend = inputText.trim();
    const imageToSend = selectedImage;
    setInputText('');
    setSelectedImage(null);
    setCurrentFilter('All Time');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const botReplyText = await sendToAquaBot(textToSend, imageToSend);
      
      const botMsg = { 
        id: botMsgId,
        text: botReplyText || 'Sorry, I could not process that request.',
        sender: 'bot',
        timestamp: new Date().toISOString()
      };

      setAllMessages(prev => [...prev, botMsg]);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = {
        id: botMsgId,
        text: 'Sorry, I am currently unavailable. Please try again later.',
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      setAllMessages(prev => [...prev, errorMsg]);
      Alert.alert('Error', 'Could not send message. Please check your connection.');
    } finally {
      setChatLoading(false);
      isSendingRef.current = false;
    }
  };

  // --- RENDER HELPERS ---
  const renderSidebar = () => (
    <Modal 
      visible={isSidebarVisible} 
      animationType="fade" 
      transparent={true}
      onRequestClose={() => setSidebarVisible(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1}
        onPress={() => setSidebarVisible(false)}
      >
        <View 
          style={styles.sidebarContainer}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.sidebarTitle}>🗄️ History</Text>
          <View style={styles.sidebarDivider} />
          
          <TouchableOpacity 
            style={styles.sidebarItem} 
            onPress={() => filterChatByDate('All')}
          >
            <Ionicons name="infinite" size={20} color="#333" />
            <Text style={styles.sidebarItemText}>Show All History</Text>
            <Text style={styles.sidebarItemCount}>({allMessages.length})</Text>
          </TouchableOpacity>

          <Text style={styles.sidebarSectionTitle}>Previous Days</Text>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            {sidebarDateGroups.length > 0 ? (
              sidebarDateGroups.map(({ date, count }) => (
                <TouchableOpacity 
                  key={date} 
                  style={styles.sidebarItem} 
                  onPress={() => filterChatByDate(date)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                  <Text style={styles.sidebarItemText}>{date}</Text>
                  <Text style={styles.sidebarItemCount}>({count})</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No chat history yet</Text>
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderCalculator = () => (
    <ScrollView 
      style={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={20} color="#FF9500" />
          <Text style={styles.offlineText}>Offline - Calculator unavailable</Text>
        </View>
      )}

      <View style={styles.calculatorCard}>
        <Text style={styles.calculatorTitle}>🧮 Yield Calculator</Text>
        <Text style={styles.calculatorSubtitle}>Predict your harvest yield and revenue</Text>
      </View>

      <Text style={styles.label}>Pond Area (sqm):</Text>
      <TextInput 
        style={[styles.input, calcErrors.area && styles.inputError]} 
        placeholder="e.g., 500" 
        keyboardType="numeric" 
        value={area} 
        onChangeText={setArea}
        editable={!calcLoading}
      />
      {calcErrors.area && <Text style={styles.errorText}>⚠️ {calcErrors.area}</Text>}

      <Text style={styles.label}>Fry Quantity (pieces):</Text>
      <TextInput 
        style={[styles.input, calcErrors.fry && styles.inputError]} 
        placeholder="e.g., 5000" 
        keyboardType="numeric" 
        value={fry} 
        onChangeText={setFry}
        editable={!calcLoading}
      />
      {calcErrors.fry && <Text style={styles.errorText}>⚠️ {calcErrors.fry}</Text>}

      <Text style={styles.label}>Days Cultured:</Text>
      <TextInput 
        style={[styles.input, calcErrors.days && styles.inputError]} 
        placeholder="e.g., 120" 
        keyboardType="numeric" 
        value={days} 
        onChangeText={setDays}
        editable={!calcLoading}
      />
      {calcErrors.days && <Text style={styles.errorText}>⚠️ {calcErrors.days}</Text>}

      <TouchableOpacity
        style={[
          styles.calculateBtn,
          (calcLoading || isOffline) && styles.calculateBtnDisabled
        ]}
        onPress={handlePredict}
        disabled={calcLoading || isOffline}
      >
        {calcLoading ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text style={styles.calculateBtnText}>Calculate Yield</Text>
        )}
      </TouchableOpacity>

      {calcResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Ionicons name="bar-chart" size={24} color="#2196F3" />
            <Text style={styles.resultTitle}>Prediction Results</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Predicted Yield:</Text>
            <Text style={styles.resultValue}>{calcResult.predicted_yield_kg} kg</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Estimated Revenue:</Text>
            <Text style={styles.resultValueGreen}>₱{calcResult.estimated_revenue?.toLocaleString() || 0}</Text>
          </View>
          {calcResult.confidence && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Confidence:</Text>
              <Text style={styles.resultValue}>{(calcResult.confidence * 100).toFixed(1)}%</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderMessage = useCallback(({ item }) => (
    <View 
      style={[
        styles.msgBubble, 
        item.sender === 'user' ? styles.userBubble : styles.botBubble
      ]}
    >
      {item.image && (
        <Image 
          source={{ uri: item.image }} 
          style={styles.chatImage}
          resizeMode="cover"
        />
      )}
      <Text style={item.sender === 'user' ? styles.userText : styles.botText}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleTimeString([], {
          hour: '2-digit', 
          minute: '2-digit'
        })}
      </Text>
    </View>
  ), []);

  const renderChat = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.chatHeader}>
        <TouchableOpacity 
          onPress={() => setSidebarVisible(true)} 
          style={styles.menuBtn}
        >
          <Ionicons name="menu" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.chatHeaderTitle}>{currentFilter}</Text>
        {isOffline && (
          <View style={styles.offlineIndicator}>
            <Ionicons name="cloud-offline" size={16} color="#FF9500" />
          </View>
        )}
      </View>

      {historyLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading chat history...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={item => item.id.toString()}
          style={{ flex: 1, padding: 10 }}
          contentContainerStyle={{ paddingBottom: 10 }}
          renderItem={renderMessage}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start a conversation with AquaBot!</Text>
            </View>
          }
        />
      )}

      {selectedImage && (
        <View style={styles.previewContainer}>
          <Image 
            source={{ uri: selectedImage.uri }} 
            style={styles.previewImage}
            resizeMode="cover"
          />
          <TouchableOpacity 
            onPress={() => setSelectedImage(null)} 
            style={styles.removePreview}
          >
            <Ionicons name="close-circle" size={24} color="red" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.chatInputContainer}>
        <TouchableOpacity 
          onPress={pickImage} 
          style={styles.iconBtn}
          disabled={chatLoading || isOffline}
        >
          <Ionicons 
            name="camera" 
            size={24} 
            color={chatLoading || isOffline ? "#ccc" : "#007AFF"} 
          />
        </TouchableOpacity>
        <TextInput 
          style={styles.chatInput} 
          placeholder={isOffline ? "Offline - chat unavailable" : "Ask AquaBot..."} 
          value={inputText} 
          onChangeText={setInputText}
          editable={!chatLoading && !isOffline}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity 
          onPress={sendMessage} 
          style={[
            styles.sendBtn,
            (chatLoading || isOffline || (!inputText.trim() && !selectedImage)) && styles.sendBtnDisabled
          ]}
          disabled={chatLoading || isOffline || (!inputText.trim() && !selectedImage)}
        >
          {chatLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name="send" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderSidebar()} 
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, mode === 'advisor' && styles.activeTab]} 
          onPress={() => setMode('advisor')}
        >
          <Text style={[styles.tabText, mode === 'advisor' && styles.activeTabText]}>
            🤖 AI Advisor
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, mode === 'calculator' && styles.activeTab]} 
          onPress={() => setMode('calculator')}
        >
          <Text style={[styles.tabText, mode === 'calculator' && styles.activeTabText]}>
            🧮 Calculator
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {mode === 'calculator' ? renderCalculator() : renderChat()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5',
    // FIXED: Add padding for Android Status Bar
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, 
  },
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'white', 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  tab: { 
    flex: 1, 
    padding: 15, 
    alignItems: 'center', 
    borderBottomWidth: 3, 
    borderBottomColor: 'transparent',
    minHeight: 44
  },
  activeTab: { 
    borderBottomColor: '#007AFF' 
  },
  tabText: { 
    fontSize: 16, 
    color: '#666' 
  },
  activeTabText: { 
    color: '#007AFF', 
    fontWeight: 'bold' 
  },
  content: { 
    padding: 20 
  },
  calculatorCard: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3'
  },
  calculatorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4
  },
  calculatorSubtitle: {
    fontSize: 14,
    color: '#1565C0'
  },
  label: { 
    fontSize: 16, 
    marginBottom: 5, 
    marginTop: 10,
    color: '#333',
    fontWeight: '600'
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#ccc', 
    padding: 12, 
    borderRadius: 8, 
    backgroundColor: 'white', 
    marginBottom: 10,
    fontSize: 16
  },
  inputError: {
    borderColor: '#D32F2F',
    borderWidth: 2
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    marginLeft: 4
  },
  calculateBtn: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 44
  },
  calculateBtnDisabled: {
    backgroundColor: '#ccc'
  },
  calculateBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  },
  resultCard: { 
    marginTop: 20, 
    padding: 20, 
    backgroundColor: '#E8F5E9', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#4CAF50' 
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  resultTitle: { 
    fontSize: 18, 
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#2196F3'
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  resultLabel: {
    fontSize: 14,
    color: '#666'
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  resultValueGreen: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32'
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500'
  },
  offlineText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#B36200',
    fontWeight: '500'
  },
  msgBubble: { 
    maxWidth: '80%', 
    padding: 12, 
    borderRadius: 15, 
    marginBottom: 10 
  },
  userBubble: { 
    alignSelf: 'flex-end', 
    backgroundColor: '#007AFF' 
  },
  botBubble: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#E0E0E0' 
  },
  userText: { 
    color: 'white',
    fontSize: 15
  },
  botText: { 
    color: '#333',
    fontSize: 15
  },
  timestamp: { 
    fontSize: 10, 
    color: 'rgba(0,0,0,0.5)', 
    marginTop: 5, 
    alignSelf: 'flex-end'
  },
  chatInputContainer: { 
    flexDirection: 'row', 
    padding: 10, 
    backgroundColor: 'white', 
    borderTopWidth: 1, 
    borderColor: '#eee', 
    alignItems: 'center' 
  },
  chatInput: { 
    flex: 1, 
    backgroundColor: '#f0f0f0', 
    borderRadius: 20, 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    marginRight: 10, 
    minHeight: 40,
    maxHeight: 100,
    fontSize: 15
  },
  sendBtn: { 
    backgroundColor: '#007AFF', 
    padding: 10, 
    borderRadius: 50, 
    width: 44, 
    height: 44, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc'
  },
  iconBtn: { 
    marginRight: 10, 
    padding: 10, 
    backgroundColor: '#E3F2FD', 
    borderRadius: 50,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatImage: { 
    width: 200, 
    height: 150, 
    borderRadius: 10, 
    marginBottom: 5 
  },
  previewContainer: { 
    flexDirection: 'row', 
    padding: 10, 
    backgroundColor: '#eee', 
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd'
  },
  previewImage: { 
    width: 60, 
    height: 60, 
    borderRadius: 5, 
    marginRight: 10 
  },
  removePreview: { 
    marginLeft: 'auto',
    padding: 5
  },
  chatHeader: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 10, 
    backgroundColor: '#fff', 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  menuBtn: { 
    padding: 5, 
    marginRight: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chatHeaderTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#555',
    flex: 1
  },
  offlineIndicator: {
    marginLeft: 'auto'
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    flexDirection: 'row' 
  },
  sidebarContainer: { 
    width: '75%', 
    backgroundColor: 'white', 
    height: '100%', 
    padding: 20,
    paddingTop: 50
  },
  sidebarTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    color: '#333'
  },
  sidebarDivider: { 
    height: 1, 
    backgroundColor: '#eee', 
    marginBottom: 20 
  },
  sidebarSectionTitle: { 
    fontSize: 12, 
    color: '#888', 
    marginBottom: 10, 
    marginTop: 20, 
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  sidebarItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
    minHeight: 44
  },
  sidebarItemText: { 
    marginLeft: 15, 
    fontSize: 16, 
    color: '#333',
    flex: 1
  },
  sidebarItemCount: {
    fontSize: 12,
    color: '#888',
    marginLeft: 5
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 5,
    textAlign: 'center'
  }
});