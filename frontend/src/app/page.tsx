"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { formatEther, parseEther, isAddress } from "viem";
import { skillStakeAbi } from "../lib/abi";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}` | undefined;
const REFEREE_URL = process.env.NEXT_PUBLIC_REFEREE_URL || "http://localhost:4000";
const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_BASE || "https://coston2-explorer.flare.network";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "114");
const NATIVE_SYMBOL = process.env.NEXT_PUBLIC_NATIVE_SYMBOL || "C2FLR";
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "local";

type Challenge = {
  id: bigint;
  creator: string;
  opponent: string;
  stakeAmount: bigint;
  winCondition: number;
  expiryTimestamp: bigint;
  matchRef: string;
  joined: boolean;
  settled: boolean;
  refunded: boolean;
  winner: string;
  scoreA: bigint;
  scoreB: bigint;
  resultHash: string;
  resultTxHash?: string;
  resultTimestamp?: number;
  settleTxHash?: string;
};

function winConditionLabel(value: number) {
  if (value === 1) return "PLACEMENT";
  if (value === 2) return "POINTS";
  return "MOST_KILLS";
}

export default function Page() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [opponent, setOpponent] = useState("");
  const [stake, setStake] = useState("10");
  const [winCondition, setWinCondition] = useState("0");
  const [matchRef, setMatchRef] = useState("match-1");
  const [expiry, setExpiry] = useState("3600");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);

  const ready = CONTRACT_ADDRESS;
  const wrongNetwork = NETWORK === "coston2" && chainId !== CHAIN_ID;

  const loadChallenges = async () => {
    if (!publicClient || !ready) return;
    const createdLogs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: skillStakeAbi.find((x) => x.name === "Created") as any,
      fromBlock: 0n,
      toBlock: "latest"
    });

    const resultLogs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: skillStakeAbi.find((x) => x.name === "ResultSubmitted") as any,
      fromBlock: 0n,
      toBlock: "latest"
    });

    const settledLogs = await publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: skillStakeAbi.find((x) => x.name === "Settled") as any,
      fromBlock: 0n,
      toBlock: "latest"
    });

    const ids = createdLogs.map((log) => log.args.challengeId as bigint);
    const uniqueIds = Array.from(new Set(ids.map((x) => x.toString()))).map(BigInt);

    const resultLogMap = new Map<string, { txHash: string; blockNumber: bigint }>();
    for (const log of resultLogs) {
      const id = (log.args.challengeId as bigint).toString();
      resultLogMap.set(id, { txHash: log.transactionHash as string, blockNumber: log.blockNumber });
    }

    const settledLogMap = new Map<string, { txHash: string; blockNumber: bigint }>();
    for (const log of settledLogs) {
      const id = (log.args.challengeId as bigint).toString();
      settledLogMap.set(id, { txHash: log.transactionHash as string, blockNumber: log.blockNumber });
    }

    const blockNumbers = new Set<bigint>();
    for (const item of resultLogMap.values()) blockNumbers.add(item.blockNumber);
    for (const item of settledLogMap.values()) blockNumbers.add(item.blockNumber);

    const blockTimestampMap = new Map<bigint, number>();
    await Promise.all(
      Array.from(blockNumbers).map(async (bn) => {
        const block = await publicClient.getBlock({ blockNumber: bn });
        blockTimestampMap.set(bn, Number(block.timestamp) * 1000);
      })
    );

    const list: Challenge[] = [];
    for (const id of uniqueIds) {
      const c = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: skillStakeAbi,
        functionName: "challenges",
        args: [id]
      })) as any;

      const resultMeta = resultLogMap.get(id.toString());
      const settleMeta = settledLogMap.get(id.toString());

      list.push({
        id,
        creator: c[0],
        opponent: c[1],
        stakeAmount: c[2],
        winCondition: Number(c[3]),
        expiryTimestamp: c[4],
        matchRef: c[5],
        joined: c[6],
        settled: c[7],
        refunded: c[8],
        winner: c[9],
        scoreA: c[10],
        scoreB: c[11],
        resultHash: c[12],
        resultTxHash: resultMeta?.txHash,
        resultTimestamp: resultMeta ? blockTimestampMap.get(resultMeta.blockNumber) : undefined,
        settleTxHash: settleMeta?.txHash
      });
    }
    setChallenges(list);
  };

  useEffect(() => {
    loadChallenges();
  }, [publicClient, ready]);

  const createChallenge = async () => {
    if (!ready || !address) return;
    if (!isAddress(opponent)) return alert("Invalid opponent address");

    const stakeWei = parseEther(stake || "0");
    const expiryTimestamp = BigInt(Math.floor(Date.now() / 1000) + Number(expiry || "0"));

    setLoading(true);
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS!,
        abi: skillStakeAbi,
        functionName: "createChallenge",
        args: [opponent as `0x${string}`, stakeWei, Number(winCondition), expiryTimestamp, matchRef],
        value: stakeWei
      });
      await loadChallenges();
    } finally {
      setLoading(false);
    }
  };

  const joinChallenge = async (id: bigint, stakeAmount: bigint) => {
    if (!ready || !address) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS!,
        abi: skillStakeAbi,
        functionName: "joinChallenge",
        args: [id],
        value: stakeAmount
      });
      await loadChallenges();
    } finally {
      setLoading(false);
    }
  };

  const submitResult = async (id: bigint, matchRefValue: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${REFEREE_URL}/result/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: id.toString(), matchRef: matchRefValue })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "submit failed");
      await loadChallenges();
    } catch (err: any) {
      alert(err.message || "submit failed");
    } finally {
      setLoading(false);
    }
  };

  const settle = async (id: bigint) => {
    if (!ready) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS!,
        abi: skillStakeAbi,
        functionName: "settle",
        args: [id]
      });
      await loadChallenges();
    } finally {
      setLoading(false);
    }
  };

  const refund = async (id: bigint) => {
    if (!ready) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS!,
        abi: skillStakeAbi,
        functionName: "refundIfExpired",
        args: [id]
      });
      await loadChallenges();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">SkillStake</h1>
          <p className="text-slate-600">1v1 Apex Legends skill staking</p>
        </div>
        <ConnectButton />
      </header>

      {!ready && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
          Set `NEXT_PUBLIC_CONTRACT_ADDRESS` in `frontend/.env.local`.
        </div>
      )}

      {ready && wrongNetwork && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <div className="mb-2 font-semibold">Wrong network</div>
          <p className="text-sm">Please switch to Flare Costón2 (chainId {CHAIN_ID}).</p>
          <button
            className="mt-3"
            onClick={async () => {
              const ethereum = (window as any).ethereum;
              if (!ethereum) return;
              try {
                await ethereum.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: "0x72" }]
                });
              } catch (err: any) {
                if (err?.code === 4902) {
                  await ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [
                      {
                        chainId: "0x72",
                        chainName: "Flare Costón2",
                        nativeCurrency: {
                          name: "C2FLR",
                          symbol: "C2FLR",
                          decimals: 18
                        },
                        rpcUrls: ["https://coston2-api.flare.network/ext/C/rpc"],
                        blockExplorerUrls: ["https://coston2-explorer.flare.network"]
                      }
                    ]
                  });
                } else {
                  console.error(err);
                }
              }
            }}
          >
            Switch to Flare Costón2
          </button>
        </div>
      )}

      <section className="rounded bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Create Challenge</h2>
        <div className="grid grid-cols-1 gap-3">
          <input
            placeholder="Opponent address"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
          />
          <input
            placeholder={`Stake (${NATIVE_SYMBOL})`}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
          <select value={winCondition} onChange={(e) => setWinCondition(e.target.value)}>
            <option value="0">MOST_KILLS</option>
            <option value="1">PLACEMENT</option>
            <option value="2">POINTS</option>
          </select>
          <input placeholder="Match reference" value={matchRef} onChange={(e) => setMatchRef(e.target.value)} />
          <input
            placeholder="Expiry seconds from now"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
          <button disabled={loading || !ready} onClick={createChallenge}>
            Create Challenge
          </button>
        </div>
      </section>

      <section className="rounded bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Challenges</h2>
          <button disabled={loading} onClick={loadChallenges}>
            Refresh
          </button>
        </div>
        {challenges.length === 0 && <p className="text-slate-500">No challenges yet.</p>}
        {challenges.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2">Challenge ID</th>
                  <th className="py-2">Player A / Player B</th>
                  <th className="py-2">Win condition</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Score A / Score B</th>
                  <th className="py-2">Winner</th>
                  <th className="py-2">Settle tx hash</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((c) => {
                  const isExpired = Number(c.expiryTimestamp) * 1000 < Date.now();
                  const status = c.settled
                    ? "SETTLED"
                    : c.resultHash && c.resultHash !== "0x0000000000000000000000000000000000000000000000000000000000000000"
                    ? "RESULT_SUBMITTED"
                    : c.joined
                    ? "FUNDED"
                    : "OPEN";
                  return (
                    <tr key={c.id.toString()} className="border-b border-slate-100 align-top">
                      <td className="py-2">{c.id.toString()}</td>
                      <td className="py-2">
                        <div className="text-xs text-slate-500">A</div>
                        <div className="break-all">{c.creator}</div>
                        <div className="mt-2 text-xs text-slate-500">B</div>
                        <div className="break-all">{c.opponent}</div>
                      </td>
                      <td className="py-2">{winConditionLabel(c.winCondition)}</td>
                      <td className="py-2">
                        <div>{status}</div>
                        {isExpired && !c.settled && !c.refunded && (
                          <div className="text-xs text-amber-600">Expired</div>
                        )}
                      </td>
                      <td className="py-2">
                        {c.scoreA.toString()} / {c.scoreB.toString()}
                        {c.resultTimestamp && (
                          <div className="text-xs text-slate-500">
                            {new Date(c.resultTimestamp).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-2 break-all">{c.winner}</td>
                      <td className="py-2 break-all">
                        {c.settleTxHash ? (
                          <a
                            className="text-blue-600 hover:underline"
                            href={`${EXPLORER_BASE}/tx/${c.settleTxHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {c.settleTxHash.slice(0, 10)}...
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {challenges.map((c) => {
            const isExpired = Number(c.expiryTimestamp) * 1000 < Date.now();
            return (
              <div key={`actions-${c.id.toString()}`} className="flex flex-wrap gap-2">
                <div className="text-sm text-slate-600">Challenge {c.id.toString()}</div>
                <button
                  disabled={loading || c.joined}
                  onClick={() => joinChallenge(c.id, c.stakeAmount)}
                >
                  Join
                </button>
                <button
                  disabled={loading || !c.joined}
                  onClick={() => submitResult(c.id, c.matchRef)}
                >
                  Submit Result
                </button>
                <button disabled={loading || !c.joined || c.settled} onClick={() => settle(c.id)}>
                  Settle
                </button>
                <button
                  disabled={loading || c.settled || c.refunded || !isExpired}
                  onClick={() => refund(c.id)}
                >
                  Refund
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
