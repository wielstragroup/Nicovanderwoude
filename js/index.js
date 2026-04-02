/**
 * index.js
 * --------
 * Logica voor de homepagina:
 * - Jaar in footer
 * - Hamburger menu
 * - Dashboard-link zichtbaar/verbergen op basis van inlogstatus
 * - Homepage-teksten laden vanuit Firestore (site_settings/homepage)
 */

import { auth, db }          from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, doc }        from 'firebase/firestore';

document.getElementById('year').textContent = new Date().getFullYear();

/* ===== HAMBURGER MENU ===== */
const hamburgerBtn = document.getElementById('hamburger-btn');
const navbarLinks  = document.getElementById('navbar-links');

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

/* ===== ADMIN LINK ZICHTBAARHEID ===== */
onAuthStateChanged(auth, user => {
  const navDash = document.getElementById('nav-dashboard');
  if (navDash) navDash.style.display = user ? 'inline-block' : 'none';
});

/* ===== HOMEPAGE TEKSTEN LADEN ===== */
async function loadPageSettings() {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'homepage'));
    if (!snap.exists()) return;
    const data = snap.data();

    const heroTitleEl    = document.getElementById('hero-title');
    const heroSubtitleEl = document.getElementById('hero-subtitle');
    const aboutTitleEl   = document.getElementById('about-title');
    const aboutContentEl = document.getElementById('about-content');
    const aboutSection   = document.getElementById('about-section');

    if (heroTitleEl    && data.heroTitle)    heroTitleEl.textContent    = data.heroTitle;
    if (heroSubtitleEl && data.heroSubtitle) heroSubtitleEl.textContent = data.heroSubtitle;
    if (aboutTitleEl   && data.aboutTitle)   aboutTitleEl.textContent   = data.aboutTitle;
    if (aboutContentEl && data.aboutContent) {
      // textContent is XSS-safe; CSS white-space:pre-line handles newlines
      aboutContentEl.textContent = data.aboutContent;
    }
    // Verberg de "Over mij" sectie als er geen titel en geen inhoud is ingesteld
    if (aboutSection && !data.aboutTitle && !data.aboutContent) {
      aboutSection.style.display = 'none';
    }
  } catch (err) {
    console.warn('Kon paginainstellingen niet laden:', err);
  }
}

loadPageSettings();
