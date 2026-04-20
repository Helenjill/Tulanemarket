import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | null;
  dbUser: any | null;
  loading: boolean;
  setDbUser: React.Dispatch<React.SetStateAction<any | null>>;
}

const AuthContext = createContext<AuthContextType>({ user: null, dbUser: null, loading: true, setDbUser: () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Enforce Tulane email
        if (!firebaseUser.email?.endsWith('@tulane.edu')) {
          await auth.signOut();
          setUser(null);
          setDbUser(null);
          setLoading(false);
          return;
        }

        setUser(firebaseUser);
        
        // Fetch or create user in Firestore
        const attemptFetchUser = async (retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              const userRef = doc(db, 'users', firebaseUser.uid);
              const userSnap = await getDoc(userRef);
              
              if (userSnap.exists()) {
                return userSnap.data();
              } else {
                // Give Login.tsx a chance to write the document first (race condition prevention)
                await new Promise(resolve => setTimeout(resolve, i * 1000 + 1000));
                const retrySnap = await getDoc(userRef);
                if (retrySnap.exists()) {
                   return retrySnap.data();
                } else {
                  const newUser = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    name: firebaseUser.displayName || 'Tulane Student',
                    photoURL: firebaseUser.photoURL || '',
                    createdAt: new Date(),
                    rating: 0,
                    reviewCount: 0
                  };
                  await setDoc(userRef, newUser);
                  return newUser;
                }
              }
            } catch (error: any) {
              if (i === retries - 1) {
                console.error("Error fetching/creating user doc after retries:", error);
                throw error;
              }
              console.warn(`Retry ${i + 1} fetching user doc:`, error?.message);
              await new Promise(resolve => setTimeout(resolve, 1500)); // wait before retry
            }
          }
          return null;
        };

        try {
           const userData = await attemptFetchUser();
           if (userData) {
              setDbUser(userData);
           }
        } catch (e) {
           // Silently ignore to avoid breaking UI. User might just have a bad connection.
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setDbUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, setDbUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
