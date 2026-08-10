import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAB7HrYtrDj2DHESQ1pq8hjwpRy0TNKgn4",
  authDomain: "vocalhelper.firebaseapp.com",
  projectId: "vocalhelper",
  storageBucket: "vocalhelper.firebasestorage.app",
  messagingSenderId: "1048494102756",
  appId: "1:1048494102756:web:fe368664e8564028c374f1"
};

let app, auth, db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase initialization error", error);
}

export { auth, db };
