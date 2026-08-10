import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAB7HrYtrDj2DHESQ1pq8hjwpRy0TNKgn4",
  authDomain: "vocalhelper.firebaseapp.com",
  projectId: "vocalhelper",
  storageBucket: "vocalhelper.firebasestorage.app",
  messagingSenderId: "1048494102756",
  appId: "1:1048494102756:web:fe368664e8564028c374f1",
  measurementId: "G-5BD5KETW67"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
