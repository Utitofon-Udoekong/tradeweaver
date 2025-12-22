export const idlFactory = ({ IDL }) => {
  const Time = IDL.Int;
  const UserAccount = IDL.Record({
    'principal' : IDL.Principal,
    'balance' : IDL.Nat,
    'createdAt' : Time,
  });
  const Result_4 = IDL.Variant({ 'ok' : UserAccount, 'err' : IDL.Text });
  const StrategyType = IDL.Variant({ 'Buy' : IDL.Null, 'Sell' : IDL.Null });
  const Asset = IDL.Variant({
    'BTC' : IDL.Null,
    'ETH' : IDL.Null,
    'ICP' : IDL.Null,
  });
  const Frequency = IDL.Variant({
    'Minutes' : IDL.Nat,
    'Seconds' : IDL.Nat,
    'Weekly' : IDL.Null,
    'Daily' : IDL.Null,
    'Monthly' : IDL.Null,
    'Hours' : IDL.Nat,
  });
  const TriggerCondition = IDL.Variant({
    'None' : IDL.Null,
    'PriceBelow' : IDL.Float64,
    'PriceAbove' : IDL.Float64,
    'PriceBelowAverage' : IDL.Float64,
    'PriceDropPercent' : IDL.Float64,
  });
  const DCAStrategy = IDL.Record({
    'id' : IDL.Nat,
    'triggerCondition' : TriggerCondition,
    'executionCount' : IDL.Nat,
    'active' : IDL.Bool,
    'owner' : IDL.Principal,
    'createdAt' : Time,
    'intervalSeconds' : IDL.Nat,
    'targetAsset' : Asset,
    'frequency' : Frequency,
    'nextExecution' : Time,
    'amount' : IDL.Nat,
    'strategyType' : StrategyType,
  });
  const Result_1 = IDL.Variant({ 'ok' : DCAStrategy, 'err' : IDL.Text });
  const Result_6 = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const PriceResponse = IDL.Record({
    'asset' : Asset,
    'timestamp' : Time,
    'priceUSD' : IDL.Float64,
  });
  const Result_5 = IDL.Variant({ 'ok' : PriceResponse, 'err' : IDL.Text });
  const AIAction = IDL.Variant({
    'BuyNow' : IDL.Null,
    'Wait' : IDL.Null,
    'BuyLess' : IDL.Null,
    'BuyMore' : IDL.Null,
  });
  const AIRecommendation = IDL.Record({
    'action' : AIAction,
    'reasoning' : IDL.Text,
    'timestamp' : Time,
    'confidence' : IDL.Float64,
    'adjustedAmount' : IDL.Nat,
  });
  const Purchase = IDL.Record({
    'id' : IDL.Nat,
    'asset' : Asset,
    'amountAsset' : IDL.Float64,
    'timestamp' : Time,
    'txHash' : IDL.Text,
    'amountUSD' : IDL.Nat,
    'price' : IDL.Float64,
    'strategyId' : IDL.Nat,
  });
  const Result_3 = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const Holding = IDL.Record({
    'asset' : Asset,
    'averagePrice' : IDL.Float64,
    'costBasis' : IDL.Float64,
    'amount' : IDL.Float64,
  });
  const PriceHistoryEntry = IDL.Record({
    'asset' : Asset,
    'timestamp' : Time,
    'price' : IDL.Float64,
  });
  const ProfitLoss = IDL.Record({
    'totalValue' : IDL.Float64,
    'totalCost' : IDL.Float64,
    'profitLoss' : IDL.Float64,
    'profitLossPercent' : IDL.Float64,
  });
  const Result_2 = IDL.Variant({ 'ok' : IDL.Vec(Purchase), 'err' : IDL.Text });
  const HttpHeader = IDL.Record({ 'value' : IDL.Text, 'name' : IDL.Text });
  const HttpResponsePayload = IDL.Record({
    'status' : IDL.Nat,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HttpHeader),
  });
  const TransformArgs = IDL.Record({
    'context' : IDL.Vec(IDL.Nat8),
    'response' : HttpResponsePayload,
  });
  const Result = IDL.Variant({ 'ok' : Purchase, 'err' : IDL.Text });
  return IDL.Service({
    'checkAndExecuteStrategies' : IDL.Func([], [IDL.Nat], []),
    'createAccount' : IDL.Func([], [Result_4], []),
    'createStrategy' : IDL.Func(
        [StrategyType, Asset, IDL.Nat, Frequency, IDL.Opt(TriggerCondition)],
        [Result_1],
        [],
      ),
    'deleteStrategy' : IDL.Func([IDL.Nat], [Result_6], []),
    'fetchPrice' : IDL.Func([Asset], [Result_5], []),
    'getAIRecommendation' : IDL.Func([Asset, IDL.Nat], [AIRecommendation], []),
    'getAccount' : IDL.Func([], [Result_4], []),
    'getAllPrices' : IDL.Func([], [IDL.Vec(IDL.Tuple(Asset, IDL.Float64))], []),
    'getAllPurchases' : IDL.Func([], [IDL.Vec(Purchase)], []),
    'getBitcoinAddress' : IDL.Func([], [Result_3], []),
    'getEthereumAddress' : IDL.Func([], [Result_3], []),
    'getLastAIRecommendation' : IDL.Func(
        [],
        [IDL.Opt(AIRecommendation)],
        ['query'],
      ),
    'getPortfolio' : IDL.Func([], [IDL.Vec(Holding)], []),
    'getPriceHistoryForAsset' : IDL.Func(
        [Asset],
        [IDL.Vec(PriceHistoryEntry)],
        ['query'],
      ),
    'getProfitLoss' : IDL.Func([], [ProfitLoss], []),
    'getPurchaseHistory' : IDL.Func([IDL.Nat], [Result_2], []),
    'getStrategies' : IDL.Func([], [IDL.Vec(DCAStrategy)], []),
    'getStrategy' : IDL.Func([IDL.Nat], [Result_1], ['query']),
    'getTotalStrategies' : IDL.Func([], [IDL.Nat], ['query']),
    'getTotalUsers' : IDL.Func([], [IDL.Nat], ['query']),
    'pauseStrategy' : IDL.Func([IDL.Nat], [Result_1], []),
    'resumeStrategy' : IDL.Func([IDL.Nat], [Result_1], []),
    'transform' : IDL.Func([TransformArgs], [HttpResponsePayload], ['query']),
    'triggerExecution' : IDL.Func([IDL.Nat], [Result], []),
  });
};
export const init = ({ IDL }) => { return []; };
