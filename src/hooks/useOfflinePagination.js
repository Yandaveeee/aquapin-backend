import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isOnline } from '../api/offline'; 

export const useOfflinePagination = (storageKey, apiFetcher, pageSize = 10) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true); // Full screen / Refresh spinner
  const [isSyncing, setIsSyncing] = useState(false); // Background text indicator
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  
  const seenIds = useRef(new Set());

  const normalizeData = (responseData) => {
    if (Array.isArray(responseData)) return responseData;
    if (responseData && typeof responseData === 'object') {
      if (Array.isArray(responseData.data)) return responseData.data;
      if (Array.isArray(responseData.results)) return responseData.results;
    }
    return [];
  };

  const loadInitialData = useCallback(async () => {
    // Don't set loading=true if we are just refreshing in background
    // We handle that manually below
    setError(null);
    
    try {
      // 1. FAST LOAD: Load cache first
      const cached = await AsyncStorage.getItem(storageKey);
      let hasCache = false;
      
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          seenIds.current.clear();
          parsed.forEach(item => seenIds.current.add(item.stocking_id || item.id));
          setData(parsed);
          hasCache = true;
          setLoading(false); // ⚡ STOP SPINNER INSTANTLY
        }
      }

      // If no cache, we must show spinner
      if (!hasCache) setLoading(true);

      // 2. NETWORK SYNC
      const online = await isOnline();
      if (online) {
        setIsSyncing(true); // Show "Updating..." text
        console.log(`[Pagination] Syncing Page 1 for ${storageKey}...`);
        
        const response = await apiFetcher(1, pageSize);
        const newData = normalizeData(response.data);
        
        console.log(`[Pagination] Synced ${newData.length} items from server.`);

        // Reset deduplication with fresh server data
        seenIds.current.clear();
        newData.forEach(item => seenIds.current.add(item.stocking_id || item.id));
        
        setData(newData);
        setPage(2);
        setHasMore(newData.length >= pageSize);
        
        await AsyncStorage.setItem(storageKey, JSON.stringify(newData));
      } else {
        setHasMore(false);
      }

    } catch (err) {
      console.warn("[Pagination] Error:", err.message);
      setError(err);
    } finally {
      setLoading(false); // Ensure main spinner always stops
      setIsSyncing(false); // Ensure text indicator stops
    }
  }, [storageKey, apiFetcher, pageSize]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const online = await isOnline();
    if (!online) return;

    setLoadingMore(true);
    try {
      const response = await apiFetcher(page, pageSize);
      const newData = normalizeData(response.data);

      if (newData.length === 0) {
        setHasMore(false);
      } else {
        const uniqueNewData = newData.filter(item => {
          const id = item.stocking_id || item.id;
          if (seenIds.current.has(id)) return false;
          seenIds.current.add(id);
          return true;
        });

        if (uniqueNewData.length > 0) {
          const updatedList = [...data, ...uniqueNewData];
          setData(updatedList);
          setPage(prev => prev + 1);
          await AsyncStorage.setItem(storageKey, JSON.stringify(updatedList));
        } else {
          if (newData.length < pageSize) setHasMore(false);
        }
      }
    } catch (err) {
      console.warn("[Pagination] Load More Error:", err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, data, storageKey, apiFetcher, pageSize]);

  // ✅ AUTO-LOAD ON MOUNT
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return {
    data,
    loading,
    isSyncing,
    loadingMore,
    hasMore,
    error,
    refresh: loadInitialData,
    loadMore
  };
};