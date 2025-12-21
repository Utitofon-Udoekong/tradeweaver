// Types matching the Motoko backend Candid types

export type AssetType = { BTC: null } | { ETH: null } | { ICP: null };
export type FrequencyType = { Daily: null } | { Weekly: null } | { Biweekly: null } | { Monthly: null };

export interface Strategy {
  id: bigint;
  owner: { __principal__: string };
  targetAsset: AssetType;
  amount: bigint;
  frequency: FrequencyType;
  nextExecution: bigint;
  active: boolean;
  createdAt: bigint;
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
  if ('Daily' in freq) return 'Daily';
  if ('Weekly' in freq) return 'Weekly';
  if ('Biweekly' in freq) return 'Biweekly';
  return 'Monthly';
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
