




import { db, firebase } from '../firebase';
import { App } from '../../app';
import { UserData, QuizTier, FriendRequest } from '../types';
import { friendFunctions } from './friends';

const TIER_ICONS: { [key in QuizTier]: string } = {
    unranked: 'fa-question-circle text-gray-400',
    bronze: 'fa-award text-yellow-700',
    silver: 'fa-award text-gray-300',
    gold: 'fa-award text-yellow-400',
    platinum: 'fa-gem text-cyan-400',
    diamond: 'fa-gem text-purple-400',
};
const TIER_NAMES: { [key in QuizTier]: string } = {
    unranked: 'غير مصنف',
    bronze: 'برونزي',
    silver: 'فضي',
    gold: 'ذهبي',
    platinum: 'بلاتيني',
    diamond: 'ماسي',
};

export const profileFunctions = {
    friends: friendFunctions,

    async initProfile(userId: string) {
        App.functions.ui.openFullscreenView(App.DOM.profileView);
        const profileView = App.DOM.profileView;
        profileView.innerHTML = `<div class="w-full h-full flex items-center justify-center"><i class="fas fa-spinner fa-spin text-4xl"></i></div>`;

        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) throw new Error("المستخدم غير موجود");

            const viewedUserData = { uid: userDoc.id, ...userDoc.data() } as UserData;
            const isSelf = App.state.userData?.uid === userId;
            const isAdmin = App.state.userData?.role === 'admin';

            this.renderProfileLayout(profileView, viewedUserData, isSelf, isAdmin);
            this.bindProfileEvents(profileView, viewedUserData, isSelf, isAdmin);
            
            // Load initial tab content
            this.renderOverviewTab(profileView, viewedUserData);

        } catch (error: any) {
            App.functions.ui.showToast(error.message, 'error');
            App.functions.ui.closeFullscreenView();
        }
    },
    
    renderProfileLayout(container: HTMLElement, userData: UserData, isSelf: boolean, isAdmin: boolean) {
        const xpForNextLevel = 100 + (userData.level - 1) * 150;
        const xpPercentage = Math.min(100, (userData.xp / xpForNextLevel) * 100);

        // Determine which tabs to show based on whether it's the user's own profile or a visitor
        let tabsHtml = `
            <button class="profile-tab-btn active" data-tab="overview"><i class="fas fa-chart-pie mr-2"></i>نظرة عامة</button>
            <button class="profile-tab-btn" data-tab="achievements"><i class="fas fa-trophy mr-2"></i>الإنجازات</button>
        `;

        if (isSelf) {
            tabsHtml += `
                <button class="profile-tab-btn" data-tab="quiz-stats"><i class="fas fa-brain mr-2"></i>إحصائيات الكويز</button>
                <button class="profile-tab-btn" data-tab="history"><i class="fas fa-history mr-2"></i>السجل</button>
                <button class="profile-tab-btn" data-tab="friends">
                    <i class="fas fa-users mr-2"></i>الأصدقاء 
                    <span id="profile-friend-requests-count" class="friend-request-badge hidden">0</span>
                </button>
            `;
        }

        container.innerHTML = `
            <div class="relative w-full text-primary">
                <!-- Header -->
                <header class="relative">
                    <div id="profile-banner" class="h-48 md:h-64 bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1470&q=80')">
                        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
                    </div>
                    
                    <!-- Clean Top Actions -->
                    <div class="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
                        <button class="close-fullscreen-btn text-3xl text-white text-shadow hover:text-red-400 transition-colors">&times;</button>
                        <div id="profile-header-actions" class="flex gap-2"></div>
                    </div>

                    <div class="absolute -bottom-16 right-0 left-0 px-4 sm:px-8">
                        <div class="flex items-end gap-4">
                            <div class="relative -mt-16">
                               <button id="profile-avatar-wrapper" class="relative group" ${!isSelf ? 'disabled' : ''}>
                                    <img id="profile-view-avatar" src="${userData.avatar}" class="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-gray-800 object-cover shadow-2xl transition-transform group-hover:scale-105">
                                    ${isSelf ? `
                                    <div class="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <i class="fas fa-camera text-3xl text-white"></i>
                                    </div>` : ''}
                               </button>
                               <input type="file" id="avatar-upload-input" class="hidden" accept="image/*">
                            </div>
                            <div class="mb-2 flex-grow">
                                 <div class="flex items-center gap-2">
                                     <h2 id="profile-view-username" class="text-3xl md:text-4xl font-black text-shadow tracking-wide">${userData.username}</h2>
                                     ${isSelf ? '<button id="edit-username-btn" class="text-gray-400 hover:text-white transition-colors"><i class="fas fa-pencil-alt"></i></button>' : ''}
                                 </div>
                                 <div class="flex items-center gap-3 mt-1">
                                     <span class="bg-gray-800/80 px-2 py-1 rounded text-xs font-mono text-gray-300 border border-gray-700">ID: ${userData.shortId}</span>
                                     <button id="copy-user-id-btn" class="text-gray-400 hover:text-white transition-colors" title="نسخ ID"><i class="fas fa-copy"></i></button>
                                 </div>
                            </div>
                        </div>
                    </div>
                </header>

                <!-- Main Content -->
                <main class="pt-24 px-4 sm:px-8 pb-12 max-w-5xl mx-auto">
                    <!-- Professional XP Bar (Visually Enhanced) -->
                    <div class="mb-10 bg-gray-800/50 p-4 rounded-2xl border border-gray-700 shadow-lg backdrop-blur-sm">
                        <div class="flex justify-between items-end mb-3">
                            <div class="flex items-center gap-2">
                                <div class="bg-yellow-500 text-black font-black px-3 py-1 rounded-lg text-xl shadow-lg">
                                    LVL ${userData.level}
                                </div>
                                <span class="text-gray-300 font-bold text-sm uppercase tracking-widest">المستوى الحالي</span>
                            </div>
                            <div class="text-right">
                                <span class="font-black text-2xl text-white tracking-tight">${userData.xp}</span>
                                <span class="text-gray-400 font-bold mx-1">/</span>
                                <span class="font-bold text-lg text-gray-400">${xpForNextLevel} XP</span>
                            </div>
                        </div>
                        <div class="xp-bar-container h-5 w-full bg-gray-900 rounded-full relative overflow-hidden border-2 border-gray-700/50 shadow-inner">
                            <div class="xp-bar-fill absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-300 rounded-full shadow-[0_0_15px_rgba(253,224,71,0.5)]" style="width: ${xpPercentage}%;">
                                <div class="xp-bar-glare absolute top-0 left-0 w-full h-1/2 bg-white/30 rounded-t-full"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Modern Tabs -->
                    <div id="profile-tabs" class="profile-tabs-container">
                        ${tabsHtml}
                    </div>

                    <!-- Tab Content -->
                    <div id="profile-tab-content" class="min-h-[400px] animate-fade-in">
                        <!-- Content will be injected here -->
                    </div>
                </main>
            </div>
        `;
    },

    bindProfileEvents(container: HTMLElement, userData: UserData, isSelf: boolean, isAdmin: boolean) {
        // Tab switching logic
        container.querySelector('#profile-tabs')?.addEventListener('click', e => {
            const target = (e.target as HTMLElement).closest('.profile-tab-btn');
            if (target) {
                container.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                const tab = (target as HTMLElement).dataset.tab;
                switch (tab) {
                    case 'overview': this.renderOverviewTab(container, userData); break;
                    case 'quiz-stats': this.renderQuizStatsTab(container, userData); break;
                    case 'achievements': this.renderAchievementsTab(container, userData); break;
                    case 'history': this.renderMatchHistoryTab(container, userData.uid); break;
                    case 'friends': this.renderFriendsTab(container, userData, isSelf); break;
                }
            }
        });

        // Header actions
        const actionsContainer = container.querySelector('#profile-header-actions') as HTMLElement;
        if (isSelf) {
            actionsContainer.innerHTML = `
                <button id="profile-support-btn" class="admin-btn admin-btn-sm bg-orange-500 hover:bg-orange-600 text-white font-bold">الدعم</button>
                <button id="profile-logout-btn" class="admin-btn admin-btn-sm admin-btn-danger font-bold">خروج</button>
            `;
            
            container.querySelector('#profile-logout-btn')?.addEventListener('click', () => {
                App.functions.ui.showConfirmationModal(
                    'تسجيل الخروج',
                    'هل أنت متأكد أنك تريد تسجيل الخروج؟',
                    () => App.functions.auth.logout()
                );
            });
            container.querySelector('#profile-support-btn')?.addEventListener('click', () => this.showSupportModal());
            
            // Edit username
            container.querySelector('#edit-username-btn')?.addEventListener('click', () => this.toggleUsernameEdit(true));
            
            // Avatar Action Menu
            const avatarWrapper = container.querySelector('#profile-avatar-wrapper') as HTMLElement;
            avatarWrapper?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAvatarActionMenu(avatarWrapper, userData.uid);
            });
            
            container.querySelector('#avatar-upload-input')?.addEventListener('change', (e) => this.handleAvatarUpload(e, userData.uid));

        } else {
            this.renderVisitorActions(actionsContainer, userData);
        }

        // Copy ID
        container.querySelector('#copy-user-id-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(userData.shortId);
            App.functions.ui.showToast('تم نسخ ID المستخدم بنجاح!', 'success');
        });
    },

    showAvatarActionMenu(wrapper: HTMLElement, userId: string) {
        // Remove existing menus
        document.querySelectorAll('.avatar-action-menu').forEach(el => el.remove());

        const menu = document.createElement('div');
        menu.className = 'avatar-action-menu';
        menu.innerHTML = `
            <button class="avatar-action-btn" id="view-avatar-btn"><i class="fas fa-eye ml-2"></i>عرض الصورة</button>
            <button class="avatar-action-btn" id="change-avatar-btn"><i class="fas fa-camera ml-2"></i>تغيير الصورة</button>
            <button class="avatar-action-btn text-red-400" id="remove-avatar-btn"><i class="fas fa-trash ml-2"></i>حذف الصورة</button>
        `;

        document.body.appendChild(menu);

        // Position menu
        const rect = wrapper.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 10}px`;
        menu.style.left = `${rect.left + (rect.width/2) - 75}px`;

        // Event Listeners
        menu.querySelector('#view-avatar-btn')?.addEventListener('click', () => {
             const img = (document.getElementById('profile-view-avatar') as HTMLImageElement).src;
             App.functions.ui.openGenericModal('صورة الملف الشخصي', `<img src="${img}" class="w-full max-h-[70vh] object-contain rounded-lg">`);
             menu.remove();
        });

        menu.querySelector('#change-avatar-btn')?.addEventListener('click', () => {
            (document.getElementById('avatar-upload-input') as HTMLInputElement).click();
            menu.remove();
        });

        menu.querySelector('#remove-avatar-btn')?.addEventListener('click', () => {
            App.functions.ui.showConfirmationModal('حذف الصورة', 'هل أنت متأكد من حذف الصورة والعودة للصورة الافتراضية؟', async () => {
                 const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cccccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                 await db.collection('users').doc(userId).update({ avatar: defaultAvatar });
                 (document.getElementById('profile-view-avatar') as HTMLImageElement).src = defaultAvatar;
                 App.functions.ui.showToast('تم حذف الصورة', 'success');
            });
            menu.remove();
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target as Node)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);
    },

    renderOverviewTab(container: HTMLElement, userData: UserData) {
        const contentEl = container.querySelector('#profile-tab-content') as HTMLElement;
        contentEl.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Stats -->
                <div id="profile-overview-stats">
                    <h3 class="text-xl font-bold mb-4">الإحصائيات العامة</h3>
                    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 text-center">
                        <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">النقاط</p><p class="text-2xl font-bold text-accent">${userData.points.toLocaleString()}</p></div>
                        <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">مرات الشحن</p><p class="text-2xl font-bold">${userData.topups}</p></div>
                        <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">مرات الفوز</p><p class="text-2xl font-bold">${userData.quizWins}</p></div>
                        <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">مرات اللعب</p><p class="text-2xl font-bold">${userData.quizzesPlayed}</p></div>
                        <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">الإعلانات</p><p class="text-2xl font-bold">${userData.adsWatched}</p></div>
                        <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">الانضمام</p><p class="text-base font-bold">${App.functions.helpers.formatDate(userData.createdAt).split(',')[0]}</p></div>
                    </div>
                </div>
                <!-- Recent Activity -->
                <div id="profile-overview-activity">
                     <h3 class="text-xl font-bold mb-4">آخر الأنشطة</h3>
                     <div class="space-y-3"><div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i></div></div>
                </div>
            </div>
        `;
        this.renderActivityFeed(container, userData.uid);
    },

    async renderActivityFeed(container: HTMLElement, userId: string) {
        const activityContainer = container.querySelector('#profile-overview-activity .space-y-3') as HTMLElement;
        
        const getSafeMillis = (timestamp: any) => {
            return (timestamp && typeof timestamp.toMillis === 'function') ? timestamp.toMillis() : 0;
        };

        const achievements = App.state.userData?.uid === userId ? App.state.userData.achievements : (await db.collection('users').doc(userId).get()).data()?.achievements;
        
        const recentAchievements = Object.entries(achievements || {})
            .map(([id, data]: [string, any]) => ({...data, id, type: 'achievement'}))
            .sort((a,b) => getSafeMillis(b.date) - getSafeMillis(a.date))
            .slice(0, 5);

        // Fetch recent wins
        let recentWins: any[] = [];
        try {
            const recentWinsSnap = await db.collection('quizHistory')
                .where('winnerId', '==', userId)
                .limit(10)
                .get();
                
            recentWins = recentWinsSnap.docs.map((doc: any) => {
                const data = doc.data();
                return {
                    type: 'win',
                    text: `فاز في لعبة ${data.gameName}`,
                    date: data.endedAt,
                    icon: 'fa-trophy'
                }
            });
        } catch(e) {
            console.warn("Could not fetch recent wins history", e);
        }
        
        const allActivities = [...recentAchievements, ...recentWins]
            .sort((a,b) => getSafeMillis(b.date) - getSafeMillis(a.date))
            .slice(0, 5);

        if (allActivities.length === 0) {
            activityContainer.innerHTML = '<p class="text-center text-gray-400">لا توجد أنشطة حديثة.</p>';
            return;
        }

        activityContainer.innerHTML = allActivities.map(item => {
            const itemIcon = item.type === 'achievement' ? App.functions.achievements.getAchievements().find((a: any) => a.id === item.id)?.icon : item.icon;
            const itemText = item.type === 'achievement' ? `فتح إنجاز: ${item.name}` : item.text;
            return `
                <div class="flex items-center gap-4 p-2 bg-white/5 rounded-lg">
                    <i class="fas ${itemIcon} text-accent fa-lg"></i>
                    <div>
                        <p class="font-semibold">${itemText}</p>
                        <p class="text-xs text-gray-400">${App.functions.helpers.formatDate(item.date)}</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderQuizStatsTab(container: HTMLElement, userData: UserData) {
        const contentEl = container.querySelector('#profile-tab-content') as HTMLElement;
        const stats = userData.quizStats || { totalScore: 0, correctAnswers: 0, incorrectAnswers: 0, averageSpeed: 0 };
        const totalAnswers = stats.correctAnswers + stats.incorrectAnswers;
        const accuracy = totalAnswers > 0 ? ((stats.correctAnswers / totalAnswers) * 100).toFixed(1) : '0';
        const avgSpeed = stats.averageSpeed > 0 ? (stats.averageSpeed / 1000).toFixed(2) : '0';

        contentEl.innerHTML = `
            <div class="text-center mb-6">
                <i class="fas ${TIER_ICONS[userData.quizTier]} fa-4x mb-2"></i>
                <p class="text-2xl font-bold">${TIER_NAMES[userData.quizTier]} ${userData.quizPrestige > 0 ? `+${userData.quizPrestige}` : ''}</p>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">إجمالي النقاط</p><p class="text-xl font-bold">${stats.totalScore.toLocaleString()}</p></div>
                <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">نسبة الفوز</p><p class="text-xl font-bold">${userData.quizzesPlayed > 0 ? ((userData.quizWins / userData.quizzesPlayed) * 100).toFixed(1) : '0'}%</p></div>
                <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">دقة الإجابة</p><p class="text-xl font-bold">${accuracy}%</p></div>
                <div class="glass-card p-4 rounded-lg"><p class="text-sm text-secondary">متوسط السرعة</p><p class="text-xl font-bold">${avgSpeed} ثانية</p></div>
            </div>
        `;
    },

    async renderMatchHistoryTab(container: HTMLElement, userId: string) {
        const contentEl = container.querySelector('#profile-tab-content') as HTMLElement;
        contentEl.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin text-2xl"></i></div>`;
        try {
            const snap = await db.collection('quizHistory')
                .where('players', 'array-contains', userId)
                .limit(20) 
                .get();

            if (snap.empty) {
                contentEl.innerHTML = '<p class="text-center text-gray-400">لا يوجد سجل مباريات لعرضه.</p>';
                return;
            }
            
            let matches = snap.docs.map((doc: any) => doc.data());
            
            matches.sort((a: any, b: any) => {
                 const timeA = a.endedAt && typeof a.endedAt.toMillis === 'function' ? a.endedAt.toMillis() : 0;
                 const timeB = b.endedAt && typeof b.endedAt.toMillis === 'function' ? b.endedAt.toMillis() : 0;
                 return timeB - timeA;
            });

            contentEl.innerHTML = `
                <div class="space-y-3">
                ${matches.map((data: any) => {
                    const player = data.playerDetails ? data.playerDetails[userId] : null;
                    if (!player) return '';
                    const isWinner = data.winnerId === userId;
                    return `<div class="glass-card p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="font-bold">لعبة ${data.gameName} - وضع ${data.mode}</p>
                            <p class="text-xs text-gray-400">${App.functions.helpers.formatDate(data.endedAt)}</p>
                        </div>
                        <div class="text-left">
                            <p class="font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}">${player.score.toLocaleString()} نقطة</p>
                            <p class="text-xs text-gray-400">الترتيب: ${player.rank}</p>
                        </div>
                    </div>`;
                }).join('')}
                </div>
            `;
        } catch (e) {
            console.error("Error loading match history:", e);
            contentEl.innerHTML = '<p class="text-center text-red-500">فشل تحميل سجل المباريات.</p>';
        }
    },

    renderAchievementsTab(container: HTMLElement, userData: UserData) {
        const contentEl = container.querySelector('#profile-tab-content') as HTMLElement;
        const userAchievements = userData.achievements || {};
        const ALL_ACHIEVEMENTS = App.functions.achievements.getAchievements();
        const unlockedCount = Object.keys(userAchievements).length;
        const totalCount = ALL_ACHIEVEMENTS.length;
        const percentage = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;
    
        if (totalCount === 0) {
            contentEl.innerHTML = '<p class="text-center text-gray-400">لا توجد إنجازات متاحة حالياً.</p>';
            return;
        }
    
        contentEl.innerHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-1"><span class="font-bold text-sm text-secondary">التقدم</span><span class="font-bold text-sm text-accent">${unlockedCount} / ${totalCount}</span></div>
                <div class="w-full bg-gray-700 rounded-full h-2.5"><div class="bg-yellow-400 h-2.5 rounded-full" style="width: ${percentage}%"></div></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${ALL_ACHIEVEMENTS.map((ach: any) => {
                const unlocked = userAchievements[ach.id];
                const tierColors: { [key: string]: string } = { bronze: 'text-[#cd7f32]', silver: 'text-[#c0c0c0]', gold: 'text-[#ffd700]', diamond: 'text-[#b9f2ff]' };
                const hoverIconClass = unlocked ? 'group-hover:scale-110 group-hover:rotate-6' : '';
                return `
                    <div class="achievement-item ${unlocked ? `unlocked achievement-${ach.tier}` : 'locked'} group">
                        <div class="achievement-icon-wrapper"><i class="fas ${unlocked ? ach.icon : 'fa-lock'} fa-2x ${unlocked ? tierColors[ach.tier] : ''} transition-transform duration-300 ${hoverIconClass}"></i></div>
                        <div class="flex-grow">
                            <p class="font-bold">${ach.name}</p>
                            <p class="text-xs text-secondary">${ach.description}</p>
                            ${unlocked ? `<p class="text-xs text-yellow-400 mt-1">تم الفتح: ${App.functions.helpers.formatDate(unlocked.date)}</p>` : ''}
                        </div>
                    </div>`;
            }).join('')}
            </div>
        `;
    },

    renderFriendsTab(container: HTMLElement, userData: UserData, isSelf: boolean) {
        const contentEl = container.querySelector('#profile-tab-content') as HTMLElement;
        App.functions.friends.init(contentEl, userData, isSelf);
    },
    
    toggleUsernameEdit(isEditing: boolean) {
        const usernameEl = document.getElementById('profile-view-username') as HTMLElement;
        if (isEditing) {
            const currentUsername = usernameEl.textContent;
            usernameEl.innerHTML = `<input id="username-edit-input" type="text" class="bg-gray-700 text-2xl font-bold w-full p-2 rounded" value="${currentUsername}">`;
            document.getElementById('edit-username-btn')!.innerHTML = '<i class="fas fa-check text-green-400"></i>';
            document.getElementById('edit-username-btn')!.onclick = () => this.toggleUsernameEdit(false);
        } else {
            const input = document.getElementById('username-edit-input') as HTMLInputElement;
            const newUsername = input.value.trim();
            this.saveUsername(newUsername);
        }
    },

    async saveUsername(newUsername: string) {
        const user = App.state.userData;
        if (!user) return;
        try {
            if (newUsername.length < 3 || newUsername.length > 15) throw new Error("اسم المستخدم يجب أن يكون بين 3 و 15 حرفًا.");
            await db.collection('users').doc(user.uid).update({ username: newUsername });
            App.functions.ui.showToast("تم حفظ الاسم بنجاح!", "success");
            (document.getElementById('profile-view-username') as HTMLElement).textContent = newUsername;
            document.getElementById('edit-username-btn')!.innerHTML = '<i class="fas fa-pencil-alt"></i>';
            document.getElementById('edit-username-btn')!.onclick = () => this.toggleUsernameEdit(true);
        } catch (e: any) {
            App.functions.ui.showToast(e.message, "error");
            (document.getElementById('profile-view-username') as HTMLElement).textContent = user.username; // Revert
        }
    },

    async handleAvatarUpload(event: Event, userId: string) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        App.functions.ui.showToast("جاري رفع الصورة...", "info");
        try {
            const compressedFile = await App.functions.helpers.compressImage(file, { maxWidth: 256, maxHeight: 256, quality: 0.8 });
            const avatarUrl = await App.functions.helpers.uploadFile(compressedFile, `avatars/${userId}`);
            await db.collection('users').doc(userId).update({ avatar: avatarUrl });
            
            // Force refresh of image by appending timestamp to bypass cache
            const imgEl = document.getElementById('profile-view-avatar') as HTMLImageElement;
            if (imgEl) imgEl.src = `${avatarUrl}?t=${Date.now()}`;
            
            App.functions.ui.showToast("تم تحديث الصورة بنجاح!", "success");
        } catch (error) {
            App.functions.ui.showToast("فشل رفع الصورة.", "error");
        }
    },
    
    async renderVisitorActions(container: HTMLElement, viewedUserData: UserData) {
        // Fetch fresh current user data to ensure friend status is up-to-date
        const currentUserSnap = await db.collection('users').doc(App.state.userData!.uid).get();
        const currentUser = currentUserSnap.data() as UserData;
        if (!currentUser || currentUser.uid === viewedUserData.uid) return;

        const isFriend = (currentUser.friends || []).includes(viewedUserData.uid);
        const requestSent = (currentUser.friendRequests?.outgoing || []).some(req => req.fromId === viewedUserData.uid);
        const requestReceived = (currentUser.friendRequests?.incoming || []).some(req => req.fromId === viewedUserData.uid);
        
        let actionsHTML = '';
        if (isFriend) {
            actionsHTML = `
                <button id="challenge-friend-btn" class="admin-btn admin-btn-sm admin-btn-warning font-bold">⚔️ تحدي</button>
                <button id="remove-friend-btn" class="admin-btn admin-btn-sm admin-btn-danger"><i class="fas fa-user-times mr-2"></i>إزالة</button>
            `;
        } else if (requestSent) {
            actionsHTML = `<button class="admin-btn admin-btn-sm admin-btn-secondary" disabled>تم الإرسال</button>`;
        } else if (requestReceived) {
            actionsHTML = `<button id="accept-friend-btn" class="admin-btn admin-btn-sm admin-btn-success">قبول</button><button id="decline-friend-btn" class="admin-btn admin-btn-sm admin-btn-danger">رفض</button>`;
        } else {
            actionsHTML = `<button id="add-friend-btn" class="admin-btn admin-btn-sm admin-btn-primary"><i class="fas fa-user-plus mr-2"></i>إضافة صديق</button>`;
        }
        container.innerHTML = actionsHTML;
        
        container.querySelector('#add-friend-btn')?.addEventListener('click', async () => {
            await this.friends.sendFriendRequest(viewedUserData);
            this.renderVisitorActions(container, viewedUserData); 
        });
        container.querySelector('#remove-friend-btn')?.addEventListener('click', async () => {
            await this.friends.removeFriend(viewedUserData.uid);
            this.renderVisitorActions(container, viewedUserData);
        });
        container.querySelector('#accept-friend-btn')?.addEventListener('click', async () => {
            await this.friends.acceptFriendRequest(viewedUserData);
            this.renderVisitorActions(container, viewedUserData);
        });
        container.querySelector('#decline-friend-btn')?.addEventListener('click', async () => {
            const request = (currentUser.friendRequests?.incoming || []).find(req => req.fromId === viewedUserData.uid);
            if(request) await this.friends.declineFriendRequest(request);
            this.renderVisitorActions(container, viewedUserData);
        });
        
        // Handle Challenge Button Click
        container.querySelector('#challenge-friend-btn')?.addEventListener('click', () => {
            App.functions.ui.closeFullscreenView();
            App.functions.quiz.showCreateRoomModal({ challengeTarget: viewedUserData });
        });
    },

    showSupportModal() {
        const modalContent = `
            <form id="support-ticket-form" class="space-y-4">
                <p class="text-sm text-gray-400">صف مشكلتك بالتفصيل. سيقوم فريق الدعم بمراجعتها والرد عليك في الإشعارات في أقرب وقت ممكن.</p>
                <div><label for="support-problem-description" class="block font-semibold mb-1">وصف المشكلة</label><textarea name="problem" id="support-problem-description" class="admin-textarea" rows="5" required></textarea></div>
                <div class="flex justify-end"><button type="submit" class="admin-btn admin-btn-primary"><span class="btn-text">إرسال التذكرة</span><i class="fas fa-spinner fa-spin hidden"></i></button></div>
            </form>`;
        App.functions.ui.openGenericModal('الدعم الفني', modalContent, (modal) => {
            const form = modal.querySelector('#support-ticket-form') as HTMLFormElement;
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                App.functions.helpers.toggleButtonLoading(button, true);
                try {
                    const user = App.state.userData;
                    if (!user) throw new Error("يجب أن تكون مسجلاً للدخول.");
                    const problemDescription = (form.elements.namedItem('problem') as HTMLTextAreaElement).value.trim();
                    if (problemDescription.length < 10) throw new Error("الرجاء وصف المشكلة بشكل أكثر تفصيلاً.");
                    await db.collection('supportTickets').add({
                        uid: user.uid, username: user.username, shortId: user.shortId,
                        description: problemDescription, status: 'open',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    App.functions.ui.showToast("تم إرسال تذكرتك بنجاح!", "success");
                    App.functions.ui.closeGenericModal();
                } catch (error: any) {
                    App.functions.ui.showToast(error.message, "error");
                } finally {
                    App.functions.helpers.toggleButtonLoading(button, false);
                }
            });
        });
    },
};
