import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

import { wardenSessionCache } from './cache';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const fetchUserRole = async (uid, email) => {
  try {
    console.log("🔍 DEBUG: Searching for user:", { uid, email });

    // 1. Try to find user by Auth UID first
    const userDocRef = doc(db, 'users', uid);
    let userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        role: userData.role || 'student',
        mustChangePassword: userData.mustChangePassword === true, // More explicit check
        userData: userData,
        userDocId: uid
      };
    }

    // 2. If not found by UID, try by email
    console.log("🔍 DEBUG: UID doc not found. Trying by email:", email);
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      return {
        role: userData.role || 'student',
        mustChangePassword: userData.mustChangePassword === true, // More explicit check
        userData: userData,
        userDocId: userDoc.id
      };
    }
    
    // If we get here, the user is authenticated but has NO document.
    console.error(`❌ CRITICAL: No user document found for UID ${uid} or email ${email}.`);
    throw new Error(`Your user account (${email}) is corrupted and has no matching database record. Please contact support.`);

  } catch (error) {
    console.error("❌ DEBUG: Error in fetchUserRole:", error);
    // Re-throw the error so App.jsx's onAuthStateChanged can catch it
    throw error; 
  }
};

export const saveUserToFirestore = async (userData) => {
  try {
    const { email } = userData;

    if (!userData.uid) {
        throw new Error("Cannot save user to Firestore: UID is missing from userData.");
    }
    // Always use the user's Auth UID as the document ID.
    const userDocRef = doc(db, 'users', userData.uid);
    // --- END FIX ---

    await setDoc(userDocRef, {
      ...userData,
      email: email.toLowerCase(),
      dateCreated: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log("User saved to Firestore with ID:", userData.uid);
    return userData.uid;
  } catch (error) {
    console.error("Error saving user to Firestore:", error);
    throw error;
  }
};

export const updateUserInFirestore = async (userId, updateData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updateData);
    return true;
  } catch (error) {
    console.error('Firestore update error:', error);
    throw new Error('Failed to update profile in database');
  }
};

export const checkUserExists = async (field, value) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where(field, '==', value));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking user existence:", error);
    return false;
  }
};

export const getUserFromFirestore = async (userId) => {
  if (!userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error('getUserFromFirestore error', err);
    throw err;
  }
};

// --- Export Core Firebase Instances and Auth Helpers ---
export {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword
};