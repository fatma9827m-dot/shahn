export const sidebarConfig = [
    { title: 'الإدارة الأساسية', items: [
        { id: 'dashboard', icon: 'fa-tachometer-alt', text: 'لوحة المعلومات' },
        { id: 'users', icon: 'fa-users', text: 'المستخدمون' },
        { id: 'bannedUsers', icon: 'fa-gavel', text: 'المحظورون' },
        { id: 'pendingOrders', icon: 'fa-hourglass-half', text: 'الطلبات المعلقة', counter: true },
        { id: 'completedOrders', icon: 'fa-check-circle', text: 'الطلبات المكتملة' },
        { id: 'orderAssignment', icon: 'fa-people-arrows', text: 'توزيع الطلبات' },
        { id: 'gamesManagement', icon: 'fa-gamepad', text: 'إدارة الألعاب' },
        { id: 'packagesManagement', icon: 'fa-box', text: 'إدارة الباقات' },
        { id: 'newsManagement', icon: 'fa-newspaper', text: 'إدارة الأخبار' },
        { id: 'broadcastMessage', icon: 'fa-bullhorn', text: 'رسالة جماعية' },
    ]},
    { title: 'الإدارة المالية والتسويق', items: [
        { id: 'financialHub', icon: 'fa-chart-pie', text: 'المركز المالي' },
        { id: 'promoCodes', icon: 'fa-gift', text: 'أكواد الهدايا' },
        { id: 'leaderboardPrizes', icon: 'fa-trophy', text: 'جوائز لوحة الصدارة' },
    ]},
    { title: 'التحليلات والبيانات', items: [
        { id: 'analyticsDashboard', icon: 'fa-chart-line', text: 'الإحصائيات والتحويلات' },
        { id: 'gameAnalytics', icon: 'fa-chart-bar', text: 'تحليل الألعاب' },
        { id: 'userBehavior', icon: 'fa-user-clock', text: 'سلوك المستخدم' },
    ]},
    { title: 'المجتمع والمحتوى', items: [
        { id: 'communityQuestions', icon: 'fa-users-cog', text: 'أسئلة المجتمع' },
        { id: 'loadingScreenTips', icon: 'fa-lightbulb', text: 'تلميحات التحميل' },
    ]},
    { title: 'الإشراف والأمان', items: [
        { id: 'userReports', icon: 'fa-user-slash', text: 'بلاغات المستخدمين', counter: true },
        { id: 'questionReports', icon: 'fa-question-circle', text: 'بلاغات الأسئلة', counter: true },
        { id: 'supportTickets', icon: 'fa-ticket-alt', text: 'تذاكر الدعم', counter: true },
        { id: 'globalChatMonitoring', icon: 'fa-comments', text: 'مراقبة الدردشة' },
        { id: 'securityCenter', icon: 'fa-shield-alt', text: 'مركز الأمان' },
    ]},
    { title: 'إعدادات النظام', items: [
        { id: 'aiControlCenter', icon: 'fa-brain', text: 'مركز تحكم الذكاء' },
        { id: 'adminRoles', icon: 'fa-user-cog', text: 'إدارة الصلاحيات' },
        { id: 'adminAuditLog', icon: 'fa-clipboard-list', text: 'سجل التدقيق' },
        { id: 'systemHealth', icon: 'fa-heartbeat', text: 'حالة النظام' },
    ]}
];
