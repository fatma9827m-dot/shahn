// Fix: Add declarations for global variables from script tags. These are now in types.ts but needed here for context.
declare var firebase: any;
declare var Chart: any;

import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { GoogleGenAI } from "@google/genai";
import { App, setAi } from './app';
// Import the new initFirebase function
import { initFirebase, auth, db } from './src/firebase';
import { UserData } from './src/types';

// Import all functional modules
import { initFunctions } from './src/modules/init';
import { authFunctions } from './src/modules/auth';
import { helperFunctions } from './src/modules/helpers';
import { uiFunctions } from './src/modules/ui';
import { chatFunctions } from './src/modules/chat';
import { profileFunctions } from './src/modules/profile';
import { quizFunctions } from './src/modules/quiz';
import { activitiesFunctions } from './src/modules/activities';
import { adminFunctions } from './src/modules/admin';
import { achievementsFunctions } from './src/modules/achievements';
import { friendFunctions } from './src/modules/friends';


// Assemble the main App object with all its functions
App.functions.init = initFunctions;
App.functions.auth = authFunctions;
App.functions.helpers = helperFunctions;
App.functions.ui = uiFunctions;
App.functions.chat = chatFunctions;

// Combine related modules
profileFunctions.friends = friendFunctions; // for internal calls
App.functions.profile = profileFunctions;
App.functions.friends = friendFunctions; // for global access

App.functions.activities = activitiesFunctions;
App.functions.achievements = achievementsFunctions;

App.functions.quiz = quizFunctions;
App.functions.admin = adminFunctions;


async function initializeUserSession(user: any) {
    try {
        App.DOM.appLoader.classList.remove('hidden');
        App.DOM.connectionErrorOverlay.classList.add('hidden'); // Hide error overlay if retrying

        let userDoc = await db.collection('users').doc(user.uid).get();
        let userData: UserData;

        if (!userDoc.exists) {
            const usernameFromReg = App.state.pendingRegistration?.username;
            userData = await App.functions.auth.createNewUser(user, usernameFromReg);
            App.state.pendingRegistration = null;
        } else {
            userData = { uid: userDoc.id, ...userDoc.data() } as UserData;
            await db.collection('users').doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        await App.functions.init.startAppForUser(user.uid, userData);
    } catch (error: any) {
        console.error("Failed to initialize user session:", error);
        // Check if it's a Firestore connection error
        if (error.code === 'unavailable' || (error.message && error.message.includes("Could not reach Cloud Firestore backend"))) {
            App.DOM.appLoader.classList.add('hidden');
            App.DOM.connectionErrorOverlay.classList.remove('hidden');
        } else {
            // Handle other potential errors, maybe logout the user
            App.functions.ui.showToast("حدث خطأ غير متوقع أثناء تحميل بياناتك.", "error");
            App.functions.auth.logout();
        }
    }
}

async function main() {
    // 0. Initialize Firebase. This must be the first step.
    initFirebase();

    // 1. Get all DOM elements and cache them
    App.functions.ui.initDOM();
    
    // 2. Enable Firestore offline persistence
    try {
        await firebase.firestore().enablePersistence();
        console.log("Firestore offline persistence enabled.");
    } catch (err: any) {
        if (err.code == 'failed-precondition') {
            console.warn("Firestore offline persistence failed: Multiple tabs open, online-only mode will be used.");
        } else if (err.code == 'unimplemented') {
            console.warn("Firestore offline persistence failed: Browser not supported, online-only mode will be used.");
        } else {
            console.error("Firestore offline persistence failed:", err);
        }
    }

    // 3. Safely initialize Gemini API.
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            const newAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
            setAi(newAi);
        }
    } catch (error) {
        console.warn("Could not initialize Gemini API. AI features will be disabled.", error);
    }

    // 4. Set up Firebase auth state listener
    auth.onAuthStateChanged(async (user: any) => {
        App.functions.init.hideIntro();
        if (user) {
            // FIX: Reset auth form buttons to their default state upon successful login.
            const loginButton = App.DOM.loginForm.querySelector('button[type="submit"]') as HTMLButtonElement;
            const registerButton = App.DOM.registerForm.querySelector('button[type="submit"]') as HTMLButtonElement;
            App.functions.helpers.toggleButtonLoading(loginButton, false);
            App.functions.helpers.toggleButtonLoading(registerButton, false);

            App.state.user = user;
            App.DOM.loginContainer.classList.add('hidden');
            
            await initializeUserSession(user);

        } else {
            App.state.user = null;
            App.state.userData = null;
            
            App.DOM.appLoader.classList.add('hidden');
            App.DOM.appContainer.classList.add('hidden');
            App.DOM.loginContainer.classList.remove('hidden');
            
            App.functions.auth.bindLoginEvents();
        }
    });
    
    // 5. Global event listeners
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            App.functions.ui.closeAllModals();
        }
    });
    
    App.DOM.connectionErrorRetryBtn.addEventListener('click', () => {
        if (App.state.user) {
            initializeUserSession(App.state.user);
        }
    });
}

// Main App Initialization Logic
document.addEventListener('DOMContentLoaded', main);