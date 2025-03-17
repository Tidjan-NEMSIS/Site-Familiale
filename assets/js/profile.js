// assets/js/profile.js

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const user = await initPage();
        if (!user) return;

        const currentUserInfo = await getUserAndFamilyInfo(user.uid);
        if (!currentUserInfo) return;
        
        // Récupérer l'ID de l'utilisateur à afficher (depuis l'URL ou l'utilisateur courant)
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id') || user.uid;
        
        // Vérifier si c'est le profil de l'utilisateur courant
        const isOwnProfile = profileId === user.uid;
        
        // Charger les informations du profil
        await loadProfileInfo(profileId, currentUserInfo.familyId, isOwnProfile);
        
        // Configurer les onglets
        setupTabs();
        
        // Charger les fichiers et photos
        loadUserFiles(profileId, currentUserInfo.familyId);
        loadUserPhotos(profileId, currentUserInfo.familyId);
        
        // Configurer les fonctionnalités d'upload si c'est le profil de l'utilisateur
        if (isOwnProfile) {
            setupFileUpload(user.uid, currentUserInfo.familyId);
            setupPhotoUpload(user.uid, currentUserInfo.familyId);
            setupAvatarUpload(user.uid, currentUserInfo.familyId);
            setupProfileEditing(user.uid, currentUserInfo.familyId);
        } else {
            // Cacher les contrôles d'upload et d'édition pour les autres profils
            document.getElementById('upload-controls').style.display = 'none';
            document.getElementById('upload-photo-controls').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Erreur sur la page de profil:', error);
    }
});

// Charger les informations du profil
async function loadProfileInfo(userId, familyId, isOwnProfile) {
    try {
        const memberRef = db.collection('families').doc(familyId).collection('members').doc(userId);
        const memberDoc = await memberRef.get();
        
        if (!memberDoc.exists) {
            console.error('Profil non trouvé');
            return;
        }
        
        const profileData = memberDoc.data();
        
        // Mettre à jour les éléments du DOM
        document.getElementById('profile-name').textContent = profileData.fullName;
        document.getElementById('profile-role').textContent = profileData.role === 'admin' ? 'Administrateur' : 'Membre';
        document.getElementById('profile-joined').textContent = `Membre depuis: ${formatDate(profileData.joinedAt)}`;
        
        if (profileData.profilePicture) {
            document.getElementById('profile-avatar').src = profileData.profilePicture;
        }
        
        // Afficher les contrôles d'édition si c'est le propre profil de l'utilisateur
        if (isOwnProfile) {
            document.getElementById('own-profile-controls').classList.remove('hidden');
            document.getElementById('edit-profile-section').classList.remove('hidden');
            
            // Préremplir le formulaire d'édition
            document.getElementById('edit-name').value = profileData.fullName;
        }
        
        // Mettre à jour le titre de la page
        document.title = `${profileData.fullName} - Espace Familial`;
        
    } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
    }
}

// Configuration des onglets
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Activer/désactiver les boutons d'onglet
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Afficher/masquer les contenus d'onglet
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

// Charger les fichiers de l'utilisateur
async function loadUserFiles(userId, familyId) {
    try {
        const filesRef = db.collection('families').doc(familyId).collection('files');
        const snapshot = await filesRef
            .where('ownerId', '==', userId)
            .where('type', 'not-in', ['image/jpeg', 'image/png', 'image/gif'])
            .orderBy('type')
            .orderBy('uploadedAt', 'desc')
            .get();
        
        const filesList = document.getElementById('files-list');
        filesList.innerHTML = '';
        
        if (snapshot.empty) {
            filesList.innerHTML = '<p class="no-items">Aucun document</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const file = doc.data();
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileExtension = file.name.split('.').pop().toLowerCase();
            let fileIconClass = 'file-icon';
            
            // Déterminer l'icône en fonction de l'extension
            // Déterminer l'icône en fonction de l'extension
            if (['pdf'].includes(fileExtension)) {
                fileIconClass += ' pdf-icon';
            } else if (['doc', 'docx'].includes(fileExtension)) {
                fileIconClass += ' word-icon';
            } else if (['xls', 'xlsx'].includes(fileExtension)) {
                fileIconClass += ' excel-icon';
            } else if (['ppt', 'pptx'].includes(fileExtension)) {
                fileIconClass += ' powerpoint-icon';
            } else {
                fileIconClass += ' generic-icon';
            }
            
            fileItem.innerHTML = `
                <div class="${fileIconClass}"></div>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-info">
                        <span>${formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>${formatDate(file.uploadedAt)}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <a href="${file.url}" target="_blank" class="btn btn-sm btn-primary">Télécharger</a>
                    ${userId === auth.currentUser.uid ? `<button data-file-id="${doc.id}" class="btn btn-sm btn-danger delete-file-btn">Supprimer</button>` : ''}
                </div>
            `;
            
            filesList.appendChild(fileItem);
        });
        
        // Ajouter les écouteurs d'événements pour les boutons de suppression
        if (userId === auth.currentUser.uid) {
            const deleteButtons = document.querySelectorAll('.delete-file-btn');
            deleteButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    const fileId = e.target.getAttribute('data-file-id');
                    if (confirm('Êtes-vous sûr de vouloir supprimer ce fichier ?')) {
                        await deleteFile(fileId, familyId);
                        // Recharger la liste des fichiers
                        loadUserFiles(userId, familyId);
                    }
                });
            });
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des fichiers:', error);
        document.getElementById('files-list').innerHTML = '<p class="error-message">Erreur lors du chargement des fichiers.</p>';
    }
}

// Charger les photos de l'utilisateur
async function loadUserPhotos(userId, familyId) {
    try {
        const photosRef = db.collection('families').doc(familyId).collection('files');
        const snapshot = await photosRef
            .where('ownerId', '==', userId)
            .where('type', 'in', ['image/jpeg', 'image/png', 'image/gif'])
            .orderBy('uploadedAt', 'desc')
            .get();
        
        const photosGrid = document.getElementById('photos-grid');
        photosGrid.innerHTML = '';
        
        if (snapshot.empty) {
            photosGrid.innerHTML = '<p class="no-items">Aucune photo</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const photo = doc.data();
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            
            photoItem.innerHTML = `
                <a href="${photo.url}" class="photo-link" data-lightbox="user-photos" data-title="${photo.name}">
                    <img src="${photo.thumbnailUrl || photo.url}" alt="${photo.name}" class="photo-thumbnail">
                </a>
                ${userId === auth.currentUser.uid ? `
                <div class="photo-actions">
                    <button data-photo-id="${doc.id}" class="btn btn-sm btn-danger delete-photo-btn">Supprimer</button>
                </div>` : ''}
            `;
            
            photosGrid.appendChild(photoItem);
        });
        
        // Ajouter les écouteurs d'événements pour les boutons de suppression
        if (userId === auth.currentUser.uid) {
            const deleteButtons = document.querySelectorAll('.delete-photo-btn');
            deleteButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    const photoId = e.target.getAttribute('data-photo-id');
                    if (confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
                        await deleteFile(photoId, familyId);
                        // Recharger la liste des photos
                        loadUserPhotos(userId, familyId);
                    }
                });
            });
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des photos:', error);
        document.getElementById('photos-grid').innerHTML = '<p class="error-message">Erreur lors du chargement des photos.</p>';
    }
}

// Configuration de l'upload de fichiers
function setupFileUpload(userId, familyId) {
    const uploadBtn = document.getElementById('upload-file-btn');
    const dropzoneContainer = document.getElementById('dropzone-container');
    const cancelBtn = document.getElementById('cancel-upload-btn');
    
    uploadBtn.addEventListener('click', () => {
        dropzoneContainer.classList.remove('hidden');
        uploadBtn.disabled = true;
    });
    
    cancelBtn.addEventListener('click', () => {
        dropzoneContainer.classList.add('hidden');
        uploadBtn.disabled = false;
    });
    
    // Configuration de Dropzone
    Dropzone.autoDiscover = false;
    const fileDropzone = new Dropzone("#document-upload", {
        url: "#", // URL factice, nous utiliserons Firebase Storage directement
        autoProcessQueue: false,
        addRemoveLinks: true,
        maxFilesize: 10, // MB
        acceptedFiles: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt",
        dictDefaultMessage: "Déposez vos fichiers ici ou cliquez pour sélectionner",
        dictRemoveFile: "Supprimer",
        dictCancelUpload: "Annuler",
        dictMaxFilesExceeded: "Vous ne pouvez pas ajouter plus de fichiers."
    });
    
    fileDropzone.on("addedfile", async (file) => {
        try {
            // Créer une référence au fichier dans Firebase Storage
            const storageRef = storage.ref(`families/${familyId}/files/${Date.now()}_${file.name}`);
            
            // Télécharger le fichier
            const snapshot = await storageRef.put(file);
            
            // Obtenir l'URL de téléchargement
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // Enregistrer les métadonnées du fichier dans Firestore
            await db.collection('families').doc(familyId).collection('files').add({
                name: file.name,
                type: file.type,
                size: file.size,
                url: downloadURL,
                path: storageRef.fullPath,
                ownerId: userId,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Marquer le fichier comme traité
            file.status = "success";
            fileDropzone.emit("success", file);
            fileDropzone.emit("complete", file);
            
        } catch (error) {
            console.error('Erreur lors du téléchargement du fichier:', error);
            file.status = "error";
            fileDropzone.emit("error", file, error.message);
            fileDropzone.emit("complete", file);
        }
    });
    
    fileDropzone.on("queuecomplete", () => {
        // Recharger la liste des fichiers
        loadUserFiles(userId, familyId);
        
        // Réinitialiser l'interface
        setTimeout(() => {
            fileDropzone.removeAllFiles(true);
            dropzoneContainer.classList.add('hidden');
            uploadBtn.disabled = false;
        }, 1500);
    });
}

// Configuration de l'upload de photos
function setupPhotoUpload(userId, familyId) {
    const uploadBtn = document.getElementById('upload-photo-btn');
    const dropzoneContainer = document.getElementById('photo-dropzone-container');
    const cancelBtn = document.getElementById('cancel-photo-upload-btn');
    
    uploadBtn.addEventListener('click', () => {
        dropzoneContainer.classList.remove('hidden');
        uploadBtn.disabled = true;
    });
    
    cancelBtn.addEventListener('click', () => {
        dropzoneContainer.classList.add('hidden');
        uploadBtn.disabled = false;
    });
    
    // Configuration de Dropzone
    Dropzone.autoDiscover = false;
    const photoDropzone = new Dropzone("#photo-upload", {
        url: "#", // URL factice, nous utiliserons Firebase Storage directement
        autoProcessQueue: false,
        addRemoveLinks: true,
        maxFilesize: 5, // MB
        acceptedFiles: "image/jpeg,image/png,image/gif",
        dictDefaultMessage: "Déposez vos photos ici ou cliquez pour sélectionner",
        dictRemoveFile: "Supprimer",
        dictCancelUpload: "Annuler",
        dictMaxFilesExceeded: "Vous ne pouvez pas ajouter plus de photos."
    });
    
    photoDropzone.on("addedfile", async (file) => {
        try {
            // Créer une référence au fichier dans Firebase Storage
            const storageRef = storage.ref(`families/${familyId}/photos/${Date.now()}_${file.name}`);
            
            // Télécharger le fichier
            const snapshot = await storageRef.put(file);
            
            // Obtenir l'URL de téléchargement
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // Créer une miniature si c'est une grande image
            let thumbnailUrl = null;
            if (file.size > 500000) { // 500KB
                // Dans une vraie application, il faudrait redimensionner l'image
                // Pour simplifier, on utilise la même URL
                thumbnailUrl = downloadURL;
            }
            
            // Enregistrer les métadonnées du fichier dans Firestore
            await db.collection('families').doc(familyId).collection('files').add({
                name: file.name,
                type: file.type,
                size: file.size,
                url: downloadURL,
                thumbnailUrl: thumbnailUrl,
                path: storageRef.fullPath,
                ownerId: userId,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Marquer le fichier comme traité
            file.status = "success";
            photoDropzone.emit("success", file);
            photoDropzone.emit("complete", file);
            
        } catch (error) {
            console.error('Erreur lors du téléchargement de la photo:', error);
            file.status = "error";
            photoDropzone.emit("error", file, error.message);
            photoDropzone.emit("complete", file);
        }
    });
    
    photoDropzone.on("queuecomplete", () => {
        // Recharger la liste des photos
        loadUserPhotos(userId, familyId);
        
        // Réinitialiser l'interface
        setTimeout(() => {
            photoDropzone.removeAllFiles(true);
            dropzoneContainer.classList.add('hidden');
            uploadBtn.disabled = false;
        }, 1500);
    });
}

// Configuration de l'upload d'avatar
function setupAvatarUpload(userId, familyId) {
    const changeAvatarBtn = document.getElementById('change-avatar-btn');
    const avatarModal = document.getElementById('avatar-modal');
    const closeBtn = avatarModal.querySelector('.close-btn');
    
    changeAvatarBtn.addEventListener('click', () => {
        avatarModal.classList.remove('hidden');
    });
    
    closeBtn.addEventListener('click', () => {
        avatarModal.classList.add('hidden');
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === avatarModal) {
            avatarModal.classList.add('hidden');
        }
    });
    
    // Configuration de Dropzone pour l'avatar
    Dropzone.autoDiscover = false;
    const avatarDropzone = new Dropzone("#avatar-upload", {
        url: "#", // URL factice, nous utiliserons Firebase Storage directement
        autoProcessQueue: false,
        maxFiles: 1,
        maxFilesize: 2, // MB
        acceptedFiles: "image/jpeg,image/png",
        dictDefaultMessage: "Déposez une image ici ou cliquez pour sélectionner",
    });
    
    avatarDropzone.on("addedfile", async (file) => {
        try {
            // Créer une référence au fichier dans Firebase Storage
            const storageRef = storage.ref(`families/${familyId}/avatars/${userId}_${Date.now()}`);
            
            // Télécharger le fichier
            const snapshot = await storageRef.put(file);
            
            // Obtenir l'URL de téléchargement
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // Mettre à jour l'avatar dans Firestore
            await db.collection('families').doc(familyId).collection('members').doc(userId).update({
                profilePicture: downloadURL
            });
            
            // Mettre à jour également dans la collection des membres de famille
            await db.collection('familyMembers').doc(userId).update({
                profilePicture: downloadURL
            });
            
            // Mettre à jour l'avatar dans l'interface
            document.getElementById('profile-avatar').src = downloadURL;
            document.getElementById('user-avatar').src = downloadURL;
            
            // Fermer la modal
            avatarModal.classList.add('hidden');
            
            // Marquer le fichier comme traité
            file.status = "success";
            avatarDropzone.emit("success", file);
            avatarDropzone.emit("complete", file);
            
        } catch (error) {
            console.error('Erreur lors du téléchargement de l\'avatar:', error);
            file.status = "error";
            avatarDropzone.emit("error", file, error.message);
            avatarDropzone.emit("complete", file);
        }
    });
    
    avatarDropzone.on("queuecomplete", () => {
        // Réinitialiser l'interface
        setTimeout(() => {
            avatarDropzone.removeAllFiles(true);
        }, 1500);
    });
}

// Configuration de l'édition du profil
function setupProfileEditing(userId, familyId) {
    const editBtn = document.getElementById('edit-profile-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const profileInfo = document.getElementById('profile-info');
    const editForm = document.getElementById('edit-profile-form');
    const profileForm = document.getElementById('profile-form');
    
    editBtn.addEventListener('click', () => {
        profileInfo.classList.add('hidden');
        editForm.classList.remove('hidden');
    });
    
    cancelBtn.addEventListener('click', () => {
        profileInfo.classList.remove('hidden');
        editForm.classList.add('hidden');
    });
    
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('edit-name').value;
        
        try {
            // Mettre à jour le nom dans Firestore
            await db.collection('families').doc(familyId).collection('members').doc(userId).update({
                fullName: fullName
            });
            
            // Mettre à jour également dans la collection des membres de famille
            await db.collection('familyMembers').doc(userId).update({
                fullName: fullName
            });
            
            // Mettre à jour l'interface
            document.getElementById('profile-name').textContent = fullName;
            document.getElementById('user-name').textContent = fullName;
            
            // Fermer le formulaire
            profileInfo.classList.remove('hidden');
            editForm.classList.add('hidden');
            
        } catch (error) {
            console.error('Erreur lors de la mise à jour du profil:', error);
            alert("Une erreur s'est produite lors de la mise à jour du profil.");
        }
    });
}

// Supprimer un fichier
async function deleteFile(fileId, familyId) {
    try {
        // Récupérer les informations du fichier
        const fileRef = db.collection('families').doc(familyId).collection('files').doc(fileId);
        const fileDoc = await fileRef.get();
        
        if (!fileDoc.exists) {
            console.error('Fichier non trouvé');
            return;
        }
        
        const fileData = fileDoc.data();
        
        // Supprimer le fichier du Storage
        if (fileData.path) {
            const storageRef = storage.ref(fileData.path);
            await storageRef.delete();
        }
        
        // Supprimer les métadonnées de Firestore
        await fileRef.delete();
        
    } catch (error) {
        console.error('Erreur lors de la suppression du fichier:', error);
        throw error;
    }
}

// Formater la taille du fichier
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' octets';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
    else return (bytes / 1048576).toFixed(1) + ' Mo';
}

// Formater la date
function formatDate(timestamp) {
    if (!timestamp) return 'Date inconnue';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}