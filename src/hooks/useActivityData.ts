'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { useTransactionStatus, StatusMessage } from '@/contexts/TransactionStatusContext';
import { useMockData } from '@/components/ClientProviders';

// GraphQL query for activity data
const GET_RECENT_ACTIVITY = gql`
  query GetRecentActivity($limit: Int) {
    recentActivity(limit: $limit) {
      id
      type
      title
      description
      amount
      chainName
      userAddress
      transactionHash
      timestamp
      icon
    }
  }
`;

export interface ActivityEntry {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'REBALANCE' | 'HARVEST' | 'ALLOCATION';
  title: string;
  description: string;
  amount?: number;
  chainName?: string;
  userAddress?: string;
  transactionHash?: string;
  timestamp: string;
  icon: string;
  timeAgo?: string;
}

interface UseActivityDataReturn {
  activities: ActivityEntry[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useActivityData(limit: number = 20): UseActivityDataReturn {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const { messages, persistedTransactions } = useTransactionStatus();
  const { useMock } = useMockData();
  
  const { data, loading, error, refetch } = useQuery(GET_RECENT_ACTIVITY, {
    variables: { limit },
    pollInterval: 30000, // Poll every 30 seconds for new data
    errorPolicy: 'all'
  });

  // Helper function to format timestamp
  const formatTimestamp = useCallback((timestamp: string): string => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return activityTime.toLocaleDateString();
  }, []);

  // Convert transaction status messages to activity entries
  const convertMessageToActivity = useCallback((msg: StatusMessage): ActivityEntry | null => {
    const messageText = msg.message.toLowerCase();
    const isWithdraw = messageText.includes('withdraw');
    const isApproval = messageText.includes('approval');
    
    // Skip approval messages as they're not user-facing activities
    if (isApproval) return null;
    
    // Extract amount from message if possible
    const amountMatch = msg.message.match(/(\d+(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;
    
    let type: ActivityEntry['type'] = 'DEPOSIT';
    let icon = '/deposit.svg';
    const title = msg.message;
    
    if (isWithdraw) {
      type = 'WITHDRAWAL';
      icon = '/withdraw.svg';
    }
    
    return {
      id: `tx_${msg.id}`,
      type,
      title,
      description: 'Recent transaction',
      amount,
      transactionHash: msg.txHash,
      timestamp: new Date(msg.timestamp).toISOString(),
      icon
    };
  }, []);

  // Convert transaction status messages to activity entries
  const getRecentTransactionActivities = useCallback((): ActivityEntry[] => {
    // Combine active messages and persisted transactions
    const allTransactions = [
      ...messages.filter(msg => msg.type === 'success' && msg.txHash),
      ...persistedTransactions
    ];

    // Deduplicate by txHash
    const seen = new Set<string>();
    const uniqueTransactions = allTransactions.filter(tx => {
      if (!tx.txHash || seen.has(tx.txHash)) return false;
      seen.add(tx.txHash);
      return true;
    });

    return uniqueTransactions
      .map(convertMessageToActivity)
      .filter(Boolean) as ActivityEntry[];
  }, [messages, persistedTransactions, convertMessageToActivity]);

  useEffect(() => {
    if (data?.recentActivity) {
      // Combine backend data with recent transaction status messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const backendActivities: ActivityEntry[] = data.recentActivity.map((activity: any) => ({
        ...activity,
        timeAgo: formatTimestamp(activity.timestamp)
      }));
      
      const recentTxActivities = getRecentTransactionActivities();
      
      // Merge and sort by timestamp, deduplicate by txHash
      const seen = new Set<string>();
      const allActivities = [...recentTxActivities, ...backendActivities]
        .filter(activity => {
          if (activity.transactionHash) {
            if (seen.has(activity.transactionHash)) return false;
            seen.add(activity.transactionHash);
          }
          return true;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit)
        .map(activity => ({
          ...activity,
          timeAgo: formatTimestamp(activity.timestamp)
        }));
      
      setActivities(allActivities);
    } else {
      // If no backend data, show only recent transaction activities
      const recentTxActivities = getRecentTransactionActivities()
        .slice(0, limit)
        .map(activity => ({
          ...activity,
          timeAgo: formatTimestamp(activity.timestamp)
        }));
      
      setActivities(recentTxActivities);
    }
  }, [data, messages, persistedTransactions, limit, formatTimestamp, getRecentTransactionActivities]);

  // Override with mock or empty state according to global toggle
  useEffect(() => {
    if (useMock) {
      setActivities(getMockActivityData().slice(0, limit));
    }
    // Don't clear activities if no backend data - we still have persisted transactions
  }, [useMock, limit]);

  return {
    activities,
    loading,
    error: error || null,
    refetch
  };
}

// Mock data fallback for when backend is not available
export const getMockActivityData = (): ActivityEntry[] => [
  {
    id: 'mock_1',
    type: 'REBALANCE' as const,
    title: 'Rebalanced 10% from Base to Ethereum',
    description: 'Automated rebalancing for optimal yield',
    amount: 500000,
    chainName: 'ethereum',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    icon: '/rebalance.svg'
  },
  {
    id: 'mock_2',
    type: 'DEPOSIT' as const,
    title: 'Received deposit of $1,230',
    description: 'from 0x345...',
    amount: 1230,
    userAddress: '0x345...',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    icon: '/deposit.svg'
  },
  {
    id: 'mock_3',
    type: 'HARVEST' as const,
    title: 'Harvested $527 yield',
    description: 'Automatic yield collection',
    amount: 527,
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    icon: '/harvest.svg'
  },
  {
    id: 'mock_4',
    type: 'WITHDRAWAL' as const,
    title: 'Withdrawal of $820 initiated',
    description: 'by 0x456...',
    amount: 820,
    userAddress: '0x456...',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    icon: '/withdraw.svg'
  },
  {
    id: 'mock_5',
    type: 'ALLOCATION' as const,
    title: 'Allocated 40% to Ethereum',
    description: 'Strategy adjustment',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    icon: '/allocate.svg'
  }
].map(activity => ({
  ...activity,
  timeAgo: (() => {
    const now = new Date();
    const activityTime = new Date(activity.timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    return `${Math.floor(diffInHours / 24)}d ago`;
  })()
}));
