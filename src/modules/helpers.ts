
import { db, firebase, storage } from '../firebase';
import { App } from '../../app';

export const helperFunctions = {
    generateShortId(length = 6): string {
        const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    async updateUserPoints(userId: string, username: string, change: number, reason: string) {
        if (!userId) {
            console.error("updateUserPoints called with invalid userId.");
            return;
        }
        if (isNaN(change) || change === 0) return;

        const userRef = db.collection('users').doc(userId);
        
        try {
            await db.runTransaction(async (transaction: any) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw new Error("User does not exist!");
                }
                transaction.update(userRef, { points: firebase.firestore.FieldValue.increment(change) });

                const logRef = db.collection('pointsLog').doc();
                transaction.set(logRef, {
                    userId: userId,
                    username: username || 'مستخدم غير معروف',
                    change: change,
                    reason: reason,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
        } catch (error) {
            console.error(`Failed to update points for user ${userId} by ${change} for reason: ${reason}. Error:`, error);
        }
    },
    
    async grantXpAndCheckLevelUp(userId: string, xpGained: number) {
        if (isNaN(xpGained) || xpGained <= 0) return;

        const userRef = db.collection('users').doc(userId);

        try {
             await db.runTransaction(async (transaction: any) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) return;

                const userData = userDoc.data();
                let currentLevel = userData.level || 1;
                let currentXp = userData.xp || 0;
                
                currentXp += xpGained;

                let xpForNextLevel = 100 + (currentLevel - 1) * 150;

                while (currentXp >= xpForNextLevel) {
                    currentLevel++;
                    currentXp -= xpForNextLevel;
                    // Trigger achievement check for the new level
                    if (userId === App.state.userData?.uid) {
                        App.functions.activities.checkLevelUpAchievements(currentLevel);
                        App.functions.ui.showToast(`🎉 تهانينا! لقد وصلت إلى المستوى ${currentLevel}!`, 'success');
                    }
                    xpForNextLevel = 100 + (currentLevel - 1) * 150;
                }
                
                transaction.update(userRef, { level: currentLevel, xp: currentXp });
            });

        } catch (error) {
            console.error(`Failed to grant XP to user ${userId}. Error:`, error);
        }
    },
    
    async logPointsChange(userId: string, username: string, change: number, reason: string) {
         try {
            await db.collection('pointsLog').add({
                userId: userId,
                username: username,
                change: change,
                reason: reason,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (logError) {
            console.error(`Failed to LOG points change for user ${userId}. Error:`, logError);
        }
    },

    async uploadFile(file: File, path: string): Promise<string> {
        // Using Cloudinary as primary storage per user request
        try {
            const CLOUD_NAME = "dwslozp7g"; 
            const API_KEY = "595758488746189";
            const API_SECRET = "FEsHYm3CPWda4jut8jGumqaoTkI";

            const timestamp = Math.round(Date.now() / 1000);
            
            // 1. Construct string to sign: parameters must be alphabetical (folder, then timestamp)
            const paramsToSign = `folder=${path}&timestamp=${timestamp}`;
            const stringToSign = paramsToSign + API_SECRET;

            // 2. Generate SHA-1 Signature
            const msgBuffer = new TextEncoder().encode(stringToSign);
            const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
            const signature = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            // 3. Prepare Form Data
            const formData = new FormData();
            formData.append('file', file);
            formData.append('api_key', API_KEY);
            formData.append('timestamp', timestamp.toString());
            formData.append('folder', path);
            formData.append('signature', signature);

            // 4. Upload
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Cloudinary Upload Failed:", data);
                // Fallback to Firebase if Cloudinary fails
                console.warn("Falling back to Firebase Storage due to Cloudinary error.");
                const storageRef = storage.ref(path + '/' + file.name);
                await storageRef.put(file);
                return await storageRef.getDownloadURL();
            }

            return data.secure_url;

        } catch (error: any) {
            console.error("Upload error:", error);
            // Final Fallback attempt to Firebase if fetch failed entirely
            try {
                const storageRef = storage.ref(path + '/' + file.name);
                await storageRef.put(file);
                return await storageRef.getDownloadURL();
            } catch (fbError) {
                App.functions.ui.showToast("فشل رفع الصورة.", "error");
                throw error; 
            }
        }
    },

    async compressImage(file: File, options: { maxWidth: number; maxHeight: number; quality: number }): Promise<File> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(img.src); 
    
                let width = img.width;
                let height = img.height;
    
                if (width > height) {
                    if (width > options.maxWidth) {
                        height = Math.round((height * options.maxWidth) / width);
                        width = options.maxWidth;
                    }
                } else {
                    if (height > options.maxHeight) {
                        width = Math.round((width * options.maxHeight) / height);
                        height = options.maxHeight;
                    }
                }
    
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);
    
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Canvas to Blob conversion failed'));
                            return;
                        }
                        const newFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    },
                    'image/jpeg',
                    options.quality
                );
            };
            img.onerror = (error) => {
                URL.revokeObjectURL(img.src);
                reject(error);
            };
        });
    },

    toggleButtonLoading(button: HTMLButtonElement | null, isLoading: boolean, buttonText: string | null = null) {
        if (!button) return;
        const btnTextEl = button.querySelector('.btn-text');
        const spinner = button.querySelector('i.fa-spinner');
        button.disabled = isLoading;
        if (btnTextEl) {
            if (buttonText !== null) btnTextEl.textContent = buttonText;
            btnTextEl.classList.toggle('hidden', isLoading);
        }
        if (spinner) {
            spinner.classList.toggle('hidden', !isLoading);
            spinner.classList.toggle('inline-block', isLoading);
        }
    },

    formatDate(timestamp: any) {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        return timestamp.toDate().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
    },
};
