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
			this.undoStack = [];
			this.redoStack = [];
			this.maxHistory = MAX_HISTORY;
			this.isCapturing = true;
			this.initialized = false;
			
			// Singleton pattern
			if (window.HistoryManager) {
				return window.HistoryManager;
			}
			window.HistoryManager = this;
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
			if (!state || !state.tiles) return;

			this.isCapturing = false; // Prevent capturing during restore
			
			try {
				state.tiles.forEach(tileState => {
					this.restoreTileState(tileState);
				});
			} finally {
				this.isCapturing = true;
			}
		}

		/**
		 * Restore single tile state
		 */
		restoreTileState(tileState) {
			const setVal = (id, val) => {
				const el = document.getElementById(id);
				if (!el) return;
				
				if (el.tagName === 'SELECT') {
					el.value = val || 'neutral';
					// Trigger styling updates
					if (id.startsWith('status-') && typeof window.updateStatusLight === 'function') {
						window.updateStatusLight(el);
					}
					if (id.startsWith('tow-status-') && typeof window.updateTowStatusStyles === 'function') {
						window.updateTowStatusStyles(el);
					}
				} else {
					el.value = val || '';
					// For datetime fields, also update dataset.iso
					if ((id.includes('arrival-time') || id.includes('departure-time')) && val) {
						el.dataset.iso = val;
					}
				}
				
				// Trigger change event
				el.dispatchEvent(new Event('change', { bubbles: true }));
			};

			const { cellId } = tileState;
			setVal(`aircraft-${cellId}`, tileState.aircraft);
			setVal(`arrival-time-${cellId}`, tileState.arrival);
			setVal(`departure-time-${cellId}`, tileState.departure);
			setVal(`position-${cellId}`, tileState.position);
			setVal(`hangar-position-${cellId}`, tileState.hangarPosition);
			setVal(`status-${cellId}`, tileState.status);
			setVal(`tow-status-${cellId}`, tileState.towStatus);
			setVal(`notes-${cellId}`, tileState.notes);
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
		}

		/**
		 * Undo last action
		 */
		async undo() {
			if (!this.canUndo()) return;
			if (this.isReadOnlyMode()) {
				this.showNotification('Undo disabled in read-only mode', 'warning');
				return;
			}

			try {
				// Capture current state before undo
				const currentState = this.captureState();
				
				// Pop from undo stack
				const previousState = this.undoStack.pop();
				
				// Push current to redo stack
				this.redoStack.push(currentState);
				if (this.redoStack.length > this.maxHistory) {
					this.redoStack.shift();
				}

				// Restore previous state
				this.restoreState(previousState);

				// Sync to server if in Master mode
				await this.syncToServer();

				this.saveHistory();
				this.updateButtonStates();
				this.showNotification('Undo applied', 'success');
				
				console.log('↶ Undo applied, stack:', this.undoStack.length);
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
			// Capture state on field changes
			const captureOnChange = (e) => {
				const target = e.target;
				if (!target) return;
				
				// Only track changes to tile fields
				const id = target.id;
				if (!id) return;
				
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
				
				const isTrackedField = patterns.some(pattern => pattern.test(id));
				if (!isTrackedField) return;

				// Debounce: capture state after short delay
				clearTimeout(this._captureTimeout);
				this._captureTimeout = setTimeout(() => {
					const state = this.captureState();
					this.pushState(state);
				}, 300);
			};

			document.addEventListener('change', captureOnChange);
			document.addEventListener('input', captureOnChange);
			
			console.log('📝 Change listeners registered');
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
			const manager = new HistoryManager();
			manager.init();
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
