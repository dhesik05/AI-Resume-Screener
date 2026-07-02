/**
 * app.js
 * Entry point for ResumeIQ.
 * Manages application state, localStorage persistence, and event wiring.
 * Depends on: parser.js, scorer.js, filters.js, ui.js
 */

// ═══════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════

const AppState = {
  candidates:    [],   // Array of parsed + scored candidate objects
  jobKeywords:   [],   // Array of keyword strings extracted from JD
  requiredYears: 0,    // Minimum experience years from slider
  jdText:        '',   // Raw job description text

  // Active filter state
  filters: {
    search:   '',
    status:   'all',
    minScore: 0,
    sortBy:   'score-desc',
  },

  // Upload tracking
  queue: {
    total:  0,
    done:   0,
    failed: 0,
  },
};

// ═══════════════════════════════════════════════════════════
// PERSISTENCE (localStorage)
// ═══════════════════════════════════════════════════════════

const STORAGE_KEY = 'resumeiq_v1';

function saveState() {
  try {
    const toSave = {
      candidates:    AppState.candidates,
      jobKeywords:   AppState.jobKeywords,
      requiredYears: AppState.requiredYears,
      jdText:        AppState.jdText,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('ResumeIQ: Could not save to localStorage.', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.candidates)    AppState.candidates    = saved.candidates;
    if (saved.jobKeywords)   AppState.jobKeywords   = saved.jobKeywords;
    if (saved.requiredYears) AppState.requiredYears = saved.requiredYears;
    if (saved.jdText)        AppState.jdText        = saved.jdText;
  } catch (e) {
    console.warn('ResumeIQ: Could not load from localStorage.', e);
  }
}

// ═══════════════════════════════════════════════════════════
// CORE ACTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Update a candidate's status and persist
 */
function setStatus(candidateId, newStatus) {
  const idx = AppState.candidates.findIndex(c => c.id === candidateId);
  if (idx === -1) return;
  AppState.candidates[idx].status = newStatus;
  saveState();
  refreshCandidates();
  UI.renderDashboard(AppState.candidates, AppState.jobKeywords);
}

/**
 * Save notes for a candidate
 */
function saveNotes(candidateId, notes) {
  const idx = AppState.candidates.findIndex(c => c.id === candidateId);
  if (idx === -1) return;
  AppState.candidates[idx].notes = notes;
  saveState();
}

/**
 * Re-score all candidates with current keywords and experience setting
 */
function rescoreAll() {
  AppState.candidates = ResumeScorer.scoreAll(
    AppState.candidates,
    AppState.jobKeywords,
    AppState.requiredYears
  );
  saveState();
  refreshCandidates();
  UI.renderDashboard(AppState.candidates, AppState.jobKeywords);
}

/**
 * Refresh the candidates grid with current filter state
 */
function refreshCandidates() {
  const filtered = CandidateFilters.applyFilters(AppState.candidates, AppState.filters);
  UI.renderCandidateCards(filtered, AppState.candidates);
}

/**
 * Remove all candidates and clear state
 */
function clearAllData() {
  if (!confirm('Are you sure you want to delete all candidate data? This cannot be undone.')) return;
  AppState.candidates    = [];
  AppState.jobKeywords   = [];
  AppState.requiredYears = 0;
  AppState.jdText        = '';
  AppState.queue         = { total: 0, done: 0, failed: 0 };
  localStorage.removeItem(STORAGE_KEY);
  refreshCandidates();
  UI.renderDashboard([], []);
  UI.renderKeywordChips([], () => {});
  const jdTextarea = document.getElementById('jd-textarea');
  if (jdTextarea) jdTextarea.value = '';
  const expSlider = document.getElementById('exp-slider');
  const expSliderVal = document.getElementById('exp-slider-val');
  if (expSlider) expSlider.value = 0;
  if (expSliderVal) expSliderVal.textContent = 'Any';
  UI.showToast('All data cleared.', 'info');
}

// ═══════════════════════════════════════════════════════════
// FILE UPLOAD & PROCESSING
// ═══════════════════════════════════════════════════════════

async function processFiles(files) {
  if (!files || files.length === 0) return;

  const warningEl  = document.getElementById('upload-warning');
  const warningMsg = document.getElementById('upload-warning-msg');

  // Warn if no keywords set
  if (AppState.jobKeywords.length === 0) {
    if (warningEl) warningEl.style.display = 'flex';
    if (warningMsg) warningMsg.textContent =
      'No keywords set — candidates will be uploaded but scoring requires a job description.';
  } else {
    if (warningEl) warningEl.style.display = 'none';
  }

  // Switch to upload section to show progress
  UI.showSection('upload');

  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt'].includes(ext)) {
      UI.showToast(`Skipped "${file.name}" — unsupported format.`, 'error');
      continue;
    }

    // Check for duplicate
    const isDuplicate = AppState.candidates.some(
      c => c.filename === file.name && c.rawText.length > 0
    );
    if (isDuplicate) {
      UI.showToast(`"${file.name}" already uploaded — skipping.`, 'info');
      continue;
    }

    const fileId = `f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    AppState.queue.total++;

    // Add to queue UI
    UI.addQueueItem(fileId, file.name, file.size);
    UI.updateQueueItemProgress(fileId, 30);

    try {
      // Parse
      const parsed = await ResumeParser.parseFile(file);
      UI.updateQueueItemProgress(fileId, 70);

      // Score
      const scored = ResumeScorer.score(parsed, AppState.jobKeywords, AppState.requiredYears);
      UI.updateQueueItemProgress(fileId, 100);

      // Add to state
      AppState.candidates.push(scored);
      AppState.queue.done++;

      UI.setQueueItemDone(fileId, true);
      UI.showToast(`✓ ${scored.name} added (Score: ${scored.score}%)`, 'success');

    } catch (err) {
      AppState.queue.failed++;
      UI.setQueueItemDone(fileId, false, err.message);
      UI.showToast(`✗ Failed: ${err.message}`, 'error');
      console.error('Parse error:', err);
    }

    UI.updateQueueSummary(AppState.queue.total, AppState.queue.done, AppState.queue.failed);
  }

  // Persist and refresh
  saveState();
  refreshCandidates();
  UI.renderDashboard(AppState.candidates, AppState.jobKeywords);
}

// ═══════════════════════════════════════════════════════════
// EVENT HANDLERS (exposed globally for inline calls)
// ═══════════════════════════════════════════════════════════

const AppEvents = {
  openModal(candidateId) {
    const candidate = AppState.candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    UI.openModal(candidate, AppState.jobKeywords);
  }
};

// ═══════════════════════════════════════════════════════════
// SAMPLE JD
// ═══════════════════════════════════════════════════════════

const SAMPLE_JD = `We are looking for a Senior Full-Stack Developer to join our growing engineering team. 

Requirements:
- 5+ years of experience in software development
- Strong proficiency in JavaScript, TypeScript, and React
- Experience with Node.js, Express, and RESTful API design
- Proficiency with SQL and NoSQL databases (PostgreSQL, MongoDB, Redis)
- Experience with AWS or Google Cloud (Lambda, S3, EC2)
- Strong knowledge of Docker and Kubernetes
- Familiarity with CI/CD pipelines (GitHub Actions, Jenkins)
- Experience with Git, Agile, and Scrum methodologies

Nice to have:
- Experience with GraphQL
- Knowledge of TDD and BDD practices
- Familiarity with Python or Go
- Strong communication and collaboration skills

The ideal candidate is a proactive problem solver with excellent analytical skills and a passion for clean, maintainable code.`;

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

function init() {
  // Load persisted state
  loadState();

  // Restore JD textarea
  const jdTextarea = document.getElementById('jd-textarea');
  if (jdTextarea && AppState.jdText) {
    jdTextarea.value = AppState.jdText;
  }

  // Restore experience slider
  const expSlider    = document.getElementById('exp-slider');
  const expSliderVal = document.getElementById('exp-slider-val');
  if (expSlider) {
    expSlider.value = AppState.requiredYears;
    if (expSliderVal) {
      expSliderVal.textContent = AppState.requiredYears === 0
        ? 'Any'
        : `${AppState.requiredYears} yr${AppState.requiredYears !== 1 ? 's' : ''}`;
    }
  }

  // Initial render
  UI.renderDashboard(AppState.candidates, AppState.jobKeywords);
  UI.renderKeywordChips(AppState.jobKeywords, removeKeyword);
  refreshCandidates();
  UI.showSection('dashboard');

  // ── Navigation ──────────────────────────────────────────
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (section) UI.showSection(section);

      // Close sidebar on mobile
      const sidebar = document.getElementById('sidebar');
      if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('open');
      }
    });
  });

  // Sidebar toggle (mobile)
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar       = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Dashboard "View All" button
  const dashViewAll = document.getElementById('dash-view-all');
  if (dashViewAll) {
    dashViewAll.addEventListener('click', () => UI.showSection('candidates'));
  }

  // Dashboard "Edit JD" button
  const dashEditJD = document.getElementById('dash-edit-jd');
  if (dashEditJD) {
    dashEditJD.addEventListener('click', () => UI.showSection('job'));
  }

  // "Go to Upload" from empty candidates state
  const emptyGoUpload = document.getElementById('empty-go-upload');
  if (emptyGoUpload) {
    emptyGoUpload.addEventListener('click', () => UI.showSection('upload'));
  }

  // Clear all data
  const btnClearAll = document.getElementById('btn-clear-all');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', clearAllData);
  }

  // ── Job Description ──────────────────────────────────────

  // Experience slider
  if (expSlider) {
    expSlider.addEventListener('input', () => {
      const val = parseInt(expSlider.value, 10);
      AppState.requiredYears = val;
      if (expSliderVal) {
        expSliderVal.textContent = val === 0 ? 'Any' : `${val} yr${val !== 1 ? 's' : ''}`;
      }
    });
  }

  // Save JD text on change
  if (jdTextarea) {
    jdTextarea.addEventListener('input', () => {
      AppState.jdText = jdTextarea.value;
    });
  }

  // Extract keywords button
  const btnExtract = document.getElementById('btn-extract-keywords');
  if (btnExtract) {
    btnExtract.addEventListener('click', () => {
      const text = jdTextarea ? jdTextarea.value.trim() : '';
      if (!text) {
        UI.showToast('Please paste a job description first.', 'error');
        return;
      }
      const keywords = ResumeScorer.extractKeywordsFromJD(text);
      if (keywords.length === 0) {
        UI.showToast('No keywords found — try a more detailed job description.', 'info');
        return;
      }
      AppState.jobKeywords = keywords;
      AppState.jdText = text;
      UI.renderKeywordChips(AppState.jobKeywords, removeKeyword);

      // Rescore all existing candidates
      if (AppState.candidates.length > 0) {
        rescoreAll();
        UI.showToast(`Extracted ${keywords.length} keywords & re-scored ${AppState.candidates.length} candidates.`, 'success');
      } else {
        UI.showToast(`Extracted ${keywords.length} keywords.`, 'success');
      }
      saveState();
      UI.renderDashboard(AppState.candidates, AppState.jobKeywords);
    });
  }

  // Load sample JD
  const btnLoadSample = document.getElementById('btn-load-sample');
  if (btnLoadSample) {
    btnLoadSample.addEventListener('click', () => {
      if (jdTextarea) {
        jdTextarea.value = SAMPLE_JD;
        AppState.jdText = SAMPLE_JD;
      }
      UI.showToast('Sample job description loaded!', 'info');
    });
  }

  // Add keyword button
  const btnAddKeyword = document.getElementById('btn-add-keyword');
  const addKeywordRow = document.getElementById('add-keyword-row');
  const newKeywordInput = document.getElementById('new-keyword-input');
  const btnConfirmAdd = document.getElementById('btn-confirm-add-keyword');
  const btnCancelAdd  = document.getElementById('btn-cancel-add-keyword');

  if (btnAddKeyword) {
    btnAddKeyword.addEventListener('click', () => {
      if (addKeywordRow) addKeywordRow.style.display = 'flex';
      if (newKeywordInput) newKeywordInput.focus();
    });
  }

  if (btnConfirmAdd) {
    btnConfirmAdd.addEventListener('click', addKeyword);
  }

  if (newKeywordInput) {
    newKeywordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addKeyword();
      if (e.key === 'Escape') cancelAddKeyword();
    });
  }

  if (btnCancelAdd) {
    btnCancelAdd.addEventListener('click', cancelAddKeyword);
  }

  function addKeyword() {
    const kw = newKeywordInput ? newKeywordInput.value.trim() : '';
    if (!kw) return;
    if (!AppState.jobKeywords.includes(kw)) {
      AppState.jobKeywords.push(kw);
      UI.renderKeywordChips(AppState.jobKeywords, removeKeyword);
      if (AppState.candidates.length > 0) rescoreAll();
      saveState();
      UI.renderDashboard(AppState.candidates, AppState.jobKeywords);
    }
    if (newKeywordInput) newKeywordInput.value = '';
    cancelAddKeyword();
    UI.showToast(`Keyword "${kw}" added.`, 'success');
  }

  function cancelAddKeyword() {
    if (addKeywordRow) addKeywordRow.style.display = 'none';
    if (newKeywordInput) newKeywordInput.value = '';
  }

  function removeKeyword(index) {
    const removed = AppState.jobKeywords.splice(index, 1)[0];
    UI.renderKeywordChips(AppState.jobKeywords, removeKeyword);
    if (AppState.candidates.length > 0) rescoreAll();
    saveState();
    UI.renderDashboard(AppState.candidates, AppState.jobKeywords);
    UI.showToast(`Removed keyword "${removed}".`, 'info');
  }

  // ── Upload Section ───────────────────────────────────────

  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const btnBrowse = document.getElementById('btn-browse');
  const btnClearQueue = document.getElementById('btn-clear-queue');

  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', () => fileInput.click());
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', (e) => {
      if (e.target === dropZone || e.target.closest('.drop-zone-inner')) {
        if (e.target.closest('button')) return; // don't double-trigger on button click
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      processFiles(e.target.files);
      e.target.value = ''; // allow re-upload of same file
    });
  }

  // Drag & drop
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragging');
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('dragging');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragging');
      processFiles(e.dataTransfer.files);
    });
  }

  // Global drag prevention
  document.addEventListener('dragover',  (e) => e.preventDefault());
  document.addEventListener('drop',      (e) => e.preventDefault());

  if (btnClearQueue) {
    btnClearQueue.addEventListener('click', () => {
      UI.clearDoneQueueItems();
    });
  }

  // ── Candidates Section ───────────────────────────────────

  // Search
  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    const debouncedSearch = CandidateFilters.debounce(() => {
      AppState.filters.search = searchInput.value;
      refreshCandidates();
    }, 300);
    searchInput.addEventListener('input', debouncedSearch);
  }

  // Status filter
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      AppState.filters.status = statusFilter.value;
      syncQuickBtns(statusFilter.value);
      refreshCandidates();
    });
  }

  // Sort
  const sortFilter = document.getElementById('filter-sort');
  if (sortFilter) {
    sortFilter.addEventListener('change', () => {
      AppState.filters.sortBy = sortFilter.value;
      refreshCandidates();
    });
  }

  // Min Score slider
  const minScoreSlider = document.getElementById('filter-min-score');
  const minScoreVal    = document.getElementById('filter-min-score-val');
  if (minScoreSlider) {
    minScoreSlider.addEventListener('input', () => {
      const val = parseInt(minScoreSlider.value, 10);
      AppState.filters.minScore = val;
      if (minScoreVal) minScoreVal.textContent = `${val}%`;
      refreshCandidates();
    });
  }

  // Quick filter buttons
  document.querySelectorAll('.qbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterVal = btn.dataset.filter;
      AppState.filters.status = filterVal;
      syncQuickBtns(filterVal);
      if (statusFilter) statusFilter.value = filterVal;
      refreshCandidates();
    });
  });

  function syncQuickBtns(activeFilter) {
    document.querySelectorAll('.qbtn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === activeFilter);
    });
  }

  // Card action buttons (delegated to grid)
  const candidatesGrid = document.getElementById('candidates-grid');
  if (candidatesGrid) {
    candidatesGrid.addEventListener('click', (e) => {
      const shortlistBtn = e.target.closest('.btn-shortlist-card');
      const rejectBtn    = e.target.closest('.btn-reject-card');
      const viewBtn      = e.target.closest('.btn-view-detail');
      const card         = e.target.closest('.candidate-card');

      if (shortlistBtn) {
        e.stopPropagation();
        const id = shortlistBtn.dataset.id;
        const candidate = AppState.candidates.find(c => c.id === id);
        const newStatus = candidate && candidate.status === 'shortlisted' ? 'pending' : 'shortlisted';
        setStatus(id, newStatus);
        UI.showToast(newStatus === 'shortlisted' ? '✅ Candidate shortlisted!' : '↩ Moved to pending.', 'success');
        return;
      }

      if (rejectBtn) {
        e.stopPropagation();
        const id = rejectBtn.dataset.id;
        const candidate = AppState.candidates.find(c => c.id === id);
        const newStatus = candidate && candidate.status === 'rejected' ? 'pending' : 'rejected';
        setStatus(id, newStatus);
        UI.showToast(newStatus === 'rejected' ? '❌ Candidate rejected.' : '↩ Moved to pending.', 'info');
        return;
      }

      if (viewBtn) {
        e.stopPropagation();
        AppEvents.openModal(viewBtn.dataset.id);
        return;
      }

      if (card) {
        AppEvents.openModal(card.dataset.id);
      }
    });
  }

  // ── Modal ────────────────────────────────────────────────

  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose   = document.getElementById('modal-close');

  if (modalClose) {
    modalClose.addEventListener('click', UI.closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) UI.closeModal();
    });
  }

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') UI.closeModal();
  });

  // Modal tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      UI.switchModalTab(tab.dataset.tab);
    });
  });

  // Modal shortlist/reject buttons
  const btnModalShortlist = document.getElementById('btn-modal-shortlist');
  const btnModalReject    = document.getElementById('btn-modal-reject');
  const modalStatusSelect = document.getElementById('modal-status-select');

  if (btnModalShortlist) {
    btnModalShortlist.addEventListener('click', () => {
      const id = modalOverlay ? modalOverlay.dataset.candidateId : null;
      if (!id) return;
      setStatus(id, 'shortlisted');
      if (modalStatusSelect) modalStatusSelect.value = 'shortlisted';
      UI.showToast('✅ Candidate shortlisted!', 'success');
    });
  }

  if (btnModalReject) {
    btnModalReject.addEventListener('click', () => {
      const id = modalOverlay ? modalOverlay.dataset.candidateId : null;
      if (!id) return;
      setStatus(id, 'rejected');
      if (modalStatusSelect) modalStatusSelect.value = 'rejected';
      UI.showToast('❌ Candidate rejected.', 'info');
    });
  }

  if (modalStatusSelect) {
    modalStatusSelect.addEventListener('change', () => {
      const id = modalOverlay ? modalOverlay.dataset.candidateId : null;
      if (!id) return;
      setStatus(id, modalStatusSelect.value);
      UI.showToast(`Status updated to ${modalStatusSelect.value}.`, 'success');
    });
  }

  // Save notes
  const btnSaveNotes = document.getElementById('btn-save-notes');
  const notesArea    = document.getElementById('modal-notes');
  const savedMsg     = document.getElementById('notes-saved-msg');

  if (btnSaveNotes) {
    btnSaveNotes.addEventListener('click', () => {
      const id = modalOverlay ? modalOverlay.dataset.candidateId : null;
      if (!id || !notesArea) return;
      saveNotes(id, notesArea.value);
      if (savedMsg) {
        savedMsg.classList.add('show');
        setTimeout(() => savedMsg.classList.remove('show'), 2500);
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
