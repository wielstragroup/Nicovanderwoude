/**
 * dashboard.js
 * ------------
 * Admin-dashboard logica (Firebase v10 modulaire SDK):
 * - Inloggen / uitloggen via Firebase Authentication
 * - CRUD voor blogs (aanmaken, bewerken, verwijderen, herstellen)
 * - Drafts / concepten opslaan
 * - Categorieën & tags beheren
 * - Afbeeldingen uploaden (drag & drop + klik) naar Firebase Storage
 * - Publicatiedatum plannen
 * - Reacties beheren (goedkeuren, verwijderen, markeren als gelezen)
 * - Gebruikersbeheer (admin/redacteur toevoegen, rollen instellen)
 * - Statistieken tonen (blogs, reacties, views)
 * - Rich-text editor (Quill.js via CDN)
 * - Preview van blog voor publicatie
 * - Prullenbak / undo voor verwijderde blogs
 */

import { auth, db, storage } from './firebase-config.js';
import { initNicoAI }        from './nico-ai.js';
import Quill                 from 'quill';
import 'quill/dist/quill.snow.css';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp, increment, Timestamp,
} from 'firebase/firestore';
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage';

/* ===== CONSTANTEN ===== */
const ROLES = { ADMIN: 'admin', EDITOR: 'editor' };

/* ===== DOM-REFERENTIES ===== */
const loginSection    = document.getElementById('login-section');
const dashboardMain   = document.getElementById('dashboard-main');
const loginForm       = document.getElementById('login-form');
const loginError      = document.getElementById('login-error');
const userEmailSpan   = document.getElementById('user-email');
const logoutBtn       = document.getElementById('logout-btn');

const navBtns         = document.querySelectorAll('.dash-nav-btn');

const statBlogs       = document.getElementById('stat-blogs');
const statComments    = document.getElementById('stat-comments');
const statViews       = document.getElementById('stat-views');
const statPending     = document.getElementById('stat-pending');

const blogEditorSection = document.getElementById('blog-editor-section');
const blogListSection   = document.getElementById('blog-list-section');
const blogForm          = document.getElementById('blog-form');
const blogTitleInput    = document.getElementById('blog-title');
const blogCategoryInput = document.getElementById('blog-category');
const blogTagsInput     = document.getElementById('blog-tags');
const blogExcerptInput  = document.getElementById('blog-excerpt');
const blogScheduleInput = document.getElementById('blog-schedule');
const saveDraftBtn      = document.getElementById('save-draft-btn');
const publishBtn        = document.getElementById('publish-btn');
const previewBtn        = document.getElementById('preview-btn');
const newBlogBtn        = document.getElementById('new-blog-btn');
const cancelEditBtn     = document.getElementById('cancel-edit-btn');
const blogsList         = document.getElementById('blogs-list');
const blogsSearch       = document.getElementById('blogs-search');
const statusFilter      = document.getElementById('status-filter');
const imageDropZone     = document.getElementById('image-drop-zone');
const imageFileInput    = document.getElementById('image-file-input');
const imagePreviewEl    = document.getElementById('image-preview');
const uploadProgressEl  = document.getElementById('upload-progress');

const commentsTableBody = document.getElementById('comments-table-body');
const commentsSearch    = document.getElementById('comments-search');
const commentsFilter    = document.getElementById('comments-filter');

const usersTableBody    = document.getElementById('users-table-body');
const addUserForm       = document.getElementById('add-user-form');
const addUserError      = document.getElementById('add-user-error');

const mediaGrid         = document.getElementById('media-grid');
const mediaDropZone     = document.getElementById('media-drop-zone');
const mediaFileInput    = document.getElementById('media-file-input');

const trashList         = document.getElementById('trash-list');

const previewModal      = document.getElementById('preview-modal');
const previewClose      = document.getElementById('preview-close');
const previewContent    = document.getElementById('preview-content');

/* ===== GLOBALE STAAT ===== */
let currentUser      = null;
let currentUserRole  = null;
let editingBlogId    = null;
let quillEditor      = null;
let uploadedImageUrl = null;

/* ===================================================================
   TAB INITIALISATIE
   ================================================================= */

document.querySelectorAll('.dash-section').forEach((s, i) => {
  s.style.display = i === 0 ? 'block' : 'none';
});

/* ===================================================================
   AUTHENTICATIE
   ================================================================= */

if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn      = loginForm.querySelector('button[type="submit"]');

    btn.disabled    = true;
    btn.textContent = 'Inloggen...';
    loginError.textContent = '';

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      loginError.textContent = vertaalAuthFout(err.code);
      btn.disabled    = false;
      btn.textContent = 'Inloggen';
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => signOut(auth));
}

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;

    const userDocSnap = await getDoc(doc(db, 'users', user.uid));
    if (userDocSnap.exists) {
      currentUserRole = userDocSnap.data().role;
    } else {
      currentUserRole = ROLES.ADMIN;
      await setDoc(doc(db, 'users', user.uid), {
        uid:       user.uid,
        email:     user.email,
        name:      user.displayName || user.email.split('@')[0],
        role:      ROLES.ADMIN,
        createdAt: serverTimestamp(),
      });
    }

    loginSection.style.display  = 'none';
    dashboardMain.style.display = 'block';
    if (userEmailSpan) userEmailSpan.textContent = user.email;

    initQuill();
    loadDashboardStats();
    loadBlogsList();
    loadCommentsList();
    loadUsersList();
    loadMediaLibrary();
    loadTrash();
    setupScheduledPublishing();
    initNicoAI(showDashNotification);
  } else {
    currentUser     = null;
    currentUserRole = null;
    loginSection.style.display  = 'block';
    dashboardMain.style.display = 'none';
  }
});

function vertaalAuthFout(code) {
  const fouten = {
    'auth/user-not-found':     'Geen account gevonden met dit e-mailadres.',
    'auth/wrong-password':     'Onjuist wachtwoord.',
    'auth/invalid-email':      'Ongeldig e-mailadres.',
    'auth/too-many-requests':  'Te veel pogingen. Probeer het later opnieuw.',
    'auth/invalid-credential': 'Ongeldig e-mailadres of wachtwoord.',
  };
  return fouten[code] || 'Fout bij inloggen. Controleer je gegevens.';
}

/* ===================================================================
   NAVIGATIE TABS
   ================================================================= */

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;

    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
    const targetEl = document.getElementById(`section-${target}`);
    if (targetEl) targetEl.style.display = 'block';
  });
});

/* ===================================================================
   STATISTIEKEN
   ================================================================= */

function loadDashboardStats() {
  onSnapshot(
    query(collection(db, 'blogs'), where('status', '==', 'published')),
    snap => { if (statBlogs) statBlogs.textContent = snap.size; }
  );

  onSnapshot(collection(db, 'comments'), snap => {
    if (statComments) statComments.textContent = snap.size;
    const pending = snap.docs.filter(d => !d.data().approved && !d.data().spam).length;
    if (statPending) statPending.textContent = pending;
  });

  onSnapshot(collection(db, 'blogs'), snap => {
    let totalViews = 0;
    snap.forEach(d => { totalViews += (d.data().views || 0); });
    if (statViews) statViews.textContent = totalViews;
  });
}

/* ===================================================================
   RICH TEXT EDITOR (QUILL.JS)
   ================================================================= */

function initQuill() {
  if (quillEditor || !document.getElementById('quill-editor')) return;

  quillEditor = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Schrijf hier de inhoud van je blog...',
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        ['clean'],
      ],
    },
  });
}

/* ===================================================================
   AFBEELDINGEN UPLOADEN (DRAG & DROP + KLIK)
   ================================================================= */

function setupImageUpload(dropZone, fileInput, onUpload) {
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadImage(fileInput.files[0], dropZone, onUpload);
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) uploadImage(e.dataTransfer.files[0], dropZone, onUpload);
  });
}

async function uploadImage(file, dropZone, onUpload) {
  if (!file.type.startsWith('image/')) {
    showDashNotification('Alleen afbeeldingsbestanden zijn toegestaan.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showDashNotification('Afbeelding is te groot (max 5MB).', 'error');
    return;
  }

  const ext        = file.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '').substring(0, 5) || 'img';
  const fileName   = `images/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`;
  const storageRef = ref(storage, fileName);

  if (uploadProgressEl) uploadProgressEl.style.display = 'block';
  if (dropZone) dropZone.classList.add('uploading');

  try {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', snapshot => {
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      if (uploadProgressEl) uploadProgressEl.textContent = `Uploaden: ${pct}%`;
    });

    await uploadTask;
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db, 'media'), {
      url,
      name:        file.name,
      size:        file.size,
      type:        file.type,
      uploadedBy:  currentUser ? currentUser.uid : 'unknown',
      createdAt:   serverTimestamp(),
    });

    onUpload(url);
    showDashNotification('Afbeelding succesvol geüpload!', 'success');
  } catch (err) {
    console.error('Upload fout:', err);
    showDashNotification('Fout bij uploaden. Probeer opnieuw.', 'error');
  } finally {
    if (uploadProgressEl) uploadProgressEl.style.display = 'none';
    if (dropZone) dropZone.classList.remove('uploading');
  }
}

setupImageUpload(imageDropZone, imageFileInput, url => {
  uploadedImageUrl = url;
  if (imagePreviewEl) {
    imagePreviewEl.src           = url;
    imagePreviewEl.style.display = 'block';
  }
});

/* ===================================================================
   BLOG BEHEER (CRUD)
   ================================================================= */

function loadBlogsList() {
  if (!blogsList) return;

  const search = blogsSearch  ? blogsSearch.value.trim().toLowerCase() : '';
  const status = statusFilter ? statusFilter.value                     : '';

  const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));

  onSnapshot(q, snapshot => {
    let blogs = [];
    snapshot.forEach(d => blogs.push({ id: d.id, ...d.data() }));

    if (status) blogs = blogs.filter(b => b.status === status);

    if (search) {
      blogs = blogs.filter(b =>
        b.title.toLowerCase().includes(search) ||
        (b.category || '').toLowerCase().includes(search) ||
        (b.tags || []).some(t => t.toLowerCase().includes(search))
      );
    }

    blogs = blogs.filter(b => b.status !== 'trash');

    renderBlogsList(blogs);
  });
}

function renderBlogsList(blogs) {
  if (!blogsList) return;

  if (blogs.length === 0) {
    blogsList.innerHTML = '<p class="no-items">Geen blogs gevonden.</p>';
    return;
  }

  blogsList.innerHTML = blogs.map(blog => {
    const date        = blog.createdAt ? formatDate(blog.createdAt.toDate()) : '-';
    const statusBadge = getStatusBadge(blog.status);
    return `
      <div class="blog-list-item">
        <div class="blog-list-info">
          <strong>${escapeHtml(blog.title)}</strong>
          <small>
            ${statusBadge}
            ${blog.category ? `<span class="tag">${escapeHtml(blog.category)}</span>` : ''}
            <span>📅 ${date}</span>
            <span>👁 ${blog.views || 0}</span>
          </small>
        </div>
        <div class="blog-list-actions">
          <button class="btn btn-sm btn-secondary" onclick="editBlog('${blog.id}')">✏️ Bewerken</button>
          <button class="btn btn-sm btn-info"      onclick="previewBlogById('${blog.id}')">👁 Preview</button>
          <button class="btn btn-sm btn-danger"    onclick="moveBlogToTrash('${blog.id}', '${escapeHtml(blog.title)}')">🗑️ Verwijderen</button>
        </div>
      </div>`;
  }).join('');
}

function getStatusBadge(status) {
  const badges = {
    published: '<span class="badge badge-success">Gepubliceerd</span>',
    draft:     '<span class="badge badge-warning">Concept</span>',
    scheduled: '<span class="badge badge-info">Gepland</span>',
    trash:     '<span class="badge badge-danger">Prullenbak</span>',
  };
  return badges[status] || `<span class="badge">${status}</span>`;
}

if (blogsSearch)  blogsSearch.addEventListener('input', loadBlogsList);
if (statusFilter) statusFilter.addEventListener('change', loadBlogsList);

if (newBlogBtn) {
  newBlogBtn.addEventListener('click', () => {
    editingBlogId    = null;
    uploadedImageUrl = null;
    blogForm.reset();
    if (quillEditor) quillEditor.setContents([]);
    if (imagePreviewEl) imagePreviewEl.style.display = 'none';
    blogEditorSection.style.display = 'block';
    blogListSection.style.display   = 'none';
    document.getElementById('blog-editor-title').textContent = 'Nieuwe blog';
  });
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    blogEditorSection.style.display = 'none';
    blogListSection.style.display   = 'block';
    editingBlogId = null;
  });
}

async function editBlog(blogId) {
  editingBlogId     = blogId;
  const blogSnap    = await getDoc(doc(db, 'blogs', blogId));
  if (!blogSnap.exists) return;
  const blog        = blogSnap.data();

  blogTitleInput.value    = blog.title    || '';
  blogCategoryInput.value = blog.category || '';
  blogTagsInput.value     = (blog.tags || []).join(', ');
  blogExcerptInput.value  = blog.excerpt  || '';
  uploadedImageUrl        = blog.imageUrl || null;

  if (blog.scheduledAt && blogScheduleInput) {
    const d = blog.scheduledAt.toDate();
    blogScheduleInput.value = d.toISOString().slice(0, 16);
  }

  if (quillEditor) quillEditor.root.innerHTML = blog.content || '';

  if (uploadedImageUrl && imagePreviewEl) {
    imagePreviewEl.src           = uploadedImageUrl;
    imagePreviewEl.style.display = 'block';
  }

  blogEditorSection.style.display = 'block';
  blogListSection.style.display   = 'none';
  document.getElementById('blog-editor-title').textContent = 'Blog bewerken';
}

if (saveDraftBtn) {
  saveDraftBtn.addEventListener('click', () => saveBlog('draft'));
}

if (publishBtn) {
  publishBtn.addEventListener('click', () => {
    const scheduled = blogScheduleInput ? blogScheduleInput.value : '';
    saveBlog(scheduled ? 'scheduled' : 'published');
  });
}

async function saveBlog(status) {
  const title   = blogTitleInput.value.trim();
  const content = quillEditor ? quillEditor.root.innerHTML : '';

  if (!title) {
    showDashNotification('Vul een titel in.', 'error');
    return;
  }

  const tagsRaw   = blogTagsInput ? blogTagsInput.value : '';
  const tags      = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  let scheduledAt = null;
  if (blogScheduleInput && blogScheduleInput.value) {
    scheduledAt = Timestamp.fromDate(new Date(blogScheduleInput.value));
  }

  const blogData = {
    title,
    content,
    category:   blogCategoryInput ? blogCategoryInput.value.trim() : '',
    tags,
    excerpt:    blogExcerptInput  ? blogExcerptInput.value.trim()  : '',
    imageUrl:   uploadedImageUrl  || '',
    status,
    author:     currentUser ? (currentUser.displayName || currentUser.email) : 'Admin',
    authorId:   currentUser ? currentUser.uid : '',
    scheduledAt,
    updatedAt:  serverTimestamp(),
  };

  try {
    if (editingBlogId) {
      if (status === 'published') {
        const existingSnap = await getDoc(doc(db, 'blogs', editingBlogId));
        if (!existingSnap.data().publishedAt) {
          blogData.publishedAt = scheduledAt || serverTimestamp();
        }
      }
      await updateDoc(doc(db, 'blogs', editingBlogId), blogData);
    } else {
      blogData.createdAt   = serverTimestamp();
      blogData.publishedAt = status === 'published' ? serverTimestamp() : scheduledAt;
      blogData.views       = 0;
      await addDoc(collection(db, 'blogs'), blogData);
    }

    const statusLabels = { published: 'gepubliceerd', draft: 'opgeslagen als concept', scheduled: 'gepland' };
    showDashNotification(`Blog ${statusLabels[status] || 'opgeslagen'}!`, 'success');
    blogEditorSection.style.display = 'none';
    blogListSection.style.display   = 'block';
    editingBlogId = null;
  } catch (err) {
    console.error('Fout bij opslaan blog:', err);
    showDashNotification('Fout bij opslaan. Probeer opnieuw.', 'error');
  }
}

async function moveBlogToTrash(blogId, title) {
  if (!confirm(`"${title}" naar de prullenbak verplaatsen?`)) return;
  await updateDoc(doc(db, 'blogs', blogId), {
    status:    'trash',
    trashedAt: serverTimestamp(),
  });
  showDashNotification('Blog naar prullenbak verplaatst.', 'info');
}

async function previewBlogById(blogId) {
  const blogSnap = await getDoc(doc(db, 'blogs', blogId));
  if (!blogSnap.exists) return;
  showPreview(blogSnap.data());
}

if (previewBtn) {
  previewBtn.addEventListener('click', () => {
    const title   = blogTitleInput.value.trim() || 'Zonder titel';
    const content = quillEditor ? quillEditor.root.innerHTML : '';
    showPreview({
      title,
      content,
      category: blogCategoryInput.value,
      tags:     blogTagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
      imageUrl: uploadedImageUrl,
    });
  });
}

function showPreview(blog) {
  const img  = blog.imageUrl
    ? `<img src="${escapeHtml(blog.imageUrl)}" style="max-width:100%;margin-bottom:1rem;">`
    : '';
  const tags = (blog.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  previewContent.innerHTML = `
    ${img}
    <h1>${escapeHtml(blog.title || '')}</h1>
    ${blog.category ? `<span class="category-badge">${escapeHtml(blog.category)}</span>` : ''}
    <div style="margin-top:1rem;">${blog.content || ''}</div>
    <div style="margin-top:1rem;">${tags}</div>`;

  previewModal.style.display = 'flex';
}

if (previewClose) {
  previewClose.addEventListener('click', () => { previewModal.style.display = 'none'; });
}
if (previewModal) {
  previewModal.addEventListener('click', e => {
    if (e.target === previewModal) previewModal.style.display = 'none';
  });
}

/* ===================================================================
   GEPLANDE PUBLICATIE
   ================================================================= */

function setupScheduledPublishing() {
  publishScheduled();
  setInterval(publishScheduled, 60000);
}

async function publishScheduled() {
  const now  = Timestamp.now();
  const snap = await getDocs(query(
    collection(db, 'blogs'),
    where('status', '==', 'scheduled'),
    where('scheduledAt', '<=', now)
  ));

  await Promise.all(snap.docs.map(d =>
    updateDoc(d.ref, {
      status:      'published',
      publishedAt: serverTimestamp(),
    })
  ));
}

/* ===================================================================
   PRULLENBAK
   ================================================================= */

function loadTrash() {
  if (!trashList) return;

  onSnapshot(
    query(collection(db, 'blogs'), where('status', '==', 'trash')),
    snapshot => {
      if (snapshot.empty) {
        trashList.innerHTML = '<p class="no-items">Prullenbak is leeg.</p>';
        return;
      }

      trashList.innerHTML = snapshot.docs.map(d => {
        const blog = d.data();
        return `
          <div class="trash-item">
            <strong>${escapeHtml(blog.title)}</strong>
            <div class="trash-actions">
              <button class="btn btn-sm btn-success" onclick="restoreBlog('${d.id}')">↩️ Herstellen</button>
              <button class="btn btn-sm btn-danger"  onclick="deleteBlogPermanent('${d.id}', '${escapeHtml(blog.title)}')">🗑️ Definitief verwijderen</button>
            </div>
          </div>`;
      }).join('');
    }
  );
}

async function restoreBlog(blogId) {
  await updateDoc(doc(db, 'blogs', blogId), { status: 'draft', trashedAt: null });
  showDashNotification('Blog hersteld als concept.', 'success');
}

async function deleteBlogPermanent(blogId, title) {
  if (!confirm(`"${title}" definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
  await deleteDoc(doc(db, 'blogs', blogId));
  showDashNotification('Blog definitief verwijderd.', 'info');
}

/* ===================================================================
   REACTIES BEHEREN
   ================================================================= */

function loadCommentsList() {
  if (!commentsTableBody) return;

  const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'));

  onSnapshot(q, snapshot => {
    let comments = [];
    snapshot.forEach(d => comments.push({ id: d.id, ...d.data() }));

    const filter = commentsFilter ? commentsFilter.value : '';
    if (filter === 'pending')  comments = comments.filter(c => !c.approved && !c.spam);
    if (filter === 'approved') comments = comments.filter(c => c.approved);
    if (filter === 'spam')     comments = comments.filter(c => c.spam);

    const search = commentsSearch ? commentsSearch.value.trim().toLowerCase() : '';
    if (search) {
      comments = comments.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.text.toLowerCase().includes(search)
      );
    }

    renderCommentsList(comments);
  });
}

function renderCommentsList(comments) {
  if (!commentsTableBody) return;

  if (comments.length === 0) {
    commentsTableBody.innerHTML = '<tr><td colspan="5" class="no-items">Geen reacties gevonden.</td></tr>';
    return;
  }

  commentsTableBody.innerHTML = comments.map(c => {
    const date          = c.createdAt ? formatDate(c.createdAt.toDate()) : '-';
    const unread        = !c.read ? '<span class="badge badge-info">Nieuw</span>' : '';
    const approvedBadge = c.approved
      ? '<span class="badge badge-success">Goedgekeurd</span>'
      : (c.spam ? '<span class="badge badge-danger">Spam</span>' : '<span class="badge badge-warning">In afwachting</span>');

    return `
      <tr class="${!c.read ? 'unread-row' : ''}">
        <td>${escapeHtml(c.name)} ${unread}</td>
        <td title="${escapeHtml(c.text)}">${escapeHtml(c.text.substring(0, 80))}${c.text.length > 80 ? '...' : ''}</td>
        <td>${date}</td>
        <td>${approvedBadge}</td>
        <td class="comment-actions">
          ${!c.approved && !c.spam ? `<button class="btn btn-sm btn-success" onclick="approveComment('${c.id}')">✅ Goedkeuren</button>` : ''}
          ${!c.read ? `<button class="btn btn-sm btn-secondary" onclick="markCommentRead('${c.id}')">✓ Gelezen</button>` : ''}
          ${!c.spam ? `<button class="btn btn-sm btn-warning" onclick="markCommentSpam('${c.id}')">🚫 Spam</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteComment('${c.id}')">🗑️ Verwijderen</button>
        </td>
      </tr>`;
  }).join('');
}

if (commentsSearch) commentsSearch.addEventListener('input', loadCommentsList);
if (commentsFilter) commentsFilter.addEventListener('change', loadCommentsList);

async function approveComment(commentId) {
  await updateDoc(doc(db, 'comments', commentId), { approved: true, read: true });
  showDashNotification('Reactie goedgekeurd.', 'success');
}

async function markCommentRead(commentId) {
  await updateDoc(doc(db, 'comments', commentId), { read: true });
}

async function markCommentSpam(commentId) {
  await updateDoc(doc(db, 'comments', commentId), { spam: true, approved: false });
  showDashNotification('Reactie als spam gemarkeerd.', 'info');
}

async function deleteComment(commentId) {
  if (!confirm('Reactie verwijderen?')) return;
  await deleteDoc(doc(db, 'comments', commentId));
  showDashNotification('Reactie verwijderd.', 'info');
}

/* ===================================================================
   GEBRUIKERSBEHEER
   ================================================================= */

function loadUsersList() {
  if (!usersTableBody) return;

  onSnapshot(collection(db, 'users'), snapshot => {
    if (snapshot.empty) {
      usersTableBody.innerHTML = '<tr><td colspan="4" class="no-items">Geen gebruikers gevonden.</td></tr>';
      return;
    }

    usersTableBody.innerHTML = snapshot.docs.map(d => {
      const u             = d.data();
      const isCurrentUser = currentUser && d.id === currentUser.uid;
      return `
        <tr>
          <td>${escapeHtml(u.name || '-')}</td>
          <td>${escapeHtml(u.email || '-')}</td>
          <td>
            <select class="role-select" data-uid="${d.id}" ${isCurrentUser ? 'disabled' : ''}>
              <option value="admin"  ${u.role === 'admin'  ? 'selected' : ''}>Admin</option>
              <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Redacteur</option>
            </select>
          </td>
          <td>
            ${!isCurrentUser
              ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${d.id}')">🗑️ Verwijderen</button>`
              : '<span class="badge badge-info">Jij</span>'}
          </td>
        </tr>`;
    }).join('');

    document.querySelectorAll('.role-select').forEach(sel => {
      sel.addEventListener('change', async e => {
        const uid  = e.target.dataset.uid;
        const role = e.target.value;
        await updateDoc(doc(db, 'users', uid), { role });
        showDashNotification('Rol bijgewerkt.', 'success');
      });
    });
  });
}

function askAdminPassword() {
  return new Promise(resolve => {
    const modal     = document.getElementById('confirm-password-modal');
    const input     = document.getElementById('admin-confirm-password');
    const okBtn     = document.getElementById('confirm-pw-ok');
    const cancelBtn = document.getElementById('confirm-pw-cancel');

    input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 50);

    function cleanup() {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    }
    function onOk()     { const pw = input.value; cleanup(); resolve(pw || null); }
    function onCancel() { cleanup(); resolve(null); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);

    input.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter') { input.removeEventListener('keydown', handler); onOk(); }
    });
  });
}

if (addUserForm) {
  addUserForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name     = document.getElementById('new-user-name').value.trim();
    const email    = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role     = document.getElementById('new-user-role').value;
    const btn      = addUserForm.querySelector('button[type="submit"]');

    btn.disabled = true;
    if (addUserError) addUserError.textContent = '';

    try {
      const adminEmail    = currentUser.email;
      const adminPassword = await askAdminPassword();
      if (!adminPassword) { btn.disabled = false; return; }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid:       cred.user.uid,
        name,
        email,
        role,
        createdAt: serverTimestamp(),
      });

      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      addUserForm.reset();
      showDashNotification(`Gebruiker "${name}" aangemaakt als ${role}.`, 'success');
    } catch (err) {
      if (addUserError) addUserError.textContent = vertaalAuthFout(err.code);
    } finally {
      btn.disabled = false;
    }
  });
}

async function deleteUser(uid) {
  if (!confirm('Gebruiker verwijderen uit de database? Het Firebase Auth-account blijft bestaan.')) return;
  await deleteDoc(doc(db, 'users', uid));
  showDashNotification('Gebruiker verwijderd.', 'info');
}

/* ===================================================================
   MEDIA MANAGER
   ================================================================= */

function loadMediaLibrary() {
  if (!mediaGrid) return;

  const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));

  onSnapshot(q, snapshot => {
    if (snapshot.empty) {
      mediaGrid.innerHTML = '<p class="no-items">Geen afbeeldingen gevonden.</p>';
      return;
    }

    mediaGrid.innerHTML = snapshot.docs.map(d => {
      const m = d.data();
      return `
        <div class="media-item">
          <img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.name)}" loading="lazy">
          <div class="media-info">
            <small>${escapeHtml(m.name)}</small>
            <button class="btn btn-xs btn-danger" onclick="deleteMedia('${d.id}', '${escapeHtml(m.url)}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
  });
}

async function deleteMedia(docId, url) {
  if (!confirm('Afbeelding verwijderen?')) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (e) {
    // Bestand bestaat al niet meer
  }
  await deleteDoc(doc(db, 'media', docId));
  showDashNotification('Afbeelding verwijderd.', 'info');
}

setupImageUpload(mediaDropZone, mediaFileInput, () => {
  showDashNotification('Afbeelding toegevoegd aan de media library.', 'success');
});

/* ===================================================================
   HULPFUNCTIES
   ================================================================= */

function formatDate(date) {
  return date.toLocaleDateString('nl-NL', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  });
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

export function showDashNotification(message, type = 'info') {
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

/* ===== Globale functies voor inline onclick-handlers ===== */
window.editBlog            = editBlog;
window.previewBlogById     = previewBlogById;
window.moveBlogToTrash     = moveBlogToTrash;
window.restoreBlog         = restoreBlog;
window.deleteBlogPermanent = deleteBlogPermanent;
window.approveComment      = approveComment;
window.markCommentRead     = markCommentRead;
window.markCommentSpam     = markCommentSpam;
window.deleteComment       = deleteComment;
window.deleteUser          = deleteUser;
window.deleteMedia         = deleteMedia;
