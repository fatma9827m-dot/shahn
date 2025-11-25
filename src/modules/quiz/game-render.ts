
import { db, firebase } from '../../firebase';
import { App } from '../../../app';
import { QuizRoom, QuizPlayer } from '../../types';

async function handlePlaceBet(this: any, playerToBetOn: QuizPlayer, amount: number) {
    const user = App.state.userData;
    const room = App.functions.quiz.currentQuizRoom;
    if (!user || !room || !playerToBetOn) {
        App.functions.ui.showToast("خطأ: لا يمكن العثور على اللاعب أو الغرفة.", "error");
        return;
    }
    if (amount < 20) {
        App.functions.ui.showToast("الحد الأدنى للرهان هو 20 نقطة.", "error");
        return;
    }

    if (user.points < amount) {
        App.functions.ui.showToast("ليس لديك نقاط كافية لهذا الرهان.", "error");
        return;
    }

    const roomRef = db.collection('quizRooms').doc(room.id);
    try {
        await db.runTransaction(async (transaction: any) => {
            const userRef = db.collection('users').doc(user.uid);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists || userDoc.data().points < amount) {
                throw new Error("نقاطك غير كافية لإتمام العملية.");
            }

            // Deduct points from spectator
            transaction.update(userRef, { points: firebase.firestore.FieldValue.increment(-amount) });

            // Place the bet on the room
            transaction.update(roomRef, {
                [`bets.${user.uid}`]: {
                    playerUid: playerToBetOn.uid,
                    amount: amount
                }
            });
        });
        
        await App.functions.helpers.logPointsChange(user.uid, user.username, -amount, `رهان على ${playerToBetOn.username} في غرفة ${room.shortId}`);

        App.functions.ui.showToast(`تم وضع رهان بقيمة ${amount} نقطة على ${playerToBetOn.username} بنجاح!`, "success");
        App.functions.ui.closeGenericModal();
    } catch (error: any) {
        App.functions.ui.showToast(`فشل وضع الرهان: ${error.message}`, "error");
    }
}

export function renderQuizWaitingRoom(this: any, room: QuizRoom) {
    const myUid = App.state.userData?.uid;
    if (!myUid) return;

    const players = Object.values(room.players);
    const iAmHost = room.hostId === myUid;
    const me = room.players[myUid];

    const host = players.find(p => p.uid === room.hostId);
    const otherPlayers = players.filter(p => p.uid !== room.hostId).sort((a, b) => (a.joinedAt?.toMillis() || 0) - (b.joinedAt?.toMillis() || 0));
    
    const emptySlotsCount = Math.max(0, room.maxPlayers - players.length);

    const renderPlayerSlot = (p: QuizPlayer, isHostSlot: boolean) => {
        const isSelf = p.uid === myUid;
        const isFriend = App.state.userData?.friends?.includes(p.uid);
        let slotClasses = 'player-slot';
        if (isSelf) slotClasses += ' self';
        if (isFriend && !isSelf) slotClasses += ' friend';
        
        const sizeClass = isHostSlot ? 'w-32 h-32 md:w-40 md:h-40' : 'w-24 h-24';
        const nameSizeClass = isHostSlot ? 'text-xl md:text-2xl mt-4' : 'mt-2 text-base';
        const readyClass = p.ready ? 'is-ready' : '';

        return `
            <div class="${slotClasses}" data-uid="${p.uid}">
                <div class="relative ${sizeClass} player-slot-content ${readyClass}" data-uid="${p.uid}">
                    <div class="relative w-full h-full ${p.ready ? 'breathing-avatar' : ''}">
                        <img src="${p.avatar}" class="w-full h-full rounded-full object-cover border-4 ${p.ready ? 'border-green-400' : 'border-gray-500'} shadow-2xl p-1 pointer-events-none">
                        ${isHostSlot ? '<div class="host-badge">HOST</div>' : ''}
                        ${p.ready ? '<div class="ready-badge absolute bottom-0 right-0 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-gray-900"><i class="fas fa-check"></i></div>' : ''}
                    </div>
                    ${iAmHost && !isSelf ? `<button class="manage-player-btn" data-uid="${p.uid}"><i class="fas fa-ellipsis-v"></i></button>` : ''}
                </div>
                <p class="font-bold ${nameSizeClass} text-shadow">${p.username}</p>
            </div>
        `;
    };

    const renderEmptySlot = () => `
        <div class="player-slot empty">
            <button class="player-slot-content w-24 h-24 invite-slot-btn">
                <i class="fas fa-plus text-3xl text-white/30"></i>
            </button>
            <p class="mt-2 text-base text-white/50">دعوة صديق</p>
        </div>
    `;

    const allReady = players.length >= (room.isChallenge ? 2 : 2) && players.every(p => p.ready);
    const canStart = iAmHost && allReady;

    App.DOM.quizGameView.innerHTML = `
        <div class="w-full h-full flex flex-col">
            <header class="flex-shrink-0 absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
                <div class="flex items-center gap-2">
                    <button id="leave-room-btn" class="admin-btn admin-btn-danger">مغادرة</button>
                    <div class="glass-card rounded-full px-4 py-2">
                        <p class="font-bold text-lg">الكود: <span class="text-accent tracking-widest">${room.shortId}</span></p>
                    </div>
                </div>
                ${iAmHost ? `<button id="edit-room-settings-btn" title="تعديل الإعدادات" class="admin-btn admin-btn-secondary !p-0 w-12 h-12 !rounded-full text-xl"><i class="fas fa-cog"></i></button>` : '<div></div>'}
            </header>
            
            <main class="flex-grow w-full flex flex-col items-center justify-center text-center p-4 pt-20 pb-28 overflow-y-auto">
                <div class="mb-8">
                    ${host ? renderPlayerSlot(host, true) : ''}
                </div>
                <div class="quiz-player-slots-grid">
                    ${otherPlayers.map(p => renderPlayerSlot(p, false)).join('')}
                    ${[...Array(emptySlotsCount)].map(renderEmptySlot).join('')}
                </div>
            </main>

            <footer class="flex-shrink-0 w-full fixed bottom-0 left-0 p-3 z-10">
                <div class="w-full max-w-md mx-auto glass-card rounded-xl p-2 flex items-center justify-around gap-2">
                    <div class="emoji-panel-container relative">
                        <button id="emoji-panel-trigger" class="admin-btn admin-btn-secondary !p-0 w-12 h-12 !rounded-lg text-2xl">🙂</button>
                        <div id="emoji-panel-vertical" class="emoji-panel-vertical">
                            ${['👍', '😂', '🔥', '🤯', '👋', '🙏'].map(emoji => `<button class="text-3xl hover:scale-125 transition-transform emoji-react-btn" data-emoji="${emoji}">${emoji}</button>`).join('')}
                        </div>
                    </div>
                    
                    <button id="ready-btn" class="admin-btn ${me?.ready ? 'admin-btn-secondary' : 'admin-btn-success'} text-lg flex-grow h-12 transition-all transform active:scale-95" data-is-ready="${me?.ready}">
                        ${me?.ready ? '<span class="btn-text"><i class="fas fa-pause mr-2"></i> غير مستعد</span>' : '<span class="btn-text"><i class="fas fa-check mr-2"></i> أنا مستعد!</span>'}
                        <i class="fas fa-spinner fa-spin hidden"></i>
                    </button>

                    ${iAmHost ? `<button id="start-game-btn" class="admin-btn admin-btn-primary text-lg flex-grow h-12 ${!canStart ? 'opacity-50 cursor-not-allowed' : 'animate-pulse'}" ${!canStart ? 'disabled' : ''}><span class="btn-text">بدء اللعبة</span><i class="fas fa-spinner fa-spin hidden"></i></button>` : ''}
                </div>
            </footer>
        </div>
    `;
    
    // Note: All Event Listeners are now handled via delegation in ui.ts.
    // This prevents lost bindings when this function re-renders the HTML.
}

export function renderQuizStarting(this: any, room: QuizRoom) {
    const countdownTime = 3;
    App.DOM.quizGameView.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center text-center p-4">
            <div id="quiz-start-countdown" class="relative">
                <div class="game-start-countdown-number text-shadow"></div>
            </div>
        </div>
    `;
    
    let count = countdownTime;
    const countdownEl = App.DOM.quizGameView.querySelector('.game-start-countdown-number') as HTMLElement;

    const tick = () => {
        if (count > 0) {
            countdownEl.textContent = count.toString();
            countdownEl.style.animation = 'none';
            void countdownEl.offsetWidth; // Trigger reflow
            countdownEl.style.animation = 'countdown-pulse 1s ease-out forwards';
            App.functions.ui.sound.play('countdown');
            count--;
        } else {
            clearInterval(countdownInterval);
        }
    };
    
    tick(); // Initial tick
    const countdownInterval = setInterval(tick, 1000);
    
    // Host is responsible for transitioning to the first question after the countdown
    const myUid = App.state.userData?.uid;
    if (room.hostId === myUid) {
        clearTimeout(App.state.questionPhaseTimeout);
        App.state.questionPhaseTimeout = setTimeout(() => {
            // Re-check state to prevent race conditions
            if (App.functions.quiz.currentQuizRoom?.id === room.id && App.functions.quiz.currentQuizRoom.status === 'starting') {
                db.collection('quizRooms').doc(room.id).update({
                    status: 'playing',
                    currentQuestionIndex: 0,
                    questionStartTime: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }, (countdownTime + 1) * 1000);
    }
}

export function renderQuizPlaying(this: any, room: QuizRoom) {
    const questionIndex = room.currentQuestionIndex;
    if (questionIndex < 0 || questionIndex >= room.questions.length) return;
    const question = room.questions[questionIndex];
    const myUid = App.state.userData?.uid;
    const me = myUid ? room.players[myUid] : null;

    if (!room.questionStartTime || typeof room.questionStartTime.toMillis !== 'function') {
        App.DOM.quizGameView.innerHTML = `
            <div class="w-full h-full flex items-center justify-center text-center p-4">
                <div>
                    <p class="text-xl text-gray-400">السؤال ${questionIndex + 1} من ${room.gameLength}</p>
                    <h2 class="text-6xl font-black text-shadow">!استعد</h2>
                </div>
            </div>`;
        if (room.hostId === myUid) {
            clearTimeout(App.state.questionPhaseTimeout);
            App.state.questionPhaseTimeout = setTimeout(() => {
                if (App.functions.quiz.currentQuizRoom?.id === room.id && App.functions.quiz.currentQuizRoom.status === 'playing' && !App.functions.quiz.currentQuizRoom.questionStartTime) {
                    db.collection('quizRooms').doc(room.id).update({
                        questionStartTime: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }, 2000);
        }
        return;
    }
    
    const timeLimit = 30000; // 30 seconds
    const questionStartTime = room.questionStartTime.toMillis();
    const timeRemaining = Math.max(0, timeLimit - (Date.now() - questionStartTime));

    let mediaContent = '';
    if (question.type === 'image' && question.mediaUrl) {
        mediaContent = `<img src="${question.mediaUrl}" class="max-h-48 mx-auto rounded-lg mb-4 shadow-lg">`;
    }
    
    const streakHtml = me?.streak && me.streak >= 3 
        ? `<div class="streak-flame animate-pulse"><i class="fas fa-fire mr-1"></i> ${me.streak} Streak!</div>` 
        : '';

    const powerupsHtml = me && !me.usedUp ? `
        <div class="flex justify-center gap-4 mb-4">
            <button class="powerup-btn p-2 rounded-lg text-sm bg-purple-600 border border-purple-400 text-white ${me.powerups.fiftyFifty <= 0 ? 'opacity-50 cursor-not-allowed' : ''}" data-type="fiftyFifty" ${me.powerups.fiftyFifty <= 0 ? 'disabled' : ''}>
                <i class="fas fa-adjust mr-1"></i> 50/50 (${me.powerups.fiftyFifty})
            </button>
            <button class="powerup-btn p-2 rounded-lg text-sm bg-blue-600 border border-blue-400 text-white ${me.powerups.freezeTime <= 0 ? 'opacity-50 cursor-not-allowed' : ''}" data-type="freezeTime" ${me.powerups.freezeTime <= 0 ? 'disabled' : ''}>
                <i class="fas fa-snowflake mr-1"></i> تجميد (${me.powerups.freezeTime})
            </button>
            <button class="powerup-btn p-2 rounded-lg text-sm bg-yellow-600 border border-yellow-400 text-white ${me.powerups.doublePoints <= 0 ? 'opacity-50 cursor-not-allowed' : ''}" data-type="doublePoints" ${me.powerups.doublePoints <= 0 ? 'disabled' : ''}>
                <i class="fas fa-star mr-1"></i> x2 (${me.powerups.doublePoints})
            </button>
        </div>
    ` : '';

    App.DOM.quizGameView.innerHTML = `
        <div class="w-full h-full flex flex-col p-4 pt-6">
            <header class="flex-shrink-0 flex justify-between items-center text-white mb-4">
                <div class="text-lg"><b>${questionIndex + 1}</b> / ${room.gameLength}</div>
                <div class="flex flex-col items-end">
                    <div class="text-lg font-bold">نقاطك: ${me?.score.toLocaleString() || 0}</div>
                    ${streakHtml}
                </div>
            </header>
            
            <div class="w-full bg-gray-600 rounded-full h-2.5 mb-4">
                <div id="question-timer-bar-fill" class="bg-yellow-400 h-2.5 rounded-full" style="width: ${(timeRemaining/timeLimit)*100}%"></div>
            </div>

            <main class="flex-grow flex flex-col items-center justify-center text-center">
                <div class="glass-card rounded-2xl p-6 w-full max-w-3xl">
                    ${mediaContent}
                    <h2 class="text-2xl md:text-3xl font-bold mb-6 text-shadow">${question.question}</h2>
                </div>
                
                ${powerupsHtml}

                <div class="w-full max-w-2xl grid grid-cols-2 gap-3 md:gap-4 mt-2">
                    ${question.options.map(opt => `
                        <button class="answer-btn p-4 rounded-lg text-lg font-bold bg-gray-800" data-answer="${opt}" ${me?.answers.some(a => a.questionIndex === questionIndex) ? 'disabled' : ''}>
                           <span class="answer-text">${opt}</span>
                        </button>
                    `).join('')}
                </div>
            </main>

            <footer class="flex-shrink-0 w-full flex justify-center mt-4">
                ${me ? `<button id="report-question-btn" class="text-gray-400 hover:text-white text-sm"><i class="fas fa-flag mr-1"></i> الإبلاغ عن السؤال</button>` : ''}
            </footer>
        </div>
    `;

    const timerBarFill = document.getElementById('question-timer-bar-fill');
    const updateTimer = () => {
        const elapsed = Date.now() - questionStartTime;
        const newTimeRemaining = Math.max(0, timeLimit - elapsed);
        if (timerBarFill) (timerBarFill as HTMLElement).style.width = `${(newTimeRemaining / timeLimit) * 100}%`;
        if (newTimeRemaining <= 0) clearInterval(timerInterval);
    };
    const timerInterval = setInterval(updateTimer, 100);

    // Note: Answer button listeners are handled by delegation in ui.ts

    if (room.hostId === myUid) {
        clearTimeout(App.state.questionTimer);
        App.state.questionTimer = setTimeout(() => {
            clearInterval(timerInterval);
            if (App.functions.quiz.currentQuizRoom?.id === room.id && App.functions.quiz.currentQuizRoom.status === 'playing') {
                 db.collection('quizRooms').doc(room.id).update({
                    revealAnswerForIndex: questionIndex
                });
            }
        }, timeRemaining + 200);
    }
}

export function renderAnswerReveal(this: any, room: QuizRoom) {
    const questionIndex = room.revealAnswerForIndex!;
    const question = room.questions[questionIndex];
    const myUid = App.state.userData?.uid;
    const players = Object.values(room.players).sort((a,b) => b.score - a.score);

    const fastestCorrectPlayer = players
        .filter(p => p.answers.some(a => a.questionIndex === questionIndex && a.correct))
        .sort((a, b) => {
            const timeA = a.answers.find(ans => ans.questionIndex === questionIndex)!.timeTaken;
            const timeB = b.answers.find(ans => ans.questionIndex === questionIndex)!.timeTaken;
            return timeA - timeB;
        })[0];
        
    let fastestPlayerText = fastestCorrectPlayer ? `⚡️ ${fastestCorrectPlayer.username} كان الأسرع!` : 'لم يجب أحد بشكل صحيح.';

    App.DOM.quizGameView.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center text-center p-4">
            <h2 class="text-xl font-bold mb-4">الإجابة الصحيحة هي:</h2>
            <p class="text-4xl font-black text-green-400 mb-6">${question.correctAnswer}</p>
            <p class="text-lg mb-6">${fastestPlayerText}</p>
            <div class="w-full max-w-md space-y-2">
            ${players.map(p => {
                const answerObj = p.answers.find(a => a.questionIndex === questionIndex);
                const scoreChange = answerObj ? answerObj.score : 0;
                let icon = '<i class="fas fa-minus-circle text-gray-500"></i>';
                if (answerObj) {
                    icon = answerObj.correct ? '<i class="fas fa-check-circle text-green-400"></i>' : '<i class="fas fa-times-circle text-red-400"></i>';
                }
                return `
                    <div class="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                        <div class="flex items-center gap-3">
                            <img src="${p.avatar}" class="w-8 h-8 rounded-full">
                            <span>${p.username}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-lg ${scoreChange > 0 ? 'text-green-400' : ''}">+${scoreChange.toLocaleString()}</span>
                            ${icon}
                        </div>
                    </div>
                `;
            }).join('')}
            </div>
        </div>
    `;

    if (room.hostId === myUid) {
        clearTimeout(App.state.questionPhaseTimeout);
        App.state.questionPhaseTimeout = setTimeout(() => {
            if (App.functions.quiz.currentQuizRoom?.id === room.id) {
                db.collection('quizRooms').doc(room.id).update({
                    interstitialForIndex: questionIndex
                });
            }
        }, 5000);
    }
}

export function renderInterstitial(this: any, room: QuizRoom) {
    const players = Object.values(room.players).sort((a, b) => b.score - a.score);
    const myUid = App.state.userData?.uid;

    App.DOM.quizGameView.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center text-center p-4">
            <h2 class="text-3xl font-bold mb-6">الترتيب الحالي</h2>
            <div class="w-full max-w-lg space-y-2">
                ${players.map((p, index) => `
                    <div class="flex items-center p-3 rounded-lg bg-black/20 ${p.uid === myUid ? 'border-2 border-yellow-400' : ''}">
                        <span class="font-bold text-xl w-8">${index + 1}</span>
                        <img src="${p.avatar}" class="w-10 h-10 rounded-full mx-3">
                        <span class="font-semibold flex-grow text-right">${p.username}</span>
                        <span class="font-bold text-lg text-yellow-400 ml-4">${p.score.toLocaleString()}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    if (room.hostId === myUid) {
        clearTimeout(App.state.questionPhaseTimeout);
        App.state.questionPhaseTimeout = setTimeout(() => {
            if (App.functions.quiz.currentQuizRoom?.id === room.id) {
                const nextQuestionIndex = room.interstitialForIndex! + 1;
                if (nextQuestionIndex >= room.questions.length) {
                    db.collection('quizRooms').doc(room.id).update({ status: 'finished' });
                } else {
                    db.collection('quizRooms').doc(room.id).update({
                        currentQuestionIndex: nextQuestionIndex,
                        questionStartTime: null,
                        revealAnswerForIndex: firebase.firestore.FieldValue.delete(),
                        interstitialForIndex: firebase.firestore.FieldValue.delete()
                    });
                }
            }
        }, 5000);
    }
}

export function renderFinished(this: any, room: QuizRoom) {
    const players = Object.values(room.players).sort((a, b) => b.score - a.score);
    const myUid = App.state.userData?.uid;
    const isSpectator = myUid && !room.players[myUid];

    if (!isSpectator && players[0]?.uid === myUid) {
        App.functions.ui.triggerConfetti();
        App.functions.ui.sound.play('win');
    }

    const topThree = players.slice(0, 3);
    const others = players.slice(3);

    App.DOM.quizGameView.innerHTML = `
        <div id="quiz-results-container" class="w-full h-full flex flex-col items-center justify-center text-center p-4 overflow-y-auto">
            <h2 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500">انتهت اللعبة!</h2>
            
            <div class="podium">
                ${topThree.map((p, index) => {
                    const rank = players.findIndex(pl => pl.uid === p.uid) + 1;
                    return `
                        <div class="podium-stand podium-stand-${rank}">
                            <div class="podium-player-card">
                                <img src="${p.avatar}">
                                <p class="font-bold text-lg">${p.username}</p>
                                <p class="font-bold text-yellow-300">${p.score.toLocaleString()}</p>
                                ${rank === 1 ? '<span class="mvp-badge">MVP</span>' : ''}
                            </div>
                            <div class="podium-base podium-base-${rank}">${rank}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="w-full max-w-md my-4 space-y-1">
                 ${others.map((p, index) => `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-black/20">
                        <div class="flex items-center gap-3">
                            <span class="font-bold w-6 text-gray-400">${index + 4}</span>
                            <img src="${p.avatar}" class="w-8 h-8 rounded-full">
                            <span>${p.username}</span>
                        </div>
                        <span class="font-bold text-yellow-400">${p.score.toLocaleString()}</span>
                    </div>
                `).join('')}
            </div>

            <div class="flex gap-3 mt-6">
                <button id="leave-room-btn" class="admin-btn admin-btn-secondary">العودة للوبي</button>
                <button id="rematch-btn" class="admin-btn admin-btn-primary">مباراة أخرى</button>
                <button id="share-results-btn" class="admin-btn admin-btn-success"><i class="fas fa-share-alt"></i></button>
            </div>
        </div>
    `;
    // Note: Event Listeners handled by delegation in ui.ts
    
    if (!room.prizesAwarded && room.hostId === myUid) {
        const winner = players[0];
        if (!winner) return;
        (async () => {
            try {
                const prizePool = room.prizePool;
                const winnerGets = Math.floor(prizePool * 0.8);
                const hostGets = prizePool - winnerGets;
                
                const batch = db.batch();
                const winnerRef = db.collection('users').doc(winner.uid);
                batch.update(winnerRef, { 
                    points: firebase.firestore.FieldValue.increment(winnerGets),
                    quizWins: firebase.firestore.FieldValue.increment(1)
                });
                
                if (room.hostId !== winner.uid && hostGets > 0) {
                    const hostRef = db.collection('users').doc(room.hostId);
                    batch.update(hostRef, { points: firebase.firestore.FieldValue.increment(hostGets) });
                }
                
                for (const player of players) {
                    const playerRef = db.collection('users').doc(player.uid);
                    const correctAnswers = player.answers.filter(a => a.correct).length;
                    const incorrectAnswers = player.answers.filter(a => !a.correct).length;
                    batch.update(playerRef, {
                        'quizStats.totalScore': firebase.firestore.FieldValue.increment(player.score),
                        'quizStats.correctAnswers': firebase.firestore.FieldValue.increment(correctAnswers),
                        'quizStats.incorrectAnswers': firebase.firestore.FieldValue.increment(incorrectAnswers)
                    });
                    if (player.uid === myUid) {
                         App.functions.achievements.checkQuizAchievements(player, room);
                    }
                }

                batch.update(db.collection('quizRooms').doc(room.id), { prizesAwarded: true });
                await batch.commit();
            } catch (err) {
                 console.error("Failed to award prizes:", err);
            }
        })();
    }
}

export function renderSpectatorView(this: any, room: QuizRoom) {
     if (room.status === 'finished') {
        App.functions.quiz.renderFinished(room);
        return;
    }
    
    App.DOM.quizGameView.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center text-center p-4">
            <div class="absolute top-4 left-4 z-10"><button id="leave-room-btn" class="admin-btn admin-btn-danger">مغادرة</button></div>
            <i class="fas fa-eye text-5xl text-purple-400 mb-4"></i>
            <h2 class="text-3xl font-bold mb-2">أنت تشاهد المباراة</h2>
            <p class="text-secondary mb-8">استمتع بالمشاهدة!</p>
        </div>
    `;
    // Note: Event Listeners handled by delegation in ui.ts
}
