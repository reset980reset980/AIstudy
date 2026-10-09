// 화면에서 쓰는 AI 호출 진입점.
// - 일반 사용자: 브라우저에서 각 AI 회사로 바로 호출 (본인 키)
// - 관리자: /api/ai 서버 함수로 호출 (서버에서 암호화된 키를 복호화)

import { auth } from '../firebase';
import { PROVIDERS, PROVIDER_ORDER, type ProviderId } from '../shared/ai/models';
import { analysisSchema, buildAnalysisPrompt, buildGradePrompt, gradeSchema } from '../shared/ai/schema';
import { AIError, generateStructured, testApiKey, type FileInput, type StructuredRequest } from '../shared/ai/providers';
import type { ProblemAnalysis, UserSettings } from '../types';

export const ADMIN_EMAILS = ['reset98@gmail.com'];

export function isAdminUser(email: string | null | undefined, emailVerified: boolean | undefined): boolean {
  return !!email && !!emailVerified && ADMIN_EMAILS.includes(email.toLowerCase());
}

export function defaultSettings(): UserSettings {
  return {
    theme: 'light',
    gradeLevel: 'auto',
    provider: 'gemini',
    models: {
      gemini: PROVIDERS.gemini.defaultModel,
      openai: PROVIDERS.openai.defaultModel,
      anthropic: PROVIDERS.anthropic.defaultModel,
    },
    keys: {},
    encKeys: {},
  };
}

export function hasKey(s: UserSettings, p: ProviderId, admin: boolean): boolean {
  return admin ? !!s.encKeys[p]?.cipher : !!s.keys[p]?.trim();
}

/** 선택한 AI에 키가 없으면 키가 있는 다른 AI를 사용 */
export function pickProvider(s: UserSettings, admin: boolean): ProviderId | null {
  if (hasKey(s, s.provider, admin)) return s.provider;
  return PROVIDER_ORDER.find((p) => hasKey(s, p, admin)) || null;
}

// ---------- 파일 준비 ----------

const MAX_IMAGE_SIDE = 1800;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.88));
}

export async function prepareFile(file: File, viaServer: boolean): Promise<FileInput> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  if (/\.(hwp|hwpx|ppt|pptx|doc|docx)$/.test(name)) {
    throw new AIError('한글·PPT·워드 파일은 바로 분석할 수 없어요. PDF나 사진으로 바꿔서 올려 주세요.', 'unsupported');
  }
  if (isPdf) {
    const limit = viaServer ? 3 : 20;
    if (file.size > limit * 1024 * 1024) {
      throw new AIError(`PDF가 너무 큽니다(최대 ${limit}MB). 필요한 쪽만 저장하거나 사진으로 찍어 올려 주세요.`, 'unsupported');
    }
    return { mimeType: 'application/pdf', base64: await blobToBase64(file) };
  }
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|heic|bmp)$/.test(name)) {
    throw new AIError('사진(JPG·PNG 등)이나 PDF 파일만 분석할 수 있어요.', 'unsupported');
  }
  const blob = await shrinkImage(file);
  return { mimeType: blob.type || 'image/jpeg', base64: await blobToBase64(blob) };
}

// ---------- 호출 ----------

async function callServer(action: string, payload: Record<string, unknown>): Promise<any> {
  const user = auth.currentUser;
  if (!user) throw new AIError('로그인이 필요합니다.', 'auth');
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new AIError('서버 접속에 실패했습니다. 인터넷 연결을 확인해 주세요.', 'network', true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 413) throw new AIError('파일이 너무 커서 서버로 보낼 수 없습니다. 더 작게 잘라 주세요.', 'unsupported');
    throw new AIError(data?.error || `서버 오류 (${res.status})`, data?.code || 'unknown', !!data?.retryable);
  }
  return data;
}

interface RunOptions {
  settings: UserSettings;
  admin: boolean;
  provider: ProviderId;
  model: string;
}

async function run<T>(o: RunOptions, req: Omit<StructuredRequest, 'apiKey' | 'provider' | 'model'>): Promise<T> {
  if (o.admin) {
    const enc = o.settings.encKeys[o.provider];
    if (!enc) throw new AIError('키가 등록되지 않았습니다.', 'auth');
    const data = await callServer('generate', { provider: o.provider, cipher: enc.cipher, request: { ...req, model: o.model } });
    return data.result as T;
  }
  const key = o.settings.keys[o.provider];
  if (!key) throw new AIError('키가 등록되지 않았습니다.', 'auth');
  return generateStructured<T>({ ...req, provider: o.provider, model: o.model, apiKey: key });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeAnalysis(a: ProblemAnalysis): ProblemAnalysis {
  const fixSteps = (steps: any[] = []) =>
    steps.map((s, i) => ({
      ...s,
      stepNumber: s.stepNumber || i + 1,
      visualData: s.visualData && s.visualData.type !== 'NONE' ? s.visualData : null,
    }));
  return {
    ...a,
    tags: a.tags || [],
    requiredKnowledge: a.requiredKnowledge || [],
    steps: fixSteps(a.steps),
    similarProblems: (a.similarProblems || []).map((p) => ({ ...p, steps: fixSteps(p.steps) })),
  };
}

export async function analyzeProblem(file: File, settings: UserSettings, admin: boolean, onStatus?: (msg: string) => void): Promise<ProblemAnalysis> {
  const provider = pickProvider(settings, admin);
  if (!provider) {
    throw new AIError('AI 키가 없습니다. 오른쪽 위 ⚙️ 설정에서 Gemini·OpenAI·Claude 중 하나의 키를 등록해 주세요.', 'auth');
  }
  const model = settings.models[provider] || PROVIDERS[provider].defaultModel;
  onStatus?.('사진을 준비하는 중...');
  const fileInput = await prepareFile(file, admin);
  const opts: RunOptions = { settings, admin, provider, model };

  let concise = false;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      onStatus?.(attempt === 0 ? `${PROVIDERS[provider].name}가 문제를 풀고 있어요...` : '답변을 다시 받아오는 중...');
      const result = await run<ProblemAnalysis>(opts, {
        system: buildAnalysisPrompt(settings.gradeLevel, concise),
        userText: '이 문제를 분석하고 단계별로 풀이해 주세요. 유사 문제는 꼭 3개 만들어 주세요.',
        file: fileInput,
        schema: analysisSchema,
        schemaName: 'problem_analysis',
        maxTokens: concise ? 24000 : 16000,
      });
      return { ...normalizeAnalysis(result), aiProvider: provider, aiModel: model };
    } catch (e) {
      lastError = e;
      if (!(e instanceof AIError) || !e.retryable || attempt === 2) break;
      if (e.code === 'truncated' || e.code === 'format') concise = true;
      else await sleep(1500 * (attempt + 1));
    }
  }
  if (lastError instanceof AIError && lastError.code === 'truncated') {
    throw new AIError('답변이 너무 길어 잘렸습니다. 문제 하나만 잘라서 다시 시도해 주세요.', 'truncated');
  }
  throw lastError instanceof Error ? lastError : new AIError('알 수 없는 오류가 발생했습니다.', 'unknown');
}

// ---------- 채점 ----------

function normalizeAnswer(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^(정답|답|x|y)[:=]/, '')
    .replace(/[.。]$/, '')
    .replace(/,(?=\d{3}\b)/g, '')
    .replace(/(cm²|cm\^2|cm2|cm|mm|km|m²|m|kg|g|개|명|원|살|권|자루|장|마리|시간|분|초|도|°|번|배|l|ml)$/i, '');
}

export async function gradeAnswer(
  q: { question: string; answer: string },
  studentAnswer: string,
  settings: UserSettings,
  admin: boolean,
): Promise<{ correct: boolean; feedback: string; byAI: boolean }> {
  const a = normalizeAnswer(q.answer);
  const b = normalizeAnswer(studentAnswer);
  if (!b) return { correct: false, feedback: '답을 입력하지 않았어요.', byAI: false };
  if (a && a === b) return { correct: true, feedback: '정확해요! 잘했어요 👏', byAI: false };
  const na = Number(a), nb = Number(b);
  if (a && !isNaN(na) && !isNaN(nb)) {
    return na === nb
      ? { correct: true, feedback: '정확해요! 잘했어요 👏', byAI: false }
      : { correct: false, feedback: '값이 달라요. 풀이 과정을 다시 확인해 볼까요?', byAI: false };
  }
  const provider = pickProvider(settings, admin);
  if (!provider) throw new AIError('자동 채점에는 AI 키가 필요합니다.', 'auth');
  const r = await run<{ correct: boolean; feedback: string }>(
    { settings, admin, provider, model: PROVIDERS[provider].lightModel },
    {
      system: '당신은 공정한 채점 선생님입니다. JSON 스키마에 맞게 답하세요.',
      userText: buildGradePrompt(q.question, q.answer, studentAnswer),
      schema: gradeSchema,
      schemaName: 'grade',
      maxTokens: 1500,
    },
  );
  return { correct: !!r.correct, feedback: r.feedback || '', byAI: true };
}

// ---------- 키 관리 ----------

export async function testKey(provider: ProviderId, settings: UserSettings, admin: boolean, plainKey?: string) {
  const model = settings.models[provider];
  if (plainKey) return testApiKey(provider, plainKey, model);
  if (admin && settings.encKeys[provider]) {
    return callServer('test', { provider, cipher: settings.encKeys[provider]!.cipher, model }) as Promise<{ ok: boolean; message: string }>;
  }
  if (settings.keys[provider]) return testApiKey(provider, settings.keys[provider]!, model);
  return { ok: false, message: '등록된 키가 없습니다.' };
}

export async function encryptKeyOnServer(provider: ProviderId, key: string): Promise<{ cipher: string; last4: string }> {
  return callServer('encrypt', { provider, key });
}
