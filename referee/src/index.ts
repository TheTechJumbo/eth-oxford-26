import "dotenv/config";
import express from "express";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

const deploymentsPath =
  process.env.DEPLOYMENTS_PATH ||
  path.join(process.cwd(), "..", "deployments", "latest.json");

let deployments: any = null;
if (fs.existsSync(deploymentsPath)) {
  deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
}

const {
  RPC_URL = deployments?.rpcUrl,
  CHAIN_ID = deployments?.chainId?.toString(),
  REFEREE_PRIVATE_KEY,
  CONTRACT_ADDRESS = deployments?.skillStake,
  API_KEY,
  DEMO_MODE,
  PORT
} = process.env;

if (!RPC_URL || !REFEREE_PRIVATE_KEY || !CONTRACT_ADDRESS || !CHAIN_ID) {
  throw new Error("Missing RPC_URL, CHAIN_ID, REFEREE_PRIVATE_KEY, or CONTRACT_ADDRESS");
}

const app = express();
app.use(express.json());

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(REFEREE_PRIVATE_KEY, provider);
const chainId = Number(CHAIN_ID);

const abi = [
  "function submitResult(uint256 challengeId,address winner,uint256 scoreA,uint256 scoreB,uint256 timestamp,bytes32 resultHash,bytes signature)",
  "function challenges(uint256) view returns (address creator,address opponent,uint256 stakeAmount,uint8 winCondition,uint256 expiryTimestamp,string matchRef,bool joined,bool settled,bool refunded,address winner,uint256 scoreA,uint256 scoreB,bytes32 resultHash)"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

type ResultPayload = {
  challengeId: bigint;
  winner: string;
  scoreA: bigint;
  scoreB: bigint;
  matchRef: string;
  timestamp: bigint;
};

function hashResultPayload(payload: ResultPayload): string {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    ["uint256", "address", "uint256", "uint256", "string", "uint256"],
    [
      payload.challengeId,
      payload.winner,
      payload.scoreA,
      payload.scoreB,
      payload.matchRef,
      payload.timestamp
    ]
  );
  return ethers.keccak256(encoded);
}

function demoScores(matchRef: string): { scoreA: bigint; scoreB: bigint } {
  const seed = ethers.keccak256(ethers.toUtf8Bytes(matchRef));
  const a = BigInt("0x" + seed.slice(2, 34)) % 25n;
  const b = BigInt("0x" + seed.slice(34, 66)) % 25n;
  return { scoreA: a + 1n, scoreB: b + 1n };
}

async function fetchApexStats(_matchRef: string): Promise<{ scoreA: bigint; scoreB: bigint }> {
  // TODO: integrate Tracker Network API using API_KEY
  // For now, return demo scores deterministically.
  return demoScores(_matchRef);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/result/submit", async (req, res) => {
  try {
    const { challengeId, matchRef } = req.body as {
      challengeId: string | number;
      matchRef: string;
    };

    if (challengeId === undefined || !matchRef) {
      return res.status(400).json({ error: "challengeId and matchRef required" });
    }

    const id = BigInt(challengeId);
    const challenge = await contract.challenges(id);

    if (!challenge.creator || challenge.creator === ethers.ZeroAddress) {
      return res.status(404).json({ error: "challenge not found" });
    }

    const useDemo = DEMO_MODE === "true" || !API_KEY;
    const { scoreA, scoreB } = useDemo
      ? demoScores(matchRef)
      : await fetchApexStats(matchRef);

    const winner = scoreA >= scoreB ? challenge.creator : challenge.opponent;

    const payload: ResultPayload = {
      challengeId: id,
      winner,
      scoreA,
      scoreB,
      matchRef,
      timestamp: BigInt(Math.floor(Date.now() / 1000))
    };

    const resultHash = hashResultPayload(payload);
    const domain = {
      name: "SkillStake",
      version: "1",
      chainId,
      verifyingContract: CONTRACT_ADDRESS
    };
    const types = {
      Result: [
        { name: "challengeId", type: "uint256" },
        { name: "winner", type: "address" },
        { name: "scoreA", type: "uint256" },
        { name: "scoreB", type: "uint256" },
        { name: "matchRef", type: "string" },
        { name: "timestamp", type: "uint256" }
      ]
    };
    const signature = await wallet.signTypedData(domain, types, {
      challengeId: payload.challengeId,
      winner: payload.winner,
      scoreA: payload.scoreA,
      scoreB: payload.scoreB,
      matchRef: payload.matchRef,
      timestamp: payload.timestamp
    });

    const tx = await contract.submitResult(
      payload.challengeId,
      payload.winner,
      payload.scoreA,
      payload.scoreB,
      payload.timestamp,
      resultHash,
      signature
    );

    const receipt = await tx.wait();

    res.json({
      ok: true,
      payload,
      resultHash,
      txHash: receipt?.hash
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "submit failed" });
  }
});

const port = Number(PORT || 4000);

async function start() {
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== chainId) {
    throw new Error(
      `CHAIN_ID mismatch: env=${chainId} rpc=${Number(net.chainId)} (${net.name})`
    );
  }

  console.log("Referee starting:");
  console.log(`  network: ${net.name}`);
  console.log(`  chainId: ${chainId}`);
  console.log(`  rpc: ${RPC_URL}`);
  console.log(`  contract: ${CONTRACT_ADDRESS}`);

  app.listen(port, () => {
    console.log(`referee listening on ${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
