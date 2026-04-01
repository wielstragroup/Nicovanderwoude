/**
 * index.js
 * --------
 * Logica voor de homepagina:
 * - Jaar in footer
 * - Hamburger menu
 * - Dashboard-link zichtbaar/verbergen op basis van inlogstatus
 */

import { auth }            from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';

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
