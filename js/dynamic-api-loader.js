/**
 * Dynamic API Loader
 * Lädt API-Module nur bei Bedarf, um die initiale Ladezeit zu reduzieren
 */

const DynamicAPILoader = (() => {
	const loadedModules = new Set();
	const loadingPromises = new Map();

	const apiModules = {
		AeroDataBoxAPI: {
			script: "js/aerodatabox-api.js",
			checkFunction: () => window.AeroDataBoxAPI,
			priority: 1, // Höchste Priorität - Hauptdatenquelle
		},
		AmadeusAPI: {
			script: "js/amadeus-api.js",
			checkFunction: () => window.AmadeusAPI,
			priority: 2, // Backup-API
		},
		OpenskyAPI: {
			script: "js/opensky-api.js",
			checkFunction: () => window.OpenskyAPI,
			priority: 3, // Zusätzliche Datenquelle
		},
	};

	/**
	 * Lädt ein API-Modul dynamisch
	 * @param {string} moduleName - Name des zu ladenden Moduls
	 * @returns {Promise<Object>} Das geladene Modul
	 */
	const loadModule = async (moduleName) => {
		// Bereits geladen?
		if (loadedModules.has(moduleName)) {
			const moduleConfig = apiModules[moduleName];
			if (moduleConfig && moduleConfig.checkFunction()) {
				return moduleConfig.checkFunction();
			}
		}

		// Lädt bereits?
		if (loadingPromises.has(moduleName)) {
			return await loadingPromises.get(moduleName);
		}

		const moduleConfig = apiModules[moduleName];
		if (!moduleConfig) {
			throw new Error(`Unbekanntes API-Modul: ${moduleName}`);
		}

		// Ladevorgang starten
		const loadPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = moduleConfig.script;
			script.async = true;

			script.onload = () => {
				// Prüfen ob Modul korrekt geladen wurde
				const module = moduleConfig.checkFunction();
				if (module) {
					loadedModules.add(moduleName);
					console.log(`✓ API-Modul geladen: ${moduleName}`);
					resolve(module);
				} else {
					reject(
						new Error(
							`Modul ${moduleName} wurde geladen, aber ist nicht verfügbar`
						)
					);
				}
			};

			script.onerror = () => {
				reject(
					new Error(
						`Fehler beim Laden von ${moduleName} (${moduleConfig.script})`
					)
				);
			};

			document.head.appendChild(script);
		});

		loadingPromises.set(moduleName, loadPromise);

		try {
			const result = await loadPromise;
			loadingPromises.delete(moduleName);
			return result;
		} catch (error) {
			loadingPromises.delete(moduleName);
			throw error;
		}
	};

	/**
	 * Lädt mehrere Module parallel
	 * @param {string[]} moduleNames - Array von Modulnamen
	 * @returns {Promise<Object>} Objekt mit geladenen Modulen
	 */
	const loadModules = async (moduleNames) => {
		const loadPromises = moduleNames.map(async (name) => {
			try {
				const module = await loadModule(name);
				return { name, module, success: true };
			} catch (error) {
				console.warn(`Fehler beim Laden von ${name}:`, error);
				return { name, module: null, success: false, error };
			}
		});

		const results = await Promise.allSettled(loadPromises);
		const loadedModules = {};

		results.forEach((result) => {
			if (result.status === "fulfilled" && result.value.success) {
				loadedModules[result.value.name] = result.value.module;
			}
		});

		return loadedModules;
	};

	/**
	 * Lädt die primäre API (AeroDataBoxAPI) mit Fallback
	 * @returns {Promise<Object>} Primäre API oder Fallback
	 */
	const loadPrimaryAPI = async () => {
		try {
			// Versuche primäre API zu laden
			return await loadModule("AeroDataBoxAPI");
		} catch (error) {
			console.warn(
				"Primäre API (AeroDataBoxAPI) nicht verfügbar, lade Fallback:",
				error
			);

			// Fallback zu Amadeus API
			try {
				return await loadModule("AmadeusAPI");
			} catch (fallbackError) {
				console.warn(
					"Fallback API (AmadeusAPI) nicht verfügbar:",
					fallbackError
				);

				// Letzter Fallback zu OpenSky
				return await loadModule("OpenskyAPI");
			}
		}
	};

	/**
	 * Prüft ob ein Modul bereits geladen ist
	 * @param {string} moduleName - Name des Moduls
	 * @returns {boolean} True wenn geladen
	 */
	const isLoaded = (moduleName) => {
		return (
			loadedModules.has(moduleName) &&
			apiModules[moduleName] &&
			apiModules[moduleName].checkFunction()
		);
	};

	/**
	 * Gibt eine Liste aller verfügbaren Module zurück
	 * @returns {string[]} Array von Modulnamen
	 */
	const getAvailableModules = () => {
		return Object.keys(apiModules);
	};

	/**
	 * Gibt eine Liste aller geladenen Module zurück
	 * @returns {string[]} Array von geladenen Modulnamen
	 */
	const getLoadedModules = () => {
		return Array.from(loadedModules);
	};

	// Öffentliche API
	return {
		loadModule,
		loadModules,
		loadPrimaryAPI,
		isLoaded,
		getAvailableModules,
		getLoadedModules,
	};
})();

// Global verfügbar machen
window.DynamicAPILoader = DynamicAPILoader;
