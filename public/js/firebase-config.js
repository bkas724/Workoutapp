// Your web app's Firebase configuration 
// (Copy this exact block from your Firebase Project Settings Web App page)
const firebaseConfig = {
    apiKey: "AIzaSyCedoObrQQHkJ9B_ycYsWla5q8aIIts9nE",
    authDomain: "yourflow-b8645.firebaseapp.com",
    projectId: "yourflow-b8645",
    storageBucket: "yourflow-b8645.firebasestorage.app",
    messagingSenderId: "886635521341",
    appId: "1:886635521341:web:f1162e315632e67a2cd154"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
window.db = firebase.firestore();
