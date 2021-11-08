import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { GyroBond } from "../../generated/GyroVault/GyroBond";
import { BondDiscount, Transaction } from "../../generated/schema";

import {
  BUSDBOND_CONTRACT,
  BUSDBOND_CONTRACT_BLOCK,
  GYROUSDT_PCSBOND_CONTRACT,
  GYROUSDT_PCSBOND_CONTRACT_BLOCK,
  GYROBUSD_PCSBOND_CONTRACT,
  GYROBUSD_PCSBOND_CONTRACT_BLOCK,
} from "./Constants";
import { hourFromTimestamp } from "./Dates";
import { toDecimal } from "./Decimals";
import { getGyroUSDRate } from "./Price";

export function loadOrCreateBondDiscount(timestamp: BigInt): BondDiscount {
  let hourTimestamp = hourFromTimestamp(timestamp);

  let bondDiscount = BondDiscount.load(hourTimestamp);
  if (bondDiscount == null) {
    bondDiscount = new BondDiscount(hourTimestamp);
    bondDiscount.timestamp = timestamp;
    bondDiscount.usdt_discount = BigDecimal.fromString("0");
    bondDiscount.gyrousdt_discount = BigDecimal.fromString("0");
    bondDiscount.busd_discount = BigDecimal.fromString("0");
    bondDiscount.gyrobusd_discount = BigDecimal.fromString("0");
    bondDiscount.save();
  }
  return bondDiscount as BondDiscount;
}

export function updateBondDiscounts(transaction: Transaction): void {
  let bd = loadOrCreateBondDiscount(transaction.timestamp);
  let gyroRate = getGyroUSDRate();

  //GYRO-USDT

  if (
    transaction.blockNumber.gt(
      BigInt.fromString(GYROUSDT_PCSBOND_CONTRACT_BLOCK)
    )
  ) {
    let bond = GyroBond.bind(Address.fromString(GYROUSDT_PCSBOND_CONTRACT));
    let price_call = bond.try_bondPriceInUSD();
    if (
      price_call.reverted === false &&
      price_call.value.gt(BigInt.fromI32(0))
    ) {
      bd.gyrousdt_discount = gyroRate.div(toDecimal(price_call.value, 18));
      bd.gyrousdt_discount = bd.gyrousdt_discount.minus(
        BigDecimal.fromString("1")
      );
      bd.gyrousdt_discount = bd.gyrousdt_discount.times(
        BigDecimal.fromString("100")
      );
      log.debug(
        "GYRO-USDT Discount GYRO price {}  Bond Price {}  Discount {}",
        [
          gyroRate.toString(),
          price_call.value.toString(),
          bd.gyrobusd_discount.toString(),
        ]
      );
    }
  }

  //GYRO-BUSD

  if (
    transaction.blockNumber.gt(
      BigInt.fromString(GYROBUSD_PCSBOND_CONTRACT_BLOCK)
    )
  ) {
    let bond = GyroBond.bind(Address.fromString(GYROBUSD_PCSBOND_CONTRACT));
    let price_call = bond.try_bondPriceInUSD();
    if (
      price_call.reverted === false &&
      price_call.value.gt(BigInt.fromI32(0))
    ) {
      bd.gyrobusd_discount = gyroRate.div(toDecimal(price_call.value, 18));
      bd.gyrobusd_discount = bd.gyrobusd_discount.minus(
        BigDecimal.fromString("1")
      );
      bd.gyrobusd_discount = bd.gyrobusd_discount.times(
        BigDecimal.fromString("100")
      );
      log.debug(
        "GYRO-BUSD Discount GYRO price {}  Bond Price {}  Discount {}",
        [
          gyroRate.toString(),
          price_call.value.toString(),
          bd.gyrobusd_discount.toString(),
        ]
      );
    }
  }

  //BUSD
  if (transaction.blockNumber.gt(BigInt.fromString(BUSDBOND_CONTRACT_BLOCK))) {
    let bond = GyroBond.bind(Address.fromString(BUSDBOND_CONTRACT));
    let price_call = bond.try_bondPriceInUSD();
    if (
      price_call.reverted === false &&
      price_call.value.gt(BigInt.fromI32(0))
    ) {
      bd.busd_discount = gyroRate.div(toDecimal(price_call.value, 18));
      bd.busd_discount = bd.busd_discount.minus(BigDecimal.fromString("1"));
      bd.busd_discount = bd.busd_discount.times(BigDecimal.fromString("100"));
      log.debug("BUSD Discount GYRO price {}  Bond Price {}  Discount {}", [
        gyroRate.toString(),
        price_call.value.toString(),
        bd.gyrobusd_discount.toString(),
      ]);
    }
  }

  bd.save();
}
