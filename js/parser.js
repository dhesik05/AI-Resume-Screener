/**
 * parser.js
 * Resume text extraction — supports PDF (via PDF.js) and plain TXT files.
 * Extracts: raw text, candidate name, email, and estimated years of experience.
 */

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const ResumeParser = (() => {

  /**
   * Main entry point. Accepts a File object.
   * Returns a Promise resolving to a parsed resume object.
   */
  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let rawText = '';

    try {
      if (ext === 'pdf') {
        rawText = await extractPDF(file);
      } else if (ext === 'txt') {
        rawText = await extractTXT(file);
      } else {
        throw new Error(`Unsupported file type: .${ext}`);
      }
    } catch (err) {
      throw new Error(`Failed to parse "${file.name}": ${err.message}`);
    }

    if (!rawText || rawText.trim().length < 30) {
      throw new Error(`Could not extract meaningful text from "${file.name}". The PDF may be image-based or password-protected.`);
    }

    return buildResumeObject(file.name, rawText);
  }

  /**
   * Extract all text from a PDF file using PDF.js
   */
  async function extractPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageTexts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ');
      pageTexts.push(pageText);
    }

    return pageTexts.join('\n');
  }

  /**
   * Extract text from a plain TXT file
   */
  async function extractTXT(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Build a structured resume object from raw text
   */
  function buildResumeObject(filename, rawText) {
    const name  = extractName(rawText, filename);
    const email = extractEmail(rawText);
    const phone = extractPhone(rawText);
    const experienceYears = extractExperienceYears(rawText);

    return {
      id: generateId(),
      filename,
      name,
      email,
      phone,
      rawText,
      experienceYears,
      status: 'pending',
      score: 0,
      matchedKeywords: [],
      missingKeywords: [],
      breakdown: [],
      notes: '',
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Heuristically extract a candidate name.
   * Strategy:
   *   1. Look for lines that appear to be a person's name (short, 2-4 words, title-cased)
   *      near the top of the document.
   *   2. Fall back to the email prefix.
   *   3. Fall back to the filename.
   */
  function extractName(text, filename) {
    const lines = text
      .split(/[\n\r]+/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    // Examine the first 10 lines for a likely name
    const nameLine = lines.slice(0, 10).find(line => {
      const words = line.split(/\s+/);
      // Name lines: 2–5 words, mostly letters, title-cased or all-caps
      if (words.length < 2 || words.length > 5) return false;
      const allAlpha = words.every(w => /^[A-Za-z'-]{2,}$/.test(w));
      if (!allAlpha) return false;
      // Avoid lines that are obviously section headers
      const headerWords = ['summary', 'objective', 'experience', 'education', 'skills', 'profile', 'curriculum', 'vitae', 'resume'];
      const lower = line.toLowerCase();
      if (headerWords.some(h => lower.includes(h))) return false;
      return true;
    });

    if (nameLine) return toTitleCase(nameLine);

    // Try email prefix
    const email = extractEmail(text);
    if (email) {
      const prefix = email.split('@')[0];
      const fromEmail = prefix
        .replace(/[._\-0-9]+/g, ' ')
        .trim();
      if (fromEmail.length > 1) return toTitleCase(fromEmail);
    }

    // Fall back to filename without extension
    return toTitleCase(filename.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' '));
  }

  /**
   * Extract email address from text
   */
  function extractEmail(text) {
    const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase() : '';
  }

  /**
   * Extract phone number from text (basic pattern)
   */
  function extractPhone(text) {
    const match = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
    return match ? match[0].trim() : '';
  }

  /**
   * Estimate total years of experience from resume text.
   * Scans for patterns like: "5 years", "5+ years", "3-5 years of experience",
   * "2017 – 2022" date ranges, etc.
   */
  function extractExperienceYears(text) {
    const lower = text.toLowerCase();
    let maxYears = 0;

    // Pattern 1: "X years" or "X+ years"
    const explicitMatches = lower.matchAll(/(\d+)\+?\s+years?\s+(?:of\s+)?(?:experience|work|professional)/g);
    for (const m of explicitMatches) {
      const val = parseInt(m[1], 10);
      if (val > 0 && val <= 50) maxYears = Math.max(maxYears, val);
    }

    if (maxYears > 0) return maxYears;

    // Pattern 2: "X-Y years"
    const rangeMatches = lower.matchAll(/(\d+)\s*[-–]\s*(\d+)\s+years?/g);
    for (const m of rangeMatches) {
      const val = parseInt(m[2], 10);
      if (val > 0 && val <= 50) maxYears = Math.max(maxYears, val);
    }

    if (maxYears > 0) return maxYears;

    // Pattern 3: Detect year ranges in work history  e.g. "2015 – 2022" or "2018 - Present"
    const currentYear = new Date().getFullYear();
    const yearRanges = text.matchAll(/\b(20\d{2}|19\d{2})\s*[-–—]\s*(20\d{2}|present|current|now)\b/gi);
    let totalFromRanges = 0;

    for (const m of yearRanges) {
      const startYear = parseInt(m[1], 10);
      const endRaw = m[2].toLowerCase();
      const endYear = ['present', 'current', 'now'].includes(endRaw)
        ? currentYear
        : parseInt(m[2], 10);
      if (!isNaN(startYear) && !isNaN(endYear) && endYear >= startYear) {
        totalFromRanges += (endYear - startYear);
      }
    }

    if (totalFromRanges > 0) return Math.min(totalFromRanges, 40);

    return 0;
  }

  /**
   * Utility: Title-case a string
   */
  function toTitleCase(str) {
    return str
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .trim();
  }

  /**
   * Utility: Generate a unique ID
   */
  function generateId() {
    return `cand_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // Public API
  return { parseFile };

})();
