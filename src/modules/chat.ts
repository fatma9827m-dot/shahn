
import { db, firebase, database } from '../firebase';
import { App, aiChat } from '../../app';
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import { UserData } from '../types';

export const chatFunctions = {
    async handleAiChatSubmit() {
        if (!aiChat) {
            App.functions.ui.showToast('ميزة الدردشة مع الذكاء الاصطناعي غير مفعلة.', 'error');
            return;
        }
        const input = App.DOM.aiChatInput;
        const prompt = input.value.trim();
        if (!prompt) return;

        const messagesContainer = App.DOM.aiChatMessages;
        input.value = '';

        const userMessageEl = document.createElement('div');
        userMessageEl.className = 'chat-message user';
        userMessageEl.innerHTML = `<div class="message-bubble">${prompt}</div>`;
        messagesContainer.appendChild(userMessageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        const typingEl = document.createElement('div');
        typingEl.className = 'chat-message bot typing';
        typingEl.innerHTML = `<img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=shahn-ai" class="w-10 h-10 rounded-full"><div class="message-bubble"><i class="fas fa-spinner fa-spin"></i></div>`;
        messagesContainer.appendChild(typingEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const result = await aiChat.sendMessage({ message: prompt });
            const text = result.text;
            const htmlContent = marked(text);

            typingEl.classList.remove('typing');
            typingEl.querySelector('.message-bubble')!.innerHTML = htmlContent;
        } catch (error) {
            console.error("AI Chat Error:", error);
            typingEl.querySelector('.message-bubble')!.innerHTML = 'عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى.';
        } finally {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    },
    
    async handleGlobalChatSubmit() {
        const user = App.state.userData;
        if (!user) return;
        const input = App.DOM.globalChatInput;
        let message = input.value.trim();
        if (!message) return;

        if (user.mutedUntil && user.mutedUntil.toDate() > new Date()) {
            const unmuteDate = user.mutedUntil.toDate();
            App.functions.ui.showToast(`تم كتم صوتك. يمكنك الدردشة مرة أخرى في ${unmuteDate.toLocaleTimeString('ar-EG')}`, 'error');
            return;
        }
        
        const cooldown = App.state.chatConfig.chatCooldownSeconds || 0;
        if (cooldown > 0 && user.lastChatMessageTimestamp) {
            const secondsSinceLastMessage = (Date.now() - user.lastChatMessageTimestamp.toDate().getTime()) / 1000;
            if (secondsSinceLastMessage < cooldown) {
                App.functions.ui.showToast(`يجب أن تنتظر ${Math.ceil(cooldown - secondsSinceLastMessage)} ثواني لإرسال رسالة أخرى.`, 'info');
                return;
            }
        }
        input.value = '';

        const lowerCaseMessage = message.toLowerCase();
        for (const word of App.state.chatConfig.bannedWords) {
            if (lowerCaseMessage.includes(word)) {
                App.functions.ui.showToast('رسالتك تحتوي على كلمات محظورة.', 'error');
                input.value = message; return;
            }
        }

        let flaggedWordFound = App.state.chatConfig.flaggedWords.find(word => lowerCaseMessage.includes(word)) || null;
        
        const messageData = {
            uid: user.uid, username: user.username, avatar: user.avatar, role: user.role,
            message: message, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (flaggedWordFound) {
                 await db.collection('flaggedMessages').add({ ...messageData, flaggedWord: flaggedWordFound });
                 App.functions.ui.showToast('رسالتك قيد المراجعة من قبل المشرفين.', 'info');
            } else {
                const batch = db.batch();
                batch.set(db.collection('globalChat').doc(), messageData);
                batch.update(db.collection('users').doc(user.uid), { lastChatMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp() });
                await batch.commit();
            }
        } catch(error) {
            console.error("Error sending global chat message:", error);
            App.functions.ui.showToast('فشل إرسال الرسالة.', 'error');
            input.value = message; 
        }
    },
    
    listenForGlobalMessages() {
        if(App.state.globalChatListener) return; 

        App.DOM.globalChatMessages.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-4xl"></i></div>`;
        
        App.state.globalChatListener = db.collection('globalChat').orderBy('createdAt', 'desc').limit(50)
            .onSnapshot((snapshot: any) => {
                if (!App.DOM.globalChatView.classList.contains('view-inactive')) {
                    const messages = snapshot.docs.map((doc:any) => doc.data()).reverse();
                    const container = App.DOM.globalChatMessages;
                    container.innerHTML = messages.map((msg: any) => {
                        const isSelf = msg.uid === App.state.user?.uid;
                        
                        let usernameClasses = 'font-bold cursor-pointer hover:underline';
                        if(msg.role === 'admin') usernameClasses += ' text-red-400';
                        if(msg.role === 'moderator') usernameClasses += ' text-blue-400';
                        
                        if(msg.role === 'announcement') return `
                            <div class="text-center my-4">
                                <div class="inline-block bg-yellow-400/20 text-yellow-300 p-2 rounded-lg text-sm">
                                    <i class="fas fa-bullhorn mr-2"></i> ${msg.message}
                                </div>
                            </div>
                        `;

                        return `
                        <div class="chat-message-global ${isSelf ? 'self' : ''}">
                            <img src="${msg.avatar}" class="w-10 h-10 rounded-full cursor-pointer view-profile-btn flex-shrink-0" data-user-id="${msg.uid}">
                            <div>
                                ${!isSelf ? `<p class="global-chat-username ${usernameClasses} view-profile-btn" data-user-id="${msg.uid}">${msg.username}</p>` : ''}
                                <div class="message-bubble-global">${msg.message}</div>
                            </div>
                        </div>
                        `;

                    }).join('');
                    container.scrollTop = container.scrollHeight;
                }
            }, (error: any) => {
                 console.error("Error listening to global chat:", error);
                 App.DOM.globalChatMessages.innerHTML = `<p class="text-red-500 text-center">.حدث خطأ في تحميل الدردشة</p>`;
            });
            App.state.listeners.push(App.state.globalChatListener);
    },

    // --- Private Chat Functions ---

    getChatId(uid1: string, uid2: string) {
        return [uid1, uid2].sort().join('_');
    },

    openPrivateChat(targetUser: UserData) {
        const currentUser = App.state.userData;
        if (!currentUser) return;

        // 1. Configure Header
        App.DOM.privateChatHeaderTitle.textContent = targetUser.username;
        App.DOM.privateChatHeaderAvatar.src = targetUser.avatar;
        
        const statusEl = App.DOM.privateChatHeaderStatus;
        if (statusEl) {
            statusEl.textContent = 'جاري التحقق...';
            statusEl.className = 'text-xs text-gray-400 block';
            
            const statusRef = firebase.database().ref('/status/' + targetUser.uid);
            
            // Fallback using Firestore lastLogin data passed in targetUser
            const setOfflineStatus = () => {
                if (targetUser.lastLogin) {
                    const date = targetUser.lastLogin.toDate ? targetUser.lastLogin.toDate() : new Date(targetUser.lastLogin);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);

                    let timeString = '';
                    if (diffMins < 1) timeString = 'منذ لحظات';
                    else if (diffMins < 60) timeString = `منذ ${diffMins} دقيقة`;
                    else if (diffHours < 24) timeString = `منذ ${diffHours} ساعة`;
                    else if (diffDays < 7) timeString = `منذ ${diffDays} يوم`;
                    else timeString = date.toLocaleDateString('ar-EG');
                    
                    statusEl.textContent = `آخر ظهور: ${timeString}`;
                } else {
                    statusEl.textContent = 'غير متصل';
                }
                statusEl.className = 'text-xs text-gray-500 block';
            };

            const listener = statusRef.on('value', (snapshot: any) => {
                const status = snapshot.val();
                if (status && status.state === 'online') {
                    statusEl.textContent = '🟢 متصل الآن';
                    statusEl.className = 'text-xs text-green-400 font-bold block';
                } else {
                    if (status && status.last_changed) {
                        const date = new Date(status.last_changed);
                        const now = new Date();
                        const diffMs = now.getTime() - date.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMins / 60);
                        const diffDays = Math.floor(diffHours / 24);

                        let timeString = 'منذ لحظات';
                        if (diffMins < 1) timeString = 'منذ لحظات';
                        else if (diffMins < 60) timeString = `منذ ${diffMins} دقيقة`;
                        else if (diffHours < 24) timeString = `منذ ${diffHours} ساعة`;
                        else if (diffDays < 7) timeString = `منذ ${diffDays} يوم`;
                        else timeString = date.toLocaleDateString('ar-EG');
                        
                        statusEl.textContent = `آخر ظهور: ${timeString}`;
                        statusEl.className = 'text-xs text-gray-500 block';
                    } else {
                        setOfflineStatus();
                    }
                }
            }, (error: any) => {
                // Error reading RTDB (likely permission denied), fallback to Firestore data
                setOfflineStatus();
            });
            App.state.listeners.push(() => statusRef.off('value', listener));
        }

        // 3. Calculate Chat ID
        const chatId = this.getChatId(currentUser.uid, targetUser.uid);
        App.state.currentPrivateChatId = chatId;

        // 4. Open View
        App.functions.ui.openFullscreenView(App.DOM.privateChatView);
        
        // 5. Start Listening to messages
        this.listenForPrivateMessages(chatId);
    },

    listenForPrivateMessages(chatId: string) {
        if (App.state.currentPrivateChatListener) {
            App.state.currentPrivateChatListener(); // Unsubscribe previous
        }

        App.DOM.privateChatMessages.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-4xl"></i></div>`;

        App.state.currentPrivateChatListener = db.collection('privateChats').doc(chatId).collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(30)
            .onSnapshot((snapshot: any) => {
                const messages = snapshot.docs.map((doc: any) => doc.data()).reverse();
                const container = App.DOM.privateChatMessages;
                
                if (messages.length === 0) {
                    container.innerHTML = `<p class="text-center text-gray-500 text-sm mt-4">بداية المحادثة. قل مرحباً!</p>`;
                    return;
                }

                container.innerHTML = messages.map((msg: any) => {
                    const isSelf = msg.senderId === App.state.userData?.uid;
                    return `
                        <div class="chat-message ${isSelf ? 'user' : 'bot'}">
                            <div class="message-bubble">${msg.text}</div>
                        </div>
                    `;
                }).join('');
                container.scrollTop = container.scrollHeight;
            }, (error: any) => {
                console.error("Error listening for private messages:", error);
                App.DOM.privateChatMessages.innerHTML = `<p class="text-red-500 text-center">حدث خطأ في الاتصال.</p>`;
            });
            
        // Add to global listeners array so it can be cleaned up on logout
        App.state.listeners.push(App.state.currentPrivateChatListener);
    },

    async handlePrivateChatSubmit() {
        const user = App.state.userData;
        const chatId = App.state.currentPrivateChatId;
        const input = App.DOM.privateChatInput;
        const message = input.value.trim();

        if (!user || !chatId || !message) return;
        
        input.value = '';

        try {
            const chatRef = db.collection('privateChats').doc(chatId);
            const batch = db.batch();

            // Add message
            const messageRef = chatRef.collection('messages').doc();
            batch.set(messageRef, {
                senderId: user.uid,
                text: message,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            // Update parent doc for listing (last message info)
            batch.set(chatRef, {
                lastMessage: message,
                lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
                participants: chatId.split('_') // Array of both UIDs
            }, { merge: true });

            await batch.commit();

        } catch (error) {
            console.error("Failed to send private message:", error);
            App.functions.ui.showToast('فشل إرسال الرسالة', 'error');
            input.value = message; // Restore input
        }
    }
};
