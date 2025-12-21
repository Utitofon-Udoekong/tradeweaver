# TradeWeaver

Autonomous DCA (Dollar-Cost Averaging) agent built on ICP with Chain Fusion for cross-chain crypto purchases.

## Features

- **Recurring purchases** – Daily, weekly, biweekly, or monthly schedules
- **Multi-chain support** – BTC, ETH, ICP via Chain Fusion threshold signatures
- **Real-time pricing** – CoinGecko API via HTTPS outcalls
- **Portfolio analytics** – Cost basis tracking and P&L calculation
- **Web dashboard** – Next.js frontend with Internet Identity auth

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Motoko on ICP |
| Frontend | Next.js 16, Tailwind CSS |
| Cross-chain | Threshold Schnorr (BTC), ECDSA (ETH) |
| Auth | Internet Identity |

## Development

**Prerequisites:** [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install/) CLI, Node.js 18+

**Start local replica:**
```
dfx start --clean --background
dfx deploy tradeweaver_backend
```

**Run frontend:**
```
cd src/tradeweaver_frontend
npm install
npm run dev
```

## Project Structure

```
├── src/tradeweaver_backend/   # Motoko canister
├── src/tradeweaver_frontend/  # Next.js dashboard
├── docs/                      # Documentation
└── dfx.json                   # ICP config
```

## License

MIT
