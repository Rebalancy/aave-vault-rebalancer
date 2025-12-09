// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  localhost: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
  ethereum: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // AAVE V3 Pool on Ethereum mainnet
  baseSepolia: '0x773035EABdA16B5416B26E12156483C6B6F56451', // AaveVault on Base Sepolia (OLD - for reference)
  arbitrumSepolia: '0xE168d95f8d1B8EC167A63c8E696076EC8EE95337', // Vault with agent: 0x20f2747bbc52453ac0774b5b2fe0e28dc6637f30
  optimismSepolia: '', // To be deployed
} as const;

// USDC contract addresses for different networks
export const USDC_ADDRESSES = {
  localhost: '0x16f18Ee01365Ef23E0564dfB635215A5B4Eaa3c4', // MockUSDC for local testing
  ethereum: '0xA0b86a33E6441E43941295AaE15D29a6E6e98959', // USDC on Ethereum mainnet  
  baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Circle's official USDC on Base Sepolia testnet
  arbitrumSepolia: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Circle's official USDC on Arbitrum Sepolia testnet
  optimismSepolia: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Circle's official USDC on Optimism Sepolia testnet
} as const;

// ERC20 ABI for token operations (approve, balanceOf, etc.)
export const ERC20_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// AaveVault ABI - Essential functions for deposit/withdraw
export const AAVE_VAULT_ABI = [
  // ERC4626 standard functions
  {
    "inputs": [
      {"internalType": "uint256", "name": "assets", "type": "uint256"},
      {"internalType": "address", "name": "receiver", "type": "address"}
    ],
    "name": "deposit",
    "outputs": [{"internalType": "uint256", "name": "shares", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "assets", "type": "uint256"},
      {"internalType": "address", "name": "receiver", "type": "address"},
      {
        "components": [
          {"internalType": "uint256", "name": "balance", "type": "uint256"},
          {"internalType": "uint256", "name": "nonce", "type": "uint256"},
          {"internalType": "uint256", "name": "deadline", "type": "uint256"},
          {"internalType": "uint256", "name": "assets", "type": "uint256"},
          {"internalType": "address", "name": "receiver", "type": "address"}
        ],
        "internalType": "struct AaveVault.CrossChainBalanceSnapshot",
        "name": "snapshot",
        "type": "tuple"
      },
      {"internalType": "bytes", "name": "signature", "type": "bytes"}
    ],
    "name": "depositWithExtraInfoViaSignature",
    "outputs": [{"internalType": "uint256", "name": "shares", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "assets", "type": "uint256"},
      {"internalType": "address", "name": "receiver", "type": "address"},
      {"internalType": "address", "name": "owner", "type": "address"}
    ],
    "name": "withdraw",
    "outputs": [{"internalType": "uint256", "name": "shares", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "shares", "type": "uint256"},
      {"internalType": "address", "name": "receiver", "type": "address"},
      {"internalType": "address", "name": "owner", "type": "address"}
    ],
    "name": "redeem",
    "outputs": [{"internalType": "uint256", "name": "assets", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // View functions
  {
    "inputs": [],
    "name": "totalAssets",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "assets", "type": "uint256"}],
    "name": "previewDeposit",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "assets", "type": "uint256"}],
    "name": "previewWithdraw",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "sender", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "assets", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "shares", "type": "uint256"}
    ],
    "name": "Deposit",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "sender", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "receiver", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "owner", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "assets", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "shares", "type": "uint256"}
    ],
    "name": "Withdraw",
    "type": "event"
  }
] as const;

// Helper function to get contract address for current network
export const getContractAddress = (chainId: number): string => {
  switch (chainId) {
    case 31337: // localhost
      return CONTRACT_ADDRESSES.localhost;
    case 1: // Ethereum mainnet
      return CONTRACT_ADDRESSES.ethereum;
    case 84532: // Base Sepolia
      return CONTRACT_ADDRESSES.baseSepolia;
    case 421614: // Arbitrum Sepolia
      if (!CONTRACT_ADDRESSES.arbitrumSepolia) {
        throw new Error('AAVE Vault not yet deployed on Arbitrum Sepolia. Coming soon!');
      }
      return CONTRACT_ADDRESSES.arbitrumSepolia;
    case 11155420: // Optimism Sepolia
      if (!CONTRACT_ADDRESSES.optimismSepolia) {
        throw new Error('AAVE Vault not yet deployed on Optimism Sepolia. Coming soon!');
      }
      return CONTRACT_ADDRESSES.optimismSepolia;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}. Supported networks: Ethereum (1), Base Sepolia (84532), Arbitrum Sepolia (421614), Optimism Sepolia (11155420), or Localhost (31337).`);
  }
};

// Helper function to get USDC address for current network
export const getUSDCAddress = (chainId: number): string => {
  switch (chainId) {
    case 31337: // localhost
      return USDC_ADDRESSES.localhost;
    case 1: // Ethereum mainnet
      return USDC_ADDRESSES.ethereum;
    case 84532: // Base Sepolia
      return USDC_ADDRESSES.baseSepolia;
    case 421614: // Arbitrum Sepolia
      return USDC_ADDRESSES.arbitrumSepolia;
    case 11155420: // Optimism Sepolia
      return USDC_ADDRESSES.optimismSepolia;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}. Supported networks: Ethereum (1), Base Sepolia (84532), Arbitrum Sepolia (421614), Optimism Sepolia (11155420), or Localhost (31337).`);
  }
}; 