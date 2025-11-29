import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyANbQj7Zx1slQLMUX5pWhbacrtjITslsIk",
  authDomain: "mathmate-aaa89.firebaseapp.com",
  projectId: "mathmate-aaa89",
  storageBucket: "mathmate-aaa89.firebasestorage.app",
  messagingSenderId: "243494921750",
  appId: "1:243494921750:web:5518e333ee2359a4743737"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };