

// Global variable declarations for script-based libraries
declare var firebase: any;
declare var Chart: any;
declare var html2canvas: any;
declare var confetti: any;

// Interfaces for application state and data structures
export interface DOMCache {
    [key:string]: HTMLElement;
    introSequence: HTMLElement;
    navAvatar: HTMLImageElement;
    navUsername: HTMLElement;
    navLevel: HTMLElement;
    navXpBar: HTMLElement;
    pointsCounter: HTMLElement;
    adminBroadcastBanner: HTMLElement;
    adminBroadcastMessage: HTMLElement;
    mainNav: HTMLElement;
    appLoader: HTMLElement;
    appContainer: HTMLElement;
    loginContainer: HTMLElement;
    authError: HTMLElement;
    showLoginTab: HTMLButtonElement;
    showRegisterTab: HTMLButtonElement;
    loginForm: HTMLFormElement;
    registerForm: HTMLFormElement;
    toastContainer: HTMLElement;
    mainView: HTMLElement;
    notificationsCount: HTMLElement;
    leaderboardModal: HTMLElement;
    leaderboardList: HTMLElement;
    leaderboardTabPoints: HTMLButtonElement;
    leaderboardTabQuiz: HTMLButtonElement;
    gameSelector: HTMLSelectElement;
    gameHeader: HTMLElement;
    packagesContainer: HTMLElement;
    gameLogo: HTMLImageElement;
    gameName: HTMLElement;
    playeridGameName: HTMLElement;
    playeridPkgName: HTMLElement;
    playeridModal: HTMLElement;
    playeridForm: HTMLFormElement;
    playeridInput: HTMLInputElement;
    activityTickerSpan: HTMLElement;
    leaderboardBtn: HTMLButtonElement;
    notificationsBtn: HTMLButtonElement;
    newsBtn: HTMLButtonElement;
    newsModal: HTMLElement;
    notificationsModal: HTMLElement;
    profileBtn: HTMLButtonElement;
    quizRoomsBtn: HTMLButtonElement;
    aiChatBtn: HTMLButtonElement;
    aiChatView: HTMLElement;
    globalChatBtn: HTMLButtonElement;
    globalChatView: HTMLElement;
    promoCodeForm: HTMLFormElement;
    watchAdBtn: HTMLButtonElement;
    aiChatForm: HTMLFormElement;
    globalChatForm: HTMLFormElement;
    
    // New Profile View
    profileView: HTMLElement;
    
    quizGameView: HTMLElement;
    adTimerModal: HTMLElement;
    adTimerCountdown: HTMLElement;
    globalChatMessages: HTMLElement;
    globalChatInput: HTMLInputElement;
    aiChatInput: HTMLInputElement;
    aiChatMessages: HTMLElement;
    genericModal: HTMLElement;
    genericModalContent: HTMLElement;
    bannedScreen: HTMLElement;
    
    quizChatBtn: HTMLButtonElement;
    quizChatPanel: HTMLElement;
    quizRoomChatMessages: HTMLElement;
    quizLobbyView: HTMLElement;
    
    popupNotificationContainer: HTMLElement;
    
    quizRoomChatInput: HTMLInputElement;
    quizRoomChatForm: HTMLFormElement;
    
    // Admin Panel Elements
    adminPanelBtn: HTMLButtonElement;
    adminPanelView: HTMLElement;
    adminSidebar: HTMLElement;
    adminSidebarNav: HTMLElement;
    adminContent: HTMLElement;
    adminSidebarOverlay: HTMLElement;
    adminSidebarCloseBtn: HTMLButtonElement;
    adminSidebarOpenBtn: HTMLButtonElement;
    adminMobileHeaderTitle: HTMLElement;
    adminContentWrapper: HTMLElement;

    // New elements
    shareImageContainer: HTMLElement;
    friendsModal: HTMLElement;
    
    mainContentArea: HTMLElement;
    connectionErrorOverlay: HTMLElement;
    connectionErrorRetryBtn: HTMLButtonElement;
    connectionStatusIndicator: HTMLElement;
    
    proofsView: HTMLElement;
    proofsViewUsername: HTMLElement;
    proofsViewContent: HTMLElement;

    // Private Chat Elements
    privateChatView: HTMLElement;
    privateChatMessages: HTMLElement;
    privateChatInput: HTMLInputElement;
    privateChatForm: HTMLFormElement;
    privateChatHeaderTitle: HTMLElement;
    privateChatHeaderAvatar: HTMLImageElement;
    privateChatHeaderStatus: HTMLElement;
}

export interface AudioCache {
    [key: string]: HTMLAudioElement;
}

export type QuizTier = 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface FriendRequest {
    fromId: string;
    fromUsername: string;
    fromAvatar: string;
    sentAt: any; // Firestore Timestamp
}

export interface UserData {
    uid: string;
    shortId: string;
    email: string;
    username: string;
    points: number;
    level: number;
    xp: number;
    role: 'player' | 'moderator' | 'admin';
    banned: boolean;
    createdAt: any; // Firestore Timestamp
    lastLogin: any; // Firestore Timestamp
    avatar: string;
    quizWins: number;
    quizzesPlayed: number;
    topups: number;
    adsWatched: number;
    assignedOrderGroup: number | null;
    lastAdWatched?: any; // Firestore Timestamp
    lastChatMessageTimestamp?: any; // Firestore Timestamp
    mutedUntil?: any; // Firestore Timestamp
    
    // New Quiz Stats
    quizTier: QuizTier;
    quizPrestige: number;
    quizStats: {
        totalScore: number;
        correctAnswers: number;
        incorrectAnswers: number;
        averageSpeed: number;
        lastDailyWin?: any; // Firestore Timestamp
    };
    gameLevels: { [gameId: string]: { level: number, xp: number } };
    
    // Progression/Social Features
    unlockedTitles: string[];
    achievements: { [key: string]: { date: any, name: string } };
    dailyMissions: any[];
    friends: string[];
    friendRequests: {
        incoming: FriendRequest[];
        outgoing: FriendRequest[];
    }
    quizWinStreak?: number;
    
    // Monetization/Customization Features
    equippedTitle?: string;
    equippedAvatarFrame?: string;
    equippedAnswerSkin?: string;
    tournamentTickets: number;
    cosmetics: { 
        avatarFrames: string[]; 
        answerEffects: string[];
        answerSkins?: string[];
    };
    hasHostBundle: boolean;
    savedTemplates: any[];
    proofs?: { url: string; uploadedAt: any }[];
}

export interface Game {
    id: string;
    name: string;
    logo: string;
    banner?: string;
    hasCommunityQuestions?: boolean;
    questionCategories?: string[];
}

export interface Package {
    id: string;
    name: string;
    value: string;
    points: number;
    banner?: string;
}

export interface QuizAnswer { 
    questionIndex: number; 
    answer: string; 
    correct: boolean; 
    timeTaken: number;
    score: number;
    wasFastest: boolean;
}
export interface Powerups {
    fiftyFifty: number;
    freezeTime: number;
    doublePoints: number;
}
export interface QuizPlayer {
    uid: string;
    username: string;
    avatar: string;
    score: number;
    joinedAt: any; // Firestore Timestamp
    answers: QuizAnswer[];
    ready: boolean;
    streak: number;
    powerups: Powerups;
    selectedPowerup?: keyof Powerups;
    usedUp: boolean;
    isEliminated: boolean;
    team?: 'blue' | 'red';
    quizTier: QuizTier;
    quizPrestige: number;
    fastestAnswers: number;
    // New social features
    lastEmoji?: { emoji: string, timestamp: any };
    lastInteraction?: { fromUid: string; fromUsername: string; type: string; timestamp: any; };
    isComebackActive?: boolean;
    
    quizWins?: number;
    quizzesPlayed?: number;
}
export interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
    type: 'text' | 'image';
    mediaUrl?: string;
    category?: string;
}

export interface CommunityQuestion extends QuizQuestion {
    id: string;
    gameId: string;
    status: 'pending' | 'approved' | 'rejected';
    submittedBy: { uid: string, username: string };
    createdAt: any;
}

export type QuizMode = 'classic' | 'teams' | 'elimination';
export type QuizTheme = 'space' | 'forest' | 'cyberpunk' | 'pirate';

export interface QuizRoom {
    id: string;
    shortId: string;
    hostId: string;
    hostUsername: string;
    hostAvatar: string;
    gameName: string;
    gameId: string;
    gameBanner?: string;
    players: { [uid: string]: QuizPlayer };
    spectators: { [uid: string]: { uid: string, username: string, avatar: string } };
    currentQuestionIndex: number;
    status: 'waiting' | 'voting' | 'starting' | 'playing' | 'tiebreaker' | 'finished';
    questions: QuizQuestion[];
    questionStartTime?: any; // Firestore Timestamp
    revealAnswerForIndex?: number;
    interstitialForIndex?: number;
    winnerId?: string;
    winningTeam?: 'blue' | 'red';
    createdAt: any;
    private: boolean;
    password?: string;
    prizePool: number;
    // FIX: Add missing properties to resolve type errors.
    entryFee: number;
    maxPlayers: number;
    questionTopic: 'in-game' | 'community' | 'ai';
    rematchRoomId?: string;
    gameLength: number;
    tiebreakerQuestion?: QuizQuestion;
    prizesAwarded?: boolean;
    
    // New Features
    mode: QuizMode;
    theme: QuizTheme;
    series?: { bestOf: 3 | 5, scores: { [uid_or_team: string]: number }, currentRound: number };
    featured?: boolean;
    questionCategoryVotes?: { [category: string]: string[] }; // category -> [uids]
    questionAnswerTallies?: { [option: string]: number };
    fastestFingerUid?: string;
    finalScores?: { blue: number, red: number };
    mvpId?: string;
    hostPrize?: { points: number };
    isEvent?: boolean;
    soundtrackUrl?: string;
    voiceChatEnabled?: boolean;
    previousRoomId?: string;
    isChallenge?: boolean;
    challengerId?: string;
    challengedId?: string;
    bannedUids?: { [uid: string]: { username: string, bannedAt: any } };
    bets?: { [spectatorUid: string]: { playerUid: string; amount: number; } };
    difficulty?: 'easy' | 'medium' | 'hard';
    invitedUids?: string[];
}

export interface ChartInstance {
    destroy: () => void;
    data: any;
    update: () => void;
}

export interface ChatConfig {
    bannedWords: string[];
    flaggedWords: string[];
    chatCooldownSeconds: number;
}

export interface AppSettings {
    welcomeBonus: number;
    adSettings: {
        pointsReward: number;
        cooldownSeconds: number;
        durationSeconds: number;
        linkUrl: string;
        xpReward: number;
    }
}

export interface AppState {
    user: any; // firebase.User | null
    userData: UserData | null;
    loginEventsBound: boolean;
    pendingRegistration: { username: string } | null;
    charts: { [key: string]: ChartInstance }; // Chart instances
    listeners: (() => void)[]; // Firestore listeners for general cleanup
    mainUIEventsBound: boolean;
    currentQuizRoomListener: (() => void) | null;
    currentQuizChatListener: (() => void) | null;
    pendingPurchase: { game: Game, pkg: Package } | null;
    activityTickerTimeout: any | null;
    questionTimer?: any;

    questionPhaseTimeout?: any; // Replaces questionCountdownInterval
    quizLobbyListener?: () => void;
    globalChatListener?: () => void;
    allUsersCache: UserData[]; // For admin search
    allGamesCache: Game[]; // For admin packages
    chatConfig: ChatConfig; // For chat moderation
    appSettings: AppSettings | null;
    isGlobalEmojiCooldownActive: boolean;
    userEmojiTimestamps: number[];
    adminInitialized: boolean;
    aiSystemPrompt: string; // For AI Control Center
    quizChatLastReadTimestamp: any | null;
    
    // Private Chat State
    currentPrivateChatListener?: () => void;
    currentPrivateChatId?: string;
}
