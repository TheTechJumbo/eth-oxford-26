// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SkillStake.sol";
contract SkillStakeTest is Test {
    SkillStake skill;

    address creator = address(0xA11CE);
    address opponent = address(0xB0B);
    uint256 refereePk = 0xBEEF;
    address referee;

    function setUp() public {
        referee = vm.addr(refereePk);
        skill = new SkillStake(referee);
        vm.deal(creator, 1_000 ether);
        vm.deal(opponent, 1_000 ether);
    }

    function testCreateJoinSubmitSettle() public {
        vm.prank(creator);
        uint256 id = skill.createChallenge{value: 100 ether}(
            opponent,
            100 ether,
            SkillStake.WinCondition.MOST_KILLS,
            block.timestamp + 1 days,
            "match-1"
        );

        vm.prank(opponent);
        skill.joinChallenge{value: 100 ether}(id);

        uint256 timestamp = 123;
        bytes32 resultHash = keccak256(abi.encode(id, creator, uint256(10), uint256(7), "match-1", timestamp));
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Result(uint256 challengeId,address winner,uint256 scoreA,uint256 scoreB,string matchRef,uint256 timestamp)"
                ),
                id,
                creator,
                uint256(10),
                uint256(7),
                keccak256(bytes("match-1")),
                timestamp
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", skill.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(refereePk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(referee);
        skill.submitResult(id, creator, 10, 7, timestamp, resultHash, sig);

        uint256 before = creator.balance;
        skill.settle(id);
        uint256 afterBal = creator.balance;

        assertEq(afterBal - before, 200 ether);
    }

    function testRefundIfExpired() public {
        vm.prank(creator);
        uint256 id = skill.createChallenge{value: 50 ether}(
            opponent,
            50 ether,
            SkillStake.WinCondition.PLACEMENT,
            block.timestamp + 1,
            "match-2"
        );

        vm.warp(block.timestamp + 2);
        uint256 before = creator.balance;
        skill.refundIfExpired(id);
        uint256 afterBal = creator.balance;

        assertEq(afterBal - before, 50 ether);
    }
}
