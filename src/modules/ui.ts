
import { db, firebase } from '../firebase';
import { App } from '../../app';
import { Game, Package, AudioCache } from '../types';
import { UserData } from '../types';
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

// Declaration for canvas-confetti
declare var confetti: any;

export const uiFunctions = {
    sound: {
        cache: {} as AudioCache,
        muted: false,
        init() {
            const sounds = {
                click: 'https://cdn.freesound.org/previews/665/665184_11363620-lq.mp3',
                correct: 'https://cdn.freesound.org/previews/270/270402_5123851-lq.mp3',
                wrong: 'https://cdn.freesound.org/previews/142/142608_2437358-lq.mp3',
                win: 'https://cdn.freesound.org/previews/456/456918_4434520-lq.mp3',
                countdown: 'https://cdn.freesound.org/previews/254/254316_4062622-lq.mp3',
                hover: 'https://cdn.freesound.org/previews/616/616035_12723769-lq.mp3',
            };
            for (const [key, url] of Object.entries(sounds)) {
                this.cache[key] = new Audio(url);
                this.cache[key].volume = 0.5;
            }
        },
        play(key: string) {
            if (this.muted || !this.cache[key]) return;
            this.cache[key].currentTime = 0;
            this.cache[key].play().catch(e => console.log('Audio play prevented', e));
        }
    },

    triggerConfetti() {
        if (typeof confetti !== 'function') return;
        const duration = 3000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#fde047', '#fbbf24'] });
            confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#fde047', '#fbbf24'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    },

    typeWriter(element: HTMLElement, text: string, speed = 30) {
        element.innerHTML = '';
        element.classList.add('typewriter-text');
        let i = 0;
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                element.classList.remove('typewriter-text');
            }
        }
        type();
    },

    showFlyingPoints(amount: number, startElement: HTMLElement) {
        const rect = startElement.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = 'flying-point';
        el.textContent = `+${amount}`;
        el.style.left = `${rect.left + rect.width/2}px`;
        el.style.top = `${rect.top}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    },
    
    showLootBox(itemName: string, itemImage: string) {
        const overlay = document.createElement('div');
        overlay.className = 'loot-box-overlay';
        overlay.innerHTML = `
            <div class="text-center text-white">
                <div class="loot-box mb-4">🎁</div>
                <h2 class="text-3xl font-bold mb-2">مبروك!</h2>
                <p class="text-lg mb-4">لقد حصلت على عنصر جديد</p>
                <div class="bg-white/10 p-4 rounded-xl border border-yellow-400 inline-block animate-pop-in">
                    ${itemImage ? `<img src="${itemImage}" class="w-24 h-24 mx-auto mb-2 object-contain">` : ''}
                    <p class="font-bold text-yellow-300 text-xl">${itemName}</p>
                </div>
                <button class="admin-btn admin-btn-primary mt-8 close-loot-box">رائع!</button>
            </div>
        `;
        document.body.appendChild(overlay);
        this.sound.play('win');
        this.triggerConfetti();
        
        overlay.querySelector('.close-loot-box')?.addEventListener('click', () => {
            overlay.remove();
        });
    },

    initDOM() {
        const allIds = [...document.querySelectorAll('[id]')].map(e => e.id);
        allIds.forEach(id => {
            const camelCaseId = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
            App.DOM[camelCaseId] = document.getElementById(id)!;
        });
        this.sound.init();
        
        document.body.addEventListener('mouseover', (e) => {
            if ((e.target as HTMLElement).closest('button')) {
                // Optional: Play faint hover sound
                // this.sound.play('hover');
            }
        });
        document.body.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('button')) {
                this.sound.play('click');
            }
        });
    },
    
    showToast(message: string, type = 'info') {
        const container = App.DOM.toastContainer;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 4000);
    },

    openModal(modalElement: HTMLElement) {
        modalElement.classList.remove('modal-inactive');
    },

    closeAllModals() {
        document.querySelectorAll('.modal-base').forEach(modal => {
            modal.classList.add('modal-inactive');
        });
    },
    
    toggleMainFabVisibility(visible: boolean) {
        App.DOM.aiChatBtn.classList.toggle('hidden', !visible);
        App.DOM.globalChatBtn.classList.toggle('hidden', !visible);
    },

    openFullscreenView(viewElement: HTMLElement) {
        if (viewElement.id === 'quiz-chat-panel') {
            viewElement.classList.remove('view-inactive');
            if (!App.state.currentQuizChatListener && App.functions.quiz.currentQuizRoom) {
               App.functions.quiz.listenForRoomChat(App.functions.quiz.currentQuizRoom.id);
            }
            return;
        }
        
        this.toggleMainFabVisibility(false);
        document.querySelectorAll('.fullscreen-view').forEach(v => v.classList.add('view-inactive'));
        if (App.DOM.mainView) App.DOM.mainView.classList.add('hidden');
        viewElement.classList.remove('view-inactive');
    },

    closeFullscreenView() {
        // Specific cleanup for quiz rooms
        if (App.state.currentQuizRoomListener) {
            App.state.currentQuizRoomListener();
            App.state.currentQuizRoomListener = null;
            App.functions.quiz.currentQuizRoom = null;
        }
        if (App.state.currentQuizChatListener) {
            App.state.currentQuizChatListener();
            App.state.currentQuizChatListener = null;
        }
        // Cleanup private chat listener
        if (App.state.currentPrivateChatListener) {
            App.state.currentPrivateChatListener();
            App.state.currentPrivateChatListener = undefined;
            App.state.currentPrivateChatId = undefined;
        }

        // NEW: Reset the quiz view event binding flag
        if (App.DOM.quizGameView.dataset.eventsBound) {
            delete App.DOM.quizGameView.dataset.eventsBound;
        }

        clearTimeout(App.state.questionTimer);
        clearTimeout(App.state.questionPhaseTimeout);

        if(App.state.globalChatListener) {
            App.state.globalChatListener(); 
            App.state.globalChatListener = undefined;
        }
         if(App.state.quizLobbyListener) {
            App.state.quizLobbyListener(); 
            App.state.quizLobbyListener = undefined;
        }
        
        document.querySelectorAll('.fullscreen-view').forEach(v => v.classList.add('view-inactive'));
        
        App.DOM.quizChatBtn.classList.add('hidden');
        App.DOM.quizChatPanel.classList.add('view-inactive');
        
        if (App.DOM.mainView) App.DOM.mainView.classList.remove('hidden');
        this.toggleMainFabVisibility(true);
    },
    
    updateNavAndState(userData: UserData) {
        App.state.userData = userData;

        App.DOM.navAvatar.src = userData.avatar;
        App.DOM.navUsername.textContent = userData.username;
        App.DOM.navLevel.textContent = `Lvl ${userData.level || 1}`;
        const xpForNextLevel = 100 + ((userData.level || 1) - 1) * 150;
        const xpPercentage = Math.min(100, ((userData.xp || 0) / xpForNextLevel) * 100);
        App.DOM.navXpBar.style.width = `${xpPercentage}%`;
        App.DOM.pointsCounter.textContent = (userData.points || 0).toLocaleString();
        
        if (userData.role === 'admin' || userData.role === 'moderator') {
            App.DOM.adminPanelBtn.classList.remove('hidden');
        } else {
            App.DOM.adminPanelBtn.classList.add('hidden');
        }
        
        if (userData.banned) {
            App.DOM.bannedScreen.classList.remove('hidden');
            App.functions.auth.logout();
        } else {
            App.DOM.bannedScreen.classList.add('hidden');
        }
        
        // Render equipped avatar frame
        const avatarWrapper = App.DOM.navAvatar.parentElement;
        if (avatarWrapper) {
            let frameEl = avatarWrapper.querySelector('.avatar-frame');
            if (userData.equippedAvatarFrame) {
                if (!frameEl) {
                    frameEl = document.createElement('img');
                    frameEl.className = 'avatar-frame';
                    avatarWrapper.appendChild(frameEl);
                    App.DOM.navAvatar.classList.add('has-frame');
                }
                (frameEl as HTMLImageElement).src = userData.equippedAvatarFrame;
            } else if (frameEl) {
                frameEl.remove();
                App.DOM.navAvatar.classList.remove('has-frame');
            }
        }

        // Update profile tab friend request badge if it exists
        const requestCount = userData.friendRequests?.incoming?.length || 0;
        const profileBadge = document.getElementById('profile-friend-requests-count');
        if (profileBadge) {
            profileBadge.textContent = requestCount.toString();
            if(requestCount > 0) {
               profileBadge.classList.remove('hidden');
               profileBadge.style.display = 'flex';
            } else {
               profileBadge.classList.add('hidden');
               profileBadge.style.display = 'none';
            }
        }

        this.updatePackageLocks();
    },
    
    setupUserListeners(uid: string) {
        const notifListener = db.collection('users').doc(uid).collection('notifications').where('read', '==', false)
            .onSnapshot((snapshot: any) => {
                const count = snapshot.size;
                App.DOM.notificationsCount.textContent = count.toString();
                App.DOM.notificationsCount.classList.toggle('hidden', count === 0);
            });
        App.state.listeners.push(notifListener);
        
        const userListener = db.collection('users').doc(uid).onSnapshot((doc: any) => {
            if (doc.exists) {
                const userData = { uid: doc.id, ...doc.data() } as UserData;
                this.updateNavAndState(userData);
            } else {
                console.warn("User document not found, forcing logout.");
                App.functions.auth.logout();
            }
        }, (error: any) => {
            console.error("Error listening to user document:", error);
        });
        App.state.listeners.push(userListener);

        // Listener for new challenge popups
        const challengeNotifListener = db.collection('users').doc(uid).collection('notifications')
            .where('createdAt', '>', firebase.firestore.Timestamp.now())
            .onSnapshot((snapshot: any) => {
                snapshot.docChanges().forEach((change: any) => {
                    if (change.type === 'added') {
                        const notif = change.doc.data();
                        if (notif.type === 'quiz_challenge' || notif.type === 'matchmaking_found') {
                            this.showChallengeNotification(notif);
                        }
                    }
                });
            });
        App.state.listeners.push(challengeNotifListener);
    },

    showChallengeNotification(notificationData: any) {
        const container = App.DOM.popupNotificationContainer;
        if (!container) return;

        const notifId = `notif-${Date.now()}`;
        const toast = document.createElement('div');
        toast.className = 'popup-notification';
        toast.id = notifId;

        toast.innerHTML = `
            <h4 class="font-bold text-lg text-white">${notificationData.title}</h4>
            <p class="text-sm text-gray-300 mt-1">${notificationData.body}</p>
            <div class="flex gap-2 mt-4">
                <button data-action="accept" class="admin-btn admin-btn-success admin-btn-sm flex-1">قبول</button>
                <button data-action="decline" class="admin-btn admin-btn-secondary admin-btn-sm flex-1">رفض</button>
            </div>
        `;

        container.appendChild(toast);

        const closeNotif = () => {
            toast.style.animation = 'slide-out-toast 0.4s forwards cubic-bezier(0.6, -0.28, 0.735, 0.045)';
            setTimeout(() => toast.remove(), 400);
        };
        
        const timeout = setTimeout(closeNotif, 10000); // Auto-decline after 10s

        toast.querySelector('button[data-action="accept"]')?.addEventListener('click', () => {
            clearTimeout(timeout);
            App.functions.quiz.joinQuizRoom(notificationData.roomId);
            closeNotif();
        });
        toast.querySelector('button[data-action="decline"]')?.addEventListener('click', () => {
            clearTimeout(timeout);
            closeNotif();
        });
    },

    async loadAndShowLeaderboard(sortBy: 'points' | 'quizWins' = 'points') {
        this.openModal(App.DOM.leaderboardModal);
        const list = App.DOM.leaderboardList;
        list.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-4xl text-white"></i></div>`;
    
        const { leaderboardTabPoints, leaderboardTabQuiz } = App.DOM;
    
        if (sortBy === 'points') {
            leaderboardTabPoints.classList.add('border-yellow-400', 'text-primary');
            leaderboardTabPoints.classList.remove('border-transparent', 'text-gray-400');
            leaderboardTabQuiz.classList.add('border-transparent', 'text-gray-400');
            leaderboardTabQuiz.classList.remove('border-yellow-400', 'text-primary');
        } else { // 'quizWins'
            leaderboardTabQuiz.classList.add('border-yellow-400', 'text-primary');
            leaderboardTabQuiz.classList.remove('border-transparent', 'text-gray-400');
            leaderboardTabPoints.classList.add('border-transparent', 'text-gray-400');
            leaderboardTabPoints.classList.remove('border-yellow-400', 'text-primary');
        }
    
        try {
            const snapshot = await db.collection('users').orderBy(sortBy, 'desc').limit(20).get();
            const users = snapshot.docs.map((doc: any, index: number) => ({...doc.data(), uid: doc.id, rank: index + 1}));
            
            const displayValue = (user: any) => {
                if (sortBy === 'quizWins') {
                    return `${(user.quizWins || 0).toLocaleString()} <i class="fas fa-trophy text-sm"></i>`;
                }
                return `${(user.points || 0).toLocaleString()} <i class="fas fa-coins text-sm"></i>`;
            };
    
            list.innerHTML = users.map((user: any) => `
                 <div class="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg cursor-pointer hover:bg-gray-700 view-profile-btn" data-user-id="${user.uid}">
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-lg w-6 text-center">${user.rank}</span>
                        <img src="${user.avatar}" class="w-10 h-10 rounded-full object-cover">
                        <span class="font-bold">${user.username}</span>
                    </div>
                    <span class="font-bold text-yellow-400">${displayValue(user)}</span>
                </div>
            `).join('');
        } catch(e) {
            list.innerHTML = `<p class="text-red-500 text-center">.فشل تحميل لوحة الصدارة</p>`;
        }
    },
    
    async loadAndShowCollection(modal: HTMLElement, collectionName: string, title: string) {
        if (!App.state.user) return;
        this.openModal(modal);
        const listContainer = modal.querySelector('div[id$="-list"]');
        if (!listContainer) return;
    
        listContainer.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-4xl text-white"></i></div>`;
        const uid = App.state.user.uid;
        const collectionRef = db.collection('users').doc(uid).collection(collectionName);
    
        if (collectionName === 'notifications') {
            (async () => {
                try {
                    const thirtyDaysAgo = firebase.firestore.Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    const oldNotifsQuery = collectionRef.where('createdAt', '<', thirtyDaysAgo);
                    const snapshot = await oldNotifsQuery.get();
                    if (!snapshot.empty) {
                        const batch = db.batch();
                        snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
                        await batch.commit();
                        console.log(`Auto-cleaned up ${snapshot.size} old notifications.`);
                    }
                } catch (e) {
                    console.error("Failed to auto-cleanup notifications:", e);
                }
            })();
        }
    
        try {
            const snapshot = await collectionRef.orderBy('createdAt', 'desc').limit(30).get();
            const items = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
            if (items.length === 0) {
                listContainer.innerHTML = `<p class="text-gray-400 text-center p-4">.لا يوجد ${title} حالياً</p>`;
                return;
            }
    
            listContainer.innerHTML = items.map(item => {
                const isInvite = item.type === 'quiz_invite' && item.roomId;
                return `
                <div class="notification-item p-3 rounded-lg ${item.read ? 'bg-gray-800/50' : 'bg-yellow-400/20'}">
                    <button class="delete-notification-btn" data-doc-id="${item.id}" title="حذف الإشعار">&times;</button>
                    <p class="font-bold pr-8">${item.title}</p>
                    <p class="text-sm text-gray-300 pr-8">${item.body}</p>
                    ${isInvite ? `<button class="admin-btn admin-btn-success admin-btn-sm mt-2" data-action="join-room-from-notif" data-room-id="${item.roomId}">الانضمام للغرفة</button>` : ''}
                    <p class="text-xs text-gray-500 mt-2">${new Date(item.createdAt.seconds * 1000).toLocaleString('ar-EG')}</p>
                </div>
                `;
            }).join('');
    
            listContainer.addEventListener('click', async (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                const deleteBtn = target.closest('.delete-notification-btn');
                if (deleteBtn && collectionName === 'notifications') {
                    const docId = deleteBtn.getAttribute('data-doc-id');
                    if (docId) {
                        const notifItem = deleteBtn.closest('.notification-item') as HTMLElement;
                        try {
                            if (notifItem) {
                                notifItem.classList.add('deleting');
                            }
                            await db.collection('users').doc(uid).collection('notifications').doc(docId).delete();
                            setTimeout(() => notifItem?.remove(), 300);
                        } catch (err) {
                            console.error("Failed to delete notification:", err);
                            this.showToast("فشل حذف الإشعار", "error");
                            notifItem?.classList.remove('deleting');
                        }
                    }
                }
            });
    
            const unread = items.filter(item => !item.read).map(item => item.id);
            if (unread.length > 0) {
                const batch = db.batch();
                unread.forEach(id => {
                    batch.update(collectionRef.doc(id), { read: true });
                });
                await batch.commit();
            }
    
        } catch (e) {
            listContainer.innerHTML = `<p class="text-red-500 text-center">.فشل تحميل ${title}</p>`;
            console.error(`Error loading ${collectionName}:`, e);
        }
    },
     async loadAndShowGlobalCollection(modal: HTMLElement, collectionName: string, title: string) {
        this.openModal(modal);
        const listContainer = modal.querySelector('div[id$="-list"]');
        if (!listContainer) return;

        listContainer.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-4xl text-white"></i></div>`;
        
        try {
            const snapshot = await db.collection(collectionName).orderBy('createdAt', 'desc').limit(10).get();
            const items = snapshot.docs.map((doc: any) => ({id: doc.id, ...doc.data()}));
            
            if(items.length === 0) {
                listContainer.innerHTML = `<p class="text-gray-400 text-center p-4">.لا يوجد ${title} حالياً</p>`;
                return;
            }
            
            listContainer.innerHTML = items.map((item: any) => `
                <div class="p-4 rounded-lg bg-gray-800/50">
                    <h4 class="font-bold text-lg text-accent">${item.title}</h4>
                    <div class="prose prose-invert max-w-none text-gray-300 mt-2">${marked(item.content)}</div>
                    <p class="text-xs text-gray-500 mt-2">${new Date(item.createdAt.seconds * 1000).toLocaleString('ar-EG')}</p>
                </div>
            `).join('');

        } catch(e) {
             listContainer.innerHTML = `<p class="text-red-500 text-center">.فشل تحميل ${title}</p>`;
             console.error(`Error loading ${collectionName}:`, e);
        }
    },
    
    async loadGamesForSelector() {
        try {
            const snapshot = await db.collection('games').orderBy('name').get();
            const games: Game[] = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            App.state.allGamesCache = games;
            if(games.length > 0) {
                App.DOM.gameSelector.innerHTML = `<option value="">-- اختر لعبة --</option>` + games.map(game => `<option value="${game.id}">${game.name}</option>`).join('');
                App.DOM.gameSelector.value = games[0].id;
                this.displayGamePackages(games[0].id);
            } else {
                App.DOM.gameSelector.innerHTML = `<option value="">-- لا توجد ألعاب متاحة --</option>`;
            }
        } catch(e) {
            console.error("Error loading games for selector", e);
        }
    },
    
    async displayGamePackages(gameId: string) {
        if (!gameId) {
            App.DOM.gameHeader.classList.add('hidden');
            App.DOM.packagesContainer.innerHTML = '';
            return;
        }
        App.DOM.packagesContainer.innerHTML = `<div class="col-span-full text-center p-8"><i class="fas fa-spinner fa-spin text-4xl text-white"></i></div>`;
        
        try {
            const gameDoc = await db.collection('games').doc(gameId).get();
            if (!gameDoc.exists) throw new Error("Game not found");
            const gameData = {id: gameDoc.id, ...gameDoc.data()} as Game;
            
            App.DOM.gameLogo.src = gameData.logo;
            App.DOM.gameName.textContent = gameData.name;
            App.DOM.gameHeader.classList.remove('hidden');
            App.DOM.gameHeader.classList.add('flex');
            
            const packagesSnapshot = await db.collection('games').doc(gameId).collection('packages').orderBy('points').get();
            const packages: Package[] = packagesSnapshot.docs.map((doc: any) => ({id: doc.id, ...doc.data() }));

            if(packages.length === 0) {
                App.DOM.packagesContainer.innerHTML = `<p class="col-span-full text-gray-400 text-center p-4">.لا توجد باقات لهذه اللعبة حالياً</p>`;
                return;
            }
            
            const currentUserPoints = App.state.userData?.points || 0;

            App.DOM.packagesContainer.innerHTML = packages.map(pkg => {
                const isLocked = currentUserPoints < pkg.points;
                const bannerUrl = pkg.banner || gameData.banner || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80';

                return `
                <div class="package-item ${isLocked ? 'locked-package' : ''}" data-required-points="${pkg.points}" data-action="${isLocked ? 'show-locked-msg' : ''}">
                    <div class="package-text-header" style="background-image: url('${bannerUrl}')">
                        <h2 class="package-text-header-name">${pkg.name}</h2>
                        <p class="package-text-header-game">${gameData.name}</p>
                        ${isLocked ? `
                            <div class="lock-overlay-professional">
                                <i class="fas fa-lock text-4xl text-white/70"></i>
                            </div>
                        ` : ''}
                    </div>
                    <div class="package-content">
                        <div>
                            <p>${pkg.value}</p>
                        </div>
                        <div class="package-price-container">
                            <div class="flex items-center gap-2">
                                <span class="package-price">${(pkg.points || 0).toLocaleString()}</span>
                                <i class="fas fa-coins text-accent"></i>
                            </div>
                            <button data-action="buy-pkg" data-game='${JSON.stringify(gameData)}' data-pkg='${JSON.stringify(pkg)}' class="buy-pkg-btn btn btn-success btn-sm">شحن</button>
                        </div>
                    </div>
                </div>
            `}).join('');
        } catch (e) {
            console.error("Error displaying packages:", e);
            App.DOM.packagesContainer.innerHTML = `<p class="col-span-full text-red-500 text-center p-4">.حدث خطأ أثناء تحميل الباقات</p>`;
        }
    },

    updatePackageLocks() {
        if (!App.state.userData) return;
        const currentUserPoints = App.state.userData.points || 0;
        const packageItems = document.querySelectorAll<HTMLElement>('.package-item[data-required-points]');
        
        packageItems.forEach(item => {
            const requiredPoints = parseInt(item.dataset.requiredPoints!, 10);
            const isCurrentlyLocked = item.classList.contains('locked-package');
            
            if (currentUserPoints >= requiredPoints && isCurrentlyLocked) {
                item.classList.remove('locked-package');
                item.classList.add('animate-unlock');
                item.dataset.action = '';
                item.querySelector('.lock-overlay-professional')?.remove();
                setTimeout(() => item.classList.remove('animate-unlock'), 800);
            } else if (currentUserPoints < requiredPoints && !isCurrentlyLocked) {
                item.classList.add('locked-package');
                item.dataset.action = 'show-locked-msg';
                const header = item.querySelector('.package-text-header');
                if (header && !item.querySelector('.lock-overlay-professional')) {
                    const lockOverlay = document.createElement('div');
                    lockOverlay.className = 'lock-overlay-professional';
                    lockOverlay.innerHTML = '<i class="fas fa-lock text-4xl text-white/70"></i>';
                    header.appendChild(lockOverlay);
                }
            }
        });
    },

    showPlayerIdModal(game: Game, pkg: Package) {
        App.state.pendingPurchase = { game, pkg };
        App.DOM.playeridGameName.textContent = game.name;
        App.DOM.playeridPkgName.textContent = pkg.name;
        this.openModal(App.DOM.playeridModal);
    },

    async handlePurchaseSubmit(e: Event) {
        e.preventDefault();
        
        if (!App.state.pendingPurchase || !App.state.userData) {
            this.showToast("حدث خطأ ما. يرجى إغلاق النافذة والمحاولة مرة أخرى.", "error");
            return;
        }
        const form = e.target as HTMLFormElement;
        const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        App.functions.helpers.toggleButtonLoading(button, true);

        try {
            const playerId = App.DOM.playeridInput.value.trim();
            if (!playerId) throw new Error('الرجاء إدخال ID اللاعب الخاص بك.');
            
            const { game, pkg } = App.state.pendingPurchase;
            const user = App.state.userData;

            const orderCounterRef = db.collection('settings').doc('orderCounter');

            await db.runTransaction(async (transaction: any) => {
                const userRef = db.collection('users').doc(user.uid);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) throw new Error("User not found.");

                const currentPoints = Number(userDoc.data()?.points ?? 0);
                const cost = Number(pkg.points);
                if (isNaN(currentPoints) || isNaN(cost) || currentPoints < cost) throw new Error('ليس لديك نقاط كافية لإتمام عملية الشحن.');

                const counterDoc = await transaction.get(orderCounterRef);
                const count = counterDoc.exists ? counterDoc.data().count : 0;
                const assignedGroup = (count % 5) + 1;
                
                const newOrder = {
                    userId: user.uid, username: user.username || `player_${user.uid.substring(0, 6)}`,
                    userShortId: user.shortId || 'غير متوفر', gameId: game.id, gameName: game.name,
                    packageId: pkg.id, packageName: pkg.name, packagePoints: cost, playerId: playerId,
                    status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    assignedGroup: assignedGroup
                };
                
                transaction.set(db.collection('orders').doc(), newOrder);
                transaction.update(userRef, { 
                    points: firebase.firestore.FieldValue.increment(-cost),
                    topups: firebase.firestore.FieldValue.increment(1)
                });
                transaction.set(orderCounterRef, { count: count + 1 }, { merge: true });

                const pointsLogRef = db.collection('pointsLog').doc();
                transaction.set(pointsLogRef, {
                    userId: user.uid, username: user.username || `player_${user.uid.substring(0, 6)}`,
                    change: -cost, reason: `شراء باقة ${pkg.name}`,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await App.functions.helpers.grantXpAndCheckLevelUp(user.uid, Math.floor(pkg.points / 20));
            
            // Check for first top-up achievement
            await App.functions.achievements.checkTopUpAchievements();

            await db.collection('users').doc(user.uid).collection('notifications').add({
                title: '⏳ جار معالجة طلبك', body: 'طلبك قيد المراجعة الآن. قد يستغرق الشحن ما يصل إلى 24 ساعة.',
                read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            this.showToast('تم إرسال طلبك بنجاح!', 'success');
            this.closeAllModals();
            App.DOM.playeridForm.reset();

        } catch (error: any) {
            this.showToast(`فشل إرسال الطلب: ${error.message}`, 'error');
        } finally {
            App.state.pendingPurchase = null;
            App.functions.helpers.toggleButtonLoading(button, false);
        }
    },

    startActivityTicker() {
        const activitySpan = App.DOM.activityTickerSpan;

        const showNextActivity = (activities: string[]) => {
            if (activities.length === 0) {
                activitySpan.textContent = 'انضم إلى غرف الأسئلة أو اشحن الألعاب لكسب النقاط!';
                activitySpan.style.opacity = '1';
                return;
            }
            
            const activity = activities.shift()!; 
            activities.push(activity); 

            activitySpan.style.opacity = '0';
            activitySpan.style.transform = 'translateY(10px)';

            setTimeout(() => {
                activitySpan.innerHTML = activity;
                activitySpan.style.opacity = '1';
                activitySpan.style.transform = 'translateY(0)';
            }, 500);

            App.state.activityTickerTimeout = setTimeout(() => showNextActivity(activities), 5000);
        };

        const activityListener = db.collection('orders').orderBy('createdAt', 'desc').limit(50) 
            .onSnapshot((snapshot: any) => {
                 if(App.state.activityTickerTimeout) clearTimeout(App.state.activityTickerTimeout);
                const activities = snapshot.docs.map((doc: any) => doc.data())
                    .filter((data: any) => data.status === 'completed').slice(0, 10) 
                    .map((data: any) => `🎉 شحن <b>${data.username}</b> باقة <b>${data.packageName}</b> في لعبة <b>${data.gameName}</b>!`);
                showNextActivity(activities);
            });
        
        App.state.listeners.push(activityListener);
    },

    bindMainUIEvents() {
        if (App.state.mainUIEventsBound || !App.state.user) return;

        App.DOM.leaderboardBtn.addEventListener('click', () => this.loadAndShowLeaderboard('points'));
        App.DOM.leaderboardTabPoints.addEventListener('click', () => this.loadAndShowLeaderboard('points'));
        App.DOM.leaderboardTabQuiz.addEventListener('click', () => this.loadAndShowLeaderboard('quizWins'));
        App.DOM.notificationsBtn.addEventListener('click', () => this.loadAndShowCollection(App.DOM.notificationsModal, 'notifications', 'الإشعارات'));
        App.DOM.newsBtn.addEventListener('click', () => this.loadAndShowGlobalCollection(App.DOM.newsModal, 'news', 'الأخبار'));
        App.DOM.profileBtn.addEventListener('click', () => App.functions.profile.initProfile(App.state.user!.uid));
        
        App.DOM.adminPanelBtn.addEventListener('click', () => {
            this.openFullscreenView(App.DOM.adminPanelView);
            App.functions.admin.init();
        });
        
        App.DOM.quizRoomsBtn.addEventListener('click', () => App.functions.quiz.initQuizLobby());
        
        App.DOM.packagesContainer.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            const pkgItem = target.closest('.package-item') as HTMLElement | null;
            if (!pkgItem) return;

            if (pkgItem.dataset.action === 'show-locked-msg') {
                pkgItem.classList.remove('animate-shake');
                void pkgItem.offsetWidth; 
                pkgItem.classList.add('animate-shake');
                this.showToast('ليس لديك نقاط كافية لهذه الباقة!', 'error');
                return;
            }

            const buyBtn = target.closest('button[data-action="buy-pkg"]') as HTMLButtonElement | null;
            if (buyBtn) {
                const game = JSON.parse(buyBtn.dataset.game!);
                const pkg = JSON.parse(buyBtn.dataset.pkg!);
                this.showPlayerIdModal(game, pkg);
            }
        });
        App.DOM.playeridForm.addEventListener('submit', (e) => this.handlePurchaseSubmit(e));
        
        App.DOM.aiChatBtn.addEventListener('click', () => this.openFullscreenView(App.DOM.aiChatView));
        App.DOM.globalChatBtn.addEventListener('click', () => {
            this.openFullscreenView(App.DOM.globalChatView);
            App.functions.chat.listenForGlobalMessages();
        });
        App.DOM.quizChatBtn.addEventListener('click', () => this.openFullscreenView(App.DOM.quizChatPanel));

        App.DOM.promoCodeForm.addEventListener('submit', (e) => {
           e.preventDefault();
           const input = (e.target as HTMLFormElement).elements.namedItem('promo-code-input') as HTMLInputElement;
           App.functions.activities.redeemPromoCode(input.value);
           input.value = '';
        });
        
        App.DOM.watchAdBtn.addEventListener('click', () => App.functions.activities.watchAd());
        App.DOM.aiChatForm.addEventListener('submit', (e) => { e.preventDefault(); App.functions.chat.handleAiChatSubmit(); });
        App.DOM.globalChatForm.addEventListener('submit', (e) => { e.preventDefault(); App.functions.chat.handleGlobalChatSubmit(); });
        App.DOM.quizRoomChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (App.functions.quiz.currentQuizRoom) App.functions.quiz.handleRoomChatSubmit(App.functions.quiz.currentQuizRoom.id);
        });
        // Bind Private Chat Form
        App.DOM.privateChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            App.functions.chat.handlePrivateChatSubmit();
        });
        
        App.DOM.gameSelector.addEventListener('change', (e) => this.displayGamePackages((e.target as HTMLSelectElement).value));

        document.body.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            
            const closeModalBtn = target.closest('.close-modal-btn');
            if (closeModalBtn) closeModalBtn.closest('.modal-base')?.classList.add('modal-inactive');
        
            const closeFullscreenBtn = target.closest('.close-fullscreen-btn');
            if (closeFullscreenBtn) {
                const view = closeFullscreenBtn.closest('.fullscreen-view');
                if (view) {
                    if (view.id === 'quiz-chat-panel') view.classList.add('view-inactive');
                    else this.closeFullscreenView();
                }
            }
            
            const profileBtn = target.closest('.view-profile-btn') as HTMLElement | null;
            if (profileBtn?.dataset.userId) App.functions.profile.initProfile(profileBtn.dataset.userId);

            const submitQuestionBtn = target.closest('#submit-question-btn') as HTMLElement | null;
            if(submitQuestionBtn) App.functions.quiz.showSubmitQuestionModal();

            const joinRoomNotifBtn = target.closest('button[data-action="join-room-from-notif"]') as HTMLElement;
            if (joinRoomNotifBtn?.dataset.roomId) {
                this.closeAllModals();
                App.functions.quiz.joinQuizRoom(joinRoomNotifBtn.dataset.roomId);
            }
            
            // Global Emoji Panel Closer
            const emojiPanel = document.getElementById('emoji-panel-vertical');
            const emojiTrigger = document.getElementById('emoji-panel-trigger');
            if (emojiPanel && emojiPanel.classList.contains('is-open') && 
                !emojiPanel.contains(target) && (!emojiTrigger || !emojiTrigger.contains(target))) {
                emojiPanel.classList.remove('is-open');
            }
        });
        
        [App.DOM.globalChatMessages, App.DOM.quizRoomChatMessages].forEach(container => {
            container.addEventListener('click', e => {
                const profileTrigger = (e.target as HTMLElement).closest('.view-profile-btn') as HTMLElement;
                if (profileTrigger?.dataset.userId) App.functions.profile.initProfile(profileTrigger.dataset.userId);
            });
        });

        // --- EVENT DELEGATION FOR QUIZ GAME VIEW ---
        App.DOM.quizGameView.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            
            // 1. Ready Button - Fixed Logic Call
            const readyBtn = target.closest('#ready-btn');
            if (readyBtn && !readyBtn.hasAttribute('disabled')) {
                App.functions.quiz.handlePlayerReady();
            }

            // 2. Start Game Button
            const startBtn = target.closest('#start-game-btn');
            if (startBtn) App.functions.quiz.handleStartGame();

            // 3. Leave Room Button
            const leaveBtn = target.closest('#leave-room-btn');
            if (leaveBtn) {
                 App.functions.ui.showConfirmationModal('مغادرة الغرفة', 'هل أنت متأكد من المغادرة؟', () => App.functions.quiz.handleLeaveRoom());
            }

            // 4. Edit Settings Button
            const settingsBtn = target.closest('#edit-room-settings-btn');
            if (settingsBtn) App.functions.quiz.showEditRoomModal();

            // 5. Emoji Panel Trigger
            const emojiTrigger = target.closest('#emoji-panel-trigger');
            if (emojiTrigger) {
                const panel = document.getElementById('emoji-panel-vertical');
                if (panel) {
                    e.stopPropagation();
                    panel.classList.toggle('is-open');
                }
            }
            
            // 6. Emoji React
            const emojiBtn = target.closest('.emoji-react-btn');
            if (emojiBtn) {
                const emoji = (emojiBtn as HTMLElement).dataset.emoji;
                if (emoji) App.functions.quiz.handleEmojiReact(emoji);
            }

            // 7. Invite Friend Slot
            if (target.closest('.invite-slot-btn')) App.functions.quiz.showInviteFriendsModal();

            // 8. Host Manage Player
            const manageBtn = target.closest('.manage-player-btn');
            if (manageBtn) {
                e.stopPropagation();
                const uid = (manageBtn as HTMLElement).dataset.uid;
                if (uid) App.functions.quiz.showHostManagePlayerModal(uid, manageBtn as HTMLElement);
            }
            
            // 9. Player Slot Interactions (Click avatar)
            const playerSlot = target.closest('.player-slot-content');
            if (playerSlot) {
                const uid = (playerSlot as HTMLElement).dataset.uid;
                const myUid = App.state.userData?.uid;
                if (uid && uid !== myUid) {
                    e.stopPropagation();
                    App.functions.quiz.showPlayerActionMenu(uid, playerSlot as HTMLElement);
                }
            }

            // 10. Answer Buttons
            const answerBtn = target.closest('.answer-btn');
            if (answerBtn && !answerBtn.hasAttribute('disabled')) App.functions.quiz.handleAnswerSubmit(answerBtn.getAttribute('data-answer')!);
            
            // 11. Report Button
            const reportBtn = target.closest('#report-question-btn');
            if (reportBtn) App.functions.quiz.handleReportQuestion();
            
            // 12. Powerups
            const powerupBtn = target.closest('.powerup-btn');
            if (powerupBtn && !powerupBtn.hasAttribute('disabled')) {
                const type = (powerupBtn as HTMLElement).dataset.type;
                if (type) App.functions.quiz.handleUsePowerup(type);
            }
            
            // 13. Results Actions
            if (target.closest('#share-results-btn')) App.functions.quiz.handleShareResults();
            if (target.closest('#rematch-btn')) App.functions.quiz.handleRematch();
        });

        App.state.mainUIEventsBound = true;
    },
    
    openGenericModal(title: string, content: string, onOpen?: (modal: HTMLElement) => void) {
        const modal = App.DOM.genericModal;
        App.DOM.genericModalContent.innerHTML = `
            <div class="flex justify-between items-center mb-4 border-b border-[var(--admin-border)] pb-3">
                <h3 class="text-xl font-bold">${title}</h3>
                <button class="close-modal-btn text-2xl text-gray-400 hover:text-white">&times;</button>
            </div>
            <div>${content}</div>
        `;
        this.openModal(modal);
        if (onOpen) onOpen(modal);
    },

    closeGenericModal() {
        App.DOM.genericModal.classList.add('modal-inactive');
        if (App.DOM.genericModalContent) App.DOM.genericModalContent.innerHTML = '';
    },

    showConfirmationModal(title: string, message: string, onConfirm: () => void, confirmText = 'تأكيد', cancelText = 'إلغاء') {
        const content = `
            <p class="mb-6">${message}</p>
            <div class="flex justify-end gap-3">
                <button id="confirm-cancel-btn" class="admin-btn admin-btn-secondary">${cancelText}</button>
                <button id="confirm-action-btn" class="admin-btn admin-btn-danger">${confirmText}</button>
            </div>
        `;
        this.openGenericModal(title, content, (modal) => {
            modal.querySelector('#confirm-action-btn')?.addEventListener('click', () => { onConfirm(); this.closeGenericModal(); }, { once: true });
            modal.querySelector('#confirm-cancel-btn')?.addEventListener('click', () => this.closeGenericModal(), { once: true });
        });
    },

    showAlert(title: string, message: string, onOk?: () => void) {
        const content = `
            <div class="text-center p-4">
                <i class="fas fa-exclamation-circle text-4xl text-yellow-400 mb-4"></i>
                <p class="mb-6 text-lg font-semibold text-white">${message}</p>
                <button id="alert-ok-btn" class="admin-btn admin-btn-primary px-8 py-2">حسناً</button>
            </div>
        `;
        this.openGenericModal(title, content, (modal) => {
            const btn = modal.querySelector('#alert-ok-btn');
            if(btn) {
                btn.addEventListener('click', () => {
                    this.closeGenericModal();
                    if (onOk) onOk();
                });
            }
        });
    },

    showAchievementUnlockedPopup(achievement: any) {
        const container = App.DOM.popupNotificationContainer;
        if (!container) return;
    
        const notifId = `achieve-${Date.now()}`;
        const toast = document.createElement('div');
        toast.className = 'achievement-popup';
        toast.id = notifId;
    
        toast.innerHTML = `
            <i class="fas ${achievement.icon} achievement-popup-icon"></i>
            <div>
                <h4 class="font-bold text-lg text-yellow-300">إنجاز جديد!</h4>
                <p class="text-sm text-gray-200 mt-1">${achievement.name}</p>
            </div>
        `;
    
        container.appendChild(toast);
    
        const closeNotif = () => {
            toast.style.animation = 'slide-out-toast 0.4s forwards cubic-bezier(0.6, -0.28, 0.735, 0.045)';
            setTimeout(() => toast.remove(), 400);
        };
        
        const timeout = setTimeout(closeNotif, 5000);
    
        toast.addEventListener('click', () => {
            clearTimeout(timeout);
            closeNotif();
        });
    },
};
