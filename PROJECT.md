# WhosTheDumbass.com - Project Documentation

**Last Updated:** 2026-02-06 01:30 GMT+7

## Overview
AI-powered IQ assessment with tamper-proof DNA2 tokens. Users paste their AI chat transcript, get analyzed by ChatGPT/Claude/Gemini, and receive a cryptographically signed score.

## Live URLs
- **Frontend:** https://warwideweb.github.io/whos-the-dumbass/
- **Worker API:** https://whosthedumbass-api.warwideweb.workers.dev

## Repositories
- **Frontend:** https://github.com/warwideweb/whos-the-dumbass
- **Worker:** https://github.com/warwideweb/whosthedumbass-worker

---

## Architecture

### Frontend Flow:
1. User clicks "Copy the prompt"
2. Frontend fetches nonce/timestamp from `/prompt`
3. User pastes prompt + transcript to ChatGPT
4. ChatGPT returns JSON with scores
5. User pastes JSON + original transcript to site
6. Frontend sends to `/verify`
7. Worker validates, normalizes, signs, returns DNA2 token
8. User sees IQ score + 140+ popup for link posting

### Worker Endpoints:
- `GET /prompt` - Returns nonce, timestamp, prompt text
- `POST /verify` - Validates JSON, returns DNA2 token
- `GET /leaderboard` - Returns top entries
- `POST /payment/verify` - Verify Solana payments

---

## Prompt Format (COPY PROMPT)
```
Analyze the TRANSCRIPT and output ONLY strict JSON. No markdown, no commentary, no extra text.

NONCE: <32-hex-chars>
TIMESTAMP: <unix-ms>

Return JSON with EXACTLY these keys and no others:
{
  "v": 1,
  "type": "iq2json",
  "nonce": "<nonce>",
  "timestamp": <timestamp>,
  "profile": {
    "logical_reasoning": <number 0-100>,
    ... (28 total keys)
  },
  "context_messages": <integer >=0>,
  "analysis_summary": "<1-3 sentences ASCII only, max 240 chars>"
}

STRICT RULES:
- Output JSON only.
- Scores must be JSON numbers, not strings.
- If transcript is missing/empty, output ONLY: {"error":"missing transcript"}.

TRANSCRIPT:
PASTE FULL TRANSCRIPT HERE
```

---

## /verify Request
```json
{
  "nonce": "<32-hex-nonce>",
  "timestamp": <unix-ms>,
  "model_json": "<pasted JSON from AI>",
  "transcript_text": "<original transcript>",
  "username": "<username>"
}
```

## /verify Response
```json
{
  "ok": true,
  "dna2": "DNA2::<base64url>",
  "iq_score": 95,
  "transcript_hash": "<sha256>",
  "profile": {...},
  "userId": "user:..."
}
```

---

## Anti-Bullshit Rules (Server-Side)
1. **Short transcript cap:** If `transcript_text < 800 chars` OR `context_messages < 10`, cap all scores at 75
2. **Implausible profile:** If `> 6 categories > 90`, reject with "implausible_profile"
3. **Missing transcript:** Reject if empty/missing
4. **Score normalization:** Accept numbers OR strings, clamp to 0-100, normalize to 4 decimals
5. **Check digit:** D = `floor(timestamp/120000) % 10`, adjust fractions so digit sum mod 10 == D
6. **Fraction diversity:** Max 10 same 4-digit fractions

## Nonce Rules
- 32 hex characters (16 bytes)
- TTL: 120 seconds
- Single-use (KV enforced)

---

## UI Structure
1. **Hero Section** - Title, IQ display, CTA button
2. **Leaderboard** - Global rankings (moved above test)
3. **Test Section** - 3-step flow (Copy, Paste, Verify)
4. **Already Tested** - Shows after completion
5. **Payment Section** - SOL boost payments

## 140+ Link Posting
- If IQ >= 140: Popup with "You're not that big of a dumbass." + link input
- If IQ < 140: Popup with "Nope." - didn't unlock

---

## File Locations
- **Worker:** `/projects/whosthedumbass/worker.js`
- **Frontend:** `/projects/whos-the-dumbass/index.html`
- **Memory:** `/memory/2026-02-06.md`

## Deployment
```bash
# Worker
cd /projects/whosthedumbass
wrangler deploy

# Frontend (GitHub Pages)
cd /projects/whos-the-dumbass
git push origin main
```
