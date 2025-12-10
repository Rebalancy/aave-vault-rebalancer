'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'rebalancer_tx_history';
const MAX_PERSISTED_TRANSACTIONS = 10;

export interface StatusMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'pending';
  message: string;
  timestamp: number;
  txHash?: string;
  chainId?: number;
}

interface TransactionStatusContextType {
  messages: StatusMessage[];
  persistedTransactions: StatusMessage[];
  addMessage: (message: Omit<StatusMessage, 'id' | 'timestamp'>) => string;
  upsertMessage: (key: string, message: Omit<StatusMessage, 'id' | 'timestamp'>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  clearPersistedTransaction: (id: string) => void;
}

const TransactionStatusContext = createContext<TransactionStatusContextType | undefined>(undefined);

export const useTransactionStatus = () => {
  const context = useContext(TransactionStatusContext);
  if (!context) {
    throw new Error('useTransactionStatus must be used within a TransactionStatusProvider');
  }
  return context;
};

interface TransactionStatusProviderProps {
  children: ReactNode;
}

// Helper to load persisted transactions from localStorage
const loadPersistedTransactions = (): StatusMessage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Filter out transactions older than 7 days
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return parsed.filter((tx: StatusMessage) => tx.timestamp > sevenDaysAgo);
    }
  } catch (e) {
    console.error('Failed to load persisted transactions:', e);
  }
  return [];
};

// Helper to save transactions to localStorage
const savePersistedTransactions = (transactions: StatusMessage[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to save persisted transactions:', e);
  }
};

export const TransactionStatusProvider: React.FC<TransactionStatusProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<StatusMessage[]>([]);
  const [persistedTransactions, setPersistedTransactions] = useState<StatusMessage[]>([]);

  // Load persisted transactions on mount
  useEffect(() => {
    const loaded = loadPersistedTransactions();
    setPersistedTransactions(loaded);
  }, []);

  // Helper to persist a successful transaction
  const persistTransaction = (message: StatusMessage) => {
    if (message.type === 'success' && message.txHash) {
      setPersistedTransactions(prev => {
        // Check if transaction already exists (by txHash)
        if (prev.some(tx => tx.txHash === message.txHash)) {
          return prev;
        }
        const updated = [message, ...prev].slice(0, MAX_PERSISTED_TRANSACTIONS);
        savePersistedTransactions(updated);
        return updated;
      });
    }
  };

  const addMessage = (messageData: Omit<StatusMessage, 'id' | 'timestamp'>) => {
    const newMessage: StatusMessage = {
      ...messageData,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    };

    setMessages(prev => {
      // Keep only the last 3 messages to prevent overflow
      const updatedMessages = [newMessage, ...prev].slice(0, 3);
      return updatedMessages;
    });

    // Persist successful transactions with txHash
    if (messageData.type === 'success' && messageData.txHash) {
      persistTransaction(newMessage);
    }

    // Auto-remove success and info messages after 10 seconds (from active messages only)
    if (messageData.type === 'success' || messageData.type === 'info') {
      setTimeout(() => {
        setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      }, 10000);
    }
    return newMessage.id;
  };

  // Deterministic key upsert to handle persistent transaction messages
  const upsertMessage = (key: string, messageData: Omit<StatusMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => {
      const existingIndex = prev.findIndex(m => m.id === key);
      const updated: StatusMessage = { ...messageData, id: key, timestamp: Date.now() };
      if (existingIndex !== -1) {
        const copy = [...prev];
        copy[existingIndex] = updated;
        return copy;
      }
      return [updated, ...prev].slice(0, 3);
    });

    // Also persist if it's a success with txHash
    if (messageData.type === 'success' && messageData.txHash) {
      persistTransaction({ ...messageData, id: key, timestamp: Date.now() });
    }
  };

  const removeMessage = (id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
  };

  const clearMessages = () => {
    // Only clear active messages, not persisted transactions
    setMessages([]);
  };

  const clearPersistedTransaction = (id: string) => {
    setPersistedTransactions(prev => {
      const updated = prev.filter(tx => tx.id !== id);
      savePersistedTransactions(updated);
      return updated;
    });
  };

  return (
    <TransactionStatusContext.Provider value={{ 
      messages, 
      persistedTransactions,
      addMessage, 
      upsertMessage, 
      removeMessage, 
      clearMessages,
      clearPersistedTransaction 
    }}>
      {children}
    </TransactionStatusContext.Provider>
  );
};
