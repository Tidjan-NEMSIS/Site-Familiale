// assets/js/firebase-config.js

// Configuration de Firebase
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "espace-familial.firebaseapp.com",
    projectId: "espace-familial",
    storageBucket: "espace-familial.appspot.com",
    messagingSenderId: "VOTRE_MESSAGING_SENDER_ID",
    appId: "VOTRE_APP_ID"
  };
  
  // Initialisation de Firebase
  firebase.initializeApp(firebaseConfig);
  
  // Services Firebase
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();
  
  // Règles de sécurité pour Firestore et Storage
  // À configurer dans la console Firebase :
  /*
  // Règles Firestore
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /families/{familyId} {
        allow read, write: if request.auth != null && 
                            exists(/databases/$(database)/documents/familyMembers/$(request.auth.uid)) &&
                            get(/databases/$(database)/documents/familyMembers/$(request.auth.uid)).data.familyId == familyId;
        
        match /members/{memberId} {
          allow read: if request.auth != null && 
                      exists(/databases/$(database)/documents/familyMembers/$(request.auth.uid)) &&
                      get(/databases/$(database)/documents/familyMembers/$(request.auth.uid)).data.familyId == familyId;
          allow write: if request.auth != null && request.auth.uid == memberId;
        }
        
        match /posts/{postId} {
          allow read: if request.auth != null && 
                      exists(/databases/$(database)/documents/familyMembers/$(request.auth.uid)) &&
                      get(/databases/$(database)/documents/familyMembers/$(request.auth.uid)).data.familyId == familyId;
          allow create: if request.auth != null && 
                        exists(/databases/$(database)/documents/familyMembers/$(request.auth.uid)) &&
                        get(/databases/$(database)/documents/familyMembers/$(request.auth.uid)).data.familyId == familyId;
          allow update, delete: if request.auth != null && 
                                request.resource.data.authorId == request.auth.uid;
        }
        
        match /events/{eventId} {
          allow read: if request.auth != null && 
                      exists(/databases/$(database)/documents/familyMembers/$(request.auth.uid)) &&
                      get(/databases/$(database)/documents/familyMembers/$(request.auth.uid)).data.familyId == familyId;
          allow write: if request.auth != null && 
                       exists(/databases/$(database)/documents/familyMembers/$(request.auth.uid)) &&
                       get(/databases/$(database)/documents/familyMembers/$(request.auth.uid)).data.familyId == familyId;
        }
      }
      
      match /familyMembers/{userId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /familyCodes/{code} {
        allow read: if request.auth != null;
      }
    }
  }
  
  // Règles Storage
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /families/{familyId}/{allPaths=**} {
        allow read: if request.auth != null && 
                    exists(/databases/$(database)/documents/familyMembers/$(request.auth.uid)) &&
                    get(/databases/$(database)/documents/familyMembers/$(request.auth.uid)).data.familyId == familyId;
        allow write: if request.auth != null && 
                     exists(/databases/$(database)/documents/familyMembers/$(request.auth.uid)) &&
                     get(/databases/$(database)/documents/familyMembers/$(request.auth.uid)).data.familyId == familyId;
      }
    }
  }
  */