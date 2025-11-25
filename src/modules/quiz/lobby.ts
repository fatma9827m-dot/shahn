


import { db, firebase } from '../../firebase';
import { App } from '../../../app';
import { QuizRoom, QuizPlayer, QuizQuestion, QuizMode, QuizTheme, UserData } from '../../types';

let currentFilters = { gameId: 'all', mode: 'all', entryFee: 'all' };

export function initQuizLobby(this: any) {
     App.functions.ui.openFullscreenView(App.DOM.quizLobbyView);
     
     if(App.state.quizLobbyListener) App.state.quizLobbyListener();
     
     // Use explicit global call to ensure listener starts
     App.functions.quiz.listenForLobbyRooms();

     const gameOptions = App.state.allGamesCache.map((g: any) => `<option value="${g.id}">${g.name}</option>`).join('');

     App.DOM.quizLobbyView.innerHTML = `
        <div class="container mx-auto max-w-5xl w-full">
             <header class="flex justify-between items-center mb-6 pt-16">
                <h2 class="text-3xl font-bold"><i class="fas fa-brain mr-2 text-purple-400"></i>غرف الأسئلة</h2>
                <button class="close-fullscreen-btn text-3xl">&times;</button>
            </header>

            <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                 <div class="flex flex-wrap justify-center gap-2">
                    <button id="quick-join-btn" class="admin-btn admin-btn-success text-lg"><i class="fas fa-bolt mr-2"></i>انضمام سريع</button>
                    <button id="create-room-btn" class="admin-btn admin-btn-primary text-lg"><i class="fas fa-plus mr-2"></i>إنشاء غرفة</button>
                    <button id="join-private-room-btn" class="admin-btn admin-btn-secondary text-lg"><i class="fas fa-key mr-2"></i>دخول بكود</button>
                    <button id="submit-question-btn" class="admin-btn admin-btn-warning text-lg"><i class="fas fa-question-circle mr-2"></i>أضف سؤالاً</button>
                </div>
                <div class="flex flex-col sm:flex-row gap-2 flex-wrap justify-center">
                     <select id="quiz-filter-game" class="admin-select !w-auto">
                        <option value="all">كل الألعاب</option>
                        ${gameOptions}
                     </select>
                    <div class="quiz-lobby-filters rounded-lg overflow-hidden">
                        <button data-filter="mode" value="all" class="active">الكل</button>
                        <button data-filter="mode" value="classic">كلاسيكي</button>
                        <button data-filter="mode" value="teams">فرق</button>
                        <button data-filter="mode" value="elimination">إقصاء</button>
                    </div>
                    <div class="quiz-lobby-filters rounded-lg overflow-hidden">
                        <button data-filter="entryFee" value="all" class="active">السعر</button>
                        <button data-filter="entryFee" value="low">منخفض</button>
                        <button data-filter="entryFee" value="medium">متوسط</button>
                        <button data-filter="entryFee" value="high">مرتفع</button>
                    </div>
                </div>
            </div>
            
            <div id="featured-rooms-container" class="mb-6 transition-all duration-300"></div>

            <div id="quiz-rooms-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="col-span-full text-center p-8"><i class="fas fa-spinner fa-spin text-4xl"></i></div>
            </div>
        </div>
     `;
    
    const lobbyViewContainer = App.DOM.quizLobbyView;
    if (!lobbyViewContainer) return;

    // Re-clone to clear old listeners
    const newLobby = lobbyViewContainer.cloneNode(true) as HTMLElement;
    lobbyViewContainer.parentNode?.replaceChild(newLobby, lobbyViewContainer);
    App.DOM.quizLobbyView = newLobby;

    // Bind Events using App.functions.quiz to ensure correct context
    newLobby.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        
        if (target.closest('#create-room-btn')) App.functions.quiz.showCreateRoomModal();
        if (target.closest('#quick-join-btn')) App.functions.quiz.handleQuickJoin();
        if (target.closest('#join-private-room-btn')) App.functions.quiz.showJoinPrivateRoomModal();
        if (target.closest('#submit-question-btn')) App.functions.quiz.showSubmitQuestionModal();
        
        const actionBtn = target.closest('.room-action-btn') as HTMLElement;
        if (actionBtn?.dataset.roomId) {
            const roomId = actionBtn.dataset.roomId;
            if (actionBtn.dataset.action === 'join') {
                App.functions.quiz.joinQuizRoom(roomId);
            } else if (actionBtn.dataset.action === 'spectate') {
                App.functions.quiz.joinQuizRoom(roomId, undefined, true);
            }
        }

        const filterBtn = target.closest('.quiz-lobby-filters button') as HTMLButtonElement;
        if(filterBtn) {
            const filterType = filterBtn.dataset.filter as keyof typeof currentFilters;
            if (filterType) {
                 newLobby.querySelectorAll(`button[data-filter="${filterType}"]`).forEach(btn => btn.classList.remove('active'));
                 filterBtn.classList.add('active');
                 currentFilters[filterType] = filterBtn.value;
                 App.functions.quiz.listenForLobbyRooms();
            }
        }
    });
    
    document.getElementById('quiz-filter-game')?.addEventListener('change', (e) => {
        currentFilters.gameId = (e.target as HTMLSelectElement).value;
        App.functions.quiz.listenForLobbyRooms();
    });
}

export function listenForLobbyRooms(this: any) {
    // Cleanup previous listener if exists
    if(App.state.quizLobbyListener) {
        // We don't call it here to avoid recursion if this function *is* the listener wrapper
        // But usually App.state.quizLobbyListener stores the unsubscribe function
    }

    let query: any = db.collection('quizRooms')
        .orderBy('createdAt', 'desc')
        .limit(50);

    const unsubscribe = query.onSnapshot((snapshot: any) => {
        const allRooms = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as QuizRoom[];
        
        const rooms = allRooms.filter(r => {
            if (r.private && !r.isChallenge) return false;
            if (['waiting', 'voting', 'starting', 'playing'].indexOf(r.status) === -1) return false;
            if (currentFilters.gameId !== 'all' && r.gameId !== currentFilters.gameId) return false;
            if (currentFilters.mode !== 'all' && r.mode !== currentFilters.mode) return false;
            
            if (currentFilters.entryFee !== 'all') {
                if (currentFilters.entryFee === 'low' && r.entryFee > 100) return false;
                if (currentFilters.entryFee === 'medium' && (r.entryFee <= 100 || r.entryFee > 500)) return false;
                if (currentFilters.entryFee === 'high' && r.entryFee <= 500) return false;
            }
            
            return true;
        });

        const featuredRooms = rooms.filter(r => r.featured);
        const normalRooms = rooms.filter(r => !r.featured);
        
        const listContainer = document.getElementById('quiz-rooms-list');
        const featuredContainer = document.getElementById('featured-rooms-container');
        
        // Only update if elements exist in DOM (view might be closed)
        if (!listContainer || !featuredContainer) return;
        
        const renderRoomCard = (room: QuizRoom) => {
            const isFull = Object.keys(room.players || {}).length >= room.maxPlayers;
            const isPlaying = room.status !== 'waiting' && room.status !== 'voting';
            const canJoin = !isFull && !isPlaying;
            const modeText = { classic: 'كلاسيكي', teams: 'فرق', elimination: 'إقصاء'}[room.mode] || room.mode;

            return `
            <div class="quiz-room-card relative rounded-2xl overflow-hidden group glass-card ${room.featured ? 'featured' : ''}" style="background-image: url('${room.gameBanner || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809'}')">
                <div class="absolute inset-0 bg-black/70 group-hover:bg-black/60 transition-colors"></div>
                <div class="relative p-4 flex flex-col h-full text-white z-10">
                    <div class="flex-grow">
                         <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-lg text-shadow">${room.gameName}</h3>
                                <p class="text-sm text-gray-300">المضيف: ${room.hostUsername}</p>
                            </div>
                            <div class="text-xs font-bold bg-purple-600 px-2 py-1 rounded-full">${modeText}</div>
                        </div>
                    </div>
                    <div class="flex items-end justify-between">
                        <div class="text-sm">
                            <p><i class="fas fa-users"></i> ${Object.keys(room.players || {}).length}/${room.maxPlayers}</p>
                            <p><i class="fas fa-coins"></i> ${room.entryFee === 0 ? 'مجاني' : room.entryFee.toLocaleString()}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="room-action-btn admin-btn admin-btn-sm admin-btn-secondary pointer-events-auto" data-action="spectate" data-room-id="${room.id}"><i class="fas fa-eye mr-2"></i>مشاهدة</button>
                            ${canJoin ? `<button class="room-action-btn admin-btn admin-btn-sm admin-btn-success pointer-events-auto" data-action="join" data-room-id="${room.id}"><i class="fas fa-sign-in-alt mr-2"></i>انضم</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            `;
        };

        listContainer.innerHTML = normalRooms.length > 0 ? normalRooms.map(renderRoomCard).join('') : `<p class="col-span-full text-center text-gray-400 p-8">لا توجد غرف متاحة حالياً. كن أول من ينشئ واحدة!</p>`;
        
        if(featuredRooms.length > 0) {
             featuredContainer.innerHTML = `
                <div class="glass-card p-4 rounded-xl border border-yellow-400/30 bg-yellow-400/5 relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <i class="fas fa-star text-9xl text-yellow-400 transform rotate-12"></i>
                    </div>
                    <h3 class="text-2xl font-bold mb-4 text-yellow-300 flex items-center relative z-10">
                        <i class="fas fa-star mr-2 animate-pulse"></i> غرف مميزة
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                        ${featuredRooms.map(renderRoomCard).join('')}
                    </div>
                </div>
             `;
        } else {
            featuredContainer.innerHTML = '';
        }

    }, (error: any) => {
        console.error("Error listening for lobby rooms:", error);
    });
    
    // Store listener to unsubscribe later
    App.state.quizLobbyListener = unsubscribe;
}

export function showCreateRoomModal(this: any, options: { challengeTarget?: UserData } = {}) {
    const isChallenge = !!options.challengeTarget;
    const user = App.state.userData;
    if (!user) return;

    const gameOptions = App.state.allGamesCache.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    const modalTitle = isChallenge ? `تحدي ${options.challengeTarget?.username}` : 'إنشاء غرفة أسئلة جديدة';
    const maxPlayersOptions = isChallenge 
        ? '<option value="2">2</option>' 
        : '<option value="2">2</option><option value="4">4</option><option value="6">6</option><option value="8">8</option>';

    const content = `
        <form id="create-room-form" class="space-y-4" data-is-challenge="${isChallenge}" data-challenged-id="${options.challengeTarget?.uid || ''}" data-challenged-username="${options.challengeTarget?.username || ''}">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block font-semibold mb-1">اللعبة</label>
                    <select name="gameId" class="admin-select" required>${gameOptions}</select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">وضع اللعب</label>
                    <select name="mode" class="admin-select" required ${isChallenge ? 'disabled' : ''}>
                        <option value="classic">كلاسيكي</option>
                        ${!isChallenge ? `<option value="teams">فرق</option><option value="elimination">إقصاء</option>` : ''}
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">عدد اللاعبين</label>
                    <select name="maxPlayers" class="admin-select" required ${isChallenge ? 'disabled' : ''}>
                        ${maxPlayersOptions}
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">رسوم الدخول (نقاط)</label>
                    <select name="entryFee" class="admin-select" required>
                        <option value="0">مجاني</option><option value="50">50</option><option value="100">100</option><option value="250">250</option><option value="500">500</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">مصدر الأسئلة</label>
                    <select name="questionTopic" class="admin-select" required>
                        <option value="ai">الذكاء الاصطناعي</option>
                        <option value="community">أسئلة المجتمع</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">عدد الأسئلة</label>
                    <select name="gameLength" class="admin-select" required>
                        <option value="5">5</option><option value="10">10</option><option value="15">15</option>
                    </select>
                </div>
                 <div>
                    <label class="block font-semibold mb-1">مستوى الصعوبة (للذكاء الاصطناعي)</label>
                    <select name="difficulty" class="admin-select" required>
                        <option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option>
                    </select>
                </div>
            </div>
            <div>
                 <label class="block font-semibold mb-1">مظهر الغرفة</label>
                 <div class="topic-selector">
                    <input type="radio" id="theme_space" name="theme" value="space" checked><label for="theme_space">فضاء</label>
                    <input type="radio" id="theme_forest" name="theme" value="forest"><label for="theme_forest">غابة</label>
                    <input type="radio" id="theme_cyberpunk" name="theme" value="cyberpunk"><label for="theme_cyberpunk">سايبربنك</label>
                 </div>
            </div>
            <div class="flex items-center gap-4">
                <label class="font-semibold">غرفة خاصة</label>
                <input type="checkbox" name="private" class="toggle-checkbox" id="private-room-toggle" ${isChallenge ? 'checked disabled' : ''}>
            </div>
            <div id="password-container" class="${isChallenge ? 'hidden' : 'hidden'}">
                 <label class="block font-semibold mb-1">كلمة المرور</label>
                 <input type="text" name="password" class="admin-input">
            </div>
            <div class="flex justify-end pt-4">
                <button type="submit" class="admin-btn admin-btn-primary"><span class="btn-text">${isChallenge ? 'إرسال التحدي' : 'إنشاء الغرفة'}</span><i class="fas fa-spinner fa-spin hidden"></i></button>
            </div>
        </form>
    `;

    App.functions.ui.openGenericModal(modalTitle, content, (modal: HTMLElement) => {
        const form = modal.querySelector('#create-room-form') as HTMLFormElement;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            // Explicitly call the function on the App object to avoid 'this' issues
            App.functions.quiz.handleCreateRoomSubmit(form);
        });

        const privateToggle = modal.querySelector('#private-room-toggle') as HTMLInputElement;
        const passwordContainer = modal.querySelector('#password-container') as HTMLElement;
        privateToggle.addEventListener('change', () => {
            passwordContainer.classList.toggle('hidden', !privateToggle.checked);
        });
        
        if (isChallenge) {
            const modeSelector = form.querySelector('select[name="mode"]') as HTMLSelectElement;
            const maxPlayersSelector = form.querySelector('select[name="maxPlayers"]') as HTMLSelectElement;
            modeSelector.value = 'classic';
            maxPlayersSelector.value = '2';
        }
    });
}

export async function handleCreateRoomSubmit(this: any, form: HTMLFormElement) {
    const user = App.state.userData;
    if (!user) return;

    const createBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    App.functions.helpers.toggleButtonLoading(createBtn, true);

    try {
        const formData = new FormData(form);
        const gameId = formData.get('gameId') as string;
        const game = App.state.allGamesCache.find(g => g.id === gameId);
        if (!game) throw new Error("الرجاء اختيار لعبة صالحة.");

        const entryFee = parseInt(formData.get('entryFee') as string, 10);
        if (user.points < entryFee) throw new Error("ليس لديك نقاط كافية لإنشاء هذه الغرفة.");
        
        const isChallenge = form.dataset.isChallenge === 'true';
        const challengedId = form.dataset.challengedId;
        const challengedUsername = form.dataset.challengedUsername;
        
        const isPrivate = formData.get('private') === 'on' || isChallenge;
        const password = formData.get('password') as string;

        if (isPrivate && !password && !isChallenge) {
            throw new Error("الرجاء إدخال كلمة مرور للغرفة الخاصة.");
        }

        const hostPlayer: QuizPlayer = {
            uid: user.uid, username: user.username, avatar: user.avatar, score: 0,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            answers: [], ready: false, streak: 0,
            powerups: { fiftyFifty: 1, freezeTime: 1, doublePoints: 1 },
            usedUp: false, isEliminated: false,
            quizTier: user.quizTier || 'unranked',
            quizPrestige: user.quizPrestige || 0,
            fastestAnswers: 0,
            quizWins: user.quizWins || 0,
            quizzesPlayed: user.quizzesPlayed || 0,
        };

        const newRoomData: Omit<QuizRoom, 'id'> = {
            shortId: App.functions.helpers.generateShortId(5),
            hostId: user.uid,
            hostUsername: user.username,
            hostAvatar: user.avatar,
            gameId: game.id,
            gameName: game.name,
            gameBanner: game.banner || '',
            players: { [user.uid]: hostPlayer },
            spectators: {},
            currentQuestionIndex: -1,
            status: 'waiting',
            questions: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            private: isPrivate,
            password: isPrivate ? (password || `challenge_${App.functions.helpers.generateShortId(4)}`) : undefined,
            prizePool: 0,
            entryFee: entryFee,
            maxPlayers: isChallenge ? 2 : parseInt(formData.get('maxPlayers') as string, 10),
            questionTopic: formData.get('questionTopic') as 'community' | 'ai',
            gameLength: parseInt(formData.get('gameLength') as string, 10),
            mode: isChallenge ? 'classic' : (formData.get('mode') as QuizMode),
            theme: formData.get('theme') as QuizTheme,
            difficulty: formData.get('difficulty') as 'easy' | 'medium' | 'hard',
            prizesAwarded: false,
            isChallenge: isChallenge,
            challengerId: isChallenge ? user.uid : undefined,
            challengedId: isChallenge ? challengedId : undefined,
        };
        
        Object.keys(newRoomData).forEach(key => (newRoomData as any)[key] === undefined && delete (newRoomData as any)[key]);

        const roomRef = db.collection('quizRooms').doc();
        await roomRef.set(newRoomData);
        
        if (isChallenge && challengedId && challengedUsername) {
            await App.functions.quiz.sendRoomInvitation(roomRef.id, challengedId, challengedUsername);
        }

        App.functions.ui.showToast("تم إنشاء الغرفة بنجاح!", "success");
        App.functions.ui.closeGenericModal();
        
        // Explicitly call join using global app object
        setTimeout(() => {
            App.functions.quiz.joinQuizRoom(roomRef.id);
        }, 500);

    } catch (error: any) {
        console.error("Failed to create room:", error);
        App.functions.ui.showToast(`فشل إنشاء الغرفة: ${error.message}`, "error");
    } finally {
        App.functions.helpers.toggleButtonLoading(createBtn, false);
    }
}

export function showJoinPrivateRoomModal(this: any) {
    const content = `
        <form id="join-private-room-form" class="space-y-4">
            <div>
                <label for="room-code-input" class="block font-semibold mb-1">كود الغرفة</label>
                <input id="room-code-input" name="roomCode" type="text" class="admin-input uppercase" required>
            </div>
            <div>
                <label for="room-password-input" class="block font-semibold mb-1">كلمة المرور (إن وجدت)</label>
                <input id="room-password-input" name="password" type="text" class="admin-input">
            </div>
            <div class="flex justify-end pt-2">
                <button type="submit" class="admin-btn admin-btn-primary"><span class="btn-text">دخول</span><i class="fas fa-spinner fa-spin hidden"></i></button>
            </div>
        </form>
    `;
    App.functions.ui.openGenericModal('دخول غرفة خاصة', content, (modal: HTMLElement) => {
        const form = modal.querySelector('#join-private-room-form') as HTMLFormElement;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            App.functions.quiz.handleJoinPrivateRoom(form);
        });
    });
}

export async function handleJoinPrivateRoom(this: any, form: HTMLFormElement) {
    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    App.functions.helpers.toggleButtonLoading(button, true);
    try {
        const formData = new FormData(form);
        const roomCode = (formData.get('roomCode') as string).toUpperCase();
        const password = (formData.get('password') as string);
        
        const roomSnap = await db.collection('quizRooms').where('shortId', '==', roomCode).limit(1).get();
        if (roomSnap.empty) throw new Error("لم يتم العثور على غرفة بهذا الكود.");

        const roomId = roomSnap.docs[0].id;
        App.functions.ui.closeGenericModal();
        await App.functions.quiz.joinQuizRoom(roomId, password);
    } catch (e: any) {
        App.functions.ui.showToast(e.message, 'error');
    } finally {
        App.functions.helpers.toggleButtonLoading(button, false);
    }
}

export async function handleQuickJoin(this: any) {
    App.functions.ui.showToast("🔎 جار البحث عن غرفة مناسبة...", "info");
    const userPoints = App.state.userData?.points || 0;

    try {
        const roomsSnap = await db.collection('quizRooms')
            .where('status', '==', 'waiting')
            .where('private', '==', false)
            .get();
        
        const sortedRooms = roomsSnap.docs
            .map((doc: any) => ({ id: doc.id, ...doc.data() } as QuizRoom))
            .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

        let bestRoom: QuizRoom | null = null;
        for (const room of sortedRooms) {
            if (Object.keys(room.players).length >= room.maxPlayers) continue;
            if (userPoints >= room.entryFee) {
                bestRoom = room;
                break;
            }
        }

        if (bestRoom) {
            await App.functions.quiz.joinQuizRoom(bestRoom.id);
        } else {
            App.functions.ui.showToast("لم نجد غرفة مناسبة. حاول إنشاء واحدة!", "info");
        }
    } catch (error: any) {
        console.error("Quick join failed:", error);
        App.functions.ui.showToast(`فشل الانضمام السريع: ${error.message}`, "error");
    }
}

export function showSubmitQuestionModal(this: any) {
    const gameOptions = App.state.allGamesCache
        .map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    if (!gameOptions) {
        App.functions.ui.showToast("لا توجد ألعاب متاحة لإضافة أسئلة.", "info");
        return;
    }

    const content = `
        <form id="submit-question-form" class="space-y-3">
             <div><label class="block mb-1">اللعبة</label><select name="gameId" class="admin-select">${gameOptions}</select></div>
             <div><label class="block mb-1">نص السؤال</label><textarea name="question" class="admin-textarea" rows="2" required></textarea></div>
             <div><label class="block mb-1">الإجابة الصحيحة</label><input name="correctAnswer" type="text" class="admin-input" required></div>
             <div>
                <label class="block mb-1">الإجابات الخاطئة</label>
                <div class="space-y-2 mt-1">
                    <input name="wrongAnswer1" type="text" placeholder="الإجابة الخاطئة 1" class="admin-input" required>
                    <input name="wrongAnswer2" type="text" placeholder="الإجابة الخاطئة 2" class="admin-input" required>
                    <input name="wrongAnswer3" type="text" placeholder="الإجابة الخاطئة 3" class="admin-input" required>
                </div>
             </div>
             <div class="flex justify-end pt-2"><button type="submit" class="admin-btn admin-btn-primary"><span class="btn-text">إرسال للمراجعة</span><i class="fas fa-spinner fa-spin hidden"></i></button></div>
        </form>
    `;
    App.functions.ui.openGenericModal('إضافة سؤال جديد للمجتمع', content, (modal: HTMLElement) => {
        modal.querySelector('#submit-question-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
            App.functions.helpers.toggleButtonLoading(button, true);

            try {
                const user = App.state.userData;
                if(!user) throw new Error("User not found");
                
                const formData = new FormData(form);
                const gameId = formData.get('gameId') as string;
                const questionText = formData.get('question') as string;
                const correctAnswer = formData.get('correctAnswer') as string;
                
                const wrongAnswer1 = (formData.get('wrongAnswer1') as string)?.trim();
                const wrongAnswer2 = (formData.get('wrongAnswer2') as string)?.trim();
                const wrongAnswer3 = (formData.get('wrongAnswer3') as string)?.trim();

                if (!wrongAnswer1 || !wrongAnswer2 || !wrongAnswer3) {
                    throw new Error("يجب إدخال جميع الإجابات الخاطئة الثلاث.");
                }
                const wrongAnswers = [wrongAnswer1, wrongAnswer2, wrongAnswer3];
                
                const options = [correctAnswer, ...wrongAnswers];
                for (let i = options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [options[i], options[j]] = [options[j], options[i]];
                }
                
                const questionData = {
                    gameId, question: questionText, correctAnswer, options,
                    status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    submittedBy: { uid: user.uid, username: user.username }
                };

                await db.collection('games').doc(gameId).collection('communityQuestions').add(questionData);
                await App.functions.achievements.checkCommunityAchievements('submitted_question');
                
                App.functions.ui.showToast("تم إرسال سؤالك للمراجعة. شكراً لمساهمتك!", "success");
                App.functions.ui.closeGenericModal();
            } catch (e: any) {
                App.functions.ui.showToast(e.message, 'error');
            } finally {
                App.functions.helpers.toggleButtonLoading(button, false);
            }
        });
    });
}
