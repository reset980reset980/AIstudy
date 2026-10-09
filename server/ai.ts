// Vercel 서버 함수 원본 (빌드: npm run build:api → api/ai.js)
// 관리자 계정의 AI 키를 AES-256-GCM으로 암호화하고, 복호화는 이 서버 안에서만 합니다.
// 평문 키는 어디에도 저장되지 않으며, Firestore에는 암호문만 저장됩니다.

import crypto from 'node:crypto';
import { generateStructured, testApiKey, AIError, type StructuredRequest } from '../shared/ai/providers';
import { checkKeyFormat, type ProviderId } from '../shared/ai/models';

const ADMIN_EMAILS = ['reset98@gmail.com'];
const FIREBASE_PROJECT_ID = 'a-istudy-cebe2';
const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const PROVIDERS: ProviderId[] = ['gemini', 'openai', 'anthropic'];

// ---------- Firebase ID 토큰 검증 (외부 라이브러리 없이) ----------

let certCache: { certs: Record<string, string>; expires: number } | null = null;

async function getCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.expires > Date.now()) return certCache.certs;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error('인증서 조회 실패');
  const certs = (await res.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  certCache = { certs, expires: Date.now() + maxAge * 1000 };
  return certs;
}

function b64urlJson(part: string): any {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

interface AdminUser { uid: string; email: string }

async function verifyAdmin(authHeader: string | undefined): Promise<AdminUser> {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, '로그인이 필요합니다.');
  let header: any, payload: any;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch {
    throw new HttpError(401, '잘못된 인증 정보입니다.');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, '잘못된 인증 정보입니다.');
  const certs = await getCerts();
  const cert = certs[header.kid];
  if (!cert) throw new HttpError(401, '인증 정보가 만료되었습니다. 다시 로그인해 주세요.');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  if (!verifier.verify(cert, Buffer.from(parts[2], 'base64url'))) throw new HttpError(401, '잘못된 인증 정보입니다.');
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID || payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new HttpError(401, '다른 프로젝트의 인증 정보입니다.');
  }
  if (typeof payload.exp !== 'number' || payload.exp < now - 30 || payload.iat > now + 300 || !payload.sub) {
    throw new HttpError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.');
  }
  const email = String(payload.email || '').toLowerCase();
  if (!ADMIN_EMAILS.includes(email) || payload.email_verified !== true) {
    throw new HttpError(403, '관리자 계정만 사용할 수 있는 기능입니다.');
  }
  return { uid: payload.sub, email };
}

// ---------- 암호화 ----------

function encKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new HttpError(500, '서버 암호화 비밀값(KEY_ENCRYPTION_SECRET)이 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function aad(uid: string, provider: string) {
  return Buffer.from(`aistudy:v1:${uid}:${provider}`);
}

function encrypt(plain: string, uid: string, provider: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  cipher.setAAD(aad(uid, provider));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

function decrypt(blob: string, uid: string, provider: string): string {
  const [v, iv, tag, ct] = String(blob || '').split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new HttpError(400, '저장된 키 형식이 올바르지 않습니다. 설정에서 키를 다시 저장해 주세요.');
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
    d.setAAD(aad(uid, provider));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch {
    throw new HttpError(400, '저장된 키를 풀 수 없습니다. 설정에서 키를 다시 저장해 주세요.');
  }
}

// ---------- 핸들러 ----------

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function asProvider(p: unknown): ProviderId {
  if (typeof p === 'string' && (PROVIDERS as string[]).includes(p)) return p as ProviderId;
  throw new HttpError(400, '알 수 없는 AI 공급자입니다.');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 지원합니다.' });
    return;
  }
  try {
    const user = await verifyAdmin(req.headers?.authorization);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const provider = asProvider(body.provider);

    switch (body.action) {
      case 'status': {
        encKey(); // 비밀값이 있는지만 확인
        res.status(200).json({ ok: true });
        return;
      }
      case 'encrypt': {
        const key = String(body.key || '').trim();
        const fmt = checkKeyFormat(provider, key);
        if (!fmt.ok) throw new HttpError(400, fmt.message);
        res.status(200).json({ cipher: encrypt(key, user.uid, provider), last4: key.slice(-4) });
        return;
      }
      case 'test': {
        const key = decrypt(body.cipher, user.uid, provider);
        res.status(200).json(await testApiKey(provider, key, body.model));
        return;
      }
      case 'generate': {
        const key = decrypt(body.cipher, user.uid, provider);
        const r = body.request || {};
        const request: StructuredRequest = {
          provider,
          model: String(r.model || ''),
          apiKey: key,
          system: String(r.system || ''),
          userText: String(r.userText || ''),
          file: r.file && typeof r.file.base64 === 'string' ? { mimeType: String(r.file.mimeType), base64: r.file.base64 } : undefined,
          schema: r.schema || {},
          schemaName: String(r.schemaName || 'result'),
          maxTokens: Math.min(Number(r.maxTokens) || 8000, 32000),
        };
        const result = await generateStructured(request);
        res.status(200).json({ result });
        return;
      }
      default:
        throw new HttpError(400, '알 수 없는 요청입니다.');
    }
  } catch (e: any) {
    if (e instanceof HttpError) {
      res.status(e.status).json({ error: e.message });
    } else if (e instanceof AIError) {
      res.status(502).json({ error: e.message, code: e.code, retryable: e.retryable });
    } else {
      console.error(e);
      res.status(500).json({ error: '서버 처리 중 오류가 발생했습니다.' });
    }
  }
}
