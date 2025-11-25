import { db, firebase } from '../firebase';
import { App } from '../../app';
import { sidebarConfig } from './config';
import * as renderers from './renderers';

function bindContentEvents(sectionId: string, container: HTMLElement) {
    const user = App.state.userData;
    if (!user) return;

    if (sectionId === 'newsManagement') {
        const form = container.querySelector('#news-form') as HTMLFormElement;
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = (form.elements.namedItem('news-title') as HTMLInputElement).value;
            const content = (form.elements.namedItem('news-content') as HTMLTextAreaElement).value;
            const newsId = (form.elements.namedItem('news-id') as HTMLInputElement).value;

            try {
                if (newsId) {
                    await db.collection('news').doc(newsId).update({ title, content });
                    App.functions.ui.showToast('تم تحديث الخبر بنجاح', 'success');
                } else {
                    await db.collection('news').add({ title, content, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                    App.functions.ui.showToast('تم نشر الخبر بنجاح', 'success');
                }
                App.functions.ui.closeGenericModal();
                adminFunctions.renderContent('newsManagement');
            } catch (error) {
                App.functions.ui.showToast('فشل حفظ الخبر', 'error');
            }
        });

        container.addEventListener('click', e => {
            const target = (e.target as HTMLElement);
            const deleteBtn = target.closest('.delete-news-btn');
            if (deleteBtn) {
                const newsId = deleteBtn.getAttribute('data-news-id')!;
                App.functions.ui.showConfirmationModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الخبر؟', async () => {
                    await db.collection('news').doc(newsId).delete();
                    App.functions.ui.showToast('تم حذف الخبر', 'success');
                    adminFunctions.renderContent('newsManagement');
                });
            }
        });
    }

    if (sectionId === 'broadcastMessage') {
        const form = container.querySelector('#broadcast-form') as HTMLFormElement;
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = (form.elements.namedItem('broadcast-message') as HTMLInputElement).value;
            const active = (form.elements.namedItem('broadcast-active') as HTMLInputElement).checked;
            await db.collection('settings').doc('broadcast').set({ message, active });
            App.functions.ui.showToast('تم تحديث الرسالة الجماعية', 'success');
        });
    }

    if (sectionId === 'promoCodes') {
        const form = container.querySelector('#promocode-form') as HTMLFormElement;
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = (form.elements.namedItem('promo-code') as HTMLInputElement).value.toUpperCase();
            const points = parseInt((form.elements.namedItem('promo-points') as HTMLInputElement).value, 10);
            const uses = parseInt((form.elements.namedItem('promo-uses') as HTMLInputElement).value, 10);
            const xp = parseInt((form.elements.namedItem('promo-xp') as HTMLInputElement).value, 10) || 0;
            
            try {
                await db.collection('promoCodes').doc(code).set({ points, xp, usesLeft: uses, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                App.functions.ui.showToast(`تم إنشاء الكود ${code} بنجاح`, 'success');
                form.reset();
                adminFunctions.renderContent('promoCodes');
            } catch (error) {
                App.functions.ui.showToast('فشل إنشاء الكود', 'error');
            }
        });
    }
    
    if (sectionId === 'users' || sectionId === 'bannedUsers') {
        container.addEventListener('click', e => {
            const target = (e.target as HTMLElement);
            const banBtn = target.closest('.ban-user-btn');
            const unbanBtn = target.closest('.unban-user-btn');

            const handleBan = async (uid: string, shouldBan: boolean) => {
                const actionText = shouldBan ? 'حظر' : 'إلغاء حظر';
                App.functions.ui.showConfirmationModal(`تأكيد ${actionText}`, `هل أنت متأكد من ${actionText} هذا المستخدم؟`, async () => {
                    await db.collection('users').doc(uid).update({ banned: shouldBan });
                    App.functions.ui.showToast(`تم ${actionText} المستخدم بنجاح`, 'success');
                    adminFunctions.renderContent(sectionId); // Refresh current view
                });
            };

            if (banBtn) handleBan(banBtn.getAttribute('data-uid')!, true);
            if (unbanBtn) handleBan(unbanBtn.getAttribute('data-uid')!, false);
        });
    }
}


export const adminFunctions = {
    init() {
        if (App.state.adminInitialized) return;
        this.buildSidebar();
        this.bindEvents();
        this.renderContent('dashboard');
        this.setupLiveCounters();
        App.state.adminInitialized = true;
    },

    bindEvents() {
        App.DOM.adminSidebarNav.addEventListener('click', (e) => {
            const button = (e.target as HTMLElement).closest('.admin-sidebar-btn') as HTMLElement;
            if (button?.dataset.sectionId) {
                this.renderContent(button.dataset.sectionId);
                App.DOM.adminSidebar.classList.remove('is-open');
                App.DOM.adminSidebarOverlay.classList.add('hidden');
            }
        });
        App.DOM.adminSidebarOpenBtn.addEventListener('click', () => {
            App.DOM.adminSidebar.classList.add('is-open');
            App.DOM.adminSidebarOverlay.classList.remove('hidden');
        });
        const closeSidebar = () => {
            App.DOM.adminSidebar.classList.remove('is-open');
            App.DOM.adminSidebarOverlay.classList.add('hidden');
        };
        App.DOM.adminSidebarCloseBtn.addEventListener('click', closeSidebar);
        App.DOM.adminSidebarOverlay.addEventListener('click', closeSidebar);
    },

    buildSidebar() {
        const userRole = App.state.userData?.role;
        if (!userRole) return;
        App.DOM.adminSidebarNav.innerHTML = sidebarConfig.map(group => {
            if (userRole === 'moderator' && !['الإدارة الأساسية', 'الإشراف والأمان'].includes(group.title)) return '';
            const modTools = ['pendingOrders', 'completedOrders', 'users', 'bannedUsers', 'userReports', 'supportTickets', 'globalChatMonitoring'];
            const items = group.items.filter(item => userRole === 'admin' || modTools.includes(item.id));
            if (items.length === 0) return '';
            return `<div class="mt-4 pt-4 border-t border-[var(--admin-border)] first:mt-0 first:pt-0 first:border-none">
                <h3 class="px-4 mb-2 text-xs font-semibold uppercase text-[var(--admin-text-secondary)]">${group.title}</h3>
                ${items.map(item => `<button class="admin-sidebar-btn" data-section-id="${item.id}"><i class="fas ${item.icon}"></i><span class="flex-grow text-right">${item.text}</span>${item.counter ? `<span id="counter-${item.id}" class="live-counter bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center hidden">0</span>` : ''}</button>`).join('')}
            </div>`;
        }).join('');
    },
    
    renderContent(sectionId: string) {
        const section = sidebarConfig.flatMap(g => g.items).find(i => i.id === sectionId);
        if (!section) return;

        document.querySelectorAll('#admin-sidebar-nav .admin-sidebar-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-section-id') === sectionId));
        App.DOM.adminMobileHeaderTitle.textContent = section.text;
        
        const contentArea = App.DOM.adminContent;
        contentArea.innerHTML = `<h1 class="admin-content-title text-2xl font-bold">${section.text}</h1><div id="admin-section-content" class="mt-6"></div>`;
        const sectionContentArea = contentArea.querySelector('#admin-section-content') as HTMLElement;
        
        const renderMap: { [key: string]: (container: HTMLElement) => void } = {
            dashboard: renderers.renderDashboard, 
            users: renderers.renderUsers, 
            pendingOrders: (c) => renderers.renderOrders(c, 'pending'),
            completedOrders: (c) => renderers.renderOrders(c, 'completed'), 
            gamesManagement: renderers.renderGames, 
            packagesManagement: renderers.renderPackages,
            newsManagement: renderers.renderNews, 
            broadcastMessage: renderers.renderBroadcast, 
            promoCodes: renderers.renderPromoCodes,
            bannedUsers: renderers.renderBannedUsers, 
            orderAssignment: renderers.renderOrderAssignment, 
            userReports: renderers.renderUserReports,
            supportTickets: renderers.renderSupportTickets, 
            financialHub: renderers.renderFinancialHub, 
            leaderboardPrizes: renderers.renderLeaderboardPrizes,
            analyticsDashboard: renderers.renderAnalyticsDashboard, 
            gameAnalytics: renderers.renderGameAnalytics, 
            userBehavior: renderers.renderUserBehavior,
            loadingScreenTips: renderers.renderLoadingScreenTips, 
            globalChatMonitoring: renderers.renderGlobalChatMonitoring,
            securityCenter: renderers.renderSecurityCenter, 
            adminRoles: renderers.renderAdminRoles, 
            adminAuditLog: renderers.renderAdminAuditLog,
            systemHealth: renderers.renderSystemHealth, 
            communityQuestions: renderers.renderCommunityQuestions,
            questionReports: renderers.renderQuestionReports, 
            aiControlCenter: renderers.renderAiControlCenter,
        };

        const renderer = renderMap[sectionId];
        if (renderer) {
            renderer(sectionContentArea);
            bindContentEvents(sectionId, sectionContentArea);
        } else {
            renderers.renderPlaceholder(sectionContentArea, section);
        }
    },

    setupLiveCounters() {
        const counters: {[key: string]: any} = {
            'pendingOrders': db.collection('orders').where('status', '==', 'pending'),
            'userReports': db.collection('userReports').where('status', '==', 'pending'),
            'supportTickets': db.collection('supportTickets').where('status', '==', 'open'),
            'questionReports': db.collection('questionReports').where('status', '==', 'pending'),
        };
        
        for (const id in counters) {
            const listener = counters[id].onSnapshot((snapshot: any) => {
                const el = document.getElementById(`counter-${id}`);
                if (el) {
                    el.textContent = snapshot.size.toString();
                    el.classList.toggle('hidden', snapshot.size === 0);
                }
            });
            App.state.listeners.push(listener);
        }
    },

    async logAdminAction(action: string, metadata: object = {}) {
        const adminUser = App.state.userData;
        if (!adminUser || !['admin', 'moderator'].includes(adminUser.role)) return;
        try {
            await db.collection('adminLog').add({
                adminId: adminUser.uid, adminUsername: adminUser.username, action,
                metadata, timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) { console.error("Failed to log admin action:", error); }
    },
};