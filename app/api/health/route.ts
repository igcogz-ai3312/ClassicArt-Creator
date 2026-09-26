export async function GET() {
  return Response.json({
    status: "ready",
    app: "classicart-creator",
    integrations: { image: false, video: false, voice: false, storage: false },
  });
}
