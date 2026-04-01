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

import { auth, db }           from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, doc, getDoc, addDoc, updateDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp, increment,
} from 'firebase/firestore';

/* ===== JAAR IN FOOTER ===== */
document.getElementById('year').textContent = new Date().getFullYear();

/* ===== HAMBURGER MENU ===== */
const hamburgerBtn = document.getElementById('hamburger-btn');
const navbarLinks  = document.getElementById('navbar-links');

if (hamburgerBtn) {
  hamburgerBtn.addEventListener('click', () => {
    const isOpen = navbarLinks.classList.toggle('open');
    hamburgerBtn.setAttribute('aria-expanded', isOpen);
    hamburgerBtn.classList.toggle('is-open', isOpen);
  });

  document.addEventListener('click', e => {
    if (!hamburgerBtn.contains(e.target) && !navbarLinks.contains(e.target)) {
      navbarLinks.classList.remove('open');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      hamburgerBtn.classList.remove('is-open');
    }
  });
}

/* ===== GLOBALE STAAT ===== */
let currentBlogId = null;

/* ===== DOM-REFERENTIES ===== */
const homeSection      = document.getElementById('home-section');
const blogSection      = document.getElementById('blog-section');
const blogsGrid        = document.getElementById('blogs-grid');
const blogContent      = document.getElementById('blog-content');
const commentsList     = document.getElementById('comments-list');
const commentForm      = document.getElementById('comment-form');
const searchInput      = document.getElementById('search-input');
const categoryFilter   = document.getElementById('category-filter');
const navDashboardLink = document.getElementById('nav-dashboard');
const backBtn          = document.getElementById('back-btn');
const loadingBlogs     = document.getElementById('loading-blogs');

/* ===== AUTHENTICATIE: admin-link tonen/verbergen ===== */
onAuthStateChanged(auth, user => {
  if (navDashboardLink) {
    navDashboardLink.style.display = user ? 'inline-block' : 'none';
  }
});

/* ===== BLOGS LADEN ===== */
let blogsUnsubscribe = null;

function loadBlogs() {
  if (loadingBlogs) loadingBlogs.style.display = 'block';

  const searchTerm  = searchInput    ? searchInput.value.trim().toLowerCase() : '';
  const selectedCat = categoryFilter ? categoryFilter.value                   : '';

  if (blogsUnsubscribe) blogsUnsubscribe();

  const constraints = [
    where('status', '==', 'published'),
    orderBy('publishedAt', 'desc'),
  ];
  if (selectedCat) constraints.push(where('category', '==', selectedCat));

  const q = query(collection(db, 'blogs'), ...constraints);

  blogsUnsubscribe = onSnapshot(q, snapshot => {
    if (loadingBlogs) loadingBlogs.style.display = 'none';
    let blogs = [];
    snapshot.forEach(d => blogs.push({ id: d.id, ...d.data() }));

    if (searchTerm) {
      blogs = blogs.filter(b =>
        b.title.toLowerCase().includes(searchTerm) ||
        (b.excerpt || '').toLowerCase().includes(searchTerm) ||
        (b.tags || []).some(t => t.toLowerCase().includes(searchTerm))
      );
    }

    renderBlogs(blogs);
    populateCategoryFilter(snapshot);
  }, err => {
    console.error('Fout bij laden blogs:', err);
    if (loadingBlogs) loadingBlogs.style.display = 'none';
  });
}

function populateCategoryFilter(snapshot) {
  if (!categoryFilter) return;
  const categories = new Set();
  snapshot.forEach(d => {
    const cat = d.data().category;
    if (cat) categories.add(cat);
  });

  const currentVal = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="">Alle categorieën</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === currentVal) opt.selected = true;
    categoryFilter.appendChild(opt);
  });
}

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
      <article class="blog-card" data-blog-id="${blog.id}" style="cursor:pointer;" role="button" tabindex="0" aria-label="${escapeHtml(blog.title)}">${img}
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
function openBlog(blogId) {
  currentBlogId = blogId;

  homeSection.style.display = 'none';
  blogSection.style.display = 'block';
  window.scrollTo(0, 0);

  history.pushState({ blogId }, '', `?blog=${blogId}`);

  getDoc(doc(db, 'blogs', blogId)).then(blogSnap => {
    if (!blogSnap.exists) {
      blogContent.innerHTML = '<p>Blog niet gevonden.</p>';
      return;
    }
    const blog = { id: blogSnap.id, ...blogSnap.data() };
    renderBlogContent(blog);
    loadComments(blogId);

    updateDoc(doc(db, 'blogs', blogId), {
      views: increment(1),
    }).catch(err => console.warn('View counter kon niet worden bijgewerkt:', err));
  });
}

/* ===== EVENT DELEGATION VOOR BLOG CARDS ===== */
if (blogsGrid) {
  blogsGrid.addEventListener('click', e => {
    const card = e.target.closest('[data-blog-id]');
    if (card) openBlog(card.dataset.blogId);
  });
  blogsGrid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('[data-blog-id]');
      if (card) { e.preventDefault(); openBlog(card.dataset.blogId); }
    }
  });
}

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
let commentsUnsubscribe = null;

function loadComments(blogId) {
  if (commentsUnsubscribe) commentsUnsubscribe();

  const q = query(
    collection(db, 'comments'),
    where('blogId', '==', blogId),
    where('approved', '==', true),
    orderBy('createdAt', 'asc')
  );

  commentsUnsubscribe = onSnapshot(q, snapshot => {
    renderComments(snapshot);
  }, err => {
    console.error('Fout bij laden reacties:', err);
  });
}

function renderComments(snapshot) {
  if (!commentsList) return;

  if (snapshot.empty) {
    commentsList.innerHTML = '<p class="no-comments">Nog geen reacties. Wees de eerste!</p>';
    return;
  }

  commentsList.innerHTML = snapshot.docs.map(d => {
    const c    = d.data();
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

if (commentForm) {
  commentForm.addEventListener('submit', async e => {
    e.preventDefault();
    const nameInput = document.getElementById('comment-name');
    const textInput = document.getElementById('comment-text');
    const submitBtn = commentForm.querySelector('button[type="submit"]');

    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (!name || !text) return;

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
      await addDoc(collection(db, 'comments'), {
        blogId:    currentBlogId,
        name,
        text,
        approved:  false,
        spam:      false,
        read:      false,
        createdAt: serverTimestamp(),
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
let searchDebounce;
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadBlogs, 300);
  });
}

if (categoryFilter) {
  categoryFilter.addEventListener('change', loadBlogs);
}

/* ===== PAGINA INITIALISATIE ===== */
const urlParams = new URLSearchParams(window.location.search);
const urlBlogId = urlParams.get('blog');

if (urlBlogId) {
  openBlog(urlBlogId);
} else {
  loadBlogs();
}

/* ===== HULPFUNCTIES ===== */
function formatDate(date) {
  return date.toLocaleDateString('nl-NL', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  });
}

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

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
