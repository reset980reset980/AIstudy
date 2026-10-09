// 세 공급자의 REST API를 같은 모양으로 호출하는 모듈.
// 브라우저(일반 사용자)와 Vercel 서버 함수(관리자 키) 양쪽에서 그대로 쓰기 위해 fetch만 사용합니다.

import type { ProviderId } from './models';

export interface FileInput {
  mimeType: string; // image/jpeg, image/png, image/webp, application/pdf
  base64: string; // data: 접두어 없는 순수 base64
}

export interface StructuredRequest {
  provider: ProviderId;
  model: string;
  apiKey: string;
  system: string;
  userText: string;
  file?: FileInput;
  schema: object;
  schemaName: string;
  maxTokens: number;
}

export class AIError extends Error {
  constructor(
    message: string,
    public code: 'auth' | 'quota' | 'truncated' | 'blocked' | 'format' | 'network' | 'unsupported' | 'unknown',
    public retryable = false,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENAI_BASE = 'https://api.openai.com/v1';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    // 브라우저에서 직접 호출할 때 필요한 헤더 (서버에서는 무시됨)
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || data?.message || JSON.stringify(data).slice(0, 300);
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

function httpError(provider: ProviderId, status: number, detail: string): AIError {
  const name = provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : 'Claude';
  if (status === 401 || status === 403 || (status === 400 && /api key|api_key|invalid.*key|permission/i.test(detail))) {
    return new AIError(`${name} 키가 올바르지 않거나 권한이 없습니다. 설정에서 키를 다시 확인해 주세요.`, 'auth');
  }
  if (status === 429) {
    return new AIError(`${name} 사용 한도를 넘었습니다. 잠시 후 다시 시도하거나 다른 AI를 선택해 주세요.`, 'quota', true);
  }
  if (status === 404) {
    return new AIError(`${name}에서 이 모델을 찾을 수 없습니다. 설정에서 다른 모델을 골라 주세요. (${detail})`, 'unsupported');
  }
  if (status >= 500 || status === 529) {
    return new AIError(`${name} 서버가 일시적으로 바쁩니다. 잠시 후 다시 시도해 주세요.`, 'network', true);
  }
  return new AIError(`${name} 요청 오류 (${status}): ${detail}`, 'unknown');
}

async function post(provider: ProviderId, url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new AIError('인터넷 연결 또는 AI 서버 접속에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'network', true);
  }
  if (!res.ok) throw httpError(provider, res.status, await readError(res));
  return res.json();
}

// ---------- 구조화(JSON) 응답 생성 ----------

async function callGemini(r: StructuredRequest): Promise<string> {
  const parts: any[] = [];
  if (r.file) parts.push({ inlineData: { mimeType: r.file.mimeType, data: r.file.base64 } });
  parts.push({ text: r.userText });
  const data = await post('gemini', `${GEMINI_BASE}/models/${encodeURIComponent(r.model)}:generateContent`, {
    'x-goog-api-key': r.apiKey, // AIza·AQ. 키 모두 이 헤더로 동작
    'content-type': 'application/json',
  }, {
    systemInstruction: { parts: [{ text: r.system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: r.schema,
      maxOutputTokens: r.maxTokens,
      temperature: 0.2,
      thinkingConfig: { thinkingLevel: 'LOW' },
    },
  });
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p: any) => !p.thought).map((p: any) => p.text || '').join('');
  const reason = cand?.finishReason;
  if (data?.promptFeedback?.blockReason || reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT') {
    throw new AIError('AI 안전 정책에 의해 답변이 차단되었습니다. 다른 사진으로 시도해 주세요.', 'blocked');
  }
  if (reason === 'RECITATION') throw new AIError('저작권 문제로 AI가 답변하지 못했습니다. 문제 부분만 잘라서 다시 시도해 주세요.', 'blocked');
  if (reason === 'MAX_TOKENS') throw new AIError('답변이 길어 중간에 잘렸습니다.', 'truncated', true);
  if (!text) throw new AIError(`AI가 빈 답변을 보냈습니다. (사유: ${reason || '알 수 없음'})`, 'format', true);
  return text;
}

async function callOpenAI(r: StructuredRequest): Promise<string> {
  const content: any[] = [];
  if (r.file) {
    if (r.file.mimeType === 'application/pdf') {
      content.push({ type: 'input_file', filename: 'problem.pdf', file_data: `data:application/pdf;base64,${r.file.base64}` });
    } else {
      content.push({ type: 'input_image', image_url: `data:${r.file.mimeType};base64,${r.file.base64}` });
    }
  }
  content.push({ type: 'input_text', text: r.userText });
  const data = await post('openai', `${OPENAI_BASE}/responses`, {
    authorization: `Bearer ${r.apiKey}`,
    'content-type': 'application/json',
  }, {
    model: r.model,
    instructions: r.system,
    input: [{ role: 'user', content }],
    max_output_tokens: r.maxTokens,
    store: false,
    text: { format: { type: 'json_schema', name: r.schemaName, schema: r.schema, strict: true } },
  });
  if (data?.status === 'incomplete') {
    if (data?.incomplete_details?.reason === 'content_filter') throw new AIError('AI 안전 정책에 의해 답변이 차단되었습니다.', 'blocked');
    throw new AIError('답변이 길어 중간에 잘렸습니다.', 'truncated', true);
  }
  let text = typeof data?.output_text === 'string' ? data.output_text : '';
  let refusal = '';
  if (!text) {
    for (const item of data?.output || []) {
      for (const c of item?.content || []) {
        if (c?.type === 'output_text' && c.text) text += c.text;
        if (c?.type === 'refusal') refusal = c.refusal || '거절됨';
      }
    }
  }
  if (refusal && !text) throw new AIError(`AI가 답변을 거절했습니다: ${refusal}`, 'blocked');
  if (!text) throw new AIError('AI가 빈 답변을 보냈습니다.', 'format', true);
  return text;
}

async function callAnthropic(r: StructuredRequest): Promise<string> {
  const content: any[] = [];
  if (r.file) {
    if (r.file.mimeType === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: r.file.base64 } });
    } else {
      content.push({ type: 'image', source: { type: 'base64', media_type: r.file.mimeType, data: r.file.base64 } });
    }
  }
  content.push({ type: 'text', text: r.userText });
  const data = await post('anthropic', `${ANTHROPIC_BASE}/messages`, anthropicHeaders(r.apiKey), {
    model: r.model,
    max_tokens: r.maxTokens,
    system: r.system,
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema: r.schema } },
  });
  if (data?.stop_reason === 'max_tokens') throw new AIError('답변이 길어 중간에 잘렸습니다.', 'truncated', true);
  if (data?.stop_reason === 'refusal') throw new AIError('AI 안전 정책에 의해 답변이 차단되었습니다.', 'blocked');
  const text = (data?.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  if (!text) throw new AIError('AI가 빈 답변을 보냈습니다.', 'format', true);
  return text;
}

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch { /* fallthrough */ }
    }
    throw new AIError('AI 답변 형식이 올바르지 않습니다.', 'format', true);
  }
}

/** 구조화 응답을 받아 JSON으로 돌려줍니다. */
export async function generateStructured<T>(r: StructuredRequest): Promise<T> {
  const text = r.provider === 'gemini' ? await callGemini(r) : r.provider === 'openai' ? await callOpenAI(r) : await callAnthropic(r);
  return parseJson<T>(text);
}

// ---------- 키 테스트 (요금이 들지 않는 모델 목록 조회) ----------

export async function testApiKey(provider: ProviderId, apiKey: string, model?: string): Promise<{ ok: boolean; message: string }> {
  const key = apiKey.trim();
  try {
    let res: Response;
    if (provider === 'gemini') {
      res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    } else if (provider === 'openai') {
      res = await fetch(`${OPENAI_BASE}/models`, { headers: { authorization: `Bearer ${key}` } });
    } else {
      res = await fetch(`${ANTHROPIC_BASE}/models?limit=100`, { headers: anthropicHeaders(key) });
    }
    if (!res.ok) {
      const err = httpError(provider, res.status, await readError(res));
      return { ok: false, message: err.message };
    }
    const data = await res.json();
    const ids: string[] = provider === 'gemini'
      ? (data?.models || []).map((m: any) => String(m.name || '').replace(/^models\//, ''))
      : (data?.data || []).map((m: any) => String(m.id || ''));
    if (model && ids.length && !ids.includes(model)) {
      return { ok: true, message: `키는 정상입니다. 다만 선택한 모델(${model})이 목록에 보이지 않아요. 다른 모델을 골라 보세요.` };
    }
    return { ok: true, message: '정상 작동하는 키입니다.' };
  } catch {
    return { ok: false, message: '접속에 실패했습니다. 인터넷 연결을 확인해 주세요.' };
  }
}
