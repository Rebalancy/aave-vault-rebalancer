'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { useWelcome } from './WelcomeContext';
import { useTransactionStatus } from './TransactionStatusContext';
import { MessageType, MessageCategory, MessageConfig } from '@/constants/messages';

// Active message state
export interface ActiveMessage extends MessageConfig {
  id: string;
  timestamp: number;
  priority: number; // Higher number = higher priority
}

interface MessageStateContextType {
  // Current active messages
  activeMessages: ActiveMessage[];
  
  // Primary message to display (highest priority)
  primaryMessage: ActiveMessage | null;
  
  // Message management functions
  addMessage: (message: Omit<ActiveMessage, 'id' | 'timestamp'>) => string;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  clearMessagesByCategory: (category: MessageCategory) => void;
  
  // State checks
  shouldShowWelcome: boolean;
  shouldShowWelcomeBack: boolean;
  hasTransactionMessages: boolean;
  
  // Manual refresh
  refreshState: () => void;
}

const MessageStateContext = createContext<MessageStateContextType | undefined>(undefined);

export const useMessageState = () => {
  const context = useContext(MessageStateContext);
  if (!context) {
    throw new Error('useMessageState must be used within a MessageStateProvider');
  }
  return context;
};

interface MessageStateProviderProps {
  children: ReactNode;
}

// Message priority system
const MESSAGE_PRIORITIES = {
  loading: 100,      // Highest - active transactions
  error: 90,         // High - errors need immediate attention
  success: 80,       // High - but lower than errors
  info: 50,          // Medium - helpful information
  idle: 40,          // Low - welcome back messages
} as const;

// Category-specific priorities (fine-tuning)
const CATEGORY_PRIORITY_BOOST = {
  'welcome': 0,
  'welcome-back': 5,
  'deposit': 10,
  'withdraw': 10,
  'vault-shares': 5,
} as const;

export const MessageStateProvider: React.FC<MessageStateProviderProps> = ({ children }) => {
  const { isConnected, address } = useAccount();
  const { showWelcome, showWelcomeBack, hasDeposits, yieldEarned } = useWelcome();
  const { messages: transactionMessages } = useTransactionStatus();
  
  const [activeMessages, setActiveMessages] = useState<ActiveMessage[]>([]);

  // Calculate message priority
  const calculatePriority = (type: MessageType, category: MessageCategory): number => {
    const basePriority = MESSAGE_PRIORITIES[type];
    const categoryBoost = CATEGORY_PRIORITY_BOOST[category] || 0;
    return basePriority + categoryBoost;
  };

  // Generate unique message ID
  const generateMessageId = (): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add message function
  const addMessage = useCallback((message: Omit<ActiveMessage, 'id' | 'timestamp'>): string => {
    const id = generateMessageId();
    const newMessage: ActiveMessage = {
      ...message,
      id,
      timestamp: Date.now(),
      priority: calculatePriority(message.type, message.category),
    };

    setActiveMessages(prev => {
      // Remove existing message with same category if not persistent
      const filtered = prev.filter(msg => 
        msg.category !== message.category || msg.persistent === true
      );
      
      // Add new message and sort by priority
      return [...filtered, newMessage].sort((a, b) => b.priority - a.priority);
    });

    return id;
  }, []);

  // Remove message function
  const removeMessage = (id: string) => {
    setActiveMessages(prev => prev.filter(msg => msg.id !== id));
  };

  // Clear all messages
  const clearMessages = () => {
    setActiveMessages([]);
  };

  // Clear messages by category
  const clearMessagesByCategory = (category: MessageCategory) => {
    setActiveMessages(prev => prev.filter(msg => msg.category !== category));
  };

  // State management - run checks on page load and state changes
  useEffect(() => {
    if (!isConnected || !address) {
      // User not connected - clear welcome messages
      setActiveMessages(prev => prev.filter(msg => 
        !['welcome', 'welcome-back'].includes(msg.category)
      ));
      return;
    }

    // Add a small delay to ensure state is fully settled before showing messages
    const timer = setTimeout(() => {
      // Check if there are active transaction messages - don't override them with welcome
      setActiveMessages(prev => {
        const hasActiveTransactionMessages = prev.some(msg => 
          ['deposit', 'withdraw', 'vault-shares'].includes(msg.category) &&
          (msg.type === 'loading' || msg.type === 'success')
        );
        
        // Don't add welcome messages if there are active transaction messages
        if (hasActiveTransactionMessages) {
          return prev;
        }
        
        // Clear previous welcome messages
        const filtered = prev.filter(msg => 
          !['welcome', 'welcome-back'].includes(msg.category)
        );
        
        // Add welcome back message if applicable (user has deposits)
        if (showWelcomeBack && hasDeposits && isConnected) {
          const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return [...filtered, {
            id,
            type: 'idle' as MessageType,
            category: 'welcome-back' as MessageCategory,
            content: `Welcome back! You have earned ${yieldEarned} USDC yield since last time.`,
            persistent: false,
            priority: calculatePriority('idle', 'welcome-back'),
            timestamp: Date.now(),
          }].sort((a, b) => b.priority - a.priority);
        }
        // Add welcome message if applicable (user has no deposits)
        else if (showWelcome && !hasDeposits && isConnected) {
          const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return [...filtered, {
            id,
            type: 'info' as MessageType,
            category: 'welcome' as MessageCategory,
            content: 'Welcome! Get started by depositing into the vault.',
            persistent: false,
            priority: calculatePriority('info', 'welcome'),
            timestamp: Date.now(),
          }].sort((a, b) => b.priority - a.priority);
        }
        
        return filtered;
      });
    }, 100); // Small delay to prevent flashing

    return () => clearTimeout(timer);
  }, [isConnected, address, showWelcome, showWelcomeBack, hasDeposits, yieldEarned]);

  // Handle transaction messages from existing context
  useEffect(() => {
    // Clear previous transaction messages (including loading messages)
    setActiveMessages(prev => prev.filter(msg => 
      !['deposit', 'withdraw', 'vault-shares'].includes(msg.category)
    ));

    // Add current transaction messages
    transactionMessages.forEach(txMsg => {
      // Map transaction message to our message format
      let type: MessageType = 'info';
      let category: MessageCategory = 'deposit'; // default

      // Determine type and category from transaction message
      if (txMsg.message.includes('progress') || txMsg.message.includes('pending')) {
        type = 'loading';
      } else if (txMsg.message.includes('successful') || txMsg.message.includes('confirmed')) {
        type = 'success';
      } else if (txMsg.message.includes('failed') || txMsg.message.includes('error')) {
        type = 'error';
      }

      // Determine category from message content
      if (txMsg.message.toLowerCase().includes('deposit')) {
        category = 'deposit';
      } else if (txMsg.message.toLowerCase().includes('withdraw')) {
        category = 'withdraw';
      } else if (txMsg.message.toLowerCase().includes('vault') || txMsg.message.toLowerCase().includes('shares')) {
        category = 'vault-shares';
      }

      addMessage({
        type,
        category,
        content: txMsg.message,
        persistent: type === 'loading' || type === 'success', // Loading and success messages persist until user dismisses
        priority: calculatePriority(type, category),
      });
    });
  }, [transactionMessages, addMessage]);

  // Auto-hide non-persistent messages after 5 seconds (except loading, success, and welcome messages)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setActiveMessages(prev => prev.filter(msg => 
        msg.persistent === true || 
        msg.type === 'loading' || 
        msg.type === 'success' || // Success messages stay until user dismisses
        msg.category === 'welcome' ||
        msg.category === 'welcome-back' ||
        (now - msg.timestamp) < 5000 // 5 second auto-hide
      ));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Calculate derived state
  const primaryMessage = activeMessages.length > 0 ? activeMessages[0] : null;
  const shouldShowWelcome = showWelcome && !hasDeposits && isConnected;
  const shouldShowWelcomeBack = showWelcomeBack && hasDeposits && isConnected;
  const hasTransactionMessages = activeMessages.some(msg => 
    ['deposit', 'withdraw', 'vault-shares'].includes(msg.category)
  );

  // Manual refresh function
  const refreshState = () => {
    // This will trigger the useEffect hooks to re-run
    setActiveMessages([]);
  };

  const contextValue: MessageStateContextType = {
    activeMessages,
    primaryMessage,
    addMessage,
    removeMessage,
    clearMessages,
    clearMessagesByCategory,
    shouldShowWelcome,
    shouldShowWelcomeBack,
    hasTransactionMessages,
    refreshState,
  };

  return (
    <MessageStateContext.Provider value={contextValue}>
      {children}
    </MessageStateContext.Provider>
  );
};

export default MessageStateProvider;
