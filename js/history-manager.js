/**
 * history-manager.js
 * Manages undo/redo history for HangarPlanner tile changes
 * Tracks last 5 changes and syncs to server in Master mode
 */

(function() {
	'use strict';

	const HISTORY_KEY = 'hangarHistory';
	const MAX_HISTORY = 5;

	class HistoryManager {
		constructor() {
			// Singleton pattern - return existing instance if it exists
			if (HistoryManager.instance) {
				return HistoryManager.instance;
			}
			
			this.undoStack = [];
			this.redoStack = [];
			this.maxHistory = MAX_HISTORY;
			this.isCapturing = true;
			this.initialized = false;
			
			// Store singleton instance
			HistoryManager.instance = this;
		}

		init() {
			if (this.initialized) {
				console.warn('⚠️ History Manager already initialized');
				return;
			}

			this.loadHistory();
			this.setupChangeListeners();
			this.setupButtonListeners();
			this.setupKeyboardShortcuts();
			this.updateButtonStates();
			
			this.initialized = true;
			console.log('📚 History Manager initialized (max:', this.maxHistory, 'entries)');
		}

		/**
		 * Load history from localStorage
		 */
		loadHistory() {
			try {
				const stored = localStorage.getItem(HISTORY_KEY);
				if (stored) {
					const data = JSON.parse(stored);
					this.undoStack = Array.isArray(data.undoStack) ? data.undoStack.slice(0, this.maxHistory) : [];
					this.redoStack = Array.isArray(data.redoStack) ? data.redoStack.slice(0, this.maxHistory) : [];
					console.log(`📚 Loaded history: ${this.undoStack.length} undo, ${this.redoStack.length} redo`);
				}
			} catch (e) {
				console.warn('Failed to load history:', e);
				this.undoStack = [];
				this.redoStack = [];
			}
		}

		/**
		 * Save history to localStorage
		 */
		saveHistory() {
			try {
				const data = {
					undoStack: this.undoStack.slice(0, this.maxHistory),
					redoStack: this.redoStack.slice(0, this.maxHistory)
				};
				localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
			} catch (e) {
				console.warn('Failed to save history:', e);
			}
		}

		/**
		 * Capture current state of all tiles
		 */
		captureState() {
			const state = {
				timestamp: Date.now(),
				tiles: []
			};

			// Capture primary tiles
			const primaryTiles = document.querySelectorAll('#hangarGrid .hangar-cell');
			primaryTiles.forEach((tile, index) => {
				const cellId = index + 1;
				state.tiles.push(this.captureTileState(cellId));
			});

			// Capture secondary tiles
			const secondaryTiles = document.querySelectorAll('#secondaryHangarGrid .hangar-cell');
			secondaryTiles.forEach((tile, index) => {
				const cellId = 100 + index + 1;
				state.tiles.push(this.captureTileState(cellId));
			});

			return state;
		}

		/**
		 * Capture state of a single tile
		 */
		captureTileState(cellId) {
			const getVal = (id) => {
				const el = document.getElementById(id);
				if (!el) return '';
				if (el.tagName === 'SELECT') return el.value || '';
				if (el.dataset && el.dataset.iso) return el.dataset.iso;
				return el.value || '';
			};

			return {
				cellId,
				aircraft: getVal(`aircraft-${cellId}`),
				arrival: getVal(`arrival-time-${cellId}`),
				departure: getVal(`departure-time-${cellId}`),
				position: getVal(`position-${cellId}`),
				hangarPosition: getVal(`hangar-position-${cellId}`),
				status: getVal(`status-${cellId}`),
				towStatus: getVal(`tow-status-${cellId}`),
				notes: getVal(`notes-${cellId}`)
			};
		}

		/**
		 * Restore state to UI
		 */
		restoreState(state) {
			if (!state || !state.tiles) {
				console.warn('↶ No state or tiles to restore');
				return;
			}

			console.log('↶ Restoring state with', state.tiles.length, 'tiles');
			this.isCapturing = false; // Prevent capturing during restore
			
			try {
				state.tiles.forEach((tileState, index) => {
					console.log('↶ Processing tile', index + 1, '/', state.tiles.length);
					this.restoreTileState(tileState);
				});
				console.log('↶ All tiles processed');
			} finally {
				this.isCapturing = true;
				console.log('↶ Capturing re-enabled');
			}
		}

		/**
		 * Restore single tile state
		 */
		restoreTileState(tileState) {
			if (!tileState) {
				console.warn('↶ No tileState provided');
				return;
			}
			
			const { cellId } = tileState;
			console.log('↶ Restoring tile', cellId, 'with data:', tileState);
			
			const setVal = (id, val) => {
				const el = document.getElementById(id);
				if (!el) {
					console.warn('  ↶ Element not found:', id);
					return false;
				}
				
				const oldVal = el.value || '';
				const newVal = val || '';
				
				// Skip if values are the same
				if (oldVal === newVal && el.tagName !== 'SELECT') {
					return false;
				}
				
				if (el.tagName === 'SELECT') {
					const actualNewVal = newVal || 'neutral';
					if (el.value === actualNewVal) {
						return false; // Already at correct value
					}
					el.value = actualNewVal;
					console.log('  ↶ SELECT restored', id, ':', oldVal, '→', actualNewVal);
					// Trigger styling updates
					if (id.startsWith('status-') && typeof window.updateStatusLight === 'function') {
						window.updateStatusLight(el);
					}
					if (id.startsWith('tow-status-') && typeof window.updateTowStatusStyles === 'function') {
						window.updateTowStatusStyles(el);
					}
				} else {
					el.value = newVal;
					console.log('  ↶ INPUT restored', id, ':', oldVal, '→', newVal);
					// For datetime fields, also update dataset.iso
					if ((id.includes('arrival-time') || id.includes('departure-time')) && newVal) {
						el.dataset.iso = newVal;
					} else if ((id.includes('arrival-time') || id.includes('departure-time')) && !newVal) {
						// Clear dataset.iso if value is empty
						try { delete el.dataset.iso; } catch(e) {}
					}
				}
				
				// DON'T trigger change/input events during restore
				// This prevents other systems from reacting and causing flicker
				return true;
			};

			let changedCount = 0;
			if (setVal(`aircraft-${cellId}`, tileState.aircraft)) changedCount++;
			if (setVal(`arrival-time-${cellId}`, tileState.arrival)) changedCount++;
			if (setVal(`departure-time-${cellId}`, tileState.departure)) changedCount++;
			if (setVal(`position-${cellId}`, tileState.position)) changedCount++;
			if (setVal(`hangar-position-${cellId}`, tileState.hangarPosition)) changedCount++;
			if (setVal(`status-${cellId}`, tileState.status)) changedCount++;
			if (setVal(`tow-status-${cellId}`, tileState.towStatus)) changedCount++;
			if (setVal(`notes-${cellId}`, tileState.notes)) changedCount++;
			
			console.log('  ↶ Tile', cellId, 'complete:', changedCount, 'fields changed');
		}

		/**
		 * Check if current user is in read-only mode
		 */
		isReadOnlyMode() {
			try {
				if (window.sharingManager && typeof window.sharingManager.syncMode === 'string') {
					return window.sharingManager.syncMode === 'sync';
				}
				return false;
			} catch (e) {
				return false;
			}
		}

		/**
		 * Push state to undo stack
		 */
		pushState(state) {
			if (!this.isCapturing) return;
			if (this.isReadOnlyMode()) return;

			// Don't push duplicate states
			if (this.undoStack.length > 0) {
				const lastState = this.undoStack[this.undoStack.length - 1];
				if (JSON.stringify(lastState.tiles) === JSON.stringify(state.tiles)) {
					return; // Skip duplicate
				}
			}

			// Add to undo stack
			this.undoStack.push(state);
			
			// Trim to max size
			if (this.undoStack.length > this.maxHistory) {
				this.undoStack.shift();
			}

			// Clear redo stack when new action is performed
			this.redoStack = [];

			this.saveHistory();
			this.updateButtonStates();
			
			console.log('📝 State captured, undo stack:', this.undoStack.length);
		}

		/**
		 * Undo last action
		 */
		async undo() {
			if (!this.canUndo()) {
				console.warn('↶ Undo: No states to undo');
				return;
			}
			if (this.isReadOnlyMode()) {
				this.showNotification('Undo disabled in read-only mode', 'warning');
				return;
			}

			try {
				// Capture current state before undo (to allow redo)
				const currentState = this.captureState();
				console.log('↶ Current state captured for redo');
				
				// Pop from undo stack (this is the state to restore TO)
				const previousState = this.undoStack.pop();
				console.log('↶ Restoring state from:', new Date(previousState.timestamp).toLocaleTimeString());
				
				// Push current to redo stack
				this.redoStack.push(currentState);
				if (this.redoStack.length > this.maxHistory) {
					this.redoStack.shift();
				}

				// Restore previous state
				this.restoreState(previousState);
				console.log('↶ State restored, tiles updated:', previousState.tiles.length);

				// Sync to server if in Master mode
				await this.syncToServer();

				this.saveHistory();
				this.updateButtonStates();
				this.showNotification('Undo applied', 'success');
				
				console.log('↶ Undo complete. Remaining undo:', this.undoStack.length, 'redo:', this.redoStack.length);
			} catch (e) {
				console.error('Undo failed:', e);
				this.showNotification('Undo failed: ' + e.message, 'error');
			}
		}

		/**
		 * Redo last undone action
		 */
		async redo() {
			if (!this.canRedo()) return;
			if (this.isReadOnlyMode()) {
				this.showNotification('Redo disabled in read-only mode', 'warning');
				return;
			}

			try {
				// Capture current state before redo
				const currentState = this.captureState();
				
				// Pop from redo stack
				const nextState = this.redoStack.pop();
				
				// Push current to undo stack
				this.undoStack.push(currentState);
				if (this.undoStack.length > this.maxHistory) {
					this.undoStack.shift();
				}

				// Restore next state
				this.restoreState(nextState);

				// Sync to server if in Master mode
				await this.syncToServer();

				this.saveHistory();
				this.updateButtonStates();
				this.showNotification('Redo applied', 'success');
				
				console.log('↷ Redo applied, stack:', this.redoStack.length);
			} catch (e) {
				console.error('Redo failed:', e);
				this.showNotification('Redo failed: ' + e.message, 'error');
			}
		}

		/**
		 * Check if undo is available
		 */
		canUndo() {
			return this.undoStack.length > 0 && !this.isReadOnlyMode();
		}

		/**
		 * Check if redo is available
		 */
		canRedo() {
			return this.redoStack.length > 0 && !this.isReadOnlyMode();
		}

		/**
		 * Sync changes to server
		 */
		async syncToServer() {
			try {
				if (window.serverSync && window.serverSync.isMaster) {
					if (typeof window.serverSync.syncWithServer === 'function') {
						await window.serverSync.syncWithServer();
						console.log('✓ Changes synced to server');
					}
				}
			} catch (e) {
				console.warn('Server sync failed:', e);
			}
		}

		/**
		 * Setup change listeners for tiles
		 */
		setupChangeListeners() {
			// Capture initial state on first load
			setTimeout(() => {
				try {
					const initialState = this.captureState();
					this.pushState(initialState); // Push to stack so first undo works
					console.log('📸 Initial state captured and pushed:', initialState.tiles.length, 'tiles');
				} catch (e) {
					console.warn('Failed to capture initial state:', e);
				}
			}, 1000);
			
			// Store "before" state when user starts interacting
			const captureBeforeChange = (e) => {
				if (!this.isCapturing) return; // Skip during restore
				
				const target = e.target;
				if (!target || !target.id) return;
				
				const patterns = [
					/^aircraft-\d+$/,
					/^arrival-time-\d+$/,
					/^departure-time-\d+$/,
					/^position-\d+$/,
					/^hangar-position-\d+$/,
					/^status-\d+$/,
					/^tow-status-\d+$/,
					/^notes-\d+$/
				];
				
				const isTrackedField = patterns.some(pattern => pattern.test(target.id));
				if (!isTrackedField) return;
				
				// Store the state BEFORE the change
				if (!this._beforeChangeState) {
					this._beforeChangeState = this.captureState();
					console.log('📸 Before-change state captured');
				}
			};
			
			// Capture state AFTER field changes
			const captureAfterChange = (e) => {
				if (!this.isCapturing) return; // Skip during restore
				
				const target = e.target;
				if (!target || !target.id) return;
				
				const patterns = [
					/^aircraft-\d+$/,
					/^arrival-time-\d+$/,
					/^departure-time-\d+$/,
					/^position-\d+$/,
					/^hangar-position-\d+$/,
					/^status-\d+$/,
					/^tow-status-\d+$/,
					/^notes-\d+$/
				];
				
				const isTrackedField = patterns.some(pattern => pattern.test(target.id));
				if (!isTrackedField) return;

				console.log('📝 Change detected:', target.id, '=', target.value);

				// Debounce: push before-state after short delay
				clearTimeout(this._captureTimeout);
				this._captureTimeout = setTimeout(() => {
					if (this._beforeChangeState) {
						this.pushState(this._beforeChangeState);
						this._beforeChangeState = null; // Clear for next change
						console.log('✅ Before-state pushed to undo stack');
					}
				}, 500);
			};

			// Listen for focus (before change) and change/input (after change)
			document.addEventListener('focus', captureBeforeChange, true);
			document.addEventListener('change', captureAfterChange, true);
			document.addEventListener('input', captureAfterChange, true);
			
			console.log('📝 Change listeners registered (capture phase)');
		}

		/**
		 * Setup button click listeners
		 */
		setupButtonListeners() {
			const undoBtn = document.getElementById('undoBtn');
			const redoBtn = document.getElementById('redoBtn');

			if (undoBtn) {
				undoBtn.addEventListener('click', (e) => {
					e.preventDefault();
					this.undo();
				});
			}

			if (redoBtn) {
				redoBtn.addEventListener('click', (e) => {
					e.preventDefault();
					this.redo();
				});
			}

			// Update button states on sync mode changes
			document.addEventListener('syncModeChanged', () => {
				this.updateButtonStates();
			});

			console.log('🔘 Button listeners registered');
		}

		/**
		 * Setup keyboard shortcuts
		 */
		setupKeyboardShortcuts() {
			document.addEventListener('keydown', (e) => {
				// Don't intercept if typing in input/textarea
				const target = e.target;
				if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
					// Allow in inputs unless it's a special shortcut
					const isModifier = e.ctrlKey || e.metaKey;
					if (!isModifier) return;
				}

				// Undo: Ctrl+Z / Cmd+Z
				if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
					e.preventDefault();
					this.undo();
					return;
				}

				// Redo: Ctrl+Y / Cmd+Y
				if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
					e.preventDefault();
					this.redo();
					return;
				}

				// Alternative Redo: Ctrl+Shift+Z / Cmd+Shift+Z
				if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
					e.preventDefault();
					this.redo();
					return;
				}
			});

			console.log('⌨️ Keyboard shortcuts registered (Ctrl/Cmd+Z, Ctrl/Cmd+Y)');
		}

		/**
		 * Update button enabled/disabled states
		 */
		updateButtonStates() {
			const undoBtn = document.getElementById('undoBtn');
			const redoBtn = document.getElementById('redoBtn');

			if (undoBtn) {
				undoBtn.disabled = !this.canUndo();
				undoBtn.classList.toggle('opacity-50', !this.canUndo());
				undoBtn.classList.toggle('cursor-not-allowed', !this.canUndo());
			}

			if (redoBtn) {
				redoBtn.disabled = !this.canRedo();
				redoBtn.classList.toggle('opacity-50', !this.canRedo());
				redoBtn.classList.toggle('cursor-not-allowed', !this.canRedo());
			}
		}

		/**
		 * Show notification to user
		 */
		showNotification(message, type = 'info') {
			if (typeof window.showNotification === 'function') {
				window.showNotification(message, type);
			} else {
				console.log(`[${type.toUpperCase()}] ${message}`);
			}
		}

		/**
		 * Clear all history
		 */
		clearHistory() {
			this.undoStack = [];
			this.redoStack = [];
			this.saveHistory();
			this.updateButtonStates();
			console.log('🗑️ History cleared');
		}
	}

	// Initialize History Manager
	function initHistoryManager() {
		try {
			// Create singleton instance (will return existing if already created)
			const manager = new HistoryManager();
			
			// Initialize if not already done
			if (!manager.initialized) {
				manager.init();
			}
		} catch (e) {
			console.error('Failed to initialize History Manager:', e);
		}
	}

	// Add to initialization queue
	window.hangarInitQueue = window.hangarInitQueue || [];
	window.hangarInitQueue.push(initHistoryManager);

	// Expose for debugging
	window.HistoryManager = HistoryManager;

})();
