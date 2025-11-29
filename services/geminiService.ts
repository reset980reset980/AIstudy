import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ProblemAnalysis, DiagramType } from "../types";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const stepSchemaProperties = {
  stepNumber: { type: Type.INTEGER },
  title: { type: Type.STRING, description: "Short title of this step." },
  description: { type: Type.STRING, description: "Detailed explanation." },
  equation: { type: Type.STRING, description: "The mathematical equation used." },
  tip: { type: Type.STRING, description: "A simple analogy or tip." },
  mathPrinciple: { type: Type.STRING, description: "The core mathematical concept." },
  visualData: {
    type: Type.OBJECT,
    nullable: true,
    description: "Populate ONLY if a visual aid is strictly necessary for this specific step.",
    properties: {
      type: { type: Type.STRING, enum: [DiagramType.BAR, DiagramType.PIE, DiagramType.NUMBER_LINE, DiagramType.GEOMETRY, DiagramType.NONE] },
      svgCode: { type: Type.STRING, description: "A SIMPLE SVG string. Generate ONLY if the step involves geometry or spatial reasoning. Keep paths simple to save tokens." },
      data: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            value: { type: Type.NUMBER }
          }
        }
      }
    }
  }
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ocrText: { type: Type.STRING, description: "The extracted text from the image." },
    tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Concepts involved." },
    difficulty: { type: Type.STRING, description: "Estimated difficulty level." },
    goal: { type: Type.STRING, description: "The main objective of the problem." },
    requiredKnowledge: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key concepts needed to solve this." },
    finalAnswer: { type: Type.STRING, description: "The final numerical or text answer." },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: stepSchemaProperties,
        required: ["stepNumber", "title", "description", "equation", "tip", "mathPrinciple"]
      }
    },
    similarProblems: {
      type: Type.ARRAY,
      description: "Must contain exactly 3 similar problems.",
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          hint: { type: Type.STRING },
          svgCode: { type: Type.STRING, nullable: true, description: "SVG code for the similar problem. Generate ONLY if geometric." },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: stepSchemaProperties,
              required: ["stepNumber", "title", "description", "equation", "tip", "mathPrinciple"]
            }
          }
        },
        required: ["question", "answer", "hint", "steps"]
      }
    }
  },
  required: ["ocrText", "tags", "difficulty", "goal", "requiredKnowledge", "finalAnswer", "steps", "similarProblems"]
};

export const analyzeMathProblem = async (file: File): Promise<ProblemAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToGenerativePart(file);

  // Use the actual mime type of the file or fallback based on extension
  let mimeType = file.type;
  if (!mimeType) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') mimeType = 'application/pdf';
      else if (['jpg', 'jpeg'].includes(ext || '')) mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
      else mimeType = 'image/jpeg'; // fallback
  }

  // Explicitly block unsupported document types to prevent "Empty Response" errors
  if (['application/vnd.hancom.hwp', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'].includes(mimeType)) {
      throw new Error("HWP 및 PPT 파일은 현재 AI 분석이 지원되지 않습니다. 이미지나 PDF로 변환하여 업로드해주세요.");
  }

  const model = "gemini-2.5-flash";
  
  const systemInstruction = `
    당신은 친절하고 똑똑한 'AI 선생님'입니다.
    학생이 업로드한 문제 이미지(수학, 과학 등)를 분석하여 다음 작업을 수행하세요:

    1. **OCR**: 이미지의 텍스트를 정확하게 추출하세요.
    2. **분석**: 문제의 유형, 난이도, 목표, 필요한 지식을 식별하세요.
    3. **단계별 풀이 (원본 문제)**: 문제를 논리적인 단계(Step)로 쪼개어 설명하세요.
       - 각 단계마다 수식(equation)과 설명(description)을 제공하세요.
       - **쉽게 이해하기(tip)**: 학생 눈높이에 맞춘 비유나 팁을 주세요.
       - **핵심 원리(mathPrinciple)**: 해당 단계에서 사용된 수학/과학적 정의나 공식을 명시하세요.
       - **시각화 판단(중요)**: 
         - **도형/구조 문제**: 설명에 도움이 된다면 'svgCode'를 생성하여 시각화하세요.
         - **단순 연산/개념 문제**: 시각적 자료가 굳이 필요 없다면 visualData를 null로 비워두세요.
         - SVG 생성 시 복잡한 묘사보다는 **단순한 선과 도형**으로 개념을 표현하는 데 집중하여 속도를 높이세요.
    
    4. **유사 문제 생성**: 
       - 원본 문제와 같은 개념을 사용하지만, **다른 형태의 문제**를 **반드시 3개** 생성하세요.
       - 1개만 생성하지 말고, 꼭 3개의 다른 변형 문제를 만들어야 합니다.
       - **다양성**: 도형 문제라면 회전, 대칭, 비율 변경 등을 통해 원본과 그림이 다르게 보이도록 하세요.
       - **시각화 판단**: 유사 문제 역시 도형이 **필수적인 경우에만** svgCode를 생성하세요. 
       - **간결함**: 유사 문제의 단계별 풀이는 핵심 위주로 최대한 간결하게 작성하여 응답 길이를 줄이세요.
       - **SVG 생성 규칙 (생성 시)**: 
         - 반드시 **viewBox="0 0 300 300"** 속성을 가진 정사각형 캔버스 기준으로 코드를 작성하세요.
         - 도형이 짤리지 않도록 캔버스 내부에 20px 이상의 여백(padding)을 두고 중앙에 배치하세요.
         - 색상을 사용하여 시각적으로 이해하기 쉽게 만드세요.

    응답은 반드시 한국어로 작성되어야 하며, 정의된 JSON 스키마를 엄격히 따르세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: "이 문제를 분석하고 풀이해주세요. 유사 문제는 꼭 3개를 만들어주세요." }
          ]
        }
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Reduced temperature for stability
        maxOutputTokens: 8192,
        // Disable safety settings to prevent false positives on educational content
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      }
    });

    const text = response.text;
    if (!text) {
      // Analyze finish reason for better error messages
      const finishReason = response.candidates?.[0]?.finishReason;
      console.error("Empty response from AI. Finish Reason:", finishReason);
      
      if (finishReason === 'SAFETY') {
          throw new Error("AI가 이미지를 분석하는 도중 안전 정책에 의해 답변이 차단되었습니다. 다른 이미지를 시도해주세요.");
      }
      if (finishReason === 'RECITATION') {
          throw new Error("저작권이 있는 콘텐츠로 식별되어 AI가 답변을 생성할 수 없습니다.");
      }
      if (finishReason === 'MAX_TOKENS') {
          throw new Error("문제 내용이 너무 길어 AI 답변이 잘렸습니다. 문제의 일부분만 잘라서 다시 시도해주세요.");
      }
      
      throw new Error(`AI 응답을 생성하지 못했습니다. (사유: ${finishReason || '알 수 없음'})`);
    }

    try {
        return JSON.parse(text) as ProblemAnalysis;
    } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Raw Text:", text);
        if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
             throw new Error("답변이 너무 길어 중간에 잘렸습니다. 더 작은 영역을 선택해서 다시 시도해주세요.");
        }
        throw new Error("AI 응답 형식이 올바르지 않습니다. 다시 시도해주세요.");
    }

  } catch (e) {
    console.error("Gemini API Error:", e);
    if (e instanceof Error) {
        // Pass specific errors through
        if (e.message.includes("지원되지 않는") || e.message.includes("안전 정책") || e.message.includes("저작권") || e.message.includes("잘렸습니다")) {
            throw e;
        }
        throw new Error(`AI 분석 중 오류가 발생했습니다: ${e.message}`);
    }
    throw new Error("AI 응답을 분석하는 중 알 수 없는 오류가 발생했습니다.");
  }
};