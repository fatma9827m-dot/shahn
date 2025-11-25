import { db, firebase } from '../firebase';
import { App } from '../../app';
import { sidebarConfig } from './config';
import { UserData } from '../types';
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";


export function renderPlaceholder(container: HTMLElement, section: {icon: string, text: string}) {
    container.innerHTML = `<div class="bg-admin-bg-secondary p-8 rounded-lg border border-admin-border text-center"><i class="fas ${section.icon} fa-3x text-admin-text-secondary mb-4"></i><p class="text-admin-text-secondary">محتوى قسم <span class="font-bold text-white">${section.text}</span> قيد التطوير.</p></div>`;
}

export async function renderDashboard(container: HTMLElement) {
    container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="admin-stat-card"><h3 class="text-admin-text-secondary">إجمالي المستخدمين</h3><p id="dash-total-users" class="text-3xl font-bold"><i class="fas fa-spinner fa-spin"></i></p></div>
        <div class="admin-stat-card"><h3 class="text-admin-text-secondary">الطلبات المعلقة</h3><p id="dash-pending-orders" class="text-3xl font-bold"><i class="fas fa-spinner fa-spin"></i></p></div>
        <div class="admin-stat-card"><h3 class="text-admin-text-secondary">إجمالي النقاط المشتراة</h3><p id="dash-total-points" class="text-3xl font-bold"><i class="fas fa-spinner fa-spin"></i></p></div>
        <div class="admin-stat-card"><h3 class="text-admin-text-secondary">لاعبون جدد (24س)</h3><p id="dash-new-users" class="text-3xl font-bold"><i class="fas fa-spinner fa-spin"></i></p></div>
    </div>`;

    db.collection('users').get().then((snap: any) => { document.getElementById('dash-total-users')!.textContent = snap.size.toLocaleString(); });
    db.collection('orders').where('status', '==', 'pending').get().then((snap: any) => { document.getElementById('dash-pending-orders')!.textContent = snap.size.toLocaleString(); });
    db.collection('orders').where('status', '==', 'completed').get().then((snap: any) => {
        const totalPoints = snap.docs.reduce((sum: number, doc: any) => sum + doc.data().packagePoints, 0);
        document.getElementById('dash-total-points')!.textContent = totalPoints.toLocaleString();
    });
    const yesterday = firebase.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    db.collection('users').where('createdAt', '>=', yesterday).get().then((snap: any) => { document.getElementById('dash-new-users')!.textContent = snap.size.toLocaleString(); });
}


const findSection = (id: string) => sidebarConfig.flatMap(g => g.items).find(i => i.id === id)!;

export async function renderUsers(container: HTMLElement) {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">قائمة المستخدمين</h2>
            <div class="w-1/3">
                <input id="user-search-input" type="text" placeholder="ابحث بالاسم, ID, أو الإيميل..." class="admin-input">
            </div>
        </div>
        <div id="users-table-container" class="admin-table-wrapper">
            <div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
        </div>
    `;

    let allUsers: UserData[] = [];

    const renderTable = (users: UserData[]) => {
        const tableContainer = document.getElementById('users-table-container') as HTMLElement;
        if (users.length === 0) {
            tableContainer.innerHTML = `<p class="p-8 text-center text-admin-text-secondary">لا يوجد مستخدمون يطابقون البحث.</p>`;
            return;
        }
        tableContainer.innerHTML = `
            <table class="admin-table">
                <thead><tr><th>المستخدم</th><th>ID القصير</th><th>النقاط</th><th>المستوى</th><th>الإجراءات</th></tr></thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>
                                <div class="flex items-center gap-3">
                                    <img src="${u.avatar}" class="w-8 h-8 rounded-full object-cover">
                                    <div>
                                        <p class="font-semibold">${u.username}</p>
                                        <p class="text-xs text-admin-text-secondary">${u.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td><span class="font-mono">${u.shortId}</span></td>
                            <td>${u.points.toLocaleString()}</td>
                            <td>${u.level}</td>
                            <td>
                                <button class="admin-btn admin-btn-secondary admin-btn-sm view-profile-btn" data-user-id="${u.uid}">عرض</button>
                                ${!u.banned ? `<button class="admin-btn admin-btn-danger admin-btn-sm ban-user-btn" data-uid="${u.uid}">حظر</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };

    const userSearchInput = document.getElementById('user-search-input') as HTMLInputElement;

    const fetchAndRender = async () => {
        const snap = await db.collection('users').orderBy('createdAt', 'desc').get();
        allUsers = snap.docs.map((doc: any) => ({ uid: doc.id, ...doc.data() })) as UserData[];
        App.state.allUsersCache = allUsers; // Cache it
        renderTable(allUsers.filter(u => !u.banned));
    };

    userSearchInput.addEventListener('input', () => {
        const query = userSearchInput.value.toLowerCase().trim();
        const usersToRender = allUsers.filter(u => !u.banned);
        if (!query) {
            renderTable(usersToRender);
            return;
        }
        const filtered = usersToRender.filter(u => 
            u.username.toLowerCase().includes(query) ||
            (u.shortId && u.shortId.toLowerCase().includes(query)) ||
            u.email.toLowerCase().includes(query)
        );
        renderTable(filtered);
    });

    fetchAndRender();
}

export async function renderOrders(container: HTMLElement, status: 'pending' | 'completed') {
    container.innerHTML = `
        <div id="orders-table-container" class="admin-table-wrapper">
            <div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
        </div>
    `;
    const tableContainer = document.getElementById('orders-table-container') as HTMLElement;

    const renderTable = (orders: any[]) => {
        if (orders.length === 0) {
            tableContainer.innerHTML = `<p class="p-8 text-center text-admin-text-secondary">لا توجد طلبات حالياً.</p>`;
            return;
        }
        tableContainer.innerHTML = `
            <table class="admin-table">
                <thead><tr><th>المستخدم</th><th>اللعبة</th><th>الباقة</th><th>ID اللاعب</th><th>تاريخ الطلب</th><th>الإجراءات</th></tr></thead>
                <tbody>
                    ${orders.map(o => `
                        <tr>
                            <td>${o.username} (${o.userShortId})</td>
                            <td>${o.gameName}</td>
                            <td>${o.packageName}</td>
                            <td><code class="bg-admin-bg-primary p-1 rounded">${o.playerId}</code></td>
                            <td>${App.functions.helpers.formatDate(o.createdAt)}</td>
                            <td>
                                ${status === 'pending' ? `
                                    <button class="admin-btn admin-btn-success admin-btn-sm approve-order-btn" data-order-id="${o.id}">قبول</button>
                                    <button class="admin-btn admin-btn-danger admin-btn-sm reject-order-btn" data-order-id="${o.id}">رفض</button>
                                ` : `<span class="text-admin-success">مكتمل</span>`}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };
    
    const ordersSnap = await db.collection('orders').where('status', '==', status).orderBy('createdAt', 'desc').limit(50).get();
    const orders = ordersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    renderTable(orders);

    if (status === 'pending') {
        const handleOrderAction = async (orderId: string, action: 'completed' | 'rejected') => {
            const btn = document.querySelector(`button[data-order-id="${orderId}"]`) as HTMLButtonElement;
            btn.disabled = true;
            try {
                const orderRef = db.collection('orders').doc(orderId);
                const orderDoc = await orderRef.get();
                if (!orderDoc.exists) throw new Error("Order not found");
                
                await orderRef.update({ status: action });

                const orderData = orderDoc.data();
                const notificationTitle = action === 'completed' ? '✅ تم شحن طلبك بنجاح!' : '❌ تم رفض طلبك';
                const notificationBody = action === 'completed' 
                    ? `تم شحن باقة ${orderData.packageName} بنجاح. استمتع باللعب!`
                    : `تم رفض طلب ${orderData.packageName}. إذا كنت تعتقد أن هذا خطأ، تواصل مع الدعم.`;

                await db.collection('users').doc(orderData.userId).collection('notifications').add({
                    title: notificationTitle, body: notificationBody, read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                if (action === 'rejected') {
                     await App.functions.helpers.updateUserPoints(orderData.userId, orderData.username, orderData.packagePoints, `استرجاع نقاط طلب مرفوض: ${orderData.packageName}`);
                }

                App.functions.ui.showToast(`تم ${action === 'completed' ? 'قبول' : 'رفض'} الطلب بنجاح.`, 'success');
                renderOrders(container, 'pending'); // Re-render the view
            } catch (e: any) {
                App.functions.ui.showToast(`فشل الإجراء: ${e.message}`, 'error');
                btn.disabled = false;
            }
        };

        container.addEventListener('click', e => {
            const target = e.target as HTMLElement;
            const approveBtn = target.closest('.approve-order-btn') as HTMLElement;
            const rejectBtn = target.closest('.reject-order-btn') as HTMLElement;
            if (approveBtn) handleOrderAction(approveBtn.dataset.orderId!, 'completed');
            if (rejectBtn) handleOrderAction(rejectBtn.dataset.orderId!, 'rejected');
        });
    }
}


export async function renderNews(container: HTMLElement) {
    const showEditModal = (newsItem: any = null) => {
        const modalTitle = newsItem ? 'تعديل الخبر' : 'إضافة خبر جديد';
        const modalContent = `
            <form id="news-form" class="space-y-4">
                <input type="hidden" name="news-id" value="${newsItem?.id || ''}">
                <div>
                    <label for="news-title" class="block font-semibold mb-1">العنوان</label>
                    <input type="text" name="news-title" class="admin-input" value="${newsItem?.title || ''}" required>
                </div>
                <div>
                    <label for="news-content" class="block font-semibold mb-1">المحتوى (يدعم Markdown)</label>
                    <textarea name="news-content" class="admin-textarea" rows="6" required>${newsItem?.content || ''}</textarea>
                </div>
                <div class="flex justify-end gap-3">
                    <button type="button" class="admin-btn admin-btn-secondary close-modal-btn">إلغاء</button>
                    <button type="submit" class="admin-btn admin-btn-primary">حفظ</button>
                </div>
            </form>
        `;
        App.functions.ui.openGenericModal(modalTitle, modalContent);
    };

    container.innerHTML = `
        <div class="flex justify-end mb-4">
            <button id="add-news-btn" class="admin-btn admin-btn-primary"><i class="fas fa-plus mr-2"></i>إضافة خبر</button>
        </div>
        <div id="news-table-container" class="admin-table-wrapper"></div>
    `;

    document.getElementById('add-news-btn')?.addEventListener('click', () => showEditModal());

    const tableContainer = document.getElementById('news-table-container') as HTMLElement;
    tableContainer.innerHTML = `<div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-2xl"></i></div>`;
    
    const snap = await db.collection('news').orderBy('createdAt', 'desc').get();
    const news = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    
    if (news.length === 0) {
        tableContainer.innerHTML = `<p class="p-8 text-center text-admin-text-secondary">لا توجد أخبار حالياً.</p>`;
        return;
    }

    tableContainer.innerHTML = `
        <table class="admin-table">
            <thead><tr><th>العنوان</th><th>تاريخ النشر</th><th>الإجراءات</th></tr></thead>
            <tbody>
                ${news.map(n => `
                    <tr>
                        <td class="font-semibold">${n.title}</td>
                        <td>${App.functions.helpers.formatDate(n.createdAt)}</td>
                        <td>
                            <button class="admin-btn admin-btn-secondary admin-btn-sm edit-news-btn" data-news-item='${JSON.stringify(n)}'>تعديل</button>
                            <button class="admin-btn admin-btn-danger admin-btn-sm delete-news-btn" data-news-id="${n.id}">حذف</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.querySelectorAll('.edit-news-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newsItem = JSON.parse((e.currentTarget as HTMLElement).dataset.newsItem!);
            showEditModal(newsItem);
        });
    });
}

export async function renderBroadcast(container: HTMLElement) {
    const doc = await db.collection('settings').doc('broadcast').get();
    const data = doc.data() || { message: '', active: false };
    container.innerHTML = `
        <form id="broadcast-form" class="space-y-4 max-w-lg">
            <div>
                <label for="broadcast-message" class="block font-semibold mb-1">نص الرسالة</label>
                <input type="text" name="broadcast-message" class="admin-input" value="${data.message}">
            </div>
            <div class="flex items-center gap-4">
                <label for="broadcast-active" class="font-semibold">تفعيل الرسالة</label>
                <input type="checkbox" name="broadcast-active" class="toggle-checkbox" ${data.active ? 'checked' : ''}>
            </div>
            <div class="pt-2">
                <button type="submit" class="admin-btn admin-btn-primary">حفظ التغييرات</button>
            </div>
        </form>
    `;
}

export async function renderPromoCodes(container: HTMLElement) {
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-1">
                <h3 class="text-lg font-bold mb-2">إنشاء كود جديد</h3>
                <form id="promocode-form" class="space-y-3 p-4 bg-admin-bg-secondary rounded-lg">
                    <div><label class="text-sm">الكود (حروف كبيرة)</label><input name="promo-code" type="text" class="admin-input mt-1 uppercase"></div>
                    <div><label class="text-sm">قيمة النقاط</label><input name="promo-points" type="number" class="admin-input mt-1"></div>
                    <div><label class="text-sm">قيمة الخبرة (XP)</label><input name="promo-xp" type="number" class="admin-input mt-1" value="0"></div>
                    <div><label class="text-sm">عدد مرات الاستخدام</label><input name="promo-uses" type="number" class="admin-input mt-1"></div>
                    <button type="submit" class="admin-btn admin-btn-primary w-full">إنشاء</button>
                </form>
            </div>
            <div id="promocodes-table-container" class="lg:col-span-2 admin-table-wrapper"></div>
        </div>
    `;

    const tableContainer = document.getElementById('promocodes-table-container') as HTMLElement;
    tableContainer.innerHTML = `<div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-2xl"></i></div>`;

    const snap = await db.collection('promoCodes').orderBy('createdAt', 'desc').get();
    const codes = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    if (codes.length === 0) {
        tableContainer.innerHTML = `<p class="p-8 text-center text-admin-text-secondary">لا توجد أكواد حالياً.</p>`;
        return;
    }
    
    tableContainer.innerHTML = `
        <table class="admin-table">
            <thead><tr><th>الكود</th><th>النقاط</th><th>الخبرة</th><th>الاستخدامات المتبقية</th></tr></thead>
            <tbody>
                ${codes.map(c => `
                    <tr>
                        <td><code class="bg-admin-bg-primary p-1 rounded">${c.id}</code></td>
                        <td class="text-green-400 font-bold">${c.points.toLocaleString()}</td>
                        <td class="text-blue-400 font-bold">${(c.xp || 0).toLocaleString()}</td>
                        <td>${c.usesLeft}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export async function renderBannedUsers(container: HTMLElement) {
     container.innerHTML = `<div id="banned-users-table-container" class="admin-table-wrapper">
        <div class="p-8 text-center"><i class="fas fa-spinner fa-spin text-2xl"></i></div>
    </div>`;
    const tableContainer = document.getElementById('banned-users-table-container') as HTMLElement;

    const snap = await db.collection('users').where('banned', '==', true).get();
    const users = snap.docs.map((doc: any) => ({ uid: doc.id, ...doc.data() }));

    if (users.length === 0) {
        tableContainer.innerHTML = `<p class="p-8 text-center text-admin-text-secondary">لا يوجد مستخدمون محظورون.</p>`;
        return;
    }
    
    tableContainer.innerHTML = `
        <table class="admin-table">
            <thead><tr><th>المستخدم</th><th>الإيميل</th><th>الإجراءات</th></tr></thead>
            <tbody>
                ${users.map(u => `
                    <tr>
                        <td>
                            <div class="flex items-center gap-3">
                                <img src="${u.avatar}" class="w-8 h-8 rounded-full object-cover">
                                <span class="font-semibold">${u.username}</span>
                            </div>
                        </td>
                        <td>${u.email}</td>
                        <td>
                            <button class="admin-btn admin-btn-success admin-btn-sm unban-user-btn" data-uid="${u.uid}">إلغاء الحظر</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}


export function renderOrderAssignment(container: HTMLElement) { renderPlaceholder(container, findSection('orderAssignment')); }
export function renderUserReports(container: HTMLElement) { renderPlaceholder(container, findSection('userReports')); }
export function renderSupportTickets(container: HTMLElement) { renderPlaceholder(container, findSection('supportTickets')); }
export function renderFinancialHub(container: HTMLElement) { renderPlaceholder(container, findSection('financialHub')); }
export function renderLeaderboardPrizes(container: HTMLElement) { renderPlaceholder(container, findSection('leaderboardPrizes')); }
export function renderAnalyticsDashboard(container: HTMLElement) { renderPlaceholder(container, findSection('analyticsDashboard')); }
export function renderGameAnalytics(container: HTMLElement) { renderPlaceholder(container, findSection('gameAnalytics')); }
export function renderUserBehavior(container: HTMLElement) { renderPlaceholder(container, findSection('userBehavior')); }
export function renderLoadingScreenTips(container: HTMLElement) { renderPlaceholder(container, findSection('loadingScreenTips')); }
export function renderGlobalChatMonitoring(container: HTMLElement) { renderPlaceholder(container, findSection('globalChatMonitoring')); }
export function renderSecurityCenter(container: HTMLElement) { renderPlaceholder(container, findSection('securityCenter')); }
export function renderAdminRoles(container: HTMLElement) { renderPlaceholder(container, findSection('adminRoles')); }
export function renderAdminAuditLog(container: HTMLElement) { renderPlaceholder(container, findSection('adminAuditLog')); }
export function renderSystemHealth(container: HTMLElement) { renderPlaceholder(container, findSection('systemHealth')); }
export function renderCommunityQuestions(container: HTMLElement) { renderPlaceholder(container, findSection('communityQuestions')); }
export function renderQuestionReports(container: HTMLElement) { renderPlaceholder(container, findSection('questionReports')); }
export function renderAiControlCenter(container: HTMLElement) { renderPlaceholder(container, findSection('aiControlCenter')); }
export function renderGames(container: HTMLElement) { renderPlaceholder(container, findSection('gamesManagement')); }
export function renderPackages(container: HTMLElement) { renderPlaceholder(container, findSection('packagesManagement')); }