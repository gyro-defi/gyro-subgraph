import { DepositCall, RedeemCall } from "../generated/GyroVault/GyroBond";
import { Deposit, Redemption } from "../generated/schema";
import { loadOrCreateTransaction } from "./utils/Transactions";
import { loadOrCreateUser, updateUserBalance } from "./utils/User";
import { toDecimal } from "./utils/Decimals";
import { GYROBUSD_LPBOND_NAME, PCS_GYROBUSD_PAIR } from "./utils/Constants";
import { loadOrCreateToken } from "./utils/Tokens";
import { createDailyBondRecord } from "./utils/DailyBond";
import { getPairUSD } from "./utils/Price";

export function handleBondDeposit(call: DepositCall): void {
  let user = loadOrCreateUser(call.inputs.depositor_);
  let transaction = loadOrCreateTransaction(call.transaction, call.block);
  let token = loadOrCreateToken(GYROBUSD_LPBOND_NAME);

  let amount = toDecimal(call.inputs.amount_, 18);
  let deposit = new Deposit(transaction.id);
  deposit.transaction = transaction.id;
  deposit.user = user.id;
  deposit.amount = amount;
  deposit.value = getPairUSD(call.inputs.amount_, PCS_GYROBUSD_PAIR);
  deposit.maxPremium = toDecimal(call.inputs.maxPrice_);
  deposit.token = token.id;
  deposit.timestamp = transaction.timestamp;
  deposit.save();

  createDailyBondRecord(
    deposit.timestamp,
    token,
    deposit.amount,
    deposit.value
  );
  updateUserBalance(user, transaction);
}

export function handleBondRedeem(call: RedeemCall): void {
  let user = loadOrCreateUser(call.transaction.from);
  let transaction = loadOrCreateTransaction(call.transaction, call.block);

  let redemption = Redemption.load(transaction.id);
  if (redemption == null) {
    redemption = new Redemption(transaction.id);
  }
  redemption.transaction = transaction.id;
  redemption.user = user.id;
  redemption.token = loadOrCreateToken(GYROBUSD_LPBOND_NAME).id;
  redemption.timestamp = transaction.timestamp;
  redemption.save();
  updateUserBalance(user, transaction);
}
