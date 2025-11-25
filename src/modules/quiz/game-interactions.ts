
import { db, firebase } from '../../firebase';
import { App } from '../../../app';
import { QuizRoom, QuizPlayer, UserData } from '../../types';

export async function handleEmojiReact(this: any, emoji: string) {
    const room = App.functions.quiz.currentQuizRoom;
    const user = App.state.userData;
    if (!room || !user || !room.players[user.uid]) return;

    const emojiPanel = App.DOM.quizGameView.querySelector('#emoji-panel-vertical');
    emojiPanel?.classList.remove('is-open');

    await db.collection('quizRooms').doc(room.id).update({
        [`players.${user.uid}.lastEmoji`]: { emoji, timestamp: firebase.firestore.FieldValue.serverTimestamp() }
    });
}

export async function showInviteFriendsModal(this: any) {
    const user = App.state.userData;
    const room = App.functions.quiz.currentQuizRoom;
    if (!user || !room) return;
    if (!user.friends || user.friends.length === 0) {
        return App.functions.ui.showToast("ليس لديك أصدقاء بعد لإرسال دعوة.", "info");
    }

    const modalContent = `<div id="invite-friend-list" class="space-y-2 max-h-64 overflow-y-auto"><div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i></div></div>`;
    App.functions.ui.openGenericModal('دعوة أصدقاء', modalContent, async (modal: HTMLElement) => {
        const listContainer = modal.querySelector('#invite-friend-list') as HTMLElement;
        const friendData: UserData[] = [];
        const friendIds = user.friends!;
        for (let i = 0; i < friendIds.length; i += 10) {
            const batch = friendIds.slice(i, i + 10);
            const snap = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', batch).get();
            snap.docs.forEach((doc: any) => friendData.push({ uid: doc.id, ...doc.data() } as UserData));
        }
        
        const friendsToInvite = friendData.filter(f => !room.players[f.uid]);
        
        if (friendsToInvite.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-gray-400">كل أصدقائك موجودون بالفعل أو تمت دعوتهم.</p>';
            return;
        }

        listContainer.innerHTML = friendsToInvite.map(friend => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/10">
                <div class="flex items-center gap-3">
                    <img src="${friend.avatar}" class="w-10 h-10 rounded-full object-cover">
                    <span class="font-bold">${friend.username}</span>
                </div>
                <button class="admin-btn admin-btn-sm admin-btn-success invite-friend-btn" data-friend-id="${friend.uid}" data-friend-username="${friend.username}">دعوة</button>
            </div>
        `).join('');

        listContainer.querySelectorAll('.invite-friend-btn').forEach(btn => {
            btn.addEventListener('click', async e => {
                const target = e.currentTarget as HTMLButtonElement;
                const friendId = target.dataset.friendId!;
                const friendUsername = target.dataset.friendUsername!;
                target.disabled = true;
                target.innerHTML = '<i class="fas fa-check"></i>';
                await this.sendRoomInvitation(room.id, friendId, friendUsername);
            });
        });
    });
}

export async function sendRoomInvitation(this: any, roomId: string, friendId: string, friendUsername: string) {
    const user = App.state.userData;
    const room = App.functions.quiz.currentQuizRoom;
    if (!user || !room) return;
    try {
        await db.collection('users').doc(friendId).collection('notifications').add({
            type: 'quiz_invite',
            title: `💌 دعوة للعب من ${user.username}`,
            body: `صديقك ${user.username} يدعوك للانضمام إلى غرفة ${room.gameName}.`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            roomId: roomId,
            sender: { uid: user.uid, username: user.username, avatar: user.avatar }
        });

        if (room.private) {
            await db.collection('quizRooms').doc(roomId).update({
                invitedUids: firebase.firestore.FieldValue.arrayUnion(friendId)
            });
        }

        App.functions.ui.showToast(`تم إرسال الدعوة إلى ${friendUsername}`, 'success');
    } catch (error) {
        console.error("Error sending invitation:", error);
        App.functions.ui.showToast(`فشل إرسال الدعوة إلى ${friendUsername}`, 'error');
    }
}

export function showEditRoomModal(this: any) { 
    const room = App.functions.quiz.currentQuizRoom;
    if (!room) return;

    const playerCount = Object.keys(room.players).length;
    const canChangeFee = playerCount === 1; // Only allow changing fee if alone

    const content = `
        <form id="edit-room-form" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block font-semibold mb-1">رسوم الدخول (نقاط)</label>
                    <select name="entryFee" class="admin-select" ${canChangeFee ? '' : 'disabled'}>
                        <option value="0" ${room.entryFee === 0 ? 'selected' : ''}>مجاني</option>
                        <option value="50" ${room.entryFee === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${room.entryFee === 100 ? 'selected' : ''}>100</option>
                        <option value="250" ${room.entryFee === 250 ? 'selected' : ''}>250</option>
                        <option value="500" ${room.entryFee === 500 ? 'selected' : ''}>500</option>
                    </select>
                    ${!canChangeFee ? '<p class="text-xs text-red-400 mt-1">لا يمكن تغيير الرسوم بوجود لاعبين آخرين.</p>' : ''}
                </div>
                <div>
                    <label class="block font-semibold mb-1">عدد اللاعبين</label>
                    <select name="maxPlayers" class="admin-select">
                        <option value="2" ${room.maxPlayers === 2 ? 'selected' : ''}>2</option>
                        <option value="4" ${room.maxPlayers === 4 ? 'selected' : ''}>4</option>
                        <option value="6" ${room.maxPlayers === 6 ? 'selected' : ''}>6</option>
                        <option value="8" ${room.maxPlayers === 8 ? 'selected' : ''}>8</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">عدد الأسئلة</label>
                    <select name="gameLength" class="admin-select">
                        <option value="5" ${room.gameLength === 5 ? 'selected' : ''}>5</option>
                        <option value="10" ${room.gameLength === 10 ? 'selected' : ''}>10</option>
                        <option value="15" ${room.gameLength === 15 ? 'selected' : ''}>15</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">مستوى الصعوبة</label>
                    <select name="difficulty" class="admin-select">
                        <option value="easy" ${room.difficulty === 'easy' ? 'selected' : ''}>سهل</option>
                        <option value="medium" ${room.difficulty === 'medium' ? 'selected' : ''}>متوسط</option>
                        <option value="hard" ${room.difficulty === 'hard' ? 'selected' : ''}>صعب</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">مصدر الأسئلة</label>
                    <select name="questionTopic" class="admin-select">
                        <option value="ai" ${room.questionTopic === 'ai' ? 'selected' : ''}>الذكاء الاصطناعي</option>
                        <option value="community" ${room.questionTopic === 'community' ? 'selected' : ''}>أسئلة المجتمع</option>
                    </select>
                </div>
            </div>

            <div class="flex items-center gap-4 mt-4 p-3 bg-black/20 rounded-lg">
                <label class="font-semibold">غرفة خاصة</label>
                <input type="checkbox" name="private" class="toggle-checkbox" id="edit-private-toggle" ${room.private ? 'checked' : ''}>
            </div>
            <div id="edit-password-container" class="${room.private ? '' : 'hidden'}">
                 <label class="block font-semibold mb-1">كلمة المرور</label>
                 <input type="text" name="password" class="admin-input" value="${room.password || ''}" placeholder="اتركه فارغاً لإزالة كلمة المرور">
            </div>

            <div class="flex justify-end pt-4">
                <button type="submit" class="admin-btn admin-btn-primary"><span class="btn-text">حفظ التغييرات</span><i class="fas fa-spinner fa-spin hidden"></i></button>
            </div>
        </form>
    `;

    App.functions.ui.openGenericModal('إعدادات الغرفة', content, (modal: HTMLElement) => {
        const form = modal.querySelector('#edit-room-form') as HTMLFormElement;
        const privateToggle = modal.querySelector('#edit-private-toggle') as HTMLInputElement;
        const passwordContainer = modal.querySelector('#edit-password-container') as HTMLElement;

        privateToggle.addEventListener('change', () => {
            passwordContainer.classList.toggle('hidden', !privateToggle.checked);
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            App.functions.quiz.handleEditRoomSubmit(form);
        });
    });
}

export async function handleEditRoomSubmit(this: any, form: HTMLFormElement) { 
    const room = App.functions.quiz.currentQuizRoom;
    if (!room) return;

    const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    App.functions.helpers.toggleButtonLoading(button, true);

    try {
        const formData = new FormData(form);
        const isPrivate = formData.get('private') === 'on';
        const password = formData.get('password') as string;
        
        const updateData: any = {
            private: isPrivate,
            difficulty: formData.get('difficulty'),
            maxPlayers: parseInt(formData.get('maxPlayers') as string, 10),
            gameLength: parseInt(formData.get('gameLength') as string, 10),
            questionTopic: formData.get('questionTopic'),
        };

        // Only update entry fee if input was enabled
        const entryFeeInput = form.querySelector('select[name="entryFee"]') as HTMLSelectElement;
        if (!entryFeeInput.disabled) {
            updateData.entryFee = parseInt(entryFeeInput.value, 10);
            // Update prize pool estimation (won't correspond to actual deductions until game starts, but keeps UI consistent)
            updateData.prizePool = 0; 
        }

        if (isPrivate) {
            if (password && password.trim().length > 0) {
                updateData.password = password;
            } else if (!room.password) {
                updateData.password = `room_${App.functions.helpers.generateShortId(4)}`;
            }
        } else {
            updateData.password = firebase.firestore.FieldValue.delete();
        }

        await db.collection('quizRooms').doc(room.id).update(updateData);
        App.functions.ui.showToast('تم تحديث إعدادات الغرفة بنجاح', 'success');
        App.functions.ui.closeGenericModal();

    } catch (error: any) {
        console.error("Error updating room settings:", error);
        App.functions.ui.showToast('فشل تحديث الإعدادات', 'error');
    } finally {
        App.functions.helpers.toggleButtonLoading(button, false);
    }
}

export function showPlayerActionMenu(this: any, uid: string, clickedElement: HTMLElement) {
    const room = App.functions.quiz.currentQuizRoom;
    const player = room?.players[uid];
    if (!room || !player) return;

    document.querySelectorAll('.player-action-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'player-action-popover';
    popover.innerHTML = `
        <button class="close-popover-btn">&times;</button>
        <button class="view-profile-btn" data-user-id="${uid}"><i class="fas fa-user-circle"></i> عرض الملف الشخصي</button>
        <button class="send-interaction-btn"><i class="fas fa-hand-sparkles"></i> إرسال تفاعل</button>
    `;

    document.body.appendChild(popover);
    const rect = clickedElement.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popover.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (popoverRect.width / 2)}px`;

    const closePopover = (e?: MouseEvent) => {
        if (e && popover.contains(e.target as Node)) return;
        popover.remove();
        document.body.removeEventListener('click', closePopover);
    };
    
    setTimeout(() => document.body.addEventListener('click', closePopover, { once: true }), 0);
    
    popover.querySelector('.close-popover-btn')?.addEventListener('click', () => closePopover());
    
    popover.querySelector('.view-profile-btn')?.addEventListener('click', () => App.functions.profile.initProfile(uid));

    popover.querySelector('.send-interaction-btn')?.addEventListener('click', () => {
        this.showInteractionModal(uid);
    });
}

export function showInteractionModal(this: any, targetUid: string) {
    const room = App.functions.quiz.currentQuizRoom;
    const targetPlayer = room?.players[targetUid];
    if (!targetPlayer) return;

    const interactions = {
        'استفزازية': [
            { emoji: '🥚', type: 'egg', name: 'رمي بيضة' },
            { emoji: '👞', type: 'shoe', name: 'رمي حذاء' },
        ],
        'محبة': [
            { emoji: '❤️', type: 'heart', name: 'قلب' },
        ]
    };

    const content = Object.entries(interactions).map(([category, items]) => `
        <div>
            <h4 class="font-bold text-gray-400 mb-2">${category}</h4>
            <div class="flex flex-wrap gap-4">
                ${items.map(item => `
                    <button class="send-interaction-action-btn flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors" data-type="${item.type}">
                        <span class="text-4xl">${item.emoji}</span>
                        <span class="text-xs">${item.name}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('<hr class="border-gray-600 my-4">');

    App.functions.ui.openGenericModal(`إرسال تفاعل إلى ${targetPlayer.username}`, content, (modal) => {
        modal.querySelectorAll('.send-interaction-action-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const type = (e.currentTarget as HTMLElement).dataset.type!;
                this.sendInteraction(targetUid, type);
                App.functions.ui.closeGenericModal();
            });
        });
    });
}

export async function sendInteraction(this: any, targetUid: string, type: string) {
    const room = App.functions.quiz.currentQuizRoom;
    const user = App.state.userData;
    if (!room || !user || !room.players[targetUid] || !room.players[user.uid]) return;
    
    await db.collection('quizRooms').doc(room.id).update({
        [`players.${targetUid}.lastInteraction`]: {
            fromUid: user.uid,
            fromUsername: user.username,
            type: type,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }
    });
}

export function triggerInteractionAnimation(this: any, targetUid: string, type: string, fromUsername: string) {
    const targetEl = document.querySelector(`.player-slot-content[data-uid="${targetUid}"], .quiz-player-avatar-wrapper[data-uid="${targetUid}"]`);
    if (!targetEl) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'interaction-animation-wrapper';

    let elementHtml = '';
    let fromLabel = `<div class="interaction-from-label">من ${fromUsername}</div>`;

    switch(type) {
        case 'egg':
            elementHtml = `<div class="interaction-element interaction-egg">🥚</div>`;
            break;
        case 'shoe':
            elementHtml = `<div class="interaction-element interaction-shoe">👞</div>`;
            break;
        case 'heart':
            elementHtml = `<div class="interaction-element interaction-heart">❤️</div>`;
            break;
    }
    
    if (elementHtml) {
        wrapper.innerHTML = elementHtml + fromLabel;
        targetEl.appendChild(wrapper);
        setTimeout(() => wrapper.remove(), 2000);
    }
}

export function showHostManagePlayerModal(this: any, uidToManage: string, clickedElement: HTMLElement) {
    const room = App.functions.quiz.currentQuizRoom;
    const playerToManage = room?.players[uidToManage];
    if (!room || !playerToManage) return;

    document.querySelectorAll('.player-action-popover').forEach(p => p.remove());

    const popover = document.createElement('div');
    popover.className = 'player-action-popover';

    const isBanned = room.bannedUids && room.bannedUids[uidToManage];

    popover.innerHTML = `
        <button class="close-popover-btn">&times;</button>
        <button class="kick-player-btn"><i class="fas fa-sign-out-alt"></i> طرد اللاعب</button>
        ${isBanned 
            ? `<button class="unban-player-btn"><i class="fas fa-unlock"></i> إلغاء الحظر</button>`
            : `<button class="ban-player-btn"><i class="fas fa-gavel"></i> حظر من الغرفة</button>`
        }
    `;

    document.body.appendChild(popover);
    const rect = clickedElement.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    
    popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popover.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (popoverRect.width / 2)}px`;

    const closePopover = (e?: MouseEvent) => {
        if (e && popover.contains(e.target as Node)) return;
        popover.remove();
        document.body.removeEventListener('click', closePopover);
    };
    setTimeout(() => document.body.addEventListener('click', closePopover, { once: true }), 0);

    popover.querySelector('.close-popover-btn')?.addEventListener('click', () => closePopover());
    
    popover.querySelector('.kick-player-btn')?.addEventListener('click', () => {
        this.handleKickPlayer(uidToManage);
    });
    
    popover.querySelector('.ban-player-btn')?.addEventListener('click', async () => {
        await db.collection('quizRooms').doc(room.id).update({
            [`bannedUids.${uidToManage}`]: {
                username: playerToManage.username,
                bannedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
        });
        this.handleKickPlayer(uidToManage);
        App.functions.ui.showToast(`تم حظر ${playerToManage.username} من الغرفة.`, 'success');
    });

    popover.querySelector('.unban-player-btn')?.addEventListener('click', async () => {
        await db.collection('quizRooms').doc(room.id).update({
            [`bannedUids.${uidToManage}`]: firebase.firestore.FieldValue.delete()
        });
        App.functions.ui.showToast(`تم إلغاء حظر ${playerToManage.username}.`, 'success');
    });
}

export async function handleKickPlayer(this: any, uidToKick: string) {
    const room = App.functions.quiz.currentQuizRoom;
    const user = App.state.userData;
    if (!room || !user || (room.hostId !== user.uid && user.role !== 'admin')) return;
    
    const roomRef = db.collection('quizRooms').doc(room.id);

    try {
        await db.runTransaction(async (transaction: any) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists || !roomDoc.data()?.players[uidToKick]) {
                return;
            }
            transaction.update(roomRef, {
                [`players.${uidToKick}`]: firebase.firestore.FieldValue.delete(),
            });
        });
        App.functions.ui.showToast("تم طرد اللاعب.", "success");
    } catch (error: any) {
        App.functions.ui.showToast(`فشل طرد اللاعب: ${error.message}`, "error");
    }
}
