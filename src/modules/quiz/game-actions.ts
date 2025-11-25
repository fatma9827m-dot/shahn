
import { db, firebase } from '../../firebase';
import { App } from '../../../app';
import { QuizRoom, QuizPlayer, QuizAnswer, Powerups, QuizQuestion, UserData, QuizTheme, QuizMode } from '../../types';

// FIX: Add declaration for global html2canvas variable.
declare var html2canvas: any;

export async function handlePlayerReady(this: any) {
    // 1. Get Truth from App State
    const user = App.state.userData;
    const room = App.functions.quiz.currentQuizRoom;
    
    if (!user || !room || room.players[user.uid] === undefined) {
        console.error("handlePlayerReady: Invalid state.");
        return;
    }

    // 2. Determine Next State based on REAL Room Data (not DOM)
    const currentReadyState = room.players[user.uid].ready;
    const newState = !currentReadyState;

    // 3. Optimistic UI Update - Immediate Feedback
    const readyBtn = document.getElementById('ready-btn') as HTMLButtonElement;
    const playerSlotContent = document.querySelector(`.player-slot-content[data-uid="${user.uid}"]`);

    if (readyBtn) {
        readyBtn.disabled = true; // Prevent double clicks
        
        if (newState) {
            // Changing to READY (Green)
            readyBtn.className = 'admin-btn admin-btn-secondary text-lg flex-grow h-12 transition-all transform active:scale-95';
            readyBtn.innerHTML = '<span class="btn-text"><i class="fas fa-pause mr-2"></i> إلغاء الاستعداد</span>';
            readyBtn.dataset.isReady = 'true';

            // Update Avatar Visually Immediately
            if (playerSlotContent) {
                playerSlotContent.classList.add('is-ready');
                const img = playerSlotContent.querySelector('img');
                if (img) {
                    img.classList.remove('border-gray-500');
                    img.classList.add('border-green-400');
                }
                
                // Check if badge exists, if not create it
                const imgWrapper = playerSlotContent.firstElementChild;
                if (imgWrapper && !imgWrapper.querySelector('.ready-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'ready-badge absolute bottom-0 right-0 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-gray-900';
                    badge.innerHTML = '<i class="fas fa-check"></i>';
                    imgWrapper.appendChild(badge);
                }
            }

        } else {
            // Changing to NOT READY (Gray/Red)
            readyBtn.className = 'admin-btn admin-btn-success text-lg flex-grow h-12 transition-all transform active:scale-95';
            readyBtn.innerHTML = '<span class="btn-text"><i class="fas fa-check mr-2"></i> أنا مستعد!</span>';
            readyBtn.dataset.isReady = 'false';

            // Update Avatar Visually Immediately
            if (playerSlotContent) {
                playerSlotContent.classList.remove('is-ready');
                const img = playerSlotContent.querySelector('img');
                if (img) {
                    img.classList.remove('border-green-400');
                    img.classList.add('border-gray-500');
                }
                // Remove Badge
                const badge = playerSlotContent.querySelector('.ready-badge');
                if (badge) badge.remove();
            }
        }
    }

    // 4. Update Database
    try {
        console.log(`Toggling ready state from ${currentReadyState} to ${newState}`);
        await db.collection('quizRooms').doc(room.id).update({
            [`players.${user.uid}.ready`]: newState
        });
        // Success! Button stays in new state (DB listener will confirm it shortly)
    } catch (error) {
        console.error("Error setting player ready state:", error);
        App.functions.ui.showToast("فشل تغيير الحالة. حاول مرة أخرى.", "error");
        
        // Revert UI if failed (Simplified reversion)
        if (readyBtn) {
            readyBtn.disabled = false;
            // We rely on the user clicking again or the DB listener to correct the state if it mismatches
        }
    } finally {
        if (readyBtn) readyBtn.disabled = false;
    }
}

export async function handleStartGame(this: any) {
    const user = App.state.userData;
    const room = App.functions.quiz.currentQuizRoom;
    if (!user || !room || room.hostId !== user.uid) return;

    const startGameBtn = document.getElementById('start-game-btn') as HTMLButtonElement | null;
    if (startGameBtn) App.functions.helpers.toggleButtonLoading(startGameBtn, true, 'جاري البدء...');

    try {
        const roomRef = db.collection('quizRooms').doc(room.id);
        const playerIds = Object.keys(room.players);
        const entryFee = room.entryFee;

        // NEW: Points deduction transaction
        if (entryFee > 0) {
            await db.runTransaction(async (transaction: any) => {
                const playerRefs = playerIds.map(uid => db.collection('users').doc(uid));
                const playerDocs = await Promise.all(playerRefs.map(ref => transaction.get(ref)));
                
                const playersWithData = playerDocs.map((doc, index) => ({
                    uid: playerIds[index],
                    data: doc.data()
                }));

                const playersWithoutEnoughPoints = playersWithData.filter(p => !p.data || p.data.points < entryFee);
                
                if (playersWithoutEnoughPoints.length > 0) {
                    throw { type: 'INSUFFICIENT_FUNDS', players: playersWithoutEnoughPoints };
                }
                
                // All players have enough points, proceed with deduction
                for (const p of playersWithData) {
                    const playerRef = db.collection('users').doc(p.uid);
                    transaction.update(playerRef, { points: firebase.firestore.FieldValue.increment(-entryFee) });
                }
                
                // Update prize pool on the room
                const prizePoolTotal = entryFee * playerIds.length;
                transaction.update(roomRef, { prizePool: prizePoolTotal });
            });
        }
        
        App.functions.ui.showToast("🚀 جار بدء اللعبة...", "info");
        
        let questions: QuizQuestion[] = [];
        if (room.questionTopic === 'ai') {
            const categoriesToVoteOn = room.questionCategoryVotes ? Object.entries(room.questionCategoryVotes)
                .sort((a: [string, string[]], b: [string, string[]]) => b[1].length - a[1].length)
                .slice(0, 2)
                .map(([cat]) => cat) : [];
            questions = await App.functions.quiz.generateQuizQuestionsWithAI(room.gameName, room.gameLength, categoriesToVoteOn, room.difficulty);
        } else { // 'community'
            questions = await App.functions.quiz.getCommunityQuestions(room.gameId, room.gameLength);
        }

        const batch = db.batch();
        playerIds.forEach(uid => {
            const userRef = db.collection('users').doc(uid);
            batch.update(userRef, { quizzesPlayed: firebase.firestore.FieldValue.increment(1) });
        });
        await batch.commit();

        await roomRef.update({
            questions: questions,
            status: 'starting',
            currentQuestionIndex: -1
        });

    } catch (error: any) {
        if (error.type === 'INSUFFICIENT_FUNDS') {
            const failedPlayerUsernames = error.players.map((p: any) => p.data?.username || 'لاعب').join(', ');
            App.functions.ui.showToast(`لا يملك ${failedPlayerUsernames} نقاط كافية لبدء اللعبة. سيتم طردهم.`, "error");
            for (const playerToKick of error.players) {
                await App.functions.quiz.handleKickPlayer(playerToKick.uid);
            }
        } else {
            console.error("Error starting game:", error);
            App.functions.ui.showToast(`فشل بدء اللعبة: ${error.message}`, "error");
        }
    } finally {
        if (startGameBtn) App.functions.helpers.toggleButtonLoading(startGameBtn, false, 'بدء اللعبة');
    }
}

export async function handleAnswerSubmit(this: any, answer: string) {
    const room = App.functions.quiz.currentQuizRoom;
    const user = App.state.userData;
    
    if (!room || !user || !room.players[user.uid] || room.status !== 'playing' || !room.questionStartTime) return;

    const questionIndex = room.currentQuestionIndex;
    const question = room.questions[questionIndex];
    const player = room.players[user.uid];

    if (player.answers.some(a => a.questionIndex === questionIndex)) return;

    // Safe timestamp access
    const startTime = (room.questionStartTime && typeof room.questionStartTime.toMillis === 'function') 
        ? room.questionStartTime.toMillis() 
        : Date.now();
        
    const timeTaken = Date.now() - startTime;
    const isCorrect = answer === question.correctAnswer;
    
    // Calculate Score with potential multipliers
    let baseScore = isCorrect ? 500 : 0;
    if (player.selectedPowerup === 'doublePoints') {
        baseScore *= 2;
    }
    
    const timeBonus = isCorrect ? Math.max(0, 500 - Math.floor(timeTaken / 20)) : 0;
    const score = baseScore + timeBonus;

    const answerData: QuizAnswer = {
        questionIndex, answer, correct: isCorrect, timeTaken, score, wasFastest: false
    };

    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach(b => {
        const btn = b as HTMLButtonElement;
        btn.disabled = true;
        if (btn.dataset.answer === answer) {
            btn.classList.add('selected');
        }
    });
    
    // Reset selected powerup
    const updateData: any = {
        [`players.${user.uid}.answers`]: firebase.firestore.FieldValue.arrayUnion(answerData),
        [`players.${user.uid}.score`]: firebase.firestore.FieldValue.increment(score),
        [`players.${user.uid}.streak`]: isCorrect ? firebase.firestore.FieldValue.increment(1) : 0,
    };
    if (player.selectedPowerup) {
         updateData[`players.${user.uid}.selectedPowerup`] = firebase.firestore.FieldValue.delete();
    }

    await db.collection('quizRooms').doc(room.id).update(updateData);
}

export async function handleReportQuestion(this: any) {
    const room = App.functions.quiz.currentQuizRoom;
    const user = App.state.userData;
    if (!room || !user) return;
    
    const questionIndex = room.currentQuestionIndex;
    const question = room.questions[questionIndex];

    App.functions.ui.showConfirmationModal(
        'الإبلاغ عن سؤال',
        `هل أنت متأكد من أنك تريد الإبلاغ عن هذا السؤال: "${question.question}"؟`,
        async () => {
            try {
                await db.collection('questionReports').add({
                    question: question.question,
                    options: question.options,
                    correctAnswer: question.correctAnswer,
                    gameName: room.gameName,
                    gameId: room.gameId,
                    reportedBy: { uid: user.uid, username: user.username },
                    reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'pending',
                    roomId: room.id
                });
                App.functions.ui.showToast('شكراً لك! تم إرسال بلاغك للمراجعة.', 'success');
            } catch (error) {
                App.functions.ui.showToast('فشل إرسال البلاغ.', 'error');
            }
        },
        'نعم، أبلغ',
        'إلغاء'
    );
}

export async function handleUsePowerup(this: any, type: string) { 
    const room = App.functions.quiz.currentQuizRoom;
    const user = App.state.userData;
    if (!room || !user || room.status !== 'playing' || !room.players[user.uid]) return;
    
    const player = room.players[user.uid];
    const powerups = player.powerups;
    
    // @ts-ignore
    if (powerups[type] <= 0) {
        App.functions.ui.showToast('لقد نفدت لديك هذه المساعدة!', 'error');
        return;
    }
    
    if (type === 'fiftyFifty') {
        const currentQ = room.questions[room.currentQuestionIndex];
        const buttons = Array.from(document.querySelectorAll('.answer-btn')) as HTMLButtonElement[];
        const wrongButtons = buttons.filter(btn => btn.dataset.answer !== currentQ.correctAnswer);
        
        if (wrongButtons.length >= 2) {
            // Hide 2 random wrong answers
            for (let i = 0; i < 2; i++) {
                const randIndex = Math.floor(Math.random() * wrongButtons.length);
                const btn = wrongButtons[randIndex];
                btn.style.opacity = '0';
                btn.disabled = true;
                wrongButtons.splice(randIndex, 1);
            }
        }
    } else if (type === 'freezeTime') {
        App.functions.ui.showToast('تم تجميد الوقت مؤقتًا (بصرياً فقط)', 'info');
        const bar = document.getElementById('question-timer-bar-fill');
        if (bar) bar.style.animationPlayState = 'paused'; // Just a visual trick for now
    } else if (type === 'doublePoints') {
        App.functions.ui.showToast('سيتم مضاعفة نقاط إجابتك القادمة!', 'success');
    }

    // Decrement powerup count in DB
    await db.collection('quizRooms').doc(room.id).update({
        [`players.${user.uid}.powerups.${type}`]: firebase.firestore.FieldValue.increment(-1),
        [`players.${user.uid}.selectedPowerup`]: type // Track active powerup
    });
}

export async function handleVoteCategory(this: any, category: string) {
    const room = App.functions.quiz.currentQuizRoom;
    const user = App.state.userData;
    if (!room || !user || room.status !== 'voting' || !room.players[user.uid]) return;

    const currentVotes = room.questionCategoryVotes || {};
    // Remove user's vote from all categories
    for (const cat in currentVotes) {
        currentVotes[cat] = currentVotes[cat].filter(uid => uid !== user.uid);
    }
    // Add vote to new category
    if (!currentVotes[category]) currentVotes[category] = [];
    currentVotes[category].push(user.uid);
    
    await db.collection('quizRooms').doc(room.id).update({ questionCategoryVotes: currentVotes });
}

export async function handleRematch(this: any) { App.functions.ui.showToast('هذه الميزة قيد التطوير.', 'info'); }

export async function handleShareResults(this: any) {
    const resultsContainer = document.getElementById('quiz-results-container');
    if (resultsContainer && typeof html2canvas === 'function') {
        App.functions.ui.showToast('...جاري إنشاء الصورة', 'info');
        try {
            const canvas = await html2canvas(resultsContainer, {
                backgroundColor: '#1f2937',
                useCORS: true
            });
            const dataUrl = canvas.toDataURL('image/png');
            const imageContainer = App.DOM.shareImageContainer;
            imageContainer.innerHTML = `
                <img src="${dataUrl}" class="max-w-full max-h-[70vh] rounded-lg shadow-lg">
                <p class="text-center mt-4 text-sm">اضغط بالزر الأيمن لحفظ الصورة أو نسخها.</p>
            `;
            App.functions.ui.openModal(imageContainer.parentElement!);
        } catch (error) {
            console.error('Error generating share image:', error);
            App.functions.ui.showToast('فشل إنشاء الصورة للمشاركة.', 'error');
        }
    } else {
        App.functions.ui.showToast('ميزة المشاركة غير متاحة حالياً.', 'error');
    }
}
