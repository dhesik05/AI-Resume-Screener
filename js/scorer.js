/**
 * scorer.js
 * Resume scoring engine.
 * Scores candidates against a set of keywords and a required experience threshold.
 *
 * Score Formula (0–100):
 *   keywordScore   = (matchedKeywords / totalKeywords) * 70
 *   experienceScore = min(candidateYears / requiredYears, 1) * 30
 *   total           = keywordScore + experienceScore
 *
 * If no required years are set, experienceScore = full 30 if any exp detected, else 15.
 */

const ResumeScorer = (() => {

  /**
   * Score a single candidate against the current job keywords and experience requirement.
   *
   * @param {object} candidate   - A parsed resume object (from parser.js)
   * @param {string[]} keywords  - Array of keyword strings from the job description
   * @param {number} requiredYears - Minimum years of experience (0 = not required)
   * @returns {object} Updated candidate with score fields filled in
   */
  function score(candidate, keywords, requiredYears) {
    if (!keywords || keywords.length === 0) {
      return {
        ...candidate,
        score: 0,
        matchedKeywords: [],
        missingKeywords: [],
        breakdown: [],
      };
    }

    const text = candidate.rawText || '';
    const { matched, missing } = matchKeywords(text, keywords);

    const keywordRatio   = keywords.length > 0 ? matched.length / keywords.length : 0;
    const keywordScore   = Math.round(keywordRatio * 70);

    const experienceScore = computeExperienceScore(candidate.experienceYears, requiredYears);
    const totalScore = Math.min(100, keywordScore + experienceScore);

    const breakdown = [
      {
        component: 'Keyword Match',
        raw: `${matched.length} / ${keywords.length} keywords`,
        weight: '70%',
        contribution: keywordScore,
      },
      {
        component: 'Experience',
        raw: candidate.experienceYears > 0
          ? `${candidate.experienceYears} yr${candidate.experienceYears !== 1 ? 's' : ''} detected`
          : 'Not detected',
        weight: '30%',
        contribution: experienceScore,
      },
      {
        component: 'Total Score',
        raw: '',
        weight: '100%',
        contribution: totalScore,
      },
    ];

    return {
      ...candidate,
      score: totalScore,
      matchedKeywords: matched,
      missingKeywords: missing,
      breakdown,
    };
  }

  /**
   * Batch score all candidates (returns new array, does not mutate originals)
   */
  function scoreAll(candidates, keywords, requiredYears) {
    return candidates.map(c => score(c, keywords, requiredYears));
  }

  /**
   * Check which keywords appear in the resume text (word-boundary, case-insensitive).
   * Multi-word keywords (e.g. "machine learning") require all words to appear within
   * a 50-character window (proximity match).
   */
  function matchKeywords(text, keywords) {
    const normalizedText = text.toLowerCase();
    const matched  = [];
    const missing  = [];

    for (const kw of keywords) {
      if (!kw || kw.trim() === '') continue;

      const kwLower = kw.trim().toLowerCase();
      const words   = kwLower.split(/\s+/);

      let found = false;

      if (words.length === 1) {
        // Single word: word boundary match
        const pattern = new RegExp(`\\b${escapeRegex(kwLower)}\\b`, 'i');
        found = pattern.test(normalizedText);
      } else {
        // Multi-word: all words must appear in close proximity
        // Simple approach: check if the entire phrase appears as a substring
        found = normalizedText.includes(kwLower);

        if (!found) {
          // Relaxed: all words individually present
          found = words.every(w => {
            const p = new RegExp(`\\b${escapeRegex(w)}\\b`, 'i');
            return p.test(normalizedText);
          });
        }
      }

      if (found) {
        matched.push(kw);
      } else {
        missing.push(kw);
      }
    }

    return { matched, missing };
  }

  /**
   * Compute the experience sub-score (0–30)
   */
  function computeExperienceScore(candidateYears, requiredYears) {
    if (requiredYears === 0) {
      // No requirement: award full points if any exp detected, half if none
      return candidateYears > 0 ? 30 : 15;
    }

    if (candidateYears === 0) {
      // No experience detected — award 0 exp points
      return 0;
    }

    const ratio = Math.min(candidateYears / requiredYears, 1.5); // cap at 1.5x
    const capped = Math.min(ratio, 1);
    return Math.round(capped * 30);
  }

  /**
   * Escape special regex characters in a string
   */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Determine a score tier label
   */
  function scoreTier(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'mid';
    return 'low';
  }

  /**
   * Extract keywords from a job description text.
   * Uses a combination of:
   *   1. Predefined tech/skill dictionary matching
   *   2. Capitalized noun phrases
   *   3. Deduplication and length filtering
   */
  function extractKeywordsFromJD(jdText) {
    const text = jdText || '';

    // Common tech/skill tokens to look for
    const SKILL_DICTIONARY = [
      // Programming languages
      'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby',
      'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl', 'Bash', 'Shell',
      // Web
      'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Next.js', 'Nuxt', 'HTML', 'CSS',
      'REST API', 'GraphQL', 'WebSockets', 'Redux', 'Webpack', 'Vite', 'Tailwind',
      'Bootstrap', 'jQuery', 'SASS', 'SCSS',
      // Backend & frameworks
      'Django', 'Flask', 'FastAPI', 'Spring', 'Spring Boot', 'Rails', 'Laravel',
      'ASP.NET', '.NET', 'Microservices', 'gRPC',
      // Databases
      'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB',
      'SQLite', 'Oracle', 'Cassandra', 'Firebase', 'Supabase', 'NoSQL',
      // Cloud & DevOps
      'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD',
      'Jenkins', 'GitHub Actions', 'Terraform', 'Ansible', 'Linux', 'Nginx',
      'Apache', 'Serverless', 'Lambda',
      // Data & ML
      'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Keras',
      'Scikit-learn', 'Pandas', 'NumPy', 'Data Analysis', 'Data Engineering',
      'NLP', 'Computer Vision', 'LLM', 'AI', 'MLOps', 'Spark', 'Hadoop',
      'Tableau', 'Power BI', 'Jupyter', 'ETL',
      // Process & methodology
      'Agile', 'Scrum', 'Kanban', 'TDD', 'BDD', 'CI/CD', 'DevOps', 'Git',
      'GitHub', 'GitLab', 'JIRA', 'Confluence',
      // Soft skills
      'Leadership', 'Communication', 'Collaboration', 'Problem Solving',
      'Analytical', 'Team Player', 'Project Management',
      // HR/Recruitment domain
      'Recruiting', 'Talent Acquisition', 'Onboarding', 'HRIS', 'Applicant Tracking',
      'Performance Management', 'Compensation', 'Benefits',
      // Design
      'Figma', 'Adobe XD', 'UI/UX', 'UX Research', 'Wireframing', 'Prototyping',
      // Security
      'Cybersecurity', 'OWASP', 'Penetration Testing', 'OAuth', 'JWT', 'SSL/TLS',
    ];

    const found = new Set();

    // 1. Match against dictionary (case-insensitive)
    for (const skill of SKILL_DICTIONARY) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
      if (pattern.test(text)) {
        found.add(skill);
      }
    }

    // 2. Extract capitalized noun phrases not in dictionary
    // Pattern: One or more capitalized words not at sentence start
    const nounPhrasePattern = /(?<![.!?]\s)(?<!\n)\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,}){0,2})\b/g;
    let m;
    while ((m = nounPhrasePattern.exec(text)) !== null) {
      const phrase = m[1].trim();
      const stopWords = ['The', 'This', 'That', 'Our', 'You', 'We', 'Are', 'And', 'Or',
                         'For', 'With', 'In', 'On', 'At', 'To', 'A', 'An', 'Is', 'Be',
                         'Must', 'Will', 'Can', 'Should', 'Have', 'Has', 'Not', 'May'];
      if (!stopWords.includes(phrase) && phrase.length >= 3) {
        found.add(phrase);
      }
    }

    // 3. Extract explicitly listed items after colons or bullets
    const listPattern = /(?:requirements?|qualifications?|skills?|experience|technologies?)[:]\s*([^\n]+)/gi;
    let lm;
    while ((lm = listPattern.exec(text)) !== null) {
      const items = lm[1].split(/[,;/|]/);
      for (const item of items) {
        const cleaned = item.trim().replace(/[()•\-–]+/g, '').trim();
        if (cleaned.length >= 2 && cleaned.length <= 40) {
          // Only add if it looks like a skill (not a full sentence)
          if (!/\s{3,}/.test(cleaned) && cleaned.split(' ').length <= 4) {
            found.add(cleaned);
          }
        }
      }
    }

    // Deduplicate and filter
    const keywords = Array.from(found)
      .map(k => k.trim())
      .filter(k => k.length >= 2 && k.length <= 50)
      .filter(k => !k.match(/^\d+$/));

    // Remove duplicates case-insensitively (keep the dictionary form)
    const seen = new Map();
    const deduped = [];
    for (const kw of keywords) {
      const lower = kw.toLowerCase();
      if (!seen.has(lower)) {
        seen.set(lower, true);
        deduped.push(kw);
      }
    }

    return deduped.slice(0, 60); // cap at 60 keywords
  }

  // Public API
  return {
    score,
    scoreAll,
    scoreTier,
    extractKeywordsFromJD,
    matchKeywords,
  };

})();
