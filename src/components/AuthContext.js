// src/components/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { sanitizeInput } from "../utils/validators";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Register a new customer
  // Firebase handles password hashing + salting automatically (bcrypt internally)
  const register = async ({ fullName, idNumber, accountNumber, username, password }) => {
    // We use accountNumber@bankportal.internal as the Firebase "email"
    // since Firebase Auth requires an email format
    const syntheticEmail = `${sanitizeInput(username).toLowerCase()}@bankportal.internal`;

    const userCredential = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName: sanitizeInput(fullName) });

    // Store additional user data in Firestore (never store plain passwords)
    await setDoc(doc(db, "customers", user.uid), {
      uid: user.uid,
      fullName: sanitizeInput(fullName),
      idNumber: sanitizeInput(idNumber), // In production: encrypt this field
      accountNumber: sanitizeInput(accountNumber),
      username: sanitizeInput(username).toLowerCase(),
      syntheticEmail,
      createdAt: serverTimestamp(),
      role: "customer",
    });

    return user;
  };

  // Login an existing customer
  const login = async ({ username, password }) => {
    const syntheticEmail = `${username.toLowerCase().trim()}@bankportal.internal`;
    const userCredential = await signInWithEmailAndPassword(auth, syntheticEmail, password);
    return userCredential.user;
  };

  // Logout
  const logout = () => signOut(auth);

  // Fetch user profile from Firestore
  const fetchUserData = async (uid) => {
    const docSnap = await getDoc(doc(db, "customers", uid));
    if (docSnap.exists()) {
      setUserData(docSnap.data());
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserData(user.uid);
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = { currentUser, userData, register, login, logout, loading };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
