import "dotenv/config";
import { randomUUID } from "node:crypto";
import path from "node:path";
import express, { type Request, type Response } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createDb, ensureSchema, payments } from "@agentpay/db";

const PORT = Number(process.env.PORT ?? 3000);
const PLACEHOLDER_PAY_TO = "0x0000000000000000000000000000000000000001";
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS ?? PLACEHOLDER_PAY_TO;
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const NETWORK = "eip155:84532";
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), "agentpay.sqlite");

if (PAY_TO_ADDRESS === PLACEHOLDER_PAY_TO) {
  console.warn(
    "[gateway] PAY_TO_ADDRESS is not set — using a placeholder. " +
      "402 generation will work, but settled funds would go to the placeholder. " +
      "Set PAY_TO_ADDRESS in .env before exercising the SDK end-to-end.",
  );
}

const db = createDb(DB_PATH);
ensureSchema(db);

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme(),
);

const app = express();

app.use((req, res, next) => {
  const sigHeader = req.headers["x-payment"] ?? req.headers["payment-signature"];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  console.log(`[gateway] ${req.method} ${req.url} ${sig ? "(signed)" : "(unsigned)"}`);

  if (!sig) return next();

  res.on("finish", () => {
    const status: "settled" | "failed" = res.statusCode >= 200 && res.statusCode < 300 ? "settled" : "failed";

    let payerAddress: string | null = null;
    let amountAtomic: string | null = null;
    try {
      const payload = JSON.parse(Buffer.from(sig, "base64").toString("utf8"));
      payerAddress = payload?.payload?.authorization?.from ?? null;
      amountAtomic = payload?.payload?.authorization?.value ?? null;
    } catch {
      // unparseable payload; leave fields null
    }

    let txHash: string | null = null;
    let errorCode: string | null = null;
    if (status === "settled") {
      const xPaymentResponse = res.getHeader("x-payment-response");
      if (typeof xPaymentResponse === "string") {
        try {
          const decoded = JSON.parse(Buffer.from(xPaymentResponse, "base64").toString("utf8"));
          txHash = decoded?.transaction ?? decoded?.txHash ?? null;
        } catch {
          // unparseable settle response
        }
      }
    } else {
      const paymentRequired = res.getHeader("payment-required");
      if (typeof paymentRequired === "string") {
        try {
          const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8"));
          errorCode = decoded?.error ?? null;
        } catch {
          // unparseable challenge
        }
      }
    }

    db.insert(payments)
      .values({
        id: randomUUID(),
        method: req.method,
        resource: req.path,
        status,
        payerAddress,
        payTo: PAY_TO_ADDRESS,
        asset: USDC_BASE_SEPOLIA,
        network: NETWORK,
        amountAtomic,
        txHash,
        errorCode,
        createdAt: new Date(),
      })
      .run();
  });

  next();
});

app.use(
  paymentMiddleware(
    {
      "GET /api/example": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: NETWORK,
            payTo: PAY_TO_ADDRESS,
          },
        ],
        description: "Example paid endpoint (slice 2 stub).",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.get("/api/example", (_req: Request, res: Response) => {
  res.json({
    message: "Paid response. This payload is gated by x402.",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[gateway] listening on http://localhost:${PORT}`);
  console.log(`[gateway] facilitator: ${FACILITATOR_URL}`);
  console.log(`[gateway] payTo:       ${PAY_TO_ADDRESS}`);
  console.log(`[gateway] network:     ${NETWORK} (Base Sepolia)`);
  console.log(`[gateway] db:          ${DB_PATH}`);
  console.log(`[gateway] try:         curl http://localhost:${PORT}/api/example`);
});
