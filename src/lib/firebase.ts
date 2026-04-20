import { initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCLHuL5OAKQzdkDkzmABPfHRXMvbN_VZho",
  authDomain: "tulanemarket.firebaseapp.com",
  projectId: "tulanemarket",
  storageBucket: "tulanemarket.firebasestorage.app",
  messagingSenderId: "934650876959",
  appId: "1:934650876959:web:bf125e8bdaffe26e4f312a",
  measurementId: "G-GLYD16KB4Z",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const logout = async () => {
  await signOut(auth);
};