/**
 * Server-Sync Test und Validierungs-Script
 * Testet ob alle User-Eingaben korrekt auf dem Server gespeichert werden
 */

console.log("🧪 Server-Sync Test geladen");

class ServerSyncValidator {
	constructor() {
		this.testResults = [];
		this.isTestRunning = false;
	}

	/**
	 * Führt einen vollständigen Test durch
	 */
	async runFullTest() {
		if (this.isTestRunning) {
			console.log("⚠️ Test läuft bereits");
			return;
		}

		this.isTestRunning = true;
		this.testResults = [];

		console.log("🚀 Starte vollständigen Server-Sync Test...");

		try {
			await this.testServerConnection();
			await this.testEventHandlerRegistration();
			await this.testFieldUpdates();
			await this.testDataPersistence();

			this.showTestResults();
		} catch (error) {
			console.error("❌ Test fehlgeschlagen:", error);
		} finally {
			this.isTestRunning = false;
		}
	}

	/**
	 * Test 1: Server-Verbindung
	 */
	async testServerConnection() {
		console.log("📡 Teste Server-Verbindung...");

		try {
			const hasServerSync =
				window.storageBrowser && window.storageBrowser.serverSyncUrl;
			const serverUrl = window.storageBrowser?.serverSyncUrl;

			this.addTestResult(
				"Server-Sync initialisiert",
				hasServerSync,
				hasServerSync ? `URL: ${serverUrl}` : "Server-Sync nicht verfügbar"
			);

			if (hasServerSync) {
				// Test-Ping an Server
				const response = await fetch(serverUrl, {
					method: "GET",
					headers: { Accept: "application/json" },
				});

				this.addTestResult(
					"Server erreichbar",
					response.status === 200 || response.status === 404,
					`Status: ${response.status}`
				);
			}
		} catch (error) {
			this.addTestResult("Server-Verbindung", false, error.message);
		}
	}

	/**
	 * Test 2: Event-Handler-Registrierung
	 */
	async testEventHandlerRegistration() {
		console.log("🔗 Teste Event-Handler-Registrierung...");

		const eventManager = window.hangarEventManager;
		const hasEventManager = !!eventManager;

		this.addTestResult(
			"Event-Manager verfügbar",
			hasEventManager,
			hasEventManager ? "Instanz gefunden" : "Event-Manager fehlt"
		);

		if (hasEventManager) {
			const status = eventManager.getStatus();
			this.addTestResult(
				"Event-Manager initialisiert",
				status.initialized,
				`Handler: ${status.registeredHandlers}, Queue: ${status.storageQueueLength}`
			);
		}

		// Teste spezifische Felder
		const testSelectors = [
			'input[id^="aircraft-"]',
			'input[id^="position-"]',
			'textarea[id^="notes-"]',
		];

		testSelectors.forEach((selector) => {
			const elements = document.querySelectorAll(selector);
			this.addTestResult(
				`Felder gefunden: ${selector}`,
				elements.length > 0,
				`${elements.length} Elemente`
			);
		});
	}

	/**
	 * Test 3: Feld-Updates
	 */
	async testFieldUpdates() {
		console.log("📝 Teste Feld-Updates...");

		// Finde erstes verfügbares Testfeld
		const testField = document.querySelector('input[id^="aircraft-"]');

		if (!testField) {
			this.addTestResult(
				"Test-Feld verfügbar",
				false,
				"Kein aircraft-Feld gefunden"
			);
			return;
		}

		const originalValue = testField.value;
		const testValue = `TEST-${Date.now()}`;

		try {
			// Simuliere User-Input
			testField.value = testValue;
			testField.dispatchEvent(new Event("input", { bubbles: true }));
			testField.dispatchEvent(new Event("blur", { bubbles: true }));

			// Kurz warten
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Prüfe localStorage
			const localData = JSON.parse(
				localStorage.getItem("hangarPlannerData") || "{}"
			);
			const savedLocally = localData[testField.id] === testValue;

			this.addTestResult(
				"Lokale Speicherung",
				savedLocally,
				savedLocally ? "Feld korrekt gespeichert" : "Feld nicht gespeichert"
			);

			// Wert zurücksetzen
			testField.value = originalValue;
		} catch (error) {
			this.addTestResult("Feld-Update Test", false, error.message);
		}
	}

	/**
	 * Test 4: Daten-Persistenz
	 */
	async testDataPersistence() {
		console.log("💾 Teste Daten-Persistenz...");

		try {
			// Teste collectAllHangarData
			const hasCollectFunction =
				window.hangarData &&
				typeof window.hangarData.collectAllHangarData === "function";

			this.addTestResult(
				"Datensammlung verfügbar",
				hasCollectFunction,
				hasCollectFunction ? "collectAllHangarData gefunden" : "Funktion fehlt"
			);

			if (hasCollectFunction) {
				const collectedData = window.hangarData.collectAllHangarData();
				const hasValidData =
					collectedData &&
					collectedData.metadata &&
					(collectedData.primaryTiles || collectedData.secondaryTiles);

				this.addTestResult(
					"Daten sammelbar",
					hasValidData,
					hasValidData
						? `${collectedData.primaryTiles?.length || 0} primäre, ${
								collectedData.secondaryTiles?.length || 0
						  } sekundäre Tiles`
						: "Keine gültigen Daten"
				);
			}
		} catch (error) {
			this.addTestResult("Daten-Persistenz Test", false, error.message);
		}
	}

	/**
	 * Hilfsfunktion: Test-Ergebnis hinzufügen
	 */
	addTestResult(name, success, details = "") {
		this.testResults.push({
			name,
			success,
			details,
			timestamp: new Date().toISOString(),
		});

		const icon = success ? "✅" : "❌";
		console.log(`${icon} ${name}: ${details}`);
	}

	/**
	 * Test-Ergebnisse anzeigen
	 */
	showTestResults() {
		console.log("\n📊 TEST-ERGEBNISSE:");
		console.log("=".repeat(50));

		const passed = this.testResults.filter((r) => r.success).length;
		const total = this.testResults.length;

		console.log(`Gesamt: ${passed}/${total} Tests bestanden`);
		console.log("");

		this.testResults.forEach((result) => {
			const status = result.success ? "PASS" : "FAIL";
			console.log(`[${status}] ${result.name}: ${result.details}`);
		});

		console.log("=".repeat(50));

		// Zeige auch im Browser
		this.showResultsInBrowser();
	}

	/**
	 * Zeigt Ergebnisse im Browser an
	 */
	showResultsInBrowser() {
		const passed = this.testResults.filter((r) => r.success).length;
		const total = this.testResults.length;

		const message = `Server-Sync Test Ergebnisse:\n${passed}/${total} Tests bestanden\n\nDetaillierte Ergebnisse in der Browser-Konsole.`;

		if (passed === total) {
			alert("✅ " + message);
		} else {
			alert("⚠️ " + message);
		}
	}

	/**
	 * Einfacher Test für manuelle Ausführung
	 */
	async quickTest() {
		console.log("⚡ Schneller Server-Sync Test...");

		const checks = [
			{ name: "Event-Manager", test: () => !!window.hangarEventManager },
			{ name: "Server-Sync", test: () => !!window.storageBrowser },
			{
				name: "Datensammlung",
				test: () => !!window.hangarData?.collectAllHangarData,
			},
			{
				name: "Input-Felder",
				test: () =>
					document.querySelectorAll('input[id^="aircraft-"]').length > 0,
			},
		];

		checks.forEach((check) => {
			const result = check.test();
			console.log(
				`${result ? "✅" : "❌"} ${check.name}: ${result ? "OK" : "FEHLT"}`
			);
		});
	}
}

// Globale Instanz erstellen
window.serverSyncValidator = new ServerSyncValidator();

// Auto-Test nach 5 Sekunden (nur wenn debug=true in URL)
if (window.location.search.includes("debug=true")) {
	setTimeout(() => {
		window.serverSyncValidator.runFullTest();
	}, 5000);
}

console.log(
	"🧪 Server-Sync Validator geladen. Verwende: window.serverSyncValidator.runFullTest()"
);
