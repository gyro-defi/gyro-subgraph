import { BigInt } from "@graphprotocol/graph-ts";
import {
  Referral,
  LogClaim,
  LogDepositRewards,
  LogNewReferral,
} from "../generated/Referral/Referral";
import { Referral } from "../generated/schema";

export function handleLogClaim(event: LogClaim): void {
  let referral = Referral.load(event.params.recipient.toHex());

  if (referral == null) {
    referral = new Referral(event.params.recipient.toHex());

    // Entity fields can be set using simple assignments
    referral.rewards = BigInt.fromI32(0);
  }

  // Entity fields can be set based on event parameters
  referral.account = event.params.recipient;
  if (referral.rewards >= event.params.amount) {
    referral.rewards -= event.params.amount;
  }

  // Entities can be written to the store with `.save()`
  referral.save();
}

export function handleLogDepositRewards(event: LogDepositRewards): void {
  let referral = Referral.load(event.params.recipient.toHex());

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (referral == null) {
    referral = new Referral(event.params.recipient.toHex());

    // Entity fields can be set using simple assignments
    referral.rewards = BigInt.fromI32(0);
  }

  // Entity fields can be set based on event parameters
  referral.account = event.params.recipient;
  referral.rewards += event.params.amount;

  // Entities can be written to the store with `.save()`
  referral.save();
}

export function handleLogNewReferral(event: LogNewReferral): void {
  let referral = new Referral(event.params.account.toHex());

  // Entity fields can be set based on event parameters
  referral.account = event.params.account;
  referral.code = event.params.code.toHex();
  referral.rewards = BigInt.fromI32(0);

  // Entities can be written to the store with `.save()`
  referral.save();
}
