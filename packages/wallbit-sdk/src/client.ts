// Entry point del SDK. La clase expone los recursos como propiedades namespaced
// (client.balance.getChecking(), client.transactions.list(), etc.) para que la
// superficie pública sea explorable con autocompletado.

import { resolveConfig, type WallbitClientConfig } from './config.js';
import { HttpClient } from './http.js';
import { AccountResource } from './endpoints/account.js';
import { AssetsResource } from './endpoints/assets.js';
import { BalanceResource } from './endpoints/balance.js';
import { OperationsResource } from './endpoints/operations.js';
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
  readonly account: AccountResource;

  constructor(config: WallbitClientConfig) {
    const resolved = resolveConfig(config);
    const http = new HttpClient(resolved);
    this.balance = new BalanceResource(http);
    this.transactions = new TransactionsResource(http);
    this.trades = new TradesResource(http);
    this.operations = new OperationsResource(http);
    this.assets = new AssetsResource(http);
    this.wallets = new WalletsResource(http);
    this.account = new AccountResource(http);
  }
}
