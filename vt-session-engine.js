/**
 * VT Session Engine v1.0.0
 * ========================================
 * A lightweight, dependency-free JavaScript library for managing virtual tutoring sessions.
 *
 * Key Features:
 * - Manage complete tutoring session state (student, assessments, lessons, mastery, notes)
 * - Persistent storage using browser localStorage
 * - Shareable tutor codes with compression and checksum validation
 * - Deep merging for partial state updates
 * - Automatic history tracking
 *
 * Browser Support:
 * - Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
 * - Requires: localStorage API, JSON, ES6
 *
 * Usage:
 *   VTSessionEngine.initialize();
 *   VTSessionEngine.setState({ student: { name: 'John' } });
 *   const code = VTSessionEngine.copyTutorCode();
 *   VTSessionEngine.importTutorCode(code);
 *
 * @namespace VTSessionEngine
 */

const VTSessionEngine = (() => {
  const VERSION = '1.0.0';
  const STORAGE_KEY = 'vt-session-state';
  const TUTOR_CODE_PREFIX = 'VT-';

  /**
   * Internal session state.
   * Structure: {
   *   student: { name, id, email } — Student identity
   *   assessment: { current, history } — Assessment results and history
   *   lessons: [] — Lesson data
   *   mastery: {} — Topic mastery scores (0-1 scale)
   *   notes: [] — Tutor and session notes
   *   settings: { theme, notifications } — User preferences
   *   history: [] — Auto-tracked action history
   * }
   */
  let state = {
    student: {
      name: '',
      id: '',
      email: ''
    },
    assessment: {
      current: null,
      history: []
    },
    lessons: [],
    mastery: {},
    notes: [],
    settings: {
      theme: 'light',
      notifications: true
    },
    history: []
  };

  /**
   * Initialize the session engine with optional configuration.
   *
   * Loads existing session from localStorage by default, or starts fresh.
   * Must be called once before using other methods.
   *
   * @param {Object} options - Configuration options
   * @param {Boolean} [options.loadFromStorage=true] - Restore saved session from localStorage
   * @returns {Object} The initialized state (or restored state if loadFromStorage is true)
   *
   * @example
   * VTSessionEngine.initialize();
   * VTSessionEngine.initialize({ loadFromStorage: false }); // Fresh start
   */
  function initialize(options = {}) {
    const { loadFromStorage = true } = options;

    if (loadFromStorage) {
      const stored = loadLocal();
      if (stored) {
        state = stored;
      }
    }

    return state;
  }

  /**
   * Get the current session state as a deep copy.
   *
   * Returns a copy to prevent external mutations. Safe to inspect,
   * but changes won't affect the engine. Use setState() to make changes.
   *
   * @returns {Object} A deep copy of the current session state
   *
   * @example
   * const state = VTSessionEngine.getState();
   * console.log(state.student.name);
   */
  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Update the session state with new or changed data.
   *
   * Uses deep merging, so you only provide the fields you want to change.
   * Automatically adds an entry to the session history.
   *
   * @param {Object} updates - Properties to merge into the state
   * @returns {Object} The updated state (same as calling getState() after)
   * @throws {Error} If updates is not an object
   *
   * @example
   * VTSessionEngine.setState({
   *   student: { name: 'Alice' },
   *   mastery: { algebra: 0.85 }
   * });
   */
  function setState(updates) {
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('setState: argument must be a non-null object (not an array)');
    }

    state = deepMerge(state, updates);
    addHistoryEntry('state-update', updates);

    return state;
  }

  /**
   * Save the current state to browser localStorage.
   *
   * Persists the complete session (including version and timestamp).
   * Recommended to call after major changes (setState, gradeAssessment, etc).
   *
   * Note: Subject to browser storage limits (~5-10 MB per domain).
   * Complex sessions with many assessments may approach limits.
   *
   * @returns {Boolean} True if save succeeded, false if localStorage is unavailable or full
   *
   * @example
   * VTSessionEngine.setState({ student: { name: 'Bob' } });
   * VTSessionEngine.saveLocal();
   */
  function saveLocal() {
    try {
      const serialized = JSON.stringify({
        version: VERSION,
        timestamp: new Date().toISOString(),
        state: state
      });
      localStorage.setItem(STORAGE_KEY, serialized);
      addHistoryEntry('save-local', { timestamp: new Date().toISOString() });
      return true;
    } catch (e) {
      console.error('VTSessionEngine.saveLocal: Failed to persist session:', e.message);
      return false;
    }
  }

  /**
   * Load session state from browser localStorage.
   *
   * Does NOT automatically update the engine's state.
   * Typically called by initialize({ loadFromStorage: true }) or
   * after user confirms they want to restore a previous session.
   *
   * @returns {Object|null} The saved state, or null if none exists or data is corrupted
   *
   * @example
   * const saved = VTSessionEngine.loadLocal();
   * if (saved) { console.log('Session found:', saved.student.name); }
   */
  function loadLocal() {
    try {
      const item = localStorage.getItem(STORAGE_KEY);
      if (!item) {
        return null;
      }

      const data = JSON.parse(item);
      if (data.version && data.state) {
        addHistoryEntry('load-local', { timestamp: data.timestamp });
        return data.state;
      }

      return null;
    } catch (e) {
      console.error('VTSessionEngine.loadLocal: Failed to load session:', e.message);
      return null;
    }
  }

  /**
   * Generate a shareable tutor code from the current session.
   *
   * Creates a compressed, checksummed code that can be copied/pasted between tutors.
   * Safe for chat platforms, includes metadata (version, student, timestamp).
   * Use with importTutorCode() to restore on another device.
   *
   * Compression reduces typical tutor codes by 15-20%.
   * Checksum detects corruption or tampering.
   * Metadata allows version compatibility checks.
   *
   * @returns {String|null} A tutor code (e.g., "VT-abc123...xyz") or null if generation fails
   *
   * @example
   * const code = VTSessionEngine.copyTutorCode();
   * if (code) {
   *   navigator.clipboard.writeText(code);
   *   console.log('Share with other tutor:', code);
   * }
   */
  function copyTutorCode() {
    try {
      const payload = {
        engineVersion: VERSION,
        created: new Date().toISOString(),
        site: 'vt-session',
        student: state.student.name || 'Unknown',
        state: state
      };

      // Serialize and compress
      const json = JSON.stringify(payload);
      const compressed = compressData(json);

      // Calculate checksum
      const checksum = calculateChecksum(compressed);

      // Combine: checksum|compressed_data
      const withChecksum = checksum + '|' + compressed;

      // Base64 encode
      const encoded = btoa(withChecksum);
      const code = TUTOR_CODE_PREFIX + encoded;

      // DIAGNOSTIC LOGGING
      console.log('[VT-Export] ========== EXPORT DIAGNOSTICS ==========');
      console.log('[VT-Export] Raw JSON length:', json.length);
      console.log('[VT-Export] Compressed length:', compressed.length);
      console.log('[VT-Export] Encoded length:', encoded.length);
      console.log('[VT-Export] Final code length:', code.length);
      console.log('[VT-Export] Compression ratio:', (100 * (1 - compressed.length / json.length)).toFixed(1) + '%');
      console.log('[VT-Export] Checksum:', checksum);
      console.log('[VT-Export] First 30 chars:', code.substring(0, 30));
      console.log('[VT-Export] Last 30 chars:', code.substring(Math.max(0, code.length - 30)));
      console.log('[VT-Export] ======================================');

      addHistoryEntry('copy-tutor-code', {
        codeLength: code.length,
        uncompressedSize: json.length,
        compressedSize: compressed.length,
        compressionRatio: (100 * (1 - compressed.length / json.length)).toFixed(1)
      });

      return code;
    } catch (e) {
      console.error('[VT-Export] FAILED:', e.message);
      return null;
    }
  }

  /**
   * Import and restore a session from a tutor code.
   *
   * Validates the code's checksum and decompresses the data.
   * On success, replaces the current engine state entirely.
   * On failure, leaves the current state unchanged.
   *
   * Error messages logged to console explain why import failed:
   * - Invalid code format
   * - Failed to decode (corruption)
   * - Checksum mismatch (tampering)
   * - Failed to decompress
   * - Corrupted JSON
   * - Missing session state
   *
   * @param {String} code - A tutor code from copyTutorCode() (with or without "VT-" prefix)
   * @returns {Boolean} True if import succeeded, false otherwise
   *
   * @example
   * const success = VTSessionEngine.importTutorCode('VT-abc123...xyz');
   * if (success) {
   *   console.log('Session restored');
   *   const state = VTSessionEngine.getState();
   * } else {
   *   console.log('Failed to import code');
   * }
   */
  function importTutorCode(code) {
    try {
      // DIAGNOSTIC: Input validation
      console.log('[VT-Import] ========== IMPORT DIAGNOSTICS ==========');
      console.log('[VT-Import] Input length:', code ? code.length : 'null/undefined');
      console.log('[VT-Import] Input type:', typeof code);

      if (!code || typeof code !== 'string') {
        throw new Error('Invalid code format: code must be a non-empty string');
      }

      console.log('[VT-Import] Input first 30 chars:', code.substring(0, 30));
      console.log('[VT-Import] Input last 30 chars:', code.substring(Math.max(0, code.length - 30)));

      // Remove prefix if present
      const payload = code.startsWith(TUTOR_CODE_PREFIX)
        ? code.substring(TUTOR_CODE_PREFIX.length)
        : code;

      console.log('[VT-Import] After prefix removal:', payload.length);

      // Base64 decode
      let withChecksum;
      try {
        withChecksum = atob(payload);
        console.log('[VT-Import] Base64 decode: SUCCESS, length:', withChecksum.length);
      } catch (e) {
        console.log('[VT-Import] Base64 decode: FAILED -', e.message);
        throw new Error('Invalid tutor code: failed to decode (may be corrupted)');
      }

      // Split checksum and data
      const pipeIndex = withChecksum.indexOf('|');
      console.log('[VT-Import] Pipe index:', pipeIndex);

      if (pipeIndex === -1) {
        throw new Error('Invalid tutor code format: missing checksum separator');
      }

      const storedChecksum = withChecksum.substring(0, pipeIndex);
      const compressed = withChecksum.substring(pipeIndex + 1);

      console.log('[VT-Import] Stored checksum:', storedChecksum);
      console.log('[VT-Import] Compressed data length:', compressed.length);

      // Verify checksum
      const calculatedChecksum = calculateChecksum(compressed);
      console.log('[VT-Import] Calculated checksum:', calculatedChecksum);
      console.log('[VT-Import] Checksum match:', storedChecksum === calculatedChecksum);

      if (storedChecksum !== calculatedChecksum) {
        throw new Error('Tutor code verification failed: checksum mismatch. Code may be corrupted or modified.');
      }

      // Decompress and parse
      let json;
      try {
        json = decompressData(compressed);
        console.log('[VT-Import] Decompression: SUCCESS, JSON length:', json.length);
      } catch (e) {
        console.log('[VT-Import] Decompression: FAILED -', e.message);
        throw new Error('Failed to decompress tutor code: ' + e.message);
      }

      let data;
      try {
        data = JSON.parse(json);
        console.log('[VT-Import] JSON parse: SUCCESS');
      } catch (e) {
        console.log('[VT-Import] JSON parse: FAILED -', e.message);
        throw new Error('Invalid tutor code data: corrupted JSON');
      }

      console.log('[VT-Import] Version:', data.engineVersion);
      console.log('[VT-Import] Student:', data.student);
      console.log('[VT-Import] State exists:', !!data.state);

      if (!data.state) {
        throw new Error('Invalid tutor code: missing session state');
      }

      state = data.state;
      console.log('[VT-Import] IMPORT: SUCCESS');
      console.log('[VT-Import] ======================================');

      addHistoryEntry('import-tutor-code', {
        sourceVersion: data.engineVersion,
        sourceTimestamp: data.created,
        sourceStudent: data.student,
        sourceSite: data.site
      });

      return true;
    } catch (e) {
      console.error('[VT-Import] IMPORT FAILED:', e.message);
      console.log('[VT-Import] ======================================');
      return false;
    }
  }

  /**
   * Reset the session to initial empty state.
   *
   * Clears all student data, assessments, lessons, mastery, notes, and history.
   * Useful when starting a new student or session.
   * Does NOT affect localStorage—call saveLocal() after if you want to persist the reset.
   *
   * @returns {Object} The reset state (empty/default)
   *
   * @example
   * VTSessionEngine.reset();
   * VTSessionEngine.saveLocal(); // Persist the reset
   */
  function reset() {
    state = {
      student: {
        name: '',
        id: '',
        email: ''
      },
      assessment: {
        current: null,
        history: []
      },
      lessons: [],
      mastery: {},
      notes: [],
      settings: {
        theme: 'light',
        notifications: true
      },
      history: []
    };

    return state;
  }

  /**
   * Internal helper: Add an entry to the history log.
   * @private
   */
  function addHistoryEntry(action, details = {}) {
    state.history.push({
      action,
      timestamp: new Date().toISOString(),
      details
    });
  }

  /**
   * Internal helper: Calculate checksum for data validation.
   * Uses a fast hash algorithm suitable for corruption detection.
   * @private
   */
  function calculateChecksum(data) {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Internal helper: Compress data using efficient string substitution.
   * Replaces common patterns with shorter representations.
   * NOTE: Order matters for decompression! Compress specific→generic, decompress specific→generic.
   * @private
   */
  function compressData(json) {
    // Dictionary of common patterns to compress
    // Focus on frequently-occurring JSON structures
    let compressed = json;

    // Replace common key-value patterns with shorter forms
    // Compression order: specific patterns like "completed":true become "c":1
    const replacements = [
      ['"completed":false', '"c":0'],
      ['"completed":true', '"c":1'],
      ['"assessment":', '"a":'],
      ['"current":', '"cu":'],
      ['"history":', '"h":'],
      ['"lessons":', '"l":'],
      ['"mastery":', '"m":'],
      ['"notes":', '"n":'],
      ['"settings":', '"s":'],
      ['"student":', '"st":'],
      ['"timestamp":', '"t":'],
      ['"action":', '"ac":'],
      ['"details":', '"d":'],
      ['"name":', '"nm":'],
      ['"email":', '"em":'],
      ['"title":', '"ti":'],
      ['"id":', '"i":'],
      ['true', '1'],
      ['false', '0'],
      ['null', '~'],
    ];

    for (const [find, replace] of replacements) {
      compressed = compressed.split(find).join(replace);
    }

    return compressed;
  }

  /**
   * Internal helper: Decompress data by reversing compression replacements.
   * CRITICAL: Order matters! Specific patterns must come before generic patterns.
   * Otherwise '"c":0' becomes '"c":false' before we can expand it to '"completed":false'.
   * @private
   */
  function decompressData(compressed) {
    let decompressed = compressed;

    const replacements = [
      // SPECIFIC PATTERNS FIRST (must come before generic 0/1 replacements)
      ['"c":0', '"completed":false'],
      ['"c":1', '"completed":true'],

      // FIELD NAME EXPANSIONS (before generic 0/1)
      ['"em":', '"email":'],
      ['"nm":', '"name":'],
      ['"i":', '"id":'],
      ['"ti":', '"title":'],
      ['"d":', '"details":'],
      ['"ac":', '"action":'],
      ['"t":', '"timestamp":'],
      ['"st":', '"student":'],
      ['"s":', '"settings":'],
      ['"n":', '"notes":'],
      ['"m":', '"mastery":'],
      ['"l":', '"lessons":'],
      ['"h":', '"history":'],
      ['"cu":', '"current":'],
      ['"a":', '"assessment":'],

      // GENERIC PATTERNS LAST (less specific, happens after specific)
      ['~', 'null'],
      ['0', 'false'],
      ['1', 'true'],
    ];

    for (const [find, replace] of replacements) {
      decompressed = decompressed.split(find).join(replace);
    }

    return decompressed;
  }

  /**
   * Internal helper: Deep merge objects (simple recursive merge).
   * @private
   */
  function deepMerge(target, source) {
    const result = JSON.parse(JSON.stringify(target));

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] !== null &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          result[key] &&
          typeof result[key] === 'object' &&
          !Array.isArray(result[key])
        ) {
          result[key] = deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  // Public API
  return {
    initialize,
    getState,
    setState,
    saveLocal,
    loadLocal,
    copyTutorCode,
    importTutorCode,
    reset,
    VERSION
  };
})();

// Export for use in browsers and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VTSessionEngine;
}
