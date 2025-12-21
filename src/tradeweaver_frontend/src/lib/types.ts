// Types matching the Motoko backend Candid types

export type AssetType = { BTC: null } | { ETH: null } | { ICP: null };

// Flexible frequency types
export type FrequencyType = 
  | { Seconds: bigint }
  | { Minutes: bigint }
  | { Hours: bigint }
  | { Daily: null } 
  | { Weekly: null } 
  | { Monthly: null };

// Trigger conditions for conditional execution
export type TriggerConditionType =
  | { None: null }
  | { PriceBelow: number }
  | { PriceAbove: number }
  | { PriceDropPercent: number }
  | { PriceBelowAverage: number };

export interface Strategy {
  id: bigint;
  owner: { __principal__: string };
  targetAsset: AssetType;
  amount: bigint;
  frequency: FrequencyType;
  triggerCondition: TriggerConditionType;
  intervalSeconds: bigint;
  nextExecution: bigint;
  active: boolean;
  createdAt: bigint;
  executionCount: bigint;
}

export interface Purchase {
  id: bigint;
  strategyId: bigint;
  asset: AssetType;
  amountUSD: bigint;
  amountAsset: number;
  price: number;
  timestamp: bigint;
  txHash: string;
}

export interface Holding {
  asset: AssetType;
  amount: number;
  costBasis: number;
  averagePrice: number;
}

export interface ProfitLoss {
  totalValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface PriceResponse {
  asset: AssetType;
  priceUSD: number;
  timestamp: bigint;
}

// Helper functions
export function getAssetSymbol(asset: AssetType): string {
  if ('BTC' in asset) return 'BTC';
  if ('ETH' in asset) return 'ETH';
  return 'ICP';
}

export function getAssetName(asset: AssetType): string {
  if ('BTC' in asset) return 'Bitcoin';
  if ('ETH' in asset) return 'Ethereum';
  return 'Internet Computer';
}

export function getFrequencyLabel(freq: FrequencyType): string {
  if ('Seconds' in freq) return `Every ${freq.Seconds}s`;
  if ('Minutes' in freq) return `Every ${freq.Minutes}m`;
  if ('Hours' in freq) return `Every ${freq.Hours}h`;
  if ('Daily' in freq) return 'Daily';
  if ('Weekly' in freq) return 'Weekly';
  return 'Monthly';
}

export function getTriggerLabel(cond: TriggerConditionType): string {
  if ('None' in cond) return 'Always';
  if ('PriceBelow' in cond) return `Price < $${cond.PriceBelow}`;
  if ('PriceAbove' in cond) return `Price > $${cond.PriceAbove}`;
  if ('PriceDropPercent' in cond) return `${cond.PriceDropPercent}% dip`;
  if ('PriceBelowAverage' in cond) return `${cond.PriceBelowAverage}% below avg`;
  return 'Custom';
}

export function formatUSD(cents: bigint | number): string {
  const amount = typeof cents === 'bigint' ? Number(cents) / 100 : cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatCrypto(amount: number, decimals: number = 6): string {
  return amount.toFixed(decimals);
}
