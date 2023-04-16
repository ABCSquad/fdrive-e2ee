import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDM4YlX3Unn0wpCyB7LPTS5Jmr3LYpAMlw",
  authDomain: "fdrive-encrypted-storage.firebaseapp.com",
  projectId: "fdrive-encrypted-storage",
  storageBucket: "fdrive-encrypted-storage.appspot.com",
  messagingSenderId: "245777209820",
  appId: "1:245777209820:web:21b948585576eb7c941719",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const storage = getStorage(app);

export { storage };
