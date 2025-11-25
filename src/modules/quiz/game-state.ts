
import { db, firebase } from '../../firebase';
import { App } from '../../../app';
import { QuizRoom, QuizPlayer, QuizTier } from '../../types';

export async function joinQuizRoom(this: any, roomId: string, password?: string, asSpectator = false) {
    const user = App.state.userData;
    if (!user) return;
    const roomRef = db.collection('quizRooms').doc(roomId);

    try {
        const roomDocPreCheck = await roomRef.get();
        if (!roomDocPreCheck.exists) throw new Error("الغرفة لم تعد موجودة.");
        const roomPreCheck = roomDocPreCheck.data() as QuizRoom;

        if (roomPreCheck.bannedUids && roomPreCheck.bannedUids[user.uid]) {
            throw new Error("لقد تم حظرك من هذه الغرفة.");
        }
        
        if (!asSpectator && user.points < roomPreCheck.entryFee) {
            const missing = roomPreCheck.entryFee - user.points;
            throw new Error(`رصيدك غير كافي. تحتاج إلى ${missing} نقطة إضافية للانضمام.`);
        }

        await db.runTransaction(async (transaction: any) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) throw new Error("الغرفة لم تعد موجودة.");

            const room = roomDoc.data() as QuizRoom;
            const isInvited = room.invitedUids?.includes(user.uid);

            if (room.private && !isInvited && room.password !== password && !asSpectator && !room.isChallenge) {
                 throw new Error("كلمة المرور غير صحيحة.");
            }
            
            if (asSpectator) {
                transaction.update(roomRef, {
                    [`spectators.${user.uid}`]: { uid: user.uid, username: user.username, avatar: user.avatar }
                });
                return;
            }

            if (room.status !== 'waiting' && room.status !== 'voting') throw new Error("لا يمكنك الانضمام، اللعبة بدأت بالفعل.");
            if (Object.keys(room.players).length >= room.maxPlayers) throw new Error("الغرفة ممتلئة.");
            if (room.players[user.uid]) return;
            
            const userRef = db.collection('users').doc(user.uid);
            const userDoc = await transaction.get(userRef);
            if (userDoc.data().points < room.entryFee) throw new Error("ليس لديك نقاط كافية لرسوم الدخول.");

            const newPlayer: QuizPlayer = {
                uid: user.uid, username: user.username, avatar: user.avatar, score: 0,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                answers: [], ready: false, streak: 0, 
                powerups: { fiftyFifty: 1, freezeTime: 1, doublePoints: 1 },
                usedUp: false, isEliminated: false, quizTier: user.quizTier || 'unranked',
                quizPrestige: user.quizPrestige || 0, fastestAnswers: 0,
                quizWins: user.quizWins || 0, quizzesPlayed: user.quizzesPlayed || 0,
            };
            
            transaction.update(roomRef, {
                [`players.${user.uid}`]: newPlayer
            });
        });
        this.enterQuizRoomView(roomId);
    } catch (error: any) {
        App.functions.ui.showAlert('تعذر الانضمام', error.message);
    }
}

export function enterQuizRoomView(this: any, roomId: string) {
    App.functions.ui.openFullscreenView(App.DOM.quizGameView);
    if(App.state.quizLobbyListener) { App.state.quizLobbyListener(); App.state.quizLobbyListener = undefined; }
    if (App.state.currentQuizRoomListener) App.state.currentQuizRoomListener();
    
    let isFirstSnapshot = true;
    App.state.currentQuizRoomListener = db.collection('quizRooms').doc(roomId).onSnapshot((doc: any) => {
        if (!doc.exists) {
            if (this.currentQuizRoom) {
                this.handleUnexpectedRoomClosure(this.currentQuizRoom);
            } else {
                 App.functions.ui.showAlert("تنبيه", "تم إغلاق الغرفة.");
            }
            App.functions.ui.closeFullscreenView();
            return;
        }

        const room = { id: doc.id, ...doc.data() } as QuizRoom;
        const oldRoomState = this.currentQuizRoom;
        this.currentQuizRoom = room;

        const isGameActive = !['waiting', 'voting'].includes(room.status);
        App.DOM.quizChatBtn.classList.toggle('hidden', isGameActive);

        App.DOM.quizGameView.className = `fullscreen-view fixed inset-0 z-50 transition-all duration-500 theme-${room.theme}-bg`;
        
        const myUid = App.state.userData?.uid;
        const isPlayer = myUid && room.players[myUid];
        const isSpectator = myUid && !isPlayer && room.spectators && room.spectators[myUid];

        if (room.status !== oldRoomState?.status || room.currentQuestionIndex !== oldRoomState?.currentQuestionIndex || room.revealAnswerForIndex !== oldRoomState?.revealAnswerForIndex || room.interstitialForIndex !== oldRoomState?.interstitialForIndex) {
            clearTimeout(App.state.questionTimer);
            clearTimeout(App.state.questionPhaseTimeout);
        }
        
        let shouldRender = true;
        
        if (oldRoomState) {
            const statusChanged = room.status !== oldRoomState.status;
            const questionChanged = room.currentQuestionIndex !== oldRoomState.currentQuestionIndex;
            const revealChanged = room.revealAnswerForIndex !== oldRoomState.revealAnswerForIndex;
            const interstitialChanged = room.interstitialForIndex !== oldRoomState.interstitialForIndex;
            const playerCountChanged = Object.keys(room.players || {}).length !== Object.keys(oldRoomState.players || {}).length;

            if (!statusChanged && !questionChanged && !revealChanged && !interstitialChanged && !playerCountChanged) {
                shouldRender = false; 
            }
        }

        if (shouldRender) {
             if (isSpectator) {
                this.renderSpectatorView(room);
            } else if (isPlayer) {
                switch (room.status) {
                    case 'waiting': 
                    case 'voting':
                        this.renderQuizWaitingRoom(room); 
                        break;
                    case 'starting': 
                        this.renderQuizStarting(room); 
                        break;
                    case 'playing':
                    case 'tiebreaker':
                        if (room.revealAnswerForIndex !== undefined) this.renderAnswerReveal(room);
                        else if (room.interstitialForIndex !== undefined) this.renderInterstitial(room);
                        else this.renderQuizPlaying(room);
                        break;
                    case 'finished': 
                        this.renderFinished(room); 
                        break;
                }
            } else {
                 if (!isFirstSnapshot) {
                    this.handleLeaveRoom();
                    App.functions.ui.showAlert("تنبيه", "لقد تم طردك من الغرفة.");
                    return;
                 }
            }
        }

        if (oldRoomState) {
            for (const player of Object.values(room.players)) {
                const oldPlayerState = oldRoomState.players[player.uid];
                if (player.lastEmoji && player.lastEmoji.timestamp?.toMillis() !== oldPlayerState?.lastEmoji?.timestamp?.toMillis()) {
                    const avatarWrapper = document.querySelector(`.player-slot-content[data-uid="${player.uid}"], .quiz-player-avatar-wrapper[data-uid="${player.uid}"]`);
                    if (avatarWrapper) {
                        const emojiMap: { [key: string]: string } = { '👍': 'emoji-like', '😂': 'emoji-laugh', '🔥': 'emoji-fire', '🤯': 'emoji-explode', '👋': 'emoji-wave', '🙏': 'emoji-glow' };
                        const emojiClass = emojiMap[player.lastEmoji.emoji] || 'emoji-like';
                        const emojiEl = document.createElement('div');
                        emojiEl.className = `player-quick-emoji ${emojiClass}`;
                        emojiEl.textContent = player.lastEmoji.emoji;
                        avatarWrapper.appendChild(emojiEl);
                        setTimeout(() => emojiEl.remove(), 2000);
                    }
                }
                if (player.lastInteraction && player.lastInteraction.timestamp?.toMillis() !== oldPlayerState?.lastInteraction?.timestamp?.toMillis()) {
                    (this as any).triggerInteractionAnimation(player.uid, player.lastInteraction.type, player.lastInteraction.fromUsername);
                }
            }
        }
        isFirstSnapshot = false;
        
    }, (error: any) => {
        console.error("Quiz room listener error:", error);
        App.functions.ui.showToast("حدث خطأ في الاتصال بالغرفة.", "error");
        App.functions.ui.closeFullscreenView();
    });
    this.listenForRoomChat(roomId);
    App.state.listeners.push(App.state.currentQuizRoomListener);
}

export async function handleLeaveRoom(this: any) {
    const user = App.state.userData;
    const room = this.currentQuizRoom;
    if (!user || !room) return App.functions.ui.closeFullscreenView();

    App.functions.ui.showToast("...جار مغادرة الغرفة", "info");

    const roomRef = db.collection('quizRooms').doc(room.id);
    try {
        await db.runTransaction(async (transaction: any) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) return;
            const currentRoomData = roomDoc.data() as QuizRoom;
            let playerLeft = false;

            if (currentRoomData.players[user.uid]) {
                playerLeft = true;
                transaction.update(roomRef, { [`players.${user.uid}`]: firebase.firestore.FieldValue.delete() });
            } else if (currentRoomData.spectators && currentRoomData.spectators[user.uid]) {
                transaction.update(roomRef, { [`spectators.${user.uid}`]: firebase.firestore.FieldValue.delete() });
            }

            const remainingPlayers = Object.keys(currentRoomData.players).filter(uid => uid !== user.uid);

            if (currentRoomData.hostId === user.uid && playerLeft) {
                if (currentRoomData.status === 'waiting' || currentRoomData.status === 'voting' || remainingPlayers.length === 0) {
                    transaction.delete(roomRef);
                } else if (remainingPlayers.length > 0) {
                    const newHostId = remainingPlayers.sort((a,b) => (currentRoomData.players[a].joinedAt?.toMillis() || 0) - (currentRoomData.players[b].joinedAt?.toMillis() || 0))[0];
                    transaction.update(roomRef, { hostId: newHostId, hostUsername: currentRoomData.players[newHostId].username });
                }
            }
        });
    } catch (error) {
        console.error("Error leaving room:", error);
    } finally {
        App.functions.ui.closeFullscreenView();
    }
}

export async function handleUnexpectedRoomClosure(this: any, room: QuizRoom) {
    const user = App.state.userData;
    if (!room || !user) return;
    
    const wasActive = ['playing', 'starting', 'tiebreaker', 'finished'].includes(room.status);
    const paidEntry = room.entryFee > 0;
    const prizesGiven = room.prizesAwarded; 
    
    if (room.status === 'finished' || prizesGiven) {
         App.functions.ui.showAlert("نهاية الغرفة", "تم إغلاق الغرفة من قبل المضيف بعد انتهاء اللعبة.");
         return;
    }

    let title = "تم إغلاق الغرفة";
    let message = "تم إغلاق الغرفة.";
    
    if (wasActive) {
        title = "إغلاق غير متوقع";
        message = "تم إغلاق الغرفة بشكل مفاجئ أثناء اللعب.";
        
        if (paidEntry) {
             try {
                await db.collection('users').doc(user.uid).update({
                    points: firebase.firestore.FieldValue.increment(room.entryFee)
                });
                await App.functions.helpers.logPointsChange(user.uid, user.username, room.entryFee, `استرجاع تلقائي: غرفة ${room.shortId}`);
                message += `\n\n✅ تم استرجاع ${room.entryFee} نقطة إلى رصيدك.`;
            } catch (e) {
                console.error("Refund failed", e);
                message += `\n\n⚠️ فشل استرجاع النقاط تلقائياً. يرجى تصوير الشاشة والتواصل مع الدعم.`;
            }
        }
    } else {
        message = "قام المضيف بإغلاق الغرفة.";
    }
    
    App.functions.ui.showAlert(title, message);
}
