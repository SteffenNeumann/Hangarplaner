/**
 * helpers.js
 * Enthält allgemeine Hilfsfunktionen für die HangarPlanner-Anwendung
 */

/**
 * Zeigt Benachrichtigungen für den Benutzer an
 * @param {string} message - Die anzuzeigende Nachricht
 * @param {string} type - Der Typ der Nachricht (info, success, error, warning)
 * @param {number} duration - Wie lange die Nachricht angezeigt wird (in ms)
 */
function showNotification(message, type = "info", duration = 3000) {
	// Prüfe, ob bereits eine Benachrichtigung angezeigt wird
	let notification = document.getElementById("notification");
	if (!notification) {
		notification = document.createElement("div");
		notification.id = "notification";
		notification.style.position = "fixed";
		notification.style.bottom = "20px";
		notification.style.right = "20px";
		notification.style.padding = "10px 20px";
		notification.style.borderRadius = "4px";
		notification.style.minWidth = "200px";
		notification.style.maxWidth = "400px";
		notification.style.boxShadow = "0 3px 6px rgba(0,0,0,0.16)";
		notification.style.zIndex = "9999";
		notification.style.transition = "opacity 0.3s";
		document.body.appendChild(notification);
	}

	// Stil basierend auf Typ setzen
	switch (type) {
		case "success":
			notification.style.backgroundColor = "#4CAF50";
			notification.style.color = "#fff";
			break;
		case "error":
			notification.style.backgroundColor = "#F44336";
			notification.style.color = "#fff";
			break;
		case "warning":
			notification.style.backgroundColor = "#FFC107";
			notification.style.color = "#000";
			break;
		default:
			notification.style.backgroundColor = "#2196F3";
			notification.style.color = "#fff";
	}

	notification.textContent = message;
	notification.style.opacity = "1";

	// Nach der angegebenen Zeit ausblenden
	setTimeout(() => {
		notification.style.opacity = "0";
		setTimeout(() => {
			if (notification.parentNode) {
				notification.parentNode.removeChild(notification);
			}
		}, 300);
	}, duration);
}

/**
 * Erstellt einen Zeitstempel für die Benennung von Dateien
 * @returns {string} Formatierter Zeitstempel
 */
function generateTimestamp() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");

	return `HangarPlan_${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * Hilfsfunktion zum Herunterladen einer Datei
 * @param {string|object} content - Dateiinhalt (wird zu JSON konvertiert, wenn es ein Objekt ist)
 * @param {string} filename - Name der Datei
 */
function downloadFile(content, filename) {
	const contentStr =
		typeof content === "object" ? JSON.stringify(content, null, 2) : content;
	const blob = new Blob([contentStr], { type: "application/json" });
	const downloadLink = document.createElement("a");
	downloadLink.href = URL.createObjectURL(blob);
	downloadLink.download = filename;
	document.body.appendChild(downloadLink);
	downloadLink.click();
	document.body.removeChild(downloadLink);
}

/**
 * Überprüft die Browser-Unterstützung für verschiedene APIs
 * @returns {Object} Ein Objekt mit Informationen über unterstützte Features
 */
function checkBrowserSupport() {
	const support = {
		fileSystem: "showSaveFilePicker" in window,
		indexedDB: "indexedDB" in window,
		localStorage: "localStorage" in window,
		permissions: "permissions" in navigator,
	};

	// Browser-API-Unterstützung prüfen

	// Als Meldung anzeigen, wenn Debug aktiviert ist
	if (localStorage.getItem("debugMode") === "true") {
		let message = "Browser-Unterstützung:\n";
		for (const [key, value] of Object.entries(support)) {
			message += `- ${key}: ${value ? "✓" : "✗"}\n`;
		}
		showNotification(message, "info", 5000);

		// Explizit auf localStorage-Unterstützung prüfen
		if (!support.localStorage) {
			showNotification(
				"LocalStorage wird nicht unterstützt! Einstellungen können nicht gespeichert werden.",
				"error",
				10000
			);
		} else {
			// Test-Speichervorgang durchführen
			try {
				localStorage.setItem("test", "test");
				localStorage.removeItem("test");
			} catch (e) {
				showNotification(
					"LocalStorage Test fehlgeschlagen: " + e.message,
					"error",
					10000
				);
			}
		}
	}

	return support;
}

// Funktion für den globalen Zugriff verfügbar machen
window.showNotification = showNotification;

/**
 * Storage Helper für localStorage Operationen
 * Bietet eine einheitliche Schnittstelle für Speicherzugriffe
 */
const storageHelper = {
	/**
	 * Speichert Daten im localStorage
	 * @param {string} key - Schlüssel für die Daten
	 * @param {any} data - Die zu speichernden Daten (werden zu JSON konvertiert)
	 * @returns {boolean} - Gibt an, ob die Speicherung erfolgreich war
	 */
	set: function (key, data) {
		try {
			const jsonData = typeof data === "string" ? data : JSON.stringify(data);
			localStorage.setItem(key, jsonData);
			return true;
		} catch (error) {
			console.error(
				`Fehler beim Speichern von Daten mit Schlüssel "${key}":`,
				error
			);
			return false;
		}
	},

	/**
	 * Lädt Daten aus dem localStorage
	 * @param {string} key - Schlüssel für die Daten
	 * @param {boolean} parseJson - Ob die Daten als JSON geparst werden sollen
	 * @returns {any} - Die geladenen Daten oder null, wenn keine Daten vorhanden
	 */
	get: function (key, parseJson = true) {
		try {
			const data = localStorage.getItem(key);
			if (data === null) return null;
			return parseJson ? JSON.parse(data) : data;
		} catch (error) {
			console.error(
				`Fehler beim Laden von Daten mit Schlüssel "${key}":`,
				error
			);
			return null;
		}
	},

	/**
	 * Löscht Daten aus dem localStorage
	 * @param {string} key - Schlüssel für die zu löschenden Daten
	 * @returns {boolean} - Gibt an, ob das Löschen erfolgreich war
	 */
	remove: function (key) {
		try {
			localStorage.removeItem(key);
			return true;
		} catch (error) {
			console.error(
				`Fehler beim Löschen von Daten mit Schlüssel "${key}":`,
				error
			);
			return false;
		}
	},
};

// Storage Helper zum globalen Hilfsobjekt hinzufügen
window.helpers = window.helpers || {};
window.helpers.storageHelper = storageHelper;

/**
 * Verzögert die Ausführung einer Funktion
 * @param {Function} func - Die zu verzögernde Funktion
 * @param {number} wait - Verzögerung in Millisekunden
 * @returns {Function} - Verzögerte Funktion
 */
function debounce(func, wait) {
	let timeout;
	return function () {
		const context = this;
		const args = arguments;
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(context, args), wait);
	};
}

/**
 * Erstellt eine Auto-Save-Funktion mit Debouncing und Änderungsverfolgung
 * @param {Function} saveFunction - Die eigentliche Speicherfunktion
 * @param {Object} options - Konfigurationsoptionen
 * @param {number} options.debounceTime - Verzögerungszeit in ms (Standard: 1000)
 * @param {number} options.maxRetries - Maximale Anzahl von Wiederholungsversuchen (Standard: 3)
 * @param {Function} options.onChange - Optional: Callback-Funktion, die bei Änderungen aufgerufen wird
 * @param {Function} options.compareFunction - Optional: Funktion zum Vergleich von altem und neuem Zustand
 * @param {boolean} options.preserveExisting - Bestehende Daten erhalten und nur neue Felder hinzufügen (Standard: true)
 * @param {boolean} options.forceSyncSave - Erzwingt eine sofortige synchrone Speicherung, ohne Debouncing (Standard: false)
 * @returns {Function} - Eine optimierte Autosave-Funktion
 */
function createAutoSave(saveFunction, options = {}) {
	const {
		debounceTime = 1000,
		maxRetries = 3,
		onChange = null,
		compareFunction = null,
		preserveExisting = true,
		forceSyncSave = false,
	} = options;

	let lastSavedData = null;
	let saveRetryCount = 0;
	let savePending = false;
	let saveQueue = [];

	// Funktion, um die nächste ausstehende Speicherung zu verarbeiten
	const processQueue = () => {
		if (saveQueue.length > 0 && !savePending) {
			const nextData = saveQueue.shift();
			executeSave(nextData);
		}
	};

	/**
	 * Prüft, ob ein Teil der Daten Positionswerte enthält, die spezielle Behandlung benötigen
	 * @param {Object} data - Die zu prüfenden Daten
	 * @returns {boolean} - True, wenn Positionsdaten enthalten sind
	 */
	const hasPositionData = (data) => {
		if (!data || typeof data !== "object") return false;

		// Prüfe auf typische Strukturen von Positionsdaten
		if (data.tileValues && Array.isArray(data.tileValues)) {
			return true;
		}

		// Prüfe auf sekundäre Kacheln mit Positionsangaben
		if (
			Array.isArray(data) &&
			data.some(
				(item) => item && item.position && item.id >= 101 && item.id <= 104
			)
		) {
			return true;
		}

		// Prüfe auf einzelne Positionsfelder
		if (data.position && data.id && data.id >= 101 && data.id <= 104) {
			return true;
		}

		return false;
	};

	/**
	 * Versucht, Positionswerte für sekundäre Kacheln zu setzen
	 * @param {Object} data - Die zu speichernden Daten
	 * @returns {Promise<boolean>} - True, wenn die Werte gesetzt wurden
	 */
	const trySetPositionValues = async (data) => {
		// Extrahiere Positionsdaten, falls vorhanden
		const positions = extractPositions(data);
		if (Object.keys(positions).length === 0) return true;

		// Warten bis DOM bereit ist
		await new Promise((resolve) => {
			// Versuche, die Positionsfelder zu finden und Werte zu setzen
			const maxAttempts = 5;
			let attempts = 0;

			const trySetValues = () => {
				attempts++;
				let allSet = true;

				// Versuche jeden Positionswert zu setzen
				for (const [id, value] of Object.entries(positions)) {
					const fieldId = `hangar-position-${id}`;
					const field = document.getElementById(fieldId);

					if (field) {
						field.value = value;
					} else {
						if (attempts === maxAttempts) {
							console.warn(
								`Position für Kachel ${id} konnte nicht gesetzt werden - Feld nicht gefunden`
							);
						}
						allSet = false;
					}
				}

				if (allSet || attempts >= maxAttempts) {
					resolve(allSet);
				} else {
					setTimeout(trySetValues, 300 * attempts);
				}
			};

			trySetValues();
		});

		return true;
	};

	/**
	 * Extrahiert Positionsdaten aus verschiedenen Datenformaten
	 * @param {Object} data - Die zu analysierenden Daten
	 * @returns {Object} - Gefundene Positionsdaten als {id: wert}
	 */
	const extractPositions = (data) => {
		const positions = {};

		if (!data || typeof data !== "object") return positions;

		// Extrahiere aus tileValues Array
		if (data.tileValues && Array.isArray(data.tileValues)) {
			for (const tile of data.tileValues) {
				if (
					tile &&
					tile.id &&
					tile.position &&
					tile.id >= 101 &&
					tile.id <= 104
				) {
					positions[tile.id] = tile.position;
				}
			}
		}

		// Extrahiere aus einem Array von Tiles
		if (Array.isArray(data)) {
			for (const tile of data) {
				if (
					tile &&
					tile.id &&
					tile.position &&
					tile.id >= 101 &&
					tile.id <= 104
				) {
					positions[tile.id] = tile.position;
				}
			}
		}

		// Extrahiere aus einem einzelnen Tile
		if (data.id && data.position && data.id >= 101 && data.id <= 104) {
			positions[data.id] = data.position;
		}

		return positions;
	};

	// Hauptspeicherfunktion
	const executeSave = async (data) => {
		// Wenn keine Änderungen vorliegen, nicht speichern
		if (compareFunction && lastSavedData !== null) {
			if (!compareFunction(lastSavedData, data)) {
				savePending = false;
				processQueue(); // Verarbeite die nächste Speicherung, falls vorhanden
				return;
			}
		}

		savePending = true;

		// Prüfe, ob Positionsdaten enthalten sind
		const containsPositionData = hasPositionData(data);

		try {
			// Bei Positionsdaten: Versuche zuerst, die Werte in die Felder zu schreiben
			if (containsPositionData) {
				await trySetPositionValues(data);
			}

			// Führe dann die eigentliche Speicherfunktion aus
			await saveFunction(data);
			lastSavedData = JSON.parse(JSON.stringify(data)); // Deep copy
			saveRetryCount = 0;
			savePending = false;

			// Verarbeite die nächste Speicherung, falls vorhanden
			processQueue();
		} catch (error) {
			console.error("Fehler beim automatischen Speichern:", error);

			// Wiederholungsversuch, wenn maximale Anzahl nicht erreicht
			if (saveRetryCount < maxRetries) {
				saveRetryCount++;
				setTimeout(() => executeSave(data), saveRetryCount * 1000);
			} else {
				saveRetryCount = 0;
				savePending = false;
				showNotification(
					"Automatisches Speichern fehlgeschlagen. Bitte manuell speichern.",
					"error",
					5000
				);
				// Verarbeite trotzdem die nächste Speicherung
				processQueue();
			}
		}
	};

	// Debounce-Wrapper für die Speicherfunktion
	const debouncedSave = debounce((data) => {
		if (savePending) {
			// Wenn bereits eine Speicherung läuft, füge die Daten zur Warteschlange hinzu
			saveQueue.push(data);
		} else {
			executeSave(data);
		}
	}, debounceTime);

	// Die zurückgegebene Funktion
	return function (data, key = null, forceSync = false) {
		// Optional: Callback bei Änderungen aufrufen
		if (onChange) {
			onChange(data, key);
		}

		let dataToSave;

		// Bestehende Daten erhalten, wenn Option gesetzt
		if (
			preserveExisting &&
			typeof data === "object" &&
			data !== null &&
			lastSavedData !== null
		) {
			// Tiefe Kopie von bestehenden Daten erstellen
			dataToSave = JSON.parse(JSON.stringify(lastSavedData));

			// Neuen Daten hinzufügen oder aktualisieren
			Object.keys(data).forEach((key) => {
				dataToSave[key] = data[key];
			});
		} else {
			// Neues Datenobjekt erstellen
			dataToSave =
				typeof data === "object" && data !== null ? { ...data } : data;
		}

		// Zeitstempel für letzte Änderung hinzufügen
		if (typeof dataToSave === "object" && dataToSave !== null) {
			dataToSave.lastSaved = new Date().toISOString();
		}

		// Entscheide, ob synchron oder mit Verzögerung gespeichert werden soll
		if (forceSync || forceSyncSave) {
			executeSave(dataToSave);
		} else {
			debouncedSave(dataToSave);
		}
	};
}

/**
 * Stellt eine optimierte Version der localStorage API bereit
 * @type {Object}
 */
const storageHelperExtended = {
	/**
	 * Speichert Daten im localStorage mit Fehlerbehandlung
	 * @param {string} key - Der Schlüssel unter dem gespeichert wird
	 * @param {any} value - Der zu speichernde Wert (wird zu JSON serialisiert)
	 * @param {boolean} merge - Ob bestehende Daten zusammengeführt werden sollen
	 * @returns {boolean} - Erfolg der Operation
	 */
	set(key, value, merge = false) {
		try {
			// Wenn merge aktiviert ist, bestehende Daten laden und zusammenführen
			if (merge) {
				const existingData = this.get(key, {});

				// Bei Arrays, verwende Concat
				if (Array.isArray(value) && Array.isArray(existingData)) {
					value = [...existingData, ...value];
				}
				// Bei Objekten, führe Eigenschaften zusammen
				else if (
					typeof value === "object" &&
					value !== null &&
					typeof existingData === "object" &&
					existingData !== null
				) {
					value = { ...existingData, ...value };
				}
			}

			localStorage.setItem(key, JSON.stringify(value));
			return true;
		} catch (e) {
			console.error("Fehler beim Speichern im localStorage:", e, {
				key,
				value,
			});
			if (e.name === "QuotaExceededError") {
				showNotification(
					"Speicherplatz erschöpft. Bitte einige Daten exportieren und löschen.",
					"error",
					5000
				);
			}
			return false;
		}
	},

	/**
	 * Liest Daten aus dem localStorage mit Fehlerbehandlung
	 * @param {string} key - Der zu lesende Schlüssel
	 * @param {any} defaultValue - Standardwert, falls der Schlüssel nicht existiert
	 * @returns {any} - Der gelesene Wert oder der Standardwert
	 */
	get(key, defaultValue = null) {
		try {
			const item = localStorage.getItem(key);
			const value = item ? JSON.parse(item) : defaultValue;

			return value;
		} catch (e) {
			console.error("Fehler beim Lesen aus localStorage:", e, { key });
			return defaultValue;
		}
	},

	/**
	 * Speichert Daten für sekundäre Kacheln
	 * @param {Array} tiles - Array mit Kacheldaten
	 * @param {string} key - Der Schlüssel unter dem gespeichert wird (Standard: 'uiSettings')
	 * @returns {boolean} - Erfolg der Operation
	 */
	saveSecondaryTiles(tiles, key = "uiSettings") {
		try {
			if (!Array.isArray(tiles)) {
				console.error("Fehler: tiles muss ein Array sein");
				return false;
			}

			// Aktuellen UI-Status holen, falls vorhanden
			const uiSettings = this.get(key, {
				tilesCount: 8,
				secondaryTilesCount: 4,
				layout: 4,
				tileValues: [],
			});

			// Sekundäre Kacheln aktualisieren
			uiSettings.secondaryTilesCount = tiles.length;

			// Stelle sicher, dass tileValues existiert und die richtige Größe hat
			if (!uiSettings.tileValues) {
				uiSettings.tileValues = [];
			}

			// Erstelle eine vollständige Kopie des aktuellen tileValues-Arrays
			const allTilesData = Array.isArray(uiSettings.tileValues)
				? [...uiSettings.tileValues]
				: [];

			// Füge sekundäre Kacheldaten hinzu oder aktualisiere sie
			tiles.forEach((tile, index) => {
				if (!tile) return;

				const tileIndex = uiSettings.tilesCount + index;
				const tileId = 100 + index + 1; // IDs für sekundäre Kacheln beginnen bei 101

				// Stelle sicher, dass der Index im Array existiert
				while (allTilesData.length <= tileIndex) {
					allTilesData.push(null);
				}

				// Bewahre vorhandene Daten, falls vorhanden
				const existingTile = allTilesData[tileIndex] || {};

				// Stelle sicher, dass die Datenstruktur konsistent ist
				allTilesData[tileIndex] = {
					...existingTile,
					...tile,
					id: tileId,
					position: tile.position || existingTile.position || "",
					data: tile.data || existingTile.data || {},
				};
			});

			// Aktualisiere das vollständige tileValues-Array
			uiSettings.tileValues = allTilesData;

			// In localStorage speichern
			const success = this.set(key, uiSettings);

			if (!success) {
				console.error(
					"Fehler beim Speichern der sekundären Kacheln im localStorage"
				);
			}

			return success;
		} catch (e) {
			console.error("Fehler beim Speichern der sekundären Kacheln:", e);
			return false;
		}
	},

	/**
	 * Lädt Daten für sekundäre Kacheln
	 * @param {string} key - Der Schlüssel aus dem geladen wird (Standard: 'uiSettings')
	 * @returns {Array|null} - Array mit Kacheldaten oder leeres Array bei Fehler
	 */
	loadSecondaryTiles(key = "uiSettings") {
		try {
			const uiSettings = this.get(key);

			if (
				!uiSettings ||
				!uiSettings.tileValues ||
				!Array.isArray(uiSettings.tileValues)
			) {
				console.log("Keine sekundären Kacheln zum Laden gefunden");
				return [];
			}

			const primaryCount = uiSettings.tilesCount || 8;
			const secondaryCount = uiSettings.secondaryTilesCount || 4;

			// Sekundäre Kacheln aus tileValues extrahieren
			const secondaryTiles = uiSettings.tileValues
				.slice(primaryCount, primaryCount + secondaryCount)
				.filter((tile) => tile !== null && tile !== undefined);

			console.log(`${secondaryTiles.length} sekundäre Kacheln geladen`);

			if (localStorage.getItem("debugMode") === "true") {
				console.log("Geladene sekundäre Kacheln:", secondaryTiles);
			}

			return secondaryTiles;
		} catch (e) {
			console.error("Fehler beim Laden der sekundären Kacheln:", e);
			return [];
		}
	},

	/**
	 * Prüft und repariert die Datenstruktur für UI-Einstellungen
	 * @param {string} key - Der Schlüssel der zu prüfenden Daten (Standard: 'uiSettings')
	 * @returns {boolean} - Erfolg der Operation
	 */
	validateUISettings(key = "uiSettings") {
		try {
			const uiSettings = this.get(key);

			if (!uiSettings) {
				console.log("Keine UI-Einstellungen gefunden, nichts zu validieren");
				return true;
			}

			let isModified = false;

			// Standard-Werte sicherstellen
			if (typeof uiSettings.tilesCount !== "number") {
				uiSettings.tilesCount = 8;
				isModified = true;
			}

			if (typeof uiSettings.secondaryTilesCount !== "number") {
				uiSettings.secondaryTilesCount = 4;
				isModified = true;
			}

			if (typeof uiSettings.layout !== "number") {
				uiSettings.layout = 4;
				isModified = true;
			}

			// tileValues-Array prüfen und reparieren
			if (!Array.isArray(uiSettings.tileValues)) {
				uiSettings.tileValues = [];
				isModified = true;
			}

			// Stelle sicher, dass das Array groß genug ist
			const requiredLength =
				uiSettings.tilesCount + uiSettings.secondaryTilesCount;
			if (uiSettings.tileValues.length < requiredLength) {
				while (uiSettings.tileValues.length < requiredLength) {
					uiSettings.tileValues.push(null);
				}
				isModified = true;
			}

			// Sicherstellen, dass alle sekundären Kacheln eine gültige ID haben
			for (let i = uiSettings.tilesCount; i < requiredLength; i++) {
				if (uiSettings.tileValues[i]) {
					const secondaryIndex = i - uiSettings.tilesCount;
					const expectedId = 100 + secondaryIndex + 1;

					if (uiSettings.tileValues[i].id !== expectedId) {
						uiSettings.tileValues[i].id = expectedId;
						isModified = true;
					}
				}
			}

			// Speichern, wenn Änderungen vorgenommen wurden
			if (isModified) {
				return this.set(key, uiSettings);
			}

			return true;
		} catch (e) {
			console.error("Fehler bei der Validierung der UI-Einstellungen:", e);
			return false;
		}
	},

	/**
	 * Warten auf die Verfügbarkeit eines DOM-Elements mit wiederholten Versuchen
	 * @param {string} selector - CSS-Selektor, nach dem gesucht wird
	 * @param {number} maxAttempts - Maximale Anzahl von Versuchen (Standard: 10)
	 * @param {number} interval - Zeitabstand zwischen den Versuchen in ms (Standard: 200)
	 * @returns {Promise<Element|null>} - Promise mit dem gefundenen Element oder null
	 */
	waitForElement(selector, maxAttempts = 10, interval = 200) {
		return new Promise((resolve) => {
			let attempts = 0;

			const checkElement = () => {
				attempts++;
				const element = document.querySelector(selector);

				if (element) {
					return resolve(element);
				}

				if (attempts >= maxAttempts) {
					console.warn(
						`Element mit Selektor "${selector}" wurde nach ${maxAttempts} Versuchen nicht gefunden`
					);
					return resolve(null);
				}

				setTimeout(checkElement, interval);
			};

			checkElement();
		});
	},

	/**
	 * Initialisiert ein Ereignis, wenn alle Felder einer bestimmten Klasse verfügbar sind
	 * @param {string} className - Klassenname der zu überwachenden Felder
	 * @param {Function} callback - Funktion, die aufgerufen wird, wenn alle Felder bereit sind
	 * @param {number} timeout - Maximale Wartezeit in ms (Standard: 5000)
	 * @param {Object} options - Zusätzliche Optionen
	 */
	whenFieldsReady(className, callback, timeout = 5000, options = {}) {
		const {
			checkInterval = 500,
			alternativeSelectors = [],
			onTimeout = null,
			minElements = 1,
		} = options;

		// Suche nach Elementen über verschiedene Selektoren
		const findElements = () => {
			let elements = document.getElementsByClassName(className);

			if (elements.length >= minElements) {
				return elements;
			}

			// Versuche alternative Selektoren
			for (const selector of alternativeSelectors) {
				const altElements = document.querySelectorAll(selector);
				if (altElements.length >= minElements) {
					return altElements;
				}
			}

			return null;
		};

		// Überprüfe zuerst, ob die Elemente bereits existieren
		const existingElements = findElements();
		if (existingElements) {
			console.log(
				`${existingElements.length} Elemente mit Klasse '${className}' direkt gefunden`
			);
			setTimeout(() => callback(existingElements), 50);
			return;
		}

		// MutationObserver für DOM-Änderungen einrichten
		const observer = new MutationObserver((mutations, observer) => {
			const elements = findElements();
			if (elements && elements.length >= minElements) {
				// Kurze Verzögerung für vollständige Initialisierung
				setTimeout(() => {
					observer.disconnect();
					console.log(
						`${elements.length} Elemente mit Klasse '${className}' durch MutationObserver gefunden`
					);
					callback(elements);
				}, 100);
			}
		});

		// DOM-Änderungen beobachten
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});

		// Regelmäßige Überprüfung als zusätzliche Sicherheit
		const intervalCheck = setInterval(() => {
			const elements = findElements();
			if (elements && elements.length >= minElements) {
				clearInterval(intervalCheck);
				observer.disconnect();
				console.log(
					`${elements.length} Elemente mit Klasse '${className}' durch Interval-Check gefunden`
				);
				callback(elements);
			}
		}, checkInterval);

		// Timeout, falls keine Elemente gefunden werden
		setTimeout(() => {
			observer.disconnect();
			clearInterval(intervalCheck);

			// Letzte Chance zur Überprüfung
			const elements = findElements();
			if (elements && elements.length >= minElements) {
				console.log(
					`${elements.length} Elemente mit Klasse '${className}' durch finalen Check gefunden`
				);
				callback(elements);
			} else {
				console.warn(
					`Keine Elemente mit Klasse '${className}' oder alternativen Selektoren nach ${timeout}ms gefunden`
				);
				if (onTimeout) {
					onTimeout();
				}
			}
		}, timeout);
	},
};

// Zum vorhandenen helpers-Objekt hinzufügen
if (window.helpers) {
	window.helpers.debounce = debounce;
	window.helpers.createAutoSave = createAutoSave;
	window.helpers.storage = storageHelper;
} else {
	window.helpers = {
		debounce,
		createAutoSave,
		storage: storageHelper,
	};
}

// Initialisierung der UI-Verbesserungen NACH der storage-Definition
function initializeUIEnhancements() {
	// Warten bis DOM vollständig geladen ist
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeUIEnhancements);
		return;
	}

	setTimeout(() => {
		// Validiere UI-Einstellungen
		if (
			typeof storageHelper !== "undefined" &&
			storageHelper &&
			typeof storageHelper.validateUISettings === "function"
		) {
			console.log("Validiere UI-Einstellungen...");
			storageHelper.validateUISettings();
		} else {
			console.log(
				"storageHelper noch nicht verfügbar, überspringe UI-Validierung"
			);
		}

		// Event für die Initialisierung der sekundären Kacheln einrichten
		if (
			window.helpers &&
			window.helpers.storage &&
			window.helpers.storage.whenFieldsReady
		) {
			// Verwende erweiterte Konfiguration für die Erkennung
			window.helpers.storage.whenFieldsReady(
				"secondary-tile",
				(elements) => {
					console.log(
						`${elements.length} sekundäre Kacheln im DOM gefunden, initialisiere Positionsfelder...`
					);
					document.dispatchEvent(
						new CustomEvent("secondaryTilesReady", {
							detail: { count: elements.length },
						})
					);
				},
				15000,
				{
					checkInterval: 1000,
					alternativeSelectors: [
						'[data-tile-type="secondary"]',
						".tile-section-secondary .hangar-tile",
						'input[id^="hangar-position-10"]',
					],
					onTimeout: () => {
						// Versuche explizit nach Positionsfeldern zu suchen
						const positionFields = Array.from({ length: 4 }, (_, i) =>
							document.getElementById(`hangar-position-${101 + i}`)
						).filter(Boolean);

						if (positionFields.length > 0) {
							console.log(
								`${positionFields.length} Positionsfelder für sekundäre Kacheln gefunden, obwohl keine sekundären Kacheln erkannt wurden`
							);
							document.dispatchEvent(
								new CustomEvent("secondaryTilesReady", {
									detail: { count: positionFields.length },
								})
							);
						} else {
							console.error(
								"Keine sekundären Kacheln oder Positionsfelder gefunden"
							);
						}
					},
				}
			);

			// Auch auf manuelle Aktualisierungen der sekundären Kacheln lauschen
			document.addEventListener("secondarySectionToggled", (event) => {
				if (event.detail && event.detail.visible) {
					console.log(
						"Sekundäre Sektion wurde sichtbar gemacht, initiiere Überprüfung der Positionsfelder"
					);
					setTimeout(() => {
						const positionFields = Array.from({ length: 4 }, (_, i) =>
							document.getElementById(`hangar-position-${101 + i}`)
						).filter(Boolean);

						if (positionFields.length > 0) {
							console.log(
								`${positionFields.length} Positionsfelder nach Toggle gefunden`
							);
							document.dispatchEvent(
								new CustomEvent("secondaryTilesReady", {
									detail: { count: positionFields.length },
								})
							);
						}
					}, 500);
				}
			});
		} else {
			console.warn(
				"window.helpers.storage.whenFieldsReady nicht verfügbar, verwende Fallback für sekundäre Kacheln"
			);
			// Fallback: Direkte Überprüfung nach kurzer Verzögerung
			setTimeout(() => {
				const secondaryTiles = document.querySelectorAll(".secondary-tile");
				if (secondaryTiles.length > 0) {
					console.log(
						`${secondaryTiles.length} sekundäre Kacheln über Fallback gefunden`
					);
					document.dispatchEvent(
						new CustomEvent("secondaryTilesReady", {
							detail: { count: secondaryTiles.length },
						})
					);
				}
			}, 1000);
		}
	}, 500);
}

// Initialisierung starten
initializeUIEnhancements();

/**
 * Verzögerungsbasierte DOM-Manipulation, sobald ein Element verfügbar ist
 * @param {string} selector - CSS-Selektor zum Finden des Elements
 * @param {Function} callback - Funktion, die mit dem Element aufgerufen wird
 * @param {Object} options - Optionen für die Suche
 */
function whenElementReady(selector, callback, options = {}) {
	const { maxAttempts = 10, interval = 200, errorCallback = null } = options;

	if (window.helpers && window.helpers.storage) {
		window.helpers.storage
			.waitForElement(selector, maxAttempts, interval)
			.then((element) => {
				if (element) {
					callback(element);
				} else if (errorCallback) {
					errorCallback();
				}
			});
	} else {
		// Fallback, wenn helpers nicht verfügbar
		let attempts = 0;

		const checkElement = () => {
			attempts++;
			const element = document.querySelector(selector);

			if (element) {
				callback(element);
				return;
			}

			if (attempts >= maxAttempts) {
				console.warn(
					`Element mit Selektor "${selector}" wurde nach ${maxAttempts} Versuchen nicht gefunden`
				);
				if (errorCallback) {
					errorCallback();
				}
				return;
			}

			setTimeout(checkElement, interval);
		};

		checkElement();
	}
}

// Füge whenElementReady zum window.helpers-Objekt hinzu
if (window.helpers) {
	window.helpers.whenElementReady = whenElementReady;

	// Stelle sicher, dass Debug-Namespace existiert
	if (!window.helpers.debug) {
		window.helpers.debug = {};
	}

	// Registriere verfügbare Debug-Funktionen aus anderen Modulen
	// Diese Funktion wird aufgerufen, nachdem alle Module geladen sind
	window.helpers.registerDebugFunctions = function () {
		const debugFunctions = [
			"validateContainerMapping",
			"debugSyncDetailed",
			"debugSync",
			"debugContainerMapping",
			"getAllPrimaryTileData",
			"getAllSecondaryTileData",
		];

		debugFunctions.forEach((fn) => {
			if (window[fn] && typeof window[fn] === "function") {
				window.helpers.debug[fn] = window[fn];
			}
		});

		// Auch hangarDebug-Objekt in helpers einbinden falls verfügbar
		if (window.hangarDebug) {
			window.helpers.hangarDebug = window.hangarDebug;
		}

		console.log(
			"🔧 Debug-Funktionen in helpers.debug registriert:",
			Object.keys(window.helpers.debug)
		);
	};

	// Registriere Debug-Funktionen nach einer kurzen Verzögerung
	setTimeout(() => {
		if (window.helpers.registerDebugFunctions) {
			window.helpers.registerDebugFunctions();
		}
	}, 3000);
}

// === HELPERS MODULE BEREIT ===

// Date/Time helpers for datetime-local handling in UTC context
(function(){
  // Validates ISO local datetime YYYY-MM-DDTHH:mm (no seconds)
  function isISODateTimeLocal(str){
    return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str);
  }

  // Back-compat alias (old name)
  function isDateTimeLocal(str){ return isISODateTimeLocal(str); }

  // Validates HH:mm only
  function isHHmm(str){
    return typeof str === 'string' && /^\d{1,2}:\d{2}$/.test(str);
  }

  // Validates compact format yy.mm.dd,HH:mm
  function isCompactDateTime(str){
    return typeof str === 'string' && /^\d{2}\.\d{2}\.\d{2},\d{2}:\d{2}$/.test(str);
  }

  // Pads to 2-digit
  function pad2(n){ return String(n).padStart(2,'0'); }

  // Adds N days to a YYYY-MM-DD string (UTC-safe by parsing parts only)
  function addDaysToDateString(dateStr, days){
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
    const [y,m,d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m-1, d));
    dt.setUTCDate(dt.getUTCDate() + (days||0));
    const yy = dt.getUTCFullYear();
    const mm = pad2(dt.getUTCMonth()+1);
    const dd = pad2(dt.getUTCDate());
    return `${yy}-${mm}-${dd}`;
  }

  // Reads base dates from UI; arrival := #currentDateInput; departure := arrival+1 day
  function getBaseDates(){
    const baseEl = document.getElementById('currentDateInput');
    const base = (baseEl && /^\d{4}-\d{2}-\d{2}$/.test(baseEl.value)) ? baseEl.value : '';
    return {
      arrivalBase: base,
      departureBase: base ? addDaysToDateString(base, 1) : ''
    };
  }

  // Converts HH:mm to datetime-local ISO (YYYY-MM-DDTHH:mm) using provided base date (YYYY-MM-DD)
  // Returns '' if invalid inputs
  function coerceHHmmToDateTimeLocalUtc(hhmm, baseDateStr){
    if (!isHHmm(hhmm) || !/^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) return '';
    const [h, min] = hhmm.split(':').map(x=>parseInt(x,10));
    if (isNaN(h) || isNaN(min) || h<0 || h>23 || min<0 || min>59) return '';
    return `${baseDateStr}T${pad2(h)}:${pad2(min)}`;
  }

  // Formats ISO local datetime to yy.mm.dd,HH:mm (UTC-based display requested)
  function formatISOToCompactUTC(iso){
    if (!isISODateTimeLocal(iso)) return '';
    const [date, time] = iso.split('T');
    const [y,m,d] = date.split('-');
    const yy = y.slice(-2);
    return `${yy}.${m}.${d},${time}`;
  }

  // Parse compact yy.mm.dd,HH:mm to ISO local datetime YYYY-MM-DDTHH:mm
  // Assumes years 2000-2099 for two-digit year (UTC context)
  function parseCompactToISOUTC(compact){
    if (!isCompactDateTime(compact)) return '';
    const [datePart, timePart] = compact.split(',');
    const [yy, mm, dd] = datePart.split('.');
    const [HH, MM] = timePart.split(':');
    const yyyy = String(2000 + parseInt(yy,10));
    return `${yyyy}-${mm}-${dd}T${HH}:${MM}`;
  }

  // Formats datetime-local to yy.mm.dd,HH:mm for PDF display (accepts ISO string)
  function formatDateTimeLocalForPdf(dt){
    if (!isISODateTimeLocal(dt)) return '';
    return formatISOToCompactUTC(dt);
  }

  // Canonicalize value for a date-time field (arrival/departure) to ISO for storage
  function canonicalizeDateTimeFieldValue(fieldId, value){
    const v = (value||'').trim();
    if (!v) return '';
    // Field type discovery (arrival vs departure) only matters for HH:mm base selection
    const isArrival = fieldId.startsWith('arrival-time-');
    const isDeparture = fieldId.startsWith('departure-time-');
    if (!isArrival && !isDeparture) return v; // not our concern

    if (isISODateTimeLocal(v)) return v;
    if (isCompactDateTime(v)) return parseCompactToISOUTC(v);
    if (isHHmm(v)){
      const bases = getBaseDates();
      const base = isArrival ? bases.arrivalBase : bases.departureBase;
      return base ? coerceHHmmToDateTimeLocalUtc(v, base) : '';
    }
    return '';
  }

  // Helper: create masked compact value from digits (max 10 digits: YYMMDDHHmm)
  function digitsToCompact(digits){
    const d = (digits||'').replace(/\D+/g,'').slice(0,10);
    let out = '';
    for (let i=0;i<d.length;i++){
      out += d[i];
      if (i===1) out += '.'; // after YY
      if (i===3) out += '.'; // after YY.MM
      if (i===5) out += ','; // after YY.MM.DD
      if (i===7) out += ':'; // after YY.MM.DD,HH
    }
    return out;
  }

  // Attach input mask and interactions to a compact datetime input
  function attachCompactMask(input){
    if (!input || input.__compactMaskAttached) return;
    input.setAttribute('inputmode','numeric');
    input.setAttribute('placeholder','yy.mm.dd,HH:mm');
    input.dataset.dtCompact = 'true';

    // Ensure input fills its cell and leave space for absolute calendar button
    try {
      input.style.display = 'block';
      input.style.width = '100%';
      input.style.paddingRight = '28px';
    } catch(e){}

    const onInput = (e)=>{
      const raw = e.target.value || '';
      // If user types ISO, show compact immediately
      if (isISODateTimeLocal(raw)){
        e.target.value = formatISOToCompactUTC(raw);
        return;
      }
      e.target.value = digitsToCompact(raw);
    };

    const onBlur = (e)=>{
      const raw = (e.target.value||'').trim();
      let iso = '';
      if (isISODateTimeLocal(raw)) iso = raw;
      else if (isCompactDateTime(raw)) iso = parseCompactToISOUTC(raw);
      else if (isHHmm(raw)) iso = canonicalizeDateTimeFieldValue(e.target.id, raw);
      else iso = '';

      if (iso){
        e.target.value = formatISOToCompactUTC(iso); // keep display compact
        e.target.dataset.iso = iso; // store ISO reference on the element
      } else {
        // invalid → clear
        e.target.value = '';
        delete e.target.dataset.iso;
      }
    };

    input.addEventListener('input', onInput);
    input.addEventListener('blur', onBlur);

    // Double-click to open lightweight picker
    input.addEventListener('dblclick', ()=> openCompactDateTimePicker(input));

    // Calendar button placed absolutely inside a wrapper so grid stays 2-column
    try{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '🗓';
      btn.title = 'Open date/time picker';
      btn.className = 'compact-dt-btn';
      // inline fallback; full look via CSS
      btn.style.position = 'absolute';
      btn.style.right = '2px';
      btn.style.top = '50%';
      btn.style.transform = 'translateY(-50%)';
      btn.style.width = '22px';
      btn.style.height = '22px';
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.padding = '0';
      btn.style.border = '1px solid #cbd5e1';
      btn.style.borderRadius = '4px';
      btn.style.background = '#f8fafc';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', ()=> openCompactDateTimePicker(input));

      const parent = input.parentElement;
      if (parent){
        // If not already wrapped, create a wrapper to keep input as a single grid item
        if (!parent.classList || !parent.classList.contains('compact-dt-wrap')){
          const wrap = document.createElement('div');
          wrap.className = 'compact-dt-wrap';
          wrap.style.position = 'relative';
          wrap.style.display = 'block';
          wrap.style.width = '100%';
          wrap.style.minWidth = '0';
          parent.insertBefore(wrap, input);
          wrap.appendChild(input);
          wrap.appendChild(btn);
        } else {
          parent.appendChild(btn);
        }
      }
    } catch(e){}

    input.__compactMaskAttached = true;
  }

  // Transform existing datetime-local inputs to compact text inputs
  function transformDateTimeLocalInputsToCompact(root){
    const scope = root || document;
    const nodes = scope.querySelectorAll('input[type="datetime-local"][id^="arrival-time-"], input[type="datetime-local"][id^="departure-time-"]');
    nodes.forEach(inp => {
      try{ inp.setAttribute('type','text'); } catch(e){}
      inp.classList.add('compact-datetime');
      inp.setAttribute('placeholder','yy.mm.dd,HH:mm');
      attachCompactMask(inp);
      // If value is ISO from storage, show compact
      const val = (inp.value||'').trim();
      if (isISODateTimeLocal(val)){
        inp.value = formatISOToCompactUTC(val);
      }
    });
  }

  // Lightweight picker overlay (single instance)
  let picker = null;
  let pickerTarget = null;

  function ensurePicker(){
    if (picker) return picker;
    picker = document.createElement('div');
    picker.style.position = 'fixed';
    picker.style.zIndex = '99999';
    picker.style.background = '#ffffff';
    picker.style.color = '#111827';
    picker.style.border = '1px solid #cbd5e1';
    picker.style.borderRadius = '6px';
    picker.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';
    picker.style.padding = '8px';
    picker.style.display = 'none';
    picker.style.width = '240px'; // compact width to avoid wrapping tile layout

    const date = document.createElement('input');
    date.type = 'date';
    date.style.marginBottom = '6px';
    date.style.width = '100%';

    const time = document.createElement('input');
    time.type = 'time';
    time.step = '60';
    time.style.marginBottom = '8px';
    time.style.width = '100%';

    const ok = document.createElement('button'); ok.type='button'; ok.textContent='OK';
    ok.style.marginRight = '6px'; ok.style.padding='4px 8px'; ok.style.border='1px solid #0ea5e9'; ok.style.background='#e0f2fe'; ok.style.borderRadius='4px';
    const cancel = document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel';
    cancel.style.padding='4px 8px'; cancel.style.border='1px solid #cbd5e1'; cancel.style.background='#f8fafc'; cancel.style.borderRadius='4px';

    const column = document.createElement('div');
    column.style.display='flex';
    column.style.flexDirection='column';
    column.style.alignItems='stretch';

    const actions = document.createElement('div');
    actions.style.display='flex';
    actions.style.justifyContent='flex-end';
    actions.appendChild(ok); actions.appendChild(cancel);

    column.appendChild(date); column.appendChild(time); column.appendChild(actions);

    picker.appendChild(column);
    document.body.appendChild(picker);

    function close(){ picker.style.display='none'; pickerTarget = null; }

    ok.addEventListener('click', ()=>{
      if (!pickerTarget) { close(); return; }
      const d = date.value; const t = time.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{2}:\d{2}$/.test(t)){
        const iso = `${d}T${t}`;
        pickerTarget.dataset.iso = iso;
        pickerTarget.value = formatISOToCompactUTC(iso);
        // Trigger change/save
        pickerTarget.dispatchEvent(new Event('input', {bubbles:true}));
        pickerTarget.dispatchEvent(new Event('change', {bubbles:true}));
        pickerTarget.dispatchEvent(new Event('blur', {bubbles:true}));
      }
      close();
    });
    cancel.addEventListener('click', close);

    picker._date = date; picker._time = time; picker._close = close;
    return picker;
  }

  function openCompactDateTimePicker(input){
    const p = ensurePicker();
    pickerTarget = input;

    // Pre-fill from input
    const raw = (input.value||'').trim();
    let iso = '';
    if (isISODateTimeLocal(raw)) iso = raw;
    else if (isCompactDateTime(raw)) iso = parseCompactToISOUTC(raw);
    else if (isHHmm(raw)) iso = canonicalizeDateTimeFieldValue(input.id, raw);

    if (iso){
      const [d,t] = iso.split('T');
      p._date.value = d;
      p._time.value = t;
    } else {
      // default to today UTC + 00:00
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = pad2(now.getUTCMonth()+1);
      const dd = pad2(now.getUTCDate());
      p._date.value = `${yyyy}-${mm}-${dd}`;
      p._time.value = '00:00';
    }

    // Position near input
    const rect = input.getBoundingClientRect();
    const assumedWidth = parseInt(p.style.width,10) || 260;
    const assumedHeight = 120;
    p.style.left = `${Math.min(rect.left, window.innerWidth - assumedWidth - 4)}px`;
    p.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - assumedHeight)}px`;
    p.style.display = 'block';
  }

  // Attach compact behavior to arrival/departure inputs
  function attachCompactDateTimeInputs(root){
    const scope = root || document;
    const inputs = scope.querySelectorAll('input[id^="arrival-time-"], input[id^="departure-time-"]');
    inputs.forEach(attachCompactMask);
  }

  // Centralized init hookup
  window.hangarInitQueue = window.hangarInitQueue || [];
  window.hangarInitQueue.push(function(){
    try{
      transformDateTimeLocalInputsToCompact();
      attachCompactDateTimeInputs();
    } catch(e){ console.warn('Compact datetime init failed', e); }
  });

  // Also react to secondary tile creation
  document.addEventListener('secondaryTilesCreated', function(evt){
    try{
      transformDateTimeLocalInputsToCompact();
      attachCompactDateTimeInputs();
    } catch(e){}
  });

  // Export globals
  window.helpers = window.helpers || {};
  window.helpers.isDateTimeLocal = isDateTimeLocal; // legacy
  window.helpers.isISODateTimeLocal = isISODateTimeLocal;
  window.helpers.isCompactDateTime = isCompactDateTime;
  window.helpers.isHHmm = isHHmm;
  window.helpers.getBaseDates = getBaseDates;
  window.helpers.coerceHHmmToDateTimeLocalUtc = coerceHHmmToDateTimeLocalUtc;
  window.helpers.formatDateTimeLocalForPdf = formatDateTimeLocalForPdf;
  window.helpers.addDaysToDateString = addDaysToDateString;
  window.helpers.formatISOToCompactUTC = formatISOToCompactUTC;
  window.helpers.parseCompactToISOUTC = parseCompactToISOUTC;
  window.helpers.canonicalizeDateTimeFieldValue = canonicalizeDateTimeFieldValue;
  window.helpers.attachCompactDateTimeInputs = attachCompactDateTimeInputs;
  window.helpers.transformDateTimeLocalInputsToCompact = transformDateTimeLocalInputsToCompact;
  window.helpers.openCompactDateTimePicker = openCompactDateTimePicker;
})();
