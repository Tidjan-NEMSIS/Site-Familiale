// assets/js/family-wall.js

// Variables globales pour la gestion des posts
let currentUser;
let familyId;
let postsLimit = 5;
let lastVisible = null;
let activeFilter = 'all';
let currentPostId = null;

// Initialisation de la page
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Authentification et récupération des informations utilisateur
        const user = await initPage();
        if (!user) return;

        currentUser = user;
        const userInfo = await getUserAndFamilyInfo(user.uid);
        if (!userInfo) return;

        familyId = userInfo.familyId;

        // Mise à jour de l'avatar dans le formulaire de post
        const postAvatar = document.getElementById('post-avatar');
        if (userInfo.profilePicture) {
            postAvatar.src = userInfo.profilePicture;
        }

        // Initialisation des événements
        initEventListeners();
        
        // Chargement initial des posts
        loadPosts(true);
        
    } catch (error) {
        console.error('Erreur d\'initialisation du mur familial:', error);
        showNotification('Une erreur est survenue lors du chargement de la page', 'error');
    }
});

// Configuration des écouteurs d'événements
function initEventListeners() {
    // Gestion du formulaire de publication
    const postForm = document.getElementById('post-form');
    const postImage = document.getElementById('post-image');
    const removeImageBtn = document.getElementById('remove-image-btn');
    
    postForm.addEventListener('submit', handlePostSubmit);
    postImage.addEventListener('change', handleImagePreview);
    removeImageBtn.addEventListener('click', removeImagePreview);
    
    // Gestion des filtres
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            activeFilter = this.dataset.filter;
            loadPosts(true);
        });
    });
    
    // Gestion du bouton "Voir plus"
    const loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.addEventListener('click', () => loadPosts(false));
    
    // Gestion des événements de délégation pour le conteneur de posts
    const postsContainer = document.getElementById('posts-container');
    postsContainer.addEventListener('click', handlePostsContainerClick);
    
    // Gestion de la modal des commentaires
    const commentsModal = document.getElementById('comments-modal');
    const commentForm = document.getElementById('comment-form');
    const closeButtons = document.querySelectorAll('.close-btn');
    
    commentForm.addEventListener('submit', handleCommentSubmit);
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            closeModal(modal);
        });
    });
    
    // Fermeture de la modal au clic en dehors du contenu
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target);
        }
    });
}

// Gestion des clics sur les éléments du conteneur de posts (délégation d'événements)
function handlePostsContainerClick(event) {
    const target = event.target;
    
    // Gestion des liens pour les commentaires
    if (target.classList.contains('comments-link') || target.closest('.comments-link')) {
        event.preventDefault();
        const postElement = target.closest('.post-item');
        const postId = postElement.dataset.postId;
        openCommentsModal(postId);
    }
    
    // Gestion des boutons "J'aime"
    if (target.classList.contains('like-btn') || target.closest('.like-btn')) {
        const postElement = target.closest('.post-item');
        const postId = postElement.dataset.postId;
        toggleLike(postId);
    }
    
    // Gestion des boutons de suppression
    if (target.classList.contains('delete-post-btn') || target.closest('.delete-post-btn')) {
        const postElement = target.closest('.post-item');
        const postId = postElement.dataset.postId;
        confirmDeletePost(postId);
    }
}

// Chargement des posts
async function loadPosts(isInitialLoad) {
    try {
        if (isInitialLoad) {
            lastVisible = null;
            document.getElementById('posts-container').innerHTML = '<p class="loading-message">Chargement des publications...</p>';
        }
        
        // Création de la requête de base
        let query = db.collection('families').doc(familyId).collection('posts')
            .orderBy('createdAt', 'desc');
        
        // Application des filtres
        if (activeFilter === 'my-posts') {
            query = query.where('authorId', '==', currentUser.uid);
        } else if (activeFilter === 'with-images') {
            query = query.where('hasImage', '==', true);
        }
        
        // Pagination
        if (lastVisible) {
            query = query.startAfter(lastVisible);
        }
        
        query = query.limit(postsLimit);
        
        const snapshot = await query.get();
        
        if (isInitialLoad) {
            document.getElementById('posts-container').innerHTML = '';
        }
        
        if (snapshot.empty && isInitialLoad) {
            document.getElementById('posts-container').innerHTML = '<p class="no-posts-message">Aucune publication à afficher</p>';
            document.getElementById('load-more-container').classList.add('hidden');
            return;
        }
        
        // Cache pour les informations des membres
        const membersCache = {};
        
        // Rendu des posts
        for (const doc of snapshot.docs) {
            const post = doc.data();
            
            // Récupérer les informations de l'auteur si pas déjà en cache
            if (!membersCache[post.authorId]) {
                const authorDoc = await db.collection('families').doc(familyId).collection('members').doc(post.authorId).get();
                membersCache[post.authorId] = authorDoc.exists ? authorDoc.data() : { fullName: 'Utilisateur inconnu' };
            }
            
            // Ajout du post au DOM
            const author = membersCache[post.authorId];
            await renderPost(doc.id, post, author);
        }
        
        // Mise à jour du dernier élément visible pour la pagination
        const documentsSnapshot = snapshot.docs;
        lastVisible = documentsSnapshot[documentsSnapshot.length - 1];
        
        // Gestion du bouton "Voir plus"
        document.getElementById('load-more-container').classList.toggle('hidden', documentsSnapshot.length < postsLimit);
        
    } catch (error) {
        console.error('Erreur lors du chargement des posts:', error);
        document.getElementById('posts-container').innerHTML = '<p class="error-message">Une erreur est survenue lors du chargement des publications</p>';
    }
}

// Rendu d'un post individuel
async function renderPost(postId, post, author) {
    const postsContainer = document.getElementById('posts-container');
    const postElement = document.createElement('div');
    postElement.className = 'post-item';
    postElement.dataset.postId = postId;
    
    // Vérifier si l'utilisateur a aimé le post
    let isLiked = false;
    if (post.likes && post.likes.includes(currentUser.uid)) {
        isLiked = true;
    }
    
    // Calculer le nombre de likes et de commentaires
    const likesCount = post.likes ? post.likes.length : 0;
    const commentsCount = post.commentCount || 0;
    
    postElement.innerHTML = `
        <div class="post-header">
            <img src="${author.profilePicture || 'assets/img/default-avatar.png'}" alt="${author.fullName}" class="post-avatar">
            <div>
                <div class="post-author">${author.fullName}</div>
                <div class="post-date">${formatDate(post.createdAt)}</div>
            </div>
            ${post.authorId === currentUser.uid ? `
                <div class="post-actions-menu">
                    <button class="btn btn-icon delete-post-btn">
                        <i class="delete-icon"></i>
                    </button>
                </div>
            ` : ''}
        </div>
        <div class="post-content">
            <p>${formatPostContent(post.content)}</p>
            ${post.imageUrl ? `<div class="post-image"><img src="${post.imageUrl}" alt="Image de publication"></div>` : ''}
        </div>
        <div class="post-footer">
            <div class="post-stats">
                <div class="like-stats">${likesCount > 0 ? `<span>${likesCount} j'aime</span>` : ''}</div>
                <div class="comment-stats">${commentsCount > 0 ? `<span>${commentsCount} commentaire${commentsCount > 1 ? 's' : ''}</span>` : ''}</div>
            </div>
            <div class="post-actions">
                <button class="btn btn-text like-btn ${isLiked ? 'liked' : ''}">
                    <i class="like-icon"></i> J'aime
                </button>
                <button class="btn btn-text comments-link">
                    <i class="comment-icon"></i> Commenter
                </button>
                <a href="https://wa.me/${author.phoneNumber || ''}" class="btn btn-text whatsapp-link" target="_blank" ${!author.phoneNumber ? 'style="display:none"' : ''}>
                    <i class="whatsapp-icon"></i> WhatsApp
                </a>
            </div>
        </div>
    `;
    
    postsContainer.appendChild(postElement);
}

// Formatage du contenu des posts (liens cliquables, etc.)
function formatPostContent(content) {
    if (!content) return '';
    
    // Convertir les URLs en liens cliquables
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
        .replace(/\n/g, '<br>');
}

// Gestion de la soumission d'un nouveau post
async function handlePostSubmit(event) {
    event.preventDefault();
    
    const postContent = document.getElementById('post-content').value.trim();
    const imageInput = document.getElementById('post-image');
    const imageFile = imageInput.files[0];
    
    if (!postContent && !imageFile) {
        showNotification('Veuillez ajouter du texte ou une image', 'error');
        return;
    }
    
    try {
        // Désactiver le bouton d'envoi
        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerText = 'Publication en cours...';
        
        // Création du post dans Firestore
        const postData = {
            authorId: currentUser.uid,
            content: postContent,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            likes: [],
            commentCount: 0,
            hasImage: !!imageFile
        };
        
        // Si une image est présente, la télécharger d'abord
        if (imageFile) {
            // Chemin de stockage pour l'image
            const storageRef = storage.ref(`families/${familyId}/posts/${Date.now()}_${imageFile.name}`);
            
            // Upload de l'image
            const uploadTask = await storageRef.put(imageFile);
            
            // Récupération de l'URL de l'image
            const imageUrl = await uploadTask.ref.getDownloadURL();
            postData.imageUrl = imageUrl;
        }
        
        // Ajout du post à Firestore
        await db.collection('families').doc(familyId).collection('posts').add(postData);
        
        // Réinitialisation du formulaire
        document.getElementById('post-form').reset();
        removeImagePreview();
        
        // Rechargement des posts
        loadPosts(true);
        
        showNotification('Publication ajoutée avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur lors de la publication:', error);
        showNotification('Une erreur est survenue lors de la publication', 'error');
    } finally {
        // Réactiver le bouton d'envoi
        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.innerText = 'Publier';
    }
}

// Prévisualisation de l'image avant publication
function handleImagePreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Vérifier si le fichier est une image
    if (!file.type.match('image.*')) {
        showNotification('Veuillez sélectionner une image valide', 'error');
        event.target.value = '';
        return;
    }
    
    // Limiter la taille du fichier (5 Mo)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('L\'image est trop volumineuse (max 5 Mo)', 'error');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewContainer = document.getElementById('post-image-preview');
        const previewImage = document.getElementById('preview-image');
        
        previewImage.src = e.target.result;
        previewContainer.classList.remove('hidden');
    };
    
    reader.readAsDataURL(file);
}

// Suppression de la prévisualisation d'image
function removeImagePreview() {
    const previewContainer = document.getElementById('post-image-preview');
    const previewImage = document.getElementById('preview-image');
    const fileInput = document.getElementById('post-image');
    
    previewImage.src = '#';
    previewContainer.classList.add('hidden');
    fileInput.value = '';
}

// Gestion des "J'aime" sur les posts
async function toggleLike(postId) {
    try {
        const postRef = db.collection('families').doc(familyId).collection('posts').doc(postId);
        const postDoc = await postRef.get();

        if (!postDoc.exists) {
            console.error('Post non trouvé');
            return;
        }

        const postData = postDoc.data();
        const likes = postData.likes || [];
        const userLiked = likes.includes(currentUser.uid);

        if (userLiked) {
            // Retirer le j'aime
            await postRef.update({
                likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
            });
        } else {
            // Ajouter le j'aime
            await postRef.update({
                likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
            });
        }

        // Mettre à jour l'élément de post dans le DOM
        const postElement = document.querySelector(`.post-item[data-post-id="${postId}"]`);
        if (postElement) {
            const likeBtn = postElement.querySelector('.like-btn');
            const likeStats = postElement.querySelector('.like-stats');
            
            // Mettre à jour le bouton "J'aime"
            if (userLiked) {
                likeBtn.classList.remove('liked');
            } else {
                likeBtn.classList.add('liked');
            }
            
            // Mettre à jour le nombre de likes
            const newLikesCount = userLiked ? likes.length - 1 : likes.length + 1;
            likeStats.innerHTML = newLikesCount > 0 ? `<span>${newLikesCount} j'aime</span>` : '';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du j\'aime:', error);
        showNotification('Une erreur est survenue', 'error');
    }
}

// Confirmation avant suppression d'un post
function confirmDeletePost(postId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette publication ?')) {
        deletePost(postId);
    }
}

// Suppression d'un post
async function deletePost(postId) {
    try {
        const postRef = db.collection('families').doc(familyId).collection('posts').doc(postId);
        const postDoc = await postRef.get();
        
        if (!postDoc.exists) {
            console.error('Post non trouvé');
            return;
        }
        
        const postData = postDoc.data();
        
        // Vérifier si le post appartient à l'utilisateur actuel
        if (postData.authorId !== currentUser.uid) {
            showNotification('Vous n\'avez pas les droits pour supprimer cette publication', 'error');
            return;
        }
        
        // Supprimer l'image si elle existe
        if (postData.imageUrl) {
            const imageRef = storage.refFromURL(postData.imageUrl);
            await imageRef.delete();
        }
        
        // Supprimer les commentaires liés au post
        const commentsRef = db.collection('families').doc(familyId).collection('posts').doc(postId).collection('comments');
        const commentsSnapshot = await commentsRef.get();
        
        // Supprimer chaque commentaire individuellement
        const batch = db.batch();
        commentsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        // Supprimer le post
        await postRef.delete();
        
        // Supprimer l'élément du DOM
        const postElement = document.querySelector(`.post-item[data-post-id="${postId}"]`);
        if (postElement) {
            postElement.remove();
        }
        
        showNotification('Publication supprimée avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur lors de la suppression du post:', error);
        showNotification('Une erreur est survenue lors de la suppression', 'error');
    }
}

// Ouverture de la modal des commentaires
async function openCommentsModal(postId) {
    try {
        currentPostId = postId;
        const commentsModal = document.getElementById('comments-modal');
        const commentsContainer = document.getElementById('comments-container');
        
        // Afficher un message de chargement
        commentsContainer.innerHTML = '<p class="loading-message">Chargement des commentaires...</p>';
        
        // Afficher la modal
        commentsModal.classList.remove('hidden');
        
        // Charger les commentaires
        await loadComments(postId);
        
    } catch (error) {
        console.error('Erreur lors de l\'ouverture de la modal des commentaires:', error);
        showNotification('Une erreur est survenue', 'error');
    }
}

// Chargement des commentaires
async function loadComments(postId) {
    try {
        const commentsContainer = document.getElementById('comments-container');
        
        // Récupérer les commentaires depuis Firestore
        const commentsRef = db.collection('families').doc(familyId)
            .collection('posts').doc(postId)
            .collection('comments')
            .orderBy('createdAt', 'asc');
        
        const snapshot = await commentsRef.get();
        
        if (snapshot.empty) {
            commentsContainer.innerHTML = '<p class="no-comments-message">Aucun commentaire pour le moment</p>';
            return;
        }
        
        // Vider le conteneur des commentaires
        commentsContainer.innerHTML = '';
        
        // Cache pour les informations des membres
        const membersCache = {};
        
        // Afficher les commentaires
        for (const doc of snapshot.docs) {
            const comment = doc.data();
            
            // Récupérer les informations de l'auteur si pas déjà en cache
            if (!membersCache[comment.authorId]) {
                const authorDoc = await db.collection('families').doc(familyId).collection('members').doc(comment.authorId).get();
                membersCache[comment.authorId] = authorDoc.exists ? authorDoc.data() : { fullName: 'Utilisateur inconnu' };
            }
            
            // Ajout du commentaire au DOM
            const author = membersCache[comment.authorId];
            renderComment(doc.id, comment, author);
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des commentaires:', error);
        document.getElementById('comments-container').innerHTML = '<p class="error-message">Une erreur est survenue lors du chargement des commentaires</p>';
    }
}

// Rendu d'un commentaire individuel
function renderComment(commentId, comment, author) {
    const commentsContainer = document.getElementById('comments-container');
    const commentElement = document.createElement('div');
    commentElement.className = 'comment-item';
    commentElement.dataset.commentId = commentId;
    
    commentElement.innerHTML = `
        <div class="comment-header">
            <img src="${author.profilePicture || 'assets/img/default-avatar.png'}" alt="${author.fullName}" class="comment-avatar">
            <div>
                <div class="comment-author">${author.fullName}</div>
                <div class="comment-date">${formatDate(comment.createdAt)}</div>
            </div>
            ${comment.authorId === currentUser.uid ? `
                <button class="btn btn-icon delete-comment-btn">
                    <i class="delete-icon"></i>
                </button>
            ` : ''}
        </div>
        <div class="comment-content">
            <p>${formatPostContent(comment.content)}</p>
        </div>
    `;
    
    commentsContainer.appendChild(commentElement);
    
    // Ajouter l'événement de suppression si c'est le commentaire de l'utilisateur actuel
    if (comment.authorId === currentUser.uid) {
        const deleteBtn = commentElement.querySelector('.delete-comment-btn');
        deleteBtn.addEventListener('click', () => confirmDeleteComment(commentId));
    }
}

// Gestion de la soumission d'un commentaire
async function handleCommentSubmit(event) {
    event.preventDefault();
    
    if (!currentPostId) {
        showNotification('Une erreur est survenue', 'error');
        return;
    }
    
    const commentContent = document.getElementById('comment-content').value.trim();
    
    if (!commentContent) {
        showNotification('Veuillez ajouter un commentaire', 'error');
        return;
    }
    
    try {
        // Désactiver le bouton d'envoi
        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerText = 'Envoi en cours...';
        
        // Création du commentaire dans Firestore
        const commentData = {
            authorId: currentUser.uid,
            content: commentContent,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Ajout du commentaire à Firestore
        await db.collection('families').doc(familyId)
            .collection('posts').doc(currentPostId)
            .collection('comments').add(commentData);
        
        // Incrémenter le compteur de commentaires du post
        await db.collection('families').doc(familyId)
            .collection('posts').doc(currentPostId)
            .update({
                commentCount: firebase.firestore.FieldValue.increment(1)
            });
        
        // Réinitialisation du formulaire
        document.getElementById('comment-form').reset();
        
        // Rechargement des commentaires
        await loadComments(currentPostId);
        
        // Mettre à jour le compteur de commentaires dans le DOM
        updateCommentCount(currentPostId);
        
    } catch (error) {
        console.error('Erreur lors de l\'ajout du commentaire:', error);
        showNotification('Une erreur est survenue lors de l\'envoi du commentaire', 'error');
    } finally {
        // Réactiver le bouton d'envoi
        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.innerText = 'Commenter';
    }
}

// Mise à jour du compteur de commentaires dans le DOM
async function updateCommentCount(postId) {
    try {
        const postRef = db.collection('families').doc(familyId).collection('posts').doc(postId);
        const postDoc = await postRef.get();
        
        if (!postDoc.exists) return;
        
        const postData = postDoc.data();
        const commentsCount = postData.commentCount || 0;
        
        // Mettre à jour le compteur dans le DOM
        const postElement = document.querySelector(`.post-item[data-post-id="${postId}"]`);
        if (postElement) {
            const commentStats = postElement.querySelector('.comment-stats');
            commentStats.innerHTML = commentsCount > 0 ? `<span>${commentsCount} commentaire${commentsCount > 1 ? 's' : ''}</span>` : '';
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du compteur de commentaires:', error);
    }
}

// Confirmation avant suppression d'un commentaire
function confirmDeleteComment(commentId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) {
        deleteComment(commentId);
    }
}

// Suppression d'un commentaire
async function deleteComment(commentId) {
    try {
        if (!currentPostId) return;
        
        // Supprimer le commentaire de Firestore
        await db.collection('families').doc(familyId)
            .collection('posts').doc(currentPostId)
            .collection('comments').doc(commentId).delete();
        
        // Décrémenter le compteur de commentaires du post
        await db.collection('families').doc(familyId)
            .collection('posts').doc(currentPostId)
            .update({
                commentCount: firebase.firestore.FieldValue.increment(-1)
            });
        
        // Supprimer l'élément du DOM
        const commentElement = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
        if (commentElement) {
            commentElement.remove();
        }
        
        // Mettre à jour le compteur de commentaires dans le DOM
        updateCommentCount(currentPostId);
        
        // Afficher un message si plus aucun commentaire
        const commentsContainer = document.getElementById('comments-container');
        if (commentsContainer.children.length === 0) {
            commentsContainer.innerHTML = '<p class="no-comments-message">Aucun commentaire pour le moment</p>';
        }
        
        showNotification('Commentaire supprimé avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur lors de la suppression du commentaire:', error);
        showNotification('Une erreur est survenue lors de la suppression', 'error');
    }
}

// Fermeture de la modal
function closeModal(modal) {
    modal.classList.add('hidden');
    currentPostId = null;
}

// Formater la date pour l'affichage
function formatDate(timestamp) {
    if (!timestamp) return 'Date inconnue';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        // Aujourd'hui, afficher l'heure
        return `Aujourd'hui à ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
        // Hier
        return `Hier à ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays < 7) {
        // Cette semaine
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        return `${days[date.getDay()]} à ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else {
        // Date complète
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} à ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
}

// Affichage des notifications
function showNotification(message, type = 'info') {
    // Cette fonction est supposée être définie dans shared.js
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        // Fallback si la fonction n'est pas disponible
        console.log(`Notification (${type}): ${message}`);
        alert(message);
    }
}