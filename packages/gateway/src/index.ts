import "dotenv/config";
import express, { type Request, type Response } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const PORT = Number(process.env.PORT ?? 3000);
const PLACEHOLDER_PAY_TO = "0x0000000000000000000000000000000000000001";
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS ?? PLACEHOLDER_PAY_TO;
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const NETWORK = "eip155:84532";

if (PAY_TO_ADDRESS === PLACEHOLDER_PAY_TO) {
  console.warn(
    "[gateway] PAY_TO_ADDRESS is not set — using a placeholder. " +
      "402 generation will work, but settled funds would go to the placeholder. " +
      "Set PAY_TO_ADDRESS in .env before exercising the SDK end-to-end.",
  );
}

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK,
  new ExactEvmScheme(),
);

const app = express();

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
  console.log(`[gateway] try:         curl http://localhost:${PORT}/api/example`);
});
