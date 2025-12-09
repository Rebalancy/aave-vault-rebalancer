// NEAR network configuration
const CONTRACT_ID = 'rebalancer-abcdefghij-57.testnet'; // Updated to the new contract with better data

// RPC endpoint for the network
const RPC_URL = 'https://rpc.testnet.near.org'; // Use testnet for now

export interface ViewCallOptions {
  methodName: string;
  args?: Record<string, unknown>;
}

export interface AllocationData {
  protocol: string;
  apy: number;
  allocation: number;
  totalValue: number;
}

// New allocation data format from get_allocations: Vec<(ChainId, u128)>
export interface ChainAllocation {
  chainId: number;
  amount: string; // u128 as string to handle large numbers
}

// Updated ActivityLog structure with more detailed info
export interface ActivityLog {
  activity_type: string; // AgentActionType
  source_chain: number; // ChainId
  destination_chain: number; // ChainId
  timestamp: number; // u64
  nonce: number; // u64
  expected_amount: string; // u128 as string
  actual_amount?: string; // Option<u128> as string
  transactions: number[][]; // Vec<Vec<u8>>
}

export interface SignedTransaction {
  payload_type: number;
  raw_transaction: string; // hex encoded
}

/**
 * NEAR Contract Reader - No wallet required, view-only operations using fetch
 */
export class NearContractReader {
  private contractId: string;
  private rpcUrl: string;

  constructor(contractId: string = CONTRACT_ID) {
    this.contractId = contractId;
    this.rpcUrl = RPC_URL;
  }

  /**
   * Call a view method on the contract (read-only, no wallet required)
   */
  async viewMethod({ methodName, args = {} }: ViewCallOptions): Promise<unknown> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'final',
            account_id: this.contractId,
            method_name: methodName,
            args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
          },
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`NEAR RPC Error: ${data.error.message || 'Unknown error'}`);
      }

      if (!data.result || !data.result.result) {
        throw new Error('Invalid response from NEAR RPC');
      }

      return JSON.parse(Buffer.from(data.result.result).toString());
    } catch (error) {
      console.error(`Error calling NEAR contract method ${methodName}:`, error);
      throw error;
    }
  }

  /**
   * Test NEAR connectivity with a simple contract call
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to call the allocations method first (this should exist on the new contract)
      await this.viewMethod({
        methodName: 'get_allocations',
        args: {}
      });
      console.log('✅ NEAR contract connection successful - rebalancer-10 contract found');
      return true;
    } catch (error) {
      console.log('❌ NEAR contract method not found or connection failed:', error);
      return false;
    }
  }

  /**
   * Get chain allocations data - NEW METHOD
   */
  async getAllocations(): Promise<ChainAllocation[]> {
    const rawAllocations = await this.viewMethod({
      methodName: 'get_allocations'
    }) as [number, string][]; // Vec<(ChainId, u128)>

    return rawAllocations.map(([chainId, amount]) => ({
      chainId,
      amount
    }));
  }

  /**
   * Get global portfolio allocation data (no account required)
   */
  async getGlobalAllocation(): Promise<AllocationData[]> {
    return this.viewMethod({
      methodName: 'get_global_allocation'
    }) as Promise<AllocationData[]>;
  }

  /**
   * Get total value locked in the protocol
   */
  async getTotalValueLocked(): Promise<number> {
    return this.viewMethod({
      methodName: 'get_total_value_locked'
    }) as Promise<number>;
  }

  /**
   * Get current APY rates for different protocols
   */
  async getProtocolAPYs(): Promise<Record<string, number>> {
    return this.viewMethod({
      methodName: 'get_protocol_apys'
    }) as Promise<Record<string, number>>;
  }

  /**
   * Get rebalancing statistics
   */
  async getRebalancingStats() {
    return this.viewMethod({
      methodName: 'get_rebalancing_stats'
    });
  }

  /**
   * Get latest activity logs from the rebalancer contract - UPDATED FORMAT
   */
  async getLatestLogs(count: number = 10): Promise<ActivityLog[]> {
    return this.viewMethod({
      methodName: 'get_latest_logs',
      args: { count }
    }) as Promise<ActivityLog[]>;
  }

  /**
   * Get signed transactions from the contract
   */
  async getSignedTransactions(nonce: number = 0): Promise<SignedTransaction[]> {
    const rawPayloads = await this.viewMethod({
      methodName: 'get_signed_transactions',
      args: { nonce }
    }) as number[][];

    // Transform the raw payloads into structured data
    const transactions: SignedTransaction[] = [];
    
    for (const payload of rawPayloads) {
      if (payload.length > 0) {
        transactions.push({
          payload_type: payload[0],
          raw_transaction: Array.from(payload.slice(1))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('')
        });
      }
    }
    
    return transactions;
  }

  /**
   * Get protocol performance metrics
   */
  async getProtocolMetrics() {
    return this.viewMethod({
      methodName: 'get_protocol_metrics'
    });
  }

  /**
   * Get cross-chain rebalancing activity (integrated with the new contract)
   */
  async getCrossChainActivity(limit: number = 20): Promise<ActivityLog[]> {
    try {
      const logs = await this.getLatestLogs(limit);
      
      // With the new format, all logs have source_chain and destination_chain
      // so we can filter for cross-chain activities (where source != destination)
      return logs.filter(log => 
        log.source_chain !== log.destination_chain
      );
    } catch (error) {
      console.error('Error fetching cross-chain activity:', error);
      return [];
    }
  }

  /**
   * Get pending transactions that can be executed on Ethereum
   */
  async getPendingEthereumTransactions(): Promise<SignedTransaction[]> {
    try {
      const transactions = await this.getSignedTransactions();
      
      // Filter for Ethereum transactions (payload_type might indicate the target chain)
      return transactions.filter(tx => tx.payload_type === 1); // Assuming 1 is for Ethereum
    } catch (error) {
      console.error('Error fetching pending Ethereum transactions:', error);
      return [];
    }
  }
}

// Utility function to create a contract reader instance
export const createNearContractReader = (contractId?: string) => {
  return new NearContractReader(contractId);
};

// Legacy exports for backward compatibility (wallet-based)
export interface ContractCallOptions {
  methodName: string;
  args?: Record<string, unknown>;
  gas?: string;
  deposit?: string;
}

// Keep the old NearContract class for when wallet functionality is needed
export class NearContract {
  private contractId: string;

  constructor(selector: unknown, contractId: string = CONTRACT_ID) {
    this.contractId = contractId;
  }

  async viewMethod({ methodName, args = {} }: ViewCallOptions): Promise<unknown> {
    const reader = new NearContractReader(this.contractId);
    return reader.viewMethod({ methodName, args });
  }

  // Placeholder methods for wallet-based operations
  async callMethod({ methodName, args = {} }: ContractCallOptions): Promise<unknown> {
    console.log(`Would call ${methodName} with args:`, args);
    throw new Error('Wallet-based contract calls not implemented. Use NearContractReader for view-only operations.');
  }

  async getPortfolioAllocation(accountId: string) {
    return this.viewMethod({
      methodName: 'get_portfolio_allocation',
      args: { account_id: accountId }
    });
  }

  async getPortfolioValue(accountId: string) {
    return this.viewMethod({
      methodName: 'get_portfolio_value',
      args: { account_id: accountId }
    });
  }
}

export const createNearContract = (selector: unknown, contractId?: string) => {
  return new NearContract(selector, contractId);
}; 