// @ts-nocheck
/**
 * scripts/test-solstice.ts
 * ─────────────────────────
 * Test script to verify Solstice API integration.
 * Run with: npx ts-node scripts/test-solstice.ts <auth_token> [wallet_address] [amount]
 */

async function testSolsticeIntegration() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      "Usage: npx ts-node scripts/test-solstice.ts <auth_token> [wallet_address] [amount]",
    );
    console.error(
      "Example: npx ts-node scripts/test-solstice.ts eyJhbGc... 5W6fVz... 1000",
    );
    process.exit(1);
  }

  const authToken = args[0];
  const walletAddress =
    args[1] ||
    process.env.SOLSTICE_USER_WALLET ||
    "5W6fVzEdYvrV7ZLhXbFxzQDxhCdp7U8t2n1uDV2PXjB6";
  const amount = parseInt(args[2] || "1000", 10);
  const apiUrl = process.env.API_URL || "http://localhost:3001/api/v1";

  console.log(`\n🧪 Testing Solstice Integration`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Amount: ${amount} USDC`);
  console.log(`\n📡 Calling POST /vaults/test-solstice...\n`);

  try {
    const response = await fetch(`${apiUrl}/vaults/test-solstice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        "x-admin-key": process.env.ADMIN_API_KEY || "test-key",
      },
      body: JSON.stringify({ amount, walletAddress }),
    });

    const data = await response.json();

    if (data.success) {
      console.log(`✅ SUCCESS - Solstice integration working!\n`);
      console.log(`Message: ${data.message}`);
      console.log(`Instructions built: ${data.instructionCount}`);
      console.log(`\nInstruction Details:`);
      data.instructions.forEach((inst: any) => {
        console.log(
          `  [${inst.index}] Program: ${inst.programId.substring(0, 8)}...`,
        );
        console.log(
          `      Accounts: ${inst.accountCount}, Data: ${inst.dataSize} bytes`,
        );
      });
      console.log(`\nTimestamp: ${data.timestamp}`);
    } else {
      console.log(`❌ FAILED - Solstice integration error\n`);
      console.log(`Error: ${data.error}`);
      console.log(`Message: ${data.message}`);
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } catch (error) {
    console.error(`❌ Request failed:`, error);
    process.exit(1);
  }
}

testSolsticeIntegration();
