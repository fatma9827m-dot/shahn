
import { db, firebase } from '../../firebase';
import { App } from '../../../app';

export function listenForRoomChat(this: any, roomId: string) {
    if (App.state.currentQuizChatListener) App.state.currentQuizChatListener();
    App.state.currentQuizChatListener = db.collection('quizRooms').doc(roomId).collection('chat').orderBy('createdAt', 'desc').limit(30)
        .onSnapshot((snapshot: any) => {
            const messages = snapshot.docs.map((doc: any) => doc.data()).reverse();
            
            // Update side panel
            if (!App.DOM.quizChatPanel.classList.contains('view-inactive')) {
                App.DOM.quizRoomChatMessages.innerHTML = messages.map((msg: any) => `
                <div class="chat-message-global ${msg.uid === App.state.user?.uid ? 'self' : ''}">
                    <img src="${msg.avatar}" class="w-8 h-8 rounded-full cursor-pointer view-profile-btn flex-shrink-0" data-user-id="${msg.uid}">
                    <div>
                        ${msg.uid !== App.state.user?.uid ? `<p class="global-chat-username" data-user-id="${msg.uid}">${msg.username}</p>` : ''}
                        <div class="message-bubble-global">${msg.message}</div>
                    </div>
                </div>`).join('');
                App.DOM.quizRoomChatMessages.scrollTop = App.DOM.quizRoomChatMessages.scrollHeight;
            }

            // In-game chat bubbles
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && !App.DOM.quizGameView.classList.contains('view-inactive')) {
                // Only show if new (rough check by timestamp vs current time, ideally store lastSeenId)
                const msgTime = lastMsg.createdAt?.toMillis() || Date.now();
                if (Date.now() - msgTime < 5000) {
                     const avatarWrapper = document.querySelector(`.quiz-player-avatar-wrapper[data-uid="${lastMsg.uid}"]`);
                     if (avatarWrapper) {
                         const bubble = document.createElement('div');
                         bubble.className = 'quiz-room-chat-bubble-visual';
                         bubble.textContent = lastMsg.message;
                         avatarWrapper.appendChild(bubble);
                         setTimeout(() => bubble.remove(), 3000);
                     }
                }
            }
        });
    App.state.listeners.push(App.state.currentQuizChatListener);
}

export async function handleRoomChatSubmit(this: any, roomId: string) {
    const user = App.state.userData;
    const input = App.DOM.quizRoomChatInput;
    const message = input.value.trim();
    if (!user || !message) return;
    input.value = '';
    await db.collection('quizRooms').doc(roomId).collection('chat').add({
        uid: user.uid, username: user.username, avatar: user.avatar,
        message: message, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}
