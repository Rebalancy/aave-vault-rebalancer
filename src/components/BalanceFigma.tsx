'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { AAVE_VAULT_ABI, ERC20_ABI, getContractAddress, getUSDCAddress } from '@/utils/contracts';
import { getDepositSignature } from '@/utils/oracleClient';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { Button } from '@/components/Button';
import { useTransactionStatus } from '@/contexts/TransactionStatusContext';
import { useWelcome } from '@/contexts/WelcomeContext';
import { useDeposit } from '@/contexts/DepositContext';

// BUILD v5.7: Hybrid approach - wagmi writeContract with explicit gas limits
// This gives us cleaner code while avoiding MetaMask simulation issues

export const BalanceFigma = () => {
  const { address, isConnected, chainId, connector } = useAccount();
  const { hasDeposits, yieldEarned } = useWelcome();
  const { setTriggerDepositCallback } = useDeposit();
  const [currentState, setCurrentState] = useState<'balance' | 'deposit' | 'withdraw'>('balance');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositStep, setDepositStep] = useState<'input' | 'approving' | 'depositing' | 'confirming' | 'error'>('input');
  const [withdrawStep, setWithdrawStep] = useState<'input' | 'withdrawing' | 'confirming' | 'error'>('input');
  const [errorMessage, setErrorMessage] = useState('');
  const [depositValidationError, setDepositValidationError] = useState('');
  const [withdrawValidationError, setWithdrawValidationError] = useState('');

  
  // Validate and sanitize amount input - only allow valid decimal numbers
  const sanitizeAmountInput = (value: string): string => {
    // Remove any non-numeric characters except decimal point
    let sanitized = value.replace(/[^0-9.]/g, '');
    
    // Only allow one decimal point
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 6 decimal places (USDC decimals)
    if (parts.length === 2 && parts[1].length > 6) {
      sanitized = parts[0] + '.' + parts[1].slice(0, 6);
    }
    
    return sanitized;
  };
  
  // Check if a string is a valid positive number
  const isValidAmount = (value: string): boolean => {
    if (!value || value === '' || value === '.') return false;
    const num = parseFloat(value);
    return !isNaN(num) && num > 0 && isFinite(num);
  };
  
  // Check if tokens have been added to wallet (persisted in localStorage)
  const getTokenAddedKey = () => `tokensAdded_${address}_${chainId}`;
  const [tokensAddedToWallet, setTokensAddedToWallet] = useState(() => {
    if (typeof window !== 'undefined' && address && chainId) {
      return localStorage.getItem(getTokenAddedKey()) === 'true';
    }
    return false;
  });
  
  // Get performance data for APY, user's vault value, and totals
  const { currentApy, totalValue: userVaultValue, refetchVaultBalance } = usePerformanceData();
  
  // Transaction status context
  const { addMessage, upsertMessage, removeMessage, clearMessages } = useTransactionStatus();
  
  // Update tokensAddedToWallet state when address or chain changes
  useEffect(() => {
    if (address && chainId) {
      const isAdded = localStorage.getItem(getTokenAddedKey()) === 'true';
      setTokensAddedToWallet(isAdded);
    } else {
      setTokensAddedToWallet(false);
    }
  }, [address, chainId]);
  
  // BUILD v5.7: Contract write hooks with explicit gas limits
  const { 
    writeContract: writeVault, 
    data: vaultTxHash, 
    isPending: isVaultPending, 
    error: vaultWriteError,
    reset: resetVaultWrite 
  } = useWriteContract();
  
  const { 
    writeContract: writeUSDC, 
    data: usdcTxHash, 
    isPending: isUSDCPending, 
    error: usdcWriteError,
    reset: resetUSDCWrite 
  } = useWriteContract();
  
  // Transaction receipt hooks - automatically track tx status
  const { 
    isSuccess: isVaultTxSuccess, 
    isError: isVaultTxError
  } = useWaitForTransactionReceipt({ hash: vaultTxHash, chainId });
  
  const { 
    isLoading: isUSDCTxLoading, 
    isSuccess: isUSDCTxSuccess, 
    isError: isUSDCTxError 
  } = useWaitForTransactionReceipt({ hash: usdcTxHash, chainId });
  
  // Read user's USDC balance
  const { refetch: refetchUSDCBalance } = useReadContract({
    address: chainId ? getUSDCAddress(chainId) as `0x${string}` : undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!chainId }
  });

  // Read current USDC allowance for the vault
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: chainId ? getUSDCAddress(chainId) as `0x${string}` : undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && chainId ? [address, getContractAddress(chainId) as `0x${string}`] : undefined,
    query: { enabled: !!address && !!chainId }
  });
  
  // Read vault shares (user's balance in the vault)
  const { data: vaultShares, refetch: refetchVaultShares } = useReadContract({
    address: chainId ? getContractAddress(chainId) as `0x${string}` : undefined,
    abi: AAVE_VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!chainId }
  });



  // Read vault total assets and total supply for share price calculation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: chainId ? getContractAddress(chainId) as `0x${string}` : undefined,
    abi: AAVE_VAULT_ABI,
    functionName: 'totalAssets',
    query: { enabled: !!chainId }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: chainId ? getContractAddress(chainId) as `0x${string}` : undefined,
    abi: AAVE_VAULT_ABI,
    functionName: 'totalSupply',
    query: { enabled: !!chainId }
  });

  // Calculate user's balance in USDC
  // Note: userBalance calculation removed as it's not currently used in the UI

  // Format values for display
  // Note: balanceFormatted removed as it's not currently used in the UI
  
  const vaultSharesFormatted = vaultShares 
    ? parseFloat(formatUnits(vaultShares, 6)).toFixed(4)
    : '0.0000';

  // Format USDC balance for display
  // Display user's deposited funds in the vault (not wallet balance)
  const userDepositedFormatted = userVaultValue 
    ? parseFloat(userVaultValue.toString()).toFixed(2)
    : '0.00';





  // Check if user has sufficient allowance for the deposit amount
  const hasEnoughAllowance = (amount: string) => {
    if (!usdcAllowance || !amount || !isValidAmount(amount)) return false;
    try {
    const depositAmountInWei = parseUnits(amount, 6);
    return usdcAllowance >= depositAmountInWei;
    } catch {
      return false;
    }
  };

  // Add LP token to wallet function
  const addTokenToWallet = async () => {
    if (!chainId || !connector) {
      addMessage({
        type: 'error',
        message: 'No wallet connected. Please connect your wallet first.',
      });
      return;
    }
    
    const contractAddress = getContractAddress(chainId);
    if (!contractAddress) {
      addMessage({
        type: 'error',
        message: 'Vault contract not available on current network.',
      });
      return;
    }
    
    try {
      // Get the provider from the connected wallet (RainbowKit/Wagmi)
      const provider = await connector.getProvider();
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!provider || !(provider as any).request) {
        addMessage({
          type: 'error',
          message: 'Wallet provider not available.',
        });
        return;
      }
      
      console.log('Adding token to wallet:', {
        address: contractAddress,
        symbol: 'AAVE-RB',
        decimals: 6,
        connector: connector?.name,
        chainId: chainId
      });
      
      // Show manual instructions as well in case automatic adding fails
      console.log('Manual token details:', {
        'Contract Address': contractAddress,
        'Token Symbol': 'AAVE-RB',
        'Decimals': 6,
        'Network': chainId === 1 ? 'Ethereum' : chainId === 84532 ? 'Base Sepolia' : chainId
      });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wasAdded = await (provider as any).request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: contractAddress,
            symbol: 'AAVE-RB',
            decimals: 6,
            image: `${window.location.origin}/logo.svg`,
          },
        },
      });
      
      if (wasAdded) {
        setTokensAddedToWallet(true);
        // Persist to localStorage
        if (typeof window !== 'undefined' && address && chainId) {
          localStorage.setItem(getTokenAddedKey(), 'true');
        }
        addMessage({
          type: 'success',
          message: 'AAVE-RB LP token successfully added to wallet!',
        });
      } else {
        console.log('User rejected adding token to wallet');
      }
    } catch (error) {
      console.error('Failed to add token to wallet:', error);
      
      // Provide more specific error messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any).code === 4001) {
        console.log('User rejected the request');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if ((error as any).code === -32602) {
        addMessage({
          type: 'error',
          message: 'Wallet does not support adding custom tokens.',
        });
      } else {
        addMessage({
          type: 'error',
          message: `Failed to add token automatically. Add manually: Address: ${contractAddress}, Symbol: AAVE-RB, Decimals: 6`,
        });
      }
    }
  };

  // Simple state change functions
  const handleDeposit = useCallback(() => {
    setCurrentState('deposit');
    setDepositStep('input');
    setDepositAmount('');
  }, []);

  // Register deposit handler with context for welcome message to use
  useEffect(() => {
    setTriggerDepositCallback(handleDeposit);
  }, [setTriggerDepositCallback, handleDeposit]);

  // New function to handle the actual deposit initiation
  const handleInitiateDeposit = () => {
    if (!depositAmount) return;
    
    // Check if we have enough allowance
    if (hasEnoughAllowance(depositAmount)) {
      // Skip approval and go directly to deposit
      handleConfirmDeposit();
    } else {
      // Need approval first
      handleApproveUSDC();
    }
  };

  const handleWithdrawClick = () => {
    setCurrentState('withdraw');
  };

  const handleCancel = () => {
    setCurrentState('balance');
    setDepositStep('input');
    setWithdrawStep('input');
    setDepositAmount('');
    setWithdrawAmount('');
    setErrorMessage('');
    setDepositValidationError('');
    setWithdrawValidationError('');
    // Refresh balances when returning to balance view in case any transactions completed
    refreshAllBalances();
  };

  const handleRetry = () => {
    setDepositStep('input');
    setErrorMessage('');
  };

  // Reset errors when starting new operations
  const resetErrors = () => {
    setErrorMessage('');
  };

  // Refresh all balance-related data
  const refreshAllBalances = async () => {
    try {
      await Promise.all([
        refetchUSDCBalance(),
        refetchVaultShares(),
        refetchTotalAssets(),
        refetchTotalSupply(),
        refetchAllowance(),
        refetchVaultBalance() // Also refresh the usePerformanceData hook's data
      ]);
      console.log('All balances refreshed successfully');
    } catch (error) {
      console.error('Error refreshing balances:', error);
    }
  };

  // BUILD v5.7: Deposit flow using wagmi writeContract with explicit gas limits
  const handleApproveUSDC = () => {
    if (!address || !chainId || !depositAmount) return;
    
    // Final validation check before proceeding
    if (!isValidAmount(depositAmount)) {
      setDepositValidationError('Please enter a valid amount');
      return;
    }
    
    resetErrors();
    resetUSDCWrite(); // Reset any previous write state
    setDepositStep('approving');
    
    upsertMessage('deposit-approving', { type: 'pending', message: 'Approving spending limit...' });
    
    // Approve maximum amount (type(uint256).max) for unlimited spending
    const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    
    console.log('🚀 [BUILD v5.7] writeUSDC for approve with explicit gas limit');
    
    // Use wagmi writeContract with explicit gas limit to avoid MetaMask simulation issues
    writeUSDC({
      address: getUSDCAddress(chainId) as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [getContractAddress(chainId) as `0x${string}`, maxAmount],
      gas: BigInt(100000), // Explicit gas limit
    });
  };

  // BUILD v5.7: Deposit using wagmi writeContract with explicit gas limits
  const handleConfirmDeposit = async () => {
    if (!address || !chainId || !depositAmount) return;
    
    // Final validation check before proceeding
    if (!isValidAmount(depositAmount)) {
      setDepositValidationError('Please enter a valid amount');
      return;
    }
    
    resetErrors();
    resetVaultWrite(); // Reset any previous write state
    setDepositStep('depositing');
    
    try {
      removeMessage('deposit-approving');
      
      const amountInWei = parseUnits(depositAmount, 6);
      
      upsertMessage('deposit-pending', { type: 'pending', message: 'Getting cross-chain signature...' });
      
      // Get signed balance snapshot from oracle
      console.log('🚀 [BUILD v5.7] Requesting signature from oracle...');
      const snapshot = await getDepositSignature(
        amountInWei.toString(),
        address,
        chainId
      );
      console.log('🚀 [BUILD v5.7] Signature received from oracle:', snapshot);
      
      // Check if cross-chain assets exist (balance > 0)
      if (snapshot.balance === '0' || BigInt(snapshot.balance) === BigInt(0)) {
        console.log('🚀 [BUILD v5.7] No cross-chain assets, using regular deposit');
        upsertMessage('deposit-pending', { type: 'pending', message: 'Processing deposit...' });
        
        // Use wagmi writeContract with explicit gas limit
        writeVault({
          address: getContractAddress(chainId) as `0x${string}`,
          abi: AAVE_VAULT_ABI,
          functionName: 'deposit',
          args: [amountInWei, address as `0x${string}`],
          gas: BigInt(350000), // Explicit gas limit
        });
        
      } else {
        console.log('🚀 [BUILD v5.7] Using deposit with signature');
        console.log('🚀 [BUILD v5.7] Snapshot:', JSON.stringify({
          balance: snapshot.balance,
          nonce: snapshot.nonce,
          deadline: snapshot.deadline,
          assets: snapshot.assets,
          receiver: snapshot.receiver
        }));
        upsertMessage('deposit-pending', { type: 'pending', message: 'Deposit with signature in progress...' });
        
        // Use wagmi writeContract with signature and explicit gas limit
        writeVault({
          address: getContractAddress(chainId) as `0x${string}`,
          abi: AAVE_VAULT_ABI,
          functionName: 'depositWithExtraInfoViaSignature',
          args: [
            amountInWei,
            address as `0x${string}`,
            {
              balance: BigInt(snapshot.balance),
              nonce: BigInt(snapshot.nonce),
              deadline: BigInt(snapshot.deadline),
              assets: BigInt(snapshot.assets),
              receiver: snapshot.receiver as `0x${string}`,
            },
            snapshot.signature as `0x${string}`,
          ],
          gas: BigInt(350000), // Explicit gas limit
        });
      }
      
    } catch (error: unknown) {
      console.error('[BUILD v5.7] Deposit setup failed:', error);
      removeMessage('deposit-pending');
      setDepositStep('error');
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any)?.message?.includes('Oracle')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setErrorMessage(`Oracle service error: ${(error as any)?.message || 'Unable to get signature.'}`);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setErrorMessage(`Deposit failed: ${(error as any)?.message || 'Please check your wallet and try again.'}`);
      }
    }
  };

  // BUILD v5.7: Watch for transaction completion and errors with improved error handling
  useEffect(() => {
    // Helper to check for MetaMask simulation errors (false negatives on testnets)
    const isMetaMaskSimulationError = (error: Error | null) => {
      if (!error) return false;
      const msg = error.message || '';
      return msg.includes('Internal JSON-RPC error') || msg.includes('-32603');
    };

    // Helper to check for user rejection
    const isUserRejection = (error: Error | null) => {
      if (!error) return false;
      const msg = error.message?.toLowerCase() || '';
      return msg.includes('user rejected') || 
             msg.includes('rejected') || 
             msg.includes('denied') ||
             msg.includes('userrequestrejected');
    };

    // Success handlers
    if (isUSDCTxSuccess && depositStep === 'approving') {
      console.log('✅ [BUILD v5.7] Approval confirmed on-chain');
      upsertMessage('deposit-approving', { type: 'success', message: 'Approval successful. Proceeding…', txHash: usdcTxHash, chainId });
      handleConfirmDeposit();
      refetchAllowance();
    }
    
    if (isVaultTxSuccess && (depositStep === 'depositing' || depositStep === 'error')) {
      console.log('✅ [BUILD v5.7] Deposit confirmed on-chain');
      setDepositStep('confirming');
      removeMessage('deposit-pending');
      upsertMessage('deposit-success', { type: 'success', message: `Deposit of ${depositAmount} USDC completed successfully!`, txHash: vaultTxHash, chainId });
      refreshAllBalances();
    }
    
    if (isVaultTxSuccess && (withdrawStep === 'withdrawing' || withdrawStep === 'error')) {
      console.log('✅ [BUILD v5.7] Withdrawal confirmed on-chain');
      setWithdrawStep('confirming');
      addMessage({
        type: 'success',
        message: `Withdrawal of ${withdrawAmount} USDC completed successfully!`,
        txHash: vaultTxHash,
        chainId
      });
      refreshAllBalances();
    }
    
    // Transaction receipt errors (tx submitted but reverted)
    if (isUSDCTxError && depositStep === 'approving') {
      console.log('❌ [BUILD v5.7] Approval tx reverted on-chain');
      setDepositStep('error');
      setErrorMessage('USDC approval transaction reverted. Please try again.');
      upsertMessage('deposit-approving', { type: 'error', message: 'Approval failed on-chain.', txHash: usdcTxHash, chainId });
    }
    
    if (isVaultTxError && depositStep === 'depositing') {
      console.log('❌ [BUILD v5.7] Deposit tx reverted on-chain');
      setDepositStep('error');
      setErrorMessage('Deposit transaction reverted on-chain. Please try again.');
      upsertMessage('deposit-pending', { type: 'error', message: 'Deposit failed.', txHash: vaultTxHash, chainId });
    }
    
    if (isVaultTxError && withdrawStep === 'withdrawing') {
      console.log('❌ [BUILD v5.7] Withdrawal tx reverted on-chain');
      setWithdrawStep('error');
      setErrorMessage('Withdrawal transaction reverted on-chain. Please try again.');
    }

    // WriteContract errors (tx submission failed)
    if (usdcWriteError && depositStep === 'approving') {
      console.log('⚠️ [BUILD v5.7] USDC write error:', usdcWriteError.message);
      removeMessage('deposit-approving'); // Clear the approving message on error
      
      if (isUserRejection(usdcWriteError)) {
        setDepositStep('error');
        setErrorMessage('Transaction was rejected. Please try again if you want to proceed.');
      } else if (isMetaMaskSimulationError(usdcWriteError)) {
        // MetaMask simulation error - might be a false negative
        console.log('🔍 [BUILD v5.7] MetaMask simulation error detected - checking allowance...');
        // Check if approval actually worked
        refetchAllowance().then((result) => {
          const newAllowance = result.data as bigint | undefined;
          if (newAllowance && newAllowance > BigInt(0)) {
            console.log('✅ [BUILD v5.7] Approval succeeded despite MetaMask error!');
            upsertMessage('deposit-approving', { type: 'success', message: 'Approval confirmed! Proceeding...' });
            handleConfirmDeposit();
          } else {
            setDepositStep('error');
            setErrorMessage(
              'MetaMask reported an error, but this may be a false negative on testnets. ' +
              'Please check Arbiscan to verify, then try again. Consider using Rabby wallet.'
            );
          }
        });
        return;
      } else {
        setDepositStep('error');
        setErrorMessage(`Approval failed: ${usdcWriteError.message || 'Please try again.'}`);
      }
    }
    
    if (vaultWriteError && depositStep === 'depositing') {
      console.log('⚠️ [BUILD v5.7] Vault write error (deposit):', vaultWriteError.message);
      removeMessage('deposit-pending');
      
      if (isUserRejection(vaultWriteError)) {
        setDepositStep('error');
        setErrorMessage('Transaction was rejected. Please try again if you want to proceed.');
      } else if (isMetaMaskSimulationError(vaultWriteError)) {
        setDepositStep('error');
        setErrorMessage(
          'MetaMask reported an error, but this may be a false negative on testnets. ' +
          'Please check Arbiscan to verify your transaction. Consider using Rabby wallet.'
        );
        // Still refresh balances in case it worked
        refreshAllBalances();
      } else {
        setDepositStep('error');
        setErrorMessage(`Deposit failed: ${vaultWriteError.message || 'Please try again.'}`);
      }
    }
    
    if (vaultWriteError && withdrawStep === 'withdrawing') {
      console.log('⚠️ [BUILD v5.7] Vault write error (withdraw):', vaultWriteError.message);
      
      if (isUserRejection(vaultWriteError)) {
        setWithdrawStep('error');
        setErrorMessage('Transaction was rejected. Please try again if you want to proceed.');
      } else if (isMetaMaskSimulationError(vaultWriteError)) {
        setWithdrawStep('error');
        setErrorMessage(
          'MetaMask reported an error, but this may be a false negative on testnets. ' +
          'Please check Arbiscan to verify your transaction. Consider using Rabby wallet.'
        );
        // Still refresh balances in case it worked
        refreshAllBalances();
      } else {
        setWithdrawStep('error');
        setErrorMessage(`Withdrawal failed: ${vaultWriteError.message || 'Please try again.'}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUSDCTxSuccess, isVaultTxSuccess, isUSDCTxError, isVaultTxError, usdcWriteError, vaultWriteError, depositStep, withdrawStep, usdcTxHash, vaultTxHash, chainId, depositAmount, withdrawAmount]);

  // If user cancels in wallet or transaction fails, show appropriate error
  useEffect(() => {
    const isUserRejection = (error: Error | null) => {
      if (!error) return false;
      const msg = error.message?.toLowerCase() || '';
      return msg.includes('user rejected') || 
             msg.includes('rejected') || 
             msg.includes('denied') ||
             msg.includes('cancelled') ||
             msg.includes('canceled');
    };

    // Extract a clean, user-friendly error message
    const getCleanErrorMessage = (error: Error, action: string): string => {
      const msg = error.message || '';
      
      // Check for common contract errors
      if (msg.includes('insufficient funds')) {
        return 'Insufficient funds for gas fees.';
      }
      if (msg.includes('SignatureExpired')) {
        return 'Signature expired. Please try again.';
      }
      if (msg.includes('InvalidSignature')) {
        return 'Invalid signature from oracle. Please try again.';
      }
      if (msg.includes('InvalidAmount')) {
        return 'Invalid amount. Please check your input.';
      }
      if (msg.includes('reverted')) {
        // Extract just the revert reason if possible
        const revertMatch = msg.match(/reverted with the following reason:\s*([^.]+)/);
        if (revertMatch) {
          return `${action} failed: ${revertMatch[1].slice(0, 100)}`;
        }
        return `${action} failed: Transaction reverted. Please try again.`;
      }
      
      // Truncate long messages
      const cleanMsg = msg.split('Contract Call:')[0].trim();
      if (cleanMsg.length > 150) {
        return cleanMsg.slice(0, 150) + '...';
      }
      return cleanMsg || `${action} failed. Please try again.`;
    };

    if (usdcWriteError && depositStep === 'approving') {
      setDepositStep('error');
      if (isUserRejection(usdcWriteError)) {
      setErrorMessage('Approval was cancelled in wallet.');
      } else {
        console.error('Approval error:', usdcWriteError);
        setErrorMessage(getCleanErrorMessage(usdcWriteError, 'Approval'));
      }
    }
    if (vaultWriteError && depositStep === 'depositing') {
      setDepositStep('error');
      if (isUserRejection(vaultWriteError)) {
      setErrorMessage('Deposit was cancelled in wallet.');
      } else {
        console.error('Deposit error:', vaultWriteError);
        setErrorMessage(getCleanErrorMessage(vaultWriteError, 'Deposit'));
      }
    }
    if (vaultWriteError && withdrawStep === 'withdrawing') {
      setWithdrawStep('error');
      if (isUserRejection(vaultWriteError)) {
      setErrorMessage('Withdrawal was cancelled in wallet.');
      } else {
        console.error('Withdrawal error:', vaultWriteError);
        setErrorMessage(getCleanErrorMessage(vaultWriteError, 'Withdrawal'));
      }
    }
  }, [usdcWriteError, vaultWriteError, depositStep, withdrawStep]);

  // Render different states based on currentState
  const renderBalanceState = () => (
    <>
      {/* Title inside the card */}
      <h3 className="text-base font-semibold leading-[1.2] mb-6 text-white font-display">Balance</h3>
      {/* Balance Section - user's deposited funds in the vault */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          {/* USDC Icon */}
          <img src="/usdc-icon.svg" alt="USDC" className="w-6 h-6" />
          
          <div className="font-display font-medium text-[40px] leading-[1.2]">{userDepositedFormatted}</div>
          
          {/* Lifetime Yield - Show if user has deposits */}
          {hasDeposits && (
            <div className="text-green-400 font-medium text-[24px] leading-[1.2]">
              +{yieldEarned.toFixed(2)}
            </div>
          )}
        </div>
        
        <div className="text-gray-400 text-sm">
          {currentApy ? `${(currentApy * 100).toFixed(2)}% APY` : '4.47% APY'}
        </div>
      </div>

      {/* Vault Shares */}
      <div className="mb-6">
        <h4 className="text-gray-400 text-xs mb-2">Vault shares</h4>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {vaultSharesFormatted} <span className="text-gray-400 text-xs font-normal">LP tokens</span>
          </span>
          {!tokensAddedToWallet && (
            <button 
              onClick={addTokenToWallet}
              className="bg-gray2 text-primary text-xs border border-gray3 px-3 py-1.5 rounded-md hover:bg-gray1 transition-colors disabled:opacity-50"
              disabled={!isConnected || !chainId}
            >
              Add to Wallet
            </button>
          )}
        </div>
      </div>

      {/* Subtle line separator */}
      <div className="border-t border-gray3 mb-4"></div>

      {/* Simple Action Buttons */}
      <div className={`grid gap-2 ${hasDeposits ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {hasDeposits && (
          <Button 
            variant="secondary"
            onClick={handleWithdrawClick}
            disabled={!isConnected}
          >
            Withdraw
          </Button>
        )}
        <Button 
          variant="primary"
          onClick={handleDeposit}
          disabled={!isConnected}
        >
          Deposit
        </Button>
      </div>
    </>
  );

  const renderDepositState = () => {
    // Input step - user enters amount
    if (depositStep === 'input') {
      return (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-white font-display">Deposit</h3>
          </div>
          
          {/* Amount Input */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={depositAmount}
                onChange={(e) => {
                  const sanitized = sanitizeAmountInput(e.target.value);
                  setDepositAmount(sanitized);
                  // Clear validation error when user starts typing
                  if (depositValidationError) setDepositValidationError('');
                }}
                onBlur={() => {
                  // Validate on blur
                  if (depositAmount && !isValidAmount(depositAmount)) {
                    setDepositValidationError('Please enter a valid amount');
                  }
                }}
                className={`w-full bg-gray1 text-white p-4 rounded border ${depositValidationError ? 'border-red-500' : 'border-gray4'} focus:outline-none focus:border-blue-500 pr-20 text-base`}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <span className="text-gray-400 text-sm">USDC</span>
                <img src="/usdc-icon.svg" alt="USDC" className="w-6 h-6" />
              </div>
            </div>
            {depositValidationError && (
              <p className="text-red-400 text-sm mt-1">{depositValidationError}</p>
            )}
          </div>

          {/* Action Buttons - Cancel and Confirm */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="secondary"
              onClick={handleCancel}
              disabled={!isConnected}
            >
              Cancel
            </Button>
            <Button 
              variant="primary"
              onClick={handleInitiateDeposit}
              disabled={!depositAmount || !isConnected || !isValidAmount(depositAmount) || !!depositValidationError}
            >
              {depositAmount && isValidAmount(depositAmount) && hasEnoughAllowance(depositAmount) ? 'Deposit' : 'Approve'}
            </Button>
          </div>
        </>
      );
    }

    // Approving step - waiting for approval transaction
    if (depositStep === 'approving') {
      return (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-white font-display">Deposit</h3>
          </div>
          
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                value={depositAmount}
                disabled
                className="w-full bg-gray1 text-white p-4 rounded border border-gray4 pr-20 text-base"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <span className="text-gray-400 text-sm">USDC</span>
                <img src="/usdc-icon.svg" alt="USDC" className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleCancel}
              className="bg-gray-700 text-white py-2 px-6 rounded font-medium hover:bg-gray-600 transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirmDeposit}
              disabled={isUSDCPending || isUSDCTxLoading}
              className={`${(isUSDCPending || isUSDCTxLoading) ? 'bg-gray3 text-white border border-gray4' : 'bg-white text-black hover:bg-gray-100'} h-12 px-4 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 flex items-center justify-center flex-1`}
              aria-busy={isUSDCPending || isUSDCTxLoading}
            >
              {(isUSDCPending || isUSDCTxLoading) ? (
                'Processing...'
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        </>
      );
    }

    // Depositing step - waiting for deposit transaction
    if (depositStep === 'depositing') {
      return (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-white font-display">Deposit</h3>
          </div>
          
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                value={depositAmount}
                disabled
                className="w-full bg-gray1 text-white p-4 rounded border border-gray4 pr-20 text-base"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <span className="text-gray-400 text-sm">USDC</span>
                <img src="/usdc-icon.svg" alt="USDC" className="w-6 h-6" />
              </div>
            </div>
          </div>

          <button 
            disabled
            className="w-full bg-gray3 text-white h-12 px-4 rounded-lg font-medium text-sm cursor-not-allowed flex items-center justify-center border border-gray4"
            aria-busy="true"
          >
            Processing...
          </button>
        </>
      );
    }

    // Confirming step - transaction confirmed
    if (depositStep === 'confirming') {
      // Calculate values for display using accurate performance data
      // Deposits = the amount just deposited by the user
      const justDeposited = depositAmount ? parseFloat(depositAmount) : 0;
      const currentTotal = userVaultValue || 0; // Use accurate user total from performance hook
      const previousAmount = Math.max(0, currentTotal - justDeposited);

      return (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-white font-display">Deposit</h3>
          </div>
          
          {/* Summary */}
          <div className="mb-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Deposits</span>
                <span className="text-white font-medium">{justDeposited.toLocaleString()} USDC</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Previous</span>
                <span className="text-gray-400 font-medium">{previousAmount.toFixed(2)} USDC</span>
              </div>
              <div className="border-t border-gray3 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm">Total</span>
                  <span className="text-white font-semibold">{currentTotal.toLocaleString()} USDC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              className="px-6"
              onClick={() => {
                if (vaultTxHash && chainId) {
                  const getBlockExplorerUrl = (chainId: number, txHash: string) => {
                    switch (chainId) {
                      case 31337: // localhost - no block explorer
                        console.log('Transaction hash:', txHash);
                        alert(`Transaction hash: ${txHash}\n(No block explorer for localhost)`);
                        return;
                      case 84532: // Base Sepolia
                        return `https://sepolia.basescan.org/tx/${txHash}`;
                      case 421614: // Arbitrum Sepolia
                        return `https://sepolia.arbiscan.io/tx/${txHash}`;
                      case 11155420: // Optimism Sepolia
                        return `https://sepolia.optimistic.etherscan.io/tx/${txHash}`;
                      default:
                        return `https://etherscan.io/tx/${txHash}`; // Default to Ethereum mainnet
                    }
                  };
                  
                  const url = getBlockExplorerUrl(chainId, vaultTxHash);
                  if (url) {
                    window.open(url, '_blank');
                  }
                }
              }}
              disabled={!vaultTxHash}
            >
              View transaction
            </Button>
            <Button 
              variant="primary"
              className="flex-1"
              onClick={() => {
                setCurrentState('balance');
                setDepositStep('input');
                setDepositAmount('');
                clearMessages();
              }}
            >
              Done
            </Button>
          </div>
        </>
      );
    }

    // Error step - transaction failed or was rejected
    if (depositStep === 'error') {
      // Truncate error message for display
      const displayError = errorMessage.length > 150 
        ? errorMessage.slice(0, 150) + '...' 
        : errorMessage;
      
      return (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-white font-display">Deposit</h3>
          </div>
          
          <div className="text-center py-8">
            <div className="text-red-400 text-4xl mb-4">❌</div>
            <p className="text-white mb-2">Transaction Failed</p>
            <p className="text-gray-400 text-sm mb-6 break-words max-w-full overflow-hidden">{displayError}</p>
            
            <div className="flex gap-2">
              <button 
                onClick={handleCancel}
                className="bg-gray-700 text-white py-2 px-6 rounded font-medium hover:bg-gray-600 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleRetry}
                className="bg-white text-black py-2 px-4 rounded font-medium hover:bg-gray-100 transition-colors text-sm flex-1"
              >
                Try Again
              </button>
            </div>
          </div>
        </>
      );
    }

    return null;
  };

  // Calculate withdrawable amount using accurate performance data
  const withdrawableAmount = userVaultValue || 0; // User's deposited funds available
  
  const isWithdrawAmountValid = withdrawAmount && isValidAmount(withdrawAmount);
  const hasEnoughWithdrawBalance = withdrawableAmount > 0 && isValidAmount(withdrawAmount) && parseFloat(withdrawAmount) <= withdrawableAmount;
  const canWithdraw = isWithdrawAmountValid && hasEnoughWithdrawBalance && !isVaultPending && !withdrawValidationError;

  // BUILD v5.7: Withdraw using wagmi writeContract with explicit gas limits
  const handleWithdraw = () => {
    if (!withdrawAmount || !chainId || !address || !canWithdraw) return;
    
    // Final validation check before proceeding
    if (!isValidAmount(withdrawAmount)) {
      setWithdrawValidationError('Please enter a valid amount');
      return;
    }
    
    setWithdrawStep('withdrawing');
    resetVaultWrite(); // Reset any previous write state
    console.log('💳 [BUILD v5.7] Starting withdrawal:', withdrawAmount, 'USDC');
    
    const assetsWei = parseUnits(withdrawAmount, 6);
    
    // Use wagmi writeContract with explicit gas limit
    writeVault({
      address: getContractAddress(chainId) as `0x${string}`,
      abi: AAVE_VAULT_ABI,
      functionName: 'withdraw',
      args: [assetsWei, address as `0x${string}`, address as `0x${string}`],
      gas: BigInt(350000), // Explicit gas limit
    });
  };

  const renderWithdrawState = () => {
    // Calculate values for display - available across all steps using accurate performance data
    // For withdraw, estimate deposits based on vault shares and use accurate total
    const userVaultShares = vaultShares ? parseFloat(formatUnits(vaultShares, 6)) : 0; // shares decimals ~ underlying (USDC: 6)
    const currentDeposits = userVaultShares; // assume initial sharePrice ~1
    const currentTotal = userVaultValue || 0;
    const totalYield = Math.max(0, currentTotal - currentDeposits);
    
    // Calculate yield specifically for the withdrawal amount
    const withdrawalAmount = withdrawAmount ? parseFloat(withdrawAmount) : 0;
    
    // Calculate what percentage of the vault is original deposits vs yield
    const depositPercentage = currentTotal > 0 ? currentDeposits / currentTotal : 0;
    const yieldPercentage = currentTotal > 0 ? totalYield / currentTotal : 0;
    
    // For withdrawal: how much of the withdrawal amount represents original deposits vs yield
    const withdrawalDeposits = withdrawalAmount * depositPercentage;
    const withdrawalYield = withdrawalAmount * yieldPercentage;

    // Input step - user enters amount
    if (withdrawStep === 'input') {
      return (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-medium text-white font-display">Withdraw</h3>
          </div>
          
          {/* Summary */}
          <div className="mb-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Deposits</span>
                <span className="text-white font-medium">{currentDeposits.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Yield</span>
                <span className="text-green-400 font-medium">{totalYield.toFixed(2)} USDC</span>
              </div>
              <div className="border-t border-gray3 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm">Total</span>
                  <span className="text-white font-semibold">{currentTotal.toFixed(2)} USDC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={withdrawAmount}
                onChange={(e) => {
                  const sanitized = sanitizeAmountInput(e.target.value);
                  setWithdrawAmount(sanitized);
                  // Clear validation error when user starts typing
                  if (withdrawValidationError) setWithdrawValidationError('');
                }}
                onBlur={() => {
                  // Validate on blur
                  if (withdrawAmount && !isValidAmount(withdrawAmount)) {
                    setWithdrawValidationError('Please enter a valid amount');
                  }
                }}
                className={`w-full bg-gray1 text-white p-4 rounded border ${withdrawValidationError ? 'border-red-500' : 'border-gray4'} focus:outline-none focus:border-blue-500 text-base`}
              />
              <button
                onClick={() => {
                  setWithdrawAmount(withdrawableAmount.toFixed(6));
                  setWithdrawValidationError('');
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-400 text-sm hover:text-blue-300"
              >
                Max
              </button>
            </div>
            {withdrawValidationError && (
              <p className="text-red-400 text-sm mt-1">{withdrawValidationError}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={handleCancel}
              className="px-6"
            >
              Cancel
            </Button>
            <Button 
              variant="primary"
              className="flex-1"
              onClick={handleWithdraw}
              disabled={!canWithdraw}
            >
              Confirm
            </Button>
          </div>

          {/* Error/Warning Messages */}
          {!hasEnoughWithdrawBalance && withdrawAmount && (
            <div className="mt-3 text-red-400 text-sm">
              Insufficient vault balance
            </div>
          )}
        </>
      );
    }

    // Withdrawing step - waiting for withdraw transaction
    if (withdrawStep === 'withdrawing') {
      return (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-medium text-white font-display">Withdraw</h3>
          </div>
          
          {/* Summary */}
          <div className="mb-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Deposits</span>
                <span className="text-white font-medium">{withdrawalDeposits.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Yield</span>
                <span className="text-green-400 font-medium">{withdrawalYield.toFixed(2)} USDC</span>
              </div>
              <div className="border-t border-gray3 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm">Total</span>
                  <span className="text-white font-semibold">{withdrawalAmount.toFixed(2)} USDC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Processing indicator as spinner button */}
          <div className="py-4">
            <button disabled className="w-full bg-gray3 text-white h-12 px-4 rounded-lg font-medium text-sm cursor-not-allowed flex items-center justify-center border border-gray4" aria-busy="true">
              Processing...
            </button>
          </div>
        </>
      );
    }

    // Confirming step - transaction confirmed
    if (withdrawStep === 'confirming') {
      return (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-medium text-white font-display">Withdraw</h3>
          </div>
          
          {/* Summary */}
          <div className="mb-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Deposits</span>
                <span className="text-white font-medium">{withdrawalDeposits.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 text-sm">Yield</span>
                <span className="text-green-400 font-medium">{withdrawalYield.toFixed(2)} USDC</span>
              </div>
              <div className="border-t border-gray3 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm">Total</span>
                  <span className="text-white font-semibold">{withdrawalAmount.toFixed(2)} USDC</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              className="px-6"
              onClick={() => {
                if (vaultTxHash && chainId) {
                  const getBlockExplorerUrl = (chainId: number, txHash: string) => {
                    switch (chainId) {
                      case 31337: // localhost - no block explorer
                        console.log('Transaction hash:', txHash);
                        alert(`Transaction hash: ${txHash}\n(No block explorer for localhost)`);
                        return;
                      case 84532: // Base Sepolia
                        return `https://sepolia.basescan.org/tx/${txHash}`;
                      case 421614: // Arbitrum Sepolia
                        return `https://sepolia.arbiscan.io/tx/${txHash}`;
                      case 11155420: // Optimism Sepolia
                        return `https://sepolia.optimistic.etherscan.io/tx/${txHash}`;
                      default:
                        return `https://etherscan.io/tx/${txHash}`; // Default to Ethereum mainnet
                    }
                  };
                  
                  const url = getBlockExplorerUrl(chainId, vaultTxHash);
                  if (url) {
                    window.open(url, '_blank');
                  }
                }
              }}
              disabled={!vaultTxHash}
            >
              View transaction
            </Button>
            <Button 
              variant="primary"
              className="flex-1"
              onClick={() => {
                setCurrentState('balance');
                setWithdrawStep('input');
                setWithdrawAmount('');
                clearMessages();
              }}
            >
              Done
            </Button>
          </div>
        </>
      );
    }

    // Error step - transaction failed or was rejected
    if (withdrawStep === 'error') {
      // Truncate error message for display
      const displayError = errorMessage.length > 150 
        ? errorMessage.slice(0, 150) + '...' 
        : errorMessage;
      
      return (
    <>
      <h3 className="text-base font-medium mb-6 text-white font-display">Withdraw</h3>
          
      <div className="text-center py-8">
            <div className="text-red-400 text-4xl mb-4">❌</div>
            <p className="text-white mb-2">Withdrawal Failed</p>
            <p className="text-gray-400 text-sm mb-4 break-words max-w-full overflow-hidden">{displayError}</p>
            
            <div className="flex gap-2">
        <button 
          onClick={handleCancel}
          className="bg-gray-700 text-white py-2 px-6 rounded font-medium hover:bg-gray-600 transition-colors text-sm"
        >
          Cancel
        </button>
              <button 
                onClick={() => setWithdrawStep('input')}
                className="bg-gray-800 text-white py-2 px-4 rounded font-medium hover:bg-gray-700 transition-colors text-sm flex-1"
              >
                Try Again
              </button>
            </div>
      </div>
    </>
  );
    }

    return null;
  };

  return (
    <div className="text-primary w-full">
      {/* Balance Card Container - matches sidebar components spec */}
      <div className="bg-gray2 border border-gray3 rounded-md p-6">
        {currentState === 'balance' && renderBalanceState()}
        {currentState === 'deposit' && renderDepositState()}
        {currentState === 'withdraw' && renderWithdrawState()}
      </div>
    </div>
  );
};

export default BalanceFigma;
