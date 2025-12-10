'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http, formatUnits } from 'viem';
import { arbitrumSepolia, baseSepolia, optimismSepolia, sepolia } from 'viem/chains';
import { useMockData } from '@/components/ClientProviders';
import { AAVE_VAULT_ABI } from '@/utils/contracts';

export interface AllocationItem {
  name: string;
  icon: string;
  apy: number;
  allocation: number;
  color: string;
}

// Chain configuration with vault addresses and RPC endpoints
interface ChainConfig {
  chainId: number;
  name: string;
  vaultAddress: string | null; // null if not deployed yet
  rpcUrl: string;
  viemChain: typeof arbitrumSepolia;
}

const CHAIN_CONFIGS: ChainConfig[] = [
  {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    vaultAddress: '0xE168d95f8d1B8EC167A63c8E696076EC8EE95337',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    viemChain: arbitrumSepolia
  },
  {
    chainId: 84532,
    name: 'Base Sepolia',
    vaultAddress: null, // Not deployed yet
    rpcUrl: 'https://sepolia.base.org',
    viemChain: baseSepolia
  },
  {
    chainId: 11155420,
    name: 'Optimism Sepolia',
    vaultAddress: null, // Not deployed yet
    rpcUrl: 'https://sepolia.optimism.io',
    viemChain: optimismSepolia
  },
  {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    vaultAddress: null, // Not deployed yet
    rpcUrl: 'https://rpc.sepolia.org',
    viemChain: sepolia
  }
];

const PROTOCOL_ICONS: Record<string, string> = {
  'ethereum': '/Chain=ETH.svg',
  'base': '/Chain=BASE.svg', 
  'polygon': '/Chain=POL.svg',
  'avalanche': '/Chain=AVA.svg',
  'arbitrum': '/arbitrum-arb-logo.svg',
  'optimism': '/optimism-ethereum-op-logo.svg',
  'binance': '/Chain=BNB.svg',
  'near': '/Chain=ETH.svg',
  // Testnets
  'localhost': '/Chain=ETH.svg',
  'base sepolia': '/Chain=BASE.svg',
  'arbitrum sepolia': '/arbitrum-arb-logo.svg',
  'optimism sepolia': '/optimism-ethereum-op-logo.svg',
  'ethereum sepolia': '/Chain=ETH.svg'
};

const PROTOCOL_COLORS: Record<string, string> = {
  'ethereum': '#627EEA',
  'base': '#0052FF',
  'polygon': '#8247E5', 
  'avalanche': '#E84142',
  'arbitrum': '#213147',
  'optimism': '#FF0420',
  'binance': '#F3BA2F',
  'near': '#00D395',
  // Testnets
  'localhost': '#888888',
  'base sepolia': '#0052FF',
  'arbitrum sepolia': '#213147',
  'optimism sepolia': '#FF0420',
  'ethereum sepolia': '#627EEA'
};

const calculateEstimatedAPY = (protocol: string): number => {
  const apyEstimates: Record<string, number> = {
    'ethereum': 4.2,
    'base': 3.8,
    'polygon': 2.4,
    'avalanche': 4.0,
    'arbitrum': 3.5,
    'optimism': 3.2,
    'binance': 5.1,
    'near': 7.2,
    // Testnets
    'localhost': 3.5,
    'base sepolia': 3.8,
    'arbitrum sepolia': 3.5,
    'optimism sepolia': 3.2,
    'ethereum sepolia': 4.2
  };
  return apyEstimates[protocol.toLowerCase()] || 3.5;
};

// Read vault totalAssets directly from the chain
async function getVaultBalance(config: ChainConfig): Promise<{ chainId: number; balance: bigint }> {
  if (!config.vaultAddress) {
    return { chainId: config.chainId, balance: 0n };
  }

  try {
    const client = createPublicClient({
      chain: config.viemChain,
      transport: http(config.rpcUrl)
    });

    const totalAssets = await client.readContract({
      address: config.vaultAddress as `0x${string}`,
      abi: AAVE_VAULT_ABI,
      functionName: 'totalAssets'
    }) as bigint;

    console.log(`📊 ${config.name} vault totalAssets: ${totalAssets.toString()}`);
    return { chainId: config.chainId, balance: totalAssets };
  } catch (error) {
    console.error(`❌ Failed to read ${config.name} vault:`, error);
    return { chainId: config.chainId, balance: 0n };
  }
}

export const useAllocationData = () => {
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useAccount();
  const { useMock } = useMockData();

  useEffect(() => {
    const fetchAllocationData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('🔍 Fetching allocation data directly from vault contracts...');
        
        // If mock is enabled, return varied allocations
        if (useMock) {
          const mock: AllocationItem[] = [
            { name: 'Ethereum Sepolia', icon: PROTOCOL_ICONS['ethereum sepolia'], apy: 4.2, allocation: 44, color: PROTOCOL_COLORS['ethereum sepolia'] },
            { name: 'Arbitrum Sepolia', icon: PROTOCOL_ICONS['arbitrum sepolia'], apy: 3.5, allocation: 27, color: PROTOCOL_COLORS['arbitrum sepolia'] },
            { name: 'Base Sepolia', icon: PROTOCOL_ICONS['base sepolia'], apy: 3.8, allocation: 14, color: PROTOCOL_COLORS['base sepolia'] },
            { name: 'Optimism Sepolia', icon: PROTOCOL_ICONS['optimism sepolia'], apy: 3.2, allocation: 15, color: PROTOCOL_COLORS['optimism sepolia'] },
          ].sort((a,b) => b.allocation - a.allocation);
          setAllocations(mock);
          setTotalValue(1234567);
          return;
        }

        // Read balances directly from each chain's vault contract
        console.log('📡 Reading vault balances from each chain...');
        const balancePromises = CHAIN_CONFIGS.map(config => getVaultBalance(config));
        const balanceResults = await Promise.all(balancePromises);
        
        // Calculate total across all vaults (USDC has 6 decimals)
        const totalRaw = balanceResults.reduce((sum, result) => sum + result.balance, 0n);
        const totalUSDC = Number(formatUnits(totalRaw, 6)); // USDC has 6 decimals
        
        console.log(`💰 Total value across all vaults: ${totalUSDC} USDC`);

        // Build allocation items
        const allocationItems: AllocationItem[] = CHAIN_CONFIGS.map(config => {
          const result = balanceResults.find(r => r.chainId === config.chainId);
          const balance = result?.balance || 0n;
          const balanceUSDC = Number(formatUnits(balance, 6));
          
          // Calculate percentage (handle 0 total case)
          let allocationPercent = 0;
          if (totalRaw > 0n) {
            // Use bigint math to avoid precision loss
            allocationPercent = Number((balance * 100n) / totalRaw);
          }
          
          const chainNameLower = config.name.toLowerCase();
          
          console.log(`🎯 ${config.name}: ${balanceUSDC} USDC (${allocationPercent}%)`);
          
          return {
            name: config.name,
            icon: PROTOCOL_ICONS[chainNameLower] || '/Chain=ETH.svg',
            apy: calculateEstimatedAPY(config.name),
            allocation: allocationPercent,
            color: PROTOCOL_COLORS[chainNameLower] || '#666666'
          };
        });

        // Sort by allocation (highest first)
        const sortedAllocations = allocationItems.sort((a, b) => b.allocation - a.allocation);
        
        console.log('✅ Final allocation data:', {
          totalValue: totalUSDC,
          allocations: sortedAllocations
        });

        setAllocations(sortedAllocations);
        setTotalValue(totalUSDC);

      } catch (err) {
        console.error('💥 Error in fetchAllocationData:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        
        // Set fallback data showing all chains with 0%
        const fallbackAllocations: AllocationItem[] = CHAIN_CONFIGS.map(config => ({
          name: config.name,
          icon: PROTOCOL_ICONS[config.name.toLowerCase()] || '/Chain=ETH.svg',
          apy: calculateEstimatedAPY(config.name),
          allocation: 0,
          color: PROTOCOL_COLORS[config.name.toLowerCase()] || '#666666'
        }));
        setAllocations(fallbackAllocations);
        setTotalValue(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocationData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchAllocationData, 30000);
    return () => clearInterval(interval);
  }, [isConnected, useMock]);

  return {
    allocations,
    totalValue,
    isLoading,
    error
  };
}; 