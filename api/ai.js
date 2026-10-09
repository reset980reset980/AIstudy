// 자동 생성 파일입니다. server/ai.ts를 고친 뒤 npm run build:api 로 다시 만드세요.

// server/ai.ts
import crypto from "node:crypto";

// shared/ai/providers.ts
var AIError = class extends Error {
  constructor(message, code, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.name = "AIError";
  }
};
var GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
var OPENAI_BASE = "https://api.openai.com/v1";
var ANTHROPIC_BASE = "https://api.anthropic.com/v1";
function anthropicHeaders(apiKey) {
  return {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    // 브라우저에서 직접 호출할 때 필요한 헤더 (서버에서는 무시됨)
    "anthropic-dangerous-direct-browser-access": "true",
    "content-type": "application/json"
  };
}
async function readError(res) {
  try {
    const data = await res.json();
    return data?.error?.message || data?.message || JSON.stringify(data).slice(0, 300);
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}
function httpError(provider, status, detail) {
  const name = provider === "gemini" ? "Gemini" : provider === "openai" ? "OpenAI" : "Claude";
  if (status === 401 || status === 403 || status === 400 && /api key|api_key|invalid.*key|permission/i.test(detail)) {
    return new AIError(`${name} \uD0A4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uAC70\uB098 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC124\uC815\uC5D0\uC11C \uD0A4\uB97C \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.`, "auth");
  }
  if (status === 429) {
    return new AIError(`${name} \uC0AC\uC6A9 \uD55C\uB3C4\uB97C \uB118\uC5C8\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uAC70\uB098 \uB2E4\uB978 AI\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.`, "quota", true);
  }
  if (status === 404) {
    return new AIError(`${name}\uC5D0\uC11C \uC774 \uBAA8\uB378\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC124\uC815\uC5D0\uC11C \uB2E4\uB978 \uBAA8\uB378\uC744 \uACE8\uB77C \uC8FC\uC138\uC694. (${detail})`, "unsupported");
  }
  if (status >= 500 || status === 529) {
    return new AIError(`${name} \uC11C\uBC84\uAC00 \uC77C\uC2DC\uC801\uC73C\uB85C \uBC14\uC069\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.`, "network", true);
  }
  return new AIError(`${name} \uC694\uCCAD \uC624\uB958 (${status}): ${detail}`, "unknown");
}
async function post(provider, url, headers, body) {
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new AIError("\uC778\uD130\uB137 \uC5F0\uACB0 \uB610\uB294 AI \uC11C\uBC84 \uC811\uC18D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", "network", true);
  }
  if (!res.ok) throw httpError(provider, res.status, await readError(res));
  return res.json();
}
async function callGemini(r) {
  const parts = [];
  if (r.file) parts.push({ inlineData: { mimeType: r.file.mimeType, data: r.file.base64 } });
  parts.push({ text: r.userText });
  const data = await post("gemini", `${GEMINI_BASE}/models/${encodeURIComponent(r.model)}:generateContent`, {
    "x-goog-api-key": r.apiKey,
    // AIza·AQ. 키 모두 이 헤더로 동작
    "content-type": "application/json"
  }, {
    systemInstruction: { parts: [{ text: r.system }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: r.schema,
      maxOutputTokens: r.maxTokens,
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: "LOW" }
    }
  });
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  const reason = cand?.finishReason;
  if (data?.promptFeedback?.blockReason || reason === "SAFETY" || reason === "PROHIBITED_CONTENT") {
    throw new AIError("AI \uC548\uC804 \uC815\uCC45\uC5D0 \uC758\uD574 \uB2F5\uBCC0\uC774 \uCC28\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uB978 \uC0AC\uC9C4\uC73C\uB85C \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", "blocked");
  }
  if (reason === "RECITATION") throw new AIError("\uC800\uC791\uAD8C \uBB38\uC81C\uB85C AI\uAC00 \uB2F5\uBCC0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uBB38\uC81C \uBD80\uBD84\uB9CC \uC798\uB77C\uC11C \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.", "blocked");
  if (reason === "MAX_TOKENS") throw new AIError("\uB2F5\uBCC0\uC774 \uAE38\uC5B4 \uC911\uAC04\uC5D0 \uC798\uB838\uC2B5\uB2C8\uB2E4.", "truncated", true);
  if (!text) throw new AIError(`AI\uAC00 \uBE48 \uB2F5\uBCC0\uC744 \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4. (\uC0AC\uC720: ${reason || "\uC54C \uC218 \uC5C6\uC74C"})`, "format", true);
  return text;
}
async function callOpenAI(r) {
  const content = [];
  if (r.file) {
    if (r.file.mimeType === "application/pdf") {
      content.push({ type: "input_file", filename: "problem.pdf", file_data: `data:application/pdf;base64,${r.file.base64}` });
    } else {
      content.push({ type: "input_image", image_url: `data:${r.file.mimeType};base64,${r.file.base64}` });
    }
  }
  content.push({ type: "input_text", text: r.userText });
  const data = await post("openai", `${OPENAI_BASE}/responses`, {
    authorization: `Bearer ${r.apiKey}`,
    "content-type": "application/json"
  }, {
    model: r.model,
    instructions: r.system,
    input: [{ role: "user", content }],
    max_output_tokens: r.maxTokens,
    store: false,
    text: { format: { type: "json_schema", name: r.schemaName, schema: r.schema, strict: true } }
  });
  if (data?.status === "incomplete") {
    if (data?.incomplete_details?.reason === "content_filter") throw new AIError("AI \uC548\uC804 \uC815\uCC45\uC5D0 \uC758\uD574 \uB2F5\uBCC0\uC774 \uCC28\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "blocked");
    throw new AIError("\uB2F5\uBCC0\uC774 \uAE38\uC5B4 \uC911\uAC04\uC5D0 \uC798\uB838\uC2B5\uB2C8\uB2E4.", "truncated", true);
  }
  let text = typeof data?.output_text === "string" ? data.output_text : "";
  let refusal = "";
  if (!text) {
    for (const item of data?.output || []) {
      for (const c of item?.content || []) {
        if (c?.type === "output_text" && c.text) text += c.text;
        if (c?.type === "refusal") refusal = c.refusal || "\uAC70\uC808\uB428";
      }
    }
  }
  if (refusal && !text) throw new AIError(`AI\uAC00 \uB2F5\uBCC0\uC744 \uAC70\uC808\uD588\uC2B5\uB2C8\uB2E4: ${refusal}`, "blocked");
  if (!text) throw new AIError("AI\uAC00 \uBE48 \uB2F5\uBCC0\uC744 \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4.", "format", true);
  return text;
}
async function callAnthropic(r) {
  const content = [];
  if (r.file) {
    if (r.file.mimeType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: r.file.base64 } });
    } else {
      content.push({ type: "image", source: { type: "base64", media_type: r.file.mimeType, data: r.file.base64 } });
    }
  }
  content.push({ type: "text", text: r.userText });
  const data = await post("anthropic", `${ANTHROPIC_BASE}/messages`, anthropicHeaders(r.apiKey), {
    model: r.model,
    max_tokens: r.maxTokens,
    system: r.system,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: r.schema } }
  });
  if (data?.stop_reason === "max_tokens") throw new AIError("\uB2F5\uBCC0\uC774 \uAE38\uC5B4 \uC911\uAC04\uC5D0 \uC798\uB838\uC2B5\uB2C8\uB2E4.", "truncated", true);
  if (data?.stop_reason === "refusal") throw new AIError("AI \uC548\uC804 \uC815\uCC45\uC5D0 \uC758\uD574 \uB2F5\uBCC0\uC774 \uCC28\uB2E8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", "blocked");
  const text = (data?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  if (!text) throw new AIError("AI\uAC00 \uBE48 \uB2F5\uBCC0\uC744 \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4.", "format", true);
  return text;
}
function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
      }
    }
    throw new AIError("AI \uB2F5\uBCC0 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", "format", true);
  }
}
async function generateStructured(r) {
  const text = r.provider === "gemini" ? await callGemini(r) : r.provider === "openai" ? await callOpenAI(r) : await callAnthropic(r);
  return parseJson(text);
}
async function testApiKey(provider, apiKey, model) {
  const key = apiKey.trim();
  try {
    let res;
    if (provider === "gemini") {
      res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
    } else if (provider === "openai") {
      res = await fetch(`${OPENAI_BASE}/models`, { headers: { authorization: `Bearer ${key}` } });
    } else {
      res = await fetch(`${ANTHROPIC_BASE}/models?limit=100`, { headers: anthropicHeaders(key) });
    }
    if (!res.ok) {
      const err = httpError(provider, res.status, await readError(res));
      return { ok: false, message: err.message };
    }
    const data = await res.json();
    const ids = provider === "gemini" ? (data?.models || []).map((m) => String(m.name || "").replace(/^models\//, "")) : (data?.data || []).map((m) => String(m.id || ""));
    if (model && ids.length && !ids.includes(model)) {
      return { ok: true, message: `\uD0A4\uB294 \uC815\uC0C1\uC785\uB2C8\uB2E4. \uB2E4\uB9CC \uC120\uD0DD\uD55C \uBAA8\uB378(${model})\uC774 \uBAA9\uB85D\uC5D0 \uBCF4\uC774\uC9C0 \uC54A\uC544\uC694. \uB2E4\uB978 \uBAA8\uB378\uC744 \uACE8\uB77C \uBCF4\uC138\uC694.` };
    }
    return { ok: true, message: "\uC815\uC0C1 \uC791\uB3D9\uD558\uB294 \uD0A4\uC785\uB2C8\uB2E4." };
  } catch {
    return { ok: false, message: "\uC811\uC18D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC778\uD130\uB137 \uC5F0\uACB0\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694." };
  }
}

// shared/ai/models.ts
function checkKeyFormat(provider, key) {
  const k = key.trim();
  if (!k) return { ok: false, message: "\uD0A4\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694." };
  if (/\s/.test(k)) return { ok: false, message: "\uD0A4 \uC911\uAC04\uC5D0 \uACF5\uBC31\uC774 \uC788\uC2B5\uB2C8\uB2E4." };
  switch (provider) {
    case "gemini":
      if (k.startsWith("AQ.")) return { ok: true, message: "\uC0C8 \uBC29\uC2DD(AQ.) Gemini \uD0A4" };
      if (k.startsWith("AIza")) return { ok: true, message: "\uAE30\uC874 \uBC29\uC2DD(AIza) Gemini \uD0A4" };
      return { ok: false, message: "Gemini \uD0A4\uB294 AQ. \uB610\uB294 AIza\uB85C \uC2DC\uC791\uD569\uB2C8\uB2E4." };
    case "openai":
      if (k.startsWith("sk-ant-")) return { ok: false, message: "Anthropic \uD0A4\uC785\uB2C8\uB2E4. Claude \uCE78\uC5D0 \uB123\uC5B4 \uC8FC\uC138\uC694." };
      if (k.startsWith("sk-")) return { ok: true, message: "OpenAI \uD0A4" };
      return { ok: false, message: "OpenAI \uD0A4\uB294 sk-\uB85C \uC2DC\uC791\uD569\uB2C8\uB2E4." };
    case "anthropic":
      if (k.startsWith("sk-ant-")) return { ok: true, message: "Anthropic \uD0A4" };
      return { ok: false, message: "Anthropic \uD0A4\uB294 sk-ant-\uB85C \uC2DC\uC791\uD569\uB2C8\uB2E4." };
  }
}

// server/ai.ts
var ADMIN_EMAILS = ["reset98@gmail.com"];
var FIREBASE_PROJECT_ID = "a-istudy-cebe2";
var CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
var PROVIDERS = ["gemini", "openai", "anthropic"];
var certCache = null;
async function getCerts() {
  if (certCache && certCache.expires > Date.now()) return certCache.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error("\uC778\uC99D\uC11C \uC870\uD68C \uC2E4\uD328");
  const certs = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1] || 3600);
  certCache = { certs, expires: Date.now() + maxAge * 1e3 };
  return certs;
}
function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}
async function verifyAdmin(authHeader) {
  const token = (authHeader || "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  let header, payload;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch {
    throw new HttpError(401, "\uC798\uBABB\uB41C \uC778\uC99D \uC815\uBCF4\uC785\uB2C8\uB2E4.");
  }
  if (header.alg !== "RS256" || !header.kid) throw new HttpError(401, "\uC798\uBABB\uB41C \uC778\uC99D \uC815\uBCF4\uC785\uB2C8\uB2E4.");
  const certs = await getCerts();
  const cert = certs[header.kid];
  if (!cert) throw new HttpError(401, "\uC778\uC99D \uC815\uBCF4\uAC00 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  if (!verifier.verify(cert, Buffer.from(parts[2], "base64url"))) throw new HttpError(401, "\uC798\uBABB\uB41C \uC778\uC99D \uC815\uBCF4\uC785\uB2C8\uB2E4.");
  const now = Math.floor(Date.now() / 1e3);
  if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new HttpError(401, "\uB2E4\uB978 \uD504\uB85C\uC81D\uD2B8\uC758 \uC778\uC99D \uC815\uBCF4\uC785\uB2C8\uB2E4.");
  }
  if (typeof payload.exp !== "number" || payload.exp < now - 30 || payload.iat > now + 300 || !payload.sub) {
    throw new HttpError(401, "\uB85C\uADF8\uC778\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.");
  }
  const email = String(payload.email || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email) || payload.email_verified !== true) {
    throw new HttpError(403, "\uAD00\uB9AC\uC790 \uACC4\uC815\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uB294 \uAE30\uB2A5\uC785\uB2C8\uB2E4.");
  }
  return { uid: payload.sub, email };
}
function encKey() {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new HttpError(500, "\uC11C\uBC84 \uC554\uD638\uD654 \uBE44\uBC00\uAC12(KEY_ENCRYPTION_SECRET)\uC774 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. Vercel \uD658\uACBD\uBCC0\uC218\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}
function aad(uid, provider) {
  return Buffer.from(`aistudy:v1:${uid}:${provider}`);
}
function encrypt(plain, uid, provider) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  cipher.setAAD(aad(uid, provider));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}
function decrypt(blob, uid, provider) {
  const [v, iv, tag, ct] = String(blob || "").split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new HttpError(400, "\uC800\uC7A5\uB41C \uD0A4 \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC124\uC815\uC5D0\uC11C \uD0A4\uB97C \uB2E4\uC2DC \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.");
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "base64"));
    d.setAAD(aad(uid, provider));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch {
    throw new HttpError(400, "\uC800\uC7A5\uB41C \uD0A4\uB97C \uD480 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC124\uC815\uC5D0\uC11C \uD0A4\uB97C \uB2E4\uC2DC \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.");
  }
}
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function asProvider(p) {
  if (typeof p === "string" && PROVIDERS.includes(p)) return p;
  throw new HttpError(400, "\uC54C \uC218 \uC5C6\uB294 AI \uACF5\uAE09\uC790\uC785\uB2C8\uB2E4.");
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST\uB9CC \uC9C0\uC6D0\uD569\uB2C8\uB2E4." });
    return;
  }
  try {
    const user = await verifyAdmin(req.headers?.authorization);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const provider = asProvider(body.provider);
    switch (body.action) {
      case "status": {
        encKey();
        res.status(200).json({ ok: true });
        return;
      }
      case "encrypt": {
        const key = String(body.key || "").trim();
        const fmt = checkKeyFormat(provider, key);
        if (!fmt.ok) throw new HttpError(400, fmt.message);
        res.status(200).json({ cipher: encrypt(key, user.uid, provider), last4: key.slice(-4) });
        return;
      }
      case "test": {
        const key = decrypt(body.cipher, user.uid, provider);
        res.status(200).json(await testApiKey(provider, key, body.model));
        return;
      }
      case "generate": {
        const key = decrypt(body.cipher, user.uid, provider);
        const r = body.request || {};
        const request = {
          provider,
          model: String(r.model || ""),
          apiKey: key,
          system: String(r.system || ""),
          userText: String(r.userText || ""),
          file: r.file && typeof r.file.base64 === "string" ? { mimeType: String(r.file.mimeType), base64: r.file.base64 } : void 0,
          schema: r.schema || {},
          schemaName: String(r.schemaName || "result"),
          maxTokens: Math.min(Number(r.maxTokens) || 8e3, 32e3)
        };
        const result = await generateStructured(request);
        res.status(200).json({ result });
        return;
      }
      default:
        throw new HttpError(400, "\uC54C \uC218 \uC5C6\uB294 \uC694\uCCAD\uC785\uB2C8\uB2E4.");
    }
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json({ error: e.message });
    } else if (e instanceof AIError) {
      res.status(502).json({ error: e.message, code: e.code, retryable: e.retryable });
    } else {
      console.error(e);
      res.status(500).json({ error: "\uC11C\uBC84 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." });
    }
  }
}
export {
  handler as default
};
