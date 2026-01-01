
import * as admin from 'firebase-admin';

// Initialize without arguments relies on GOOGLE_APPLICATION_CREDENTIALS or default auth
if (!admin.apps.length) {
    admin.initializeApp();
}

async function listAllUsers(nextPageToken?: string) {
    // List batch of users, 1000 at a time.
    try {
        const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

        if (listUsersResult.users.length === 0) {
            console.log('No users found.');
            return;
        }

        console.log('--- הרשימה של המשתמשים במערכת ---');
        listUsersResult.users.forEach((userRecord) => {
            const lastSignIn = userRecord.metadata.lastSignInTime ? new Date(userRecord.metadata.lastSignInTime).toLocaleString('he-IL') : 'לא נכנס מעולם';
            const creationTime = userRecord.metadata.creationTime ? new Date(userRecord.metadata.creationTime).toLocaleString('he-IL') : 'לא ידוע';
            console.log(`
👤 שם: ${userRecord.displayName || 'ללא שם'}
📧 מייל: ${userRecord.email}
🆔 UID: ${userRecord.uid}
📅 נוצר ב: ${creationTime}
🕒 כניסה אחרונה: ${lastSignIn}
----------------------------------------`);
        });

        if (listUsersResult.pageToken) {
            // List next batch of users.
            listAllUsers(listUsersResult.pageToken);
        }
    } catch (error) {
        console.log('Error listing users:', error);
    }
}

listAllUsers();
