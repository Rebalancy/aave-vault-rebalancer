'use client';

import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';

const ARBITRUM_SEPOLIA_CHAIN_ID = arbitrumSepolia.id; // 421614

export const MetaMaskWarning = () => {
  const { connector, isConnected } = useAccount();
  const chainId = useChainId();
  const [dismissed, setDismissed] = useState(false);

  // Check if using MetaMask on Arbitrum Sepolia
  // RainbowKit/wagmi may use 'MetaMask', 'metamask', or the connector id
  const connectorName = connector?.name?.toLowerCase() || '';
  const connectorId = (connector?.id || '').toLowerCase();
  const isMetaMask = connectorName.includes('metamask') || connectorId.includes('metamask') || connectorId === 'io.metamask';
  const isArbitrumSepolia = chainId === ARBITRUM_SEPOLIA_CHAIN_ID;
  const shouldShowWarning = isConnected && isMetaMask && isArbitrumSepolia && !dismissed;
  
  // Debug logging (remove in production)
  console.log('🦊 MetaMask Warning Check:', { connectorName, connectorId, isMetaMask, chainId, isArbitrumSepolia, shouldShowWarning });

  if (!shouldShowWarning) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-yellow-900/90 border border-yellow-600 rounded-lg p-4 shadow-xl backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="text-yellow-400 text-xl flex-shrink-0">⚠️</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-yellow-200 font-medium text-sm">MetaMask + Arbitrum Sepolia</h4>
            <p className="text-yellow-100/80 text-xs mt-1 leading-relaxed">
              MetaMask&apos;s transaction simulation doesn&apos;t support Arbitrum Sepolia. 
              Transactions may show as &quot;failed&quot; in the preview but will still succeed on-chain. 
              You can safely proceed with transactions.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-yellow-400 hover:text-yellow-200 transition-colors flex-shrink-0"
            aria-label="Dismiss warning"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MetaMaskWarning;

