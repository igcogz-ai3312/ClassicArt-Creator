import { env } from "cloudflare:workers";

export async function GET() {
  const configured = env as unknown as Record<string, unknown>;
  return Response.json({
    status: "ready",
    app: "classicart-creator",
    integrations: {
      image: Boolean(configured.FAL_KEY),
      video: Boolean(configured.FAL_KEY),
      voice: Boolean(configured.ELEVENLABS_API_KEY),
      storage: Boolean(configured.DB && configured.MEDIA),
    },
  });
}
