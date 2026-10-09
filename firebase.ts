import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore/lite";

// Configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyAdQknJa8uae3VKvJM-oRkpniSELP8TqGY",
  authDomain: "a-istudy-cebe2.firebaseapp.com",
  projectId: "a-istudy-cebe2",
  storageBucket: "a-istudy-cebe2.firebasestorage.app",
  messagingSenderId: "791132793786",
  appId: "1:791132793786:web:a5edd1e8e01baaa0dd0b83"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };