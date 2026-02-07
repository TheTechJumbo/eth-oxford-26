# SkillStake Monorepo (Hackathon Minimal)

A minimal scaffold for a 1v1 Apex Legends staking dApp with:
- Foundry smart contracts
- Node.js referee service
- Next.js frontend

## Folder tree (changed/added)

```
contracts/
  foundry.toml
  src/
    MockToken.sol
    SkillStake.sol
  script/
    Deploy.s.sol
  test/
    SkillStake.t.sol
deployments/
  latest.json
referee/
  package.json
  tsconfig.json
  .env.example
  src/
    index.ts
frontend/
  package.json
  next.config.js
  tsconfig.json
  postcss.config.js
  tailwind.config.ts
  next-env.d.ts
  .env.example
  src/
    app/
      globals.css
      layout.tsx
      page.tsx
    components/
      Providers.tsx
    lib/
      abi.ts
scripts/
  seed.sh
Makefile
dev
```

## One-click dev

### Local (anvil)

```bash
export PRIVATE_KEY=<ANVIL_PRIVATE_KEY>
export REFEREE_PRIVATE_KEY=<REFEREE_PRIVATE_KEY>
NETWORK=local ./dev
```

### Flare Costón2

```bash
export PRIVATE_KEY=<DEPLOYER_PRIVATE_KEY>
export REFEREE_PRIVATE_KEY=<REFEREE_PRIVATE_KEY>
NETWORK=coston2 ./dev
```

The script writes `deployments/latest.json`, then copies config into:
- `referee/.env`
- `frontend/.env.local`

It also runs `scripts/seed.sh` to fund local demo wallets or check Costón2 balances.

## Contracts

### Deploy manually

```bash
cd contracts
export PRIVATE_KEY=<DEPLOYER_PRIVATE_KEY>
export REFEREE_ADDRESS=<REFEREE_EOA>
export NETWORK=local # or coston2
export RPC_URL=http://127.0.0.1:8545 # or coston2 rpc
export EXPLORER_URL=http://127.0.0.1:8545 # or coston2 explorer
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast
```

### Foundry RPC alias

`foundry.toml` includes:
- `coston2 = https://coston2-api.flare.network/ext/C/rpc`

## Frontend

The UI is configured for Costón2 (chainId `114`) and shows a switch button if you’re on the wrong network.

## Referee

The referee uses EIP-712 signatures with:
- `name: SkillStake`
- `version: 1`
- `chainId: 114`
- `verifyingContract: SkillStake address`

## Result payload (referee)

Structure (hash is `keccak256(abi.encode(...))`):

```
challengeId: uint256
winner: address
scoreA: uint256
scoreB: uint256
matchRef: string
timestamp: uint256
```

The referee signs EIP-712 typed data; the contract verifies it.

## Flare Costón2 MetaMask config

- Chain ID: `114` (0x72)
- RPC: `https://coston2-api.flare.network/ext/C/rpc`
- Explorer: `https://coston2-explorer.flare.network`
- Native: `C2FLR`

## Faucet

- https://faucet.flare.network/coston2

## Common errors

- Wrong chainId: must be `114` for Costón2.
- Missing C2FLR: use the faucet and ensure balances are non-zero.
- Referee signature mismatch: ensure `CHAIN_ID` and `CONTRACT_ADDRESS` match deployments.
