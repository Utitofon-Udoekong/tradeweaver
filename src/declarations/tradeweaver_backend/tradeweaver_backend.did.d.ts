import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export type Asset = { 'BTC' : null } |
  { 'ETH' : null } |
  { 'ICP' : null };
export interface DCAStrategy {
  'id' : bigint,
  'active' : boolean,
  'owner' : Principal,
  'createdAt' : Time,
  'targetAsset' : Asset,
  'frequency' : Frequency,
  'nextExecution' : Time,
  'amount' : bigint,
}
export type Frequency = { 'Weekly' : null } |
  { 'Daily' : null } |
  { 'Monthly' : null } |
  { 'Biweekly' : null };
export interface Holding {
  'asset' : Asset,
  'averagePrice' : number,
  'costBasis' : number,
  'amount' : number,
}
export interface HttpHeader { 'value' : string, 'name' : string }
export interface HttpResponsePayload {
  'status' : bigint,
  'body' : Uint8Array | number[],
  'headers' : Array<HttpHeader>,
}
export interface PriceResponse {
  'asset' : Asset,
  'timestamp' : Time,
  'priceUSD' : number,
}
export interface ProfitLoss {
  'totalValue' : number,
  'totalCost' : number,
  'profitLoss' : number,
  'profitLossPercent' : number,
}
export interface Purchase {
  'id' : bigint,
  'asset' : Asset,
  'amountAsset' : number,
  'timestamp' : Time,
  'txHash' : string,
  'amountUSD' : bigint,
  'price' : number,
  'strategyId' : bigint,
}
export type Result = { 'ok' : Purchase } |
  { 'err' : string };
export type Result_1 = { 'ok' : DCAStrategy } |
  { 'err' : string };
export type Result_2 = { 'ok' : Array<Purchase> } |
  { 'err' : string };
export type Result_3 = { 'ok' : string } |
  { 'err' : string };
export type Result_4 = { 'ok' : UserAccount } |
  { 'err' : string };
export type Result_5 = { 'ok' : PriceResponse } |
  { 'err' : string };
export type Time = bigint;
export interface TransformArgs {
  'context' : Uint8Array | number[],
  'response' : HttpResponsePayload,
}
export interface UserAccount {
  'principal' : Principal,
  'balance' : bigint,
  'createdAt' : Time,
}
export interface _SERVICE {
  /**
   * / Check and execute all due strategies (called by timer or manually)
   */
  'checkAndExecuteStrategies' : ActorMethod<[], bigint>,
  /**
   * / Create a new user account
   */
  'createAccount' : ActorMethod<[], Result_4>,
  /**
   * / Create a new DCA strategy
   */
  'createStrategy' : ActorMethod<[Asset, bigint, Frequency], Result_1>,
  /**
   * / Fetch current price for an asset via HTTPS outcall
   */
  'fetchPrice' : ActorMethod<[Asset], Result_5>,
  /**
   * / Get user account info
   */
  'getAccount' : ActorMethod<[], Result_4>,
  /**
   * / Get prices for all assets
   */
  'getAllPrices' : ActorMethod<[], Array<[Asset, number]>>,
  /**
   * / Get all purchases for the caller
   */
  'getAllPurchases' : ActorMethod<[], Array<Purchase>>,
  /**
   * / Get user's Bitcoin address (derived from Schnorr public key)
   */
  'getBitcoinAddress' : ActorMethod<[], Result_3>,
  /**
   * / Get user's Ethereum address (derived from ECDSA public key)
   */
  'getEthereumAddress' : ActorMethod<[], Result_3>,
  /**
   * / Get portfolio holdings
   */
  'getPortfolio' : ActorMethod<[], Array<Holding>>,
  /**
   * / Calculate profit/loss
   */
  'getProfitLoss' : ActorMethod<[], ProfitLoss>,
  /**
   * / Get purchase history for a specific strategy
   */
  'getPurchaseHistory' : ActorMethod<[bigint], Result_2>,
  /**
   * / Get all strategies for the caller
   */
  'getStrategies' : ActorMethod<[], Array<DCAStrategy>>,
  /**
   * / Get a specific strategy
   */
  'getStrategy' : ActorMethod<[bigint], Result_1>,
  /**
   * / Get total number of strategies (for testing)
   */
  'getTotalStrategies' : ActorMethod<[], bigint>,
  /**
   * / Get total number of users (for testing)
   */
  'getTotalUsers' : ActorMethod<[], bigint>,
  /**
   * / Pause a DCA strategy
   */
  'pauseStrategy' : ActorMethod<[bigint], Result_1>,
  /**
   * / Resume a paused DCA strategy
   */
  'resumeStrategy' : ActorMethod<[bigint], Result_1>,
  'transform' : ActorMethod<[TransformArgs], HttpResponsePayload>,
  /**
   * / Manual trigger for testing a specific strategy
   */
  'triggerExecution' : ActorMethod<[bigint], Result>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
