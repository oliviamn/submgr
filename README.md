This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Local config

For local Cloudflare-style variables, copy `.dev.vars.example` to `.dev.vars` and fill in your own values.

Do **not** commit secrets to `wrangler.jsonc`. Keep them in:

- `.dev.vars` for local development
- `wrangler secret put <NAME>` or Cloudflare Dashboard secrets for production

## Authentication (Cloudflare Access)

The dashboard and all management APIs are protected by [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-hostname/) (OAuth at the edge, e.g. Google or GitHub login). Only the client-facing config fetch endpoints (`GET /api/{xray|singbox|clash|surge|raw}/{shortcode}`) are public.

Setup:

1. In the Cloudflare Zero Trust dashboard, create an Access **self-hosted application** covering your app's hostname (and the `workers.dev` URL if you use it).
2. Configure an identity provider (Google, GitHub, ...) and a policy allowing your email(s).
3. Copy your **team domain** (`<team>.cloudflareaccess.com`) and the application's **AUD tag**.
4. Set them on the Worker (non-secret vars are fine, secrets also work):
   - `CF_ACCESS_TEAM_DOMAIN`
   - `CF_ACCESS_AUD`

The Worker also verifies the Access JWT in `middleware.ts`, so requests that bypass Access (e.g. direct `workers.dev` hits) are rejected with 401. If these variables are unset (local development), auth is bypassed with a warning.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
