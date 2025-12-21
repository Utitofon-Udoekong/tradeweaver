"use client";

import { useICP } from "@/lib/icp-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Zap, Send, Bot, User, TrendingUp, Wallet, Bitcoin, Brain, Shield, Link2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { getAssetSymbol, formatUSD, formatCrypto, type AssetType, type FrequencyType, type TriggerConditionType } from "@/lib/types";

interface Message {
  id: number;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  action?: {
    type: 'strategy_created' | 'purchase_executed' | 'info';
    data?: unknown;
  };
}

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading, login, logout, actor, principal } = useICP();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch strategies and prices
  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => actor?.getStrategies() || [],
    enabled: !!actor && isAuthenticated,
  });

  const { data: prices = [] } = useQuery({
    queryKey: ['prices'],
    queryFn: async () => actor?.getAllPrices() || [],
    enabled: !!actor,
    refetchInterval: 30000,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => actor?.getAllPurchases() || [],
    enabled: !!actor && isAuthenticated,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial greeting when authenticated
  useEffect(() => {
    if (isAuthenticated && messages.length === 0) {
      setMessages([{
        id: 1,
        role: 'agent',
        content: "Hey! I'm TradeWeaver, your AI trading agent. 🤖\n\nTell me what to buy in plain English:\n\n**Custom Timing:**\n• \"Buy $50 of BTC every 30 minutes\"\n• \"Invest $100 in ETH every 2 hours\"\n• \"Get $25 ICP every 10 seconds\" (for testing)\n\n**Conditional Triggers:**\n• \"Buy $100 ETH when price drops 5%\"\n• \"Invest $50 BTC if under $95000\"\n\n**Simple:**\n• \"Buy $50 BTC daily\"\n• \"$100 ETH weekly\"\n\nI'll analyze market conditions and optimize your purchases automatically. What would you like to set up?",
        timestamp: new Date(),
      }]);
    }
  }, [isAuthenticated, messages.length]);

  const parseCommand = (text: string): {
    asset?: string;
    amount?: number;
    frequency?: { type: string; value?: number };
    condition?: { type: string; value?: number };
  } | null => {
    const lower = text.toLowerCase();

    // Extract asset
    let asset: string | undefined;
    if (lower.includes('btc') || lower.includes('bitcoin')) asset = 'BTC';
    else if (lower.includes('eth') || lower.includes('ethereum')) asset = 'ETH';
    else if (lower.includes('icp') || lower.includes('internet computer')) asset = 'ICP';

    // Extract amount
    const amountMatch = lower.match(/\$?(\d+)/);
    const amount = amountMatch ? parseInt(amountMatch[1]) : undefined;

    // Extract flexible frequency
    let frequency: { type: string; value?: number } | undefined;

    // Check for custom intervals first
    const secondsMatch = lower.match(/every\s*(\d+)\s*(?:seconds?|secs?|s\b)/);
    const minutesMatch = lower.match(/every\s*(\d+)\s*(?:minutes?|mins?|m\b)/);
    const hoursMatch = lower.match(/every\s*(\d+)\s*(?:hours?|hrs?|h\b)/);

    if (secondsMatch) {
      frequency = { type: 'Seconds', value: parseInt(secondsMatch[1]) };
    } else if (minutesMatch) {
      frequency = { type: 'Minutes', value: parseInt(minutesMatch[1]) };
    } else if (hoursMatch) {
      frequency = { type: 'Hours', value: parseInt(hoursMatch[1]) };
    } else if (lower.includes('daily') || lower.includes('every day')) {
      frequency = { type: 'Daily' };
    } else if (lower.includes('weekly') || lower.includes('every week')) {
      frequency = { type: 'Weekly' };
    } else if (lower.includes('monthly') || lower.includes('every month')) {
      frequency = { type: 'Monthly' };
    }

    // Extract conditions
    let condition: { type: string; value?: number } | undefined;

    // "when price drops X%" or "on X% dip"
    const dropMatch = lower.match(/(?:when\s+(?:price\s+)?drops?\s*|on\s+)(\d+)%/);
    if (dropMatch) {
      condition = { type: 'PriceDropPercent', value: parseFloat(dropMatch[1]) };
    }

    // "if under $X" or "below $X" or "when below $X"
    const belowMatch = lower.match(/(?:if\s+|when\s+)?(?:under|below)\s+\$?(\d+)/);
    if (belowMatch) {
      condition = { type: 'PriceBelow', value: parseFloat(belowMatch[1]) };
    }

    // "if above $X"
    const aboveMatch = lower.match(/(?:if\s+|when\s+)?(?:above|over)\s+\$?(\d+)/);
    if (aboveMatch) {
      condition = { type: 'PriceAbove', value: parseFloat(aboveMatch[1]) };
    }

    if (asset || amount || frequency || condition) {
      return { asset, amount, frequency, condition };
    }
    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || !actor || isProcessing) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const parsed = parseCommand(input);

      if (parsed && parsed.asset && parsed.amount && parsed.frequency) {
        // Create strategy with flexible timing
        const asset: AssetType = parsed.asset === 'BTC' ? { BTC: null } : parsed.asset === 'ETH' ? { ETH: null } : { ICP: null };

        // Build frequency type
        let freq: FrequencyType;
        if (parsed.frequency.type === 'Seconds' && parsed.frequency.value) {
          freq = { Seconds: BigInt(parsed.frequency.value) };
        } else if (parsed.frequency.type === 'Minutes' && parsed.frequency.value) {
          freq = { Minutes: BigInt(parsed.frequency.value) };
        } else if (parsed.frequency.type === 'Hours' && parsed.frequency.value) {
          freq = { Hours: BigInt(parsed.frequency.value) };
        } else if (parsed.frequency.type === 'Daily') {
          freq = { Daily: null };
        } else if (parsed.frequency.type === 'Weekly') {
          freq = { Weekly: null };
        } else {
          freq = { Monthly: null };
        }

        // Build condition if present
        let condition: TriggerConditionType | null = null;
        if (parsed.condition) {
          if (parsed.condition.type === 'PriceBelow' && parsed.condition.value) {
            condition = { PriceBelow: parsed.condition.value };
          } else if (parsed.condition.type === 'PriceAbove' && parsed.condition.value) {
            condition = { PriceAbove: parsed.condition.value };
          } else if (parsed.condition.type === 'PriceDropPercent' && parsed.condition.value) {
            condition = { PriceDropPercent: parsed.condition.value };
          }
        }

        const result = await actor.createStrategy(asset, BigInt(parsed.amount * 100), freq, condition ? [condition] : []);

        if ('ok' in result) {
          queryClient.invalidateQueries({ queryKey: ['strategies'] });

          // Build response message
          let freqText = parsed.frequency.type === 'Seconds' ? `every ${parsed.frequency.value} seconds` :
            parsed.frequency.type === 'Minutes' ? `every ${parsed.frequency.value} minutes` :
              parsed.frequency.type === 'Hours' ? `every ${parsed.frequency.value} hours` :
                parsed.frequency.type.toLowerCase();

          let condText = '';
          if (parsed.condition) {
            if (parsed.condition.type === 'PriceBelow') condText = `, only if price is under $${parsed.condition.value}`;
            else if (parsed.condition.type === 'PriceDropPercent') condText = `, when price drops ${parsed.condition.value}%`;
          }

          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `Done! I've set up a ${freqText} purchase of $${parsed.amount} in ${parsed.asset}${condText}.\n\n🧠 My AI will analyze market trends before each purchase and adjust the amount ±25% to get you better prices.\n\nSay **"execute"** or **"buy now"** to run a purchase now!`,
            timestamp: new Date(),
            action: { type: 'strategy_created', data: result.ok }
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (input.toLowerCase().includes('execute') || input.toLowerCase().includes('buy now') || input.toLowerCase().includes('run')) {
        // Execute latest strategy
        if (strategies.length > 0) {
          const latestStrategy = strategies[strategies.length - 1];
          await actor.triggerExecution(latestStrategy.id);
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['strategies'] });

          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `Executed! 🚀\n\nI analyzed the current market and made your purchase. Check the activity below for details.\n\nThe AI adjusted the amount based on whether the price was above or below the moving average.`,
            timestamp: new Date(),
            action: { type: 'purchase_executed' }
          };
          setMessages(prev => [...prev, agentMessage]);
        } else {
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: "You don't have any strategies yet. Tell me what to buy first, like \"Buy $50 of BTC weekly\".",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (input.toLowerCase().includes('price')) {
        // Show prices
        const priceText = prices.map(([asset, price]) => `${getAssetSymbol(asset)}: $${price.toLocaleString()}`).join('\n');
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: `Current prices:\n\n${priceText}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
      } else if (input.toLowerCase().includes('portfolio') || input.toLowerCase().includes('status') || input.toLowerCase().includes('holdings')) {
        const profitLoss = await actor.getProfitLoss();
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: `**Portfolio Summary**\n\n💰 Total Invested: $${profitLoss.totalCost.toFixed(2)}\n📈 Current Value: $${profitLoss.totalValue.toFixed(2)}\n${profitLoss.profitLoss >= 0 ? '✅' : '❌'} P&L: ${profitLoss.profitLoss >= 0 ? '+' : ''}$${profitLoss.profitLoss.toFixed(2)} (${profitLoss.profitLossPercent.toFixed(1)}%)\n\n${strategies.length} active strategies • ${purchases.length} purchases`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
      } else if (input.toLowerCase().includes('strategies') || input.toLowerCase().includes('my strategy')) {
        // Show strategies
        if (strategies.length === 0) {
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: "You don't have any strategies yet.\n\nTo create one, tell me what you want to buy. For example:\n• \"Buy $50 of BTC daily\"\n• \"Invest $100 in ETH weekly\"",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        } else {
          const strategyList = strategies.map((s, i) =>
            `${i + 1}. ${getAssetSymbol(s.targetAsset)} - $${Number(s.amount) / 100} • ${s.active ? 'Active' : 'Paused'}`
          ).join('\n');
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `**Your Strategies**\n\n${strategyList}\n\nSay "run strategy 1" to execute a specific strategy.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (input.toLowerCase().includes('help')) {
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: "**How to use TradeWeaver**\n\n**Create a strategy:**\n• \"Buy $50 of BTC daily\"\n• \"Invest $100 in ETH every 2 hours\"\n• \"Buy $25 ICP weekly if under $10\"\n\n**Run a strategy:**\n• \"Run strategy 1\" or \"Execute\"\n\n**Check status:**\n• \"Show my strategies\"\n• \"Show my portfolio\"\n• \"Show prices\"",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
      } else if (parsed && !parsed.amount) {
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: `I see you want to buy ${parsed.asset || 'crypto'}. How much? Try: "Buy $100 of ${parsed.asset || 'BTC'} ${parsed.frequency?.type?.toLowerCase() || 'weekly'}"`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
      } else {
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: "I didn't understand that. Try:\n\n• \"Buy $50 of BTC daily\"\n• \"Show my strategies\"\n• \"Help\"",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
      }
    } catch (e) {
      console.error(e);
      const agentMessage: Message = {
        id: Date.now() + 1,
        role: 'agent',
        content: "Something went wrong. Try again?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Landing page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-grid-pattern"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-slate-950"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl"></div>

        <div className="relative container mx-auto px-4 py-16 max-w-5xl">
          {/* Hero */}
          <div className="text-center mb-20 pt-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-emerald-400 text-sm font-medium">AI-Powered DCA on ICP</span>
            </div>

            <h1 className="text-6xl sm:text-7xl font-extrabold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                TradeWeaver
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-4">
              Your AI Trading Agent
            </p>
            <p className="text-slate-400 max-w-2xl mx-auto mb-10">
              Just tell me what to buy. I'll handle the timing, analyze market conditions,
              and execute cross-chain purchases automatically using ICP's Chain Fusion.
            </p>

            <div className="flex gap-4 justify-center">
              <button
                onClick={login}
                className="group relative px-8 py-4 rounded-xl font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500"></div>
                <span className="relative flex items-center gap-2">
                  Get Started
                  <Zap size={18} />
                </span>
              </button>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <div className="group rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 border border-emerald-500/20 p-8 text-center hover:border-emerald-500/40 transition-all">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 mb-6">
                <Brain className="text-emerald-400" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">AI-Optimized</h3>
              <p className="text-slate-400">
                I analyze price trends and adjust your purchases to buy more during dips, less during peaks.
              </p>
            </div>

            <div className="group rounded-2xl bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-900 border border-cyan-500/20 p-8 text-center hover:border-cyan-500/40 transition-all">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/20 mb-6">
                <Link2 className="text-cyan-400" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Cross-Chain</h3>
              <p className="text-slate-400">
                Buy BTC, ETH, and ICP using Chain Fusion threshold signatures. No bridges needed.
              </p>
            </div>

            <div className="group rounded-2xl bg-gradient-to-br from-purple-500/10 via-slate-900 to-slate-900 border border-purple-500/20 p-8 text-center hover:border-purple-500/40 transition-all">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/20 mb-6">
                <Shield className="text-purple-400" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Secure</h3>
              <p className="text-slate-400">
                Runs on ICP's autonomous smart contracts. Your keys, your crypto, always.
              </p>
            </div>
          </div>

          {/* Demo notice */}
          <div className="text-center text-slate-500 text-sm">
            Demo mode • No real funds • Built for hackathon
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
            <Zap className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-white">TradeWeaver</h1>
            <p className="text-xs text-slate-500">AI Trading Agent</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Mini price tickers */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            {prices.slice(0, 3).map(([asset, price]) => (
              <div key={getAssetSymbol(asset)} className="flex items-center gap-1 text-slate-400">
                <span className="font-medium text-white">{getAssetSymbol(asset)}</span>
                <span>${price.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button onClick={logout} className="text-sm text-slate-400 hover:text-white transition">
            Logout
          </button>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'agent' && (
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div className={`max-w-xl rounded-2xl px-4 py-3 ${msg.role === 'user'
              ? 'bg-emerald-500/20 text-white'
              : 'bg-slate-800/50 text-slate-200'
              }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs text-slate-500 mt-1">
                {format(msg.timestamp, 'HH:mm')}
              </p>
            </div>
            {msg.role === 'user' && (
              <div className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                <User size={16} className="text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-slate-800/50 rounded-2xl px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Recent activity */}
      {purchases.length > 0 && (
        <div className="border-t border-slate-800 px-6 py-3 bg-slate-900/50">
          <p className="text-xs text-slate-500 mb-2">Recent Activity</p>
          <div className="flex gap-3 overflow-x-auto">
            {purchases.slice().reverse().slice(0, 5).map((tx, i) => (
              <div key={i} className="shrink-0 bg-slate-800/50 rounded-lg px-3 py-2 text-xs">
                <span className="text-white font-medium">{getAssetSymbol(tx.asset)}</span>
                <span className="text-slate-400 ml-2">{formatCrypto(tx.amountAsset, 4)}</span>
                <span className="text-emerald-400 ml-2">{formatUSD(tx.amountUSD)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-800 p-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Tell me what to buy... e.g. 'Buy $50 of BTC weekly'"
            className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className="px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>

        {/* Quick actions */}
        <div className="max-w-3xl mx-auto flex gap-2 mt-3 flex-wrap justify-center">
          <button
            onClick={() => { setInput('show my strategies'); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition"
          >
            My Strategies
          </button>
          <button
            onClick={() => { setInput('show my portfolio'); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition"
          >
            Portfolio
          </button>
          <button
            onClick={() => { setInput('show prices'); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition"
          >
            Prices
          </button>
          <button
            onClick={() => { setInput('help'); }}
            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition"
          >
            Help
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-3">
          Demo mode • Simulated purchases
        </p>
      </div>
    </div>
  );
}
