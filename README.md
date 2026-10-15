# αFunding: Delta India vs CoinSwitch funding spread monitor
Monitoring only. No trading code, no exchange API keys, no email or Telegram. Everything is read on the password-protected dashboard.
## Setup
1. `npm install && cp .env.example .env.local`, fill every variable. Create a free Neon project and paste its connection string as DATABASE_URL (tables are created automatically).
2. `npm run dev`, `npm test`.
## Deploy (Vercel)
Push to GitHub, import in Vercel, add all env vars. Then in the GitHub repo add secrets APP_URL (https://your-app.vercel.app, no trailing slash) and CRON_SECRET (same value as Vercel). `.github/workflows/check.yml` calls /api/cron every 5 minutes. GitHub schedules can lag and pause after 60 days of repo inactivity; cron-job.org works too. vercel.json holds a daily backup cron only (Hobby limits cron frequency, check Vercel's current docs).
## Verify the loop
`curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron` should return JSON with matched > 0. Reload the dashboard: "Last scheduled check" updates and history builds.
## Password
DASHBOARD_PASSWORD protects the site with the browser's built-in password prompt (username can be anything). The cron endpoint uses CRON_SECRET instead. Trade-offs: no logout button and no lockout after wrong guesses, so use a long password.
## Direction logic
Positive funding = longs pay shorts. Long where funding is lowest, short where highest. Delta -1%, CoinSwitch -2% -> long CoinSwitch, short Delta, +1% per interval.
## Verify before trusting
Delta funding unit (DELTA_RATE_IN_PERCENT), CoinSwitch unit (CS_RATE_IN_PERCENT), intervals (*_INTERVAL_HOURS), fees (FEE_ROUND_TRIP_PCT), and nats.ws on Vercel. Compare BTC and ETH with each app first.
## Storage note
About 100 coins x 288 checks/day x 30 days is roughly 860k rows; retention deletes older data (RETENTION_DAYS).

## Files
app/page.tsx (dashboard), app/api/data/route.ts (rates, alerts, history), app/api/cron/route.ts (5-minute check), middleware.ts (password), lib/ (core, exchanges, alerts, db), tests/.
