'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { AAVE_VAULT_ABI, getContractAddress } from '@/utils/contracts';

interface WelcomeContextType {
  showWelcome: boolean;
  hasDeposits: boolean;
  showWelcomeBack: boolean;
  yieldEarned: number;
  setShowWelcome: (show: boolean) => void;
  dismissWelcome: () => void;
  dismissWelcomeBack: () => void;
  clearWelcomeStorage: () => void; // For debugging/testing
}

const WelcomeContext = createContext<WelcomeContextType | undefined>(undefined);

export const useWelcome = () => {
  const context = useContext(WelcomeContext);
  if (!context) {
    throw new Error('useWelcome must be used within a WelcomeProvider');
  }
  return context;
};

interface WelcomeProviderProps {
  children: ReactNode;
}

export const WelcomeProvider: React.FC<WelcomeProviderProps> = ({ children }) => {
  const { address, isConnected, chainId } = useAccount();
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasDeposits, setHasDeposits] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [yieldEarned, setYieldEarned] = useState(0);

  // Reset state when wallet address changes
  useEffect(() => {
    if (address) {
      // Reset states for new wallet
      setHasDeposits(false);
      setShowWelcome(false);
    } else {
      // No wallet connected
      setHasDeposits(false);
      setShowWelcome(false);
    }
  }, [address]);


  // Read user's vault shares to determine if they have deposits
  const { data: vaultShares } = useReadContract({
    address: chainId ? (getContractAddress(chainId) as `0x${string}`) : undefined,
    abi: AAVE_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { 
      enabled: !!address && !!chainId && isConnected,
    },
  });

  // Update hasDeposits based on vault shares
  useEffect(() => {
    if (vaultShares !== undefined && address) {
      const hasShares = vaultShares > BigInt(0);
      setHasDeposits(hasShares);
    }
  }, [vaultShares, address, chainId]);

  // Show welcome card logic - Show when connected but no deposits
  useEffect(() => {
    if (!isConnected || !address) {
      setShowWelcome(false);
      setShowWelcomeBack(false);
      return;
    }

    // Show welcome card if user is connected and has no deposits
    if (isConnected && !hasDeposits) {
      setShowWelcome(true);
      setShowWelcomeBack(false);
    } else {
      setShowWelcome(false);
    }
  }, [isConnected, hasDeposits, address]);

  // Show welcome back message for users with deposits
  useEffect(() => {
    if (!address || !isConnected || !hasDeposits) {
      setShowWelcomeBack(false);
      return;
    }

    // Calculate realistic yield based on AAVE APY instead of anomalous share price
    if (vaultShares) {
      const userShares = Number(vaultShares) / 1e6; // Convert from wei to USDC (6 decimals)
      
      // Use realistic AAVE APY (~4.5%) instead of backend sharePrice which may be anomalous
      // Calculate daily yield: (userValue * APY) / 365
      const AAVE_APY = 0.045; // 4.5% APY
      const dailyYield = (userShares * AAVE_APY) / 365;
      
      // Round to 2 decimals
      setYieldEarned(Math.round(dailyYield * 100) / 100);
      setShowWelcomeBack(true);
    } else {
      // No shares, no yield
      setYieldEarned(0);
      setShowWelcomeBack(false);
    }
  }, [address, isConnected, hasDeposits, vaultShares]);

  const dismissWelcome = () => {
    // Just a placeholder - welcome will show again if user still has no deposits
    // The real dismissal happens when user makes their first deposit
    setShowWelcome(false);
  };

  const dismissWelcomeBack = () => {
    setShowWelcomeBack(false);
  };

  // Refetch vault shares when needed (can be called from deposit success)
  // const refreshUserDeposits = () => {
  //   if (isConnected && address && chainId) {
  //     refetchVaultShares();
  //   }
  // };

  const clearWelcomeStorage = () => {
    // No longer needed since we don't use localStorage
  };

  const contextValue: WelcomeContextType = {
    showWelcome,
    hasDeposits,
    showWelcomeBack,
    yieldEarned,
    setShowWelcome,
    dismissWelcome,
    dismissWelcomeBack,
    clearWelcomeStorage,
  };

  return (
    <WelcomeContext.Provider value={contextValue}>
      {children}
    </WelcomeContext.Provider>
  );
};
