// assets/js/auth.js

document.addEventListener('DOMContentLoaded', function() {
    // Gestion des onglets
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    loginTab.addEventListener('click', function() {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });

    registerTab.addEventListener('click', function() {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    // Gestion des options pour rejoindre ou créer une famille
    const joinFamilyRadio = document.getElementById('join-family');
    const createFamilyRadio = document.getElementById('create-family');
    const joinFamilySection = document.getElementById('join-family-section');
    const createFamilySection = document.getElementById('create-family-section');

    joinFamilyRadio.addEventListener('change', function() {
        if (this.checked) {
            joinFamilySection.classList.remove('hidden');
            createFamilySection.classList.add('hidden');
        }
    });

    createFamilyRadio.addEventListener('change', function() {
        if (this.checked) {
            createFamilySection.classList.remove('hidden');
            joinFamilySection.classList.add('hidden');
        }
    });

    // Formulaire de connexion
    const signinForm = document.getElementById('signin-form');
    signinForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const familyCode = document.getElementById('login-family-code').value;
        
        try {
            // Vérifier si le code familial existe
            const familyCodeRef = await db.collection('familyCodes').doc(familyCode).get();
            
            if (!familyCodeRef.exists) {
                alert('Code familial invalide.');
                return;
            }
            
            // Authentification Firebase
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Vérifier si l'utilisateur appartient à la famille associée au code
            const familyId = familyCodeRef.data().familyId;
            const memberRef = await db.collection('familyMembers').doc(user.uid).get();
            
            if (!memberRef.exists || memberRef.data().familyId !== familyId) {
                alert('Vous n\'êtes pas membre de cette famille.');
                await auth.signOut();
                return;
            }
            
            // Redirection vers la page d'accueil
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('Erreur de connexion:', error);
            alert('Erreur de connexion: ' + error.message);
        }
    });

    // Formulaire d'inscription
    const signupForm = document.getElementById('signup-form');
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const fullName = document.getElementById('register-name').value;
        const joinFamily = document.getElementById('join-family').checked;
        
        try {
            // Création de l'utilisateur Firebase
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Mise à jour du profil utilisateur
            await user.updateProfile({
                displayName: fullName
            });
            
            let familyId;
            
            if (joinFamily) {
                // Rejoindre une famille existante
                const familyCode = document.getElementById('register-family-code').value;
                const familyCodeRef = await db.collection('familyCodes').doc(familyCode).get();
                
                if (!familyCodeRef.exists) {
                    alert('Code familial invalide.');
                    await user.delete();
                    return;
                }
                
                familyId = familyCodeRef.data().familyId;
                
            } else {
                // Créer une nouvelle famille
                const familyName = document.getElementById('family-name').value;
                
                // Créer un document de famille
                const familyRef = await db.collection('families').add({
                    name: familyName,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdBy: user.uid
                });
                
                familyId = familyRef.id;
                
                // Générer un code familial unique
                const familyCode = generateFamilyCode();
                await db.collection('familyCodes').doc(familyCode).set({
                    familyId: familyId,createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Créer un profil de membre de famille
            await db.collection('familyMembers').doc(user.uid).set({
                familyId: familyId,
                fullName: fullName,
                email: email,
                role: joinFamily ? 'member' : 'admin',
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                profilePicture: null
            });
            
            // Créer un document de profil utilisateur dans la famille
            await db.collection('families').doc(familyId).collection('members').doc(user.uid).set({
                fullName: fullName,
                email: email,
                role: joinFamily ? 'member' : 'admin',
                profilePicture: null,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Redirection vers la page d'accueil
            window.location.href = 'index.html';
            
        } catch (error) {
            console.error('Erreur d\'inscription:', error);
            alert('Erreur d\'inscription: ' + error.message);
        }
    });
    
    // Vérification de l'état d'authentification
    auth.onAuthStateChanged(function(user) {
        if (user && window.location.pathname.includes('login.html')) {
            window.location.href = 'index.html';
        }
    });
    
    // Fonction pour générer un code familial unique
    function generateFamilyCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return code;
    }
});