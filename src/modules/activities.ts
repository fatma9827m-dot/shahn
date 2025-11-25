import { db, firebase } from '../firebase';
import { App } from '../../app';

export const activitiesFunctions = {
    async redeemPromoCode(code: string) {
        if (!code) return;
        const cleanCode = code.trim().toUpperCase();
        const user = App.state.userData;
        if (!user) return;

        try {
            const codeRef = db.collection('promoCodes').doc(cleanCode);
            const codeDoc = await codeRef.get();
            if (!codeDoc.exists) throw new Error("هذا الكود غير صالح.");
            
            const codeData = codeDoc.data();
            if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) throw new Error("هذا الكود منتهي الصلاحية.");
            if (codeData.usesLeft <= 0) throw new Error("لقد تم استخدام هذا الكود بالكامل.");

            const redemptionSnap = await db.collection('promoRedemptions').where('userId', '==', user.uid).where('code', '==', cleanCode).get();
            if (!redemptionSnap.empty) throw new Error("لقد استخدمت هذا الكود من قبل.");

            await db.runTransaction(async (transaction:any) => {
                const userRef = db.collection('users').doc(user.uid);
                transaction.update(userRef, {
                    points: firebase.firestore.FieldValue.increment(codeData.points),
                    xp: firebase.firestore.FieldValue.increment(codeData.xp || 0)
                });
                transaction.update(codeRef, { usesLeft: firebase.firestore.FieldValue.increment(-1) });
                transaction.set(db.collection('promoRedemptions').doc(), {
                    userId: user.uid, username: user.username, code: cleanCode,
                    redeemedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            App.functions.ui.showToast(`🎉 تم إضافة ${codeData.points} نقطة بنجاح!`, 'success');
            await App.functions.helpers.logPointsChange(user.uid, user.username, codeData.points, `تفعيل كود ${cleanCode}`);
            if(codeData.xp > 0) await App.functions.helpers.grantXpAndCheckLevelUp(user.uid, codeData.xp);
        } catch (error: any) {
            App.functions.ui.showToast(error.message, 'error');
        }
    },

    async watchAd() {
        if (!App.state.userData || !App.state.appSettings) return;
        const { adSettings } = App.state.appSettings;
        const { lastAdWatched } = App.state.userData;

        const cooldown = adSettings.cooldownSeconds || 3600;
        if (lastAdWatched) {
            const secondsSinceLastAd = (Date.now() - lastAdWatched.toDate().getTime()) / 1000;
            if (secondsSinceLastAd < cooldown) {
                App.functions.ui.showToast(`يجب أن تنتظر ${Math.ceil((cooldown - secondsSinceLastAd) / 60)} دقيقة لمشاهدة إعلان آخر.`, 'info');
                return;
            }
        }

        App.DOM.watchAdBtn.disabled = true;
        App.functions.ui.openModal(App.DOM.adTimerModal);
        let countdown = adSettings.durationSeconds || 15;
        App.DOM.adTimerCountdown.textContent = countdown.toString();

        const timerInterval = setInterval(() => {
            countdown--;
            App.DOM.adTimerCountdown.textContent = countdown.toString();
            if (countdown <= 0) {
                clearInterval(timerInterval);
                this.completeAdWatch();
            }
        }, 1000);
        
        if (adSettings.linkUrl) console.log(`Simulating ad click. Opening: ${adSettings.linkUrl}`);
    },

    async completeAdWatch() {
        if (!App.state.userData || !App.state.appSettings) return;
        const { adSettings } = App.state.appSettings;
        const user = App.state.userData;

        // Check for ad-related achievements before updating the DB
        await App.functions.achievements.checkAdWatchAchievements();

        try {
            await db.collection('users').doc(user.uid).update({
                lastAdWatched: firebase.firestore.FieldValue.serverTimestamp(),
                adsWatched: firebase.firestore.FieldValue.increment(1)
            });

            await App.functions.helpers.updateUserPoints(user.uid, user.username, adSettings.pointsReward, 'مشاهدة إعلان');
            await App.functions.helpers.grantXpAndCheckLevelUp(user.uid, adSettings.xpReward);
            App.functions.ui.showToast(`+${adSettings.pointsReward} نقطة! +${adSettings.xpReward} XP!`, 'success');
        } catch (error) {
            App.functions.ui.showToast('حدث خطأ أثناء إضافة المكافأة.', 'error');
        } finally {
            App.functions.ui.closeAllModals();
            App.DOM.watchAdBtn.disabled = false;
        }
    }
};