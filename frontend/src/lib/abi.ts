export const skillStakeAbi = [
  {
    type: "event",
    name: "Created",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "opponent", type: "address", indexed: true },
      { name: "stakeAmount", type: "uint256", indexed: false },
      { name: "winCondition", type: "uint8", indexed: false },
      { name: "expiryTimestamp", type: "uint256", indexed: false },
      { name: "matchRef", type: "string", indexed: false }
    ]
  },
  {
    type: "event",
    name: "Joined",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "opponent", type: "address", indexed: true }
    ]
  },
  {
    type: "event",
    name: "ResultSubmitted",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "scoreA", type: "uint256", indexed: false },
      { name: "scoreB", type: "uint256", indexed: false },
      { name: "resultHash", type: "bytes32", indexed: false }
    ]
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { name: "challengeId", type: "uint256", indexed: true },
      { name: "amountCreator", type: "uint256", indexed: false },
      { name: "amountOpponent", type: "uint256", indexed: false }
    ]
  },
  {
    type: "function",
    name: "createChallenge",
    stateMutability: "payable",
    inputs: [
      { name: "opponent", type: "address" },
      { name: "stakeAmount", type: "uint256" },
      { name: "winCondition", type: "uint8" },
      { name: "expiryTimestamp", type: "uint256" },
      { name: "matchRef", type: "string" }
    ],
    outputs: [{ name: "challengeId", type: "uint256" }]
  },
  {
    type: "function",
    name: "joinChallenge",
    stateMutability: "payable",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "submitResult",
    stateMutability: "nonpayable",
    inputs: [
      { name: "challengeId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "scoreA", type: "uint256" },
      { name: "scoreB", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "resultHash", type: "bytes32" },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "refundIfExpired",
    stateMutability: "nonpayable",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "challenges",
    stateMutability: "view",
    inputs: [{ name: "challengeId", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "opponent", type: "address" },
      { name: "stakeAmount", type: "uint256" },
      { name: "winCondition", type: "uint8" },
      { name: "expiryTimestamp", type: "uint256" },
      { name: "matchRef", type: "string" },
      { name: "joined", type: "bool" },
      { name: "settled", type: "bool" },
      { name: "refunded", type: "bool" },
      { name: "winner", type: "address" },
      { name: "scoreA", type: "uint256" },
      { name: "scoreB", type: "uint256" },
      { name: "resultHash", type: "bytes32" }
    ]
  }
] as const;
