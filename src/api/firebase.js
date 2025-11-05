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

// --- Firebase Configuration (MUST BE REPLACED WITH ACTUAL CONFIG) ---
// NOTE: In a real project, these values should be loaded from secure environment variables.
const firebaseConfig = {
  apiKey: "AIzaSyBrYGy-PkbAvhgmrYYmQ0vlmf43hjgMRTw", // Placeholder/example key
  authDomain: "hotelfix-10e2c.firebaseapp.com",
  projectId: "hotelfix-10e2c",
  storageBucket: "hotelfix-10e2c.firebasestorage.app",
  messagingSenderId: "720081265245",
  appId: "1:720081265245:web:675e5b77e56cb47b8da3b4",
  measurementId: "G-PHDYKJBPJS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// GLOBAL VARIABLE: Placeholder for Warden's session data (Used for register/restore flow)
// This is exported so it can be managed by the page components (LoginPage/RegisterUserPage)
export let wardenSessionCache = { email: null, password: null };

// --- Firestore User Management Functions ---

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
        mustChangePassword: userData.mustChangePassword || false,
        userData: userData,
        userDocId: uid
      };
    }

    // 2. If not found by UID (e.g., initial login/migration), try to find by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      return {
        role: userData.role || 'student',
        mustChangePassword: userData.mustChangePassword || false,
        userData: userData,
        userDocId: userDoc.id
      };
    }

    // Default return if user document is missing
    return {
      role: 'student',
      mustChangePassword: false,
      userData: null,
      userDocId: uid
    };

  } catch (error) {
    console.error("❌ DEBUG: Error fetching user role:", error);
    return {
      role: 'student',
      mustChangePassword: false,
      userData: null,
      userDocId: uid
    };
  }
};

export const saveUserToFirestore = async (userData) => {
  try {
    const { hostelId, email } = userData;
    // Determine the Firestore document ID (prefer UID, then Hostel ID/Email for Warden)
    const docId = userData.uid || hostelId || email.replace(/[^a-zA-Z0-9]/g, '_');
    const userDocRef = doc(db, 'users', docId);

    await setDoc(userDocRef, {
      ...userData,
      email: email.toLowerCase(),
      dateCreated: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log("User saved to Firestore with ID:", docId);
    return docId;
  } catch (error) {
    console.error("Error saving user to Firestore:", error);
    throw error;
  }
};

export const updateUserInFirestore = async (docId, updates) => {
  try {
    const userDocRef = doc(db, 'users', docId);
    await updateDoc(userDocRef, {
      ...updates,
      lastUpdated: new Date().toISOString()
    });
    console.log("User updated in Firestore:", docId);
  } catch (error) {
    console.error("Error updating user in Firestore:", error);
    throw error;
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


// --- Export Core Firebase Instances and Auth Helpers ---
export {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
};