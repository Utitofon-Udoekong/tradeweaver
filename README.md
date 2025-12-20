# TradeWeaver DCA Bot

> Autonomous Dollar-Cost Averaging on ICP with Cross-Chain Support

## Features

- 🔄 **Automated Recurring Purchases** - Daily, weekly, biweekly, or monthly
- ⛓️ **Multi-Chain Support** - BTC, ETH, ICP via Chain Fusion
- 📊 **Real-Time Analytics** - Portfolio tracking and P&L reporting
- 💰 **Cost Basis Tracking** - Average price calculations
- 🎯 **Set-and-Forget** - Fully autonomous execution

## Quick Start

### Prerequisites
- [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install/) CLI installed
- Node.js 18+ for frontend

### Local Development

```bash
# Start local replica
dfx start --clean --background

# Deploy canisters
dfx deploy

# Test backend
dfx canister call tradeweaver_backend createAccount
dfx canister call tradeweaver_backend createStrategy '(variant { BTC }, 10000, variant { Weekly })'
dfx canister call tradeweaver_backend triggerExecution '(0)'
dfx canister call tradeweaver_backend getProfitLoss
```

## Architecture

- **Backend:** Motoko canisters on ICP
- **Frontend:** Next.js 16 + TailwindCSS
- **Cross-chain:** ICP Chain Fusion (threshold signatures)
- **Price Oracle:** HTTPS Outcalls to Coinbase API
- **Scheduling:** ICP timers for autonomous execution

## Project Structure

```
tradeweaver/
├── src/
│   ├── tradeweaver_backend/    # Motoko canister
│   │   └── main.mo
│   └── tradeweaver_frontend/   # Next.js dashboard
├── docs/
│   ├── architecture.md
│   ├── api-reference.md
│   └── user-guide.md
├── test/
├── dfx.json
└── README.md
```

## Bounty Submission

This project is for **ICP Bounty #1148**: AI Agents for Trading & Web3 Automation

## License

MIT License
