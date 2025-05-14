import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// Replace these with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBv753ikru-guajH71UUtAFfLJvA9GZ8MY",
  authDomain: "excelfirebase-417ca.firebaseapp.com",
  projectId: "excelfirebase-417ca",
  storageBucket: "excelfirebase-417ca.firebasestorage.app",
  messagingSenderId: "104090038053",
  appId: "1:104090038053:web:4358be28e162d19eaeb4cc",
  measurementId: "G-ZQQC13RTPG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app; 