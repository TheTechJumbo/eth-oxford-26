// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/SkillStake.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address referee = vm.envAddress("REFEREE_ADDRESS");
        string memory network = vm.envOr("NETWORK", string("local"));
        string memory rpcUrl = vm.envOr("RPC_URL", string(""));
        string memory explorer = vm.envOr("EXPLORER_URL", string(""));

        vm.startBroadcast(deployerKey);
        SkillStake skill = new SkillStake(referee);
        vm.stopBroadcast();

        console2.log("SkillStake:", address(skill));

        string memory json = vm.serializeString("deployment", "network", network);
        json = vm.serializeUint("deployment", "chainId", block.chainid);
        json = vm.serializeString("deployment", "rpcUrl", rpcUrl);
        json = vm.serializeString("deployment", "explorer", explorer);
        json = vm.serializeAddress("deployment", "skillStake", address(skill));
        json = vm.serializeAddress("deployment", "refereeSigner", referee);
        json = vm.serializeAddress("deployment", "deployer", vm.addr(deployerKey));
        json = vm.serializeUint("deployment", "deployedAtBlock", block.number);

        string memory outPath = string.concat(vm.projectRoot(), "/deployments/latest.json");
        vm.writeJson(json, outPath);
    }
}
