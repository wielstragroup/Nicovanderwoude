/**
 * firebase-config.js
 * ------------------
 * Firebase initialisatie en configuratie.
 * Vervang de placeholder-waarden met de gegevens van jouw eigen Firebase project.
 * Je kunt deze vinden in de Firebase console → Projectinstellingen → Jouw apps.
 */

// Firebase project configuratie
const firebaseConfig = {
  apiKey:            "AIzaSyAyqDFKIVgf43M-cFaAhXcpaa54YQWkGCk",
  authDomain:        "nicovanderwoude-be15f.firebaseapp.com",
  projectId:         "nicovanderwoude-be15f",
  storageBucket:     "nicovanderwoude-be15f.firebasestorage.app",
  messagingSenderId: "1003142316643",
  appId:             "1:1003142316643:web:dca78380bc912f38b12e56",
  measurementId:     "G-ZPE4MCXKKT"
};

// Firebase initialiseren met de opgegeven configuratie
firebase.initializeApp(firebaseConfig);

// Firebase services beschikbaar stellen voor andere scripts
const db      = firebase.firestore();  // Firestore database
const auth    = firebase.auth();       // Authentication service
const storage = firebase.storage();   // Cloud Storage service
