"use client";

import { useICP } from "@/lib/icp-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Zap, Send, Bot, User, TrendingUp, Wallet, Bitcoin, Brain, Shield, Link2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { getAssetSymbol, formatUSD, formatCrypto, getFrequencyLabel, getStrategyTypeLabel, type AssetType, type FrequencyType, type TriggerConditionType, type StrategyTypeType } from "@/lib/types";
import ReactMarkdown from "react-markdown";

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
  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Available slash commands
  const commands = [
    { cmd: '/buy', desc: 'Create DCA buy strategy (BTC/ETH/ICP)', example: '/buy $50 BTC daily' },
    { cmd: '/sell', desc: 'Create DCA sell strategy (BTC/ETH/ICP)', example: '/sell $50 BTC daily' },
    { cmd: '/trade', desc: 'Immediate one-time trade', example: '/trade buy $100 BTC' },
    { cmd: '/run', desc: 'Execute a strategy now', example: '/run 1' },
    { cmd: '/pause', desc: 'Pause automatic execution', example: '/pause 1' },
    { cmd: '/resume', desc: 'Resume paused strategy', example: '/resume 1' },
    { cmd: '/delete', desc: 'Remove a strategy', example: '/delete 1' },
    { cmd: '/strategies', desc: 'List all strategies', example: '/strategies' },
    { cmd: '/portfolio', desc: 'View holdings & P/L', example: '/portfolio' },
    { cmd: '/prices', desc: 'Live BTC/ETH/ICP prices', example: '/prices' },
    { cmd: '/help', desc: 'Full command reference', example: '/help' },
  ];

  // Filter commands based on input
  const filteredCommands = input.startsWith('/')
    ? commands.filter(c => c.cmd.toLowerCase().startsWith(input.toLowerCase().split(' ')[0]))
    : [];

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

  // Auto-execution heartbeat - checks every 10 seconds for due strategies
  // For demo stability: decreased frequency to prevent double-execution race conditions
  const [autoExecuteEnabled, setAutoExecuteEnabled] = useState(true);
  const [lastExecutionLog, setLastExecutionLog] = useState<string | null>(null);
  const lastManualRun = useRef<number>(0);
  const isExecutingRef = useRef(false);

  useEffect(() => {
    if (!actor || !isAuthenticated || !autoExecuteEnabled) return;

    const checkAndExecute = async () => {
      // prevent concurrent executions
      if (isExecutingRef.current) return;

      // Skip if we manually ran a command recently (prevention for race conditions)
      if (Date.now() - lastManualRun.current < 10000) return;

      try {
        isExecutingRef.current = true;
        const result = await actor.checkAndExecuteStrategies();
        const count = Number(result);
        if (count > 0) {
          // Strategies were executed, refresh data
          queryClient.invalidateQueries({ queryKey: ['strategies'] });
          queryClient.invalidateQueries({ queryKey: ['purchases'] });

          const logMsg = `⚡ Auto-executed ${count} strateg${count === 1 ? 'y' : 'ies'}`;
          setLastExecutionLog(logMsg);

          // Add system message about auto-execution
          const autoMessage: Message = {
            id: Date.now(),
            role: 'agent',
            content: `${logMsg}\n\nType \`/portfolio\` to see your updated holdings.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, autoMessage]);

          // Clear the log after 5 seconds
          setTimeout(() => setLastExecutionLog(null), 5000);
        }
      } catch (error) {
        // Silent fail for heartbeat - don't spam errors
        console.log('Heartbeat check:', error);
      } finally {
        isExecutingRef.current = false;
      }
    };

    // Run every 10 seconds
    const interval = setInterval(async () => {
      // Local check: Ensure we haven't run recently (global lock via localStorage)
      const lastHeartbeat = parseInt(localStorage.getItem('tradeWeaver_lastHeartbeat') || '0');
      const now = Date.now();

      // If run within last 10 seconds (globally), skip
      if (now - lastHeartbeat < 10000) {
        return;
      }

      // Attempt to acquire lock by setting timestamp
      localStorage.setItem('tradeWeaver_lastHeartbeat', now.toString());

      await checkAndExecute();
    }, 10000);

    return () => clearInterval(interval);
  }, [actor, isAuthenticated, autoExecuteEnabled, queryClient]);

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
        content: `**Welcome to TradeWeaver** 🤖

I'm your AI-powered **DCA (Dollar-Cost Averaging) bot**. I help you automate recurring crypto purchases.

**Quick Start:**
\`/buy $50 BTC daily\` - Buy $50 of Bitcoin every day
\`/buy $100 ETH weekly\` - Buy $100 of Ethereum weekly
\`/buy $25 ICP every 30 seconds\` - High-frequency test

**Supported Assets:** BTC, ETH, ICP
**Features:** Custom intervals, price conditions, AI optimization

Type \`/help\` for full documentation or just describe what you want!`,
        timestamp: new Date(),
      }]);
    }
  }, [isAuthenticated, messages.length]);

  const parseCommand = (text: string): {
    asset?: string;
    amount?: number;
    frequency?: { type: string; value?: number };
    condition?: { type: string; value?: number };
    isSell?: boolean;
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

    // Detect if this is a sell command
    const isSell = lower.includes('sell') || lower.includes('selling');

    if (asset || amount || frequency || condition) {
      return { asset, amount, frequency, condition, isSell };
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
    const rawInput = input;
    setInput('');
    setIsProcessing(true);

    // Handle /trade command specially (one-time immediate trade)
    if (rawInput.startsWith('/trade ')) {
      const tradeText = rawInput.replace('/trade ', '').toLowerCase();
      const isSell = tradeText.includes('sell');
      const isBuy = tradeText.includes('buy');

      // Extract asset
      let asset: 'BTC' | 'ETH' | 'ICP' | null = null;
      if (tradeText.includes('btc') || tradeText.includes('bitcoin')) asset = 'BTC';
      else if (tradeText.includes('eth') || tradeText.includes('ethereum')) asset = 'ETH';
      else if (tradeText.includes('icp')) asset = 'ICP';

      // Extract amount
      const amountMatch = tradeText.match(/\$?(\d+)/);
      const amount = amountMatch ? parseInt(amountMatch[1]) : null;

      if (!asset || !amount || (!isBuy && !isSell)) {
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: `Invalid trade format. Use: \`/trade buy $100 BTC\` or \`/trade sell $50 ETH\``,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
        setIsProcessing(false);
        return;
      }

      try {
        const tradeType = isSell ? { Sell: null } : { Buy: null };
        const assetType = asset === 'BTC' ? { BTC: null } : asset === 'ETH' ? { ETH: null } : { ICP: null };
        const result = await actor.executeTrade(tradeType, assetType, BigInt(amount * 100));

        if ('ok' in result) {
          lastManualRun.current = Date.now();
          queryClient.invalidateQueries({ queryKey: ['purchases'] });

          const actionVerb = isSell ? 'Sold' : 'Bought';
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `✅ **Trade Executed!**\n\n${actionVerb} $${amount} of ${asset} at $${result.ok.price.toLocaleString()}\n\nAmount: ${result.ok.amountAsset.toFixed(8)} ${asset}`,
            timestamp: new Date(),
            action: { type: 'purchase_executed' }
          };
          setMessages(prev => [...prev, agentMessage]);
        } else {
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `❌ Trade failed: ${result.err}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } catch (e) {
        console.error(e);
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: `Something went wrong executing the trade. Try again?`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
      }
      setIsProcessing(false);
      return;
    }

    // Preprocess slash commands
    let processedInput = rawInput;
    if (rawInput.startsWith('/buy ')) {
      processedInput = rawInput.replace('/buy ', 'Buy ');
    } else if (rawInput.startsWith('/sell ')) {
      processedInput = rawInput.replace('/sell ', 'Sell ');
    } else if (rawInput.startsWith('/run ')) {
      processedInput = 'run ' + rawInput.replace('/run ', '');
    } else if (rawInput.startsWith('/pause ')) {
      processedInput = 'pause ' + rawInput.replace('/pause ', '');
    } else if (rawInput.startsWith('/resume ')) {
      processedInput = 'resume ' + rawInput.replace('/resume ', '');
    } else if (rawInput.startsWith('/delete ')) {
      processedInput = 'delete ' + rawInput.replace('/delete ', '');
    } else if (rawInput === '/strategies' || rawInput.startsWith('/strategies ')) {
      processedInput = 'show my strategies';
    } else if (rawInput === '/portfolio' || rawInput.startsWith('/portfolio ')) {
      processedInput = 'show my portfolio';
    } else if (rawInput === '/prices' || rawInput.startsWith('/prices ')) {
      processedInput = 'show prices';
    } else if (rawInput === '/help' || rawInput.startsWith('/help ')) {
      processedInput = 'help';
    }

    try {
      const parsed = parseCommand(processedInput);

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

        // Build strategy type
        const strategyType: StrategyTypeType = parsed.isSell ? { Sell: null } : { Buy: null };
        const actionWord = parsed.isSell ? 'sell' : 'purchase';
        const actionVerb = parsed.isSell ? 'Sell' : 'Buy';

        const result = await actor.createStrategy(strategyType, asset, BigInt(parsed.amount * 100), freq, condition ? [condition] : []);

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
            else if (parsed.condition.type === 'PriceAbove') condText = `, only if price is above $${parsed.condition.value}`;
            else if (parsed.condition.type === 'PriceDropPercent') condText = `, when price drops ${parsed.condition.value}%`;
          }

          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `✅ **${actionVerb} Strategy Created!**\n\nI've set up a ${freqText} ${actionWord} of $${parsed.amount} in ${parsed.asset}${condText}.\n\n🧠 My AI will analyze market trends before each ${actionWord} and adjust the amount ±25% to optimize execution.\n\nUse \`/run 1\` to execute now!`,
            timestamp: new Date(),
            action: { type: 'strategy_created', data: result.ok }
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (processedInput.toLowerCase().match(/run\s*(strategy)?\s*(\d+)/i) || processedInput.toLowerCase().match(/execute\s*(strategy)?\s*(\d+)/i)) {
        // Run specific strategy by number
        const match = processedInput.match(/(\d+)/);
        const strategyNum = match ? parseInt(match[1]) : 0;

        if (strategyNum > 0 && strategyNum <= strategies.length) {
          const strategy = strategies[strategyNum - 1];
          await actor.triggerExecution(strategy.id);
          lastManualRun.current = Date.now();
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['strategies'] });

          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `✅ Ran strategy #${strategyNum}\n\n**${getAssetSymbol(strategy.targetAsset)}** - $${Number(strategy.amount) / 100} purchase executed.\n\nThe AI analyzed market conditions and adjusted the amount based on the moving average.`,
            timestamp: new Date(),
            action: { type: 'purchase_executed' }
          };
          setMessages(prev => [...prev, agentMessage]);
        } else {
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `Strategy #${strategyNum} not found. You have ${strategies.length} strategies. Say "show my strategies" to see them.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (processedInput.toLowerCase().match(/pause\s*(strategy)?\s*(\d+)/i)) {
        // Pause specific strategy
        const match = processedInput.match(/(\d+)/);
        const strategyNum = match ? parseInt(match[1]) : 0;

        if (strategyNum > 0 && strategyNum <= strategies.length) {
          const strategy = strategies[strategyNum - 1];
          await actor.pauseStrategy(strategy.id);
          queryClient.invalidateQueries({ queryKey: ['strategies'] });

          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `⏸️ Paused strategy #${strategyNum}\n\n**${getAssetSymbol(strategy.targetAsset)}** - $${Number(strategy.amount) / 100}\n\nSay "resume ${strategyNum}" to reactivate it.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        } else {
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `Strategy #${strategyNum} not found. Say "show my strategies" to see your strategies.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (processedInput.toLowerCase().match(/resume\s*(strategy)?\s*(\d+)/i)) {
        // Resume specific strategy
        const match = processedInput.match(/(\d+)/);
        const strategyNum = match ? parseInt(match[1]) : 0;

        if (strategyNum > 0 && strategyNum <= strategies.length) {
          const strategy = strategies[strategyNum - 1];
          await actor.resumeStrategy(strategy.id);
          queryClient.invalidateQueries({ queryKey: ['strategies'] });

          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `▶️ Resumed strategy #${strategyNum}\n\n**${getAssetSymbol(strategy.targetAsset)}** - $${Number(strategy.amount) / 100} is now active again.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        } else {
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `Strategy #${strategyNum} not found. Say "show my strategies" to see your strategies.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (processedInput.toLowerCase().match(/delete\s*(\d+)/i)) {
        // Delete specific strategy
        const match = processedInput.match(/(\d+)/);
        const strategyNum = match ? parseInt(match[1]) : 0;

        if (strategyNum > 0 && strategyNum <= strategies.length) {
          const strategy = strategies[strategyNum - 1];
          await actor.deleteStrategy(strategy.id);
          queryClient.invalidateQueries({ queryKey: ['strategies'] });
          queryClient.invalidateQueries({ queryKey: ['purchases'] });

          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `🗑️ Deleted strategy #${strategyNum}\n\n**${getAssetSymbol(strategy.targetAsset)}** - $${Number(strategy.amount) / 100} has been removed.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        } else {
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `Strategy #${strategyNum} not found. Say "/strategies" to see your strategies.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (processedInput.toLowerCase().includes('execute') || processedInput.toLowerCase().includes('run') || processedInput.toLowerCase().includes('buy now')) {
        // Execute without number - prompt for which one
        if (strategies.length === 0) {
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: "You don't have any strategies yet.\n\nCreate one first: \"Buy $50 of BTC daily\"",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        } else if (strategies.length === 1) {
          // Only one strategy, run it
          const strategy = strategies[0];
          await actor.triggerExecution(strategy.id);
          lastManualRun.current = Date.now();
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['strategies'] });

          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `✅ Ran your strategy\n\n**${getAssetSymbol(strategy.targetAsset)}** - $${Number(strategy.amount) / 100} purchase executed.`,
            timestamp: new Date(),
            action: { type: 'purchase_executed' }
          };
          setMessages(prev => [...prev, agentMessage]);
        } else {
          // Multiple strategies, ask which one
          const strategyList = strategies.map((s, i) =>
            `**${i + 1}.** ${getAssetSymbol(s.targetAsset)} $${Number(s.amount) / 100} ${getFrequencyLabel(s.frequency)} ${s.active ? '' : '(paused)'}`
          ).join('\n');
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `You have ${strategies.length} strategies. Which one?\n\n${strategyList}\n\nType \`/run 1\` or \`/run 2\` to execute.`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (processedInput.toLowerCase().includes('price')) {
        // Show prices
        const priceText = prices.map(([asset, price]) => `${getAssetSymbol(asset)}: $${price.toLocaleString()}`).join('\n');
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: `Current prices:\n\n${priceText}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
      } else if (processedInput.toLowerCase().includes('portfolio') || processedInput.toLowerCase().includes('status') || processedInput.toLowerCase().includes('holdings')) {
        const profitLoss = await actor.getProfitLoss();
        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: `**Portfolio Summary**\n\n💰 Total Invested: $${profitLoss.totalCost.toFixed(2)}\n📈 Current Value: $${profitLoss.totalValue.toFixed(2)}\n${profitLoss.profitLoss >= 0 ? '✅' : '❌'} P&L: ${profitLoss.profitLoss >= 0 ? '+' : ''}$${profitLoss.profitLoss.toFixed(2)} (${profitLoss.profitLossPercent.toFixed(1)}%)\n\n${strategies.length} active strategies • ${purchases.length} purchases`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, agentMessage]);
      } else if (processedInput.toLowerCase().includes('strategies') || processedInput.toLowerCase().includes('my strategy')) {
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
            `**${i + 1}. ${getAssetSymbol(s.targetAsset)}** - $${Number(s.amount) / 100} ${getFrequencyLabel(s.frequency)} ${s.active ? '✅ Active' : '⏸️ Paused'}`
          ).join('\n');
          const agentMessage: Message = {
            id: Date.now() + 1,
            role: 'agent',
            content: `**Your DCA Strategies**\n\n${strategyList}\n\n---\n**Commands:**\n• \`/run 1\` - Execute now\n• \`/pause 1\` - Stop auto-execution\n• \`/resume 1\` - Resume\n• \`/delete 1\` - Remove`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      } else if (processedInput.toLowerCase().includes('help')) {
        const helpText = `**TradeWeaver - DCA Trading Bot**

**What is this?**
TradeWeaver automates Dollar-Cost Averaging (DCA) for both **buying AND selling** crypto assets at specified intervals. You can also execute one-time trades.

---

**ONE-TIME TRADES**

\`/trade buy $100 BTC\` - Buy $100 of Bitcoin now
\`/trade sell $50 ETH\` - Sell $50 of Ethereum now

---

**CREATING DCA STRATEGIES**

**Buy Strategy:** \`/buy <amount> <asset> <frequency> [condition]\`
**Sell Strategy:** \`/sell <amount> <asset> <frequency> [condition]\`

**Assets:** BTC, ETH, ICP
**Amounts:** $10, $50, $100, etc.
**Frequencies:**
• \`daily\` - Once per day
• \`weekly\` - Once per week  
• \`hourly\` - Once per hour
• \`every 30 seconds\` - Custom interval
• \`every 5 minutes\` - Custom interval

**Conditions (optional):**
• \`if under $10\` - Only execute if price below $10
• \`if above $100\` - Only execute if price above $100

**Examples:**
• \`/buy $50 BTC daily\` - Buy $50 BTC every day
• \`/sell $100 ETH weekly\` - Sell $100 ETH every week
• \`/buy $25 ICP every 10 seconds\` - High-frequency buy
• \`/sell $50 BTC if above $100000\` - Take profits above $100k

---

**MANAGING STRATEGIES**

• \`/run 1\` - Execute strategy #1 now
• \`/pause 1\` - Stop auto-execution
• \`/resume 1\` - Resume auto-execution
• \`/delete 1\` - Remove strategy

---

**VIEWING DATA**

• \`/strategies\` - List all strategies
• \`/portfolio\` - Holdings & profit/loss
• \`/prices\` - Live prices

---

**Notes:**
• AI adjusts amounts ±25% based on market trends
• Execute strategies manually with \`/run 1\``;

        const agentMessage: Message = {
          id: Date.now() + 1,
          role: 'agent',
          content: helpText,
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
          <div className="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center ring-2 ring-emerald-500/20">
            <img src="/logo.jpg" alt="Logo" className="h-full w-full object-cover" />
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
          {/* Heartbeat toggle */}
          <button
            onClick={() => setAutoExecuteEnabled(!autoExecuteEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${autoExecuteEnabled
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
              }`}
            title={autoExecuteEnabled ? 'Auto-execution ON' : 'Auto-execution OFF'}
          >
            <span className={`h-2 w-2 rounded-full ${autoExecuteEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            Auto
          </button>
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
              <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ring-1 ring-emerald-500/20">
                <img src="/logo.jpg" alt="Agent" className="h-full w-full object-cover" />
              </div>
            )}
            <div className={`max-w-xl rounded-2xl px-4 py-3 ${msg.role === 'user'
              ? 'bg-emerald-500/20 text-white'
              : 'bg-slate-800/50 text-slate-200'
              }`}>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    li: ({ children }) => <li className="text-slate-300">{children}</li>,
                    code: ({ children }) => <code className="bg-slate-700 px-1 rounded text-emerald-400 font-mono text-sm">{children}</code>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
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
            {purchases.slice().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 5).map((tx, i) => (
              <div key={i} className={`shrink-0 rounded-lg px-3 py-2 text-xs ${tx.isSell ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                <span className={`font-medium ${tx.isSell ? 'text-red-400' : 'text-emerald-400'}`}>{tx.isSell ? '↓ Sell' : '↑ Buy'}</span>
                <span className="text-white font-medium ml-2">{getAssetSymbol(tx.asset)}</span>
                <span className="text-slate-400 ml-2">{formatCrypto(tx.amountAsset, 4)}</span>
                <span className={`ml-2 ${tx.isSell ? 'text-red-400' : 'text-emerald-400'}`}>{formatUSD(tx.amountUSD)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-800 p-4">
        <div className="max-w-3xl mx-auto relative">
          {/* Command dropdown */}
          {input.startsWith('/') && filteredCommands.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.cmd}
                  onClick={() => {
                    setInput(cmd.cmd + ' ');
                    inputRef.current?.focus();
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-700/50 transition ${i === selectedCommand ? 'bg-slate-700/50' : ''
                    }`}
                >
                  <div>
                    <span className="text-emerald-400 font-mono">{cmd.cmd}</span>
                    <span className="text-slate-400 ml-3">{cmd.desc}</span>
                  </div>
                  <span className="text-slate-500 text-xs">{cmd.example}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowCommands(e.target.value.startsWith('/'));
                setSelectedCommand(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (input.startsWith('/') && filteredCommands.length > 0 && input.split(' ').length === 1) {
                    // Complete the command
                    setInput(filteredCommands[selectedCommand].cmd + ' ');
                  } else {
                    handleSend();
                  }
                } else if (e.key === 'ArrowDown' && filteredCommands.length > 0) {
                  e.preventDefault();
                  setSelectedCommand((prev) => Math.min(prev + 1, filteredCommands.length - 1));
                } else if (e.key === 'ArrowUp' && filteredCommands.length > 0) {
                  e.preventDefault();
                  setSelectedCommand((prev) => Math.max(prev - 1, 0));
                } else if (e.key === 'Tab' && filteredCommands.length > 0) {
                  e.preventDefault();
                  setInput(filteredCommands[selectedCommand].cmd + ' ');
                } else if (e.key === 'Escape') {
                  setInput('');
                }
              }}
              placeholder="Type / for commands or describe what you want"
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
        </div>

        <p className="text-center text-xs text-slate-600 mt-3">
          Type <span className="text-slate-400">/</span> for commands • Demo mode
        </p>
      </div>
    </div>
  );
}
