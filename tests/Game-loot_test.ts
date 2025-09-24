
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

/**
 * GameLoot NFT Contract Test Suite - Part 1: Basic NFT Functionality and Minting
 * 
 * This test suite covers:
 * - Contract initialization and basic state
 * - NFT minting functionality (single and batch)
 * - Token metadata management
 * - Ownership tracking
 * - Read-only function testing
 * - Error handling and validation
 */

// Test Constants
const CONTRACT_NAME = "Game-loot";
const ITEM_METADATA = {
    name: "Legendary Sword",
    description: "A powerful sword forged in ancient fires",
    image: "https://example.com/sword.png",
    itemType: "weapon",
    rarity: 4, // legendary
    powerLevel: 1500,
    tradable: true
};

const RARITY_LEVELS = {
    COMMON: 0,
    UNCOMMON: 1,
    RARE: 2,
    EPIC: 3,
    LEGENDARY: 4,
    MYTHIC: 5
};

Clarinet.test({
    name: "Contract initialization - verify initial state and constants",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        
        // Test initial token ID is 0
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-last-token-id", [], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u0)");
        
        // Test contract owner is the deployer
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-contract-owner", [], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, deployer.address);
        
        // Test initial contract URI is none
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-contract-uri", [], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "none");
        
        // Test total supply is 0
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-total-supply", [], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "u0");
    },
});

Clarinet.test({
    name: "NFT minting - successful single item mint by contract owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        // Mint an item successfully
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii(ITEM_METADATA.name),
                types.utf8(ITEM_METADATA.description),
                types.utf8(ITEM_METADATA.image),
                types.uint(ITEM_METADATA.rarity),
                types.ascii(ITEM_METADATA.itemType),
                types.uint(ITEM_METADATA.powerLevel),
                types.bool(ITEM_METADATA.tradable)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Verify token was minted and metadata set correctly
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-token-metadata", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.includes(ITEM_METADATA.name), true);
        assertEquals(block.receipts[0].result.includes("u" + ITEM_METADATA.rarity), true);
        assertEquals(block.receipts[0].result.includes("u" + ITEM_METADATA.powerLevel), true);
        
        // Verify ownership
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-owner", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.includes(wallet1.address), true);
        
        // Verify user inventory updated
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-user-token-count", [types.principal(wallet1.address)], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "u1");
        
        // Verify last token ID updated
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-last-token-id", [], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
    },
});

Clarinet.test({
    name: "NFT minting - access control validation (non-owner cannot mint)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Attempt to mint as non-owner should fail
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet2.address),
                types.ascii(ITEM_METADATA.name),
                types.utf8(ITEM_METADATA.description),
                types.utf8(ITEM_METADATA.image),
                types.uint(ITEM_METADATA.rarity),
                types.ascii(ITEM_METADATA.itemType),
                types.uint(ITEM_METADATA.powerLevel),
                types.bool(ITEM_METADATA.tradable)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u100)"); // err-owner-only
        
        // Verify no token was created
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-last-token-id", [], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u0)");
    },
});

Clarinet.test({
    name: "NFT minting - rarity validation testing",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        // Test valid rarities (0-5)
        for (let rarity = 0; rarity <= 5; rarity++) {
            let block = chain.mineBlock([
                Tx.contractCall(CONTRACT_NAME, "mint-item", [
                    types.principal(wallet1.address),
                    types.ascii(`Item${rarity}`),
                    types.utf8(`Description for rarity ${rarity}`),
                    types.utf8("https://example.com/item.png"),
                    types.uint(rarity),
                    types.ascii("misc"),
                    types.uint(100),
                    types.bool(true)
                ], deployer.address)
            ]);
            
            assertEquals(block.receipts.length, 1);
            assertEquals(block.receipts[0].result, `(ok u${rarity + 1})`);
        }
        
        // Test invalid rarity (> 5)
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Invalid Item"),
                types.utf8("This should fail"),
                types.utf8("https://example.com/fail.png"),
                types.uint(6), // Invalid rarity
                types.ascii("misc"),
                types.uint(100),
                types.bool(true)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u104)"); // err-invalid-rarity
    },
});

Clarinet.test({
    name: "Batch minting - successful batch operation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        const wallet3 = accounts.get("wallet_3")!;
        
        // Create batch mint data
        const batchData = [
            {
                recipient: wallet1.address,
                name: "Common Dagger",
                description: "A basic dagger",
                image: "https://example.com/dagger.png",
                rarity: RARITY_LEVELS.COMMON,
                itemType: "weapon",
                powerLevel: 50,
                tradable: true
            },
            {
                recipient: wallet2.address,
                name: "Rare Shield",
                description: "A protective shield",
                image: "https://example.com/shield.png",
                rarity: RARITY_LEVELS.RARE,
                itemType: "armor",
                powerLevel: 300,
                tradable: true
            },
            {
                recipient: wallet3.address,
                name: "Epic Bow",
                description: "A masterwork bow",
                image: "https://example.com/bow.png",
                rarity: RARITY_LEVELS.EPIC,
                itemType: "weapon",
                powerLevel: 800,
                tradable: false
            }
        ];
        
        // Execute batch mint
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "batch-mint", [
                types.list(batchData.map(item => types.tuple({
                    recipient: types.principal(item.recipient),
                    name: types.ascii(item.name),
                    description: types.utf8(item.description),
                    image: types.utf8(item.image),
                    rarity: types.uint(item.rarity),
                    "item-type": types.ascii(item.itemType),
                    "power-level": types.uint(item.powerLevel),
                    tradable: types.bool(item.tradable)
                })))
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        // Should contain array of successful mints
        assertEquals(block.receipts[0].result.includes("(ok u1)"), true);
        assertEquals(block.receipts[0].result.includes("(ok u2)"), true);
        assertEquals(block.receipts[0].result.includes("(ok u3)"), true);
        
        // Verify each token was created with correct metadata
        for (let i = 1; i <= 3; i++) {
            let metaBlock = chain.mineBlock([
                Tx.contractCall(CONTRACT_NAME, "get-token-metadata", [types.uint(i)], deployer.address)
            ]);
            assertEquals(metaBlock.receipts.length, 1);
            assertEquals(metaBlock.receipts[0].result.includes(batchData[i-1].name), true);
        }
        
        // Verify inventory counts
        for (let i = 0; i < 3; i++) {
            let inventoryBlock = chain.mineBlock([
                Tx.contractCall(CONTRACT_NAME, "get-user-token-count", [
                    types.principal(batchData[i].recipient)
                ], deployer.address)
            ]);
            assertEquals(inventoryBlock.receipts.length, 1);
            assertEquals(inventoryBlock.receipts[0].result, "u1");
        }
    },
});

Clarinet.test({
    name: "Batch minting - access control validation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Non-owner attempts batch mint
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "batch-mint", [
                types.list([
                    types.tuple({
                        recipient: types.principal(wallet2.address),
                        name: types.ascii("Test Item"),
                        description: types.utf8("Should fail"),
                        image: types.utf8("https://example.com/fail.png"),
                        rarity: types.uint(0),
                        "item-type": types.ascii("misc"),
                        "power-level": types.uint(10),
                        tradable: types.bool(true)
                    })
                ])
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u100)"); // err-owner-only
    },
});

Clarinet.test({
    name: "Read-only functions - comprehensive metadata and utility testing",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        // First mint a test item
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Test Sword"),
                types.utf8("A test sword for validation"),
                types.utf8("https://example.com/testsword.png"),
                types.uint(RARITY_LEVELS.EPIC),
                types.ascii("weapon"),
                types.uint(900),
                types.bool(true)
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Test get-token-uri function
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-token-uri", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok none)");
        
        // Test get-max-power-for-rarity for all rarities
        const expectedMaxPowers = [100, 250, 500, 1000, 2000, 5000];
        for (let rarity = 0; rarity <= 5; rarity++) {
            let powerBlock = chain.mineBlock([
                Tx.contractCall(CONTRACT_NAME, "get-max-power-for-rarity", [types.uint(rarity)], deployer.address)
            ]);
            assertEquals(powerBlock.receipts.length, 1);
            assertEquals(powerBlock.receipts[0].result, `u${expectedMaxPowers[rarity]}`);
        }
        
        // Test get-rarity-name for all rarities
        const rarityNames = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];
        for (let rarity = 0; rarity <= 5; rarity++) {
            let nameBlock = chain.mineBlock([
                Tx.contractCall(CONTRACT_NAME, "get-rarity-name", [types.uint(rarity)], deployer.address)
            ]);
            assertEquals(nameBlock.receipts.length, 1);
            assertEquals(nameBlock.receipts[0].result, `"${rarityNames[rarity]}"`);
        }
        
        // Test unknown rarity
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-rarity-name", [types.uint(99)], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '"Unknown"');
    },
});
