"use client";

import { useICP } from "@/lib/icp-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wallet, TrendingUp, TrendingDown, History, Plus, Loader2, Zap, Bitcoin } from "lucide-react";
import { useState } from "react";
import { getAssetSymbol, getAssetName, getFrequencyLabel, formatUSD, formatCrypto, type AssetType, type FrequencyType } from "@/lib/types";

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading, login, logout, actor, principal } = useICP();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch portfolio data
  const { data: portfolio = [], isLoading: portfolioLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => actor?.getPortfolio() || [],
    enabled: !!actor && isAuthenticated,
    refetchInterval: 60000,
  });

  // Fetch P&L data
  const { data: profitLoss } = useQuery({
    queryKey: ['profitLoss'],
    queryFn: async () => actor?.getProfitLoss(),
    enabled: !!actor && isAuthenticated,
    refetchInterval: 60000,
  });

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
    try {
      await actor.triggerExecution(strategyId);
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['profitLoss'] });
    } catch (e) {
      console.error(e);
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

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
        <div className="text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 p-3">
              <Zap className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="mb-2 text-5xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            TradeWeaver
          </h1>
          <p className="mb-8 text-lg text-gray-400">
            Autonomous DCA Agent on ICP with Chain Fusion
          </p>

          <div className="mb-8 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl bg-gray-800/50 p-4 backdrop-blur">
              <Bitcoin className="mx-auto mb-2 h-6 w-6 text-orange-500" />
              <p className="text-sm text-gray-400">Bitcoin</p>
            </div>
            <div className="rounded-xl bg-gray-800/50 p-4 backdrop-blur">
              <div className="mx-auto mb-2 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">Ξ</div>
              <p className="text-sm text-gray-400">Ethereum</p>
            </div>
            <div className="rounded-xl bg-gray-800/50 p-4 backdrop-blur">
              <div className="mx-auto mb-2 h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold">∞</div>
              <p className="text-sm text-gray-400">ICP</p>
            </div>
          </div>

          <button
            onClick={login}
            className="rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 px-8 py-4 font-semibold text-white transition hover:opacity-90 shadow-lg shadow-purple-500/25"
          >
            Connect with Internet Identity
          </button>

          <p className="mt-4 text-sm text-gray-500">
            Set it once, invest forever
          </p>
        </div>
      </div>
    );
  }

  // Main Dashboard
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
              <p className="text-sm text-gray-400 font-mono truncate max-w-[200px]">{principal?.slice(0, 15)}...</p>
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

        {/* Live Prices */}
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">Portfolio Value</h3>
              <Wallet className="text-cyan-500" size={20} />
            </div>
            <p className="mt-2 text-3xl font-bold text-white">
              ${profitLoss?.totalValue.toFixed(2) || '0.00'}
            </p>
          </div>

          <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">Total Invested</h3>
              <TrendingUp className="text-gray-500" size={20} />
            </div>
            <p className="mt-2 text-3xl font-bold text-white">
              ${profitLoss?.totalCost.toFixed(2) || '0.00'}
            </p>
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

        {/* Active Strategies */}
        <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50">
          <div className="border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Active Strategies</h2>
            <span className="text-sm text-gray-400">{strategies.length} total</span>
          </div>
          <div className="p-4">
            {strategies.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No strategies yet. Create one to start DCA.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {strategies.map((strategy) => (
                  <div key={Number(strategy.id)} className="rounded-lg bg-gray-900/50 border border-gray-700/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${'BTC' in strategy.targetAsset ? 'bg-orange-500/20 text-orange-400' :
                            'ETH' in strategy.targetAsset ? 'bg-blue-500/20 text-blue-400' :
                              'bg-purple-500/20 text-purple-400'}`}>
                          {getAssetSymbol(strategy.targetAsset).charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{getAssetName(strategy.targetAsset)}</p>
                          <p className="text-xs text-gray-400">{getFrequencyLabel(strategy.frequency)}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${strategy.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {strategy.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-white mb-3">{formatUSD(strategy.amount)} / {getFrequencyLabel(strategy.frequency).toLowerCase()}</p>
                    <button
                      onClick={() => handleTriggerExecution(strategy.id)}
                      className="w-full rounded-lg bg-cyan-500/20 text-cyan-400 py-2 text-sm font-medium hover:bg-cyan-500/30 transition"
                    >
                      Execute Now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Purchase History */}
        <div className="rounded-xl bg-gray-800/50 backdrop-blur border border-gray-700/50">
          <div className="border-b border-gray-700/50 px-6 py-4 flex items-center gap-2">
            <History size={18} className="text-gray-500" />
            <h2 className="font-semibold text-white">Recent Purchases</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/50 text-gray-400">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Asset</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Price</th>
                  <th className="px-6 py-3 text-right">Total USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {purchases.slice().reverse().slice(0, 10).map((tx, i) => (
                  <tr key={i} className="hover:bg-gray-700/20 transition">
                    <td className="px-6 py-4 text-gray-300">
                      {format(new Date(Number(tx.timestamp) / 1_000_000), 'MMM d, HH:mm')}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {getAssetName(tx.asset)}
                    </td>
                    <td className="px-6 py-4 text-gray-300 font-mono">{formatCrypto(tx.amountAsset)}</td>
                    <td className="px-6 py-4 text-gray-300">${tx.price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-medium text-white">
                      {formatUSD(tx.amountUSD)}
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No purchases yet. Create a strategy and execute it.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
    onCreate(asset, amount * 100, freq); // Convert to cents
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-white mb-6">Create DCA Strategy</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Asset</label>
            <div className="grid grid-cols-3 gap-2">
              {(['BTC', 'ETH', 'ICP'] as const).map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => setSelectedAsset(asset)}
                  className={`p-3 rounded-lg border transition ${selectedAsset === asset
                      ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
              placeholder="100"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Biweekly">Biweekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
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
