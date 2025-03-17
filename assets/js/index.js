// assets/js/index.js

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const user = await initPage();
        if (!user) return;

        const userInfo = await getUserAndFamilyInfo(user.uid);
        if (!userInfo) return;

        // Charger les membres de la famille
        loadFamilyMembers(userInfo.familyId);
        
        // Charger les photos récentes
        loadRecentPhotos(userInfo.familyId);
        
        // Charger les publications récentes
        loadRecentPosts(userInfo.familyId);
        
        // Charger les événements à venir
        loadUpcomingEvents(userInfo.familyId);
        
    } catch (error) {
        console.error('Erreur sur la page d\'accueil:', error);
    }
});

// Charger les membres de la famille
async function loadFamilyMembers(familyId) {
    try {
        const membersRef = db.collection('families').doc(familyId).collection('members');
        const snapshot = await membersRef.get();
        
        const membersList = document.getElementById('family-members-list');
        membersList.innerHTML = '';
        
        snapshot.forEach(doc => {
            const member = doc.data();
            const memberItem = document.createElement('li');
            memberItem.className = 'member-item';
            
            memberItem.innerHTML = `
                <a href="profile.html?id=${doc.id}">
                    <div class="member-avatar">
                        <img src="${member.profilePicture || 'assets/img/default-avatar.png'}" alt="${member.fullName}">
                    </div>
                    <div class="member-name">${member.fullName}</div>
                </a>
            `;
            
            membersList.appendChild(memberItem);
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement des membres:', error);
    }
}

// Charger les photos récentes
async function loadRecentPhotos(familyId) {
    try {
        const photosRef = db.collection('families').doc(familyId).collection('files');
        const snapshot = await photosRef
            .where('type', 'in', ['image/jpeg', 'image/png', 'image/gif'])
            .orderBy('uploadedAt', 'desc')
            .limit(4)
            .get();
        
        const photosContainer = document.getElementById('recent-photos');
        photosContainer.innerHTML = '';
        
        if (snapshot.empty) {
            photosContainer.innerHTML = '<p>Aucune photo récente</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const photo = doc.data();
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            
            photoItem.innerHTML = `
                <a href="gallery.html">
                    <img src="${photo.thumbnailUrl || photo.url}" alt="${photo.name}">
                </a>
            `;
            
            photosContainer.appendChild(photoItem);
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement des photos récentes:', error);
    }
}

// Charger les publications récentes
async function loadRecentPosts(familyId) {
    try {
        const postsRef = db.collection('families').doc(familyId).collection('posts');
        const snapshot = await postsRef
            .orderBy('createdAt', 'desc')
            .limit(3)
            .get();
        
        const postsContainer = document.getElementById('recent-posts');
        postsContainer.innerHTML = '';
        
        if (snapshot.empty) {
            postsContainer.innerHTML = '<p>Aucune publication récente</p>';
            return;
        }
        
        const membersCache = {};
        
        for (const doc of snapshot.docs) {
            const post = doc.data();
            
            // Récupérer les informations de l'auteur si pas déjà en cache
            if (!membersCache[post.authorId]) {
                const authorDoc = await db.collection('families').doc(familyId).collection('members').doc(post.authorId).get();
                membersCache[post.authorId] = authorDoc.exists ? authorDoc.data() : { fullName: 'Utilisateur inconnu' };
            }
            
            const author = membersCache[post.authorId];
            const postItem = document.createElement('div');
            postItem.className = 'post-item';
            
            postItem.innerHTML = `
                <div class="post-header">
                    <img src="${author.profilePicture || 'assets/img/default-avatar.png'}" alt="${author.fullName}" class="post-avatar">
                    <div>
                        <div class="post-author">${author.fullName}</div>
                        <div class="post-date">${formatDate(post.createdAt)}</div>
                    </div>
                </div>
                <div class="post-content">
                    <p>${truncateText(post.content, 100)}</p>
                    ${post.imageUrl ? `<div class="post-image-preview"><img src="${post.imageUrl}" alt="Image de publication"></div>` : ''}
                </div>
                <a href="family-wall.html" class="post-link">Voir la publication</a>`;
            
            postsContainer.appendChild(postItem);
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des publications récentes:', error);
    }
}

// Charger les événements à venir
async function loadUpcomingEvents(familyId) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const eventsRef = db.collection('families').doc(familyId).collection('events');
        const snapshot = await eventsRef
            .where('startDate', '>=', today)
            .orderBy('startDate', 'asc')
            .limit(3)
            .get();
        
        const eventsContainer = document.getElementById('upcoming-events');
        eventsContainer.innerHTML = '';
        
        if (snapshot.empty) {
            eventsContainer.innerHTML = '<p>Aucun événement à venir</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const event = doc.data();
            const eventItem = document.createElement('div');
            eventItem.className = 'event-item';
            
            // Formatage des dates
            const startDate = event.startDate.toDate();
            const formattedDate = startDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
            
            eventItem.innerHTML = `
                <div class="event-date">${formattedDate}</div>
                <div class="event-details">
                    <h4 class="event-title">${event.title}</h4>
                    <p class="event-description">${truncateText(event.description || '', 80)}</p>
                </div>
            `;
            
            eventsContainer.appendChild(eventItem);
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement des événements:', error);
    }
}