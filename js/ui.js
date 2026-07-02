/**
 * ui.js
 * All DOM rendering logic: candidate cards, modals, dashboard, keyword chips,
 * score rings, charts, and toast notifications.
 */

const UI = (() => {

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Switch to a named section ('dashboard' | 'job' | 'upload' | 'candidates')
   */
  function showSection(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const section = document.getElementById(`section-${name}`);
    const navItem = document.getElementById(`nav-${name}`);
    const titles  = { dashboard: 'Dashboard', job: 'Job Description', upload: 'Upload Resumes', candidates: 'Candidates' };

    if (section) section.classList.add('active');
    if (navItem) navItem.classList.add('active');

    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = titles[name] || name;
  }

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════

  /**
   * Refresh all dashboard widgets
   */
  function renderDashboard(candidates, keywords) {
    const stats = CandidateFilters.getStats(candidates);

    // Stat counters
    animateCounter('stat-total',       stats.total);
    animateCounter('stat-shortlisted', stats.shortlisted);
    animateCounter('stat-pending',     stats.pending);
    animateCounter('stat-rejected',    stats.rejected);

    setText('topbar-total', stats.total);
    setText('nav-candidates-count', stats.total);

    // Percentages
    const pct = (n) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0;

    setText('stat-shortlisted-pct', stats.total > 0 ? `${pct(stats.shortlisted)}% of total` : '');
    setText('stat-rejected-pct',    stats.total > 0 ? `${pct(stats.rejected)}% of total` : '');

    // Progress bars
    setProgress('prog-shortlisted', pct(stats.shortlisted));
    setProgress('prog-pending',     pct(stats.pending));
    setProgress('prog-rejected',    pct(stats.rejected));

    // Average score
    setText('avg-score', stats.avgScore > 0 ? `${stats.avgScore}%` : '—');

    // Score chart
    renderScoreChart(stats);

    // Top candidates (top 5 by score)
    const topCandidates = [...candidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    renderTopCandidates(topCandidates);

    // Active keywords
    renderDashboardKeywords(keywords);
  }

  function setProgress(id, pct) {
    const barEl = document.getElementById(`${id}-bar`);
    const pctEl = document.getElementById(`${id}-pct`);
    if (barEl) setTimeout(() => { barEl.style.width = `${pct}%`; }, 50);
    if (pctEl) pctEl.textContent = `${pct}%`;
  }

  function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent, 10) || 0;
    if (start === target) return;
    const duration = 500;
    const startTime = performance.now();
    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  function renderScoreChart(stats) {
    const container = document.getElementById('score-chart');
    if (!container) return;

    if (stats.total === 0) {
      container.innerHTML = `
        <div class="chart-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
          <p>Upload resumes to see score distribution</p>
        </div>`;
      return;
    }

    const maxCount = Math.max(stats.high, stats.mid, stats.low, 1);
    const maxHeight = 100; // px

    const bars = [
      { label: 'High (≥70)', count: stats.high, color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
      { label: 'Mid (40-69)', count: stats.mid,  color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
      { label: 'Low (<40)',   count: stats.low,  color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
    ];

    container.innerHTML = bars.map(bar => {
      const height = Math.max(Math.round((bar.count / maxCount) * maxHeight), bar.count > 0 ? 8 : 4);
      return `
        <div class="chart-bar-group">
          <div class="chart-bar-count">${bar.count}</div>
          <div class="chart-bar-fill" style="
            height: ${height}px;
            background: linear-gradient(180deg, ${bar.color}, ${bar.bg});
            border: 1px solid ${bar.color}40;
          "></div>
          <div class="chart-bar-label">${bar.label}</div>
        </div>`;
    }).join('');
  }

  function renderTopCandidates(candidates) {
    const container = document.getElementById('top-candidates-list');
    if (!container) return;

    if (candidates.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p>No candidates yet</p>
        </div>`;
      return;
    }

    container.innerHTML = candidates.map((c, i) => {
      const tierClass = c.score >= 70 ? '' : c.score >= 40 ? 'mid' : 'low';
      return `
        <div class="top-cand-row" data-id="${c.id}" onclick="AppEvents.openModal('${c.id}')">
          <div class="top-cand-rank">${i + 1}</div>
          <div class="top-cand-name">${escapeHtml(c.name)}</div>
          <div class="top-cand-score ${tierClass}">${c.score}%</div>
        </div>`;
    }).join('');
  }

  function renderDashboardKeywords(keywords) {
    const container = document.getElementById('dash-keywords');
    if (!container) return;

    if (!keywords || keywords.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
          <p>Set a job description first</p>
        </div>`;
      return;
    }

    container.innerHTML = keywords
      .slice(0, 24)
      .map(k => `<span class="kw-chip-dash">${escapeHtml(k)}</span>`)
      .join('');
    if (keywords.length > 24) {
      container.innerHTML += `<span class="kw-chip-dash">+${keywords.length - 24} more</span>`;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // KEYWORD CHIPS (JD section)
  // ═══════════════════════════════════════════════════════════

  function renderKeywordChips(keywords, onRemove) {
    const container = document.getElementById('keywords-chips');
    const countEl   = document.getElementById('keyword-count');
    if (!container) return;

    if (countEl) countEl.textContent = `${keywords.length} keyword${keywords.length !== 1 ? 's' : ''}`;

    if (keywords.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
          <p>Extract keywords from your job description</p>
        </div>`;
      return;
    }

    container.innerHTML = keywords.map((kw, i) => `
      <span class="kw-chip" data-index="${i}" title="Click to remove">
        ${escapeHtml(kw)}
        <span class="kw-chip-remove">×</span>
      </span>
    `).join('');

    // Attach remove handlers
    container.querySelectorAll('.kw-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const idx = parseInt(chip.dataset.index, 10);
        if (onRemove) onRemove(idx);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CANDIDATE CARDS
  // ═══════════════════════════════════════════════════════════

  /**
   * Render candidate cards into the grid.
   * @param {object[]} candidates - Filtered array to display
   * @param {object[]} allCandidates - Full array (for empty state messaging)
   */
  function renderCandidateCards(candidates, allCandidates) {
    const grid      = document.getElementById('candidates-grid');
    const emptyEl   = document.getElementById('candidates-empty');
    const resultsEl = document.getElementById('results-count');
    if (!grid) return;

    if (resultsEl) {
      resultsEl.textContent = `${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}`;
    }

    // Remove existing cards (preserve empty state element)
    grid.querySelectorAll('.candidate-card').forEach(el => el.remove());

    if (candidates.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    candidates.forEach((c, i) => {
      const card = buildCandidateCard(c);
      card.style.animationDelay = `${i * 40}ms`;
      grid.appendChild(card);
    });
  }

  function buildCandidateCard(candidate) {
    const tier = ResumeScorer.scoreTier(candidate.score);
    const card = document.createElement('div');
    card.className = `candidate-card ${tier}`;
    card.dataset.id = candidate.id;

    const initials = getInitials(candidate.name);
    const avatarColor = getAvatarColor(candidate.name);
    const badgeHTML = buildStatusBadge(candidate.status);
    const skillsHTML = buildSkillChips(candidate.matchedKeywords || [], 4);
    const expText = candidate.experienceYears > 0
      ? `${candidate.experienceYears} yr${candidate.experienceYears !== 1 ? 's' : ''} exp.`
      : 'Exp. unknown';

    // Score ring math: circumference of r=20 circle = 2π*20 ≈ 125.66
    const circumference = 2 * Math.PI * 20;
    const offset = circumference * (1 - candidate.score / 100);

    card.innerHTML = `
      <div class="card-top-row">
        <div class="cand-avatar" style="background: ${avatarColor};">${initials}</div>
        <div class="cand-info">
          <div class="cand-name">${escapeHtml(candidate.name)}</div>
          <div class="cand-exp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
            ${expText}
          </div>
        </div>
        <div class="score-ring-wrap">
          <svg class="score-ring-svg" viewBox="0 0 52 52">
            <circle class="ring-bg" cx="26" cy="26" r="20"/>
            <circle class="ring-fill"
              cx="26" cy="26" r="20"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference}"
              data-offset="${offset}"
            />
          </svg>
          <div class="score-ring-inner">
            <span class="score-num">${candidate.score}</span>
            <span class="score-pct">%</span>
          </div>
        </div>
      </div>

      <div>${badgeHTML}</div>

      <div class="card-skills">${skillsHTML}</div>

      <div class="card-actions">
        <button class="card-action-btn btn-view-detail" data-id="${candidate.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          View
        </button>
        <button class="card-action-btn btn-shortlist-card ${candidate.status === 'shortlisted' ? 'active-btn' : ''}" data-id="${candidate.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          ${candidate.status === 'shortlisted' ? 'Listed' : 'Shortlist'}
        </button>
        <button class="card-action-btn btn-reject-card ${candidate.status === 'rejected' ? 'active-btn' : ''}" data-id="${candidate.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ${candidate.status === 'rejected' ? 'Rejected' : 'Reject'}
        </button>
      </div>
    `;

    // Animate the score ring after insertion
    requestAnimationFrame(() => {
      const ringFill = card.querySelector('.ring-fill');
      if (ringFill) {
        setTimeout(() => {
          ringFill.style.strokeDashoffset = offset;
        }, 100);
      }
    });

    return card;
  }

  function buildStatusBadge(status) {
    const configs = {
      shortlisted: { cls: 'badge-shortlisted', icon: '✅', label: 'Shortlisted' },
      pending:     { cls: 'badge-pending',     icon: '⏳', label: 'Pending' },
      rejected:    { cls: 'badge-rejected',    icon: '❌', label: 'Rejected' },
    };
    const cfg = configs[status] || configs['pending'];
    return `<span class="status-badge ${cfg.cls}">${cfg.icon} ${cfg.label}</span>`;
  }

  function buildSkillChips(keywords, maxVisible) {
    if (!keywords || keywords.length === 0) {
      return '<span class="skill-chip-more">No matches yet</span>';
    }
    const visible = keywords.slice(0, maxVisible);
    const rest    = keywords.length - maxVisible;
    let html = visible.map(k => `<span class="skill-chip">${escapeHtml(k)}</span>`).join('');
    if (rest > 0) html += `<span class="skill-chip-more">+${rest} more</span>`;
    return html;
  }

  // ═══════════════════════════════════════════════════════════
  // UPLOAD QUEUE
  // ═══════════════════════════════════════════════════════════

  function addQueueItem(fileId, filename, filesize) {
    const queueList = document.getElementById('queue-list');
    const emptyEl   = document.getElementById('queue-empty');
    const summaryEl = document.getElementById('queue-summary');
    const clearBtn  = document.getElementById('btn-clear-queue');
    if (!queueList) return;

    if (emptyEl) emptyEl.style.display = 'none';
    if (summaryEl) summaryEl.style.display = 'flex';
    if (clearBtn) clearBtn.style.display = 'inline-block';

    const ext  = filename.split('.').pop().toUpperCase();
    const size  = formatFileSize(filesize);

    const item = document.createElement('div');
    item.className = 'queue-item';
    item.id = `queue-item-${fileId}`;
    item.innerHTML = `
      <div class="queue-item-icon">${ext}</div>
      <div class="queue-item-info">
        <div class="queue-item-name">${escapeHtml(filename)}</div>
        <div class="queue-item-size">${size}</div>
        <div class="queue-item-progress">
          <div class="queue-item-bar" id="qbar-${fileId}" style="width:0%"></div>
        </div>
      </div>
      <span class="queue-item-status status-processing" id="qstatus-${fileId}">Processing…</span>
    `;
    queueList.appendChild(item);
  }

  function updateQueueItemProgress(fileId, pct) {
    const bar = document.getElementById(`qbar-${fileId}`);
    if (bar) bar.style.width = `${pct}%`;
  }

  function setQueueItemDone(fileId, success, errorMsg) {
    const statusEl = document.getElementById(`qstatus-${fileId}`);
    const barEl    = document.getElementById(`qbar-${fileId}`);
    if (statusEl) {
      statusEl.textContent = success ? '✓ Done' : '✗ Failed';
      statusEl.className = `queue-item-status ${success ? 'status-done' : 'status-error'}`;
    }
    if (barEl) {
      barEl.style.width = '100%';
      barEl.style.background = success
        ? 'linear-gradient(90deg, #22C55E, #4ADE80)'
        : 'linear-gradient(90deg, #EF4444, #F87171)';
    }
  }

  function updateQueueSummary(total, done, failed) {
    setText('qs-total',  total);
    setText('qs-done',   done);
    setText('qs-failed', failed);
  }

  function clearDoneQueueItems() {
    document.querySelectorAll('.queue-item').forEach(item => {
      const statusEl = item.querySelector('.queue-item-status');
      if (statusEl && (statusEl.classList.contains('status-done') || statusEl.classList.contains('status-error'))) {
        item.remove();
      }
    });
    const remaining = document.querySelectorAll('.queue-item').length;
    if (remaining === 0) {
      const emptyEl = document.getElementById('queue-empty');
      if (emptyEl) emptyEl.style.display = 'flex';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CANDIDATE MODAL
  // ═══════════════════════════════════════════════════════════

  function openModal(candidate, allKeywords) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    // Header
    const initials     = getInitials(candidate.name);
    const avatarColor  = getAvatarColor(candidate.name);
    setText('modal-name', candidate.name);
    setHTML('modal-avatar', initials);
    document.getElementById('modal-avatar').style.background = avatarColor;
    setText('modal-exp', candidate.experienceYears > 0
      ? `${candidate.experienceYears} year${candidate.experienceYears !== 1 ? 's' : ''}`
      : 'Not detected');
    setText('modal-email', candidate.email || 'Not detected');

    // Score ring
    const circumference = 2 * Math.PI * 34; // r=34 (modal ring)
    const offset = circumference * (1 - candidate.score / 100);
    const ringFill = document.getElementById('modal-ring-fill');
    if (ringFill) {
      const color = candidate.score >= 70
        ? '#22C55E'
        : candidate.score >= 40
        ? '#F59E0B'
        : '#EF4444';
      ringFill.style.stroke = color;
      ringFill.style.strokeDasharray  = circumference;
      ringFill.style.strokeDashoffset = circumference;
      setTimeout(() => { ringFill.style.strokeDashoffset = offset; }, 100);
    }
    setText('modal-score-val', candidate.score);

    // Matched / Missing keywords
    const matchedContainer = document.getElementById('modal-matched-chips');
    const missingContainer = document.getElementById('modal-missing-chips');
    if (matchedContainer) {
      matchedContainer.innerHTML = (candidate.matchedKeywords || []).length > 0
        ? candidate.matchedKeywords.map(k => `<span class="matched-chip">${escapeHtml(k)}</span>`).join('')
        : '<span style="color:var(--text-muted);font-size:0.8rem;">No matched keywords</span>';
    }
    if (missingContainer) {
      missingContainer.innerHTML = (candidate.missingKeywords || []).length > 0
        ? candidate.missingKeywords.map(k => `<span class="missing-chip">${escapeHtml(k)}</span>`).join('')
        : '<span style="color:var(--text-muted);font-size:0.8rem;">All keywords matched!</span>';
    }

    // Score breakdown table
    const tbody = document.getElementById('breakdown-tbody');
    if (tbody && candidate.breakdown) {
      tbody.innerHTML = candidate.breakdown.map((row, i) => `
        <tr ${i === candidate.breakdown.length - 1 ? 'style="font-weight:700"' : ''}>
          <td>${escapeHtml(row.component)}</td>
          <td class="score-cell">${row.contribution}</td>
          <td>${escapeHtml(row.weight)}</td>
          <td><strong>${row.contribution}</strong> pts</td>
        </tr>
      `).join('');
    }

    // Status select
    const statusSelect = document.getElementById('modal-status-select');
    if (statusSelect) statusSelect.value = candidate.status || 'pending';

    // Resume text with keyword highlighting
    const textBox = document.getElementById('modal-resume-text');
    if (textBox) {
      let displayText = escapeHtml(candidate.rawText || '');
      // Highlight matched keywords
      (candidate.matchedKeywords || []).forEach(kw => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b(${escaped})\\b`, 'gi');
        displayText = displayText.replace(pattern, '<mark>$1</mark>');
      });
      textBox.innerHTML = displayText;
    }

    // Notes
    const notesArea = document.getElementById('modal-notes');
    if (notesArea) notesArea.value = candidate.notes || '';

    // Reset to overview tab
    switchModalTab('overview');

    // Hide saved message
    const savedMsg = document.getElementById('notes-saved-msg');
    if (savedMsg) savedMsg.classList.remove('show');

    // Store current candidate ID
    overlay.dataset.candidateId = candidate.id;

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function switchModalTab(tabName) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));

    const tab = document.querySelector(`.modal-tab[data-tab="${tabName}"]`);
    const content = document.getElementById(`mtab-content-${tabName}`);
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
  }

  // ═══════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════

  let toastTimer = null;

  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function getAvatarColor(name) {
    const colors = [
      'linear-gradient(135deg, #6C63FF, #A78BFA)',
      'linear-gradient(135deg, #22C55E, #4ADE80)',
      'linear-gradient(135deg, #EF4444, #F87171)',
      'linear-gradient(135deg, #F59E0B, #FCD34D)',
      'linear-gradient(135deg, #3B82F6, #60A5FA)',
      'linear-gradient(135deg, #8B5CF6, #C4B5FD)',
      'linear-gradient(135deg, #EC4899, #F9A8D4)',
      'linear-gradient(135deg, #14B8A6, #5EEAD4)',
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Public API
  return {
    showSection,
    renderDashboard,
    renderKeywordChips,
    renderCandidateCards,
    addQueueItem,
    updateQueueItemProgress,
    setQueueItemDone,
    updateQueueSummary,
    clearDoneQueueItems,
    openModal,
    closeModal,
    switchModalTab,
    showToast,
    escapeHtml,
    buildStatusBadge,
  };

})();
