


import { db, firebase, database } from '../firebase';
import { UserData, ChatConfig, AppSettings } from '../types';
import { App, DEFAULT_AI_PROMPT, ai, setAiChat } from '../../app';
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

export const initFunctions = {
    hideIntro() {
        if (App.DOM.introSequence && !App.DOM.introSequence.classList.contains('hidden')) {
            App.DOM.introSequence.style.opacity = '0';
            App.DOM.introSequence.style.pointerEvents = 'none';
            setTimeout(() => App.DOM.introSequence.classList.add('hidden'), 500);
        }
    },

    setupConnectionStatusListener() {
        if (!database) {
            console.warn('Firebase Realtime Database SDK is not included or initialized. Connection status indicator will not work.');
            return;
        }
        const connectedRef = database.ref(".info/connected");
        const indicator = App.DOM.connectionStatusIndicator;

        // --- PRESENCE SYSTEM LOGIC ---
        const uid = App.state.userData?.uid;
        
        connectedRef.on("value", (snap: any) => {
            const isConnected = snap.val();
            if (isConnected === true) {
                // UI Indicator Update
                if (indicator) {
                    indicator.classList.remove('disconnected', 'connecting');
                    indicator.classList.add('connected');
                    indicator.title = 'متصل';
                }

                // Set User Presence in RTDB
                if (uid) {
                    const userStatusDatabaseRef = database.ref('/status/' + uid);
                    const isOfflineForDatabase = {
                        state: 'offline',
                        last_changed: firebase.database.ServerValue.TIMESTAMP,
                    };
                    const isOnlineForDatabase = {
                        state: 'online',
                        last_changed: firebase.database.ServerValue.TIMESTAMP,
                    };

                    // When I disconnect, update the last time I was seen online
                    userStatusDatabaseRef.onDisconnect().set(isOfflineForDatabase).then(() => {
                        // We are now connected, so set status to online
                        userStatusDatabaseRef.set(isOnlineForDatabase);
                    });
                }

            } else {
                if (indicator) {
                    indicator.classList.remove('connected', 'connecting');
                    indicator.classList.add('disconnected');
                    indicator.title = 'غير متصل';
                }
            }
        });

        // Set initial state to connecting if valid
        if (indicator) {
            indicator.classList.remove('connected', 'disconnected');
            indicator.classList.add('connecting');
            indicator.title = 'جاري الاتصال...';
        }
    },

    async startAppForUser(uid: string, userData: UserData) {
        console.log(`Initializing app for user: ${uid}`, userData);
        
        // Fetch dynamic configs
        const chatConfigDoc = await db.collection('settings').doc('chatConfig').get();
        if (chatConfigDoc.exists) {
            App.state.chatConfig = chatConfigDoc.data() as ChatConfig;
        } else {
            const defaultConfig = {
                bannedWords: ['كلب', 'حقير', 'حثالة', 'حيوان', 'قحبة', 'عاهرة', 'شرموطة', 'كس', 'زب', 'طيز', 'لعنة'],
                flaggedWords: ['غش', 'هكر', 'بيع', 'شراء', 'حساب'],
                chatCooldownSeconds: 3
            };
            await db.collection('settings').doc('chatConfig').set(defaultConfig);
            App.state.chatConfig = defaultConfig;
        }
        
        const appConfigDoc = await db.collection('settings').doc('appConfig').get();
        if (appConfigDoc.exists) {
            App.state.appSettings = appConfigDoc.data() as AppSettings;
        } else {
             const defaultSettings: AppSettings = {
                welcomeBonus: 100,
                adSettings: {
                    pointsReward: 15,
                    cooldownSeconds: 3600, // 60 minutes
                    durationSeconds: 15,
                    linkUrl: '',
                    xpReward: 5
                }
            };
            await db.collection('settings').doc('appConfig').set(defaultSettings);
            App.state.appSettings = defaultSettings;
        }

        const aiConfigDoc = await db.collection('settings').doc('aiConfig').get();
        if (aiConfigDoc.exists) {
            App.state.aiSystemPrompt = aiConfigDoc.data().systemPrompt || DEFAULT_AI_PROMPT;
        } else {
            await db.collection('settings').doc('aiConfig').set({ systemPrompt: DEFAULT_AI_PROMPT });
            App.state.aiSystemPrompt = DEFAULT_AI_PROMPT;
        }

        if (ai) {
            const newChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: App.state.aiSystemPrompt,
                },
            });
            setAiChat(newChat);
        }
        
        App.functions.ui.updateNavAndState(userData);

        App.functions.ui.setupUserListeners(uid); 
        this.setupConnectionStatusListener();
        App.functions.ui.bindMainUIEvents();
        await App.functions.ui.loadGamesForSelector();
        App.functions.ui.startActivityTicker();

        // Initialize AudioContext on first click to comply with browser policies
        const unlockAudio = () => {
            if (App.functions.ui.sound.cache['click']) {
                // Play and immediately pause to unlock audio context
                const sound = App.functions.ui.sound.cache['click'];
                sound.play().then(() => {
                    sound.pause();
                    sound.currentTime = 0;
                }).catch(() => {});
                document.removeEventListener('click', unlockAudio);
            }
        };
        document.addEventListener('click', unlockAudio);


        const broadcastListener = db.collection('settings').doc('broadcast').onSnapshot((doc: any) => {
            const data = doc.data();
            const banner = App.DOM.adminBroadcastBanner;
            const messageSpan = App.DOM.adminBroadcastMessage;
            const mainNav = App.DOM.mainNav;
            if (data && data.active && data.message) {
                messageSpan.textContent = data.message;
                banner.classList.remove('hidden');
                mainNav.style.top = `${banner.offsetHeight}px`;
            } else {
                banner.classList.add('hidden');
                mainNav.style.top = '0px';
            }
        });
        App.state.listeners.push(broadcastListener);
        
        // Auto-delete news older than 15 days
        const newsCleanup = async () => {
            try {
                const fifteenDaysAgo = firebase.firestore.Timestamp.fromMillis(Date.now() - 15 * 24 * 60 * 60 * 1000);
                const oldNewsQuery = db.collection('news').where('createdAt', '<', fifteenDaysAgo);
                const snapshot = await oldNewsQuery.get();
                const batch = db.batch();
                snapshot.docs.forEach((doc: any) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`Cleaned up ${snapshot.size} old news items.`);
            } catch (error) {
                console.error("Error cleaning up old news:", error);
            }
        };
        newsCleanup();

        App.DOM.appLoader.classList.add('hidden');
        App.DOM.appContainer.classList.remove('hidden');
        App.DOM.loginContainer.classList.add('hidden');
        
        console.log("App initialized and displayed for", userData.username);
    }
};
