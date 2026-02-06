# WhosTheDumbass.com - Project Documentation

**Last Updated:** 2026-02-06
**Live Site:** https://whosthedumbass.com
**Admin Panel:** https://whosthedumbass-api.warwideweb.workers.dev/admin
**Frontend Repo:** https://github.com/warwideweb/whos-the-dumbass
**Backend Repo:** https://github.com/warwideweb/whosthedumbass-worker

---

## 🎯 What It Is

AI-powered IQ test using the IQ2 v2 protocol. Users copy a "Calibration Pack" prompt, paste it into any AI (ChatGPT, Grok, Gemini), get a scored response, and paste it back for verification.

---

## 🔧 IQ2 v2 Protocol

### How It Works
1. User clicks "Copy Prompt" → gets Calibration Pack with nonce, timestamp, 10 tasks
2. User pastes into any AI → AI returns `IQ2RES2::<base64url>` response
3. User pastes response back → backend verifies
4. Backend grades tasks, validates checksums, computes IQ score
5. User added to leaderboard

### Task Bank (300+)
- **Logic tasks** (100): Syllogisms, conditionals, deduction
- **Number series** (100): Pattern recognition
- **Verbal analogy** (100): Word relationships
- **Attention tasks** (20): "Select C" type checks
- **Decomposition** (20): Ordering tasks

### Checksums (Anti-Tamper)
- **c1**: Sum of 28 profile scores mod 97
- **c2**: Sum of answer codes + memory token ASCII mod 97
- **c3**: Sum of last decimal digits mod 10

### Scoring Formula
- 60% Objective score (graded tasks)
- 40% Profile average (AI self-assessment)
- Mapped to IQ scale 70-160

---

## 💰 Payment Tiers

| Amount | Badge | Position |
|--------|-------|----------|
| $10+ | 💸 Poor and Dumb | Bottom of paid section |
| $50+ | 🌍 First World Poor | Mid-tier |
| $100+ | 🐋 Certified Dumbass Whale | High position |
| $1000+ | 👑 IQ Slave Owner | **TOP OF LEADERBOARD** |

### Features
- Paid users sorted by amount (highest first)
- Top payer gets glowing name, highlighted row
- All paid users can add URL to leaderboard
- IQ 140+ can add URL without paying

---

## 📁 File Structure

### Frontend (GitHub Pages)
```
/projects/whos-the-dumbass/
├── index.html          # Main site
├── PROJECT.md          # This file
└── CNAME               # whosthedumbass.com
```

### Backend (Cloudflare Worker)
```
/projects/whosthedumbass/
├── worker.js           # Main worker (IQ2 v2)
├── worker-v1-backup.js # v1 backup
├── wrangler.toml       # Cloudflare config
└── .wrangler/          # Build artifacts
```

---

## 🔌 API Endpoints

### Public
- `GET /prompt` - Get Calibration Pack with nonce
- `POST /verify` - Verify IQ2RES2 response, get score
- `GET /leaderboard` - Get top 50 users
- `POST /save-link` - Save profile URL (140+ IQ or paid)
- `POST /boost` - Record payment, assign badge, save URL

### Admin (requires X-Admin-Key header)
- `GET /admin` - Admin dashboard HTML
- `GET /admin/stats` - Dashboard stats
- `GET /admin/users` - List all users
- `POST /admin/clear-v2` - Clear leaderboard

---

## 🚨 Important Code Locations

### IP Limit (Currently DISABLED for testing)
```javascript
// In worker.js, search for:
/* === IP LIMIT CODE (DISABLED FOR TESTING) ===
```

### Payment Badge Logic
```javascript
// In worker.js:
function getPaymentBadge(boostAmount) { ... }
```

### Leaderboard Sorting
```javascript
// In worker.js:
async function getLeaderboard(env) { ... }
// Sorts: paid users by amount DESC, then IQ DESC
```

### 140+ IQ Popup
```javascript
// In index.html:
function showLinkPopup(iq) { ... }
function processResult(iq, ...) { ... }
```

---

## 🔄 Recent Changes (2026-02-06)

### Session 1: IQ2 v2 Protocol
- Implemented task-based verification
- 300+ task bank
- Base64URL response format
- Checksums c1, c2, c3
- Admin dashboard at /admin

### Session 2: Payment Tiers
- Added $10/$50/$100/$1000+ tiers
- Badge system with glow effects
- Paid users sorted at top
- URL input on payment

### Session 3: UI Fixes
- Tier info display in payment section
- Stats (Tests Today, Avg IQ) now fetched from API
- Verify success scrolls to top
- 140+ IQ popup with optional URL
- Skip button added to popup

---

## 🛠️ Deployment

### Frontend
```bash
cd /projects/whos-the-dumbass
git add -A && git commit -m "message" && git push
# Auto-deploys to GitHub Pages
```

### Backend
```bash
cd /projects/whosthedumbass
git add -A && git commit -m "message" && git push
npx wrangler deploy
```

### Set Admin Key (one time)
```bash
cd /projects/whosthedumbass
npx wrangler secret put ADMIN_KEY
# Enter your password when prompted
```

---

## ⚠️ To Restore IP Limits

1. Open `/projects/whosthedumbass/worker.js`
2. Search for `=== IP LIMIT CODE (DISABLED`
3. Remove the `/*` and `*/` comment markers
4. Do the same for `=== IP MARK SUBMITTED CODE`
5. Deploy: `npx wrangler deploy`

---

## 📞 Support

If context is lost, read this file first. All key decisions and code locations are documented above.
