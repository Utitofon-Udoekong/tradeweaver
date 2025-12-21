# TradeWeaver

AI-powered autonomous DCA (Dollar-Cost Averaging) agent on ICP with Chain Fusion for cross-chain crypto purchases.

## Features

- **AI-optimized purchases** – Trend analysis adjusts buy amounts dynamically
- **Recurring schedules** – Daily, weekly, biweekly, or monthly DCA
- **Cross-chain support** – BTC, ETH, ICP via Chain Fusion threshold signatures
- **Real-time pricing** – CoinGecko API via HTTPS outcalls
- **Portfolio analytics** – Cost basis tracking and P&L calculation

## AI Decision Engine

The bot uses on-chain AI logic to optimize purchase timing and amounts:

| AI Action | Trigger | Adjustment |
|-----------|---------|------------|
| BuyMore | Price 5%+ below SMA | +25% amount |
| BuyNow | Normal conditions | Standard amount |
| BuyLess | Price 8%+ above SMA | -25% amount |
| Wait | Price 15%+ above SMA | Skip purchase |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Motoko on ICP |
| Frontend | Next.js 16, Tailwind CSS |
| AI | On-chain trend analysis, SMA |
| Cross-chain | Threshold Schnorr (BTC), ECDSA (ETH) |
| Auth | Internet Identity |

## Development

```bash
# Start local replica
dfx start --clean --background
dfx deps deploy internet_identity
dfx deploy tradeweaver_backend

# Run frontend
cd src/tradeweaver_frontend
npm install && npm run dev
```

## API

```bash
# Get AI recommendation
dfx canister call tradeweaver_backend getAIRecommendation '(variant { BTC }, 10000)'

# Create DCA strategy
dfx canister call tradeweaver_backend createStrategy '(variant { BTC }, 10000, variant { Weekly })'

# Execute with AI optimization
dfx canister call tradeweaver_backend triggerExecution '(0)'
```

## License

MIT
