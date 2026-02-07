#!/usr/bin/env bash
set -euo pipefail

NETWORK=${NETWORK:-local}
RPC_LOCAL=${RPC_URL:-http://127.0.0.1:8545}
RPC_C2=${RPC_URL:-https://coston2-api.flare.network/ext/C/rpc}

if [ "$NETWORK" = "local" ]; then
  FUNDER_PK=${FUNDER_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
  DEMO_WALLET_A_PK=${DEMO_WALLET_A_PK:-0x59c6995e998f97a5a0044966f0945382d3b9d5f4b9a9f0b0f2d4b2d48f6f6b6b}
  DEMO_WALLET_B_PK=${DEMO_WALLET_B_PK:-0x8b3a350cf5c34c9194ca4c8c3f7c51c21545b78f0c9d7f89a2b5bd6f6d7c8a3e}

  WALLET_A=$(cast wallet address --private-key "$DEMO_WALLET_A_PK")
  WALLET_B=$(cast wallet address --private-key "$DEMO_WALLET_B_PK")

  echo "Seeding local wallets via $RPC_LOCAL"
  cast send --rpc-url "$RPC_LOCAL" --private-key "$FUNDER_PK" "$WALLET_A" --value 5ether >/dev/null
  cast send --rpc-url "$RPC_LOCAL" --private-key "$FUNDER_PK" "$WALLET_B" --value 5ether >/dev/null

  BAL_A=$(cast balance --rpc-url "$RPC_LOCAL" --wei "$WALLET_A")
  BAL_B=$(cast balance --rpc-url "$RPC_LOCAL" --wei "$WALLET_B")

  echo "Demo Wallet A: $WALLET_A"
  echo "  Balance: $BAL_A wei"
  echo "Demo Wallet B: $WALLET_B"
  echo "  Balance: $BAL_B wei"
  exit 0
fi

if [ "$NETWORK" = "coston2" ]; then
  if [ -z "${DEMO_WALLET_A:-}" ] || [ -z "${DEMO_WALLET_B:-}" ]; then
    echo "Set DEMO_WALLET_A and DEMO_WALLET_B for coston2" >&2
    exit 1
  fi

  echo "Checking Costón2 balances via $RPC_C2"
  BAL_A=$(cast balance --rpc-url "$RPC_C2" --wei "$DEMO_WALLET_A")
  BAL_B=$(cast balance --rpc-url "$RPC_C2" --wei "$DEMO_WALLET_B")

  THRESHOLD_WEI=1000000000000000000
  LOW=0

  if [ "$BAL_A" -lt "$THRESHOLD_WEI" ]; then
    LOW=1
  fi
  if [ "$BAL_B" -lt "$THRESHOLD_WEI" ]; then
    LOW=1
  fi

  echo "Demo Wallet A: $DEMO_WALLET_A"
  echo "  Balance: $BAL_A wei"
  echo "Demo Wallet B: $DEMO_WALLET_B"
  echo "  Balance: $BAL_B wei"

  if [ "$LOW" -eq 1 ]; then
    echo "One or more wallets are low on C2FLR. Use faucet: https://faucet.flare.network/coston2"
    exit 2
  fi

  exit 0
fi

echo "Unknown NETWORK: $NETWORK" >&2
exit 1
