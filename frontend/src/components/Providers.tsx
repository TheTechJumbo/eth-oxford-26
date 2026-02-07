"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { foundry } from "wagmi/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { defineChain } from "viem";

const queryClient = new QueryClient();

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: [injectedWallet]
    }
  ],
  {
    appName: "SkillStake"
  }
);

const network = process.env.NEXT_PUBLIC_NETWORK || "local";

const coston2 = defineChain({
  id: 114,
  name: "Flare Coston2",
  nativeCurrency: {
    name: "C2FLR",
    symbol: "C2FLR",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://coston2-api.flare.network/ext/C/rpc"]
    }
  },
  blockExplorers: {
    default: {
      name: "Flare Explorer",
      url: "https://coston2-explorer.flare.network"
    }
  }
});

const chain = network === "coston2" ? coston2 : foundry;
const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (network === "coston2"
    ? "https://coston2-api.flare.network/ext/C/rpc"
    : "http://127.0.0.1:8545");

const config = createConfig({
  chains: [chain],
  transports: {
    [chain.id]: http(rpcUrl)
  },
  connectors
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
