"use client";

import { useICP } from "@/lib/icp-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wallet, TrendingUp, TrendingDown, History, Plus, Loader2, Zap, Bitcoin, Brain, ArrowRight, Info } from "lucide-react";
import { useState } from "react";
import { getAssetSymbol, getAssetName, getFrequencyLabel, formatUSD, formatCrypto, type AssetType, type FrequencyType } from "@/lib/types";

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading, login, logout, actor, principal } = useICP();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isExecuting, setIsExecuting] = useState<bigint | null>(null);

  // Fetch all prices
  const { data: prices = [] } = useQuery({
    queryKey: ['prices'],
    queryFn: async () => actor?.getAllPrices() || [],
    enabled: !!actor,
    refetchInterval: 30000,
  });

  // Fetch strategies
  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => actor?.getStrategies() || [],
    enabled: !!actor && isAuthenticated,
  });

  // Fetch purchase history
  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => actor?.getAllPurchases() || [],
    enabled: !!actor && isAuthenticated,
  });

  // Fetch P&L data
  const { data: profitLoss } = useQuery({
    queryKey: ['profitLoss'],
    queryFn: async () => actor?.getProfitLoss(),
    enabled: !!actor && isAuthenticated,
    refetchInterval: 60000,
  });

  const handleCreateStrategy = async (asset: AssetType, amount: number, frequency: FrequencyType) => {
    if (!actor) return;
    setIsCreating(true);
    try {
      const result = await actor.createStrategy(asset, BigInt(amount), frequency);
      if ('ok' in result) {
        queryClient.invalidateQueries({ queryKey: ['strategies'] });
        setShowCreateModal(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleTriggerExecution = async (strategyId: bigint) => {
    if (!actor) return;
    setIsExecuting(strategyId);
    try {
      await actor.triggerExecution(strategyId);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['profitLoss'] });
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    } catch (e) {
      console.error(e);
    } finally {
      setIsExecuting(null);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="mt-4 text-gray-400">Loading TradeWeaver...</p>
      </div>
    );
  }

  // Login screen with explanation
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
        <div className="mx-auto max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-12 pt-12">
            <div className="mb-6 flex items-center justify-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 p-3">
                <Zap className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="mb-4 text-5xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              TradeWeaver
            </h1>
            <p className="mb-2 text-xl text-white">
              AI-Powered Autonomous DCA Bot
            </p>
            <p className="text-gray-400 max-w-lg mx-auto">
              Automatically buys crypto on a schedule using AI to optimize your purchase amounts based on market conditions.
            </p>
          </div>

          {/* What is DCA */}
          <div className="bg-gray-800/50 backdrop-blur rounded-2xl border border-gray-700/50 p-8 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">What is Dollar-Cost Averaging (DCA)?</h2>
            <p className="text-gray-300 mb-6">
              DCA is an investment strategy where you invest a fixed amount regularly (e.g., $100 every week)
              regardless of price. This reduces the impact of volatility and removes the stress of timing the market.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-gray-900/50 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">1️⃣</div>
                <p className="font-medium text-white">Create Strategy</p>
                <p className="text-sm text-gray-400">Pick asset, amount, frequency</p>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">2️⃣</div>
                <p className="font-medium text-white">AI Optimizes</p>
                <p className="text-sm text-gray-400">Adjusts based on trends</p>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">3️⃣</div>
                <p className="font-medium text-white">Auto Executes</p>
                <p className="text-sm text-gray-400">Buys on schedule</p>
              </div>
            </div>
          </div>

          {/* Supported Assets */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-gray-700/50 p-6 text-center">
              <Bitcoin className="mx-auto mb-3 h-10 w-10 text-orange-500" />
              <p className="font-bold text-white">Bitcoin</p>
              <p className="text-sm text-gray-400">via Schnorr signatures</p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-gray-700/50 p-6 text-center">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl font-bold text-blue-400">Ξ</div>
              <p className="font-bold text-white">Ethereum</p>
              <p className="text-sm text-gray-400">via ECDSA signatures</p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur rounded-xl border border-gray-700/50 p-6 text-center">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center text-xl font-bold text-purple-400">∞</div>
              <p className="font-bold text-white">ICP</p>
              <p className="text-sm text-gray-400">Native transfers</p>
            </div>
          </div>

          {/* Demo Notice */}
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-8 flex items-start gap-3">
            <Info className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-cyan-400">Demo Mode</p>
              <p className="text-sm text-gray-300">
                This is a simulation. No real money is involved. Purchases are simulated to demonstrate how the DCA bot works.
              </p>
            </div>
          </div>

          {/* Login Button */}
          <div className="text-center">
            <button
              onClick={login}
              className="rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 px-10 py-4 font-semibold text-white text-lg transition hover:opacity-90 shadow-lg shadow-purple-500/25"
            >
              Connect with Internet Identity
            </button>
            <p className="mt-4 text-sm text-gray-500">
              Uses ICP's Internet Identity for secure, passwordless login
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  const hasStrategies = strategies.length > 0;
  const hasPurchases = purchases.length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 p-2">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">TradeWeaver</h1>
              <p className="text-xs text-gray-500">Demo Mode • No real funds</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              <Plus size={18} />
              New Strategy
            </button>
            <button
              onClick={logout}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Getting Started Guide - Show when no strategies */}
        {!hasStrategies && (
          <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-2">Get Started</h2>
            <p className="text-gray-300 mb-4">
              Create your first DCA strategy to start automated investing.
            </p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <span className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">1</span>
                Click "New Strategy"
              </div>
              <ArrowRight className="h-4 w-4 text-gray-600" />
              <div className="flex items-center gap-2 text-gray-400">
                <span className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">2</span>
                Pick asset & amount
              </div>
              <ArrowRight className="h-4 w-4 text-gray-600" />
              <div className="flex items-center gap-2 text-gray-400">
                <span className="h-6 w-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">3</span>
                Click "Execute Now" to simulate
              </div>
            </div>
          </div>
        )}

        {/* Live Prices */}
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3">Live Prices (from CoinGecko)</h2>
          <div className="grid grid-cols-3 gap-4">
            {prices.map(([asset, price]) => (
              <div key={getAssetSymbol(asset)} className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${'BTC' in asset ? 'bg-orange-500/20 text-orange-400' :
                      'ETH' in asset ? 'bg-blue-500/20 text-blue-400' :
                        'bg-purple-500/20 text-purple-400'}`}>
                    {getAssetSymbol(asset).charAt(0)}
                  </div>
                  <span className="text-gray-400">{getAssetSymbol(asset)}</span>
                </div>
                <p className="text-2xl font-bold text-white">${price.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats - Only show if has purchases */}
        {hasPurchases && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">Portfolio Value</h3>
                <Wallet className="text-cyan-500" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-white">
                ${profitLoss?.totalValue.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Simulated value</p>
            </div>

            <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">Total Invested</h3>
                <TrendingUp className="text-gray-500" size={20} />
              </div>
              <p className="mt-2 text-3xl font-bold text-white">
                ${profitLoss?.totalCost.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Across {purchases.length} purchases</p>
            </div>

            <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">Profit / Loss</h3>
                {(profitLoss?.profitLoss || 0) >= 0 ? (
                  <TrendingUp className="text-green-500" size={20} />
                ) : (
                  <TrendingDown className="text-red-500" size={20} />
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <p className={`text-3xl font-bold ${(profitLoss?.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(profitLoss?.profitLoss || 0) >= 0 ? '+' : ''}${profitLoss?.profitLoss.toFixed(2) || '0.00'}
                </p>
                <span className={`text-sm ${(profitLoss?.profitLoss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ({profitLoss?.profitLossPercent.toFixed(1) || 0}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Active Strategies */}
        <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50">
          <div className="border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">Your DCA Strategies</h2>
              <p className="text-xs text-gray-500">Automated recurring purchases</p>
            </div>
            <span className="text-sm text-gray-400">{strategies.length} total</span>
          </div>
          <div className="p-4">
            {strategies.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-gray-800 mx-auto mb-4 flex items-center justify-center">
                  <Plus className="h-8 w-8 text-gray-600" />
                </div>
                <p className="text-gray-400 mb-4">No strategies yet</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                >
                  Create Your First Strategy
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {strategies.map((strategy) => (
                  <div key={Number(strategy.id)} className="rounded-lg bg-gray-900/50 border border-gray-700/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold
                          ${'BTC' in strategy.targetAsset ? 'bg-orange-500/20 text-orange-400' :
                            'ETH' in strategy.targetAsset ? 'bg-blue-500/20 text-blue-400' :
                              'bg-purple-500/20 text-purple-400'}`}>
                          {getAssetSymbol(strategy.targetAsset).charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{getAssetName(strategy.targetAsset)}</p>
                          <p className="text-xs text-gray-400">{getFrequencyLabel(strategy.frequency)} purchases</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${strategy.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {strategy.active ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-2xl font-bold text-white">{formatUSD(strategy.amount)}</p>
                      <p className="text-sm text-gray-400">per {getFrequencyLabel(strategy.frequency).toLowerCase()}</p>
                    </div>

                    {/* AI Badge */}
                    <div className="flex items-center gap-1 text-xs text-purple-400 mb-3">
                      <Brain size={12} />
                      <span>AI adjusts amount based on market</span>
                    </div>

                    <button
                      onClick={() => handleTriggerExecution(strategy.id)}
                      disabled={isExecuting === strategy.id}
                      className="w-full rounded-lg bg-cyan-500/20 text-cyan-400 py-2.5 text-sm font-medium hover:bg-cyan-500/30 transition disabled:opacity-50"
                    >
                      {isExecuting === strategy.id ? 'Executing...' : 'Execute Now (Simulate)'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Purchase History */}
        {hasPurchases && (
          <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50">
            <div className="border-b border-gray-700/50 px-6 py-4 flex items-center gap-2">
              <History size={18} className="text-gray-500" />
              <div>
                <h2 className="font-semibold text-white">Purchase History</h2>
                <p className="text-xs text-gray-500">Simulated transactions</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-900/50 text-gray-400">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Asset</th>
                    <th className="px-6 py-3">Crypto Amount</th>
                    <th className="px-6 py-3">Price</th>
                    <th className="px-6 py-3 text-right">USD Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {purchases.slice().reverse().slice(0, 10).map((tx, i) => (
                    <tr key={i} className="hover:bg-gray-700/20 transition">
                      <td className="px-6 py-4 text-gray-300">
                        {format(new Date(Number(tx.timestamp) / 1_000_000), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold
                            ${'BTC' in tx.asset ? 'bg-orange-500/20 text-orange-400' :
                              'ETH' in tx.asset ? 'bg-blue-500/20 text-blue-400' :
                                'bg-purple-500/20 text-purple-400'}`}>
                            {getAssetSymbol(tx.asset).charAt(0)}
                          </div>
                          <span className="font-medium text-white">{getAssetSymbol(tx.asset)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-300 font-mono">{formatCrypto(tx.amountAsset)}</td>
                      <td className="px-6 py-4 text-gray-300">${tx.price.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-medium text-white">
                        {formatUSD(tx.amountUSD)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Strategy Modal */}
      {showCreateModal && (
        <CreateStrategyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateStrategy}
          isCreating={isCreating}
        />
      )}
    </main>
  );
}

// Create Strategy Modal Component
function CreateStrategyModal({
  onClose,
  onCreate,
  isCreating,
}: {
  onClose: () => void;
  onCreate: (asset: AssetType, amount: number, frequency: FrequencyType) => void;
  isCreating: boolean;
}) {
  const [selectedAsset, setSelectedAsset] = useState<'BTC' | 'ETH' | 'ICP'>('BTC');
  const [amount, setAmount] = useState(100);
  const [frequency, setFrequency] = useState<'Daily' | 'Weekly' | 'Biweekly' | 'Monthly'>('Weekly');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const asset: AssetType = selectedAsset === 'BTC' ? { BTC: null } : selectedAsset === 'ETH' ? { ETH: null } : { ICP: null };
    const freq: FrequencyType = frequency === 'Daily' ? { Daily: null } : frequency === 'Weekly' ? { Weekly: null } : frequency === 'Biweekly' ? { Biweekly: null } : { Monthly: null };
    onCreate(asset, amount * 100, freq);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-2">Create DCA Strategy</h2>
        <p className="text-sm text-gray-400 mb-6">Set up automated recurring purchases</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Which crypto?</label>
            <div className="grid grid-cols-3 gap-2">
              {(['BTC', 'ETH', 'ICP'] as const).map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => setSelectedAsset(asset)}
                  className={`p-4 rounded-lg border transition flex flex-col items-center ${selectedAsset === asset
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                >
                  <span className="text-lg font-bold">{asset}</span>
                  <span className="text-xs mt-1">
                    {asset === 'BTC' ? 'Bitcoin' : asset === 'ETH' ? 'Ethereum' : 'Internet Computer'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">How much per purchase? (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white text-lg focus:border-cyan-500 focus:outline-none"
              placeholder="100"
            />
            <p className="text-xs text-gray-500 mt-1">AI may adjust this ±25% based on market conditions</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">How often?</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Daily', 'Weekly', 'Biweekly', 'Monthly'] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequency(freq)}
                  className={`p-3 rounded-lg border transition ${frequency === freq
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 mt-4">
            <p className="text-sm text-gray-300">
              <strong className="text-white">Summary:</strong> Buy ~${amount} of {selectedAsset} {frequency.toLowerCase()}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-800 py-3 text-gray-300 hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 py-3 font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Strategy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
