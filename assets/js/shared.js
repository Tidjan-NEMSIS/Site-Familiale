// assets/js/shared.js

// Vérification de l'authentification sur toutes les pages sauf login
function checkAuth() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(user => {
            if (!user && !window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
                reject('Utilisateur non authentifié');
            } else if (user) {
                resolve(user);
            }
        });
    });
}

// Récupérer les informations de l'utilisateur et de la famille
async function getUserAndFamilyInfo(userId) {
    try {
        // Récupérer les informations du membre
        const memberDoc = await db.collection('familyMembers').doc(userId).get();
        
        if (!memberDoc.exists) {
            console.error('Profil utilisateur non trouvé');
            return null;
        }
        
        const memberData = memberDoc.data();
        const familyId = memberData.familyId;
        
        // Récupérer les informations de la famille
        const familyDoc = await db.collection('families').doc(familyId).get();
        
        if (!familyDoc.exists) {
            console.error('Famille non trouvée');
            return null;
        }
        
        return {
            userId: userId,
            familyId: familyId,
            member: memberData,
            family: familyDoc.data()
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des informations:', error);
        return null;
    }
}

// Déconnexion
function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Erreur de déconnexion:', error);
            }
        });
    }
}

// Afficher les informations de l'utilisateur dans la barre de navigation
async function setupUserInfo(user) {
    const userNameElement = document.getElementById('user-name');
    const userAvatarElement = document.getElementById('user-avatar');
    
    if (userNameElement && userAvatarElement) {
        userNameElement.textContent = user.displayName || 'Utilisateur';
        
        // Récupérer la photo de profil s'il y en a une
        const memberInfo = await db.collection('familyMembers').doc(user.uid).get();
        if (memberInfo.exists && memberInfo.data().profilePicture) {
            userAvatarElement.src = memberInfo.data().profilePicture;
        }
    }
}

// Formatage de date
function formatDate(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fonction pour tronquer du texte
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Initialisation commune à toutes les pages
async function initPage() {
    try {
        const user = await checkAuth();
        if (user) {
            setupUserInfo(user);
            setupLogout();
            return user;
        }
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
    }
    return null;
}

// Au chargement de la page
document.addEventListener('DOMContentLoaded', initPage);