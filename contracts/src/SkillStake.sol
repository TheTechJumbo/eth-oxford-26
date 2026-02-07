// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SkillStake {
    enum WinCondition {
        MOST_KILLS,
        PLACEMENT,
        POINTS
    }

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant RESULT_TYPEHASH =
        keccak256(
            "Result(uint256 challengeId,address winner,uint256 scoreA,uint256 scoreB,string matchRef,uint256 timestamp)"
        );

    struct Challenge {
        address creator;
        address opponent;
        uint256 stakeAmount;
        WinCondition winCondition;
        uint256 expiryTimestamp;
        string matchRef;
        bool joined;
        bool settled;
        bool refunded;
        address winner;
        uint256 scoreA;
        uint256 scoreB;
        bytes32 resultHash;
    }

    address public referee;
    uint256 public nextChallengeId;
    mapping(uint256 => Challenge) public challenges;
    bytes32 public immutable DOMAIN_SEPARATOR;

    uint256 private locked = 1;

    event Created(
        uint256 indexed challengeId,
        address indexed creator,
        address indexed opponent,
        uint256 stakeAmount,
        WinCondition winCondition,
        uint256 expiryTimestamp,
        string matchRef
    );
    event Joined(uint256 indexed challengeId, address indexed opponent);
    event ResultSubmitted(
        uint256 indexed challengeId,
        address indexed winner,
        uint256 scoreA,
        uint256 scoreB,
        bytes32 resultHash
    );
    event Settled(uint256 indexed challengeId, address indexed winner, uint256 payout);
    event Refunded(uint256 indexed challengeId, uint256 amountCreator, uint256 amountOpponent);

    error NotReferee();
    error InvalidSignature();
    error AlreadyJoined();
    error NotOpponent();
    error NotCreated();
    error NotJoined();
    error AlreadySettled();
    error AlreadyRefunded();
    error NotExpired();
    error ResultMissing();
    error AlreadySubmitted();

    modifier nonReentrant() {
        require(locked == 1, "reentrancy");
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address refereeAddress) {
        require(refereeAddress != address(0), "referee=0");
        referee = refereeAddress;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("SkillStake")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function setReferee(address refereeAddress) external {
        require(msg.sender == referee, "only referee");
        require(refereeAddress != address(0), "referee=0");
        referee = refereeAddress;
    }

    function createChallenge(
        address opponent,
        uint256 stakeAmount,
        WinCondition winCondition,
        uint256 expiryTimestamp,
        string calldata matchRef
    ) external payable nonReentrant returns (uint256 challengeId) {
        require(opponent != address(0), "opponent=0");
        require(opponent != msg.sender, "self");
        require(stakeAmount > 0, "stake=0");
        require(expiryTimestamp > block.timestamp, "expiry");
        require(msg.value == stakeAmount, "stake!=value");

        challengeId = nextChallengeId++;

        Challenge storage c = challenges[challengeId];
        c.creator = msg.sender;
        c.opponent = opponent;
        c.stakeAmount = stakeAmount;
        c.winCondition = winCondition;
        c.expiryTimestamp = expiryTimestamp;
        c.matchRef = matchRef;

        emit Created(
            challengeId,
            msg.sender,
            opponent,
            stakeAmount,
            winCondition,
            expiryTimestamp,
            matchRef
        );
    }

    function joinChallenge(uint256 challengeId) external payable nonReentrant {
        Challenge storage c = challenges[challengeId];
        if (c.creator == address(0)) revert NotCreated();
        if (c.joined) revert AlreadyJoined();
        if (msg.sender != c.opponent) revert NotOpponent();
        require(msg.value == c.stakeAmount, "stake!=value");

        c.joined = true;

        emit Joined(challengeId, msg.sender);
    }

    function submitResult(
        uint256 challengeId,
        address winner,
        uint256 scoreA,
        uint256 scoreB,
        uint256 timestamp,
        bytes32 resultHash,
        bytes calldata signature
    ) external {
        if (msg.sender != referee) revert NotReferee();

        Challenge storage c = challenges[challengeId];
        if (c.creator == address(0)) revert NotCreated();
        if (!c.joined) revert NotJoined();
        if (c.settled || c.refunded) revert AlreadySettled();
        if (c.resultHash != bytes32(0)) revert AlreadySubmitted();
        if (winner != c.creator && winner != c.opponent) revert("winner");

        bytes32 structHash = keccak256(
            abi.encode(
                RESULT_TYPEHASH,
                challengeId,
                winner,
                scoreA,
                scoreB,
                keccak256(bytes(c.matchRef)),
                timestamp
            )
        );
        bytes32 expectedHash = keccak256(
            abi.encode(challengeId, winner, scoreA, scoreB, c.matchRef, timestamp)
        );
        require(resultHash == expectedHash, "resultHash");
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        address recovered = _recoverSigner(digest, signature);
        if (recovered != referee) revert InvalidSignature();

        c.winner = winner;
        c.scoreA = scoreA;
        c.scoreB = scoreB;
        c.resultHash = resultHash;

        emit ResultSubmitted(challengeId, winner, scoreA, scoreB, resultHash);
    }

    function settle(uint256 challengeId) external nonReentrant {
        Challenge storage c = challenges[challengeId];
        if (c.creator == address(0)) revert NotCreated();
        if (!c.joined) revert NotJoined();
        if (c.settled) revert AlreadySettled();
        if (c.refunded) revert AlreadyRefunded();
        if (c.winner == address(0)) revert ResultMissing();

        c.settled = true;

        uint256 payout = c.stakeAmount * 2;
        (bool ok, ) = payable(c.winner).call{value: payout}("");
        require(ok, "payout");

        emit Settled(challengeId, c.winner, payout);
    }

    function refundIfExpired(uint256 challengeId) external nonReentrant {
        Challenge storage c = challenges[challengeId];
        if (c.creator == address(0)) revert NotCreated();
        if (c.settled) revert AlreadySettled();
        if (c.refunded) revert AlreadyRefunded();
        if (block.timestamp < c.expiryTimestamp) revert NotExpired();

        c.refunded = true;

        uint256 amountCreator = c.stakeAmount;
        uint256 amountOpponent = 0;

        (bool okA, ) = payable(c.creator).call{value: amountCreator}("");
        require(okA, "refundA");
        if (c.joined) {
            amountOpponent = c.stakeAmount;
            (bool okB, ) = payable(c.opponent).call{value: amountOpponent}("");
            require(okB, "refundB");
        }

        emit Refunded(challengeId, amountCreator, amountOpponent);
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
