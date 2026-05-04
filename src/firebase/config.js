import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCxCgb32dc277DliK8hzb5VZJIbJkorrMc",
  authDomain: "globalpay-portal.firebaseapp.com",
  projectId: "globalpay-portal",
  storageBucket: "globalpay-portal.firebasestorage.app",
  messagingSenderId: "333497919037",
  appId: "1:333497919037:web:913f2671a7da0a43edec54",
  measurementId: "G-ZE2D3Q6ZWS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
