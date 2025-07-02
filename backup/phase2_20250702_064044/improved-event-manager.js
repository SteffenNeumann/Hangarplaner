/**
 * VERBESSERTER ZENTRALER EVENT-MANAGER
 * Löst alle identifizierten Funktionskonflikte
 * Version: 2.0 - Konfliktbereinigt
 */

console.log("🔧 Lade verbesserten Event-Manager...");

class HangarEventManager {
	constructor() {
		this.initialized = false;
		this.registeredHandlers = new Map(); // Tracking aller Handler
		this.storageQueue = []; // Queue für localStorage-Operationen
		this.isProcessingStorage = false;
		this.debounceTimers = new Map();

		// Singleton-Pattern
		if (HangarEventManager.instance) {
			return HangarEventManager.instance;
		}
		HangarEventManager.instance = this;
	}

	/**
	 * SICHERE EVENT-HANDLER-REGISTRIERUNG
	 * Verhindert Mehrfachregistrierung automatisch
	 */
	safeAddEventListener(element, eventType, handler, handlerName = null) {
		if (!element || typeof handler !== "function") {
			console.warn("❌ Ungültige Event-Handler-Parameter:", {
				element,
				eventType,
				handler,
			});
			return false;
		}

		const elementId =
			element.id ||
			element.tagName + "_" + Math.random().toString(36).substr(2, 9);
		const key = `${elementId}_${eventType}_${handlerName || "anonymous"}`;

		// Bestehenden Handler entfernen, falls vorhanden
		if (this.registeredHandlers.has(key)) {
			const oldHandler = this.registeredHandlers.get(key);
			element.removeEventListener(eventType, oldHandler);
			console.log(`🔄 Handler ersetzt: ${key}`);
		}

		// Neuen Handler registrieren
		element.addEventListener(eventType, handler);
		this.registeredHandlers.set(key, handler);

		console.log(`✅ Event-Handler sicher registriert: ${key}`);
		return true;
	}

	/**
	 * ZENTRALISIERTE LOCALSTORAGE-OPERATIONEN
	 * Verhindert Race Conditions durch Queueing
	 */
	async saveToStorage(key, data, priority = "normal") {
		return new Promise((resolve, reject) => {
			const operation = {
				type: "save",
				key,
				data,
				priority,
				resolve,
				reject,
				timestamp: Date.now(),
			};

			if (priority === "high") {
				this.storageQueue.unshift(operation);
			} else {
				this.storageQueue.push(operation);
			}

			this.processStorageQueue();
		});
	}

	async loadFromStorage(key) {
		return new Promise((resolve, reject) => {
			const operation = {
				type: "load",
				key,
				resolve,
				reject,
				timestamp: Date.now(),
			};

			this.storageQueue.push(operation);
			this.processStorageQueue();
		});
	}

	async processStorageQueue() {
		if (this.isProcessingStorage || this.storageQueue.length === 0) {
			return;
		}

		this.isProcessingStorage = true;

		while (this.storageQueue.length > 0) {
			const operation = this.storageQueue.shift();

			try {
				if (operation.type === "save") {
					localStorage.setItem(operation.key, JSON.stringify(operation.data));
					operation.resolve(true);
				} else if (operation.type === "load") {
					const data = localStorage.getItem(operation.key);
					operation.resolve(data ? JSON.parse(data) : null);
				}
			} catch (error) {
				console.error("localStorage-Operation fehlgeschlagen:", error);
				operation.reject(error);
			}

			// Kleine Pause zwischen Operationen
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		this.isProcessingStorage = false;
	}

	/**
	 * DEBOUNCED FIELD UPDATES
	 * Verhindert zu häufige localStorage-Updates
	 */
	debouncedFieldUpdate(fieldId, value, delay = 500) {
		// Bestehenden Timer löschen
		if (this.debounceTimers.has(fieldId)) {
			clearTimeout(this.debounceTimers.get(fieldId));
		}

		// Neuen Timer setzen
		const timer = setTimeout(async () => {
			await this.updateFieldInStorage(fieldId, value);
			this.debounceTimers.delete(fieldId);
		}, delay);

		this.debounceTimers.set(fieldId, timer);
	}

	async updateFieldInStorage(fieldId, value) {
		try {
			const existing = (await this.loadFromStorage("hangarPlannerData")) || {};
			existing[fieldId] = value;
			existing.lastModified = new Date().toISOString();

			await this.saveToStorage("hangarPlannerData", existing);
			console.log(`💾 Feld gespeichert: ${fieldId} = "${value}"`);
		} catch (error) {
			console.error("Fehler beim Speichern von Feld:", fieldId, error);
		}
	}

	/**
	 * API-AUFRUF-KONSOLIDIERUNG
	 * Alle API-Aufrufe über zentrale Fassade
	 */
	async callAPI(method, params = {}) {
		if (window.FlightDataAPI && window.FlightDataAPI[method]) {
			return await window.FlightDataAPI[method](params);
		} else {
			throw new Error(`API-Methode ${method} nicht verfügbar`);
		}
	}

	/**
	 * INITIALIZATION & CLEANUP
	 */
	init() {
		if (this.initialized) {
			console.log("⚠️ Event-Manager bereits initialisiert");
			return;
		}

		console.log("🔧 Initialisiere verbesserten Event-Manager...");

		// Bestehende Event-Handler bereinigen
		this.cleanupExistingHandlers();

		// Neue Handler registrieren
		this.setupUnifiedEventHandlers();

		this.initialized = true;
		console.log("✅ Verbesserter Event-Manager initialisiert");
	}

	cleanupExistingHandlers() {
		// Alle registrierten Handler entfernen
		this.registeredHandlers.forEach((handler, key) => {
			const [elementId, eventType] = key.split("_");
			const element = document.getElementById(elementId);
			if (element) {
				element.removeEventListener(eventType, handler);
			}
		});

		this.registeredHandlers.clear();
		console.log("🧹 Bestehende Event-Handler bereinigt");
	}

	setupUnifiedEventHandlers() {
		// Unified Input Handler für alle relevanten Felder
		document
			.querySelectorAll(
				'input[id^="aircraft-"], input[id^="arrival-time-"], input[id^="departure-time-"], input[id^="position-"], textarea[id^="notes-"]'
			)
			.forEach((element) => {
				this.safeAddEventListener(
					element,
					"input",
					(event) => {
						this.debouncedFieldUpdate(event.target.id, event.target.value);
					},
					"unifiedInput"
				);

				this.safeAddEventListener(
					element,
					"blur",
					(event) => {
						this.debouncedFieldUpdate(event.target.id, event.target.value, 100); // Schnelleres Speichern bei Blur
					},
					"unifiedBlur"
				);
			});

		console.log("🔗 Unified Event-Handler eingerichtet");
	}

	/**
	 * DEBUGGING & MONITORING
	 */
	getStatus() {
		return {
			initialized: this.initialized,
			registeredHandlers: this.registeredHandlers.size,
			storageQueueLength: this.storageQueue.length,
			activeDebounceTimers: this.debounceTimers.size,
			isProcessingStorage: this.isProcessingStorage,
		};
	}

	destroy() {
		this.cleanupExistingHandlers();
		this.debounceTimers.forEach((timer) => clearTimeout(timer));
		this.debounceTimers.clear();
		this.storageQueue.length = 0;
		this.initialized = false;

		console.log("🗑️ Event-Manager zerstört und bereinigt");
	}
}

// Globale Instanz erstellen
window.hangarEventManager = new HangarEventManager();

// Auto-Initialization
document.addEventListener("DOMContentLoaded", () => {
	setTimeout(() => {
		window.hangarEventManager.init();
	}, 1000); // Verzögerung um sicherzustellen, dass andere Module geladen sind
});

// Für Debugging
window.getEventManagerStatus = () => window.hangarEventManager.getStatus();

console.log("🚀 Verbesserter Event-Manager geladen (v2.0)");
