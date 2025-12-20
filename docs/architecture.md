# TradeWeaver DCA Bot Architecture

## System Overview

TradeWeaver is an autonomous DCA (Dollar-Cost Averaging) bot running on the Internet Computer Protocol (ICP) with cross-chain capabilities via Chain Fusion.

## Components

### Backend Canister (`tradeweaver_backend`)
- **Language:** Motoko
- **Responsibilities:**
  - User account management
  - DCA strategy configuration
  - Timer-based scheduling
  - Price fetching via HTTPS outcalls
  - Cross-chain purchases via Chain Fusion
  - Portfolio tracking and analytics

### Frontend Canister (`tradeweaver_frontend`)
- **Framework:** Next.js 16 (App Router)
- **Features:**
  - Internet Identity authentication
  - Dashboard with portfolio stats
  - Strategy creation/management
  - Purchase history view
  - P&L analytics

## Data Flow

```
User → Dashboard → Internet Identity → Backend Canister
                                            ↓
                                      Timer System
                                            ↓
                                   HTTPS Outcalls (Price)
                                            ↓
                                   Chain Fusion (Execution)
                                            ↓
                                   BTC / ETH / ICP Networks
```

## Key Types

- `UserAccount` - User principal, balance, creation time
- `DCAStrategy` - Target asset, amount, frequency, schedule
- `Purchase` - Execution record with price, amount, tx hash
- `Holding` - Portfolio position with cost basis
- `ProfitLoss` - Analytics with total value, cost, P&L percentage
