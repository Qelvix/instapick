# Instapick

Pick a random winner from an Instagram post's comments — with time-window and keyword filters — using the official Instagram Graph API.

## Stack

- Next.js 16 (App Router, Turbopack)
- Prisma 6 + PostgreSQL
- Auth.js (NextAuth v5 beta) with the Facebook provider

## How auth works

Instagram comments are only reachable through the Instagram Graph API, which requires:

1. An Instagram **Business or Creator** account
2. Linked to a **Facebook Page**
3. Authorized via **Facebook Login** with the `instagram_basic` and `instagram_manage_comments` scopes

There is no standalone "Instagram API" login anymore — it's all routed through Facebook Login + the Graph API.

## Meta app setup (one-time)

1. Create an app at [developers.facebook.com](https://developers.facebook.com/apps) → type "Business"
2. Add the **Facebook Login** product
3. Under Facebook Login → Settings, add the OAuth redirect URI:
   `http://localhost:3000/api/auth/callback/facebook` (and your production URL later)
4. Under App Roles → Roles, add any Instagram/Facebook accounts you want to test with as **Testers** — this lets you skip App Review for now
5. Copy the App ID / App Secret into `.env` as `AUTH_FACEBOOK_ID` / `AUTH_FACEBOOK_SECRET`
6. Going public later requires **App Review** (business verification, privacy policy URL, data deletion callback, and a screencast demo of the flow)

## Local setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, AUTH_FACEBOOK_ID/SECRET
npx prisma migrate dev
npm run dev
```

## How it works

1. User signs in with Facebook (`/api/auth/callback/facebook`) → we exchange the short-lived token for a long-lived one (~60 days) and resolve the linked Instagram Business account ID
2. `/api/media` lists the account's recent posts
3. `/api/comments?mediaId=...` fetches + caches all comments (including replies) for a post
4. User sets filters (time window, keyword, include replies, one-entry-per-user, winner count)
5. `/api/draw` applies filters to the cached comments and picks winner(s) using a seeded random shuffle — the seed is stored with the draw for reproducibility/audit

## Known limitations (MVP)

- No token refresh cron yet — long-lived tokens expire after ~60 days and currently require re-login
- No App Review flow implemented — only accounts added as Testers in the Meta dashboard can connect
