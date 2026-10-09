// AI 공급자와 모델 목록 (2026년 10월 공식 가격표 기준으로 가성비 위주 선정)
// 가격은 1M 토큰당 USD (입력/출력). 화면 안내용이며 실제 요금은 각 사 정책을 따릅니다.

export type ProviderId = 'gemini' | 'openai' | 'anthropic';

export interface ModelOption {
  id: string;
  label: string;
  price: string; // 안내용 가격 문구
  note: string;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  keyHint: string;
  keyUrl: string;
  models: ModelOption[];
  defaultModel: string;
  /** 채점처럼 가벼운 작업에 쓰는 저렴한 모델 */
  lightModel: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    keyHint: 'AQ. 또는 AIza로 시작',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      {
        id: 'gemini-3.8-flash',
        label: 'Gemini 3.8 Flash (추천)',
        price: '$0.75 / $3.75 (2027.1.1부터 2배)',
        note: '풀이 정확도와 속도의 균형. 무료 등급 사용 가능',
      },
      {
        id: 'gemini-3.5-flash-lite',
        label: 'Gemini 3.5 Flash-Lite (절약)',
        price: '$0.30 / $2.50',
        note: '가장 저렴. 쉬운 문제에 적합',
      },
    ],
    defaultModel: 'gemini-3.8-flash',
    lightModel: 'gemini-3.5-flash-lite',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    keyHint: 'sk-로 시작',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      {
        id: 'gpt-6-luna',
        label: 'GPT-6 Luna (추천)',
        price: '$0.10 / $0.50',
        note: '매우 저렴한 최신 모델. 이미지 입력 지원',
      },
      {
        id: 'gpt-6.1-sol',
        label: 'GPT-6.1 Sol (고성능)',
        price: '$2.00 / $10.00',
        note: '어려운 문제용. 비용 약 20배',
      },
    ],
    defaultModel: 'gpt-6-luna',
    lightModel: 'gpt-6-luna',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    keyHint: 'sk-ant-로 시작',
    keyUrl: 'https://platform.claude.com/settings/keys',
    models: [
      {
        id: 'claude-haiku-5-5',
        label: 'Claude Haiku 5.5 (추천)',
        price: '$0.10 / $0.50',
        note: '빠르고 저렴. 이미지·PDF 입력 지원',
      },
      {
        id: 'claude-sonnet-5-5',
        label: 'Claude Sonnet 5.5 (고성능)',
        price: '$2.00 / $10.00',
        note: '어려운 문제용. 비용 약 20배',
      },
    ],
    defaultModel: 'claude-haiku-5-5',
    lightModel: 'claude-haiku-5-5',
  },
};

export const PROVIDER_ORDER: ProviderId[] = ['gemini', 'openai', 'anthropic'];

/** 키 모양으로 1차 확인 (실제 유효성은 테스트 버튼으로 확인) */
export function checkKeyFormat(provider: ProviderId, key: string): { ok: boolean; message: string } {
  const k = key.trim();
  if (!k) return { ok: false, message: '키를 입력해 주세요.' };
  if (/\s/.test(k)) return { ok: false, message: '키 중간에 공백이 있습니다.' };
  switch (provider) {
    case 'gemini':
      if (k.startsWith('AQ.')) return { ok: true, message: '새 방식(AQ.) Gemini 키' };
      if (k.startsWith('AIza')) return { ok: true, message: '기존 방식(AIza) Gemini 키' };
      return { ok: false, message: 'Gemini 키는 AQ. 또는 AIza로 시작합니다.' };
    case 'openai':
      if (k.startsWith('sk-ant-')) return { ok: false, message: 'Anthropic 키입니다. Claude 칸에 넣어 주세요.' };
      if (k.startsWith('sk-')) return { ok: true, message: 'OpenAI 키' };
      return { ok: false, message: 'OpenAI 키는 sk-로 시작합니다.' };
    case 'anthropic':
      if (k.startsWith('sk-ant-')) return { ok: true, message: 'Anthropic 키' };
      return { ok: false, message: 'Anthropic 키는 sk-ant-로 시작합니다.' };
  }
}

export function isKnownModel(provider: ProviderId, model: string | undefined): model is string {
  return !!model && PROVIDERS[provider].models.some((m) => m.id === model);
}
