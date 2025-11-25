

import { db } from '../../firebase';
import { App, ai } from '../../../app';
import { QuizQuestion } from '../../types';
import { GoogleGenAI, Type } from "@google/genai";

export async function getCommunityQuestions(this: any, gameId: string, count: number): Promise<QuizQuestion[]> {
    const questionsSnap = await db.collection('games').doc(gameId).collection('communityQuestions').where('status', '==', 'approved').get();
    const allQuestions = questionsSnap.docs.map((doc: any) => ({...doc.data(), type: 'text' })) as QuizQuestion[]; // Assume community questions are text
    if (allQuestions.length < count) throw new Error("هذه اللعبة لا تملك العدد الكافي من الأسئلة حالياً.");
    // Fisher-Yates shuffle
    for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
    return allQuestions.slice(0, count);
}

export async function generateQuizQuestionsWithAI(this: any, gameName: string, numQuestions: number, categories: string[] = [], difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Promise<QuizQuestion[]> {
    if (!ai) throw new Error("ميزة الذكاء الاصطناعي غير متاحة حالياً.");
    App.functions.ui.showToast("🧠 جاري إنشاء أسئلة ذكية...", "info");
    
    const categoryPrompt = categories.length > 0 ? `Focus on these categories: ${categories.join(', ')}.` : '';
    const difficultyPrompt = `The questions should be of ${difficulty} difficulty.`;
    
    // More robust prompting for various question types
    const specialTypePrompt = `
        Occasionally (10% chance) generate a question with type="audio" or type="pixel".
        If type="audio", the question should be "ما هذا الصوت؟" or "من أي لعبة هذه الموسيقى؟" and set mediaUrl to "PLACEHOLDER_AUDIO".
        If type="pixel", the question should be "من هذه الشخصية؟" and set mediaUrl to "PLACEHOLDER_IMAGE".
        Otherwise type="text".
    `;

     const response = await ai.models.generateContent({
       model: "gemini-2.5-flash",
       contents: `Generate exactly ${numQuestions} multiple-choice trivia questions about the video game "${gameName}". The questions must be in Arabic. ${difficultyPrompt} ${categoryPrompt} ${specialTypePrompt} Provide four unique options for each question.`,
       config: {
         responseMimeType: "application/json",
         responseSchema: {
            type: Type.OBJECT, 
            properties: {
                questions: { 
                    type: Type.ARRAY, 
                    items: {
                        type: Type.OBJECT, 
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ['text', 'image', 'audio', 'pixel'] },
                            mediaUrl: { type: Type.STRING },
                            category: { type: Type.STRING }
                        }, 
                        required: ["question", "options", "correctAnswer", "type"]
                    }
                }
            }, 
            required: ["questions"]
          },
       },
    });
    const parsedResponse = JSON.parse(response.text.trim());
    
    // Post-process to add placeholders if the AI didn't (or to use real dummy data for demo)
    return parsedResponse.questions.map((q: any) => {
        if (q.type === 'audio' && (!q.mediaUrl || q.mediaUrl.includes('PLACEHOLDER'))) {
            q.mediaUrl = 'https://cdn.freesound.org/previews/369/369918_2385463-lq.mp3'; // Generic game sound
        }
        if ((q.type === 'pixel' || q.type === 'image') && (!q.mediaUrl || q.mediaUrl.includes('PLACEHOLDER'))) {
            q.mediaUrl = 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + Math.random(); // Random pixel art
        }
        return { ...q, type: q.type || 'text' };
    });
}