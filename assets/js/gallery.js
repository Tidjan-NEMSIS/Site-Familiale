// assets/js/gallery.js

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const user = await initPage();
        if (!user) return;

        const userInfo = await getUserAndFamilyInfo(user.uid);
        if (!userInfo) return;

        // Configuration de Dropzone pour le téléchargement de photos
        setupPhotoUploader(userInfo.familyId);

        // Initialiser la galerie
        initGalleryPage(userInfo.familyId, user.uid);

        // Charger les albums
        loadAlbums(userInfo.familyId);

        // Ajouter les événements pour les contrôles de la galerie
        setupGalleryControls();

    } catch (error) {
        console.error('Erreur sur la page galerie:', error);
        alert('Une erreur est survenue lors du chargement de la galerie. Veuillez consulter la console pour plus de détails.'); // Message plus convivial
    }
});

// Initialise la page de galerie et charge les photos
async function initGalleryPage(familyId, userId) {
    // Chargement initial des photos
    await loadPhotos(familyId, null, 'date-desc');

    // Configurer les contrôles de tri et de filtrage
    document.getElementById('sort-select').addEventListener('change', async function() {
        const albumId = document.getElementById('album-select').value;
        const sortOrder = this.value;
        await loadPhotos(familyId, albumId === 'all' ? null : albumId, sortOrder);
    });

    document.getElementById('album-select').addEventListener('change', async function() {
        const albumId = this.value;
        const sortOrder = document.getElementById('sort-select').value;
        await loadPhotos(familyId, albumId === 'all' ? null : albumId, sortOrder);
    });

    // Bouton "Voir plus"
    document.getElementById('load-more-btn').addEventListener('click', function() {
        const albumId = document.getElementById('album-select').value;
        const sortOrder = document.getElementById('sort-select').value;
        loadMorePhotos(familyId, albumId === 'all' ? null : albumId, sortOrder);
    });
}

// Configure les contrôles de la galerie (création d'album, téléchargement)
function setupGalleryControls() {
    // Afficher le formulaire de création d'album
    document.getElementById('create-album-btn').addEventListener('click', function() {
        document.getElementById('album-form-container').classList.remove('hidden');
    });

    // Masquer le formulaire de création d'album
    document.getElementById('cancel-album-btn').addEventListener('click', function() {
        document.getElementById('album-form-container').classList.add('hidden');
        document.getElementById('album-form').reset();
    });

    // Soumettre le formulaire de création d'album
    document.getElementById('album-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await createAlbum();
    });

    // Afficher le formulaire de téléchargement de photos
    document.getElementById('upload-photos-btn').addEventListener('click', function() {
        document.getElementById('upload-photos-container').classList.remove('hidden');
    });

    // Masquer le formulaire de téléchargement de photos
    document.getElementById('cancel-upload-btn').addEventListener('click', function() {
        document.getElementById('upload-photos-container').classList.add('hidden');
        myDropzone.removeAllFiles(true);
    });

    // Modal de détail photo
    const modal = document.getElementById('photo-detail-modal');
    const closeBtn = modal.querySelector('.close-btn');

    closeBtn.addEventListener('click', function() {
        modal.classList.add('hidden');
    });

    // Fermer les modals lors d'un clic en dehors du contenu
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Formulaire de commentaire
    document.getElementById('comment-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        await addPhotoComment();
    });
}

let lastVisible = null;
let isLoadingPhotos = false;

// Charge les photos depuis Firestore
async function loadPhotos(familyId, albumId, sortOrder, append = false) {
    if (isLoadingPhotos) return;
    isLoadingPhotos = true;

    const photosGrid = document.getElementById('photos-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (!append) {
        photosGrid.innerHTML = '<p class="loading-message">Chargement des photos...</p>';
        lastVisible = null;
    }

    try {
        // Construire la requête
        let query = db.collection('families').doc(familyId)
            .collection('files')
            .where('type', 'in', ['image/jpeg', 'image/png', 'image/gif']);

        // Filtrer par album si nécessaire
        if (albumId) {
            query = query.where('albumId', '==', albumId);
        }

        // Appliquer le tri
        switch (sortOrder) {
            case 'date-desc':
                query = query.orderBy('uploadedAt', 'desc');
                break;
            case 'date-asc':
                query = query.orderBy('uploadedAt', 'asc');
                break;
            case 'likes-desc':
                query = query.orderBy('likesCount', 'desc').orderBy('uploadedAt', 'desc');
                break;
            default:
                query = query.orderBy('uploadedAt', 'desc');
        }

        // Pagination
        if (lastVisible) {
            query = query.startAfter(lastVisible);
        }

        // Limiter le nombre de résultats
        query = query.limit(12);

        // Exécuter la requête
        const snapshot = await query.get();

        // Masquer le message de chargement si c'est la première fois
        if (!append) {
            photosGrid.innerHTML = '';
        }

        if (snapshot.empty && !append) {
            photosGrid.innerHTML = '<p class="no-photos-message">Aucune photo disponible</p>';
            loadMoreBtn.classList.add('hidden');
            isLoadingPhotos = false;
            return;
        }

        // Mettre à jour le dernier élément visible pour la pagination
        if (!snapshot.empty) {
            lastVisible = snapshot.docs[snapshot.docs.length - 1];

            // Vérifier s'il y a plus de photos à charger
            const moreQuery = db.collection('families').doc(familyId)
                .collection('files')
                .where('type', 'in', ['image/jpeg', 'image/png', 'image/gif']);

            if (albumId) {
                moreQuery.where('albumId', '==', albumId);
            }

            const more = await moreQuery.orderBy('uploadedAt', 'desc')
                .startAfter(lastVisible)
                .limit(1)
                .get();

            if (!more.empty) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }

            // Afficher les photos
            const currentUser = auth.currentUser;

            snapshot.forEach(doc => {
                const photo = doc.data();
                const photoId = doc.id;

                const photoElement = document.createElement('div');
                photoElement.className = 'photo-item';

                photoElement.innerHTML = `
                    <div class="photo-container">
                        <img src="${photo.thumbnailUrl || photo.url}" alt="${photo.name}" loading="lazy">
                        <div class="photo-overlay">
                            <div class="photo-actions">
                                <button class="photo-action-btn view-btn" data-photo-id="${photoId}">
                                    <span class="icon view-icon"></span>
                                </button>
                                <button class="photo-action-btn like-btn ${photo.likes && photo.likes[currentUser.uid] ? 'liked' : ''}" data-photo-id="${photoId}">
                                    <span class="icon heart-icon"></span>
                                    <span class="like-count">${photo.likesCount || 0}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                photosGrid.appendChild(photoElement);

                // Ajouter l'événement pour visualiser la photo
                photoElement.querySelector('.view-btn').addEventListener('click', function() {
                    showPhotoDetails(photoId, familyId);
                });

                // Ajouter l'événement pour aimer la photo
                photoElement.querySelector('.like-btn').addEventListener('click', function() {
                    toggleLikePhoto(photoId, familyId, this);
                });
            });
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des photos:', error);
        photosGrid.innerHTML = '<p class="error-message">Erreur lors du chargement des photos</p>';
    } finally {
        isLoadingPhotos = false;
    }
}

// Charge plus de photos (pagination)
function loadMorePhotos(familyId, albumId, sortOrder) {
    loadPhotos(familyId, albumId, sortOrder, true);
}

let myDropzone;

// Configure le téléchargement de photos avec Dropzone.js
function setupPhotoUploader(familyId) {
    // Vérifier si Dropzone est disponible
    if (typeof Dropzone === 'undefined') {
        console.error('Dropzone n\'est pas chargé');
        return;
    }

    // Configuration Dropzone
    Dropzone.autoDiscover = false;

    myDropzone = new Dropzone('#photos-upload', {
        url: '/upload-photo', // Ceci est une URL factice, vous devrez la remplacer par votre endpoint d'upload
        autoProcessQueue: false,
        uploadMultiple: true,
        parallelUploads: 3,
        maxFilesize: 5, // 5 MB
        acceptedFiles: 'image/*',
        addRemoveLinks: true,
        dictRemoveFile: 'Retirer',
        dictFileTooBig: 'Image trop grande ({{filesize}}MB). Taille max: {{maxFilesize}}MB.',
        dictInvalidFileType: 'Type de fichier invalide. Seules les images sont acceptées.'
    });

    myDropzone.on('addedfile', function(file) {
        console.log('Fichier ajouté:', file.name);
    });

    myDropzone.on('removedfile', function(file) {
        console.log('Fichier retiré:', file.name);
    });

    myDropzone.on('sending', function(file, xhr, formData) {
        // Ceci est simulé puisque nous utilisons Firebase Storage
        xhr.abort();

        // Récupérer l'album sélectionné
        const albumId = document.getElementById('upload-album-select').value;

        // Télécharger vers Firebase Storage
        uploadPhotoToFirebase(file, familyId, albumId === 'none' ? null : albumId);
    });

    // Simuler le processus de téléchargement lors de l'ajout de fichiers
    myDropzone.on('queuecomplete', function() {
        setTimeout(function() {
            document.getElementById('upload-photos-container').classList.add('hidden');
            myDropzone.removeAllFiles(true);

            // Recharger les photos
            const albumId = document.getElementById('album-select').value;
            const sortOrder = document.getElementById('sort-select').value;
            loadPhotos(familyId, albumId === 'all' ? null : albumId, sortOrder);
        }, 1500);
    });

    // Événement pour démarrer le téléchargement
    myDropzone.on('sendingMultiple', function() {
        // Cette fonction est appelée avant le téléchargement multiple
        console.log('Démarrage du téléchargement multiple');
    });

    // Remplacer le comportement par défaut pour utiliser Firebase
    document.querySelector('#photos-upload').addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();

        if (myDropzone.getQueuedFiles().length > 0) {
            myDropzone.processQueue();
        } else {
            alert('Veuillez ajouter au moins une photo');
        }
    });
}

// Télécharge une photo vers Firebase Storage
async function uploadPhotoToFirebase(file, familyId, albumId) {
    try {
        const currentUser = auth.currentUser;

        if (!currentUser) {
            console.error('Utilisateur non connecté');
            return;
        }

        // Générer un nom de fichier unique
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

        // Référence vers le chemin de stockage
        const storageRef = storage.ref(`families/${familyId}/photos/${fileName}`);

        // Télécharger le fichier
        const uploadTask = storageRef.put(file);

        // Suivre la progression du téléchargement
        uploadTask.on('state_changed',
            (snapshot) => {
                // Progression
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Progression du téléchargement:', progress.toFixed(2) + '%');
            },
            (error) => {
                // Erreur
                console.error('Erreur de téléchargement:', error);
                alert('Une erreur est survenue lors du téléchargement de la photo. Veuillez vérifier la console pour plus de détails.');
            },
            async () => {
                // Téléchargement terminé
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();

                // Créer une miniature pour une meilleure performance
                // (Dans une application réelle, vous utiliseriez un service côté serveur pour cela)
                // Pour l'instant, nous utilisons la même URL pour la miniature
                const thumbnailUrl = downloadURL;

                // Enregistrer les métadonnées dans Firestore
                await db.collection('families').doc(familyId).collection('files').add({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: downloadURL,
                    thumbnailUrl: thumbnailUrl,
                    path: `families/${familyId}/photos/${fileName}`,
                    uploadedBy: currentUser.uid,
                    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    albumId: albumId,
                    likesCount: 0,
                    likes: {},
                    commentsCount: 0
                });

                console.log('Photo téléchargée avec succès:', file.name);
            }
        );
    } catch (error) {
        console.error('Erreur lors du téléchargement de la photo:', error);
        alert('Une erreur est survenue lors du téléchargement de la photo. Veuillez vérifier la console pour plus de détails.');
    }
}

// Charger la liste des albums disponibles pour la famille
async function loadAlbums(familyId) {
    try {
        const albumSelect = document.getElementById('album-select');
        const uploadAlbumSelect = document.getElementById('upload-album-select');

        // Garder les options par défaut
        const defaultOption = albumSelect.querySelector('option[value="all"]');
        const uploadDefaultOption = uploadAlbumSelect.querySelector('option[value="none"]');

        // Vider les listes existantes
        albumSelect.innerHTML = '';
        uploadAlbumSelect.innerHTML = '';

        // Remettre les options par défaut
        albumSelect.appendChild(defaultOption);
        uploadAlbumSelect.appendChild(uploadDefaultOption);

        // Charger les albums depuis Firestore
        const snapshot = await db.collection('families').doc(familyId)
            .collection('albums')
            .orderBy('createdAt', 'desc')
            .get();

        snapshot.forEach(doc => {
            const album = doc.data();
            const albumId = doc.id;

            // Ajouter l'option au sélecteur principal
            const option = document.createElement('option');
            option.value = albumId;
            option.textContent = album.name;
            albumSelect.appendChild(option);

            // Ajouter l'option au sélecteur de téléchargement
            const uploadOption = document.createElement('option');
            uploadOption.value = albumId;
            uploadOption.textContent = album.name;
            uploadAlbumSelect.appendChild(uploadOption);
        });

    } catch (error) {
        console.error('Erreur lors du chargement des albums:', error);
        alert('Une erreur est survenue lors du chargement des albums. Veuillez vérifier la console pour plus de détails.');
    }
}

// Créer un nouvel album
async function createAlbum() {
    try {
        const albumName = document.getElementById('album-name').value.trim();
        const albumDescription = document.getElementById('album-description').value.trim();

        if (!albumName) {
            alert('Veuillez entrer un nom pour l\'album');
            return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error('Utilisateur non connecté');
            return;
        }

        const userInfo = await getUserAndFamilyInfo(currentUser.uid);
        if (!userInfo || !userInfo.familyId) {
            console.error('Informations de famille non trouvées');
            return;
        }

        // Créer l'album dans Firestore
        await db.collection('families').doc(userInfo.familyId).collection('albums').add({
            name: albumName,
            description: albumDescription,
            createdBy: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            photosCount: 0
        });

        // Masquer le formulaire et réinitialiser
        document.getElementById('album-form-container').classList.add('hidden');
        document.getElementById('album-form').reset();

        // Recharger la liste des albums
        await loadAlbums(userInfo.familyId);

        // Afficher un message de succès
        alert('Album créé avec succès');

    } catch (error) {
        console.error('Erreur lors de la création de l\'album:', error);
        alert('Une erreur est survenue lors de la création de l\'album. Veuillez vérifier la console pour plus de détails.');
    }
}

// Affiche les détails d'une photo
async function showPhotoDetails(photoId, familyId) {
    try {
        const modal = document.getElementById('photo-detail-modal');

        // Afficher un indicateur de chargement
        document.getElementById('detail-photo-img').src = 'assets/img/loading.gif'; // Indicateur de chargement
        document.getElementById('detail-photo-name').textContent = 'Chargement...';
        document.getElementById('detail-author-name').textContent = '';
        document.getElementById('detail-photo-date').textContent = '';
        document.getElementById('detail-photo-album').textContent = '';
        document.getElementById('detail-likes-count').textContent = '0';
        document.getElementById('detail-comments-list').innerHTML = '<p>Chargement des commentaires...</p>';

        // Afficher la modal
        modal.classList.remove('hidden');

        // Charger les détails de la photo
        const photoDoc = await db.collection('families').doc(familyId)
            .collection('files')
            .doc(photoId)
            .get();

        if (!photoDoc.exists) {
            console.error('Photo non trouvée');
            alert("La photo demandée n'existe pas."); // Message utilisateur
            modal.classList.add('hidden'); // Cacher la modal
            return;
        }

        const photo = photoDoc.data();
        const currentUser = auth.currentUser;

        // Mettre à jour l'image
        document.getElementById('detail-photo-img').src = photo.url;
        document.getElementById('detail-photo-name').textContent = photo.name;

        // Formater la date
        const photoDate = photo.uploadedAt ? new Date(photo.uploadedAt.toDate()) : new Date();
        document.getElementById('detail-photo-date').textContent = photoDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Charger les informations de l'utilisateur qui a téléchargé la photo
        const userDoc = await db.collection('users').doc(photo.uploadedBy).get(); // Charger depuis la collection 'users'
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('detail-author-name').textContent = userData.displayName || 'Utilisateur inconnu';
            document.getElementById('detail-author-avatar').src = userData.photoURL || 'assets/img/default-avatar.png';
        } else {
             document.getElementById('detail-author-name').textContent = 'Utilisateur inconnu';
             document.getElementById('detail-author-avatar').src = 'assets/img/default-avatar.png';
        }


        // Charger les informations de l'album
        if (photo.albumId) {
            const albumDoc = await db.collection('families').doc(familyId)
                .collection('albums')
                .doc(photo.albumId)
                .get();

            if (albumDoc.exists) {
                const album = albumDoc.data();
                document.getElementById('detail-photo-album').textContent = `Album: ${album.name}`;
            } else {
                document.getElementById('detail-photo-album').textContent = 'Album: Aucun';
            }
        } else {
            document.getElementById('detail-photo-album').textContent = 'Album: Aucun';
        }

        // Mettre à jour le compteur de likes
        document.getElementById('detail-likes-count').textContent = photo.likesCount || 0;

        // Mettre à jour le bouton de like
        const likeBtn = document.getElementById('detail-like-btn');
        if (photo.likes && photo.likes[currentUser.uid]) {
            likeBtn.classList.add('liked');
        } else {
            likeBtn.classList.remove('liked');
        }

        // Mettre à jour le bouton de téléchargement, et le rendre fonctionel
        const downloadButton = document.getElementById('detail-download-btn');
        downloadButton.href = photo.url;
        downloadButton.download = photo.name; //le nom de telechargement
        downloadButton.setAttribute('target', '_blank'); // Ouvrir dans un nouvel onglet


        // Afficher le bouton de suppression si l'utilisateur est le propriétaire
        const deleteBtn = document.getElementById('detail-delete-btn');
        if (photo.uploadedBy === currentUser.uid) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.setAttribute('data-photo-id', photoId); // Important pour la fonction deletePhoto
        } else {
            deleteBtn.classList.add('hidden');
        }

        // Ajouter les événements aux boutons (utiliser des fonctions fléchées pour conserver le contexte)
        likeBtn.onclick = () => toggleLikePhoto(photoId, familyId, likeBtn);  // 'this' sera correct
        deleteBtn.onclick = () => deletePhoto(photoId, familyId);

        // Charger les commentaires
        loadPhotoComments(photoId, familyId);

        // Mettre à jour le formulaire de commentaire
        document.getElementById('comment-form').onsubmit = function(e) {
            e.preventDefault();
            addPhotoComment(photoId, familyId);
        };

    } catch (error) {
        console.error('Erreur lors de l\'affichage des détails de la photo:', error);
        alert('Une erreur est survenue lors de l\'affichage des détails de la photo. Veuillez consulter la console pour plus de détails.');
        modal.classList.add('hidden'); // Cacher la modal en cas d'erreur
    }
}

// Ajoute ou retire un like sur une photo (Refactorisée pour plus de clarté)
async function toggleLikePhoto(photoId, familyId, likeBtn) {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const photoRef = db.collection('families').doc(familyId)
            .collection('files')
            .doc(photoId);

        const photoDoc = await photoRef.get();
        if (!photoDoc.exists) return;

        const photo = photoDoc.data();
        const likes = photo.likes || {}; // S'assurer que 'likes' existe
        let likesCount = photo.likesCount || 0; // S'assurer que 'likesCount' existe

        // Vérifier si l'utilisateur a déjà aimé la photo
        if (likes[currentUser.uid]) {
            // Retirer le like (mise à jour atomique)
            await photoRef.update({
                [`likes.${currentUser.uid}`]: firebase.firestore.FieldValue.delete(),
                likesCount: firebase.firestore.FieldValue.increment(-1) // Décrémenter
            });
            likesCount--; // Mettre à jour la variable locale

            likeBtn.classList.remove('liked');

        } else {
            // Ajouter le like (mise à jour atomique)
            await photoRef.update({
                [`likes.${currentUser.uid}`]: true,
                likesCount: firebase.firestore.FieldValue.increment(1) // Incrémenter
            });
            likesCount++; // Mettre à jour la variable locale
            likeBtn.classList.add('liked');
        }

        // Mettre à jour le compteur dans la vue détaillée (si elle est affichée)
        const detailLikesCount = document.getElementById('detail-likes-count');
        if (detailLikesCount) {
            detailLikesCount.textContent = likesCount;
        }

        // Mettre à jour le compteur dans la grille (utiliser le bouton passé en paramètre)
        const likeCountElement = likeBtn.querySelector('.like-count');
        if (likeCountElement) {
            likeCountElement.textContent = likesCount;
        }


    } catch (error) {
        console.error('Erreur lors de la modification du like:', error);
        alert("Une erreur est survenue lors de la modification du like. Veuillez consulter la console pour plus de détails."); // Message utilisateur
    }
}

// Charge les commentaires d'une photo
async function loadPhotoComments(photoId, familyId) {
    try {
        const commentsContainer = document.getElementById('detail-comments-list');
        commentsContainer.innerHTML = '<p>Chargement des commentaires...</p>';

        const commentsSnapshot = await db.collection('families').doc(familyId)
            .collection('files')
            .doc(photoId)
            .collection('comments')
            .orderBy('createdAt', 'desc') // Ordre chronologique inversé
            .get();

        if (commentsSnapshot.empty) {
            commentsContainer.innerHTML = '<p class="no-comments">Aucun commentaire pour le moment</p>';
            return;
        }

        commentsContainer.innerHTML = ''; // Effacer le message de chargement

        // Charger tous les commentaires
        const comments = [];
        commentsSnapshot.forEach(doc => {
            comments.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Charger les informations des utilisateurs (optimisé pour éviter les requêtes répétées)
        const userIds = [...new Set(comments.map(comment => comment.userId))];
        const userDocs = await Promise.all(
            userIds.map(userId => db.collection('users').doc(userId).get()) // Charger depuis la collection 'users'
        );

        const users = {};
        userDocs.forEach(doc => {
            if (doc.exists) {
                users[doc.id] = doc.data();
            }
        });

        // Afficher les commentaires
        comments.forEach(comment => {
            const user = users[comment.userId] || {}; // Utiliser les données utilisateur
            const commentDate = comment.createdAt ? new Date(comment.createdAt.toDate()) : new Date();

            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';
            commentElement.innerHTML = `
                <div class="comment-author">
                    <img src="${user.photoURL || 'assets/img/default-avatar.png'}" alt="Avatar" class="comment-avatar">
                    <div class="comment-meta">
                        <span class="comment-author-name">${user.displayName || 'Utilisateur inconnu'}</span>
                        <span class="comment-date">${commentDate.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</span>
                    </div>
                </div>
                <div class="comment-content">${comment.content}</div>
            `;

            commentsContainer.appendChild(commentElement);
        });

    } catch (error) {
        console.error('Erreur lors du chargement des commentaires:', error);
        document.getElementById('detail-comments-list').innerHTML = '<p class="error-message">Erreur lors du chargement des commentaires</p>';
    }
}

// Ajoute un commentaire à une photo
async function addPhotoComment(photoId, familyId) {
    try {
        const commentInput = document.getElementById('comment-input');
        const commentContent = commentInput.value.trim();

        if (!commentContent) {
            return; // Ne rien faire si le commentaire est vide
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error('Utilisateur non connecté');
            return;
        }

        // Ajouter le commentaire à Firestore
        await db.collection('families').doc(familyId)
            .collection('files')
            .doc(photoId)
            .collection('comments')
            .add({
                content: commentContent,
                userId: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        // Mettre à jour le compteur de commentaires (optimisé)
        const photoRef = db.collection('families').doc(familyId)
            .collection('files')
            .doc(photoId);

        await photoRef.update({
            commentsCount: firebase.firestore.FieldValue.increment(1)
        });

        // Effacer le champ de commentaire
        commentInput.value = '';

        // Recharger les commentaires
        await loadPhotoComments(photoId, familyId);

    } catch (error) {
        console.error('Erreur lors de l\'ajout du commentaire:', error);
        alert("Une erreur est survenue lors de l'ajout du commentaire. Veuillez vérifier la console pour plus de détails.");
    }
}

// Supprime une photo
async function deletePhoto(photoId, familyId) {
    try {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
            return;
        }

        const photoRef = db.collection('families').doc(familyId)
            .collection('files')
            .doc(photoId);

        // Récupérer les informations de la photo
        const photoDoc = await photoRef.get();
        if (!photoDoc.exists) {
            console.error('Photo non trouvée');
            alert("La photo que vous essayez de supprimer n'existe pas.");
            return;
        }

        const photo = photoDoc.data();

        // Supprimer le fichier de Storage
        if (photo.path) {
            const storageRef = storage.ref(photo.path);
            await storageRef.delete();
        }

        // Supprimer la photo de Firestore
        await photoRef.delete();

        // Mettre à jour le compteur de photos dans l'album (si la photo est dans un album)
        if (photo.albumId) {
            await db.collection('families').doc(familyId)
                .collection('albums')
                .doc(photo.albumId)
                .update({
                    photosCount: firebase.firestore.FieldValue.increment(-1)
                });
        }

        // Fermer la modal
        document.getElementById('photo-detail-modal').classList.add('hidden');

        // Recharger la galerie (recharger depuis le début)
        const albumId = document.getElementById('album-select').value;
        const sortOrder = document.getElementById('sort-select').value;
        await loadPhotos(familyId, albumId === 'all' ? null : albumId, sortOrder);

        // Afficher un message de succès
        alert('Photo supprimée avec succès');

    } catch (error) {
        console.error('Erreur lors de la suppression de la photo:', error);
        alert("Une erreur est survenue lors de la suppression de la photo. Veuillez vérifier la console pour plus de détails.");
    }
}