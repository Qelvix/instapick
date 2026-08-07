import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class NoIgAccountError extends Error {}

/** Resolves the signed-in user's Instagram Business account + a still-valid access token. */
export async function getIgAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new NoIgAccountError("Not signed in");
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "facebook" },
  });

  if (!account?.igBusinessAccountId || !account.igAccessToken) {
    throw new NoIgAccountError(
      "No Instagram Business account linked. Connect a Facebook Page with a linked Instagram Business/Creator account."
    );
  }

  if (account.igAccessTokenExp && account.igAccessTokenExp < new Date()) {
    throw new NoIgAccountError("Instagram access token expired. Please sign in again.");
  }

  return {
    userId: session.user.id,
    igBusinessAccountId: account.igBusinessAccountId,
    accessToken: account.igAccessToken,
  };
}
