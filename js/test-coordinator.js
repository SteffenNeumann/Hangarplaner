/**
 * FINAL VALIDATION & TEST COORDINATOR
 * Führt alle Tests in der richtigen Reihenfolge aus
 */

class TestCoordinator {
	constructor() {
		this.results = {
			initialization: null,
			systemTest: null,
			comprehensiveValidation: null,
		};
	}

	/**
	 * Führt alle Tests in der richtigen Reihenfolge aus
	 */
	async runAllTests() {
		console.log("🎯 === FINAL TEST SUITE GESTARTET ===");

		try {
			// 1. Warte auf vollständige Initialisierung
			await this.waitForFullInitialization();

			// 2. Führe umfassende Validierung durch
			if (window.validateHangarPlanner) {
				console.log("\n🔍 Starte umfassende Validierung...");
				this.results.comprehensiveValidation =
					await window.validateHangarPlanner();
			} else {
				console.warn("⚠️ Umfassende Validierung nicht verfügbar");
			}

			// 3. Führe System-Test durch
			if (window.runCompleteSystemTest) {
				console.log("\n🧪 Starte vollständigen System-Test...");
				this.results.systemTest = await window.runCompleteSystemTest();
			} else {
				console.warn("⚠️ System-Test nicht verfügbar");
			}

			// 4. Generiere finalen Bericht
			this.generateFinalReport();
		} catch (error) {
			console.error("❌ Fehler während der Test-Ausführung:", error);
		}

		return this.results;
	}

	/**
	 * Wartet auf vollständige Initialisierung aller Komponenten
	 */
	async waitForFullInitialization() {
		console.log("⏳ Warte auf vollständige Initialisierung...");

		const maxWaitTime = 10000; // 10 Sekunden
		const startTime = Date.now();

		while (Date.now() - startTime < maxWaitTime) {
			// Prüfe globale Initialisierung
			const globalInit = window.globalInitialization?.initialized;

			// Prüfe wichtige Module
			const hangarData = window.hangarData?.collectAllHangarData;
			const storageBrowser = window.storageBrowser;
			const systemTest = window.runCompleteSystemTest;
			const validation = window.validateHangarPlanner;

			if (
				globalInit &&
				hangarData &&
				storageBrowser &&
				systemTest &&
				validation
			) {
				console.log("✅ Vollständige Initialisierung abgeschlossen");
				this.results.initialization = {
					status: "success",
					duration: Date.now() - startTime,
					details: "Alle Module erfolgreich geladen",
				};
				return;
			}

			// Warte 100ms vor nächster Prüfung
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		console.warn("⚠️ Timeout bei der Initialisierung");
		this.results.initialization = {
			status: "timeout",
			duration: Date.now() - startTime,
			details: "Nicht alle Module rechtzeitig geladen",
		};
	}

	/**
	 * Generiert einen finalen zusammenfassenden Bericht
	 */
	generateFinalReport() {
		console.log("\n🏁 === FINALER TEST-BERICHT ===");

		// Initialisierungs-Status
		if (this.results.initialization) {
			const init = this.results.initialization;
			console.log(
				`🚀 Initialisierung: ${init.status === "success" ? "✅" : "⚠️"} (${
					init.duration
				}ms)`
			);
			console.log(`   ${init.details}`);
		}

		// Validierungs-Ergebnisse
		if (this.results.comprehensiveValidation) {
			const validation = this.results.comprehensiveValidation;
			const totalTests = Object.values(validation).flat().length;
			const passedTests = Object.values(validation)
				.flat()
				.filter((test) => test.status && test.status.includes("✅")).length;

			console.log(
				`🔍 Umfassende Validierung: ${passedTests}/${totalTests} Tests bestanden`
			);
		}

		// System-Test Ergebnisse
		if (this.results.systemTest) {
			const systemTest = this.results.systemTest;
			const passed = Object.values(systemTest).filter(
				(result) => result === true
			).length;
			const total = Object.keys(systemTest).length;

			console.log(`🧪 System-Test: ${passed}/${total} Module funktionsfähig`);

			// Details
			Object.entries(systemTest).forEach(([module, status]) => {
				console.log(`   ${status ? "✅" : "❌"} ${module}`);
			});
		}

		// Gesamtbewertung
		const allTestsPassed = this.isSystemHealthy();
		console.log(
			`\n🎯 GESAMTBEWERTUNG: ${
				allTestsPassed ? "✅ SYSTEM GESUND" : "⚠️ VERBESSERUNGEN NÖTIG"
			}`
		);

		// Browser-Benachrichtigung
		this.showUserNotification(allTestsPassed);
	}

	/**
	 * Prüft ob das System insgesamt gesund ist
	 */
	isSystemHealthy() {
		// Initialisierung muss erfolgreich sein
		if (this.results.initialization?.status !== "success") {
			return false;
		}

		// System-Test: Mindestens 4 von 5 Modulen müssen funktionieren
		if (this.results.systemTest) {
			const passed = Object.values(this.results.systemTest).filter(
				(result) => result === true
			).length;
			if (passed < 4) {
				return false;
			}
		}

		// Validierung: Mindestens 80% der Tests müssen bestehen
		if (this.results.comprehensiveValidation) {
			const validation = this.results.comprehensiveValidation;
			const totalTests = Object.values(validation).flat().length;
			const passedTests = Object.values(validation)
				.flat()
				.filter((test) => test.status && test.status.includes("✅")).length;

			const successRate = passedTests / totalTests;
			if (successRate < 0.8) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Zeigt eine benutzerfreundliche Benachrichtigung
	 */
	showUserNotification(isHealthy) {
		const initTime = this.results.initialization?.duration || 0;
		const validationResults = this.results.comprehensiveValidation;
		const systemResults = this.results.systemTest;

		let validationSummary = "Nicht durchgeführt";
		if (validationResults) {
			const totalTests = Object.values(validationResults).flat().length;
			const passedTests = Object.values(validationResults)
				.flat()
				.filter((test) => test.status && test.status.includes("✅")).length;
			validationSummary = `${passedTests}/${totalTests} Tests bestanden`;
		}

		let systemSummary = "Nicht durchgeführt";
		if (systemResults) {
			const passed = Object.values(systemResults).filter(
				(result) => result === true
			).length;
			const total = Object.keys(systemResults).length;
			systemSummary = `${passed}/${total} Module funktionsfähig`;
		}

		const message = `
🎯 HANGARPLANNER SYSTEM-STATUS

${isHealthy ? "✅ SYSTEM GESUND" : "⚠️ VERBESSERUNGEN NÖTIG"}

📊 Test-Ergebnisse:
• Initialisierung: ${initTime}ms
• Validierung: ${validationSummary}
• System-Test: ${systemSummary}

${
	isHealthy
		? "🎉 Alle kritischen Funktionen arbeiten korrekt!"
		: "📋 Bitte Konsole für Details prüfen"
}
        `;

		if (typeof window.showNotification === "function") {
			window.showNotification(
				`System-Status: ${isHealthy ? "GESUND" : "VERBESSERUNGEN NÖTIG"}`,
				isHealthy ? "success" : "info"
			);
		}

		// Immer auch Alert für vollständige Info
		alert(message);
	}
}

// Global verfügbar machen
window.TestCoordinator = TestCoordinator;

// Einfacher Aufruf
window.runAllTests = async () => {
	const coordinator = new TestCoordinator();
	return await coordinator.runAllTests();
};

// Automatischer Test-Lauf nach Seitenladen (optional)
window.addEventListener("load", () => {
	setTimeout(() => {
		if (
			confirm(
				"🎯 Soll eine vollständige System-Validierung durchgeführt werden?\n\n(Dies testet alle HangarPlanner-Funktionen)"
			)
		) {
			window.runAllTests();
		}
	}, 3000); // 3 Sekunden nach Seitenladen
});

console.log(
	"🎯 Test-Koordinator geladen - verwende runAllTests() für vollständige Tests"
);
