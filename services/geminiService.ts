import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Cache to prevent re-fetching on same session if user navigates back/forth rapidly
const questionCache: Record<string, Question[]> = {};

export const generateQuestions = async (
  course: string,
  year: number,
  mode: 'practice' | 'exam',
  part?: number,
  count: number = 10
): Promise<Question[]> => {
  const cacheKey = `${course}-${year}-${mode}-${part || 'full'}`;
  
  if (questionCache[cacheKey]) {
    return questionCache[cacheKey];
  }

  // To ensure reliability and speed for the demo, we limit the actual API request count 
  // for the Exam mode to 20, but the UI will treat it as the "Exam" set.
  // Generating 100 unique high-quality questions in one LLM call often hits token limits or timeouts.
  const fetchCount = mode === 'exam' ? 20 : count; 

  const prompt = `
    Generate ${fetchCount} multiple-choice questions for the academic subject: "${course}".
    Context: These questions should be suitable for a university-level entrance or final exam from the year ${year}.
    ${mode === 'practice' ? `This is Part ${part} of a practice series.` : 'This is a final comprehensive exam.'}
    
    Ensure the questions are challenging and relevant to ${course}.
    Provide 4 distinct options for each question.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING, description: "The question text" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Array of 4 possible answers"
              },
              correctAnswerIndex: { 
                type: Type.INTEGER, 
                description: "The index (0-3) of the correct answer in the options array" 
              }
            },
            required: ["id", "text", "options", "correctAnswerIndex"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    const questions = JSON.parse(text) as Question[];
    questionCache[cacheKey] = questions;
    return questions;

  } catch (error) {
    console.error("Error generating questions:", error);
    // Fallback mock data if API fails or key is missing
    return Array.from({ length: count }).map((_, i) => ({
      id: `mock-${i}`,
      text: `(Fallback) Sample Question ${i + 1} about ${course} (${year}) - API Key might be missing or exhausted.`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctAnswerIndex: 0
    }));
  }
};