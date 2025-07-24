/**
 * FileManager für Hangarplanner
 * Verwaltet das Speichern und Laden von Projektdateien über den File System Access API
 */

class FileManager {
	constructor() {
		// Status, ob File System API unterstützt wird
		this.fileSystemSupported =
			"showSaveFilePicker" in window && "showOpenFilePicker" in window;

		// Konstanten für den festen Speicherort
		this.FIXED_STORAGE_DIR = "js/storedfiles";
		this.AUTO_SYNC_ENABLED = false;
		this.SYNC_INTERVAL = 30000; // 30 Sekunden
		this.syncIntervalId = null;

		console.log(
			`File System API wird ${
				this.fileSystemSupported ? "" : "NICHT "
			}unterstützt`
		);

		// Initialisierung des festen Speicherorts
		this.initFixedStorageDirectory();
	}

	/**
	 * Initialisiert den festen Speicherort, wenn verfügbar
	 */
	async initFixedStorageDirectory() {
		try {
			// Prüfen, ob die Origin Private File System API verfügbar ist
			if ("originPrivateFileSystem" in window.navigator.storage) {
				console.log("Origin Private File System API verfügbar");

				// Versuchen, den festen Speicherordner zu erstellen/zu öffnen
				const root = await navigator.storage.getDirectory();
				let fixedDir;

				try {
					// Versuchen, den Ordner zu öffnen
					fixedDir = await root.getDirectoryHandle(this.FIXED_STORAGE_DIR, {
						create: false,
					});
				} catch (e) {
					// Ordner existiert noch nicht, erstellen
					console.log(`Erstelle Verzeichnis ${this.FIXED_STORAGE_DIR}`);
					const pathParts = this.FIXED_STORAGE_DIR.split("/");

					// Ordnerstruktur navigieren/erstellen
					let currentDir = root;
					for (const part of pathParts) {
						if (part) {
							currentDir = await currentDir.getDirectoryHandle(part, {
								create: true,
							});
						}
					}

					fixedDir = currentDir;
				}

				this.fixedStorageDir = fixedDir;
				console.log(
					`Fester Speicherort initialisiert: ${this.FIXED_STORAGE_DIR}`
				);

				// Dateien im festen Speicherort auflisten (zu Debug-Zwecken)
				this.listFilesInFixedStorage();
			} else {
				console.warn(
					"Origin Private File System API nicht verfügbar, fester Speicherort wird durch localStorage emuliert"
				);
				// Fallback auf localStorage/IndexedDB
				this.useLocalStorageEmulation = true;
			}
		} catch (error) {
			console.error(
				"Fehler bei der Initialisierung des festen Speicherorts:",
				error
			);
			this.useLocalStorageEmulation = true;
		}
	}

	/**
	 * Listet alle Dateien im festen Speicherort auf
	 */
	async listFilesInFixedStorage() {
		try {
			if (!this.fixedStorageDir) {
				console.warn("Fester Speicherort nicht initialisiert");
				return [];
			}

			const files = [];
			for await (const [name, handle] of this.fixedStorageDir.entries()) {
				if (handle.kind === "file") {
					files.push(name);
				}
			}

			console.log("Dateien im festen Speicherort:", files);
			return files;
		} catch (error) {
			console.error(
				"Fehler beim Auflisten der Dateien im festen Speicherort:",
				error
			);
			return [];
		}
	}

	/**
	 * Öffnet den Speichern-Dialog des File System Access API
	 * @param {string} fileName - Der vorgeschlagene Dateiname
	 * @param {string} fileType - Der Dateityp (z.B. "json")
	 * @returns {Promise<FileSystemFileHandle>} Handle für die gewählte Datei
	 */
	async openSaveDialog(fileName, fileType = "json") {
		try {
			// Prüfen, ob die File System Access API unterstützt wird
			if (!this.fileSystemSupported) {
				console.warn("File System Access API wird nicht unterstützt");
				throw new Error("File System Access API wird nicht unterstützt");
			}

			console.log(`Öffne Speicherdialog für ${fileName} vom Typ ${fileType}`);

			// Optionen für den File Picker
			const options = {
				suggestedName: fileName.endsWith(`.${fileType}`)
					? fileName
					: `${fileName}.${fileType}`,
				types: [
					{
						description: fileType.toUpperCase() + " Files",
						accept: { [`application/${fileType}`]: [`.${fileType}`] },
					},
				],
			};

			// Dialog öffnen und Handle zurückgeben
			return await window.showSaveFilePicker(options);
		} catch (error) {
			if (error.name === "AbortError") {
				console.log("Benutzer hat den Dialog abgebrochen");
			} else {
				console.error("Fehler beim Öffnen des Speicherdialogs:", error);
			}
			throw error;
		}
	}

	/**
	 * Öffnet den Öffnen-Dialog des File System Access API
	 * @param {string} fileType - Der Dateityp (z.B. "json")
	 * @returns {Promise<File>} Die ausgewählte Datei
	 */
	async openLoadDialog(fileType = "json") {
		try {
			// Prüfen, ob die File System Access API unterstützt wird
			if (!this.fileSystemSupported) {
				console.warn("File System Access API wird nicht unterstützt");
				throw new Error("File System Access API wird nicht unterstützt");
			}

			console.log(`Öffne Ladedialog für Dateien vom Typ ${fileType}`);

			// Optionen für den File Picker
			const options = {
				types: [
					{
						description: fileType.toUpperCase() + " Files",
						accept: { [`application/${fileType}`]: [`.${fileType}`] },
					},
				],
				multiple: false,
			};

			// Dialog öffnen und File Handle zurückgeben
			const [fileHandle] = await window.showOpenFilePicker(options);
			return await fileHandle.getFile();
		} catch (error) {
			if (error.name === "AbortError") {
				console.log("Benutzer hat den Dialog abgebrochen");
			} else {
				console.error("Fehler beim Öffnen des Ladedialogs:", error);
			}
			throw error;
		}
	}

	/**
	 * Speichert ein Projekt als JSON-Datei mit dem Filepicker
	 * @param {Object} projectData - Die zu speichernden Projektdaten
	 * @returns {Promise<boolean>} Erfolg des Speichervorgangs
	 */
	async saveProject(projectData) {
		try {
			// Aktuelle Zeit in Metadaten speichern
			if (!projectData.metadata) {
				projectData.metadata = {};
			}

			projectData.metadata.lastModified = new Date().toISOString();

			// Dateiname aus Projektname generieren
			const fileName = `${
				projectData.metadata?.projectName || "HangarPlan"
			}.json`;

			// Prüfen ob File System API verwendet werden kann
			if (this.fileSystemSupported) {
				try {
					window.showNotification("Datei-Dialog wird geöffnet...", "info");

					// File Picker öffnen - hier ist der Dialog sichtbar
					const fileHandle = await this.openSaveDialog(fileName);
					console.log("File Handle erhalten:", fileHandle);

					// Erst NACH der Dialogauswahl JSON erstellen
					const jsonString = JSON.stringify(projectData, null, 2);

					// In Datei schreiben
					const writable = await fileHandle.createWritable();
					await writable.write(jsonString);
					await writable.close();

					window.showNotification(
						`Projekt "${projectData.metadata?.projectName}" erfolgreich gespeichert!`,
						"success"
					);

					return true;
				} catch (error) {
					if (error.name === "AbortError") {
						window.showNotification("Speichern abgebrochen", "info");
						return false;
					}

					// Fallback zum Standard-Download nur bei echten Fehlern
					console.warn("Fallback auf Standard-Download:", error.message);
					const jsonString = JSON.stringify(projectData, null, 2);
					this.downloadFile(jsonString, fileName);
					return true;
				}
			} else {
				// Standard-Download wenn File System API nicht unterstützt wird
				const jsonString = JSON.stringify(projectData, null, 2);
				this.downloadFile(jsonString, fileName);
				window.showNotification(
					"Projekt wurde als Download gespeichert",
					"success"
				);
				return true;
			}
		} catch (error) {
			console.error("Fehler beim Speichern des Projekts:", error);
			window.showNotification(
				`Speichern fehlgeschlagen: ${error.message}`,
				"error"
			);
			return false;
		}
	}

	/**
	 * Lädt ein Projekt aus einer JSON-Datei mit dem Filepicker
	 * @returns {Promise<Object|null>} Das geladene Projekt oder null bei Fehler
	 */
	async loadProject() {
		try {
			let jsonData = null;

			// Versuche File System API zu verwenden
			if (this.fileSystemSupported) {
				try {
					window.showNotification("Datei-Auswahl wird geöffnet...", "info");

					const file = await this.openLoadDialog("json");
					console.log("Datei ausgewählt:", file.name);

					// Dateiinhalt lesen
					jsonData = await file.text();
				} catch (error) {
					if (error.name === "AbortError") {
						window.showNotification("Laden abgebrochen", "info");
						return null;
					}

					// Fallback auf Standard-Dateiauswahl
					return this.loadFileFallback();
				}
			} else {
				// Standard-Dateiauswahl verwenden
				return this.loadFileFallback();
			}

			// Daten parsen und zurückgeben
			if (jsonData) {
				const projectData = JSON.parse(jsonData);
				window.showNotification("Projekt erfolgreich geladen!", "success");
				return projectData;
			}

			return null;
		} catch (error) {
			console.error("Fehler beim Laden des Projekts:", error);
			window.showNotification(
				`Laden fehlgeschlagen: ${error.message}`,
				"error"
			);
			return null;
		}
	}

	/**
	 * Fallback für den Datei-Upload über einen Standard-Dateiauswahldialog
	 * @returns {Promise<Object|null>} Das geladene Projekt oder null bei Fehler
	 */
	loadFileFallback() {
		return new Promise((resolve, reject) => {
			// Standard Dateiauswahl verwenden
			const fileInput = document.createElement("input");
			fileInput.type = "file";
			fileInput.accept = ".json";
			fileInput.style.display = "none";
			document.body.appendChild(fileInput);

			// Event-Handler für Dateiauswahl
			fileInput.onchange = async (event) => {
				try {
					if (!event.target.files || event.target.files.length === 0) {
						resolve(null);
						return;
					}

					// Datei lesen
					const file = event.target.files[0];
					const reader = new FileReader();

					reader.onload = (e) => {
						try {
							const projectData = JSON.parse(e.target.result);
							window.showNotification(
								"Projekt erfolgreich geladen!",
								"success"
							);
							resolve(projectData);
						} catch (error) {
							console.error("Fehler beim Parsen der Datei:", error);
							window.showNotification(
								`Datei-Format ungültig: ${error.message}`,
								"error"
							);
							reject(error);
						}
					};

					reader.onerror = (e) => {
						reject(new Error("Datei konnte nicht gelesen werden"));
					};

					reader.readAsText(file);
				} catch (error) {
					reject(error);
				} finally {
					document.body.removeChild(fileInput);
				}
			};

			// Dialog öffnen
			fileInput.click();
		});
	}

	/**
	 * Hilfsfunktion für direkten Datei-Download
	 * @param {string} content - Dateiinhalt
	 * @param {string} fileName - Dateiname
	 */
	downloadFile(content, fileName) {
		const blob = new Blob([content], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 100);
	}

	/**
	 * Speichert ein Projekt in den festen Speicherort ohne Benutzerinteraktion
	 * @param {Object} projectData - Die zu speichernden Projektdaten
	 * @returns {Promise<boolean>} Erfolg des Speichervorgangs
	 */
	async saveProjectToFixedLocation(projectData) {
		try {
			// Aktuelle Zeit in Metadaten speichern
			if (!projectData.metadata) {
				projectData.metadata = {};
			}

			projectData.metadata.lastModified = new Date().toISOString();
			const fileName = `${
				projectData.metadata?.projectName || "HangarPlan"
			}.json`;

			// JSON-String erstellen
			const jsonString = JSON.stringify(projectData, null, 2);

			if (this.useLocalStorageEmulation) {
				// Fallback auf localStorage
				try {
					const storageKey = `fixedStorage_${fileName}`;
					localStorage.setItem(storageKey, jsonString);

					// Auch einen Index der gespeicherten Dateien pflegen
					let fileIndex = JSON.parse(
						localStorage.getItem("fixedStorage_fileIndex") || "[]"
					);
					if (!fileIndex.includes(fileName)) {
						fileIndex.push(fileName);
						localStorage.setItem(
							"fixedStorage_fileIndex",
							JSON.stringify(fileIndex)
						);
					}

					console.log(
						`Projekt "${fileName}" im emulierten Speicher gespeichert`
					);
					window.showNotification(
						`Projekt im festen Speicherort gespeichert: ${fileName}`,
						"success"
					);
					return true;
				} catch (error) {
					console.error("Fehler beim Speichern im emulierten Speicher:", error);
					throw error;
				}
			} else if (this.fixedStorageDir) {
				// Origin Private File System API verwenden
				const fileHandle = await this.fixedStorageDir.getFileHandle(fileName, {
					create: true,
				});
				const writable = await fileHandle.createWritable();
				await writable.write(jsonString);
				await writable.close();

				console.log(`Projekt "${fileName}" im festen Speicherort gespeichert`);
				window.showNotification(
					`Projekt im festen Speicherort gespeichert: ${fileName}`,
					"success"
				);
				return true;
			} else {
				throw new Error("Fester Speicherort nicht verfügbar");
			}
		} catch (error) {
			console.error("Fehler beim Speichern im festen Speicherort:", error);
			window.showNotification(
				`Speichern im festen Speicherort fehlgeschlagen: ${error.message}`,
				"error"
			);
			return false;
		}
	}

	/**
	 * Lädt ein Projekt aus dem festen Speicherort ohne Benutzerinteraktion
	 * @param {string} fileName - Der Dateiname des zu ladenden Projekts
	 * @returns {Promise<Object|null>} Das geladene Projekt oder null bei Fehler
	 */
	async loadProjectFromFixedLocation(fileName) {
		try {
			if (this.useLocalStorageEmulation) {
				// Fallback auf localStorage
				const storageKey = `fixedStorage_${fileName}`;
				const jsonData = localStorage.getItem(storageKey);

				if (!jsonData) {
					console.warn(
						`Datei "${fileName}" nicht im emulierten Speicher gefunden`
					);
					window.showNotification(
						`Datei "${fileName}" nicht gefunden`,
						"warning"
					);
					return null;
				}

				const projectData = JSON.parse(jsonData);
				console.log(`Projekt "${fileName}" aus emuliertem Speicher geladen`);
				window.showNotification(
					`Projekt aus dem festen Speicherort geladen: ${fileName}`,
					"success"
				);
				return projectData;
			} else if (this.fixedStorageDir) {
				// Origin Private File System API verwenden
				try {
					const fileHandle = await this.fixedStorageDir.getFileHandle(
						fileName,
						{ create: false }
					);
					const file = await fileHandle.getFile();
					const jsonData = await file.text();

					const projectData = JSON.parse(jsonData);
					console.log(`Projekt "${fileName}" aus festem Speicherort geladen`);
					window.showNotification(
						`Projekt aus dem festen Speicherort geladen: ${fileName}`,
						"success"
					);
					return projectData;
				} catch (error) {
					if (error.name === "NotFoundError") {
						console.warn(
							`Datei "${fileName}" nicht im festen Speicherort gefunden`
						);
						window.showNotification(
							`Datei "${fileName}" nicht gefunden`,
							"warning"
						);
						return null;
					}
					throw error;
				}
			} else {
				throw new Error("Fester Speicherort nicht verfügbar");
			}
		} catch (error) {
			console.error("Fehler beim Laden aus dem festen Speicherort:", error);
			window.showNotification(
				`Laden aus dem festen Speicherort fehlgeschlagen: ${error.message}`,
				"error"
			);
			return null;
		}
	}

	/**
	 * Listet alle verfügbaren Projekte im festen Speicherort auf
	 * @returns {Promise<string[]>} Liste der Dateinamen
	 */
	async listProjectsInFixedLocation() {
		try {
			if (this.useLocalStorageEmulation) {
				// Fallback auf localStorage
				const fileIndex = JSON.parse(
					localStorage.getItem("fixedStorage_fileIndex") || "[]"
				);
				console.log("Verfügbare Projekte im emulierten Speicher:", fileIndex);
				return fileIndex;
			} else if (this.fixedStorageDir) {
				// Origin Private File System API verwenden
				return await this.listFilesInFixedStorage();
			} else {
				throw new Error("Fester Speicherort nicht verfügbar");
			}
		} catch (error) {
			console.error(
				"Fehler beim Auflisten der Projekte im festen Speicherort:",
				error
			);
			return [];
		}
	}

	/**
	 * Aktiviert die automatische Synchronisation mit dem festen Speicherort
	 * @param {Function} onSyncCallback - Funktion, die bei erfolgreicher Synchronisation aufgerufen wird
	 */
	enableAutoSync(onSyncCallback) {
		if (this.syncIntervalId) {
			console.log("Auto-Sync ist bereits aktiviert");
			return;
		}

		this.AUTO_SYNC_ENABLED = true;
		this.onSyncCallback = onSyncCallback;

		console.log(`Auto-Sync aktiviert, Intervall: ${this.SYNC_INTERVAL}ms`);

		// Sofort erste Synchronisation durchführen
		this.checkForUpdates();

		// Regelmäßige Synchronisation einrichten
		this.syncIntervalId = setInterval(
			() => this.checkForUpdates(),
			this.SYNC_INTERVAL
		);
	}

	/**
	 * Deaktiviert die automatische Synchronisation
	 */
	disableAutoSync() {
		if (this.syncIntervalId) {
			clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
			this.AUTO_SYNC_ENABLED = false;
			console.log("Auto-Sync deaktiviert");
		}
	}

	/**
	 * Prüft auf Aktualisierungen im festen Speicherort
	 */
	async checkForUpdates() {
		try {
			// Implementierung der Aktualisierungsprüfung
			console.log("Prüfe auf Aktualisierungen im festen Speicherort...");

			// Hier würde die Logik implementiert werden, um Änderungen zu erkennen
			// und die entsprechenden Dateien zu laden

			// Wenn eine Aktualisierung gefunden wurde und ein Callback existiert
			if (this.onSyncCallback && typeof this.onSyncCallback === "function") {
				// Aktualisierte Daten laden
				// this.onSyncCallback(updatedData);
			}
		} catch (error) {
			console.error("Fehler bei der Synchronisation:", error);
		}
	}

	/**
	 * Exportiert das aktuelle Projekt automatisch mit generiertem Dateinamen
	 * Format: YYYY_MM_DD_HH:MM_Hangarplan.json
	 * @param {Object} projectData - Die zu exportierenden Projektdaten
	 * @returns {Promise<boolean>} Erfolg des Export-Vorgangs
	 */
	async exportCurrentFile(projectData) {
		try {
			// Automatischen Dateinamen generieren
			const now = new Date();
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, "0");
			const day = String(now.getDate()).padStart(2, "0");
			const hours = String(now.getHours()).padStart(2, "0");
			const minutes = String(now.getMinutes()).padStart(2, "0");
			const fileName = `${year}_${month}_${day}_${hours}:${minutes}_Hangarplan.json`;

			// Aktuelle Zeit in Metadaten speichern
			if (!projectData.metadata) {
				projectData.metadata = {};
			}
			projectData.metadata.lastModified = new Date().toISOString();
			projectData.metadata.projectName = fileName.replace(".json", "");

			// JSON-String erstellen
			const jsonString = JSON.stringify(projectData, null, 2);

			// Direkter Download ohne Dialog
			this.downloadFile(jsonString, fileName);

			window.showNotification(
				`Projekt automatisch exportiert: ${fileName}`,
				"success"
			);

			console.log(`Projekt automatisch exportiert: ${fileName}`);
			return true;
		} catch (error) {
			console.error("Fehler beim automatischen Export:", error);
			window.showNotification(
				`Automatischer Export fehlgeschlagen: ${error.message}`,
				"error"
			);
			return false;
		}
	}

	/**
	 * Erstellt eine Datei im festen Speicherort oder ersetzt sie
	 * @param {string} fileName - Name der Datei (mit Erweiterung)
	 * @param {Object|string} content - Inhalt der Datei (Objekt wird in JSON konvertiert)
	 * @returns {Promise<boolean>} Erfolg des Speichervorgangs
	 */
	async createFileInFixedStorage(fileName, content) {
		try {
			// Inhalt in String umwandeln, falls es ein Objekt ist
			const contentStr =
				typeof content === "object"
					? JSON.stringify(content, null, 2)
					: String(content);

			if (this.useLocalStorageEmulation) {
				// Fallback auf localStorage
				const storageKey = `fixedStorage_${fileName}`;
				localStorage.setItem(storageKey, contentStr);

				// Index aktualisieren
				let fileIndex = JSON.parse(
					localStorage.getItem("fixedStorage_fileIndex") || "[]"
				);
				if (!fileIndex.includes(fileName)) {
					fileIndex.push(fileName);
					localStorage.setItem(
						"fixedStorage_fileIndex",
						JSON.stringify(fileIndex)
					);
				}

				console.log(
					`Datei "${fileName}" im emulierten Speicher erstellt/aktualisiert`
				);
				return true;
			} else if (this.fixedStorageDir) {
				// Origin Private File System API verwenden
				const fileHandle = await this.fixedStorageDir.getFileHandle(fileName, {
					create: true,
				});
				const writable = await fileHandle.createWritable();
				await writable.write(contentStr);
				await writable.close();

				console.log(
					`Datei "${fileName}" im festen Speicherort erstellt/aktualisiert`
				);
				return true;
			} else {
				throw new Error("Fester Speicherort nicht verfügbar");
			}
		} catch (error) {
			console.error("Fehler beim Erstellen/Aktualisieren der Datei:", error);
			return false;
		}
	}

	/**
	 * Export-Funktion: Exportiert alle gespeicherten Dateien aus dem festen Speicherort
	 * in einen herunterladbaren ZIP-Archiv
	 */
	async exportStoredFilesToZip() {
		try {
			// ZIP-Bibliothek dynamisch laden, wenn nicht vorhanden
			if (!window.JSZip) {
				// Benutzer über den Ladevorgang informieren
				window.showNotification("Lade ZIP-Bibliothek...", "info");

				// JSZip von CDN laden
				await new Promise((resolve, reject) => {
					const script = document.createElement("script");
					script.src =
						"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
					script.onload = resolve;
					script.onerror = reject;
					document.head.appendChild(script);
				});
			}

			// Benachrichtigung anzeigen
			window.showNotification("Erstelle ZIP-Archiv...", "info");

			// Dateien auflisten
			const files = await this.listProjectsInFixedLocation();
			if (!files || files.length === 0) {
				window.showNotification(
					"Keine Dateien zum Exportieren vorhanden",
					"warning"
				);
				return false;
			}

			// Neues ZIP-Archiv erstellen
			const zip = new JSZip();

			// Dateien zum Archiv hinzufügen
			for (const fileName of files) {
				let fileContent;

				if (this.useLocalStorageEmulation) {
					// Aus localStorage laden
					fileContent = localStorage.getItem(`fixedStorage_${fileName}`);
				} else if (this.fixedStorageDir) {
					// Aus OPFS laden
					const fileHandle = await this.fixedStorageDir.getFileHandle(
						fileName,
						{ create: false }
					);
					const file = await fileHandle.getFile();
					fileContent = await file.text();
				}

				if (fileContent) {
					zip.file(fileName, fileContent);
				}
			}

			// ZIP generieren und herunterladen
			const zipBlob = await zip.generateAsync({ type: "blob" });
			const url = URL.createObjectURL(zipBlob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "hangarplanner-storage.zip";
			document.body.appendChild(a);
			a.click();

			// Aufräumen
			setTimeout(() => {
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}, 100);

			window.showNotification(
				`${files.length} Dateien erfolgreich exportiert`,
				"success"
			);
			return true;
		} catch (error) {
			console.error(
				"Fehler beim Exportieren der gespeicherten Dateien:",
				error
			);
			window.showNotification(
				`Export fehlgeschlagen: ${error.message}`,
				"error"
			);
			return false;
		}
	}
}

// Erstelle globale Instanz des FileManagers
window.fileManager = new FileManager();
