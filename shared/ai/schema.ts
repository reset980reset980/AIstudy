// 세 공급자(Gemini·OpenAI·Anthropic)가 모두 받아들이는 엄격한 JSON 스키마.
// - 모든 객체: 모든 속성 required + additionalProperties:false (OpenAI strict, Claude 규칙)
// - null/유니온 타입을 쓰지 않음 (Claude 유니온 개수 제한 회피) → 없는 값은 빈 문자열·빈 배열

const str = (description: string) => ({ type: 'string', description });

const visualSchema = {
  type: 'object',
  description: '시각 자료. 필요 없으면 type을 NONE으로, svgCode는 빈 문자열, data는 빈 배열로.',
  properties: {
    type: { type: 'string', enum: ['NONE', 'GEOMETRY', 'BAR'] },
    svgCode: str('GEOMETRY일 때만 viewBox="0 0 300 300" 단순 SVG. 아니면 빈 문자열.'),
    data: {
      type: 'array',
      description: 'BAR일 때만 막대 데이터. 아니면 빈 배열.',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, value: { type: 'number' } },
        required: ['name', 'value'],
        additionalProperties: false,
      },
    },
  },
  required: ['type', 'svgCode', 'data'],
  additionalProperties: false,
};

const stepSchema = {
  type: 'object',
  properties: {
    stepNumber: { type: 'integer' },
    title: str('이 단계의 짧은 제목'),
    description: str('자세한 설명'),
    equation: str('이 단계의 핵심 식 (없으면 빈 문자열)'),
    tip: str('학생 눈높이의 비유나 팁'),
    mathPrinciple: str('사용된 개념·공식'),
    visualData: visualSchema,
  },
  required: ['stepNumber', 'title', 'description', 'equation', 'tip', 'mathPrinciple', 'visualData'],
  additionalProperties: false,
};

const similarItemSchema = {
  type: 'object',
  properties: {
    question: str('문제'),
    answer: str('짧은 정답 (숫자·식·단어). 채점에 쓰이므로 설명 없이'),
    hint: str('힌트 한 문장'),
    svgCode: str('도형이 꼭 필요할 때만 SVG, 아니면 빈 문자열'),
    steps: { type: 'array', items: stepSchema },
  },
  required: ['question', 'answer', 'hint', 'svgCode', 'steps'],
  additionalProperties: false,
};

export const moreSimilarSchema = {
  type: 'object',
  properties: {
    similarProblems: { type: 'array', description: '새 유사 문제 정확히 3개', items: similarItemSchema },
  },
  required: ['similarProblems'],
  additionalProperties: false,
};

export const analysisSchema = {
  type: 'object',
  properties: {
    ocrText: str('이미지에서 읽어 낸 문제 원문'),
    subject: { type: 'string', enum: ['수학', '과학', '사회', '국어', '영어', '기타'] },
    unit: str('교과서 단원명. 예: "4학년 1학기 2. 각도". 학년·학기를 모르면 단원 이름만 짧게'),
    tags: { type: 'array', items: { type: 'string' }, description: '관련 개념 태그 2~4개' },
    difficulty: { type: 'string', enum: ['하', '중', '상'] },
    goal: str('문제가 요구하는 것'),
    requiredKnowledge: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: stepSchema },
    finalAnswer: str('최종 정답 (짧게)'),
    similarProblems: {
      type: 'array',
      description: '유사 문제 정확히 3개',
      items: similarItemSchema,
    },
  },
  required: ['ocrText', 'subject', 'unit', 'tags', 'difficulty', 'goal', 'requiredKnowledge', 'steps', 'finalAnswer', 'similarProblems'],
  additionalProperties: false,
};

export const gradeSchema = {
  type: 'object',
  properties: {
    correct: { type: 'boolean' },
    feedback: str('학생에게 줄 한두 문장 피드백 (한국어)'),
  },
  required: ['correct', 'feedback'],
  additionalProperties: false,
};

export function buildAnalysisPrompt(gradeLevel: string, concise: boolean): string {
  const level = gradeLevel && gradeLevel !== 'auto' ? `학생은 ${gradeLevel}입니다. 이 학년이 이해할 수 있는 말과 개념으로 설명하세요.` : '문제 수준에 맞는 학년을 추정해 그 눈높이로 설명하세요.';
  return `
당신은 친절하고 정확한 'AI 선생님'입니다. 학생이 올린 문제(수학·과학 등)를 분석하세요.
${level}

1. 원문 읽기(ocrText): 이미지의 문제를 정확히 옮겨 적으세요. 수식은 읽기 쉬운 일반 텍스트로(예: x^2, 3/4).
2. 분석: 목표(goal), 필요한 지식, 난이도(하/중/상), 개념 태그를 정하세요.
   - 과목(subject)과 한국 초·중·고 교육과정 기준 단원(unit)을 정하세요. 같은 단원은 항상 같은 이름으로 쓰세요(예: "4학년 1학기 2. 각도").
3. 단계별 풀이(steps): 논리적인 단계로 나누고 각 단계에 설명·식·쉬운 팁·개념을 쓰세요.
   - 계산은 반드시 검산하세요. 정답이 틀리면 안 됩니다.
   - 도형·위치 관계가 핵심일 때만 visualData.type=GEOMETRY로 SVG를 그리고, 수량 비교가 핵심일 때만 BAR를 쓰세요. 그 밖에는 NONE.
4. 유사 문제(similarProblems): 같은 개념을 쓰되 수와 형태를 바꾼 문제를 정확히 3개 만드세요.
   - answer는 채점용이므로 '12', '3/4', 'x=5'처럼 짧게만 쓰세요.
   - 유사 문제 풀이는 ${concise ? '2~3단계로 아주 짧게' : '핵심 위주로 간결하게'} 쓰세요.
5. SVG 규칙: viewBox="0 0 300 300", 20px 이상 여백, 단순한 선·도형·글자만, 스크립트·외부 링크 금지, 글자 크기 14 이상.

모든 내용은 한국어로, 주어진 JSON 스키마를 정확히 따르세요.`.trim();
}

export function buildGradePrompt(question: string, answer: string, studentAnswer: string): string {
  return `다음 문제에 대한 학생 답이 정답과 수학적으로 같은지 판단하세요.
표기 차이(단위 생략, 분수/소수 동치, 띄어쓰기, x= 생략 등)는 정답으로 인정하고, 값이 다르면 오답입니다.

[문제]
${question}

[정답]
${answer}

[학생 답]
${studentAnswer}

feedback에는 맞으면 칭찬 한 문장, 틀리면 어디서 틀렸을지 짧은 힌트를 쓰세요(정답을 그대로 말하지 말 것).`;
}

export function buildMoreSimilarPrompt(gradeLevel: string): string {
  const level = gradeLevel && gradeLevel !== 'auto' ? `학생은 ${gradeLevel}입니다.` : '원래 문제와 같은 수준으로 만드세요.';
  return `당신은 친절하고 정확한 'AI 선생님'입니다. ${level}
원래 문제와 같은 개념을 연습할 수 있는 새 유사 문제를 정확히 3개 만드세요.
- 이미 낸 문제와 수·상황·형태가 겹치지 않게 하세요. 난이도는 쉬운 것부터 조금씩 올리세요.
- 정답은 반드시 검산하고, answer는 '12', '3/4', '①'처럼 짧게만 쓰세요.
- 풀이 steps는 2~4단계로 간결하게. 첫 단계에서 정답을 미리 말하지 마세요.
- 도형이 꼭 필요할 때만 svgCode에 viewBox="0 0 300 300" 단순 SVG, 아니면 빈 문자열. visualData는 필요 없으면 type NONE.
모든 내용은 한국어로, 주어진 JSON 스키마를 정확히 따르세요.`;
}

export function buildMoreSimilarUserText(a: { ocrText: string; finalAnswer: string; tags: string[]; goal: string }, existing: string[]): string {
  return `[원래 문제]
${a.ocrText}

[원래 정답] ${a.finalAnswer}
[개념] ${(a.tags || []).join(', ')}
[목표] ${a.goal}

[이미 낸 유사 문제 — 겹치지 않게]
${existing.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
}

export function buildPracticePrompt(gradeLevel: string): string {
  const level = gradeLevel && gradeLevel !== 'auto' ? `학생은 ${gradeLevel}입니다.` : '틀린 문제와 같은 수준으로 만드세요.';
  return `당신은 친절하고 정확한 'AI 선생님'입니다. ${level}
학생이 방금 틀린 문제와 같은 유형의 '오답 연습 문제'를 정확히 3개 만드세요.
- 학생의 오답을 보고 어떤 개념을 헷갈렸는지 짐작해, 그 부분을 연습하게 하세요.
- 1번은 조금 쉽게, 2번은 비슷하게, 3번은 원래 문제 수준으로 만드세요.
- 틀린 문제가 객관식이면 연습 문제도 ①②③④ 객관식으로, 주관식이면 주관식으로 만드세요.
- 정답은 반드시 검산하고, answer는 '12', '3/4', '①'처럼 짧게만 쓰세요.
- hint에는 헷갈린 부분을 짚는 한 문장을 쓰세요. steps는 2~3단계로 간결하게, 첫 단계에서 정답을 말하지 마세요.
- 도형이 꼭 필요할 때만 svgCode(viewBox="0 0 300 300"), 아니면 빈 문자열. visualData는 필요 없으면 type NONE.
모든 내용은 한국어로, 주어진 JSON 스키마를 정확히 따르세요.`;
}

export function buildPracticeUserText(p: { question: string; answer: string }, wrongAnswer: string, concepts: string[]): string {
  return `[학생이 틀린 문제]
${p.question}

[정답] ${p.answer}
[학생이 쓴 답] ${wrongAnswer}
[관련 개념] ${concepts.join(', ')}`;
}
