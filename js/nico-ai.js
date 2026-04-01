/**
 * nico-ai.js
 * ----------
 * Logica voor de "Nico AI" sectie in het admin-dashboard.
 *
 * Integratie met Google Gemini via Firebase AI Logic.
 *
 * =====================================================================
 * HOE DE FIREBASE AI LOGIC SDK TE KOPPELEN
 * =====================================================================
 * 1. Zorg dat Firebase AI Logic is ingeschakeld in je Firebase-project:
 *    Firebase Console → Build → AI Logic → Enable
 *
 * 2. Vervang de functie `callGeminiAPI` door de echte aanroep:
 *
 *    import { getAI, getGenerativeModel } from 'firebase/ai';
 *    const ai    = getAI(app);
 *    const model = getGenerativeModel(ai, { model: 'gemini-2.0-flash' });
 *    const result = await model.generateContent(prompt);
 *    return result.response.text();
 * =====================================================================
 */

/* ===== GEMINI API AANROEP ===== */

async function callGeminiAPI(prompt, purpose) {
  // Tijdelijke simulatie — vervang door echte Firebase AI Logic aanroep.
  await new Promise(resolve => setTimeout(resolve, 1500));

  const placeholders = {
    schrijf:    '✏️ [Hier verschijnt de gegenereerde blogpost zodra Gemini is gekoppeld.]\n\nVoeg de Firebase AI Logic SDK toe en vervang de simulatie in js/nico-ai.js.',
    verbeter:   '🔍 [Hier verschijnt de verbeterde tekst zodra Gemini is gekoppeld.]\n\nVoeg de Firebase AI Logic SDK toe en vervang de simulatie in js/nico-ai.js.',
    brainstorm: '💡 [Hier verschijnen de brainstorm-ideeën zodra Gemini is gekoppeld.]\n\nVoeg de Firebase AI Logic SDK toe en vervang de simulatie in js/nico-ai.js.',
  };

  return placeholders[purpose] || '[Geen response ontvangen.]';
}

/* ===== PROMPT CONSTRUCTIE ===== */

function buildPrompt(inputTekst, purpose) {
  switch (purpose) {
    case 'schrijf':
      return `Schrijf een blogpost in het Nederlands over ${inputTekst}. Houd rekening met een informele toon en circa 500 woorden.`;
    case 'verbeter':
      return `Controleer en verbeter de volgende Nederlandse tekst op grammatica, spelling en zinsbouw. Geef de gecorrigeerde tekst terug:\n\n${inputTekst}`;
    case 'brainstorm':
      return `Brainstorm 5 unieke ideeën voor blogposts in het Nederlands over het onderwerp: ${inputTekst}.`;
    default:
      return inputTekst;
  }
}

/* ===== OUTPUT WEERGEVEN ===== */

function showAiOutput(rawText, outputEl, wrapperEl) {
  const escaped = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  outputEl.innerHTML = escaped;
  wrapperEl.style.display = 'block';
  wrapperEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ===== GENERIEKE AI-ACTIE HANDLER ===== */

async function handleAiAction(purpose, inputId, outputId, wrapperId, btn, showNotification) {
  const inputEl   = document.getElementById(inputId);
  const outputEl  = document.getElementById(outputId);
  const wrapperEl = document.getElementById(wrapperId);

  if (!inputEl || !outputEl || !wrapperEl) return;

  const inputTekst = inputEl.value.trim();
  if (!inputTekst) {
    showNotification('Vul eerst een tekst of onderwerp in.', 'warning');
    inputEl.focus();
    return;
  }

  btn.disabled         = true;
  btn.dataset.origText = btn.textContent;
  btn.textContent      = '⏳ Nico AI is bezig...';
  outputEl.textContent = '';
  wrapperEl.style.display = 'none';

  try {
    const prompt   = buildPrompt(inputTekst, purpose);
    const response = await callGeminiAPI(prompt, purpose);
    showAiOutput(response, outputEl, wrapperEl);
  } catch (err) {
    console.error('Nico AI fout:', err);
    showNotification('Er is een fout opgetreden bij Nico AI. Probeer het opnieuw.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = btn.dataset.origText || btn.textContent;
  }
}

/* ===== INITIALISATIE ===== */

/**
 * Stel alle Nico AI event listeners in.
 * @param {function} showNotification - showDashNotification van dashboard.js
 */
export function initNicoAI(showNotification) {
  const genereerBtn = document.getElementById('genereerTekstBtn');
  if (genereerBtn) {
    genereerBtn.addEventListener('click', () =>
      handleAiAction('schrijf', 'schrijfInput', 'schrijfOutput', 'schrijfOutputWrapper', genereerBtn, showNotification)
    );
  }

  const verbeterBtn = document.getElementById('verbeterTekstBtn');
  if (verbeterBtn) {
    verbeterBtn.addEventListener('click', () =>
      handleAiAction('verbeter', 'verbeterInput', 'verbeterOutput', 'verbeterOutputWrapper', verbeterBtn, showNotification)
    );
  }

  const brainstormBtn = document.getElementById('brainstormBtn');
  if (brainstormBtn) {
    brainstormBtn.addEventListener('click', () =>
      handleAiAction('brainstorm', 'brainstormInput', 'brainstormOutput', 'brainstormOutputWrapper', brainstormBtn, showNotification)
    );
  }

  document.querySelectorAll('.ai-copy-btn').forEach(copyBtn => {
    copyBtn.addEventListener('click', () => {
      const targetId = copyBtn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const text = targetEl.innerText || targetEl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        showNotification('Tekst gekopieerd naar klembord!', 'success');
      }).catch(() => {
        showNotification('Kopiëren mislukt. Selecteer de tekst handmatig.', 'error');
      });
    });
  });
}
