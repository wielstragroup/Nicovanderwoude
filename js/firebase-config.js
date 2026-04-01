/**
 * firebase-config.js
 * ------------------
 * Firebase initialisatie en configuratie (modulaire SDK v10).
 */

import { initializeApp } from 'firebase/app';
import { getFirestore }  from 'firebase/firestore';
import { getAuth }       from 'firebase/auth';
import { getStorage }    from 'firebase/storage';

const firebaseConfig = {
  apiKey:            'AIzaSyAyqDFKIVgf43M-cFaAhXcpaa54YQWkGCk',
  authDomain:        'nicovanderwoude-be15f.firebaseapp.com',
  projectId:         'nicovanderwoude-be15f',
  storageBucket:     'nicovanderwoude-be15f.firebasestorage.app',
  messagingSenderId: '1003142316643',
  appId:             '1:1003142316643:web:dca78380bc912f38b12e56',
  measurementId:     'G-ZPE4MCXKKT',
};

export const app     = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);
