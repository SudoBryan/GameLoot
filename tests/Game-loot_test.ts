
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

/**
 * GameLoot NFT Contract Test Suite - Part 2: Transfer, Burn, and Item Management
 * 
 * This test suite covers:
 * - NFT transfer functionality and validation
 * - Item burning and cleanup
 * - Item upgrade mechanics
 * - Tradability controls
 * - Item combination system
 * - Inventory management during operations
 */

Clarinet.test({
    name: "NFT transfer - successful transfer between users",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // First mint an item to wallet1
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Transferable Sword"),
                types.utf8("A sword that can be transferred"),
                types.utf8("https://example.com/transfersword.png"),
                types.uint(RARITY_LEVELS.RARE),
                types.ascii("weapon"),
                types.uint(400),
                types.bool(true) // tradable
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Verify initial ownership and inventory
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-owner", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result.includes(wallet1.address), true);
        
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-user-token-count", [types.principal(wallet1.address)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result, "u1");
        
        // Execute transfer from wallet1 to wallet2
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "transfer", [
                types.uint(1),
                types.principal(wallet1.address),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
        
        // Verify ownership changed
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-owner", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result.includes(wallet2.address), true);
        
        // Verify inventory updated correctly
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-user-token-count", [types.principal(wallet1.address)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result, "u0");
        
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-user-token-count", [types.principal(wallet2.address)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result, "u1");
    },
});

Clarinet.test({
    name: "NFT transfer - validation and error handling",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        const wallet3 = accounts.get("wallet_3")!;
        
        // Mint a non-tradable item
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Soulbound Item"),
                types.utf8("Cannot be transferred"),
                types.utf8("https://example.com/soulbound.png"),
                types.uint(RARITY_LEVELS.LEGENDARY),
                types.ascii("artifact"),
                types.uint(1800),
                types.bool(false) // not tradable
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Try to transfer non-tradable item - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "transfer", [
                types.uint(1),
                types.principal(wallet1.address),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u106)"); // err-not-tradable
        
        // Mint a tradable item for further tests
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Tradable Shield"),
                types.utf8("Can be transferred"),
                types.utf8("https://example.com/shield.png"),
                types.uint(RARITY_LEVELS.UNCOMMON),
                types.ascii("armor"),
                types.uint(200),
                types.bool(true) // tradable
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u2)");
        
        // Try to transfer item you don't own - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "transfer", [
                types.uint(2),
                types.principal(wallet1.address),
                types.principal(wallet3.address)
            ], wallet2.address) // wallet2 trying to transfer wallet1's item
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u105)"); // err-unauthorized
        
        // Try to transfer non-existent token - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "transfer", [
                types.uint(999),
                types.principal(wallet1.address),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u101)"); // err-not-found
    },
});

Clarinet.test({
    name: "NFT burning - successful burn and cleanup",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        // Mint an item to burn
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Disposable Item"),
                types.utf8("This item will be burned"),
                types.utf8("https://example.com/disposable.png"),
                types.uint(RARITY_LEVELS.COMMON),
                types.ascii("consumable"),
                types.uint(50),
                types.bool(true)
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Verify item exists and user has it
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-owner", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result.includes(wallet1.address), true);
        
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-user-token-count", [types.principal(wallet1.address)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result, "u1");
        
        // Burn the item
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "burn", [types.uint(1)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
        
        // Verify item no longer exists
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-owner", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result, "(ok none)");
        
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-token-metadata", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result, "none");
        
        // Verify inventory updated
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-user-token-count", [types.principal(wallet1.address)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result, "u0");
    },
});

Clarinet.test({
    name: "NFT burning - access control validation",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Mint an item to wallet1
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Protected Item"),
                types.utf8("This item should be protected from unauthorized burning"),
                types.utf8("https://example.com/protected.png"),
                types.uint(RARITY_LEVELS.EPIC),
                types.ascii("armor"),
                types.uint(800),
                types.bool(true)
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Try to burn item as non-owner - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "burn", [types.uint(1)], wallet2.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u105)"); // err-unauthorized
        
        // Try to burn non-existent item - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "burn", [types.uint(999)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u101)"); // err-not-found
        
        // Verify original item still exists
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-owner", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result.includes(wallet1.address), true);
    },
});

Clarinet.test({
    name: "Item upgrade - successful power level upgrades",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        
        // Mint an upgradeable item
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Upgradeable Sword"),
                types.utf8("This sword can be upgraded"),
                types.utf8("https://example.com/upgradesword.png"),
                types.uint(RARITY_LEVELS.RARE), // max power 500
                types.ascii("weapon"),
                types.uint(300), // starting power
                types.bool(true)
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Test is-item-upgradeable function
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "is-item-upgradeable", [types.uint(1), types.uint(400)], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "true");
        
        // Upgrade the item successfully
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "upgrade-item", [types.uint(1), types.uint(450)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
        
        // Verify upgrade applied
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-token-metadata", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.includes("u450"), true);
        
        // Test get-item-stats function
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-item-stats", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.includes("power-level: u450"), true);
        assertEquals(block.receipts[0].result.includes("max-power: u500"), true);
    },
});

Clarinet.test({
    name: "Item upgrade - validation and error handling",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Mint an item for upgrade testing
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Test Upgrade Item"),
                types.utf8("For testing upgrade validation"),
                types.utf8("https://example.com/testupgrade.png"),
                types.uint(RARITY_LEVELS.UNCOMMON), // max power 250
                types.ascii("weapon"),
                types.uint(200), // starting power
                types.bool(true)
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Try to upgrade with same or lower power - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "upgrade-item", [types.uint(1), types.uint(200)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u107)"); // err-invalid-upgrade
        
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "upgrade-item", [types.uint(1), types.uint(150)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u107)"); // err-invalid-upgrade
        
        // Try to upgrade beyond max power for rarity - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "upgrade-item", [types.uint(1), types.uint(300)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u108)"); // err-power-too-high
        
        // Try to upgrade item you don't own - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "upgrade-item", [types.uint(1), types.uint(230)], wallet2.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u105)"); // err-unauthorized
        
        // Try to upgrade non-existent item - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "upgrade-item", [types.uint(999), types.uint(100)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u101)"); // err-not-found
    },
});

Clarinet.test({
    name: "Item tradability - toggle tradable status",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet1 = accounts.get("wallet_1")!;
        const wallet2 = accounts.get("wallet_2")!;
        
        // Mint a tradable item
        let block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "mint-item", [
                types.principal(wallet1.address),
                types.ascii("Tradability Test Item"),
                types.utf8("For testing tradability controls"),
                types.utf8("https://example.com/tradabilitytest.png"),
                types.uint(RARITY_LEVELS.COMMON),
                types.ascii("misc"),
                types.uint(50),
                types.bool(true) // initially tradable
            ], deployer.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok u1)");
        
        // Verify initial tradability
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-token-metadata", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result.includes("tradable: true"), true);
        
        // Toggle tradability to false
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "set-item-tradability", [types.uint(1), types.bool(false)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
        
        // Verify tradability changed
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "get-token-metadata", [types.uint(1)], deployer.address)
        ]);
        assertEquals(block.receipts[0].result.includes("tradable: false"), true);
        
        // Try to transfer now non-tradable item - should fail
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "transfer", [
                types.uint(1),
                types.principal(wallet1.address),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(err u106)"); // err-not-tradable
        
        // Toggle back to tradable
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "set-item-tradability", [types.uint(1), types.bool(true)], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
        
        // Now transfer should work
        block = chain.mineBlock([
            Tx.contractCall(CONTRACT_NAME, "transfer", [
                types.uint(1),
                types.principal(wallet1.address),
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, "(ok true)");
    },
});
