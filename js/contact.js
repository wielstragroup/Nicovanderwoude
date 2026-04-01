/**
 * contact.js
 * ----------
 * Logica voor de contactpagina:
 * - Jaar in footer
 * - Hamburger menu
 * - Dashboard-link zichtbaar/verbergen op basis van inlogstatus
 * - Contactformulier verwerken (opslaan in Firestore)
 */

import { auth, db }           from './firebase-config.js';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

/* ===== ADMIN LINK ZICHTBAARHEID ===== */
onAuthStateChanged(auth, user => {
  const navDash = document.getElementById('nav-dashboard');
  if (navDash) navDash.style.display = user ? 'inline-block' : 'none';
});

/* ===== CONTACTFORMULIER ===== */
const contactForm     = document.getElementById('contact-form');
const contactFeedback = document.getElementById('contact-feedback');

if (contactForm) {
  contactForm.addEventListener('submit', async e => {
    e.preventDefault();
    contactFeedback.textContent = '';
    contactFeedback.style.color = '';

    const name    = document.getElementById('contact-name').value.trim();
    const email   = document.getElementById('contact-email').value.trim();
    const subject = document.getElementById('contact-subject').value.trim();
    const message = document.getElementById('contact-message').value.trim();

    if (!name || !email || !message) {
      contactFeedback.textContent = '⚠️ Vul alle verplichte velden in.';
      contactFeedback.style.color = '#c0392b';
      return;
    }

    const submitBtn = contactForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Versturen...';

    try {
      await addDoc(collection(db, 'contact_messages'), {
        name,
        email,
        subject,
        message,
        read:      false,
        createdAt: serverTimestamp(),
      });

      contactForm.reset();
      contactFeedback.textContent = '✅ Bericht verzonden! Ik neem zo snel mogelijk contact met je op.';
      contactFeedback.style.color = '#4a9268';
    } catch (err) {
      console.error('Fout bij versturen bericht:', err);
      contactFeedback.textContent = '❌ Er is iets misgegaan. Probeer het opnieuw.';
      contactFeedback.style.color = '#c0392b';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '📨 Bericht versturen';
    }
  });
}
