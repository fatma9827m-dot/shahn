import { db, auth, firebase } from '../firebase';
import { App } from '../../app';
import { UserData } from '../types';

export const authFunctions = {
    async createNewUser(user: any, usernameFromForm: string | null = null): Promise<UserData> {
        console.log('Creating new user document for:', user.uid);
        const username = usernameFromForm || user.displayName || `player_${user.uid.substring(0, 6)}`;
        
        const welcomeBonus = App.state.appSettings?.welcomeBonus || 100;

        // FIX: Add missing properties from UserData interface
        const newUser: UserData = {
            uid: user.uid,
            shortId: App.functions.helpers.generateShortId(),
            email: user.email,
            username: username,
            points: welcomeBonus, 
            level: 1,
            xp: 0,
            role: 'player',
            banned: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            avatar: user.photoURL || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cccccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E",
            quizWins: 0,
            quizzesPlayed: 0,
            topups: 0,
            adsWatched: 0,
            assignedOrderGroup: null,
            quizTier: 'unranked',
            quizPrestige: 0,
            quizStats: {
                totalScore: 0,
                correctAnswers: 0,
                incorrectAnswers: 0,
                averageSpeed: 0,
            },
            gameLevels: {},
            unlockedTitles: [],
            achievements: {},
            dailyMissions: [],
            friends: [],
            friendRequests: {
                incoming: [],
                outgoing: [],
            },
            quizWinStreak: 0,
            tournamentTickets: 0,
            cosmetics: { 
                avatarFrames: [], 
                answerEffects: [],
                answerSkins: ['classic'],
            },
            equippedAnswerSkin: 'classic',
            hasHostBundle: false,
            savedTemplates: [],
        };
        await db.collection('users').doc(user.uid).set(newUser, { merge: true });
        await App.functions.helpers.logPointsChange(user.uid, username, welcomeBonus, 'مكافأة التسجيل');
        
        console.log('New user document created.');
        return newUser;
    },

    logout() {
        // Close all UI views and modals. This also handles cleanup of view-specific listeners like quiz and chat.
        App.functions.ui.closeAllModals();
        App.functions.ui.closeFullscreenView();

        // Clean up remaining global listeners (e.g., user doc, notifications) and state.
        // App.state.listeners contains user-specific listeners that need to be detached.
        App.state.listeners.forEach(unsubscribe => unsubscribe());
        App.state.listeners = [];

        if(App.state.activityTickerTimeout) {
            clearTimeout(App.state.activityTickerTimeout);
            App.state.activityTickerTimeout = null;
        }
        
        Object.values(App.state.charts).forEach(chart => (chart as any).destroy());
        App.state.charts = {};
        
        // After cleaning up state, sign out from Firebase.
        auth.signOut().catch((error: any) => console.error("Sign out error", error));
    },

    showAuthError(message: string) {
        if (App.DOM.authError) {
            App.DOM.authError.textContent = message;
        }
    },
    
    translateAuthError(code: string) {
        switch (code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
            case 'auth/invalid-email':
                return 'البريد الإلكتروني غير صالح.';
            case 'auth/email-already-in-use':
                return 'هذا البريد الإلكتروني مسجل بالفعل.';
            case 'auth/weak-password':
                return 'كلمة المرور ضعيفة جدًا. يجب أن تكون 6 أحرف على الأقل.';
            case 'auth/too-many-requests':
                return 'تم حظر الطلبات من هذا الجهاز مؤقتًا بسبب كثرة المحاولات. حاول مرة أخرى لاحقًا.';
            case 'auth/popup-closed-by-user':
                return 'تم إلغاء عملية تسجيل الدخول.';
            default:
                return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
        }
    },

    bindLoginEvents() {
        if (App.state.loginEventsBound) return;
        console.log('Binding login events...');

        const { showLoginTab, showRegisterTab, loginForm, registerForm, authError } = App.DOM;

        showLoginTab.addEventListener('click', () => {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            showLoginTab.classList.add('border-yellow-400', 'text-primary');
            showLoginTab.classList.remove('border-transparent', 'text-gray-400');
            showRegisterTab.classList.add('border-transparent', 'text-gray-400');
            showRegisterTab.classList.remove('border-yellow-400', 'text-primary');
            if (authError) authError.textContent = '';
        });

        showRegisterTab.addEventListener('click', () => {
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            showRegisterTab.classList.add('border-yellow-400', 'text-primary');
            showRegisterTab.classList.remove('border-transparent', 'text-gray-400');
            showLoginTab.classList.add('border-transparent', 'text-gray-400');
            showLoginTab.classList.remove('border-yellow-400', 'text-primary');
            if (authError) authError.textContent = '';
        });
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = loginForm.querySelector('button[type="submit"]') as HTMLButtonElement;
            App.functions.helpers.toggleButtonLoading(button, true);
            if (authError) authError.textContent = '';
            try {
                await auth.signInWithEmailAndPassword((loginForm.elements.namedItem('email') as HTMLInputElement).value, (loginForm.elements.namedItem('password') as HTMLInputElement).value);
            } catch (error: any) {
                this.showAuthError(this.translateAuthError(error.code));
                App.functions.helpers.toggleButtonLoading(button, false);
            }
        });

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const button = registerForm.querySelector('button[type="submit"]') as HTMLButtonElement;
            App.functions.helpers.toggleButtonLoading(button, true);
            if (authError) authError.textContent = '';
            App.state.pendingRegistration = { 
                username: (registerForm.elements.namedItem('username') as HTMLInputElement).value,
            };
            try {
                await auth.createUserWithEmailAndPassword((registerForm.elements.namedItem('email') as HTMLInputElement).value, (registerForm.elements.namedItem('password') as HTMLInputElement).value);
            } catch (error: any) {
                this.showAuthError(this.translateAuthError(error.code));
                App.state.pendingRegistration = null;
                App.functions.helpers.toggleButtonLoading(button, false);
            }
        });

        document.querySelectorAll('.toggle-password').forEach(button => {
            button.addEventListener('click', () => {
                const input = button.previousElementSibling;
                if (input instanceof HTMLInputElement) {
                    const icon = button.querySelector('i');
                    if (input.type === 'password') {
                        input.type = 'text';
                        icon?.classList.remove('fa-eye');
                        icon?.classList.add('fa-eye-slash');
                    } else {
                        input.type = 'password';
                        icon?.classList.remove('fa-eye-slash');
                        icon?.classList.add('fa-eye');
                    }
                }
            });
        });

        App.state.loginEventsBound = true;
    }
};