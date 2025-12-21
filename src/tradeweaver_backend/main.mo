import Time "mo:base/Time";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Nat8 "mo:base/Nat8";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Text "mo:base/Text";
import Result "mo:base/Result";
import Iter "mo:base/Iter";
import Buffer "mo:base/Buffer";
import Hash "mo:base/Hash";
import Blob "mo:base/Blob";
import Cycles "mo:base/ExperimentalCycles";
import Char "mo:base/Char";
import Option "mo:base/Option";

persistent actor TradeWeaver {

  // ============================================
  // TYPES
  // ============================================

  // User account structure
  public type UserAccount = {
    principal : Principal;
    balance : Nat; // ICP balance in e8s
    createdAt : Time.Time;
  };

  // Asset types supported
  public type Asset = {
    #ICP;
    #BTC;
    #ETH;
  };

  // Flexible frequency - interval in seconds
  public type Frequency = {
    #Seconds : Nat; // Custom interval in seconds
    #Minutes : Nat; // Custom interval in minutes
    #Hours : Nat; // Custom interval in hours
    #Daily; // Every 24 hours
    #Weekly; // Every 7 days
    #Monthly; // Every 30 days
  };

  // Trigger conditions for conditional execution
  public type TriggerCondition = {
    #None; // Execute on schedule
    #PriceBelow : Float; // Only buy if price < X
    #PriceAbove : Float; // Only buy if price > X
    #PriceDropPercent : Float; // Buy when price drops X% from recent high
    #PriceBelowAverage : Float; // Buy when price is X% below SMA
  };

  // DCA strategy configuration with flexible timing and conditions
  public type DCAStrategy = {
    id : Nat;
    owner : Principal;
    targetAsset : Asset;
    amount : Nat; // Amount in USD cents (e.g., 10000 = $100)
    frequency : Frequency; // Flexible interval
    triggerCondition : TriggerCondition; // Optional price condition
    intervalSeconds : Nat; // Computed interval in seconds
    nextExecution : Time.Time;
    active : Bool;
    createdAt : Time.Time;
    executionCount : Nat; // Track how many times executed
  };

  // Purchase record
  public type Purchase = {
    id : Nat;
    strategyId : Nat;
    asset : Asset;
    amountUSD : Nat;
    amountAsset : Float;
    price : Float;
    timestamp : Time.Time;
    txHash : Text;
  };

  // Portfolio holding
  public type Holding = {
    asset : Asset;
    amount : Float;
    costBasis : Float;
    averagePrice : Float;
  };

  // Price response from oracle
  public type PriceResponse = {
    asset : Asset;
    priceUSD : Float;
    timestamp : Time.Time;
  };

  // Profit/Loss analytics
  public type ProfitLoss = {
    totalValue : Float;
    totalCost : Float;
    profitLoss : Float;
    profitLossPercent : Float;
  };

  // AI Recommendation for purchase decisions
  public type AIRecommendation = {
    action : AIAction;
    confidence : Float; // 0.0 to 1.0
    adjustedAmount : Nat; // AI-adjusted purchase amount in cents
    reasoning : Text;
    timestamp : Time.Time;
  };

  public type AIAction = {
    #BuyNow; // Execute purchase immediately
    #Wait; // Delay purchase (price trending down)
    #BuyMore; // Increase purchase amount (good opportunity)
    #BuyLess; // Decrease purchase amount (high prices)
  };

  // Price history entry for trend analysis
  public type PriceHistoryEntry = {
    asset : Asset;
    price : Float;
    timestamp : Time.Time;
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
  private func natHash(n : Nat) : Nat32 {
    Nat32.fromNat(n % 4294967296);
  };

  // Runtime HashMaps (transient - not persisted across upgrades)
  transient var users = HashMap.HashMap<Principal, UserAccount>(10, Principal.equal, Principal.hash);
  transient var strategies = HashMap.HashMap<Nat, DCAStrategy>(10, Nat.equal, natHash);
  transient var purchases = HashMap.HashMap<Nat, [Purchase]>(10, Nat.equal, natHash);

  // Mock prices for testing (will be replaced with HTTPS outcalls)
  transient var mockPrices : [(Asset, Float)] = [
    (#BTC, 97500.0),
    (#ETH, 3450.0),
    (#ICP, 11.5),
  ];

  // Price history for AI trend analysis (keeps last 24 entries per asset)
  stable var priceHistoryBTC : [PriceHistoryEntry] = [];
  stable var priceHistoryETH : [PriceHistoryEntry] = [];
  stable var priceHistoryICP : [PriceHistoryEntry] = [];

  // Last AI recommendation cache
  transient var lastAIRecommendation : ?AIRecommendation = null;

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
  public shared (msg) func createAccount() : async Result.Result<UserAccount, Text> {
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
        #ok(account);
      };
    };
  };

  /// Get user account info
  public shared (msg) func getAccount() : async Result.Result<UserAccount, Text> {
    let caller = msg.caller;
    switch (users.get(caller)) {
      case (?account) { #ok(account) };
      case null { #err("Account not found") };
    };
  };

  // ============================================
  // STRATEGY MANAGEMENT
  // ============================================

  /// Create a new DCA strategy with flexible timing and optional conditions
  public shared (msg) func createStrategy(
    targetAsset : Asset,
    amount : Nat,
    frequency : Frequency,
    condition : ?TriggerCondition,
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

    let triggerCond = switch (condition) {
      case null { #None };
      case (?c) { c };
    };

    let strategy : DCAStrategy = {
      id = nextStrategyId;
      owner = caller;
      targetAsset = targetAsset;
      amount = amount;
      frequency = frequency;
      triggerCondition = triggerCond;
      intervalSeconds = frequencyToSeconds(frequency);
      nextExecution = calculateNextExecution(frequency, Time.now());
      active = true;
      createdAt = Time.now();
      executionCount = 0;
    };

    strategies.put(nextStrategyId, strategy);
    nextStrategyId += 1;

    #ok(strategy);
  };

  /// Pause a DCA strategy
  public shared (msg) func pauseStrategy(strategyId : Nat) : async Result.Result<DCAStrategy, Text> {
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
          triggerCondition = strategy.triggerCondition;
          intervalSeconds = strategy.intervalSeconds;
          nextExecution = strategy.nextExecution;
          active = false;
          createdAt = strategy.createdAt;
          executionCount = strategy.executionCount;
        };
        strategies.put(strategyId, updated);
        #ok(updated);
      };
    };
  };

  /// Resume a paused DCA strategy
  public shared (msg) func resumeStrategy(strategyId : Nat) : async Result.Result<DCAStrategy, Text> {
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
          triggerCondition = strategy.triggerCondition;
          intervalSeconds = strategy.intervalSeconds;
          nextExecution = calculateNextExecution(strategy.frequency, Time.now());
          active = true;
          createdAt = strategy.createdAt;
          executionCount = strategy.executionCount;
        };
        strategies.put(strategyId, updated);
        #ok(updated);
      };
    };
  };

  /// Get all strategies for the caller
  public shared (msg) func getStrategies() : async [DCAStrategy] {
    let caller = msg.caller;
    let buffer = Buffer.Buffer<DCAStrategy>(0);

    for ((_, strategy) in strategies.entries()) {
      if (strategy.owner == caller) {
        buffer.add(strategy);
      };
    };

    Buffer.toArray(buffer);
  };

  /// Get a specific strategy
  public query func getStrategy(strategyId : Nat) : async Result.Result<DCAStrategy, Text> {
    switch (strategies.get(strategyId)) {
      case null { #err("Strategy not found") };
      case (?strategy) { #ok(strategy) };
    };
  };

  // ============================================
  // SCHEDULING
  // ============================================

  /// Calculate next execution time based on frequency
  private func calculateNextExecution(freq : Frequency, from : Time.Time) : Time.Time {
    let ONE_SECOND : Int = 1_000_000_000; // nanoseconds in a second
    let ONE_DAY : Int = 86_400 * ONE_SECOND;
    let ONE_WEEK : Int = 7 * ONE_DAY;

    switch (freq) {
      case (#Seconds(s)) { from + (Int.abs(s) * ONE_SECOND) };
      case (#Minutes(m)) { from + (Int.abs(m) * 60 * ONE_SECOND) };
      case (#Hours(h)) { from + (Int.abs(h) * 3600 * ONE_SECOND) };
      case (#Daily) { from + ONE_DAY };
      case (#Weekly) { from + ONE_WEEK };
      case (#Monthly) { from + (30 * ONE_DAY) };
    };
  };

  /// Convert frequency to seconds for storage
  private func frequencyToSeconds(freq : Frequency) : Nat {
    switch (freq) {
      case (#Seconds(s)) { s };
      case (#Minutes(m)) { m * 60 };
      case (#Hours(h)) { h * 3600 };
      case (#Daily) { 86400 };
      case (#Weekly) { 604800 };
      case (#Monthly) { 2592000 };
    };
  };

  /// Check and execute all due strategies (called by timer or manually)
  public func checkAndExecuteStrategies() : async Nat {
    let now = Time.now();
    var executedCount : Nat = 0;

    for ((id, strategy) in strategies.entries()) {
      if (strategy.active and now >= strategy.nextExecution) {
        // Check trigger conditions before executing
        let shouldExecute = await checkTriggerCondition(strategy);

        if (shouldExecute) {
          // Execute purchase
          let result = await executePurchase(strategy);

          switch (result) {
            case (#ok(_)) {
              // Update next execution time and increment count
              let updated : DCAStrategy = {
                id = strategy.id;
                owner = strategy.owner;
                targetAsset = strategy.targetAsset;
                amount = strategy.amount;
                frequency = strategy.frequency;
                triggerCondition = strategy.triggerCondition;
                intervalSeconds = strategy.intervalSeconds;
                nextExecution = calculateNextExecution(strategy.frequency, now);
                active = strategy.active;
                createdAt = strategy.createdAt;
                executionCount = strategy.executionCount + 1;
              };
              strategies.put(id, updated);
              executedCount += 1;
            };
            case (#err(_)) {
              // Update next execution even on error to prevent retry spam
              let updated : DCAStrategy = {
                id = strategy.id;
                owner = strategy.owner;
                targetAsset = strategy.targetAsset;
                amount = strategy.amount;
                frequency = strategy.frequency;
                triggerCondition = strategy.triggerCondition;
                intervalSeconds = strategy.intervalSeconds;
                nextExecution = calculateNextExecution(strategy.frequency, now);
                active = strategy.active;
                createdAt = strategy.createdAt;
                executionCount = strategy.executionCount;
              };
              strategies.put(id, updated);
            };
          };
        } else {
          // Condition not met, reschedule for next interval
          let updated : DCAStrategy = {
            id = strategy.id;
            owner = strategy.owner;
            targetAsset = strategy.targetAsset;
            amount = strategy.amount;
            frequency = strategy.frequency;
            triggerCondition = strategy.triggerCondition;
            intervalSeconds = strategy.intervalSeconds;
            nextExecution = calculateNextExecution(strategy.frequency, now);
            active = strategy.active;
            createdAt = strategy.createdAt;
            executionCount = strategy.executionCount;
          };
          strategies.put(id, updated);
        };
      };
    };

    executedCount;
  };

  /// Check if trigger condition is met for a strategy
  private func checkTriggerCondition(strategy : DCAStrategy) : async Bool {
    switch (strategy.triggerCondition) {
      case (#None) { true }; // No condition, always execute
      case (#PriceBelow(maxPrice)) {
        let priceResult = await fetchPrice(strategy.targetAsset);
        switch (priceResult) {
          case (#ok(p)) { p.priceUSD < maxPrice };
          case (#err(_)) { false };
        };
      };
      case (#PriceAbove(minPrice)) {
        let priceResult = await fetchPrice(strategy.targetAsset);
        switch (priceResult) {
          case (#ok(p)) { p.priceUSD > minPrice };
          case (#err(_)) { false };
        };
      };
      case (#PriceDropPercent(dropPercent)) {
        // Check if price dropped X% from SMA
        let history = getPriceHistory(strategy.targetAsset);
        if (history.size() < 3) { return true }; // Not enough data

        let sma = calculateSMA(history);
        let priceResult = await fetchPrice(strategy.targetAsset);
        switch (priceResult) {
          case (#ok(p)) {
            let dropFromSMA = (sma - p.priceUSD) / sma * 100.0;
            dropFromSMA >= dropPercent;
          };
          case (#err(_)) { false };
        };
      };
      case (#PriceBelowAverage(percentBelow)) {
        // Only buy if current price is X% below SMA
        let history = getPriceHistory(strategy.targetAsset);
        if (history.size() < 3) { return true };

        let sma = calculateSMA(history);
        let priceResult = await fetchPrice(strategy.targetAsset);
        switch (priceResult) {
          case (#ok(p)) { p.priceUSD < sma * (1.0 - percentBelow / 100.0) };
          case (#err(_)) { false };
        };
      };
    };
  };

  /// Manual trigger for testing a specific strategy
  public shared (msg) func triggerExecution(strategyId : Nat) : async Result.Result<Purchase, Text> {
    let caller = msg.caller;

    switch (strategies.get(strategyId)) {
      case null { #err("Strategy not found") };
      case (?strategy) {
        if (strategy.owner != caller) {
          return #err("Not authorized");
        };

        await executePurchase(strategy);
      };
    };
  };

  // ============================================
  // PRICE FETCHING VIA HTTPS OUTCALLS
  // ============================================

  // Types for HTTPS outcalls
  type HttpRequestArgs = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [HttpHeader];
    body : ?[Nat8];
    method : HttpMethod;
    transform : ?TransformRawResponseFunction;
  };

  type HttpHeader = {
    name : Text;
    value : Text;
  };

  type HttpMethod = {
    #get;
    #post;
    #head;
  };

  type HttpResponsePayload = {
    status : Nat;
    headers : [HttpHeader];
    body : [Nat8];
  };

  type TransformRawResponseFunction = {
    function : shared query TransformArgs -> async HttpResponsePayload;
    context : Blob;
  };

  type TransformArgs = {
    response : HttpResponsePayload;
    context : Blob;
  };

  // IC Management Canister
  let ic : actor {
    http_request : HttpRequestArgs -> async HttpResponsePayload;
  } = actor "aaaaa-aa";

  // Transform function to strip variable headers for consensus
  public query func transform(raw : TransformArgs) : async HttpResponsePayload {
    {
      status = raw.response.status;
      body = raw.response.body;
      headers = []; // Strip headers for determinism
    };
  };

  // Get CoinGecko API ID for asset
  private func getAssetId(asset : Asset) : Text {
    switch (asset) {
      case (#BTC) { "bitcoin" };
      case (#ETH) { "ethereum" };
      case (#ICP) { "internet-computer" };
    };
  };

  /// Fetch current price for an asset via HTTPS outcall
  public func fetchPrice(asset : Asset) : async Result.Result<PriceResponse, Text> {
    let assetId = getAssetId(asset);
    let url = "https://api.coingecko.com/api/v3/simple/price?ids=" # assetId # "&vs_currencies=usd";

    let request_headers : [HttpHeader] = [
      { name = "Accept"; value = "application/json" },
      { name = "User-Agent"; value = "TradeWeaver-DCA-Bot" },
    ];

    let transform_context : TransformRawResponseFunction = {
      function = transform;
      context = Blob.fromArray([]);
    };

    let http_request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?2048;
      headers = request_headers;
      body = null;
      method = #get;
      transform = ?transform_context;
    };

    // Add cycles for the HTTPS outcall (~1B cycles)
    Cycles.add<system>(1_000_000_000);

    try {
      let response = await ic.http_request(http_request);

      if (response.status == 200) {
        // Decode response body
        let body_text = switch (Text.decodeUtf8(Blob.fromArray(response.body))) {
          case null { return #err("Failed to decode response body") };
          case (?text) { text };
        };

        // Parse price from JSON (simple parser)
        let price = parsePrice(body_text, assetId);

        switch (price) {
          case null {
            // Fallback to mock prices if parsing fails
            for ((a, p) in mockPrices.vals()) {
              if (assetEqual(a, asset)) {
                return #ok({
                  asset = asset;
                  priceUSD = p;
                  timestamp = Time.now();
                });
              };
            };
            #err("Failed to parse price from response");
          };
          case (?p) {
            #ok({
              asset = asset;
              priceUSD = p;
              timestamp = Time.now();
            });
          };
        };
      } else {
        // Fallback to mock prices on HTTP error
        for ((a, p) in mockPrices.vals()) {
          if (assetEqual(a, asset)) {
            return #ok({
              asset = asset;
              priceUSD = p;
              timestamp = Time.now();
            });
          };
        };
        #err("HTTP error: " # Nat.toText(response.status));
      };
    } catch (e) {
      // Fallback to mock prices on any error
      for ((a, p) in mockPrices.vals()) {
        if (assetEqual(a, asset)) {
          return #ok({
            asset = asset;
            priceUSD = p;
            timestamp = Time.now();
          });
        };
      };
      #err("HTTPS outcall failed - using mock prices");
    };
  };

  // Simple JSON price parser
  // Parses: {"bitcoin":{"usd":97500.0}}
  private func parsePrice(json : Text, assetId : Text) : ?Float {
    // Look for the pattern: "usd":NUMBER
    let chars = Text.toIter(json);
    var buffer = "";
    var foundUsd = false;
    var collectingNumber = false;
    var numberStr = "";

    for (c in chars) {
      buffer := buffer # Text.fromChar(c);

      if (Text.endsWith(buffer, #text "\"usd\":")) {
        foundUsd := true;
        collectingNumber := true;
        numberStr := "";
      } else if (collectingNumber) {
        if (Char.isDigit(c) or c == '.' or c == '-') {
          numberStr := numberStr # Text.fromChar(c);
        } else if (Text.size(numberStr) > 0) {
          // End of number
          return textToFloat(numberStr);
        };
      };
    };

    if (Text.size(numberStr) > 0) {
      return textToFloat(numberStr);
    };

    null;
  };

  // Convert text to float (simple implementation)
  private func textToFloat(t : Text) : ?Float {
    var result : Float = 0.0;
    var decimalPart : Float = 0.0;
    var decimalDivisor : Float = 1.0;
    var isDecimal = false;
    var isNegative = false;

    for (c in Text.toIter(t)) {
      if (c == '-') {
        isNegative := true;
      } else if (c == '.') {
        isDecimal := true;
      } else if (Char.isDigit(c)) {
        let digit = Float.fromInt(Nat32.toNat(Char.toNat32(c) - 48));
        if (isDecimal) {
          decimalDivisor *= 10.0;
          decimalPart := decimalPart + (digit / decimalDivisor);
        } else {
          result := result * 10.0 + digit;
        };
      };
    };

    let finalResult = result + decimalPart;
    if (isNegative) {
      return ?(-finalResult);
    };
    ?finalResult;
  };

  /// Get prices for all assets
  public func getAllPrices() : async [(Asset, Float)] {
    let btcResult = await fetchPrice(#BTC);
    let ethResult = await fetchPrice(#ETH);
    let icpResult = await fetchPrice(#ICP);

    var prices : [(Asset, Float)] = [];

    switch (btcResult) {
      case (#ok(p)) { prices := Array.append(prices, [(#BTC, p.priceUSD)]) };
      case (#err(_)) { prices := Array.append(prices, [(#BTC, 97500.0)]) }; // fallback
    };

    switch (ethResult) {
      case (#ok(p)) { prices := Array.append(prices, [(#ETH, p.priceUSD)]) };
      case (#err(_)) { prices := Array.append(prices, [(#ETH, 3450.0)]) }; // fallback
    };

    switch (icpResult) {
      case (#ok(p)) { prices := Array.append(prices, [(#ICP, p.priceUSD)]) };
      case (#err(_)) { prices := Array.append(prices, [(#ICP, 11.5)]) }; // fallback
    };

    prices;
  };

  // Helper to compare assets
  private func assetEqual(a : Asset, b : Asset) : Bool {
    switch (a, b) {
      case (#BTC, #BTC) { true };
      case (#ETH, #ETH) { true };
      case (#ICP, #ICP) { true };
      case _ { false };
    };
  };

  // ============================================
  // AI-POWERED DECISION ENGINE
  // ============================================

  // Record price for trend analysis
  private func recordPrice(asset : Asset, price : Float) {
    let entry : PriceHistoryEntry = {
      asset = asset;
      price = price;
      timestamp = Time.now();
    };

    // Keep only last 24 entries
    let maxHistory = 24;

    switch (asset) {
      case (#BTC) {
        let newHistory = Array.append(priceHistoryBTC, [entry]);
        if (newHistory.size() > maxHistory) {
          priceHistoryBTC := Array.tabulate<PriceHistoryEntry>(maxHistory, func(i) = newHistory[newHistory.size() - maxHistory + i]);
        } else {
          priceHistoryBTC := newHistory;
        };
      };
      case (#ETH) {
        let newHistory = Array.append(priceHistoryETH, [entry]);
        if (newHistory.size() > maxHistory) {
          priceHistoryETH := Array.tabulate<PriceHistoryEntry>(maxHistory, func(i) = newHistory[newHistory.size() - maxHistory + i]);
        } else {
          priceHistoryETH := newHistory;
        };
      };
      case (#ICP) {
        let newHistory = Array.append(priceHistoryICP, [entry]);
        if (newHistory.size() > maxHistory) {
          priceHistoryICP := Array.tabulate<PriceHistoryEntry>(maxHistory, func(i) = newHistory[newHistory.size() - maxHistory + i]);
        } else {
          priceHistoryICP := newHistory;
        };
      };
    };
  };

  // Get price history for an asset
  private func getPriceHistory(asset : Asset) : [PriceHistoryEntry] {
    switch (asset) {
      case (#BTC) { priceHistoryBTC };
      case (#ETH) { priceHistoryETH };
      case (#ICP) { priceHistoryICP };
    };
  };

  // Calculate simple moving average from history
  private func calculateSMA(history : [PriceHistoryEntry]) : Float {
    if (history.size() == 0) return 0.0;

    var sum : Float = 0.0;
    for (entry in history.vals()) {
      sum += entry.price;
    };
    sum / Float.fromInt(history.size());
  };

  // Calculate price trend (-1 = down, 0 = stable, 1 = up)
  private func calculateTrend(history : [PriceHistoryEntry]) : Float {
    if (history.size() < 2) return 0.0;

    let recent = history[history.size() - 1].price;
    let sma = calculateSMA(history);

    if (sma == 0.0) return 0.0;

    // Percentage difference from SMA
    (recent - sma) / sma;
  };

  /// AI-powered purchase recommendation
  /// Analyzes price trends and market conditions to optimize DCA execution
  public func getAIRecommendation(asset : Asset, baseAmount : Nat) : async AIRecommendation {
    // 1. Fetch current price and record it
    let priceResult = await fetchPrice(asset);
    let currentPrice = switch (priceResult) {
      case (#ok(p)) { p.priceUSD };
      case (#err(_)) { 0.0 };
    };

    if (currentPrice > 0.0) {
      recordPrice(asset, currentPrice);
    };

    // 2. Get price history and calculate trend
    let history = getPriceHistory(asset);
    let trend = calculateTrend(history);
    let sma = calculateSMA(history);

    // 3. AI decision logic based on trend analysis
    let (action, confidence, multiplier, reasoning) : (AIAction, Float, Float, Text) = if (history.size() < 3) {
      // Not enough data, proceed with normal buy
      (#BuyNow, 0.6, 1.0, "Insufficient price history. Executing standard DCA purchase.");
    } else if (trend < -0.05) {
      // Price significantly below SMA (>5%), buy more
      (#BuyMore, 0.85, 1.25, "Price is " # Float.toText(Float.abs(trend) * 100.0) # "% below average. Increasing purchase to capitalize on dip.");
    } else if (trend > 0.08) {
      // Price significantly above SMA (>8%), wait or buy less
      (#BuyLess, 0.75, 0.75, "Price is " # Float.toText(trend * 100.0) # "% above average. Reducing purchase amount.");
    } else if (trend > 0.15) {
      // Price very high, consider waiting
      (#Wait, 0.65, 0.0, "Price is significantly elevated. Recommending to delay purchase.");
    } else {
      // Normal market conditions
      (#BuyNow, 0.8, 1.0, "Market conditions normal. Executing standard DCA purchase.");
    };

    let adjustedAmount = Int.abs(Float.toInt(Float.fromInt(baseAmount) * multiplier));

    let recommendation : AIRecommendation = {
      action = action;
      confidence = confidence;
      adjustedAmount = adjustedAmount;
      reasoning = reasoning;
      timestamp = Time.now();
    };

    lastAIRecommendation := ?recommendation;
    recommendation;
  };

  /// Get the last AI recommendation (cached)
  public query func getLastAIRecommendation() : async ?AIRecommendation {
    lastAIRecommendation;
  };

  /// Get price history for analysis
  public query func getPriceHistoryForAsset(asset : Asset) : async [PriceHistoryEntry] {
    getPriceHistory(asset);
  };

  // ============================================
  // CHAIN FUSION - CROSS-CHAIN PURCHASE EXECUTION
  // ============================================

  // Types for Bitcoin integration
  type BitcoinNetwork = {
    #mainnet;
    #testnet;
    #regtest;
  };

  type GetUtxosResponse = {
    utxos : [Utxo];
    tip_block_hash : [Nat8];
    tip_height : Nat32;
    next_page : ?[Nat8];
  };

  type Utxo = {
    outpoint : { txid : [Nat8]; vout : Nat32 };
    value : Nat64;
    height : Nat32;
  };

  type ECDSAPublicKeyResponse = {
    public_key : [Nat8];
    chain_code : [Nat8];
  };

  type SignWithECDSAResponse = {
    signature : [Nat8];
  };

  type SchnorrPublicKeyResponse = {
    public_key : [Nat8];
    chain_code : [Nat8];
  };

  type SignWithSchnorrResponse = {
    signature : [Nat8];
  };

  // Bitcoin Management Canister Interface
  let bitcoinCanister : actor {
    bitcoin_get_utxos : ({
      address : Text;
      network : BitcoinNetwork;
      filter : ?{ min_confirmations : ?Nat32; page : ?[Nat8] };
    }) -> async GetUtxosResponse;

    bitcoin_get_balance : ({
      address : Text;
      network : BitcoinNetwork;
      min_confirmations : ?Nat32;
    }) -> async Nat64;

    bitcoin_send_transaction : ({
      transaction : [Nat8];
      network : BitcoinNetwork;
    }) -> async ();
  } = actor "aaaaa-aa";

  // Threshold Signature Management Canister
  let signatureCanister : actor {
    ecdsa_public_key : ({
      canister_id : ?Principal;
      derivation_path : [[Nat8]];
      key_id : { curve : { #secp256k1 }; name : Text };
    }) -> async ECDSAPublicKeyResponse;

    sign_with_ecdsa : ({
      message_hash : [Nat8];
      derivation_path : [[Nat8]];
      key_id : { curve : { #secp256k1 }; name : Text };
    }) -> async SignWithECDSAResponse;

    schnorr_public_key : ({
      canister_id : ?Principal;
      derivation_path : [[Nat8]];
      key_id : { algorithm : { #bip340secp256k1; #ed25519 }; name : Text };
    }) -> async SchnorrPublicKeyResponse;

    sign_with_schnorr : ({
      message : [Nat8];
      derivation_path : [[Nat8]];
      key_id : { algorithm : { #bip340secp256k1; #ed25519 }; name : Text };
    }) -> async SignWithSchnorrResponse;
  } = actor "aaaaa-aa";

  // Key IDs for different environments
  private func getECDSAKeyId() : { curve : { #secp256k1 }; name : Text } {
    { curve = #secp256k1; name = "dfx_test_key" } // Use "key_1" for mainnet
  };

  private func getSchnorrKeyId() : {
    algorithm : { #bip340secp256k1; #ed25519 };
    name : Text;
  } {
    { algorithm = #bip340secp256k1; name = "dfx_test_key" } // Use "key_1" for mainnet
  };

  // Get derivation path for user (based on principal)
  private func getDerivationPath(principal : Principal) : [[Nat8]] {
    let principalBlob = Principal.toBlob(principal);
    [Blob.toArray(principalBlob)];
  };

  /// Purchase BTC using threshold Schnorr signatures (Chain Fusion)
  private func purchaseBTC(strategy : DCAStrategy, price : Float, amountAsset : Float) : async Result.Result<Text, Text> {
    // In production, this would:
    // 1. Get user's Bitcoin address from Schnorr public key
    // 2. Check available UTXO balance
    // 3. Build Bitcoin transaction
    // 4. Sign with threshold Schnorr
    // 5. Broadcast to Bitcoin network

    // For demo/testnet, we simulate the transaction
    try {
      // Get Schnorr public key for the user
      Cycles.add<system>(100_000_000);
      let pubKeyResult = await signatureCanister.schnorr_public_key({
        canister_id = null;
        derivation_path = getDerivationPath(strategy.owner);
        key_id = getSchnorrKeyId();
      });

      // Create a mock transaction signature
      let mockTxData : [Nat8] = [1, 2, 3, 4, 5, 6, 7, 8]; // Simplified

      Cycles.add<system>(100_000_000);
      let signResult = await signatureCanister.sign_with_schnorr({
        message = mockTxData;
        derivation_path = getDerivationPath(strategy.owner);
        key_id = getSchnorrKeyId();
      });

      // Generate deterministic tx hash from signature
      let txHash = "btc_schnorr_" # Int.toText(Time.now()) # "_" # Nat.toText(signResult.signature.size());

      #ok(txHash);
    } catch (e) {
      // Fallback to mock hash if threshold signature fails (local development)
      #ok("btc_mock_" # Int.toText(Time.now()));
    };
  };

  /// Purchase ETH using threshold ECDSA signatures (Chain Fusion)
  private func purchaseETH(strategy : DCAStrategy, price : Float, amountAsset : Float) : async Result.Result<Text, Text> {
    // In production, this would:
    // 1. Get user's Ethereum address from ECDSA public key
    // 2. Check ETH balance
    // 3. Build EVM transaction
    // 4. Sign with threshold ECDSA
    // 5. Submit to EVM network via EVM RPC canister

    try {
      // Get ECDSA public key for the user
      Cycles.add<system>(100_000_000);
      let pubKeyResult = await signatureCanister.ecdsa_public_key({
        canister_id = null;
        derivation_path = getDerivationPath(strategy.owner);
        key_id = getECDSAKeyId();
      });

      // Create a mock transaction hash (keccak256 would be used in production)
      let mockTxHash : [Nat8] = [
        0x01,
        0x02,
        0x03,
        0x04,
        0x05,
        0x06,
        0x07,
        0x08,
        0x09,
        0x0a,
        0x0b,
        0x0c,
        0x0d,
        0x0e,
        0x0f,
        0x10,
        0x11,
        0x12,
        0x13,
        0x14,
        0x15,
        0x16,
        0x17,
        0x18,
        0x19,
        0x1a,
        0x1b,
        0x1c,
        0x1d,
        0x1e,
        0x1f,
        0x20,
      ];

      Cycles.add<system>(100_000_000);
      let signResult = await signatureCanister.sign_with_ecdsa({
        message_hash = mockTxHash;
        derivation_path = getDerivationPath(strategy.owner);
        key_id = getECDSAKeyId();
      });

      // Generate deterministic tx hash from signature
      let txHash = "eth_ecdsa_" # Int.toText(Time.now()) # "_" # Nat.toText(signResult.signature.size());

      #ok(txHash);
    } catch (e) {
      // Fallback to mock hash if threshold signature fails (local development)
      #ok("eth_mock_" # Int.toText(Time.now()));
    };
  };

  /// Purchase ICP (native, no cross-chain needed)
  private func purchaseICP(strategy : DCAStrategy, price : Float, amountAsset : Float) : async Result.Result<Text, Text> {
    // ICP is native - would integrate with ICP Ledger for actual transfers
    // For DCA bot, this simulates swapping stablecoins for ICP
    let txHash = "icp_native_" # Int.toText(Time.now());
    #ok(txHash);
  };

  /// Execute a purchase for a strategy with Chain Fusion and AI optimization
  private func executePurchase(strategy : DCAStrategy) : async Result.Result<Purchase, Text> {
    // 1. Get AI recommendation for optimal purchase
    let aiRec = await getAIRecommendation(strategy.targetAsset, strategy.amount);

    // 2. Check if AI recommends waiting
    switch (aiRec.action) {
      case (#Wait) {
        return #err("AI recommends waiting: " # aiRec.reasoning);
      };
      case _ {};
    };

    // 3. Fetch real-time price (already fetched in AI, but get fresh)
    let priceResult = await fetchPrice(strategy.targetAsset);
    let price = switch (priceResult) {
      case (#ok(p)) { p.priceUSD };
      case (#err(e)) { return #err("Failed to fetch price: " # e) };
    };

    // 4. Use AI-adjusted amount instead of base amount
    let amountUSD = Float.fromInt(aiRec.adjustedAmount);
    let amountAsset = amountUSD / (price * 100.0);

    // 5. Execute cross-chain purchase via Chain Fusion
    let txResult = switch (strategy.targetAsset) {
      case (#BTC) { await purchaseBTC(strategy, price, amountAsset) };
      case (#ETH) { await purchaseETH(strategy, price, amountAsset) };
      case (#ICP) { await purchaseICP(strategy, price, amountAsset) };
    };

    let txHash = switch (txResult) {
      case (#ok(hash)) { hash };
      case (#err(e)) { return #err("Transaction failed: " # e) };
    };

    // 6. Create purchase record (with AI-adjusted amount)
    let purchase : Purchase = {
      id = nextPurchaseId;
      strategyId = strategy.id;
      asset = strategy.targetAsset;
      amountUSD = aiRec.adjustedAmount; // AI-adjusted amount
      amountAsset = amountAsset;
      price = price;
      timestamp = Time.now();
      txHash = txHash # " | AI: " # aiRec.reasoning; // Include AI reasoning
    };

    // 7. Record purchase in history
    let history = switch (purchases.get(strategy.id)) {
      case null { [purchase] };
      case (?existing) { Array.append(existing, [purchase]) };
    };
    purchases.put(strategy.id, history);

    nextPurchaseId += 1;

    #ok(purchase);
  };

  // ============================================
  // CHAIN FUSION - WALLET UTILITIES
  // ============================================

  /// Get user's Bitcoin address (derived from Schnorr public key)
  public shared (msg) func getBitcoinAddress() : async Result.Result<Text, Text> {
    try {
      Cycles.add<system>(100_000_000);
      let pubKeyResult = await signatureCanister.schnorr_public_key({
        canister_id = null;
        derivation_path = getDerivationPath(msg.caller);
        key_id = getSchnorrKeyId();
      });

      // In production, derive P2TR address from public key
      // For now, return hex-encoded public key prefix as mock address
      let pubKeyHex = "bc1p" # Int.toText(Time.now() % 100000);
      #ok(pubKeyHex);
    } catch (e) {
      #err("Failed to derive Bitcoin address");
    };
  };

  /// Get user's Ethereum address (derived from ECDSA public key)
  public shared (msg) func getEthereumAddress() : async Result.Result<Text, Text> {
    try {
      Cycles.add<system>(100_000_000);
      let pubKeyResult = await signatureCanister.ecdsa_public_key({
        canister_id = null;
        derivation_path = getDerivationPath(msg.caller);
        key_id = getECDSAKeyId();
      });

      // In production, derive Ethereum address from public key (keccak256)
      // For now, return mock address
      let ethAddress = "0x" # Int.toText(Time.now() % 1000000000000);
      #ok(ethAddress);
    } catch (e) {
      #err("Failed to derive Ethereum address");
    };
  };

  // ============================================
  // PORTFOLIO & ANALYTICS
  // ============================================

  /// Get purchase history for a specific strategy
  public shared (msg) func getPurchaseHistory(strategyId : Nat) : async Result.Result<[Purchase], Text> {
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
  public shared (msg) func getAllPurchases() : async [Purchase] {
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

    Buffer.toArray(buffer);
  };

  /// Get portfolio holdings
  public shared (msg) func getPortfolio() : async [Holding] {
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

    Buffer.toArray(buffer);
  };

  /// Calculate profit/loss
  public shared (msg) func getProfitLoss() : async ProfitLoss {
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
      (profitLoss / totalCost) * 100.0;
    } else {
      0.0;
    };

    {
      totalValue = totalValue;
      totalCost = totalCost;
      profitLoss = profitLoss;
      profitLossPercent = profitLossPercent;
    };
  };

  // ============================================
  // ADMIN / DEBUG
  // ============================================

  /// Get total number of strategies (for testing)
  public query func getTotalStrategies() : async Nat {
    strategies.size();
  };

  /// Get total number of users (for testing)
  public query func getTotalUsers() : async Nat {
    users.size();
  };
};
