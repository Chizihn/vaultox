/**
 * backend/scripts/test-solstice.ts
 * ────────────────────────────────
 * Test script to verify Solstice API integration.
 * Run with: npx ts-node scripts/test-solstice.ts <auth_token> [wallet_address] [amount] [admin_api_key]
 */

import fetch from "node-fetch";
import fs from "node:fs";
import path from "node:path";

function readEnvValue(key: string): string | undefined {
  try {
    const envPath = path.resolve(__dirname, "../.env");
    if (!fs.existsSync(envPath)) return undefined;

    const content = fs.readFileSync(envPath, "utf8");
    const line = content
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${key}=`));

    if (!line) return undefined;

    const raw = line.slice(line.indexOf("=") + 1).trim();
    return raw.replace(/^['\"]|['\"]$/g, "");
  } catch {
    return undefined;
  }
}

async function testSolsticeIntegration() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(
      "Usage: npx ts-node scripts/test-solstice.ts <auth_token> [wallet_address] [amount] [admin_api_key]",
    );
    console.error(
      "Example: npx ts-node scripts/test-solstice.ts eyJhbGc... 5W6fVz... 1000 vaultox_stablehacks_admin_key_123456",
    );
    process.exit(1);
  }

  const authToken = args[0];
  const walletAddress =
    args[1] ||
    process.env.SOLSTICE_USER_WALLET ||
    "5W6fVzEdYvrV7ZLhXbFxzQDxhCdp7U8t2n1uDV2PXjB6";
  const amount = parseInt(args[2] || "1000", 10);
  const adminApiKey =
    args[3] || process.env.ADMIN_API_KEY || readEnvValue("ADMIN_API_KEY");
  const apiUrl = process.env.API_URL || "http://localhost:3001/api/v1";

  if (!adminApiKey) {
    console.error("❌ Missing admin API key");
    console.error(
      "Pass it as 4th arg or export ADMIN_API_KEY before running the script.",
    );
    process.exit(1);
  }

  console.log(`\n🧪 Testing Solstice Integration`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`Wallet: ${walletAddress}`);
  console.log(`Amount: ${amount} USDC`);
  console.log(`\n📡 Calling POST /vaults/test-solstice...\n`);

  try {
    const normalizedApiUrl = apiUrl.replace(/\/$/, "");
    const endpoint = `${normalizedApiUrl}/vaults/test-solstice`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        "x-admin-key": adminApiKey,
      },
      body: JSON.stringify({ amount, walletAddress }),
    });

    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();

    if (!contentType.includes("application/json")) {
      console.error("❌ Non-JSON response received");
      console.error(`Status: ${response.status} ${response.statusText}`);
      console.error(`Endpoint: ${endpoint}`);
      console.error(
        "Hint: Ensure backend is running on http://localhost:3001 and API_URL includes /api/v1",
      );
      console.error(`Body preview: ${rawBody.slice(0, 300)}`);
      process.exit(1);
    }

    const data = JSON.parse(rawBody);

    if (!response.ok) {
      console.log("❌ FAILED - Backend returned error\n");
      console.log(`Status: ${response.status} ${response.statusText}`);
      console.log(`Response: ${JSON.stringify(data, null, 2)}`);
      process.exit(1);
    }

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
      if (data.details) {
        console.log(`Details: ${JSON.stringify(data.details, null, 2)}`);
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } catch (error) {
    console.error(`❌ Request failed:`, error);
    process.exit(1);
  }
}

testSolsticeIntegration();
