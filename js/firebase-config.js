/**
 * firebase-config.js
 * ------------------
 * Firebase initialisatie en configuratie.
 * Vervang de placeholder-waarden met de gegevens van jouw eigen Firebase project.
 * Je kunt deze vinden in de Firebase console → Projectinstellingen → Jouw apps.
 */

// Firebase project configuratie (placeholder - vervangen met eigen waarden)
const firebaseConfig = {
  apiKey:            "JOUW_API_KEY",
  authDomain:        "JOUW_PROJECT.firebaseapp.com",
  projectId:         "JOUW_PROJECT_ID",
  storageBucket:     "JOUW_PROJECT.appspot.com",
  messagingSenderId: "JOUW_SENDER_ID",
  appId:             "JOUW_APP_ID"
};

// Firebase initialiseren met de opgegeven configuratie
firebase.initializeApp(firebaseConfig);

// Firebase services beschikbaar stellen voor andere scripts
const db      = firebase.firestore();  // Firestore database
const auth    = firebase.auth();       // Authentication service
const storage = firebase.storage();   // Cloud Storage service
