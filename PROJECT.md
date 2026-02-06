# WhosTheDumbass.com — Project Documentation

**Last Updated:** 2026-02-06 15:32 GMT+7 (Session 4)
**Live Site:** https://whosthedumbass.com
**Admin Panel:** https://whosthedumbass-api.warwideweb.workers.dev/admin?key=YOUR_KEY
**Frontend Repo:** https://github.com/warwideweb/whos-the-dumbass
**Backend Repo:** https://github.com/warwideweb/whosthedumbass-worker

---

## What It Is

AI-powered IQ test. Users copy a prompt, paste into any AI (ChatGPT, Grok, Gemini, Claude), the AI analyzes the user's conversation history and outputs an encoded skill profile, user pastes it back, backend decodes and computes IQ score, user goes on leaderboard.

---

## Current Protocol: WTD v3.2 (Skill Profile)

### How It Works

1. User clicks "Copy Prompt" → gets natural-language prompt asking AI to rate 28 skills
2. User pastes into their AI → AI analyzes conversation history → outputs WTD::<nonce>::<28 scores>::V:<checksum>
3. User copies WTD:: line → pastes into site → backend verifies checksum, un-scrambles fields, deflates scores, computes IQ
4. User added to leaderboard

### Key Design Decisions

- The prompt is NATURAL LANGUAGE (not encoded) so all AIs accept it
- No mention of "IQ" in the prompt — framed as "strengths profile"
- Scores are based on the user's REAL conversation history with their AI
- User is just a copy-paste machine — they don't answer questions
- User CANNOT read which score maps to which category (scrambled order)
- Checksum prevents manual editing of scores
- Backend applies score deflation curve to counter AI flattery
- Multiple anti-cheat heuristics (variance, min score, max elite count, etc.)
- Prompt anchors LOW for blank chats (25-40 default, not 45-55)

### 28 Skill Categories

logical_reasoning, pattern_recognition, verbal_comprehension, mathematical_ability, spatial_reasoning, memory_recall, processing_speed, abstract_thinking, critical_analysis, problem_decomposition, deductive_inductive_reasoning, systems_thinking, creative_problem_solving, knowledge_integration, deep_thinking, critical_thinking, building, electronics, software, communication, creativity, analysis, leadership, research, problem_solving, technical_depth, collaboration, innovation

### Field Scramble

The 28 skills are listed in the prompt in a SCRAMBLED ORDER based on:
```
scrambleOffset = parseInt(nonce.slice(0, 4), 16) % 28
```
The backend un-scrambles using the stored offset. This means the user cannot tell which position = which category.

### Checksum
```
checksum = sum(score[i] * 100 for all i) mod chkMod
where chkMod = 9973 + (sum of nonce ASCII codes mod 97)
```

### Score Deflation (Backend)
- Average > 78: deflate by 0.70 (50 + (score-50)*0.70)
- Average > 68: deflate by 0.85
- Average > 60: deflate by 0.92
- Average <= 60: no deflation

### Anti-Cheat Heuristics (Backend)
- Unique score count must be > 3
- Standard deviation must be > 6
- No more than 4 scores above 92
- No more than 6 scores above 95
- At least 2 scores must be below 55
- Minimum score must be below 55

### IQ Computation
```
cognitiveAvg = average of 11 cognitive keys (65% weight)
skillAvg = average of all 28 keys (35% weight)
compositeScore = cogAvg * 0.65 + skillAvg * 0.35
iqScore = clamp(70, 160, round(70 + compositeScore * 0.9))
```

### Token Format
- Prompt output: `WTD::<nonce>::<28 XX.XX scores separated by |>::V:<checksum>`
- Sealed result: `DNA2::<base64 JSON with HMAC signature>`
- Legacy formats still detected: IQ2ENC::, IQ2RAW2::, IQ2RES2::

---

## Payment Tiers

| Amount | Badge | Position |
|--------|-------|----------|
| $10+ | 💸 Poor and Dumb | Bottom of paid |
| $50+ | 🌍 First World Poor | Mid-tier |
| $100+ | 🐋 Certified Dumbass Whale | High |
| $1000+ | 👑 IQ Slave Owner | TOP |

- Paid users sorted by amount DESC at top of leaderboard
- 140+ IQ can add URL without paying
- Top payer gets glow effect

---

## API Endpoints (Cloudflare Worker)

### Public
- `GET /prompt` — Generate calibration prompt with nonce
- `POST /verify` — Verify WTD:: response, compute IQ, store user
- `GET /leaderboard` — Top 50 users
- `POST /save-link` — Save URL (140+ IQ or paid)
- `POST /boost` — Record payment + badge
- `GET /` or `/health` — Health check

### Admin (X-Admin-Key header or ?key= param)
- `GET /admin` — Dashboard HTML
- `GET /admin/stats` — Stats JSON
- `GET /admin/users` — All users JSON
- `POST /admin/clear-v2` — Clear leaderboard (with backup)

---

## File Structure

### Frontend (GitHub Pages)
```
/projects/whos-the-dumbass/
├── index.html      # Main site (all HTML/CSS/JS in one file)
├── PROJECT.md      # This file
└── CNAME           # whosthedumbass.com
```

### Backend (Cloudflare Worker)
```
/projects/whosthedumbass-worker/
├── worker.js       # Main worker (WTD v3 protocol)
├── wrangler.toml   # Config (KV: NONCES + STORE)
```

---

## KV Namespaces

- **NONCES**: Challenge data (nonce → {scrambleOffset, chkMod, used, expiresAt})
  - ID: 9293be78426d4a5782230cf572eed37f
- **STORE**: User records, leaderboard index
  - ID: f90642152d494b2f817ea4275e854f79

---

## Secrets (Cloudflare Worker)

- `HMAC_SECRET` — Signs DNA2 tokens
- `ADMIN_KEY` — Admin panel access

---

## Deployment

### Frontend
```bash
cd ~/.openclaw/workspace/projects/whos-the-dumbass
git add -A && git commit -m "message" && git push
```

### Backend
```bash
cd ~/.openclaw/workspace/projects/whosthedumbass-worker
npx wrangler deploy
```

---

## Known Issues / History

### Session 1 (v1): Basic IQ test with AI self-assessment
### Session 2 (v2): Task-based verification with checksums  
### Session 3 (v2.1): IQ2RAW2 format, task bank
### Session 4 (v3 — CURRENT): WTD skill profile system

**Fixes in v3.x:**
- Changed from task-based to conversation-history-based scoring
- Changed from encoded machine syntax to natural language prompt
- Changed prefix from IQ2ENC:: to WTD::
- Fixed: Grok rejection (was seeing encoded prompt as jailbreak)
- Fixed: Gemini rejection (was seeing "IQ" keyword)
- Fixed: Blank chat getting 115 IQ (prompt now anchors low for no history)
- Fixed: Score bypass via "give me inflated example" (added multi-layer anti-cheat)
- Fixed: Frontend not recognizing WTD:: format
- Fixed: JS syntax error in setupPasteHandlers
- Fixed: Missing backend endpoints (/prompt, /leaderboard, /save-link, /boost)
- Fixed: Background grid visibility (0.03 → 0.08 opacity)
- Added: Score deflation curve (0.70/0.85/0.92 based on average)
- Added: Anti-cheat heuristics (stddev>6, minScore<55, belowAvgCount>=2, eliteCount<=4)

---

## Important: Recovering Context

If context is lost, read this PROJECT.md first. It contains all architecture decisions, the current protocol, file locations, and deployment steps.

The key files are:
- `index.html` (frontend) 
- `worker.js` (backend)
