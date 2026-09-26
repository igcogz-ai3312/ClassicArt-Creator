import { getChatGPTUser } from "@/app/chatgpt-auth";

export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (user) return { ok: true as const, userId: user.userId };

  // Local previews can be used without a production identity gateway. A
  // deployed build fails closed so public users cannot spend provider credits.
  if (process.env.NODE_ENV === "development") {
    return { ok: true as const, userId: "local-preview" };
  }

  return {
    ok: false as const,
    response: Response.json(
      { code: "authentication_required", message: "Inicia sesión para usar las herramientas de creación." },
      { status: 401 },
    ),
  };
}
