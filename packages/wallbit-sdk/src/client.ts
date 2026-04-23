// Entry point del SDK. Expone recursos namespaced (client.balance.getChecking(),
// client.transactions.list(), etc.) para que la superficie pública sea
// explorable con autocompletado.

import { resolveConfig, type WallbitClientConfig } from './config.js';
import { HttpClient } from './http.js';
import { AccountDetailsResource } from './endpoints/accountDetails.js';
import { ApiKeyResource } from './endpoints/apiKey.js';
import { AssetsResource } from './endpoints/assets.js';
import { BalanceResource } from './endpoints/balance.js';
import { CardsResource } from './endpoints/cards.js';
import { FeesResource } from './endpoints/fees.js';
import { OperationsResource } from './endpoints/operations.js';
import { RatesResource } from './endpoints/rates.js';
import { RoboAdvisorResource } from './endpoints/roboadvisor.js';
import { TradesResource } from './endpoints/trades.js';
import { TransactionsResource } from './endpoints/transactions.js';
import { WalletsResource } from './endpoints/wallets.js';

export class WallbitClient {
  readonly balance: BalanceResource;
  readonly transactions: TransactionsResource;
  readonly trades: TradesResource;
  readonly operations: OperationsResource;
  readonly assets: AssetsResource;
  readonly wallets: WalletsResource;
  readonly accountDetails: AccountDetailsResource;
  readonly rates: RatesResource;
  readonly fees: FeesResource;
  readonly cards: CardsResource;
  readonly roboAdvisor: RoboAdvisorResource;
  readonly apiKey: ApiKeyResource;

  constructor(config: WallbitClientConfig) {
    const resolved = resolveConfig(config);
    const http = new HttpClient(resolved);
    this.balance = new BalanceResource(http);
    this.transactions = new TransactionsResource(http);
    this.trades = new TradesResource(http);
    this.operations = new OperationsResource(http);
    this.assets = new AssetsResource(http);
    this.wallets = new WalletsResource(http);
    this.accountDetails = new AccountDetailsResource(http);
    this.rates = new RatesResource(http);
    this.fees = new FeesResource(http);
    this.cards = new CardsResource(http);
    this.roboAdvisor = new RoboAdvisorResource(http);
    this.apiKey = new ApiKeyResource(http);
  }
}
