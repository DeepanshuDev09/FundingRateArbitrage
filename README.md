# αFunding
Open the site, enter the password, and it scans Delta India and CoinSwitch and shows the top 5 coins by funding rate difference. No database, no background jobs, no alerts. Monitoring only, no exchange keys.

## Run locally
npm install
cp .env.example .env.local   (set DASHBOARD_PASSWORD)
npm run dev                   (http://localhost:3000)

## Deploy on Vercel
Push to GitHub, import the repo in Vercel, add the variables from .env.example, deploy.

## Structure
public/            static files
src/app/page.tsx   the page (top 5 cards)
src/app/api/rates/route.ts   scans both exchanges
src/lib/core.ts    spread + direction logic
src/lib/exchanges.ts   Delta and CoinSwitch fetchers
src/middleware.ts  password prompt

## Direction logic
Positive funding means longs pay shorts. Go long where funding is lowest, short where it is highest. Delta -1%, CoinSwitch -2% -> long CoinSwitch, short Delta, +1% per interval.

## Verify first
Funding units and interval are assumptions (see .env.example). Compare BTC with each app. CoinSwitch is read from its public NATS stream; if its badge shows an error on Vercel, send me the message.
