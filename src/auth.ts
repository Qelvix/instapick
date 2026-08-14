import NextAuth from "next-auth";
import Facebook from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Instagram comments live behind the Instagram Graph API, which is reached
// through a Facebook Login token tied to a Page + linked IG Business account.
const IG_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_comments",
].join(",");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Facebook({
      authorization: {
        url: "https://www.facebook.com/v19.0/dialog/oauth",
        params: { scope: IG_SCOPES },
      },
    }),
  ],
  session: { strategy: "database" },
  events: {
    // Fires after the adapter has persisted the Account row, so it's safe
    // to update it here. Exchanges the short-lived token for a long-lived
    // one (~60 days) and resolves the linked IG Business account id up
    // front, so later comment fetches don't need to re-derive it.
    async linkAccount({ account }) {
      if (account.provider !== "facebook" || !account.access_token) return;

      const longLived = await exchangeForLongLivedToken(account.access_token);
      const igAccountId = await resolveInstagramBusinessAccountId(longLived.access_token);

      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          igAccessToken: longLived.access_token,
          igAccessTokenExp: new Date(Date.now() + longLived.expires_in * 1000),
          igBusinessAccountId: igAccountId,
        },
      });
    },
  },
});

async function exchangeForLongLivedToken(shortLivedToken: string) {
  const url = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.AUTH_FACEBOOK_ID!);
  url.searchParams.set("client_secret", process.env.AUTH_FACEBOOK_SECRET!);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to exchange Facebook token: ${await res.text()}`);
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

async function resolveInstagramBusinessAccountId(accessToken: string) {
  const pagesUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
  pagesUrl.searchParams.set("access_token", accessToken);

  const pagesRes = await fetch(pagesUrl.toString());
  const pages = (await pagesRes.json()) as { data: { id: string }[] };

  for (const page of pages.data ?? []) {
    const igUrl = new URL(`https://graph.facebook.com/v19.0/${page.id}`);
    igUrl.searchParams.set("fields", "instagram_business_account");
    igUrl.searchParams.set("access_token", accessToken);

    const igRes = await fetch(igUrl.toString());
    const ig = (await igRes.json()) as { instagram_business_account?: { id: string } };
    if (ig.instagram_business_account?.id) {
      return ig.instagram_business_account.id;
    }
  }
  return null;
}
