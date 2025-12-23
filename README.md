# TradeWeaver

TradeWeaver is an **AI-powered autonomous trading agent** built on the Internet Computer (ICP). It leverages ICP's **Chain Fusion** technology to natively execute cross-chain transactions (BTC, ETH, ICP) without bridges, using an on-chain AI engine to optimize Dollar-Cost Averaging (DCA) strategies based on real-time market trends.

## Features

- **AI-optimized purchases** – Trend analysis adjusts buy amounts dynamically (buying more on dips)
- **Natural Language Interface** – Chat-based strategy creation (e.g., "/buy $50 BTC every week")
- **Cross-chain support** – Native BTC, ETH, and ICP via Chain Fusion threshold signatures
- **One-Time Trades** – Immediate execution for reactive trading with the `/trade` command
- **Real-time pricing** – CoinGecko API integration via HTTPS outcalls
- **Portfolio analytics** – Automatic cost-basis tracking and real-time P&L calculation

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
| Frontend | Next.js, Tailwind CSS |
| AI | On-chain trend analysis (SMA-based) |
| Cross-chain | Threshold Schnorr (BTC), ECDSA (ETH) |
| Auth | Internet Identity |

## Getting Started

### 1. Prerequisites
Ensure you have the [IC SDK (dfx)](https://internetcomputer.org/docs/current/developer-docs/setup/install) installed.

### 2. Deploy the Backend
Start your local replica and deploy the canisters:
```bash
# Start local ICP replica
dfx start --background --clean

# Deploy internet identity and backend
dfx deploy
```

### 3. Run the Frontend
Navigate to the frontend directory and start the development server:
```bash
cd src/tradeweaver_frontend
npm install && npm run dev
```

### 4. Basic Commands
Open `http://localhost:3000` and interact with the agent:
- `/buy $10 ICP daily` - Create a DCA strategy
- `/trade sell $20 BTC` - Execute an immediate one-time trade
- `/portfolio` - View your holdings and P&L
- `/strategies` - List active automated strategies
- `/help` - See all available features

## License

MIT
