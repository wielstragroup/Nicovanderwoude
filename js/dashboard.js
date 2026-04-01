/**
 * dashboard.js
 * ------------
 * Admin-dashboard logica:
 * - Inloggen / uitloggen via Firebase Authentication
 * - CRUD voor blogs (aanmaken, bewerken, verwijderen, herstellen)
 * - Drafts / concepten opslaan
 * - Categorieën & tags beheren
 * - Afbeeldingen uploaden (drag & drop + klik) naar Firebase Storage
 * - Publicatiedatum plannen
 * - Reacties beheren (goedkeuren, verwijderen, markeren als gelezen)
 * - Gebruikersbeheer (admin/redacteur toevoegen, rollen instellen)
 * - Statistieken tonen (blogs, reacties, views)
 * - Rich-text editor (Quill.js)
 * - Preview van blog voor publicatie
 * - Prullenbak / undo voor verwijderde blogs
 */

/* ===== CONSTANTEN ===== */
const ROLES = { ADMIN: 'admin', EDITOR: 'editor' }; // Beschikbare gebruikersrollen

/* ===== DOM-REFERENTIES ===== */
// Login
const loginSection    = document.getElementById('login-section');
const dashboardMain   = document.getElementById('dashboard-main');
const loginForm       = document.getElementById('login-form');
const loginError      = document.getElementById('login-error');
const userEmailSpan   = document.getElementById('user-email');
const logoutBtn       = document.getElementById('logout-btn');

// Navigatie tabs
const navBtns         = document.querySelectorAll('.dash-nav-btn');

// Statistieken
const statBlogs       = document.getElementById('stat-blogs');
const statComments    = document.getElementById('stat-comments');
const statViews       = document.getElementById('stat-views');
const statPending     = document.getElementById('stat-pending');

// Blog editor
const blogEditorSection  = document.getElementById('blog-editor-section');
const blogListSection    = document.getElementById('blog-list-section');
const blogForm           = document.getElementById('blog-form');
const blogTitleInput     = document.getElementById('blog-title');
const blogCategoryInput  = document.getElementById('blog-category');
const blogTagsInput      = document.getElementById('blog-tags');
const blogExcerptInput   = document.getElementById('blog-excerpt');
const blogScheduleInput  = document.getElementById('blog-schedule');
const saveDraftBtn       = document.getElementById('save-draft-btn');
const publishBtn         = document.getElementById('publish-btn');
const previewBtn         = document.getElementById('preview-btn');
const newBlogBtn         = document.getElementById('new-blog-btn');
const cancelEditBtn      = document.getElementById('cancel-edit-btn');
const blogsList          = document.getElementById('blogs-list');
const blogsSearch        = document.getElementById('blogs-search');
const statusFilter       = document.getElementById('status-filter');
const imageDropZone      = document.getElementById('image-drop-zone');
const imageFileInput     = document.getElementById('image-file-input');
const imagePreviewEl     = document.getElementById('image-preview');
const uploadProgressEl   = document.getElementById('upload-progress');

// Reactiebeheer
const commentsTableBody  = document.getElementById('comments-table-body');
const commentsSearch     = document.getElementById('comments-search');
const commentsFilter     = document.getElementById('comments-filter');

// Gebruikersbeheer
const usersTableBody     = document.getElementById('users-table-body');
const addUserForm        = document.getElementById('add-user-form');
const addUserError       = document.getElementById('add-user-error');

// Media manager
const mediaGrid          = document.getElementById('media-grid');
const mediaDropZone      = document.getElementById('media-drop-zone');
const mediaFileInput     = document.getElementById('media-file-input');

// Prullenbak
const trashList          = document.getElementById('trash-list');

// Preview modal
const previewModal       = document.getElementById('preview-modal');
const previewClose       = document.getElementById('preview-close');
const previewContent     = document.getElementById('preview-content');

/* ===== GLOBALE STAAT ===== */
let currentUser        = null;   // Huidig ingelogde gebruiker
let currentUserRole    = null;   // Rol van de ingelogde gebruiker
let editingBlogId      = null;   // ID van de blog die bewerkt wordt (null = nieuw)
let quillEditor        = null;   // Quill rich-text editor instantie
let uploadedImageUrl   = null;   // URL van geüploade afbeelding voor de blog

/* ===================================================================
   AUTHENTICATIE
   ================================================================= */

/**
 * Verwerk het inlogformulier: authenticeert met e-mail en wachtwoord.
 */
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn      = loginForm.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = 'Inloggen...';
    loginError.textContent = '';

    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      loginError.textContent = vertaalAuthFout(err.code);
      btn.disabled = false;
      btn.textContent = 'Inloggen';
    }
  });
}

/**
 * Uitloggen uit Firebase Authentication.
 */
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => auth.signOut());
}

/**
 * Luister op authenticatiestatus en toon juiste sectie.
 */
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    // Gebruikersrol ophalen uit Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (userDoc.exists) {
      currentUserRole = userDoc.data().role;
    } else {
      // Eerste keer inloggen: admin-document aanmaken
      currentUserRole = ROLES.ADMIN;
      await db.collection('users').doc(user.uid).set({
        uid:       user.uid,
        email:     user.email,
        name:      user.displayName || user.email.split('@')[0],
        role:      ROLES.ADMIN,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    loginSection.style.display  = 'none';
    dashboardMain.style.display = 'block';
    if (userEmailSpan) userEmailSpan.textContent = user.email;

    // Dashboard initialiseren
    initQuill();
    loadDashboardStats();
    loadBlogsList();
    loadCommentsList();
    loadUsersList();
    loadMediaLibrary();
    loadTrash();
    setupScheduledPublishing(); // Controleer geplande blogs
  } else {
    currentUser             = null;
    currentUserRole         = null;
    loginSection.style.display  = 'block';
    dashboardMain.style.display = 'none';
  }
});

/**
 * Vertaal Firebase Auth-foutcodes naar Nederlandse meldingen.
 */
function vertaalAuthFout(code) {
  const fouten = {
    'auth/user-not-found':       'Geen account gevonden met dit e-mailadres.',
    'auth/wrong-password':       'Onjuist wachtwoord.',
    'auth/invalid-email':        'Ongeldig e-mailadres.',
    'auth/too-many-requests':    'Te veel pogingen. Probeer het later opnieuw.',
    'auth/invalid-credential':   'Ongeldig e-mailadres of wachtwoord.',
  };
  return fouten[code] || 'Fout bij inloggen. Controleer je gegevens.';
}

/* ===================================================================
   NAVIGATIE TABS
   ================================================================= */

/**
 * Wisselen tussen dashboard-secties via de navigatieknoppen.
 */
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;

    // Actieve knop bijwerken
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Secties tonen/verbergen
    document.querySelectorAll('.dash-section').forEach(s => s.style.display = 'none');
    const targetEl = document.getElementById(`section-${target}`);
    if (targetEl) targetEl.style.display = 'block';
  });
});

/* ===================================================================
   STATISTIEKEN
   ================================================================= */

/**
 * Laad statistieken: aantal blogs, reacties, views en wachtende reacties.
 */
function loadDashboardStats() {
  // Aantal gepubliceerde blogs
  db.collection('blogs').where('status', '==', 'published').onSnapshot(snap => {
    if (statBlogs) statBlogs.textContent = snap.size;
  });

  // Totaal aantal reacties
  db.collection('comments').onSnapshot(snap => {
    if (statComments) statComments.textContent = snap.size;
    // Reacties die nog niet goedgekeurd zijn
    const pending = snap.docs.filter(d => !d.data().approved && !d.data().spam).length;
    if (statPending) statPending.textContent = pending;
  });

  // Totaal aantal views over alle blogs
  db.collection('blogs').onSnapshot(snap => {
    let totalViews = 0;
    snap.forEach(doc => { totalViews += (doc.data().views || 0); });
    if (statViews) statViews.textContent = totalViews;
  });
}

/* ===================================================================
   RICH TEXT EDITOR (QUILL.JS)
   ================================================================= */

/**
 * Initialiseer de Quill rich-text editor met een uitgebreide toolbar.
 */
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
        ['clean']
      ]
    }
  });
}

/* ===================================================================
   AFBEELDINGEN UPLOADEN (DRAG & DROP + KLIK)
   ================================================================= */

/**
 * Stel de drag-and-drop zone in voor de blog-editor.
 */
function setupImageUpload(dropZone, fileInput, onUpload) {
  if (!dropZone || !fileInput) return;

  // Klik op de zone opent de bestandskiezer
  dropZone.addEventListener('click', () => fileInput.click());

  // Bestand kiezen via de input
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadImage(fileInput.files[0], dropZone, onUpload);
  });

  // Drag over: visuele feedback
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  // Bestand laten vallen
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) uploadImage(e.dataTransfer.files[0], dropZone, onUpload);
  });
}

/**
 * Upload een afbeelding naar Firebase Storage en roep de callback aan met de URL.
 */
async function uploadImage(file, dropZone, onUpload) {
  // Alleen afbeeldingen toegestaan
  if (!file.type.startsWith('image/')) {
    showDashNotification('Alleen afbeeldingsbestanden zijn toegestaan.', 'error');
    return;
  }
  // Max bestandsgrootte: 5MB
  if (file.size > 5 * 1024 * 1024) {
    showDashNotification('Afbeelding is te groot (max 5MB).', 'error');
    return;
  }

  // Unieke bestandsnaam genereren op basis van timestamp en willekeurige string
  // Originele bestandsnaam wordt NIET gebruikt in het pad om path-traversal te voorkomen
  const ext       = file.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '').substring(0, 5) || 'img';
  const fileName  = `images/${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${ext}`;
  const storageRef = storage.ref(fileName);

  // Voortgangsindicator tonen
  if (uploadProgressEl) uploadProgressEl.style.display = 'block';
  if (dropZone) dropZone.classList.add('uploading');

  try {
    const uploadTask = storageRef.put(file);

    // Upload voortgang bijhouden
    uploadTask.on('state_changed', snapshot => {
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      if (uploadProgressEl) uploadProgressEl.textContent = `Uploaden: ${pct}%`;
    });

    await uploadTask;
    const url = await storageRef.getDownloadURL();

    // Sla metadata op in Firestore voor de media manager
    await db.collection('media').add({
      url,
      name:      file.name,
      size:      file.size,
      type:      file.type,
      uploadedBy: currentUser ? currentUser.uid : 'unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
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

// Stel de drop zone in voor de blog-editor
setupImageUpload(imageDropZone, imageFileInput, url => {
  uploadedImageUrl = url;
  if (imagePreviewEl) {
    imagePreviewEl.src        = url;
    imagePreviewEl.style.display = 'block';
  }
});

/* ===================================================================
   BLOG BEHEER (CRUD)
   ================================================================= */

/**
 * Laad de lijst van blogs in het dashboard (met zoek- en statusfilter).
 */
function loadBlogsList() {
  if (!blogsList) return;

  const search  = (blogsSearch ? blogsSearch.value.trim().toLowerCase() : '');
  const status  = statusFilter ? statusFilter.value : '';

  // Luister realtime op wijzigingen in de blogs-collectie
  db.collection('blogs').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    let blogs = [];
    snapshot.forEach(doc => blogs.push({ id: doc.id, ...doc.data() }));

    // Statusfilter toepassen
    if (status) blogs = blogs.filter(b => b.status === status);

    // Zoekfilter toepassen
    if (search) {
      blogs = blogs.filter(b =>
        b.title.toLowerCase().includes(search) ||
        (b.category || '').toLowerCase().includes(search) ||
        (b.tags || []).some(t => t.toLowerCase().includes(search))
      );
    }

    // Prullenbak-blogs niet tonen in de reguliere lijst
    blogs = blogs.filter(b => b.status !== 'trash');

    renderBlogsList(blogs);
  });
}

/**
 * Render de bloglijst in het dashboard.
 */
function renderBlogsList(blogs) {
  if (!blogsList) return;

  if (blogs.length === 0) {
    blogsList.innerHTML = '<p class="no-items">Geen blogs gevonden.</p>';
    return;
  }

  blogsList.innerHTML = blogs.map(blog => {
    const date       = blog.createdAt ? formatDate(blog.createdAt.toDate()) : '-';
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

/**
 * Geeft een gekleurde statusbadge terug voor een blogstatus.
 */
function getStatusBadge(status) {
  const badges = {
    published: '<span class="badge badge-success">Gepubliceerd</span>',
    draft:     '<span class="badge badge-warning">Concept</span>',
    scheduled: '<span class="badge badge-info">Gepland</span>',
    trash:     '<span class="badge badge-danger">Prullenbak</span>'
  };
  return badges[status] || `<span class="badge">${status}</span>`;
}

// Zoeken en filteren in de bloglijst
if (blogsSearch) blogsSearch.addEventListener('input', loadBlogsList);
if (statusFilter) statusFilter.addEventListener('change', loadBlogsList);

/**
 * Toon het formulier om een nieuwe blog te maken.
 */
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

/**
 * Annuleer het bewerken van een blog en ga terug naar de lijst.
 */
if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    blogEditorSection.style.display = 'none';
    blogListSection.style.display   = 'block';
    editingBlogId = null;
  });
}

/**
 * Laad een bestaande blog in de editor voor bewerking.
 */
async function editBlog(blogId) {
  editingBlogId = blogId;
  const doc     = await db.collection('blogs').doc(blogId).get();
  if (!doc.exists) return;
  const blog    = doc.data();

  blogTitleInput.value    = blog.title    || '';
  blogCategoryInput.value = blog.category || '';
  blogTagsInput.value     = (blog.tags || []).join(', ');
  blogExcerptInput.value  = blog.excerpt  || '';
  uploadedImageUrl        = blog.imageUrl || null;

  // Zet geplande datum indien aanwezig
  if (blog.scheduledAt && blogScheduleInput) {
    const d = blog.scheduledAt.toDate();
    blogScheduleInput.value = d.toISOString().slice(0, 16);
  }

    // Laad inhoud in Quill editor via innerHTML (veiligst voor admin-gegenereerde content)
    if (quillEditor) quillEditor.root.innerHTML = blog.content || '';

  // Toon opgeslagen afbeelding
  if (uploadedImageUrl && imagePreviewEl) {
    imagePreviewEl.src         = uploadedImageUrl;
    imagePreviewEl.style.display = 'block';
  }

  blogEditorSection.style.display = 'block';
  blogListSection.style.display   = 'none';
  document.getElementById('blog-editor-title').textContent = 'Blog bewerken';
}

/**
 * Opslaan als concept (draft).
 */
if (saveDraftBtn) {
  saveDraftBtn.addEventListener('click', () => saveBlog('draft'));
}

/**
 * Publiceer de blog direct of gepland.
 */
if (publishBtn) {
  publishBtn.addEventListener('click', () => {
    const scheduled = blogScheduleInput ? blogScheduleInput.value : '';
    if (scheduled) {
      saveBlog('scheduled');
    } else {
      saveBlog('published');
    }
  });
}

/**
 * Sla de blog op in Firestore met de opgegeven status.
 */
async function saveBlog(status) {
  const title   = blogTitleInput.value.trim();
  const content = quillEditor ? quillEditor.root.innerHTML : '';

  if (!title) {
    showDashNotification('Vul een titel in.', 'error');
    return;
  }

  // Tags verwerken: komma-gescheiden string naar array
  const tagsRaw = blogTagsInput ? blogTagsInput.value : '';
  const tags    = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  // Geplande publicatiedatum
  let scheduledAt = null;
  if (blogScheduleInput && blogScheduleInput.value) {
    scheduledAt = firebase.firestore.Timestamp.fromDate(new Date(blogScheduleInput.value));
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
    updatedAt:  firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (editingBlogId) {
      // Bestaande blog bijwerken
      // Als status wijzigt naar gepubliceerd, stel publishedAt in als dat nog niet bestaat
      if (status === 'published') {
        const existing = await db.collection('blogs').doc(editingBlogId).get();
        if (!existing.data().publishedAt) {
          blogData.publishedAt = scheduledAt || firebase.firestore.FieldValue.serverTimestamp();
        }
      }
      await db.collection('blogs').doc(editingBlogId).update(blogData);
    } else {
      // Nieuwe blog aanmaken
      blogData.createdAt   = firebase.firestore.FieldValue.serverTimestamp();
      blogData.publishedAt = status === 'published'
        ? firebase.firestore.FieldValue.serverTimestamp()
        : scheduledAt;
      blogData.views       = 0;
      await db.collection('blogs').add(blogData);
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

/**
 * Verplaats een blog naar de prullenbak (soft delete).
 */
async function moveBlogToTrash(blogId, title) {
  if (!confirm(`"${title}" naar de prullenbak verplaatsen?`)) return;
  await db.collection('blogs').doc(blogId).update({
    status:    'trash',
    trashedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showDashNotification('Blog naar prullenbak verplaatst.', 'info');
}

/**
 * Toon een preview van een blog in een modaal venster.
 */
async function previewBlogById(blogId) {
  const doc  = await db.collection('blogs').doc(blogId).get();
  if (!doc.exists) return;
  const blog = doc.data();
  showPreview(blog);
}

/**
 * Preview van de blog die momenteel in de editor staat.
 */
if (previewBtn) {
  previewBtn.addEventListener('click', () => {
    const title   = blogTitleInput.value.trim() || 'Zonder titel';
    const content = quillEditor ? quillEditor.root.innerHTML : '';
    showPreview({ title, content, category: blogCategoryInput.value, tags: blogTagsInput.value.split(',').map(t=>t.trim()).filter(Boolean), imageUrl: uploadedImageUrl });
  });
}

/**
 * Render de preview in het modaal venster.
 */
function showPreview(blog) {
  const img = blog.imageUrl
    ? `<img src="${escapeHtml(blog.imageUrl)}" style="max-width:100%;border-radius:8px;margin-bottom:1rem;">`
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

if (previewClose) previewClose.addEventListener('click', () => {
  previewModal.style.display = 'none';
});
previewModal && previewModal.addEventListener('click', e => {
  if (e.target === previewModal) previewModal.style.display = 'none';
});

/* ===================================================================
   GEPLANDE PUBLICATIE
   ================================================================= */

/**
 * Controleer elk minuut of geplande blogs gepubliceerd moeten worden.
 */
function setupScheduledPublishing() {
  publishScheduled(); // Direct uitvoeren bij inloggen
  setInterval(publishScheduled, 60000); // Daarna elke minuut
}

/**
 * Publiceer blogs waarvan de geplande datum verstreken is.
 */
async function publishScheduled() {
  const now = firebase.firestore.Timestamp.now();
  const snap = await db.collection('blogs')
    .where('status', '==', 'scheduled')
    .where('scheduledAt', '<=', now)
    .get();

  // Promise.all zodat alle updates parallel worden uitgevoerd met correcte foutafhandeling
  await Promise.all(snap.docs.map(doc =>
    doc.ref.update({
      status:      'published',
      publishedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
  ));
}

/* ===================================================================
   PRULLENBAK
   ================================================================= */

/**
 * Laad alle blogs in de prullenbak.
 */
function loadTrash() {
  if (!trashList) return;

  db.collection('blogs').where('status', '==', 'trash').onSnapshot(snapshot => {
    if (snapshot.empty) {
      trashList.innerHTML = '<p class="no-items">Prullenbak is leeg.</p>';
      return;
    }

    trashList.innerHTML = snapshot.docs.map(doc => {
      const blog = doc.data();
      return `
        <div class="trash-item">
          <strong>${escapeHtml(blog.title)}</strong>
          <div class="trash-actions">
            <button class="btn btn-sm btn-success" onclick="restoreBlog('${doc.id}')">↩️ Herstellen</button>
            <button class="btn btn-sm btn-danger"  onclick="deleteBlogPermanent('${doc.id}', '${escapeHtml(blog.title)}')">🗑️ Definitief verwijderen</button>
          </div>
        </div>`;
    }).join('');
  });
}

/**
 * Herstel een blog uit de prullenbak (terugzetten als concept).
 */
async function restoreBlog(blogId) {
  await db.collection('blogs').doc(blogId).update({ status: 'draft', trashedAt: null });
  showDashNotification('Blog hersteld als concept.', 'success');
}

/**
 * Verwijder een blog definitief (kan niet ongedaan worden gemaakt).
 */
async function deleteBlogPermanent(blogId, title) {
  if (!confirm(`"${title}" definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
  await db.collection('blogs').doc(blogId).delete();
  showDashNotification('Blog definitief verwijderd.', 'info');
}

/* ===================================================================
   REACTIES BEHEREN
   ================================================================= */

/**
 * Laad alle reacties voor het reactiebeheer-paneel.
 */
function loadCommentsList() {
  if (!commentsTableBody) return;

  db.collection('comments').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    let comments = [];
    snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));

    // Filter toepassen (goedgekeurd / in afwachting / spam)
    const filter = commentsFilter ? commentsFilter.value : '';
    if (filter === 'pending')  comments = comments.filter(c => !c.approved && !c.spam);
    if (filter === 'approved') comments = comments.filter(c => c.approved);
    if (filter === 'spam')     comments = comments.filter(c => c.spam);

    // Zoekfilter
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

/**
 * Render de reactielijst in de admin-tabel.
 */
function renderCommentsList(comments) {
  if (!commentsTableBody) return;

  if (comments.length === 0) {
    commentsTableBody.innerHTML = '<tr><td colspan="5" class="no-items">Geen reacties gevonden.</td></tr>';
    return;
  }

  commentsTableBody.innerHTML = comments.map(c => {
    const date    = c.createdAt ? formatDate(c.createdAt.toDate()) : '-';
    const unread  = !c.read ? '<span class="badge badge-info">Nieuw</span>' : '';
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

// Zoeken en filteren in reacties
if (commentsSearch) commentsSearch.addEventListener('input', loadCommentsList);
if (commentsFilter) commentsFilter.addEventListener('change', loadCommentsList);

/** Keur een reactie goed. */
async function approveComment(commentId) {
  await db.collection('comments').doc(commentId).update({ approved: true, read: true });
  showDashNotification('Reactie goedgekeurd.', 'success');
}

/** Markeer een reactie als gelezen. */
async function markCommentRead(commentId) {
  await db.collection('comments').doc(commentId).update({ read: true });
}

/** Markeer een reactie als spam. */
async function markCommentSpam(commentId) {
  await db.collection('comments').doc(commentId).update({ spam: true, approved: false });
  showDashNotification('Reactie als spam gemarkeerd.', 'info');
}

/** Verwijder een reactie definitief. */
async function deleteComment(commentId) {
  if (!confirm('Reactie verwijderen?')) return;
  await db.collection('comments').doc(commentId).delete();
  showDashNotification('Reactie verwijderd.', 'info');
}

/* ===================================================================
   GEBRUIKERSBEHEER
   ================================================================= */

/**
 * Laad alle gebruikers uit Firestore.
 */
function loadUsersList() {
  if (!usersTableBody) return;

  db.collection('users').onSnapshot(snapshot => {
    if (snapshot.empty) {
      usersTableBody.innerHTML = '<tr><td colspan="4" class="no-items">Geen gebruikers gevonden.</td></tr>';
      return;
    }

    usersTableBody.innerHTML = snapshot.docs.map(doc => {
      const u = doc.data();
      const isCurrentUser = currentUser && doc.id === currentUser.uid;
      return `
        <tr>
          <td>${escapeHtml(u.name || '-')}</td>
          <td>${escapeHtml(u.email || '-')}</td>
          <td>
            <select class="role-select" data-uid="${doc.id}" ${isCurrentUser ? 'disabled' : ''}>
              <option value="admin"   ${u.role === 'admin'   ? 'selected' : ''}>Admin</option>
              <option value="editor"  ${u.role === 'editor'  ? 'selected' : ''}>Redacteur</option>
            </select>
          </td>
          <td>
            ${!isCurrentUser
              ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${doc.id}')">🗑️ Verwijderen</button>`
              : '<span class="badge badge-info">Jij</span>'}
          </td>
        </tr>`;
    }).join('');

    // Rol-wijziging opslaan wanneer de select verandert
    document.querySelectorAll('.role-select').forEach(sel => {
      sel.addEventListener('change', async e => {
        const uid  = e.target.dataset.uid;
        const role = e.target.value;
        await db.collection('users').doc(uid).update({ role });
        showDashNotification('Rol bijgewerkt.', 'success');
      });
    });
  });
}

/**
 * Vraag de admin om zijn wachtwoord via een veilige modal (in plaats van prompt()).
 * Retourneert een Promise met het ingevoerde wachtwoord, of null bij annulering.
 */
function askAdminPassword() {
  return new Promise(resolve => {
    const modal    = document.getElementById('confirm-password-modal');
    const input    = document.getElementById('admin-confirm-password');
    const okBtn    = document.getElementById('confirm-pw-ok');
    const cancelBtn = document.getElementById('confirm-pw-cancel');

    input.value = '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 50);

    function cleanup() {
      modal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    }
    function onOk() {
      const pw = input.value;
      cleanup();
      resolve(pw || null);
    }
    function onCancel() {
      cleanup();
      resolve(null);
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);

    // Enter-toets bevestigt
    input.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter') { input.removeEventListener('keydown', handler); onOk(); }
    });
  });
}

/**
 * Voeg een nieuwe admin of redacteur toe via het formulier.
 * Maakt een Firebase Authentication-account aan + Firestore-document.
 */
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
      // Gebruik veilige modal in plaats van prompt() voor wachtwoordinvoer
      const adminPassword = await askAdminPassword();
      if (!adminPassword) { btn.disabled = false; return; }

      // Nieuw account aanmaken
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(cred.user.uid).set({
        uid:       cred.user.uid,
        name,
        email,
        role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Opnieuw inloggen als admin om sessie te herstellen
      await auth.signInWithEmailAndPassword(adminEmail, adminPassword);

      addUserForm.reset();
      showDashNotification(`Gebruiker "${name}" aangemaakt als ${role}.`, 'success');
    } catch (err) {
      if (addUserError) addUserError.textContent = vertaalAuthFout(err.code);
    } finally {
      btn.disabled = false;
    }
  });
}

/** Verwijder een gebruiker uit Firestore (Auth-account blijft bestaan). */
async function deleteUser(uid) {
  if (!confirm('Gebruiker verwijderen uit de database? Het Firebase Auth-account blijft bestaan.')) return;
  await db.collection('users').doc(uid).delete();
  showDashNotification('Gebruiker verwijderd.', 'info');
}

/* ===================================================================
   MEDIA MANAGER
   ================================================================= */

/**
 * Laad de media library: alle geüploade afbeeldingen uit Firestore.
 */
function loadMediaLibrary() {
  if (!mediaGrid) return;

  db.collection('media').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    if (snapshot.empty) {
      mediaGrid.innerHTML = '<p class="no-items">Geen afbeeldingen gevonden.</p>';
      return;
    }

    mediaGrid.innerHTML = snapshot.docs.map(doc => {
      const m = doc.data();
      return `
        <div class="media-item">
          <img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.name)}" loading="lazy">
          <div class="media-info">
            <small>${escapeHtml(m.name)}</small>
            <button class="btn btn-xs btn-danger" onclick="deleteMedia('${doc.id}', '${escapeHtml(m.url)}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
  });
}

/** Verwijder een media-item uit Firestore en optioneel uit Storage. */
async function deleteMedia(docId, url) {
  if (!confirm('Afbeelding verwijderen?')) return;
  try {
    // Verwijder uit Storage
    await storage.refFromURL(url).delete();
  } catch (e) {
    // Bestand bestaat al niet meer
  }
  await db.collection('media').doc(docId).delete();
  showDashNotification('Afbeelding verwijderd.', 'info');
}

// Drop zone voor media manager
setupImageUpload(mediaDropZone, mediaFileInput, url => {
  showDashNotification('Afbeelding toegevoegd aan de media library.', 'success');
});

/* ===================================================================
   HULPFUNCTIES
   ================================================================= */

/** Formatteer een Date naar een leesbare Nederlandse datum. */
function formatDate(date) {
  return date.toLocaleDateString('nl-NL', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric'
  });
}

/** Escape HTML-tekens om XSS te voorkomen. */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/** Toon een dashboard-notificatie (toast). */
function showDashNotification(message, type = 'info') {
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

// Globale functies beschikbaar stellen voor inline onclick-handlers in HTML
window.editBlog              = editBlog;
window.previewBlogById       = previewBlogById;
window.moveBlogToTrash       = moveBlogToTrash;
window.restoreBlog           = restoreBlog;
window.deleteBlogPermanent   = deleteBlogPermanent;
window.approveComment        = approveComment;
window.markCommentRead       = markCommentRead;
window.markCommentSpam       = markCommentSpam;
window.deleteComment         = deleteComment;
window.deleteUser            = deleteUser;
window.deleteMedia           = deleteMedia;
