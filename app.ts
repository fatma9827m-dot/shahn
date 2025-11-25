import { GoogleGenAI } from "@google/genai";
import { AppState, DOMCache } from './src/types';

// This is where we will attach all our functions
export interface AppFunctions {
    init?: any;
    auth?: any;
    helpers?: any;
    ui?: any;
    chat?: any;
    profile?: any;
    quiz?: any;
    activities?: any;
    admin?: any;
    friends?: any;
    achievements?: any;
}

export const DEFAULT_AI_PROMPT = "انت اسمك 'شحن مساعد'. انت مساعد ذكاء اصطناعي خبير في تطبيق 'شحن' لشحن الألعاب. مهمتك الوحيدة هي ترد على أسئلة المستخدمين عن التطبيق ومميزاته والألعاب اللي بنشحنها، ولازم ردك يكون **بالعامية المصرية**. انت خبير في كل حاجة: ازاي تكسب نقط من الإعلانات، أكواد الهدايا، المتجر، تعديل البروفايل، لوحة الصدارة، وغرف الأسئلة. بالنسبة لغرف الأسئلة، اشرحلهم ازاي يعملوا غرفة، يحددوا رسوم الدخول، يبعتوا الكود لأصحابهم، وازاي الذكاء الاصطناعي بيعمل الأسئلة لكل لعبة، ومين بيكسب حسب الإجابات الصح والسرعة. **قاعدة مهمة جداً:** لازم ترفض بأدب وشياكة أي سؤال مالوش علاقة بتطبيق 'شحن' أو شحن الألعاب. لو اتسألت سؤال بره الموضوع، لازم ترد برفض واضح وترجعهم للتطبيق تاني. مثال للرفض: 'معلش، أنا متخصص بس في كل حاجة ليها علاقة بتطبيق شحن والألعاب. 🎮 إزاي أقدر أساعدك في حسابك أو في غرف الأسئلة؟'.";

// These will be initialized in index.tsx and can be accessed globally via this module.
export let ai: GoogleGenAI | undefined;
export let aiChat: any;

export const setAi = (newAi: GoogleGenAI) => { ai = newAi; };
export const setAiChat = (newChat: any) => { aiChat = newChat; };

// The main application object that holds state, DOM references, and functions.
export const App: {
    state: AppState;
    DOM: DOMCache;
    functions: AppFunctions;
} = {
    state: {
        user: null,
        userData: null,
        loginEventsBound: false,
        pendingRegistration: null,
        charts: {},
        listeners: [],
        mainUIEventsBound: false,
        currentQuizRoomListener: null,
        currentQuizChatListener: null,
        pendingPurchase: null,
        activityTickerTimeout: null,
        quizLobbyListener: undefined,
        globalChatListener: undefined,
        questionTimer: undefined,
        questionPhaseTimeout: undefined,
        allUsersCache: [],
        allGamesCache: [],
        chatConfig: { bannedWords: [], flaggedWords: [], chatCooldownSeconds: 3 },
        appSettings: null,
        isGlobalEmojiCooldownActive: false,
        userEmojiTimestamps: [],
        adminInitialized: false,
        aiSystemPrompt: DEFAULT_AI_PROMPT,
        quizChatLastReadTimestamp: null,
    },
    DOM: {} as DOMCache,
    functions: {},
};