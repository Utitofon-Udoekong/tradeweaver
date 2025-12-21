export const idlFactory = ({ IDL }) => {
  const Time = IDL.Int;
  const UserAccount = IDL.Record({
    'principal' : IDL.Principal,
    'balance' : IDL.Nat,
    'createdAt' : Time,
  });
  const Result_4 = IDL.Variant({ 'ok' : UserAccount, 'err' : IDL.Text });
  const Asset = IDL.Variant({
    'BTC' : IDL.Null,
    'ETH' : IDL.Null,
    'ICP' : IDL.Null,
  });
  const Frequency = IDL.Variant({
    'Weekly' : IDL.Null,
    'Daily' : IDL.Null,
    'Monthly' : IDL.Null,
    'Biweekly' : IDL.Null,
  });
  const DCAStrategy = IDL.Record({
    'id' : IDL.Nat,
    'active' : IDL.Bool,
    'owner' : IDL.Principal,
    'createdAt' : Time,
    'targetAsset' : Asset,
    'frequency' : Frequency,
    'nextExecution' : Time,
    'amount' : IDL.Nat,
  });
  const Result_1 = IDL.Variant({ 'ok' : DCAStrategy, 'err' : IDL.Text });
  const PriceResponse = IDL.Record({
    'asset' : Asset,
    'timestamp' : Time,
    'priceUSD' : IDL.Float64,
  });
  const Result_5 = IDL.Variant({ 'ok' : PriceResponse, 'err' : IDL.Text });
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
    'createStrategy' : IDL.Func([Asset, IDL.Nat, Frequency], [Result_1], []),
    'fetchPrice' : IDL.Func([Asset], [Result_5], []),
    'getAccount' : IDL.Func([], [Result_4], []),
    'getAllPrices' : IDL.Func([], [IDL.Vec(IDL.Tuple(Asset, IDL.Float64))], []),
    'getAllPurchases' : IDL.Func([], [IDL.Vec(Purchase)], []),
    'getBitcoinAddress' : IDL.Func([], [Result_3], []),
    'getEthereumAddress' : IDL.Func([], [Result_3], []),
    'getPortfolio' : IDL.Func([], [IDL.Vec(Holding)], []),
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
