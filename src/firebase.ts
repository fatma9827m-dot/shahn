// This file initializes and exports Firebase services.
// It relies on the global `firebase` object loaded from the script tag in index.html.

declare var firebase: any;

// Declare variables that will be initialized later.
// This prevents top-level execution before the Firebase script is loaded.
let auth: any;
let db: any;
let storage: any;
let database: any;
let _firebase: any;

/**
 * Initializes the Firebase app and services. This function must be called
 * after the Firebase SDK scripts have been loaded.
 */
export function initFirebase() {
    // Prevent re-initialization
    if (firebase.apps.length > 0) {
        // Services are already initialized, just re-assign them
        auth = firebase.auth();
        db = firebase.firestore();
        storage = firebase.storage();
        database = firebase.database();
        _firebase = firebase;
        return;
    }

    const firebaseConfig = {
        apiKey: "AIzaSyDuEt0_-M1v-wnkLT24nljgivpfUJfd7mo",
        authDomain: "gug8-13d5e.firebaseapp.com",
        databaseURL: "https://gug8-13d5e-default-rtdb.firebaseio.com",
        projectId: "gug8-13d5e",
        storageBucket: "gug8-13d5e.appspot.com",
        messagingSenderId: "220925541722",
        appId: "1:220925541722:web:46002cf5ed7337dc178763",
        measurementId: "G-KDRBVPTEE0"
    };

    firebase.initializeApp(firebaseConfig);

    // Assign the services to the exported variables.
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    database = firebase.database();
    _firebase = firebase;
}

// Export the variables. They will be undefined until initFirebase() is called,
// but the module system provides a live binding to them.
export { auth, db, storage, database, _firebase as firebase };