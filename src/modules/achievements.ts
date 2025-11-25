import { db, firebase } from '../firebase';
import { App } from '../../app';
import { QuizRoom, QuizPlayer } from '../types';

// Centralized Achievement Definitions
export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

const ALL_ACHIEVEMENTS: Achievement[] = [
    // Bronze (Easy)
    { id: 'first_topup', name: 'الشاحن المبتدئ', description: 'أكمل أول عملية شحن لك بنجاح', icon: 'fa-gem', tier: 'bronze' },
    { id: 'first_win', name: 'النصر الأول', description: 'اربح أول مباراة كويز لك', icon: 'fa-trophy', tier: 'bronze' },
    { id: 'played_10', name: 'لاعب نشيط', description: 'العب 10 مباريات كويز', icon: 'fa-gamepad', tier: 'bronze' },
    { id: 'watched_5_ads', name: 'مشاهد مبتدئ', description: 'شاهد 5 إعلانات لكسب النقاط', icon: 'fa-video', tier: 'bronze' },
    { id: 'add_first_friend', name: 'اجتماعي', description: 'أضف أول صديق لك', icon: 'fa-user-friends', tier: 'bronze' },
    { id: 'reach_level_10', name: 'خبير صاعد', description: 'الوصول إلى المستوى 10', icon: 'fa-star', tier: 'bronze' },
    { id: 'correct_50', name: 'بداية المعرفة', description: 'أجب على 50 سؤالاً بشكل صحيح', icon: 'fa-check-double', tier: 'bronze' },
    { id: 'submit_question', name: 'مُساهم', description: 'أرسل سؤالاً للمجتمع للمراجعة', icon: 'fa-file-alt', tier: 'bronze' },

    // Silver (Medium)
    { id: 'win_25', name: 'محترف الكويز', description: 'اربح 25 مباراة كويز', icon: 'fa-trophy', tier: 'silver' },
    { id: 'played_100', name: 'مدمن ألعاب', description: 'العب 100 مباراة كويز', icon: 'fa-gamepad', tier: 'silver' },
    { id: 'watched_50_ads', name: 'مشاهد منتظم', description: 'شاهد 50 إعلاناً', icon: 'fa-video', tier: 'silver' },
    { id: 'reach_level_25', name: 'نجم متألق', description: 'الوصول إلى المستوى 25', icon: 'fa-star', tier: 'silver' },
    { id: 'add_10_friends', name: 'صانع الأصدقاء', description: 'أضف 10 أصدقاء', icon: 'fa-users', tier: 'silver' },
    { id: 'correct_250', name: 'موسوعة متحركة', description: 'أجب على 250 سؤالاً بشكل صحيح', icon: 'fa-check-double', tier: 'silver' },
    { id: 'win_streak_3', name: 'على الطريق الصحيح', description: 'حقق سلسلة انتصارات من 3 مباريات', icon: 'fa-fire-alt', tier: 'silver' },
    { id: 'approved_question', name: 'العقل المدبر', description: 'احصل على موافقة على سؤال أرسلته للمجتمع', icon: 'fa-stamp', tier: 'silver' },

    // Gold (Hard)
    { id: 'win_100', name: 'أسطورة الكويز', description: 'اربح 100 مباراة كويز', icon: 'fa-trophy', tier: 'gold' },
    { id: 'watched_250_ads', name: 'داعم كبير', description: 'شاهد 250 إعلاناً', icon: 'fa-video', tier: 'gold' },
    { id: 'reach_level_50', name: 'أيقونة Shahn', description: 'الوصول إلى المستوى 50', icon: 'fa-crown', tier: 'gold' },
    { id: 'correct_1000', name: 'البروفيسور', description: 'أجب على 1000 سؤال بشكل صحيح', icon: 'fa-brain', tier: 'gold' },
    { id: 'win_streak_7', name: 'لا يمكن إيقافه', description: 'حقق سلسلة انتصارات من 7 مباريات', icon: 'fa-fire-alt', tier: 'gold' },
    { id: 'flawless_victory', name: 'نصر ساحق', description: 'اربح مباراة كويز بدون أي إجابة خاطئة', icon: 'fa-shield-alt', tier: 'gold' },
    { id: 'reach_gold_tier', name: 'اللمسة الذهبية', description: 'الوصول إلى تصنيف "ذهبي" في الكويز', icon: 'fa-award', tier: 'gold' },

    // Diamond (Very Hard)
    { id: 'win_500', name: 'إله الكويز', description: 'اربح 500 مباراة كويز', icon: 'fa-trophy', tier: 'diamond' },
    { id: 'watched_1000_ads', name: 'الداعم الأسطوري', description: 'شاهد 1000 إعلان', icon: 'fa-video', tier: 'diamond' },
    { id: 'reach_level_100', name: 'خالد في Shahn', description: 'الوصول إلى المستوى 100', icon: 'fa-gem', tier: 'diamond' },
    { id: 'win_streak_15', name: 'قوة لا تقهر', description: 'حقق سلسلة انتصارات من 15 مباراة', icon: 'fa-fire-alt', tier: 'diamond' },
    { id: 'reach_diamond_tier', name: 'جوهرة التاج', description: 'الوصول إلى تصنيف "ماسي" في الكويز', icon: 'fa-gem', tier: 'diamond' },
];

async function checkAndGrantAchievement(achievementId: string) {
    const user = App.state.userData;
    if (!user || (user.achievements && user.achievements[achievementId])) {
        return;
    }

    const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) {
        console.warn(`Attempted to grant non-existent achievement: ${achievementId}`);
        return;
    }

    try {
        const userRef = db.collection('users').doc(user.uid);
        await userRef.update({
            [`achievements.${achievementId}`]: {
                name: achievement.name,
                date: firebase.firestore.FieldValue.serverTimestamp()
            }
        });

        App.functions.ui.showAchievementUnlockedPopup(achievement);
        App.functions.ui.sound.play('win');

        console.log(`Achievement unlocked for ${user.username}: ${achievement.name}`);

    } catch (error) {
        console.error(`Failed to grant achievement ${achievementId} to user ${user.uid}:`, error);
    }
}

export const achievementsFunctions = {
    getAchievements: () => ALL_ACHIEVEMENTS,

    async checkAdWatchAchievements() {
        const user = App.state.userData;
        if (!user) return;
        const adCount = (user.adsWatched || 0) + 1;
        if (adCount >= 5) await checkAndGrantAchievement('watched_5_ads');
        if (adCount >= 50) await checkAndGrantAchievement('watched_50_ads');
        if (adCount >= 250) await checkAndGrantAchievement('watched_250_ads');
        if (adCount >= 1000) await checkAndGrantAchievement('watched_1000_ads');
    },

    async checkLevelUpAchievements(level: number) {
        if (level >= 10) await checkAndGrantAchievement('reach_level_10');
        if (level >= 25) await checkAndGrantAchievement('reach_level_25');
        if (level >= 50) await checkAndGrantAchievement('reach_level_50');
        if (level >= 100) await checkAndGrantAchievement('reach_level_100');
    },
    
    async checkSocialAchievements(type: 'friend_added') {
        const user = App.state.userData;
        if (!user) return;
        
        if (type === 'friend_added') {
            const friendCount = (user.friends?.length || 0) + 1;
            if (friendCount >= 1) await checkAndGrantAchievement('add_first_friend');
            if (friendCount >= 10) await checkAndGrantAchievement('add_10_friends');
        }
    },

    async checkQuizAchievements(finalPlayerState: QuizPlayer, room: QuizRoom) {
        const user = App.state.userData;
        if (!user) return;
    
        const isWinner = room.winnerId === user.uid;
        const wins = (user.quizWins || 0); // This is already updated from the game end logic.
        const played = (user.quizzesPlayed || 0);
        const correctAnswersCount = (user.quizStats?.correctAnswers || 0);
        let winStreak = user.quizWinStreak || 0;
    
        // Wins
        if (isWinner) {
            winStreak++;
            if (wins >= 1) await checkAndGrantAchievement('first_win');
            if (wins >= 25) await checkAndGrantAchievement('win_25');
            if (wins >= 100) await checkAndGrantAchievement('win_100');
            if (wins >= 500) await checkAndGrantAchievement('win_500');
        } else {
            winStreak = 0; // Reset streak on loss
        }
        
        // Games Played
        if (played >= 10) await checkAndGrantAchievement('played_10');
        if (played >= 100) await checkAndGrantAchievement('played_100');
    
        // Correct Answers
        if (correctAnswersCount >= 50) await checkAndGrantAchievement('correct_50');
        if (correctAnswersCount >= 250) await checkAndGrantAchievement('correct_250');
        if (correctAnswersCount >= 1000) await checkAndGrantAchievement('correct_1000');
        
        // Win Streaks
        if (winStreak >= 3) await checkAndGrantAchievement('win_streak_3');
        if (winStreak >= 7) await checkAndGrantAchievement('win_streak_7');
        if (winStreak >= 15) await checkAndGrantAchievement('win_streak_15');
        
        // Flawless Victory
        if (isWinner && finalPlayerState.answers.every(a => a.correct)) {
            await checkAndGrantAchievement('flawless_victory');
        }
    
        // Update win streak in DB if it changed
        if (winStreak !== (user.quizWinStreak || 0)) {
            await db.collection('users').doc(user.uid).update({ quizWinStreak: winStreak });
        }
    
        // Quiz Tier (Checked when tier is updated separately)
        if (user.quizTier === 'gold') await checkAndGrantAchievement('reach_gold_tier');
        if (user.quizTier === 'diamond') await checkAndGrantAchievement('reach_diamond_tier');
    },

    async checkTopUpAchievements() {
        const user = App.state.userData;
        if (!user) return;
        // The topups count is already incremented in the transaction
        const topupCount = (user.topups || 0);
        if (topupCount >= 1) await checkAndGrantAchievement('first_topup');
    },

    async checkCommunityAchievements(type: 'submitted_question' | 'approved_question') {
        if (type === 'submitted_question') {
            await checkAndGrantAchievement('submit_question');
        } else if (type === 'approved_question') {
            await checkAndGrantAchievement('approved_question');
        }
    }
};
