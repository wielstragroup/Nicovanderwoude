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
 * 2. Voeg de Firebase AI Logic SDK toe aan dashboard.html (vóór dit script):
 *    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-ai.js"></script>
 *    (Of gebruik de modulaire v9+ SDK via een build-stap.)
 *
 * 3. Vervang de functie `callGeminiAPI` hieronder door de echte aanroep:
 *
 *    // Voorbeeld met de Firebase AI Logic client-side SDK (v9+):
 *    import { getAI, getGenerativeModel } from "firebase/ai";
 *    const ai    = getAI(firebaseApp);
 *    const model = getGenerativeModel(ai, { model: "gemini-2.0-flash" });
 *    const result = await model.generateContent(prompt);
 *    return result.response.text();
 *
 *    // Voorbeeld via een Cloud Function:
 *    const callGemini = firebase.functions().httpsCallable('callGemini');
 *    const result = await callGemini({ prompt });
 *    return result.data.text;
 * =====================================================================
 */

/* ===== GEMINI API AANROEP ===== */

/**
 * Stuur een prompt naar Google Gemini en geef de tekst-response terug.
 *
 * @param {string} prompt    - De volledige prompt voor Gemini.
 * @param {'schrijf'|'verbeter'|'brainstorm'} purpose - Het doel van de aanroep.
 * @returns {Promise<string>} - De gegenereerde tekst.
 */
async function callGeminiAPI(prompt, purpose) {
  // ================================================================
  // VERVANG ONDERSTAANDE SIMULATIE MET DE ECHTE FIREBASE AI LOGIC AANROEP.
  // Zie het commentaar bovenaan dit bestand voor instructies.
  // ================================================================

  // Tijdelijke simulatie: wacht 1.5 seconden en geef een placeholder terug.
  // Verwijder dit blok zodra de echte SDK is gekoppeld.
  await new Promise(resolve => setTimeout(resolve, 1500));

  const placeholders = {
    schrijf:    '✏️ [Hier verschijnt de gegenereerde blogpost zodra Gemini is gekoppeld.]\n\nVoeg de Firebase AI Logic SDK toe aan je project en vervang de simulatie in js/nico-ai.js door de echte API-aanroep.',
    verbeter:   '🔍 [Hier verschijnt de verbeterde tekst zodra Gemini is gekoppeld.]\n\nVoeg de Firebase AI Logic SDK toe aan je project en vervang de simulatie in js/nico-ai.js door de echte API-aanroep.',
    brainstorm: '💡 [Hier verschijnen de brainstorm-ideeën zodra Gemini is gekoppeld.]\n\nVoeg de Firebase AI Logic SDK toe aan je project en vervang de simulatie in js/nico-ai.js door de echte API-aanroep.',
  };

  return placeholders[purpose] || '[Geen response ontvangen.]';
}

/* ===== PROMPT CONSTRUCTIE ===== */

/**
 * Bouw de juiste prompt op basis van het doel en de gebruikersinput.
 *
 * @param {string} inputTekst
 * @param {'schrijf'|'verbeter'|'brainstorm'} purpose
 * @returns {string}
 */
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

/* ===== HULPFUNCTIE: OUTPUT WEERGEVEN ===== */

/**
 * Verwerk de AI-response en toon het resultaat in het outputveld.
 * Zet regeleinden om naar <br>-tags voor leesbaarheid.
 *
 * @param {string}      rawText       - De ruwe tekst van Gemini.
 * @param {HTMLElement} outputEl      - Het element voor de output.
 * @param {HTMLElement} wrapperEl     - De wrapper die zichtbaar gemaakt wordt.
 */
function showAiOutput(rawText, outputEl, wrapperEl) {
  // Escape HTML, zet newlines om naar <br> voor opmaak
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

/**
 * Verwerk een klik op een AI-knop: valideer input, roep Gemini aan,
 * toon output en handel fouten af.
 *
 * @param {'schrijf'|'verbeter'|'brainstorm'} purpose
 * @param {string} inputId   - ID van het invoer-textarea
 * @param {string} outputId  - ID van het output-div
 * @param {string} wrapperId - ID van de output-wrapper
 * @param {HTMLButtonElement} btn
 */
async function handleAiAction(purpose, inputId, outputId, wrapperId, btn) {
  const inputEl   = document.getElementById(inputId);
  const outputEl  = document.getElementById(outputId);
  const wrapperEl = document.getElementById(wrapperId);

  if (!inputEl || !outputEl || !wrapperEl) return;

  const inputTekst = inputEl.value.trim();
  if (!inputTekst) {
    showDashNotification('Vul eerst een tekst of onderwerp in.', 'warning');
    inputEl.focus();
    return;
  }

  // Laadstatus
  btn.disabled    = true;
  btn.dataset.origText = btn.textContent;
  btn.textContent = '⏳ Nico AI is bezig...';
  outputEl.textContent = '';
  wrapperEl.style.display = 'none';

  try {
    const prompt   = buildPrompt(inputTekst, purpose);
    const response = await callGeminiAPI(prompt, purpose);
    showAiOutput(response, outputEl, wrapperEl);
  } catch (err) {
    console.error('Nico AI fout:', err);
    showDashNotification('Er is een fout opgetreden bij Nico AI. Probeer het opnieuw.', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = btn.dataset.origText || btn.textContent;
  }
}

/* ===== EVENT LISTENERS ===== */

document.addEventListener('DOMContentLoaded', () => {

  // Sectie 1 — Tekst schrijven
  const genereerBtn = document.getElementById('genereerTekstBtn');
  if (genereerBtn) {
    genereerBtn.addEventListener('click', () =>
      handleAiAction('schrijf', 'schrijfInput', 'schrijfOutput', 'schrijfOutputWrapper', genereerBtn)
    );
  }

  // Sectie 2 — Tekst verbeteren
  const verbeterBtn = document.getElementById('verbeterTekstBtn');
  if (verbeterBtn) {
    verbeterBtn.addEventListener('click', () =>
      handleAiAction('verbeter', 'verbeterInput', 'verbeterOutput', 'verbeterOutputWrapper', verbeterBtn)
    );
  }

  // Sectie 3 — Brainstormen
  const brainstormBtn = document.getElementById('brainstormBtn');
  if (brainstormBtn) {
    brainstormBtn.addEventListener('click', () =>
      handleAiAction('brainstorm', 'brainstormInput', 'brainstormOutput', 'brainstormOutputWrapper', brainstormBtn)
    );
  }

  // Kopieer-knoppen: kopieer de tekst van het bijbehorende outputveld
  document.querySelectorAll('.ai-copy-btn').forEach(copyBtn => {
    copyBtn.addEventListener('click', () => {
      const targetId = copyBtn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      // Haal tekst op (innerText converteert <br> terug naar newlines)
      const text = targetEl.innerText || targetEl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        showDashNotification('Tekst gekopieerd naar klembord!', 'success');
      }).catch(() => {
        showDashNotification('Kopiëren mislukt. Selecteer de tekst handmatig.', 'error');
      });
    });
  });

});
