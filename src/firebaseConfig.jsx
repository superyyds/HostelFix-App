// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBrYGy-PkbAvhgmrYYmQ0vlmf43hjgMRTw",
  authDomain: "hotelfix-10e2c.firebaseapp.com",
  projectId: "hotelfix-10e2c",
  storageBucket: "hotelfix-10e2c.firebasestorage.app",
  messagingSenderId: "720081265245",
  appId: "1:720081265245:web:675e5b77e56cb47b8da3b4",
  measurementId: "G-PHDYKJBPJS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Storage (optional)
export const storage = getStorage(app);