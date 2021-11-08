import { Address } from "@graphprotocol/graph-ts";

import { LogStake, LogRedeem } from "../generated/GyroVault/GyroVault";
import { Stake, Unstake } from "../generated/schema";

import { loadOrCreateUser, updateUserBalance } from "./utils/User";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { toDecimal } from "./utils/Decimals";
import { updateProtocolMetrics } from "./utils/ProtocolMetrics";

export function handleStake(event: LogStake): void {
  let user = loadOrCreateUser(event.params.depositer as Address);
  let transaction = loadOrCreateTransaction(event.transaction, event.block);
  let value = toDecimal(event.params.amount, 9);

  let stake = new Stake(transaction.id);
  stake.transaction = transaction.id;
  stake.user = user.id;
  stake.amount = value;
  stake.timestamp = transaction.timestamp;
  stake.save();

  updateUserBalance(user, transaction);
  updateProtocolMetrics(transaction);
}

export function handleRedeem(event: LogRedeem): void {
  let user = loadOrCreateUser(event.params.recipient as Address);
  let transaction = loadOrCreateTransaction(event.transaction, event.block);
  let value = toDecimal(event.params.amount, 9);

  let unstake = new Unstake(transaction.id);
  unstake.transaction = transaction.id;
  unstake.user = user.id;
  unstake.amount = value;
  unstake.timestamp = transaction.timestamp;
  unstake.save();

  updateUserBalance(user, transaction);
  updateProtocolMetrics(transaction);
}
