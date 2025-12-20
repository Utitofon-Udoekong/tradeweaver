import Time "mo:base/Time";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Text "mo:base/Text";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Buffer "mo:base/Buffer";
import Hash "mo:base/Hash";
import Blob "mo:base/Blob";
import Cycles "mo:base/ExperimentalCycles";

persistent actor TradeWeaver {
  
  // ============================================
  // TYPES
  // ============================================
  
  // User account structure
  public type UserAccount = {
    principal: Principal;
    balance: Nat; // ICP balance in e8s
    createdAt: Time.Time;
  };
  
  // Asset types supported
  public type Asset = {
    #ICP;
    #BTC;
    #ETH;
  };
  
  // Frequency options for DCA
  public type Frequency = {
    #Daily;
    #Weekly;   // Every Monday
    #Biweekly; // Every 2 weeks
    #Monthly;  // 1st of month
  };
  
  // DCA strategy configuration
  public type DCAStrategy = {
    id: Nat;
    owner: Principal;
    targetAsset: Asset;
    amount: Nat; // Amount in USD cents (e.g., 10000 = $100)
    frequency: Frequency;
    nextExecution: Time.Time;
    active: Bool;
    createdAt: Time.Time;
  };
  
  // Purchase record
  public type Purchase = {
    id: Nat;
    strategyId: Nat;
    asset: Asset;
    amountUSD: Nat;
    amountAsset: Float;
    price: Float;
    timestamp: Time.Time;
    txHash: Text;
  };
  
  // Portfolio holding
  public type Holding = {
    asset: Asset;
    amount: Float;
    costBasis: Float;
    averagePrice: Float;
  };
  
  // Price response from oracle
  public type PriceResponse = {
    asset: Asset;
    priceUSD: Float;
    timestamp: Time.Time;
  };
  
  // Profit/Loss analytics
  public type ProfitLoss = {
    totalValue: Float;
    totalCost: Float;
    profitLoss: Float;
    profitLossPercent: Float;
  };
  
  // ============================================
  // STATE VARIABLES
  // ============================================
  
  // Stable storage for upgrade persistence
  stable var usersEntries : [(Principal, UserAccount)] = [];
  stable var strategiesEntries : [(Nat, DCAStrategy)] = [];
  stable var purchasesEntries : [(Nat, [Purchase])] = [];
  stable var nextStrategyId : Nat = 0;
  stable var nextPurchaseId : Nat = 0;
  
  // Hash function for Nat keys
  private func natHash(n: Nat) : Nat32 {
    Nat32.fromNat(n % 4294967296)
  };
  
  // Runtime HashMaps (transient - not persisted across upgrades)
  transient var users = HashMap.HashMap<Principal, UserAccount>(10, Principal.equal, Principal.hash);
  transient var strategies = HashMap.HashMap<Nat, DCAStrategy>(10, Nat.equal, natHash);
  transient var purchases = HashMap.HashMap<Nat, [Purchase]>(10, Nat.equal, natHash);
  
  // Mock prices for testing (will be replaced with HTTPS outcalls)
  transient var mockPrices : [(Asset, Float)] = [
    (#BTC, 97500.0),
    (#ETH, 3450.0),
    (#ICP, 11.5)
  ];
  
  // ============================================
  // UPGRADE HOOKS
  // ============================================
  
  system func preupgrade() {
    usersEntries := Iter.toArray(users.entries());
    strategiesEntries := Iter.toArray(strategies.entries());
    purchasesEntries := Iter.toArray(purchases.entries());
  };
  
  system func postupgrade() {
    users := HashMap.fromIter<Principal, UserAccount>(usersEntries.vals(), 10, Principal.equal, Principal.hash);
    strategies := HashMap.fromIter<Nat, DCAStrategy>(strategiesEntries.vals(), 10, Nat.equal, natHash);
    purchases := HashMap.fromIter<Nat, [Purchase]>(purchasesEntries.vals(), 10, Nat.equal, natHash);
    usersEntries := [];
    strategiesEntries := [];
    purchasesEntries := [];
  };
  
  // ============================================
  // USER MANAGEMENT
  // ============================================
  
  /// Create a new user account
  public shared(msg) func createAccount() : async Result.Result<UserAccount, Text> {
    let caller = msg.caller;
    
    // Check if anonymous
    if (Principal.isAnonymous(caller)) {
      return #err("Anonymous principals cannot create accounts");
    };
    
    switch (users.get(caller)) {
      case (?existing) { #err("Account already exists") };
      case null {
        let account : UserAccount = {
          principal = caller;
          balance = 0;
          createdAt = Time.now();
        };
        users.put(caller, account);
        #ok(account)
      };
    };
  };
  
  /// Get user account info
  public shared(msg) func getAccount() : async Result.Result<UserAccount, Text> {
    let caller = msg.caller;
    switch (users.get(caller)) {
      case (?account) { #ok(account) };
      case null { #err("Account not found") };
    };
  };
  
  // ============================================
  // STRATEGY MANAGEMENT
  // ============================================
  
  /// Create a new DCA strategy
  public shared(msg) func createStrategy(
    targetAsset: Asset,
    amount: Nat,
    frequency: Frequency
  ) : async Result.Result<DCAStrategy, Text> {
    let caller = msg.caller;
    
    // Verify user exists
    switch (users.get(caller)) {
      case null { 
        // Auto-create account if not exists
        let account : UserAccount = {
          principal = caller;
          balance = 0;
          createdAt = Time.now();
        };
        users.put(caller, account);
      };
      case (?_) {};
    };
    
    // Validate amount (minimum $1 = 100 cents)
    if (amount < 100) {
      return #err("Minimum amount is $1 (100 cents)");
    };
    
    let strategy : DCAStrategy = {
      id = nextStrategyId;
      owner = caller;
      targetAsset = targetAsset;
      amount = amount;
      frequency = frequency;
      nextExecution = calculateNextExecution(frequency, Time.now());
      active = true;
      createdAt = Time.now();
    };
    
    strategies.put(nextStrategyId, strategy);
    nextStrategyId += 1;
    
    #ok(strategy)
  };
  
  /// Pause a DCA strategy
  public shared(msg) func pauseStrategy(strategyId: Nat) : async Result.Result<DCAStrategy, Text> {
    let caller = msg.caller;
    
    switch (strategies.get(strategyId)) {
      case null { #err("Strategy not found") };
      case (?strategy) {
        if (strategy.owner != caller) {
          return #err("Not authorized");
        };
        
        let updated : DCAStrategy = {
          id = strategy.id;
          owner = strategy.owner;
          targetAsset = strategy.targetAsset;
          amount = strategy.amount;
          frequency = strategy.frequency;
          nextExecution = strategy.nextExecution;
          active = false;
          createdAt = strategy.createdAt;
        };
        strategies.put(strategyId, updated);
        #ok(updated)
      };
    };
  };
  
  /// Resume a paused DCA strategy
  public shared(msg) func resumeStrategy(strategyId: Nat) : async Result.Result<DCAStrategy, Text> {
    let caller = msg.caller;
    
    switch (strategies.get(strategyId)) {
      case null { #err("Strategy not found") };
      case (?strategy) {
        if (strategy.owner != caller) {
          return #err("Not authorized");
        };
        
        let updated : DCAStrategy = {
          id = strategy.id;
          owner = strategy.owner;
          targetAsset = strategy.targetAsset;
          amount = strategy.amount;
          frequency = strategy.frequency;
          nextExecution = calculateNextExecution(strategy.frequency, Time.now());
          active = true;
          createdAt = strategy.createdAt;
        };
        strategies.put(strategyId, updated);
        #ok(updated)
      };
    };
  };
  
  /// Get all strategies for the caller
  public shared(msg) func getStrategies() : async [DCAStrategy] {
    let caller = msg.caller;
    let buffer = Buffer.Buffer<DCAStrategy>(0);
    
    for ((_, strategy) in strategies.entries()) {
      if (strategy.owner == caller) {
        buffer.add(strategy);
      };
    };
    
    Buffer.toArray(buffer)
  };
  
  /// Get a specific strategy
  public query func getStrategy(strategyId: Nat) : async Result.Result<DCAStrategy, Text> {
    switch (strategies.get(strategyId)) {
      case null { #err("Strategy not found") };
      case (?strategy) { #ok(strategy) };
    };
  };
  
  // ============================================
  // SCHEDULING
  // ============================================
  
  /// Calculate next execution time based on frequency
  private func calculateNextExecution(freq: Frequency, from: Time.Time) : Time.Time {
    let ONE_DAY : Int = 86_400_000_000_000; // nanoseconds in a day
    let ONE_WEEK : Int = 7 * ONE_DAY;
    
    switch (freq) {
      case (#Daily) { from + ONE_DAY };
      case (#Weekly) { from + ONE_WEEK };
      case (#Biweekly) { from + (2 * ONE_WEEK) };
      case (#Monthly) { from + (30 * ONE_DAY) }; // Simplified to 30 days
    };
  };
  
  /// Check and execute all due strategies (called by timer or manually)
  public func checkAndExecuteStrategies() : async Nat {
    let now = Time.now();
    var executedCount : Nat = 0;
    
    for ((id, strategy) in strategies.entries()) {
      if (strategy.active and now >= strategy.nextExecution) {
        // Execute purchase
        let result = await executePurchase(strategy);
        
        switch (result) {
          case (#ok(_)) {
            // Update next execution time
            let updated : DCAStrategy = {
              id = strategy.id;
              owner = strategy.owner;
              targetAsset = strategy.targetAsset;
              amount = strategy.amount;
              frequency = strategy.frequency;
              nextExecution = calculateNextExecution(strategy.frequency, now);
              active = strategy.active;
              createdAt = strategy.createdAt;
            };
            strategies.put(id, updated);
            executedCount += 1;
          };
          case (#err(_)) {
            // Log error but continue with other strategies
          };
        };
      };
    };
    
    executedCount
  };
  
  /// Manual trigger for testing a specific strategy
  public shared(msg) func triggerExecution(strategyId: Nat) : async Result.Result<Purchase, Text> {
    let caller = msg.caller;
    
    switch (strategies.get(strategyId)) {
      case null { #err("Strategy not found") };
      case (?strategy) {
        if (strategy.owner != caller) {
          return #err("Not authorized");
        };
        
        await executePurchase(strategy)
      };
    };
  };
  
  // ============================================
  // PRICE FETCHING (Mock for now, will add HTTPS outcalls)
  // ============================================
  
  /// Fetch current price for an asset
  public func fetchPrice(asset: Asset) : async Result.Result<PriceResponse, Text> {
    // For now, return mock prices
    // TODO: Implement HTTPS outcalls to Coinbase API in Week 2
    
    for ((a, price) in mockPrices.vals()) {
      if (assetEqual(a, asset)) {
        return #ok({
          asset = asset;
          priceUSD = price;
          timestamp = Time.now();
        });
      };
    };
    
    #err("Price not available")
  };
  
  /// Get prices for all assets
  public func getAllPrices() : async [(Asset, Float)] {
    mockPrices
  };
  
  // Helper to compare assets
  private func assetEqual(a: Asset, b: Asset) : Bool {
    switch (a, b) {
      case (#BTC, #BTC) { true };
      case (#ETH, #ETH) { true };
      case (#ICP, #ICP) { true };
      case _ { false };
    };
  };
  
  // ============================================
  // PURCHASE EXECUTION
  // ============================================
  
  /// Execute a purchase for a strategy
  private func executePurchase(strategy: DCAStrategy) : async Result.Result<Purchase, Text> {
    // 1. Fetch price
    let priceResult = await fetchPrice(strategy.targetAsset);
    let price = switch (priceResult) {
      case (#ok(p)) { p.priceUSD };
      case (#err(e)) { return #err("Failed to fetch price: " # e) };
    };
    
    // 2. Calculate amount to purchase
    // amount is in USD cents, price is in USD
    let amountUSD = Float.fromInt(strategy.amount);
    let amountAsset = amountUSD / (price * 100.0);
    
    // 3. Create purchase record
    let purchase : Purchase = {
      id = nextPurchaseId;
      strategyId = strategy.id;
      asset = strategy.targetAsset;
      amountUSD = strategy.amount;
      amountAsset = amountAsset;
      price = price;
      timestamp = Time.now();
      txHash = generateMockTxHash(strategy.targetAsset);
    };
    
    // 4. Record purchase in history
    let history = switch (purchases.get(strategy.id)) {
      case null { [purchase] };
      case (?existing) { Array.append(existing, [purchase]) };
    };
    purchases.put(strategy.id, history);
    
    nextPurchaseId += 1;
    
    #ok(purchase)
  };
  
  /// Generate mock transaction hash (will be replaced with real tx in Week 2)
  private func generateMockTxHash(asset: Asset) : Text {
    let prefix = switch (asset) {
      case (#BTC) { "btc_" };
      case (#ETH) { "eth_" };
      case (#ICP) { "icp_" };
    };
    prefix # "tx_" # Int.toText(Time.now())
  };
  
  // ============================================
  // PORTFOLIO & ANALYTICS
  // ============================================
  
  /// Get purchase history for a specific strategy
  public shared(msg) func getPurchaseHistory(strategyId: Nat) : async Result.Result<[Purchase], Text> {
    let caller = msg.caller;
    
    // Verify ownership
    switch (strategies.get(strategyId)) {
      case null { return #err("Strategy not found") };
      case (?strategy) {
        if (strategy.owner != caller) {
          return #err("Not authorized");
        };
      };
    };
    
    switch (purchases.get(strategyId)) {
      case null { #ok([]) };
      case (?history) { #ok(history) };
    };
  };
  
  /// Get all purchases for the caller
  public shared(msg) func getAllPurchases() : async [Purchase] {
    let caller = msg.caller;
    let buffer = Buffer.Buffer<Purchase>(0);
    
    for ((strategyId, _) in strategies.entries()) {
      switch (strategies.get(strategyId)) {
        case (?strategy) {
          if (strategy.owner == caller) {
            switch (purchases.get(strategyId)) {
              case (?history) {
                for (p in history.vals()) {
                  buffer.add(p);
                };
              };
              case null {};
            };
          };
        };
        case null {};
      };
    };
    
    Buffer.toArray(buffer)
  };
  
  /// Get portfolio holdings
  public shared(msg) func getPortfolio() : async [Holding] {
    let caller = msg.caller;
    
    // Aggregate purchases by asset
    var btcAmount : Float = 0.0;
    var btcCost : Float = 0.0;
    var ethAmount : Float = 0.0;
    var ethCost : Float = 0.0;
    var icpAmount : Float = 0.0;
    var icpCost : Float = 0.0;
    
    for ((strategyId, strategy) in strategies.entries()) {
      if (strategy.owner == caller) {
        switch (purchases.get(strategyId)) {
          case (?history) {
            for (p in history.vals()) {
              let cost = Float.fromInt(p.amountUSD) / 100.0;
              switch (p.asset) {
                case (#BTC) { 
                  btcAmount += p.amountAsset;
                  btcCost += cost;
                };
                case (#ETH) {
                  ethAmount += p.amountAsset;
                  ethCost += cost;
                };
                case (#ICP) {
                  icpAmount += p.amountAsset;
                  icpCost += cost;
                };
              };
            };
          };
          case null {};
        };
      };
    };
    
    let buffer = Buffer.Buffer<Holding>(3);
    
    if (btcAmount > 0.0) {
      buffer.add({
        asset = #BTC;
        amount = btcAmount;
        costBasis = btcCost;
        averagePrice = btcCost / btcAmount;
      });
    };
    
    if (ethAmount > 0.0) {
      buffer.add({
        asset = #ETH;
        amount = ethAmount;
        costBasis = ethCost;
        averagePrice = ethCost / ethAmount;
      });
    };
    
    if (icpAmount > 0.0) {
      buffer.add({
        asset = #ICP;
        amount = icpAmount;
        costBasis = icpCost;
        averagePrice = icpCost / icpAmount;
      });
    };
    
    Buffer.toArray(buffer)
  };
  
  /// Calculate profit/loss
  public shared(msg) func getProfitLoss() : async ProfitLoss {
    let caller = msg.caller;
    let portfolio = await getPortfolio();
    let prices = await getAllPrices();
    
    var totalValue : Float = 0.0;
    var totalCost : Float = 0.0;
    
    for (holding in portfolio.vals()) {
      totalCost += holding.costBasis;
      
      // Get current price for this asset
      for ((asset, price) in prices.vals()) {
        if (assetEqual(asset, holding.asset)) {
          totalValue += holding.amount * price;
        };
      };
    };
    
    let profitLoss = totalValue - totalCost;
    let profitLossPercent = if (totalCost > 0.0) {
      (profitLoss / totalCost) * 100.0
    } else {
      0.0
    };
    
    {
      totalValue = totalValue;
      totalCost = totalCost;
      profitLoss = profitLoss;
      profitLossPercent = profitLossPercent;
    }
  };
  
  // ============================================
  // ADMIN / DEBUG
  // ============================================
  
  /// Get total number of strategies (for testing)
  public query func getTotalStrategies() : async Nat {
    strategies.size()
  };
  
  /// Get total number of users (for testing)
  public query func getTotalUsers() : async Nat {
    users.size()
  };
};
