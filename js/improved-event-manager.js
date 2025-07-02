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
			// 1. Lokale Speicherung
			const existing = (await this.loadFromStorage("hangarPlannerData")) || {};
			existing[fieldId] = value;
			existing.lastModified = new Date().toISOString();

			await this.saveToStorage("hangarPlannerData", existing);
			console.log(`💾 Feld lokal gespeichert: ${fieldId} = "${value}"`);

			// 2. DIREKTE Server-Synchronisation
			await this.syncFieldToServer(fieldId, value);
		} catch (error) {
			console.error("Fehler beim Speichern von Feld:", fieldId, error);
		}
	}

	/**
	 * NEUE FUNKTION: Direkte Server-Synchronisation für einzelne Felder
	 */
	async syncFieldToServer(fieldId, value) {
		try {
			// Prüfe ob Server-Sync verfügbar ist
			if (!window.storageBrowser || !window.storageBrowser.serverSyncUrl) {
				console.log(
					"⚠️ Server-Sync nicht konfiguriert - nur lokale Speicherung"
				);
				return;
			}

			// WICHTIG: Sammle ALLE aktuellen Daten für vollständige Server-Synchronisation
			let allData = null;
			if (
				window.hangarData &&
				typeof window.hangarData.collectAllHangarData === "function"
			) {
				allData = window.hangarData.collectAllHangarData();
				console.log(
					"📊 Vollständige Daten für Server-Sync gesammelt:",
					allData
				);
			} else {
				// Fallback: Erweiterte Datensammlung
				allData = {
					metadata: {
						lastModified: new Date().toISOString(),
						projectName:
							document.getElementById("projectName")?.value || "HangarPlan",
						syncTriggeredBy: fieldId,
					},
					settings: {
						tilesCount:
							parseInt(document.getElementById("tilesCount")?.value) || 8,
						secondaryTilesCount:
							parseInt(document.getElementById("secondaryTilesCount")?.value) ||
							0,
						layout: parseInt(document.getElementById("layoutType")?.value) || 4,
					},
					fieldUpdates: {
						[fieldId]: value,
					},
					// Sammle alle aktuell sichtbaren Felder
					currentFields: this.collectAllVisibleFields(),
				};
				console.log("📊 Fallback-Daten für Server-Sync gesammelt:", allData);
			}

			// Server-Request mit allen Daten
			const response = await fetch(window.storageBrowser.serverSyncUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(allData),
			});

			if (response.ok) {
				const result = await response.json();
				console.log(
					`✅ Server-Sync erfolgreich: ${fieldId} = "${value}"`,
					result
				);
			} else {
				console.warn(
					`⚠️ Server-Sync fehlgeschlagen für ${fieldId}:`,
					response.status,
					await response.text()
				);
			}
		} catch (error) {
			console.error(`❌ Server-Sync Fehler für ${fieldId}:`, error);
		}
	}

	/**
	 * NEUE HILFSFUNKTION: Sammelt alle sichtbaren Feldwerte
	 */
	collectAllVisibleFields() {
		const fields = {};

		// Alle relevanten Felder durchgehen
		const selectors = [
			'input[id^="aircraft-"]',
			'input[id^="arrival-time-"]',
			'input[id^="departure-time-"]',
			'input[id^="position-"]',
			'input[id^="hangar-position-"]',
			'textarea[id^="notes-"]',
			'select[id^="status-"]',
			'select[id^="tow-status-"]',
		];

		selectors.forEach((selector) => {
			document.querySelectorAll(selector).forEach((element) => {
				if (element.id && element.value !== undefined) {
					fields[element.id] = element.value;
				}
			});
		});

		console.log(
			"🔍 Alle sichtbaren Felder gesammelt:",
			Object.keys(fields).length,
			"Felder"
		);
		return fields;
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
		// ERWEITERTE Unified Input Handler für ALLE relevanten Felder
		const relevantSelectors = [
			'input[id^="aircraft-"]', // Aircraft ID Felder
			'input[id^="arrival-time-"]', // Ankunftszeit Felder
			'input[id^="departure-time-"]', // Abflugzeit Felder
			'input[id^="position-"]', // Position Felder
			'input[id^="hangar-position-"]', // Hangar Position Felder (alternative IDs)
			'textarea[id^="notes-"]', // Notizen Felder
			'select[id^="status-"]', // Status Dropdowns
			'select[id^="tow-status-"]', // Tow Status Dropdowns
			'input[type="text"][class*="aircraft"]', // Felder mit aircraft CSS-Klasse
			'input[type="text"][class*="position"]', // Felder mit position CSS-Klasse
			'textarea[class*="notes"]', // Notiz-Textareas mit CSS-Klasse
		];

		// Event-Handler für alle relevanten Felder registrieren
		relevantSelectors.forEach((selector) => {
			document.querySelectorAll(selector).forEach((element) => {
				// Input Event (während der Eingabe)
				this.safeAddEventListener(
					element,
					"input",
					(event) => {
						console.log(
							`📝 Input Event: ${event.target.id} = "${event.target.value}"`
						);
						this.debouncedFieldUpdate(event.target.id, event.target.value);
					},
					"unifiedInput"
				);

				// Blur Event (wenn Feld verlassen wird)
				this.safeAddEventListener(
					element,
					"blur",
					(event) => {
						console.log(
							`👁️ Blur Event: ${event.target.id} = "${event.target.value}"`
						);
						this.debouncedFieldUpdate(event.target.id, event.target.value, 100); // Schnelleres Speichern bei Blur
					},
					"unifiedBlur"
				);

				// Change Event (für Dropdowns)
				this.safeAddEventListener(
					element,
					"change",
					(event) => {
						console.log(
							`🔄 Change Event: ${event.target.id} = "${event.target.value}"`
						);
						this.debouncedFieldUpdate(event.target.id, event.target.value, 50); // Sofortiges Speichern bei Change
					},
					"unifiedChange"
				);
			});
		});

		console.log(
			"🔗 ERWEITERTE Unified Event-Handler eingerichtet für alle Felder"
		);

		// Zusätzlich: MutationObserver für dynamisch hinzugefügte Felder
		this.setupMutationObserver();
	}

	/**
	 * NEUE FUNKTION: MutationObserver für dynamisch hinzugefügte Felder
	 */
	setupMutationObserver() {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// Prüfe auf neue Input-Felder
						const newInputs = node.querySelectorAll
							? node.querySelectorAll("input, textarea, select")
							: [];

						newInputs.forEach((input) => {
							if (this.isRelevantField(input)) {
								console.log(`🆕 Neues Feld erkannt: ${input.id}`);
								this.attachEventHandlersToElement(input);
							}
						});
					}
				});
			});
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		console.log("👀 MutationObserver eingerichtet für dynamische Felder");
	}

	/**
	 * Prüft ob ein Feld für Event-Handling relevant ist
	 */
	isRelevantField(element) {
		const id = element.id;
		const className = element.className;

		return (
			id.startsWith("aircraft-") ||
			id.startsWith("arrival-time-") ||
			id.startsWith("departure-time-") ||
			id.startsWith("position-") ||
			id.startsWith("hangar-position-") ||
			id.startsWith("notes-") ||
			id.startsWith("status-") ||
			id.startsWith("tow-status-") ||
			className.includes("aircraft") ||
			className.includes("position") ||
			className.includes("notes")
		);
	}

	/**
	 * Hängt Event-Handler an ein einzelnes Element an
	 */
	attachEventHandlersToElement(element) {
		this.safeAddEventListener(
			element,
			"input",
			(event) => {
				this.debouncedFieldUpdate(event.target.id, event.target.value);
			},
			"dynamicInput"
		);

		this.safeAddEventListener(
			element,
			"blur",
			(event) => {
				this.debouncedFieldUpdate(event.target.id, event.target.value, 100);
			},
			"dynamicBlur"
		);

		this.safeAddEventListener(
			element,
			"change",
			(event) => {
				this.debouncedFieldUpdate(event.target.id, event.target.value, 50);
			},
			"dynamicChange"
		);
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
