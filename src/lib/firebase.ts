import { initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {});
export const auth = getAuth(app);

export const logout = () => signOut(auth);
