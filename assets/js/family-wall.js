
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