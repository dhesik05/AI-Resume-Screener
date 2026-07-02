/**
 * filters.js
 * Search, filter, and sort logic for the candidates list.
 */

const CandidateFilters = (() => {

  /**
   * Apply all active filters and sorting to a candidates array.
   *
   * @param {object[]} candidates  - Full candidates array from app state
   * @param {object}   options     - Filter options
   *   @param {string}  options.search    - Search text (name or skill)
   *   @param {string}  options.status    - 'all' | 'shortlisted' | 'pending' | 'rejected'
   *   @param {number}  options.minScore  - Minimum match score (0–100)
   *   @param {string}  options.sortBy    - 'score-desc' | 'score-asc' | 'name-asc' | 'name-desc'
   *
   * @returns {object[]} Filtered and sorted array (new array, originals untouched)
   */
  function applyFilters(candidates, options) {
    const {
      search   = '',
      status   = 'all',
      minScore = 0,
      sortBy   = 'score-desc',
    } = options || {};

    let result = [...candidates];

    // ─── Filter: Status ────────────────────────────────────
    if (status !== 'all') {
      result = result.filter(c => c.status === status);
    }

    // ─── Filter: Min Score ─────────────────────────────────
    if (minScore > 0) {
      result = result.filter(c => c.score >= minScore);
    }

    // ─── Filter: Search ────────────────────────────────────
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      result = result.filter(c => {
        const nameMatch  = c.name.toLowerCase().includes(q);
        const emailMatch = (c.email || '').toLowerCase().includes(q);
        const skillMatch = (c.matchedKeywords || []).some(k => k.toLowerCase().includes(q));
        const textMatch  = (c.rawText || '').toLowerCase().includes(q);
        return nameMatch || emailMatch || skillMatch || textMatch;
      });
    }

    // ─── Sort ──────────────────────────────────────────────
    result = sortCandidates(result, sortBy);

    return result;
  }

  /**
   * Sort candidates by the given strategy
   */
  function sortCandidates(candidates, sortBy) {
    return [...candidates].sort((a, b) => {
      switch (sortBy) {
        case 'score-desc':
          return b.score - a.score;
        case 'score-asc':
          return a.score - b.score;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return b.score - a.score;
      }
    });
  }

  /**
   * Get summary statistics for a list of candidates
   */
  function getStats(candidates) {
    const total       = candidates.length;
    const shortlisted = candidates.filter(c => c.status === 'shortlisted').length;
    const pending     = candidates.filter(c => c.status === 'pending').length;
    const rejected    = candidates.filter(c => c.status === 'rejected').length;

    const scored  = candidates.filter(c => c.score > 0);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length)
      : 0;

    const high = candidates.filter(c => c.score >= 70).length;
    const mid  = candidates.filter(c => c.score >= 40 && c.score < 70).length;
    const low  = candidates.filter(c => c.score < 40).length;

    return { total, shortlisted, pending, rejected, avgScore, high, mid, low };
  }

  /**
   * Create a debounced version of a function
   */
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Public API
  return {
    applyFilters,
    sortCandidates,
    getStats,
    debounce,
  };

})();
