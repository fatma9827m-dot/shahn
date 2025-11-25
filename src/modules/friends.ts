
import { db, firebase, database } from '../firebase';
import { App } from '../../app';
import { UserData, FriendRequest } from '../types';

export const friendFunctions = {
    async init(container: HTMLElement, userData: UserData, isSelf: boolean) {
        container.innerHTML = `
            <div class="border-b border-gray-700 mb-4 flex flex-wrap -mb-px">
                <button class="friend-tab-btn active" data-friend-tab="list">قائمة الأصدقاء</button>
                ${isSelf ? `
                <button class="friend-tab-btn relative" data-friend-tab="requests">
                    الطلبات <span id="friend-requests-count-inner" class="friend-request-badge hidden">0</span>
                </button>
                <button class="friend-tab-btn" data-friend-tab="search">بحث عن لاعبين</button>
                ` : ''}
            </div>
            <div id="friend-tab-content" class="min-h-[200px]"></div>
        `;

        this.renderFriendList(container.querySelector('#friend-tab-content')!, userData);
        if (isSelf) {
            this.updateRequestCount(container);
        }

        container.querySelectorAll('.friend-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tab = target.dataset.friendTab;
                container.querySelectorAll('.friend-tab-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                
                const contentEl = container.querySelector('#friend-tab-content')!;
                switch (tab) {
                    case 'list': this.renderFriendList(contentEl, userData); break;
                    case 'requests': this.renderFriendRequests(contentEl); break;
                    case 'search': this.renderSearch(contentEl); break;
                }
            });
        });
    },
    
    async renderFriendList(container: HTMLElement, userData: UserData) {
        container.innerHTML = `<div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i></div>`;
        const friends = userData.friends || [];
        if (friends.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-400">قائمة الأصدقاء فارغة.</p>`;
            return;
        }

        const friendData: UserData[] = [];
        for (let i = 0; i < friends.length; i += 10) {
            const batch = friends.slice(i, i + 10);
            const snap = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', batch).get();
            snap.docs.forEach((doc: any) => friendData.push({ uid: doc.id, ...doc.data() } as UserData));
        }
        
        container.innerHTML = `<div class="space-y-2">${friendData.map(friend => `
            <div class="flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors">
                <div class="flex items-center gap-3 cursor-pointer view-profile-btn" data-user-id="${friend.uid}">
                    <div class="relative">
                        <img src="${friend.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-gray-600">
                        <div id="status-dot-${friend.uid}" class="status-indicator-dot status-offline"></div>
                    </div>
                    <div class="flex flex-col">
                        <span class="font-bold text-base leading-tight text-white">${friend.username}</span>
                        <span id="status-text-${friend.uid}" class="text-xs text-gray-500 font-medium">...</span>
                    </div>
                </div>
                <div class="flex gap-2">
                     <button class="admin-btn admin-btn-sm bg-orange-500 hover:bg-orange-600 text-white challenge-friend-btn" data-friend='${JSON.stringify(friend)}' title="تحدي">
                        ⚔️
                     </button>
                     <button class="admin-btn admin-btn-sm admin-btn-primary private-chat-btn" data-friend='${JSON.stringify(friend)}' title="دردشة">
                        <i class="fas fa-comment-dots"></i>
                     </button>
                </div>
            </div>
        `).join('')}</div>`;

        // Attach Realtime Database Listeners for Status
        const rtdb = firebase.database();
        friendData.forEach(friend => {
            const statusRef = rtdb.ref('/status/' + friend.uid);
            
            // Fallback function to display Last Seen from Firestore data
            const setOfflineStatus = () => {
                const text = document.getElementById(`status-text-${friend.uid}`);
                if (text) {
                    if (friend.lastLogin) {
                        const date = friend.lastLogin.toDate ? friend.lastLogin.toDate() : new Date(friend.lastLogin);
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
                        
                        text.textContent = `آخر ظهور: ${timeString}`;
                    } else {
                        text.textContent = 'غير متصل';
                    }
                    text.className = 'text-xs text-gray-500 font-medium';
                }
            };

            const listener = statusRef.on('value', (snapshot: any) => {
                const status = snapshot.val();
                const dot = document.getElementById(`status-dot-${friend.uid}`);
                const text = document.getElementById(`status-text-${friend.uid}`);
                
                if (dot && text) {
                    if (status && status.state === 'online') {
                        dot.classList.remove('status-offline');
                        dot.classList.add('status-online');
                        text.textContent = '🟢 متصل الآن';
                        text.className = 'text-xs text-green-400 font-bold';
                    } else {
                        dot.classList.remove('status-online');
                        dot.classList.add('status-offline');
                        
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

                            text.textContent = `آخر ظهور: ${timeString}`;
                            text.className = 'text-xs text-gray-500 font-medium';
                        } else {
                            setOfflineStatus(); // Fallback if online but no last_changed or data is null
                        }
                    }
                }
            }, (error: any) => {
                // Permission denied or other error - fall back to Firestore data silently
                setOfflineStatus();
            });
            
            App.state.listeners.push(() => statusRef.off('value', listener));
        });

        // Bind Challenge Events
        container.querySelectorAll('.challenge-friend-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const friend = JSON.parse((e.currentTarget as HTMLElement).dataset.friend!);
                App.functions.ui.closeFullscreenView();
                App.functions.quiz.showCreateRoomModal({ challengeTarget: friend });
            });
        });

        // Bind Chat Events
        container.querySelectorAll('.private-chat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const friend = JSON.parse((e.currentTarget as HTMLElement).dataset.friend!);
                App.functions.chat.openPrivateChat(friend);
            });
        });
    },

    async renderFriendRequests(container: HTMLElement) {
        const user = App.state.userData;
        if (!user || !user.friendRequests?.incoming || user.friendRequests.incoming.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-400">لا توجد طلبات صداقة حالياً.</p>`;
            return;
        }
        container.innerHTML = `<div class="space-y-2">${user.friendRequests.incoming.map(req => `
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/10">
                <div class="flex items-center gap-3 cursor-pointer view-profile-btn" data-user-id="${req.fromId}">
                    <img src="${req.fromAvatar}" class="w-10 h-10 rounded-full object-cover">
                    <span class="font-bold">${req.fromUsername}</span>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-danger btn-sm decline-request-btn" data-sender='${JSON.stringify(req)}'><i class="fas fa-times"></i></button>
                    <button class="btn btn-success btn-sm accept-request-btn" data-sender='${JSON.stringify(req)}'><i class="fas fa-check"></i></button>
                </div>
            </div>
        `).join('')}</div>`;

        container.querySelectorAll('.accept-request-btn').forEach(btn => btn.addEventListener('click', e => this.acceptFriendRequest(JSON.parse((e.currentTarget as HTMLElement).dataset.sender!))));
        container.querySelectorAll('.decline-request-btn').forEach(btn => btn.addEventListener('click', e => this.declineFriendRequest(JSON.parse((e.currentTarget as HTMLElement).dataset.sender!))));
    },

    renderSearch(container: HTMLElement) {
        container.innerHTML = `
            <div class="flex gap-2 mb-4">
                <input id="profile-friend-search-input" type="text" placeholder="ابحث بالاسم أو ID القصير..." class="admin-input">
                <button id="profile-friend-search-btn" class="admin-btn admin-btn-primary">بحث</button>
            </div>
            <div id="profile-friend-search-results"></div>
        `;
        container.querySelector('#profile-friend-search-btn')?.addEventListener('click', () => {
            const query = (container.querySelector('#profile-friend-search-input') as HTMLInputElement).value;
            this.searchUsers(query, container.querySelector('#profile-friend-search-results'));
        });
    },

    updateRequestCount(profileContainer: HTMLElement) {
        const count = App.state.userData?.friendRequests?.incoming?.length || 0;
        const el = profileContainer.querySelector('#friend-requests-count-inner') as HTMLElement | null;
        if (el) {
            el.textContent = count > 9 ? '9+' : count.toString();
            if (count > 0) {
                el.classList.remove('hidden');
                el.style.display = 'flex';
            } else {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        }
    },
    
    async searchUsers(query: string, container: HTMLElement | null) {
        if (!container) return;
        container.innerHTML = `<div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i></div>`;
        if (query.length < 3) { container.innerHTML = '<p class="text-center text-gray-400">أدخل 3 أحرف على الأقل للبحث.</p>'; return; }

        const promises = [];
        promises.push(db.collection('users').where('username', '==', query).limit(5).get());
        promises.push(db.collection('users').where('shortId', '==', query.toUpperCase()).limit(1).get());
        
        const [nameSnap, idSnap] = await Promise.all(promises);
        const results: UserData[] = [];
        const seenIds = new Set();

        const processSnap = (snap: any) => {
            snap.docs.forEach((doc: any) => {
                if (!seenIds.has(doc.id)) {
                    results.push({ uid: doc.id, ...doc.data() } as UserData);
                    seenIds.add(doc.id);
                }
            });
        };
        processSnap(nameSnap);
        processSnap(idSnap);
        
        if (results.length === 0) { container.innerHTML = `<p class="text-center text-gray-400">لم يتم العثور على لاعبين.</p>`; return; }
        
        container.innerHTML = results.filter(u => u.uid !== App.state.userData!.uid).map(u => {
             const currentUser = App.state.userData!;
             const isFriend = (currentUser.friends || []).includes(u.uid);
             const requestSent = (currentUser.friendRequests?.outgoing || []).some(req => req.fromId === u.uid);
             let btnHTML = `<button class="btn btn-primary btn-sm add-friend-btn" data-target='${JSON.stringify(u)}'>إضافة</button>`;
             if (isFriend) btnHTML = `<button class="btn btn-secondary btn-sm" disabled>صديق</button>`;
             if (requestSent) btnHTML = `<button class="btn btn-secondary btn-sm" disabled>تم الإرسال</button>`;

             return `<div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/10">
                <div class="flex items-center gap-3 cursor-pointer view-profile-btn" data-user-id="${u.uid}">
                    <img src="${u.avatar}" class="w-10 h-10 rounded-full object-cover">
                    <span class="font-bold">${u.username}</span>
                </div>
                ${btnHTML}
            </div>`
        }).join('');

        container.querySelectorAll('.add-friend-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const targetData = JSON.parse((e.currentTarget as HTMLElement).dataset.target!);
            this.sendFriendRequest(targetData);
            (e.currentTarget as HTMLButtonElement).disabled = true;
            (e.currentTarget as HTMLButtonElement).textContent = 'تم الإرسال';
        }));
    },

    async sendFriendRequest(targetUserData: UserData) {
        const currentUser = App.state.userData;
        const targetId = targetUserData.uid;
        if (!currentUser || currentUser.uid === targetId) return;
    
        const targetUserRef = db.collection('users').doc(targetId);
        const currentUserRef = db.collection('users').doc(currentUser.uid);
        
        const requestTimestamp = firebase.firestore.Timestamp.now();
    
        await db.runTransaction(async (transaction: any) => {
            const targetDoc = await transaction.get(targetUserRef);
            if (!targetDoc.exists) throw new Error("المستخدم المستهدف غير موجود.");
    
            const incomingRequest: FriendRequest = {
                fromId: currentUser.uid, fromUsername: currentUser.username, fromAvatar: currentUser.avatar, sentAt: requestTimestamp
            };
            transaction.update(targetUserRef, { 'friendRequests.incoming': firebase.firestore.FieldValue.arrayUnion(incomingRequest) });
    
            const outgoingRequest = {
                fromId: targetUserData.uid, fromUsername: targetUserData.username, fromAvatar: targetUserData.avatar, sentAt: requestTimestamp
            };
            transaction.update(currentUserRef, { 'friendRequests.outgoing': firebase.firestore.FieldValue.arrayUnion(outgoingRequest) });
        });
        App.functions.ui.showToast("تم إرسال طلب الصداقة بنجاح!", "success");
    },

    async acceptFriendRequest(sender: UserData | FriendRequest) {
        const currentUser = App.state.userData;
        if (!currentUser) return;

        const senderId = 'uid' in sender ? sender.uid : sender.fromId;
        const senderUsername = 'username' in sender ? sender.username : sender.fromUsername;

        const targetUserRef = db.collection('users').doc(senderId);
        const currentUserRef = db.collection('users').doc(currentUser.uid);

        await db.runTransaction(async (transaction: any) => {
            const currentUserDoc = await transaction.get(currentUserRef);
            const targetUserDoc = await transaction.get(targetUserRef);
            if (!currentUserDoc.exists || !targetUserDoc.exists) throw new Error("لم يتم العثور على بيانات المستخدم.");
            const currentUserData = currentUserDoc.data() as UserData;
            const targetUserData = targetUserDoc.data() as UserData;
            const incomingRequestIndex = (currentUserData.friendRequests?.incoming || []).findIndex(req => req.fromId === senderId);
            if (incomingRequestIndex === -1) { console.warn("لم يتم العثور على طلب الصداقة الوارد."); return; }
            const outgoingRequestIndex = (targetUserData.friendRequests?.outgoing || []).findIndex(req => req.fromId === currentUser.uid);
            const newIncoming = [...(currentUserData.friendRequests?.incoming || [])];
            newIncoming.splice(incomingRequestIndex, 1);
            const newOutgoing = [...(targetUserData.friendRequests?.outgoing || [])];
            if (outgoingRequestIndex > -1) newOutgoing.splice(outgoingRequestIndex, 1);
            transaction.update(currentUserRef, { friends: firebase.firestore.FieldValue.arrayUnion(senderId), 'friendRequests.incoming': newIncoming });
            transaction.update(targetUserRef, { friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid), 'friendRequests.outgoing': newOutgoing });
        });
        
        await App.functions.achievements.checkSocialAchievements('friend_added');
        App.functions.ui.showToast(`أصبح ${senderUsername} صديقك الآن!`, "success");
        if (!App.DOM.profileView.classList.contains('view-inactive')) {
             App.functions.profile.initProfile(currentUser.uid);
        }
    },

    async declineFriendRequest(sender: FriendRequest) {
        const currentUser = App.state.userData;
        if (!currentUser) return;
        const senderId = sender.fromId;
        const senderUsername = sender.fromUsername;
        const targetUserRef = db.collection('users').doc(senderId);
        const currentUserRef = db.collection('users').doc(currentUser.uid);
        await db.runTransaction(async (transaction: any) => {
            const currentUserDoc = await transaction.get(currentUserRef);
            const targetUserDoc = await transaction.get(targetUserRef);
            if (!currentUserDoc.exists || !targetUserDoc.exists) throw new Error("لم يتم العثور على بيانات المستخدم.");
            const currentUserData = currentUserDoc.data() as UserData;
            const targetUserData = targetUserDoc.data() as UserData;
            const incomingRequestIndex = (currentUserData.friendRequests?.incoming || []).findIndex(req => req.fromId === senderId);
            if (incomingRequestIndex > -1) {
                const newIncoming = [...(currentUserData.friendRequests?.incoming || [])];
                newIncoming.splice(incomingRequestIndex, 1);
                transaction.update(currentUserRef, { 'friendRequests.incoming': newIncoming });
            }
            const outgoingRequestIndex = (targetUserData.friendRequests?.outgoing || []).findIndex(req => req.fromId === currentUser.uid);
            if (outgoingRequestIndex > -1) {
                const newOutgoing = [...(targetUserData.friendRequests?.outgoing || [])];
                newOutgoing.splice(outgoingRequestIndex, 1);
                transaction.update(targetUserRef, { 'friendRequests.outgoing': newOutgoing });
            }
        });
        App.functions.ui.showToast(`تم رفض طلب الصداقة من ${senderUsername}.`, "info");
        if (!App.DOM.profileView.classList.contains('view-inactive')) {
             App.functions.profile.initProfile(currentUser.uid);
        }
    },

    async removeFriend(friendId: string) {
        const currentUser = App.state.userData;
        if (!currentUser) return;
        const friendUserRef = db.collection('users').doc(friendId);
        const currentUserRef = db.collection('users').doc(currentUser.uid);
        await db.runTransaction(async (transaction: any) => {
            transaction.update(currentUserRef, { friends: firebase.firestore.FieldValue.arrayRemove(friendId) });
            transaction.update(friendUserRef, { friends: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        });
        App.functions.ui.showToast("تمت إزالة الصديق بنجاح.", "success");
        if (!App.DOM.profileView.classList.contains('view-inactive')) {
             App.functions.profile.initProfile(currentUser.uid);
        }
    }
};
