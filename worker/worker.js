/**
 * WhosTheDumbass.com - Cloudflare Worker
 * 
 * Security features:
 * - 2-minute single-use nonces (KV storage)
 * - Turnstile bot protection
 * - Check digit validation
 * - HMAC-SHA256 signature (real tamper-proofing)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response("", { headers: corsHeaders });
    }

    // Health check
    if (path === "/" || path === "/health") {
      return json({ 
        ok: true, 
        service: "WhosTheDumbass Anti-Tamper API",
        version: "2.2"
      }, corsHeaders);
    }

    // GET /nonce - Issue a new nonce
    if (path === "/nonce" && request.method === "GET") {
      const nonce = crypto.randomUUID().replace(/-/g, "").toUpperCase();
      const now = Date.now();
      const exp = now + 120_000; // 2 minutes
      
      // Store nonce in KV (expires in 180 seconds)
      await env.NONCES.put(nonce, String(exp), { expirationTtl: 180 });
      
      return json({ 
        ok: true,
        nonce, 
        timestamp: now, 
        expires_at: exp,
        expires_in: 120
      }, corsHeaders);
    }

    // POST /verify - Verify and seal the result
    if (path === "/verify" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body) return json({ ok: false, error: "bad_json" }, corsHeaders, 400);

      const { nonce, timestamp, transcript_hash, profile_json, turnstile_token } = body;

      // 1) Verify nonce exists + not expired + not reused
      const expStr = await env.NONCES.get(nonce);
      if (!expStr) {
        return json({ ok: false, error: "nonce_invalid" }, corsHeaders, 400);
      }
      
      const exp = Number(expStr);
      if (!Number.isFinite(exp) || Date.now() > exp) {
        return json({ ok: false, error: "nonce_expired" }, corsHeaders, 400);
      }

      // 2) Burn nonce (single-use)
      await env.NONCES.delete(nonce);

      // 3) Verify Turnstile (bot control)
      const ip = request.headers.get("CF-Connecting-IP") || "";
      const turnstileOk = await verifyTurnstile(env, turnstile_token, ip);
      if (!turnstileOk) {
        return json({ ok: false, error: "bot_suspected" }, corsHeaders, 403);
      }

      // 4) Parse and validate profile JSON
      const parsed = safeParseJSON(profile_json);
      if (!parsed) {
        return json({ ok: false, error: "profile_not_json" }, corsHeaders, 400);
      }
      
      const validation = validateProfile(parsed, nonce, timestamp);
      if (!validation.ok) {
        return json({ ok: false, error: validation.error }, corsHeaders, 400);
      }

      // 5) Calculate IQ from scores
      const scores = Object.values(parsed.profile);
      const avgScore = scores.reduce((a, b) => a + parseFloat(b), 0) / scores.length;
      const iq = Math.round(70 + (avgScore * 0.9));
      const clampedIQ = Math.min(160, Math.max(70, iq));

      // 6) Canonicalize + sign (REAL tamper-proof)
      const canonical = canonicalize({
        nonce,
        timestamp,
        transcript_hash: transcript_hash || "",
        profile: parsed.profile,
        context_messages: parsed.context_messages,
        analysis_summary: parsed.analysis_summary,
        iq: clampedIQ,
      });
      
      const sig = await hmacSha256Hex(env.HMAC_SECRET, canonical);

      // Sealed token
      const sealed = {
        v: 1,
        nonce,
        timestamp,
        transcript_hash: transcript_hash || "",
        payload: parsed,
        iq: clampedIQ,
        tier: getTier(clampedIQ),
        sig,
      };
      
      const b64 = b64encode(JSON.stringify(sealed));
      
      return json({ 
        ok: true, 
        token: `DNA2::${b64}`,
        iq: clampedIQ,
        tier: getTier(clampedIQ),
        roast: getRoast(clampedIQ)
      }, corsHeaders);
    }

    // POST /validate-token - Verify a sealed token (for leaderboard etc)
    if (path === "/validate-token" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (!body || !body.token) {
        return json({ ok: false, error: "missing_token" }, corsHeaders, 400);
      }

      const token = body.token;
      if (!token.startsWith("DNA2::")) {
        return json({ ok: false, error: "invalid_token_format" }, corsHeaders, 400);
      }

      try {
        const b64 = token.substring(6);
        const sealed = JSON.parse(b64decode(b64));
        
        // Rebuild canonical and verify signature
        const canonical = canonicalize({
          nonce: sealed.nonce,
          timestamp: sealed.timestamp,
          transcript_hash: sealed.transcript_hash || "",
          profile: sealed.payload.profile,
          context_messages: sealed.payload.context_messages,
          analysis_summary: sealed.payload.analysis_summary,
          iq: sealed.iq,
        });
        
        const expectedSig = await hmacSha256Hex(env.HMAC_SECRET, canonical);
        
        if (sealed.sig !== expectedSig) {
          return json({ ok: false, error: "signature_invalid", tampered: true }, corsHeaders, 400);
        }
        
        return json({ 
          ok: true, 
          valid: true,
          iq: sealed.iq,
          tier: sealed.tier,
          timestamp: sealed.timestamp
        }, corsHeaders);
        
      } catch (e) {
        return json({ ok: false, error: "token_parse_failed" }, corsHeaders, 400);
      }
    }

    return json({ ok: false, error: "not_found" }, corsHeaders, 404);
  }
};

// ===== HELPER FUNCTIONS =====

function json(obj, headers = {}, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function safeParseJSON(x) {
  if (typeof x !== "string") return null;
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

// ===== TURNSTILE VERIFICATION =====
async function verifyTurnstile(env, token, ip) {
  if (!token) return false;
  if (!env.TURNSTILE_SECRET) return true; // Skip if not configured
  
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await resp.json().catch(() => null);
  return !!(data && data.success);
}

// ===== HMAC SIGNING =====
async function hmacSha256Hex(secret, msg) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ===== CANONICALIZATION =====
function canonicalize(obj) {
  return stableStringify(obj);
}

function stableStringify(x) {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  const keys = Object.keys(x).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(x[k])).join(",") + "}";
}

function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function b64decode(str) {
  return decodeURIComponent(escape(atob(str)));
}

// ===== PROFILE VALIDATION =====
const KEYS = [
  "logical_reasoning", "pattern_recognition", "verbal_comprehension", "mathematical_ability",
  "spatial_reasoning", "memory_recall", "processing_speed", "abstract_thinking", "critical_analysis",
  "problem_decomposition", "deductive_inductive_reasoning", "systems_thinking", "creative_problem_solving",
  "knowledge_integration", "deep_thinking", "critical_thinking", "building", "electronics", "software",
  "communication", "creativity", "analysis", "leadership", "research", "problem_solving", "technical_depth",
  "collaboration", "innovation"
];

function validateProfile(obj, nonce, timestamp) {
  if (!obj || typeof obj !== "object") return { ok: false, error: "bad_profile_obj" };
  if (!obj.profile || typeof obj.profile !== "object") return { ok: false, error: "missing_profile" };
  
  // Require fields
  if (!Number.isInteger(obj.context_messages)) return { ok: false, error: "context_messages_not_int" };
  if (typeof obj.analysis_summary !== "string") return { ok: false, error: "analysis_summary_not_string" };
  
  // Validate nonce matches
  if (obj.nonce !== nonce) return { ok: false, error: "nonce_mismatch" };
  
  // Check all keys exist
  for (const k of KEYS) {
    if (!(k in obj.profile)) return { ok: false, error: `missing_key_${k}` };
  }
  
  // Determine check digit D from first score
  const first = obj.profile[KEYS[0]];
  const firstInfo = parseScore(first);
  if (!firstInfo.ok) return { ok: false, error: `bad_score_${KEYS[0]}` };
  const D = firstInfo.check;
  
  // Validate all scores have same check digit
  for (const k of KEYS) {
    const info = parseScore(obj.profile[k]);
    if (!info.ok) return { ok: false, error: `bad_score_${k}` };
    if (info.check !== D) return { ok: false, error: "check_digit_mismatch" };
    if (info.value < 0 || info.value > 100) return { ok: false, error: "score_out_of_range" };
  }
  
  return { ok: true };
}

function parseScore(v) {
  const s = (typeof v === "number") ? v.toFixed(4) : (typeof v === "string" ? v : "");
  if (!/^\d{1,3}\.\d{4}$/.test(s)) return { ok: false };
  const num = Number(s);
  if (!Number.isFinite(num)) return { ok: false };
  const frac = s.split(".")[1];
  const sumDigits = frac.split("").reduce((a, c) => a + (c.charCodeAt(0) - 48), 0);
  return { ok: true, value: num, check: (sumDigits % 10) };
}

// ===== IQ TIERS & ROASTS =====
function getTier(iq) {
  if (iq >= 145) return "galaxy_brain";
  if (iq >= 130) return "genius";
  if (iq >= 115) return "smart";
  if (iq >= 100) return "average";
  if (iq >= 85) return "below_average";
  return "dumbass";
}

function getRoast(iq) {
  if (iq >= 145) return "Galaxy brain detected. You're actually scary smart. Touch grass immediately.";
  if (iq >= 130) return "Certified genius. You probably corrected your teacher as a kid. Annoying but impressive.";
  if (iq >= 115) return "Above average. Smart enough to know you're not that smart. That's actually smart.";
  if (iq >= 100) return "Perfectly average. The human equivalent of room temperature. Congratulations?";
  if (iq >= 85) return "Below average. Your brain called. It wants a refund.";
  return "Certified dumbass. If stupidity was an Olympic sport, you'd forget to show up.";
}
