/**
 * app.js
 * ------
 * Front-end logica voor bezoekers:
 * - Blogs laden en weergeven
 * - Enkele blog bekijken
 * - Reacties plaatsen en realtime weergeven
 * - Admin-link zichtbaar/verbergen op basis van inlogstatus
 * - Paginaweergaven bijhouden (simpele view counter)
 */

/* ===== GLOBALE STAAT ===== */
let currentBlogId = null; // ID van de momenteel bekeken blog

/* ===== DOM-REFERENTIES ===== */
const homeSection       = document.getElementById('home-section');
const blogSection       = document.getElementById('blog-section');
const blogsGrid         = document.getElementById('blogs-grid');
const blogContent       = document.getElementById('blog-content');
const commentsList      = document.getElementById('comments-list');
const commentForm       = document.getElementById('comment-form');
const searchInput       = document.getElementById('search-input');
const categoryFilter    = document.getElementById('category-filter');
const navDashboardLink  = document.getElementById('nav-dashboard');
const backBtn           = document.getElementById('back-btn');
const loadingBlogs      = document.getElementById('loading-blogs');

/* ===== AUTHENTICATIE: admin-link tonen/verbergen ===== */
auth.onAuthStateChanged(user => {
  // Toon de Dashboard-link in de navigatie alleen als er een admin is ingelogd
  if (navDashboardLink) {
    navDashboardLink.style.display = user ? 'inline-block' : 'none';
  }
});

/* ===== BLOGS LADEN ===== */
/**
 * Laad gepubliceerde blogs realtime uit Firestore.
 * Reageert op filter- en zoekwijzigingen.
 */
let blogsUnsubscribe = null; // Houdt de realtime listener bij zodat we hem kunnen afmelden

function loadBlogs() {
  if (loadingBlogs) loadingBlogs.style.display = 'block';

  const searchTerm     = searchInput  ? searchInput.value.trim().toLowerCase()  : '';
  const selectedCat    = categoryFilter ? categoryFilter.value : '';

  // Verwijder vorige listener om duplicaten te voorkomen
  if (blogsUnsubscribe) blogsUnsubscribe();

  // Query: alleen gepubliceerde blogs, gesorteerd op publicatiedatum
  let query = db.collection('blogs')
    .where('status', '==', 'published')
    .orderBy('publishedAt', 'desc');

  // Categorie-filter toepassen indien geselecteerd
  if (selectedCat) {
    query = query.where('category', '==', selectedCat);
  }

  // Realtime listener: bijwerken zodra data in Firestore verandert
  blogsUnsubscribe = query.onSnapshot(snapshot => {
    if (loadingBlogs) loadingBlogs.style.display = 'none';
    let blogs = [];
    snapshot.forEach(doc => blogs.push({ id: doc.id, ...doc.data() }));

    // Zoekfilter toepassen (client-side, Firestore ondersteunt geen fulltext search)
    if (searchTerm) {
      blogs = blogs.filter(b =>
        b.title.toLowerCase().includes(searchTerm) ||
        (b.excerpt || '').toLowerCase().includes(searchTerm) ||
        (b.tags || []).some(t => t.toLowerCase().includes(searchTerm))
      );
    }

    renderBlogs(blogs);
    populateCategoryFilter(snapshot); // Vul de categorielijst bij
  }, err => {
    console.error('Fout bij laden blogs:', err);
    if (loadingBlogs) loadingBlogs.style.display = 'none';
  });
}

/**
 * Vul het categorie-dropdown menu met unieke categorieën uit de blogs.
 */
function populateCategoryFilter(snapshot) {
  if (!categoryFilter) return;
  const categories = new Set();
  snapshot.forEach(doc => {
    const cat = doc.data().category;
    if (cat) categories.add(cat);
  });

  const currentVal = categoryFilter.value;
  // Behoud bestaande 'Alle categorieën' optie
  categoryFilter.innerHTML = '<option value="">Alle categorieën</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === currentVal) opt.selected = true;
    categoryFilter.appendChild(opt);
  });
}

/**
 * Toon de lijst met blogs als kaarten in het overzicht.
 */
function renderBlogs(blogs) {
  if (!blogsGrid) return;

  if (blogs.length === 0) {
    blogsGrid.innerHTML = '<p class="no-blogs">Nog geen blogs gevonden.</p>';
    return;
  }

  blogsGrid.innerHTML = blogs.map(blog => {
    const date    = blog.publishedAt ? formatDate(blog.publishedAt.toDate()) : '';
    const img     = blog.imageUrl
      ? `<img src="${escapeHtml(blog.imageUrl)}" alt="${escapeHtml(blog.title)}" class="blog-card-img" loading="lazy">`
      : `<div class="blog-card-img-placeholder"></div>`;
    const tags    = (blog.tags || []).map(t =>
      `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const excerpt = blog.excerpt
      ? escapeHtml(blog.excerpt)
      : stripHtml(blog.content || '').substring(0, 150) + '...';

    return `
      <article class="blog-card" onclick="openBlog('${blog.id}')">
        ${img}
        <div class="blog-card-body">
          ${blog.category ? `<span class="category-badge">${escapeHtml(blog.category)}</span>` : ''}
          <h2 class="blog-card-title">${escapeHtml(blog.title)}</h2>
          <p class="blog-card-excerpt">${excerpt}</p>
          <div class="blog-card-meta">
            <span class="blog-date">📅 ${date}</span>
            <span class="blog-author">✍️ ${escapeHtml(blog.author || 'Onbekend')}</span>
            <span class="blog-views">👁 ${blog.views || 0}</span>
          </div>
          <div class="blog-tags">${tags}</div>
        </div>
      </article>`;
  }).join('');
}

/* ===== ENKELE BLOG BEKIJKEN ===== */
/**
 * Open een enkele blog op basis van het ID.
 * Verhoogt de view counter en laadt reacties realtime.
 */
function openBlog(blogId) {
  currentBlogId = blogId;

  // Sectie wisselen
  homeSection.style.display = 'none';
  blogSection.style.display = 'block';
  window.scrollTo(0, 0);

  // URL aanpassen zonder pagina te herladen (voor bookmarks en terug-knop)
  history.pushState({ blogId }, '', `?blog=${blogId}`);

  // Blog data ophalen
  db.collection('blogs').doc(blogId).get().then(doc => {
    if (!doc.exists) {
      blogContent.innerHTML = '<p>Blog niet gevonden.</p>';
      return;
    }
    const blog = { id: doc.id, ...doc.data() };
    renderBlogContent(blog);
    loadComments(blogId);

    // View counter ophogen (atomisch via Firestore increment)
    db.collection('blogs').doc(blogId).update({
      views: firebase.firestore.FieldValue.increment(1)
    }).catch(err => console.warn('View counter kon niet worden bijgewerkt:', err));
  });
}

/**
 * Render de volledige inhoud van een blog.
 */
function renderBlogContent(blog) {
  const date = blog.publishedAt ? formatDate(blog.publishedAt.toDate()) : '';
  const img  = blog.imageUrl
    ? `<img src="${escapeHtml(blog.imageUrl)}" alt="${escapeHtml(blog.title)}" class="blog-hero-img">`
    : '';

  blogContent.innerHTML = `
    ${img}
    <div class="blog-full-meta">
      ${blog.category ? `<span class="category-badge">${escapeHtml(blog.category)}</span>` : ''}
      <span class="blog-date">📅 ${date}</span>
      <span class="blog-author">✍️ ${escapeHtml(blog.author || 'Onbekend')}</span>
      <span class="blog-views">👁 ${blog.views || 0} weergaven</span>
    </div>
    <h1 class="blog-full-title">${escapeHtml(blog.title)}</h1>
    <div class="blog-full-content">${blog.content || ''}</div>
    <div class="blog-tags">
      ${(blog.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
    </div>`;
}

/* ===== REACTIES ===== */
let commentsUnsubscribe = null; // Houdt realtime comments-listener bij

/**
 * Laad goedgekeurde reacties realtime voor een blog.
 */
function loadComments(blogId) {
  if (commentsUnsubscribe) commentsUnsubscribe();

  commentsUnsubscribe = db.collection('comments')
    .where('blogId', '==', blogId)
    .where('approved', '==', true)
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      renderComments(snapshot);
    }, err => {
      console.error('Fout bij laden reacties:', err);
    });
}

/**
 * Toon de reacties in de comments-sectie.
 */
function renderComments(snapshot) {
  if (!commentsList) return;

  if (snapshot.empty) {
    commentsList.innerHTML = '<p class="no-comments">Nog geen reacties. Wees de eerste!</p>';
    return;
  }

  commentsList.innerHTML = snapshot.docs.map(doc => {
    const c    = doc.data();
    const date = c.createdAt ? formatDate(c.createdAt.toDate()) : '';
    return `
      <div class="comment">
        <div class="comment-header">
          <strong class="comment-name">${escapeHtml(c.name)}</strong>
          <span class="comment-date">${date}</span>
        </div>
        <p class="comment-text">${escapeHtml(c.text)}</p>
      </div>`;
  }).join('');
}

/**
 * Reactieformulier verwerken: sla nieuwe reactie op in Firestore.
 * Reacties starten als 'niet goedgekeurd' (wacht op admin-goedkeuring).
 */
if (commentForm) {
  commentForm.addEventListener('submit', async e => {
    e.preventDefault();
    const nameInput = document.getElementById('comment-name');
    const textInput = document.getElementById('comment-text');
    const submitBtn = commentForm.querySelector('button[type="submit"]');

    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (!name || !text) return;

    // Basisspamcheck: te korte of te lange reacties weigeren
    if (text.length < 3) {
      showNotification('Reactie is te kort.', 'error');
      return;
    }
    if (text.length > 2000) {
      showNotification('Reactie is te lang (max 2000 tekens).', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Plaatsen...';

    try {
      await db.collection('comments').add({
        blogId:    currentBlogId,
        name:      name,
        text:      text,
        approved:  false,          // Wacht op goedkeuring door admin
        spam:      false,
        read:      false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      nameInput.value = '';
      textInput.value = '';
      showNotification('Reactie geplaatst! Wacht op goedkeuring.', 'success');
    } catch (err) {
      console.error('Fout bij plaatsen reactie:', err);
      showNotification('Fout bij plaatsen reactie. Probeer opnieuw.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reactie plaatsen';
    }
  });
}

/* ===== NAVIGATIE ===== */
/**
 * Terugknop: ga terug naar het blogoverzicht.
 */
if (backBtn) {
  backBtn.addEventListener('click', () => {
    blogSection.style.display = 'none';
    homeSection.style.display = 'block';
    currentBlogId = null;
    if (commentsUnsubscribe) commentsUnsubscribe();
    history.pushState({}, '', window.location.pathname);
    window.scrollTo(0, 0);
  });
}

// Terug-knop van de browser afhandelen
window.addEventListener('popstate', e => {
  if (e.state && e.state.blogId) {
    openBlog(e.state.blogId);
  } else {
    blogSection.style.display = 'none';
    homeSection.style.display = 'block';
    currentBlogId = null;
    if (commentsUnsubscribe) commentsUnsubscribe();
  }
});

/* ===== ZOEKEN & FILTEREN ===== */
// Zoeken met debounce om niet bij elke toetsaanslag te zoeken
let searchDebounce;
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadBlogs, 300);
  });
}

// Categorie-filter direct toepassen
if (categoryFilter) {
  categoryFilter.addEventListener('change', loadBlogs);
}

/* ===== PAGINA INITIALISATIE ===== */
// Controleer of er een blog-ID in de URL staat (voor directe links)
const urlParams = new URLSearchParams(window.location.search);
const urlBlogId = urlParams.get('blog');

if (urlBlogId) {
  openBlog(urlBlogId);
} else {
  loadBlogs(); // Laad het blogoverzicht
}

/* ===== HULPFUNCTIES ===== */
/**
 * Formatteer een JavaScript Date naar een leesbare Nederlandse datum.
 */
function formatDate(date) {
  return date.toLocaleDateString('nl-NL', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric'
  });
}

/**
 * Verwijder HTML-tags uit een tekst (voor excerpt-generatie).
 */
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * Escape HTML-tekens om XSS te voorkomen.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/**
 * Toon een tijdelijke notificatie (toast) boven aan het scherm.
 */
function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
