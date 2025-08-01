/**
 * Test-Skript für PDF Export-Funktionalität
 * Testet die neue tabellarische PDF-Export-Struktur
 */

// Test-Funktion für tabellarischen PDF Export
function testPDFExport() {
	console.log("🧪 Teste tabellarischen PDF Export...");

	// Teste verschiedene Konfigurationen
	const testConfigurations = [
		{ filename: "Tabular_Portrait_WithNotes", landscape: false, notes: true },
		{ filename: "Tabular_Landscape_WithNotes", landscape: true, notes: true },
		{ filename: "Tabular_Portrait_NoNotes", landscape: false, notes: false },
		{ filename: "Tabular_Landscape_NoNotes", landscape: true, notes: false },
	];

	let testIndex = 0;

	function runNextTest() {
		if (testIndex >= testConfigurations.length) {
			console.log("✅ Alle tabellarischen PDF Export-Tests abgeschlossen");
			return;
		}

		const config = testConfigurations[testIndex];
		console.log(
			`🔧 Teste tabellarische Konfiguration ${testIndex + 1}: ${
				config.filename
			}`
		);

		// Setze Test-Konfiguration
		document.getElementById("pdfFilename").value = config.filename;
		document.getElementById("includeNotes").checked = config.notes;
		document.getElementById("landscapeMode").checked = config.landscape;

		// Führe Export aus
		if (
			window.hangarPDF &&
			typeof window.hangarPDF.exportToPDF === "function"
		) {
			try {
				window.hangarPDF.exportToPDF();
				console.log(`✅ Test ${testIndex + 1} erfolgreich gestartet`);
			} catch (error) {
				console.error(`❌ Test ${testIndex + 1} fehlgeschlagen:`, error);
			}
		} else {
			console.error("❌ PDF Export-Funktion nicht verfügbar");
		}

		testIndex++;

		// Nächsten Test nach Verzögerung ausführen
		setTimeout(runNextTest, 4000); // Längere Verzögerung für Tabellen-Rendering
	}

	// Starte ersten Test
	runNextTest();
}

// Fülle erweiterte Test-Daten ein (mehr Varianz für Tabellen-Test)
function fillTestData() {
	console.log("📝 Fülle erweiterte Test-Daten für Tabellen-Export ein...");

	// Primäre Kacheln mit verschiedenen Status
	const testData = [
		{
			id: 1,
			aircraft: "D-ACKB",
			arr: "14:30",
			dep: "16:45",
			pos: "--",
			hangarPos: "1A",
			status: "ready",
			tow: "neutral",
			notes: "Flight data from API (12:16:09). Ready for departure.",
		},
		{
			id: 2,
			aircraft: "D-AIBM",
			arr: "12:00",
			dep: "08:15",
			pos: "BSL → MUC",
			hangarPos: "2A",
			status: "maintenance",
			tow: "initiated",
			notes: "Under maintenance check. Estimated completion: 18:00.",
		},
		{
			id: 3,
			aircraft: "Aircraft D",
			arr: "",
			dep: "",
			pos: "Ankunft: FCO → MUC",
			hangarPos: "2B",
			status: "neutral",
			tow: "ongoing",
			notes: "Incoming flight, ETA 15:30.",
		},
		{
			id: 4,
			aircraft: "J-KK",
			arr: "06:15",
			dep: "04:50",
			pos: "FMO → MUC",
			hangarPos: "2C",
			status: "aog",
			tow: "on-position",
			notes: "AOG - Engine issue. Awaiting parts delivery.",
		},
		{
			id: 5,
			aircraft: "N12345",
			arr: "09:30",
			dep: "11:15",
			pos: "JFK → MUC",
			hangarPos: "2D",
			status: "ready",
			tow: "neutral",
			notes: "Transatlantic flight. Customs clearance required.",
		},
	];

	testData.forEach((data) => {
		const aircraftField = document.getElementById(`aircraft-${data.id}`);
		const arrField = document.getElementById(`arrival-time-${data.id}`);
		const depField = document.getElementById(`departure-time-${data.id}`);
		const posField = document.getElementById(`position-${data.id}`);
		const hangarPosField = document.getElementById(
			`hangar-position-${data.id}`
		);
		const statusField = document.getElementById(`status-${data.id}`);
		const towField = document.getElementById(`tow-status-${data.id}`);
		const notesField = document.getElementById(`notes-${data.id}`);

		if (aircraftField) aircraftField.value = data.aircraft;
		if (arrField) arrField.value = data.arr;
		if (depField) depField.value = data.dep;
		if (posField) posField.value = data.pos;
		if (hangarPosField) hangarPosField.value = data.hangarPos;
		if (statusField) statusField.value = data.status;
		if (towField) towField.value = data.tow;
		if (notesField) notesField.value = data.notes;
	});

	// Sekundäre Kacheln (falls vorhanden)
	const secondaryTestData = [
		{
			id: 101,
			aircraft: "D-AIEN",
			arr: "13:45",
			dep: "16:20",
			pos: "HAM → MUC",
			hangarPos: "3A",
			status: "ready",
			tow: "neutral",
			notes: "Domestic flight, on schedule.",
		},
		{
			id: 102,
			aircraft: "D-AIBL",
			arr: "10:30",
			dep: "12:45",
			pos: "DUS → MUC",
			hangarPos: "3B",
			status: "maintenance",
			tow: "initiated",
			notes: "Minor technical check in progress.",
		},
	];

	secondaryTestData.forEach((data) => {
		const aircraftField = document.getElementById(`aircraft-${data.id}`);
		const arrField = document.getElementById(`arrival-time-${data.id}`);
		const depField = document.getElementById(`departure-time-${data.id}`);
		const posField = document.getElementById(`position-${data.id}`);
		const hangarPosField = document.getElementById(
			`hangar-position-${data.id}`
		);
		const statusField = document.getElementById(`status-${data.id}`);
		const towField = document.getElementById(`tow-status-${data.id}`);
		const notesField = document.getElementById(`notes-${data.id}`);

		if (aircraftField) aircraftField.value = data.aircraft;
		if (arrField) arrField.value = data.arr;
		if (depField) depField.value = data.dep;
		if (posField) posField.value = data.pos;
		if (hangarPosField) hangarPosField.value = data.hangarPos;
		if (statusField) statusField.value = data.status;
		if (towField) towField.value = data.tow;
		if (notesField) notesField.value = data.notes;
	});

	console.log("✅ Erweiterte Test-Daten für Tabellen-Export eingefüllt");
}

// Test der Datensammlung
function testDataCollection() {
	console.log("🔍 Teste Datensammlung...");

	if (
		window.hangarPDF &&
		typeof window.hangarPDF.collectAllHangarData === "function"
	) {
		const collectedData = window.hangarPDF.collectAllHangarData();

		console.log("📊 Gesammelte Daten:", collectedData);
		console.log(`📈 Primäre Einträge: ${collectedData.primary.length}`);
		console.log(`📈 Sekundäre Einträge: ${collectedData.secondary.length}`);

		// Detaillierte Ausgabe
		collectedData.primary.forEach((entry, index) => {
			console.log(
				`   ${index + 1}. ${entry.aircraft} - ${entry.status} - ${
					entry.hangarPosition
				}`
			);
		});

		collectedData.secondary.forEach((entry, index) => {
			console.log(
				`   S${index + 1}. ${entry.aircraft} - ${entry.status} - ${
					entry.hangarPosition
				}`
			);
		});

		return collectedData;
	} else {
		console.error("❌ Datensammlungs-Funktion nicht verfügbar");
		return null;
	}
}

// Event-Handler für Test-Buttons
function setupTestButtons() {
	// Test-Button erstellen
	const testBtn = document.createElement("button");
	testBtn.textContent = "🧪 Test Tabular PDF";
	testBtn.style.cssText = `
        position: fixed;
        top: 10px;
        right: 120px;
        z-index: 10000;
        padding: 8px 12px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    `;
	testBtn.onclick = testPDFExport;

	// Test-Daten Button
	const fillDataBtn = document.createElement("button");
	fillDataBtn.textContent = "📝 Fill Test Data";
	fillDataBtn.style.cssText = `
        position: fixed;
        top: 45px;
        right: 120px;
        z-index: 10000;
        padding: 8px 12px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    `;
	fillDataBtn.onclick = fillTestData;

	// Datensammlung Test Button
	const dataTestBtn = document.createElement("button");
	dataTestBtn.textContent = "🔍 Test Data Collection";
	dataTestBtn.style.cssText = `
        position: fixed;
        top: 80px;
        right: 120px;
        z-index: 10000;
        padding: 8px 12px;
        background: #f59e0b;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    `;
	dataTestBtn.onclick = testDataCollection;

	document.body.appendChild(testBtn);
	document.body.appendChild(fillDataBtn);
	document.body.appendChild(dataTestBtn);

	console.log("🎮 Tabellarische PDF Export Test-Buttons hinzugefügt");
}

// Initialisierung
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", setupTestButtons);
} else {
	setupTestButtons();
}
