import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { User, Transaction } from "../../generated/schema";
import { GyroERC20 } from "../../generated/GyroVault/GyroERC20";
import { sGyroERC20 } from "../../generated/GyroVault/sGyroERC20";
import { GyroBond } from "../../generated/GyroVault/GyroBond";

import {
  BUSDBOND_CONTRACT,
  BUSDBOND_CONTRACT_BLOCK,
  GYROUSDT_PCSBOND_CONTRACT,
  GYROUSDT_PCSBOND_CONTRACT_BLOCK,
  GYROBUSD_PCSBOND_CONTRACT,
  GYROBUSD_PCSBOND_CONTRACT_BLOCK,
  GYRO_ERC20_CONTRACT,
  SGYRO_ERC20_CONTRACT,
} from "./Constants";
import { loadOrCreateUserBalance } from "./UserBalance";
import { toDecimal } from "./Decimals";
import { getGyroUSDRate } from "./Price";
import { loadOrCreateContractInfo } from "./ContractInfo";
import { getHolderAux } from "./Aux";

export function loadOrCreateUser(addres: Address): User {
  let user = User.load(addres.toHex());
  if (user == null) {
    let holders = getHolderAux();
    holders.value = holders.value.plus(BigInt.fromI32(1));
    holders.save();

    user = new User(addres.toHex());
    user.active = true;
    user.save();
  }
  return user as User;
}

export function updateUserBalance(user: User, transaction: Transaction): void {
  let balance = loadOrCreateUserBalance(user, transaction.timestamp);

  let gyro_contract = GyroERC20.bind(Address.fromString(GYRO_ERC20_CONTRACT));
  let sgyro_contract = sGyroERC20.bind(
    Address.fromString(SGYRO_ERC20_CONTRACT)
  );
  balance.gyroBalance = toDecimal(
    gyro_contract.balanceOf(Address.fromString(user.id)),
    9
  );
  let sgyroBalance = toDecimal(
    sgyro_contract.balanceOf(Address.fromString(user.id)),
    9
  );
  balance.gyroBalance = sgyroBalance;

  let stakes = balance.stakes;

  let cinfoSgyroBalance = loadOrCreateContractInfo(
    user.id + transaction.timestamp.toString() + "sGyroERC20"
  );
  cinfoSgyroBalance.name = "sGYRO";
  cinfoSgyroBalance.contract = SGYRO_ERC20_CONTRACT;
  cinfoSgyroBalance.amount = sgyroBalance;
  cinfoSgyroBalance.save();
  stakes.push(cinfoSgyroBalance.id);

  balance.stakes = stakes;

  if (
    user.active &&
    balance.gyroBalance.lt(BigDecimal.fromString("0.01")) &&
    balance.gyroBalance.lt(BigDecimal.fromString("0.01"))
  ) {
    let holders = getHolderAux();
    holders.value = holders.value.minus(BigInt.fromI32(1));
    holders.save();
    user.active = false;
  } else if (
    user.active == false &&
    (balance.gyroBalance.gt(BigDecimal.fromString("0.01")) ||
      balance.gyroBalance.gt(BigDecimal.fromString("0.01")))
  ) {
    let holders = getHolderAux();
    holders.value = holders.value.plus(BigInt.fromI32(1));
    holders.save();
    user.active = true;
  }

  //GYRO-USDT
  let bonds = balance.bonds;

  if (
    transaction.blockNumber.gt(
      BigInt.fromString(GYROUSDT_PCSBOND_CONTRACT_BLOCK)
    )
  ) {
    let gyroUsdtBond_contract = GyroBond.bind(
      Address.fromString(GYROUSDT_PCSBOND_CONTRACT)
    );
    let pending = gyroUsdtBond_contract.bondInfo(Address.fromString(user.id));
    if (pending.value1.gt(BigInt.fromString("0"))) {
      let pending_bond = toDecimal(pending.value1, 9);
      balance.bondBalance = balance.bondBalance.plus(pending_bond);

      let binfo = loadOrCreateContractInfo(
        user.id + transaction.timestamp.toString() + "GyroBond"
      );
      binfo.name = "GYRO-USDT";
      binfo.contract = GYROUSDT_PCSBOND_CONTRACT;
      binfo.amount = pending_bond;
      binfo.save();
      bonds.push(binfo.id);

      log.debug("User {} pending GYRO-USDT {} on tx {}", [
        user.id,
        toDecimal(pending.value1, 9).toString(),
        transaction.id,
      ]);
    }
  }

  //USDT

  //   if (transaction.blockNumber.gt(BigInt.fromString(DAIBOND_CONTRACTS3_BLOCK))) {
  //     let bondDai_contract = DAIBondV3.bind(
  //       Address.fromString(DAIBOND_CONTRACTS3)
  //     );
  //     let pending = bondDai_contract.bondInfo(Address.fromString(user.id));
  //     if (pending.value1.gt(BigInt.fromString("0"))) {
  //       let pending_bond = toDecimal(pending.value1, 9);
  //       balance.bondBalance = balance.bondBalance.plus(pending_bond);

  //       let binfo = loadOrCreateContractInfo(
  //         user.id + transaction.timestamp.toString() + "DAIBondV3"
  //       );
  //       binfo.name = "USDT";
  //       binfo.contract = DAIBOND_CONTRACTS3;
  //       binfo.amount = pending_bond;
  //       binfo.save();
  //       bonds.push(binfo.id);

  //       log.debug("User {} pending USDT {} on tx {}", [
  //         user.id,
  //         toDecimal(pending.value1, 9).toString(),
  //         transaction.id,
  //       ]);
  //     }
  //   }

  // GYRO-BUSD

  if (
    transaction.blockNumber.gt(
      BigInt.fromString(GYROBUSD_PCSBOND_CONTRACT_BLOCK)
    )
  ) {
    let gyroBusdBond_contract = GyroBond.bind(
      Address.fromString(GYROBUSD_PCSBOND_CONTRACT)
    );
    let pending = gyroBusdBond_contract.bondInfo(Address.fromString(user.id));
    if (pending.value1.gt(BigInt.fromString("0"))) {
      let pending_bond = toDecimal(pending.value1, 9);
      balance.bondBalance = balance.bondBalance.plus(pending_bond);

      let binfo = loadOrCreateContractInfo(
        user.id + transaction.timestamp.toString() + "GyroBond"
      );
      binfo.name = "GYRO-BUSD";
      binfo.contract = GYROBUSD_PCSBOND_CONTRACT;
      binfo.amount = pending_bond;
      binfo.save();
      bonds.push(binfo.id);

      log.debug("User {} pending GYRO-BUSD {} on tx {}", [
        user.id,
        toDecimal(pending.value1, 9).toString(),
        transaction.id,
      ]);
    }
  }

  // BUSD
  if (transaction.blockNumber.gt(BigInt.fromString(BUSDBOND_CONTRACT_BLOCK))) {
    let busdBond_contract = GyroBond.bind(
      Address.fromString(BUSDBOND_CONTRACT)
    );
    let pending = busdBond_contract.bondInfo(Address.fromString(user.id));
    if (pending.value1.gt(BigInt.fromString("0"))) {
      let pending_bond = toDecimal(pending.value1, 9);
      balance.bondBalance = balance.bondBalance.plus(pending_bond);

      let binfo = loadOrCreateContractInfo(
        user.id + transaction.timestamp.toString() + "GyroBond"
      );
      binfo.name = "BUSD";
      binfo.contract = BUSDBOND_CONTRACT;
      binfo.amount = pending_bond;
      binfo.save();
      bonds.push(binfo.id);

      log.debug("User {} pending BUSD {} on tx {}", [
        user.id,
        toDecimal(pending.value1, 9).toString(),
        transaction.id,
      ]);
    }
  }

  balance.bonds = bonds;

  //Price
  let usdRate = getGyroUSDRate();
  balance.dollarBalance = balance.gyroBalance
    .times(usdRate)
    .plus(balance.gyroBalance.times(usdRate))
    .plus(balance.bondBalance.times(usdRate));
  balance.save();

  user.lastBalance = balance.id;
  user.save();
}
