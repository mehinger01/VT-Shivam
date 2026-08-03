/**
 * VT Session Engine v1
 * A lightweight, dependency-free library for managing virtual tutoring session state.
 * Handles save/restore, import/export, and versioning of tutoring session data.
 */

const VTSessionEngine = (() => {
  const VERSION = '1.0.0';
  const STORAGE_KEY = 'vt-session-state';
  const TUTOR_CODE_PREFIX = 'VT-';

  // Internal state
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
   * Initialize the session engine with optional initial state.
   * @param {Object} options - Configuration options
   * @param {Boolean} options.loadFromStorage - Load existing state from localStorage (default: true)
   * @returns {Object} The initialized state
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
   * Get the current session state.
   * @returns {Object} A deep copy of the current state
   */
  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Update the session state with partial or complete updates.
   * @param {Object} updates - Properties to update in the state
   * @returns {Object} The updated state
   */
  function setState(updates) {
    if (!updates || typeof updates !== 'object') {
      throw new Error('setState requires an object argument');
    }

    // Deep merge updates into state
    state = deepMerge(state, updates);

    // Add entry to history
    addHistoryEntry('state-update', updates);

    return state;
  }

  /**
   * Save the current state to browser localStorage.
   * @returns {Boolean} True if save was successful
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
      console.error('Failed to save session to localStorage:', e);
      return false;
    }
  }

  /**
   * Load session state from browser localStorage.
   * @returns {Object|null} The loaded state, or null if no saved state exists
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
      console.error('Failed to load session from localStorage:', e);
      return null;
    }
  }

  /**
   * Generate a shareable tutor code from the current session state.
   * Includes compression, checksum, and metadata for robust serialization.
   * @returns {String} A tutor code string with format: VT-[checksum]|[compressed-data]
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

      addHistoryEntry('copy-tutor-code', {
        codeLength: code.length,
        uncompressedSize: json.length,
        compressedSize: compressed.length,
        compressionRatio: (100 * (1 - compressed.length / json.length)).toFixed(1)
      });

      return code;
    } catch (e) {
      console.error('Failed to generate tutor code:', e);
      return null;
    }
  }

  /**
   * Import and restore session state from a tutor code.
   * Validates checksum and decompresses data. Detects corruption.
   * @param {String} code - The tutor code to import
   * @returns {Boolean} True if import was successful
   */
  function importTutorCode(code) {
    try {
      if (!code || typeof code !== 'string') {
        throw new Error('Invalid code format: code must be a non-empty string');
      }

      // Remove prefix if present
      const payload = code.startsWith(TUTOR_CODE_PREFIX)
        ? code.substring(TUTOR_CODE_PREFIX.length)
        : code;

      // Base64 decode
      let withChecksum;
      try {
        withChecksum = atob(payload);
      } catch (e) {
        throw new Error('Invalid tutor code: failed to decode (may be corrupted)');
      }

      // Split checksum and data
      const pipeIndex = withChecksum.indexOf('|');
      if (pipeIndex === -1) {
        throw new Error('Invalid tutor code format: missing checksum separator');
      }

      const storedChecksum = withChecksum.substring(0, pipeIndex);
      const compressed = withChecksum.substring(pipeIndex + 1);

      // Verify checksum
      const calculatedChecksum = calculateChecksum(compressed);
      if (storedChecksum !== calculatedChecksum) {
        throw new Error('Tutor code verification failed: checksum mismatch. Code may be corrupted or modified.');
      }

      // Decompress and parse
      let json;
      try {
        json = decompressData(compressed);
      } catch (e) {
        throw new Error('Failed to decompress tutor code: ' + e.message);
      }

      let data;
      try {
        data = JSON.parse(json);
      } catch (e) {
        throw new Error('Invalid tutor code data: corrupted JSON');
      }

      if (!data.state) {
        throw new Error('Invalid tutor code: missing session state');
      }

      state = data.state;
      addHistoryEntry('import-tutor-code', {
        sourceVersion: data.engineVersion,
        sourceTimestamp: data.created,
        sourceStudent: data.student,
        sourceSite: data.site
      });

      return true;
    } catch (e) {
      console.error('Failed to import tutor code:', e.message);
      return false;
    }
  }

  /**
   * Reset the session to initial empty state and clear all history.
   * @returns {Object} The reset state
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
   * @private
   */
  function compressData(json) {
    // Dictionary of common patterns to compress
    // Focus on frequently-occurring JSON structures
    let compressed = json;

    // Replace common key-value patterns with shorter forms
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
   * @private
   */
  function decompressData(compressed) {
    // Reverse dictionary (must be in opposite order)
    let decompressed = compressed;

    const replacements = [
      ['~', 'null'],
      ['0', 'false'],
      ['1', 'true'],
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
      ['"c":0', '"completed":false'],
      ['"c":1', '"completed":true'],
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
