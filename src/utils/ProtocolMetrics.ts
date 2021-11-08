import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { ERC20 } from "../../generated/GyroVault/ERC20";
import { UniswapV2Pair } from "../../generated/GyroVault/UniswapV2Pair";
import { GyroERC20 } from "../../generated/GyroVault/GyroERC20";
import { sGyroERC20 } from "../../generated/GyroVault/sGyroERC20";
import { GyroVault } from "../../generated/GyroVault/GyroVault";
import { ProtocolMetric, Transaction } from "../../generated/schema";

import {
  ERC20USDT_CONTRACT,
  ERC20BUSD_CONTRACT,
  PCS_GYROUSDT_PAIR,
  PCS_GYROBUSD_PAIR,
  PCS_GYROBUSD_PAIR_BLOCK,
  GYRO_ERC20_CONTRACT,
  SGYRO_ERC20_CONTRACT,
  GYRO_VAULT_CONTRACT,
  TREASURY_ADDRESS,
} from "./Constants";
import { dayFromTimestamp } from "./Dates";
import { toDecimal } from "./Decimals";
import { getGyroUSDRate, getDiscountedPairUSD, getPairUSD } from "./Price";
import { getHolderAux } from "./Aux";
import { updateBondDiscounts } from "./BondDiscounts";

function getMV_RFV(transaction: Transaction): BigDecimal[] {
  let usdtERC20 = ERC20.bind(Address.fromString(ERC20USDT_CONTRACT));
  let busdERC20 = ERC20.bind(Address.fromString(ERC20BUSD_CONTRACT));

  let gyroUsdtPair = UniswapV2Pair.bind(Address.fromString(PCS_GYROUSDT_PAIR));
  let gyroBusdPair = UniswapV2Pair.bind(Address.fromString(PCS_GYROBUSD_PAIR));

  let treasury_address = TREASURY_ADDRESS;

  let usdtBalance = usdtERC20.balanceOf(Address.fromString(treasury_address));
  let busdBalance = busdERC20.balanceOf(Address.fromString(treasury_address));

  //GYRO_USDT
  let gyroUsdtBalance = gyroUsdtPair.balanceOf(
    Address.fromString(treasury_address)
  );

  let gyroUsdtTotalLP = toDecimal(gyroUsdtPair.totalSupply(), 18);
  let gyroUsdtPOL = toDecimal(gyroUsdtBalance, 18)
    .div(gyroUsdtTotalLP)
    .times(BigDecimal.fromString("100"));
  let gyroUsdt_value = getPairUSD(gyroUsdtBalance, PCS_GYROUSDT_PAIR);
  let gyroUsdt_rfv = getDiscountedPairUSD(gyroUsdtBalance, PCS_GYROUSDT_PAIR);

  //GYRO_BUSD
  let gyroBusdBalance = BigInt.fromI32(0);
  let gyroBusd_value = BigDecimal.fromString("0");
  let gyroBusd_rfv = BigDecimal.fromString("0");
  let gyroBusdTotalLP = BigDecimal.fromString("0");
  let gyroBusdPOL = BigDecimal.fromString("0");
  if (transaction.blockNumber.gt(BigInt.fromString(PCS_GYROBUSD_PAIR_BLOCK))) {
    gyroBusdBalance = gyroBusdPair.balanceOf(
      Address.fromString(treasury_address)
    );
    gyroBusd_value = getPairUSD(gyroBusdBalance, PCS_GYROBUSD_PAIR);
    gyroBusd_rfv = getDiscountedPairUSD(gyroBusdBalance, PCS_GYROBUSD_PAIR);
    gyroBusdTotalLP = toDecimal(gyroBusdPair.totalSupply(), 18);
    if (
      gyroBusdTotalLP.gt(BigDecimal.fromString("0")) &&
      gyroBusdBalance.gt(BigInt.fromI32(0))
    ) {
      gyroBusdPOL = toDecimal(gyroBusdBalance, 18)
        .div(gyroBusdTotalLP)
        .times(BigDecimal.fromString("100"));
    }
  }

  let stableValue = usdtBalance.plus(busdBalance);
  let stableValueDecimal = toDecimal(stableValue, 18);

  let lpValue = gyroUsdt_value.plus(gyroBusd_value);
  let rfvLpValue = gyroUsdt_rfv.plus(gyroBusd_rfv);

  let mv = stableValueDecimal.plus(lpValue);
  let rfv = stableValueDecimal.plus(rfvLpValue);

  log.debug("Treasury Market Value {}", [mv.toString()]);
  log.debug("Treasury RFV {}", [rfv.toString()]);
  log.debug("Treasury USDT value {}", [toDecimal(usdtBalance, 18).toString()]);
  log.debug("Treasury GYRO-USDT RFV {}", [gyroUsdt_rfv.toString()]);
  log.debug("Treasury BUSDT value {}", [toDecimal(busdBalance, 18).toString()]);
  log.debug("Treasury GYRO-BUSD RFV {}", [gyroBusd_rfv.toString()]);

  return [
    mv,
    rfv,
    // treasuryUsdtRiskFreeValue = USDT RFV * USDT
    gyroUsdt_rfv.plus(toDecimal(usdtBalance, 18)),
    // treasuryBusdRiskFreeValue = BUSD RFV * BUSD
    gyroBusd_rfv.plus(toDecimal(busdBalance, 18)),
    // treasuryUsdtMarketValue = USDT LP * USDT
    gyroUsdt_value.plus(toDecimal(usdtBalance, 18)),
    // treasuryBusdMarketValue = BUSD LP * BUSD
    gyroBusd_value.plus(toDecimal(busdBalance, 18)),
    // POL
    gyroUsdtPOL,
    gyroBusdPOL,
  ];
}

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric {
  let dayTimestamp = dayFromTimestamp(timestamp);

  let protocolMetric = ProtocolMetric.load(dayTimestamp);
  if (protocolMetric == null) {
    protocolMetric = new ProtocolMetric(dayTimestamp);
    protocolMetric.timestamp = timestamp;
    protocolMetric.gyroCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.sGyroCirculatingSupply = BigDecimal.fromString("0");
    protocolMetric.totalSupply = BigDecimal.fromString("0");
    protocolMetric.gyroPrice = BigDecimal.fromString("0");
    protocolMetric.marketCap = BigDecimal.fromString("0");
    protocolMetric.totalValueLocked = BigDecimal.fromString("0");
    protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryMarketValue = BigDecimal.fromString("0");
    protocolMetric.nextEpochRebase = BigDecimal.fromString("0");
    protocolMetric.nextRebaseRewards = BigDecimal.fromString("0");
    protocolMetric.currentAPY = BigDecimal.fromString("0");
    protocolMetric.treasuryUsdtRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryBusdRiskFreeValue = BigDecimal.fromString("0");
    protocolMetric.treasuryUsdtMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryBusdMarketValue = BigDecimal.fromString("0");
    protocolMetric.treasuryGyroUsdtPOL = BigDecimal.fromString("0");
    protocolMetric.treasuryGyroBusdPOL = BigDecimal.fromString("0");
    protocolMetric.holders = BigInt.fromI32(0);

    protocolMetric.save();
  }
  return protocolMetric as ProtocolMetric;
}

function getTotalSupply(): BigDecimal {
  let gyro_contract = GyroERC20.bind(Address.fromString(GYRO_ERC20_CONTRACT));
  let total_supply = toDecimal(gyro_contract.totalSupply(), 9);
  log.debug("Total Supply {}", [total_supply.toString()]);
  return total_supply;
}

function getCriculatingSupply(): BigDecimal {
  let gyro_contract = GyroERC20.bind(Address.fromString(GYRO_ERC20_CONTRACT));
  let circ_supply = toDecimal(gyro_contract.circulatingSupply(), 9);
  log.debug("Circulating Supply {}", [circ_supply.toString()]);
  return circ_supply;
}

function getSGyroSupply(): BigDecimal {
  let sGyro_supply = BigDecimal.fromString("0");

  let sGyro_contract = sGyroERC20.bind(
    Address.fromString(SGYRO_ERC20_CONTRACT)
  );
  sGyro_supply = toDecimal(sGyro_contract.circulatingSupply(), 9);

  log.debug("sGyro Supply {}", [sGyro_supply.toString()]);
  return sGyro_supply;
}

function getNextRebase(): BigDecimal {
  let next_rebase = BigDecimal.fromString("0");

  let gyro_vault = GyroVault.bind(Address.fromString(GYRO_VAULT_CONTRACT));

  next_rebase = toDecimal(gyro_vault.epoch().value3, 9);
  log.debug("next_rebase {}", [next_rebase.toString()]);

  return next_rebase;
}

function getAPY_Rebase(
  sGyro: BigDecimal,
  rebaseRewards: BigDecimal
): BigDecimal[] {
  let nextEpochRebase = rebaseRewards
    .div(sGyro)
    .times(BigDecimal.fromString("100"));

  let nextEpochRebase_number = Number.parseFloat(nextEpochRebase.toString());
  let currentAPY =
    Math.pow(nextEpochRebase_number / 100 + 1, 365 * 3 - 1) * 100;

  let currentAPYdecimal = BigDecimal.fromString(currentAPY.toString());

  log.debug("next_rebase {}", [nextEpochRebase.toString()]);
  log.debug("current_apy total {}", [currentAPYdecimal.toString()]);

  return [currentAPYdecimal, nextEpochRebase];
}

function getRunway(
  sGyro: BigDecimal,
  rfv: BigDecimal,
  rebase: BigDecimal
): BigDecimal[] {
  let runway2dot5k = BigDecimal.fromString("0");
  let runway5k = BigDecimal.fromString("0");
  let runway7dot5k = BigDecimal.fromString("0");
  let runway10k = BigDecimal.fromString("0");
  let runway20k = BigDecimal.fromString("0");
  let runway50k = BigDecimal.fromString("0");
  let runway70k = BigDecimal.fromString("0");
  let runway100k = BigDecimal.fromString("0");
  let runwayCurrent = BigDecimal.fromString("0");

  if (
    sGyro.gt(BigDecimal.fromString("0")) &&
    rfv.gt(BigDecimal.fromString("0")) &&
    rebase.gt(BigDecimal.fromString("0"))
  ) {
    let treasury_runway = Number.parseFloat(rfv.div(sGyro).toString());

    let runway2dot5k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.0029438) / 3;
    let runway5k_num = Math.log(treasury_runway) / Math.log(1 + 0.003579) / 3;
    let runway7dot5k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.0039507) / 3;
    let runway10k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00421449) / 3;
    let runway20k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00485037) / 3;
    let runway50k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00569158) / 3;
    let runway70k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00600065) / 3;
    let runway100k_num =
      Math.log(treasury_runway) / Math.log(1 + 0.00632839) / 3;
    let nextEpochRebase_number = Number.parseFloat(rebase.toString()) / 100;
    let runwayCurrent_num =
      Math.log(treasury_runway) / Math.log(1 + nextEpochRebase_number) / 3;

    runway2dot5k = BigDecimal.fromString(runway2dot5k_num.toString());
    runway5k = BigDecimal.fromString(runway5k_num.toString());
    runway7dot5k = BigDecimal.fromString(runway7dot5k_num.toString());
    runway10k = BigDecimal.fromString(runway10k_num.toString());
    runway20k = BigDecimal.fromString(runway20k_num.toString());
    runway50k = BigDecimal.fromString(runway50k_num.toString());
    runway70k = BigDecimal.fromString(runway70k_num.toString());
    runway100k = BigDecimal.fromString(runway100k_num.toString());
    runwayCurrent = BigDecimal.fromString(runwayCurrent_num.toString());
  }

  return [
    runway2dot5k,
    runway5k,
    runway7dot5k,
    runway10k,
    runway20k,
    runway50k,
    runway70k,
    runway100k,
    runwayCurrent,
  ];
}

export function updateProtocolMetrics(transaction: Transaction): void {
  let pm = loadOrCreateProtocolMetric(transaction.timestamp);

  //Total Supply
  pm.totalSupply = getTotalSupply();

  //Circ Supply
  pm.gyroCirculatingSupply = getCriculatingSupply();

  //sGyro Supply
  pm.sGyroCirculatingSupply = getSGyroSupply();

  //Gyro Price
  pm.gyroPrice = getGyroUSDRate();

  //Gyro Market Cap
  pm.marketCap = pm.gyroCirculatingSupply.times(pm.gyroPrice);

  //Total Value Locked
  pm.totalValueLocked = pm.sGyroCirculatingSupply.times(pm.gyroPrice);

  //Treasury RFV and MV
  let mv_rfv = getMV_RFV(transaction);
  pm.treasuryMarketValue = mv_rfv[0];
  pm.treasuryRiskFreeValue = mv_rfv[1];
  pm.treasuryUsdtRiskFreeValue = mv_rfv[2];
  pm.treasuryBusdRiskFreeValue = mv_rfv[3];
  pm.treasuryUsdtMarketValue = mv_rfv[4];
  pm.treasuryBusdMarketValue = mv_rfv[5];
  pm.treasuryGyroUsdtPOL = mv_rfv[6];
  pm.treasuryGyroBusdPOL = mv_rfv[7];

  // Rebase rewards, APY, rebase
  pm.nextRebaseRewards = getNextRebase();
  let apy_rebase = getAPY_Rebase(
    pm.sGyroCirculatingSupply,
    pm.nextRebaseRewards
  );
  pm.currentAPY = apy_rebase[0];
  pm.nextEpochRebase = apy_rebase[1];

  //Runway
  let runways = getRunway(
    pm.sGyroCirculatingSupply,
    pm.treasuryRiskFreeValue,
    pm.nextEpochRebase
  );
  pm.runway2dot5k = runways[0];
  pm.runway5k = runways[1];
  pm.runway7dot5k = runways[2];
  pm.runway10k = runways[3];
  pm.runway20k = runways[4];
  pm.runway50k = runways[5];
  pm.runway70k = runways[6];
  pm.runway100k = runways[7];
  pm.runwayCurrent = runways[8];

  //Holders
  pm.holders = getHolderAux().value;

  pm.save();

  updateBondDiscounts(transaction);
}
