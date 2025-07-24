/**
 * TEST SCRIPT: View/Edit Mode Toggle Funktionalität
 * Testet die modeToggle-Implementierung
 */

console.log("🧪 === TEST: VIEW/EDIT MODE TOGGLE ===");

// Warte auf DOM-Laden
document.addEventListener("DOMContentLoaded", function () {
	// Kurze Verzögerung für Initialisierung
	setTimeout(() => {
		testModeToggleFunctionality();
	}, 2000);
});

function testModeToggleFunctionality() {
	console.log("🔍 Teste modeToggle-Funktionalität...");

	const modeToggle = document.getElementById("modeToggle");
	if (!modeToggle) {
		console.error("❌ modeToggle Element nicht gefunden!");
		return;
	}

	const body = document.body;
	console.log("📋 Aktueller Body-Status:", {
		classes: Array.from(body.classList),
		editMode: body.classList.contains("edit-mode"),
		viewMode: body.classList.contains("view-mode"),
		toggleChecked: modeToggle.checked,
	});

	// Test 1: Event-Listener prüfen
	console.log("🧪 Test 1: Event-Listener prüfen...");
	const hasEventListener =
		modeToggle.onchange !== null ||
		modeToggle.getAttribute("data-listener-added") !== null;
	console.log("Event-Listener vorhanden:", hasEventListener);

	// Test 2: Manuelle Toggle-Simulation
	console.log("🧪 Test 2: Toggle-Simulation...");

	// Aktueller Status speichern
	const initialChecked = modeToggle.checked;
	const initialEditMode = body.classList.contains("edit-mode");

	console.log("Initial:", {
		checked: initialChecked,
		editMode: initialEditMode,
	});

	// Toggle umschalten
	modeToggle.checked = !initialChecked;

	// Change-Event manuell auslösen
	const changeEvent = new Event("change", { bubbles: true });
	modeToggle.dispatchEvent(changeEvent);

	// Kurz warten und Status prüfen
	setTimeout(() => {
		const newEditMode = body.classList.contains("edit-mode");
		const newViewMode = body.classList.contains("view-mode");

		console.log("Nach Toggle:", {
			checked: modeToggle.checked,
			editMode: newEditMode,
			viewMode: newViewMode,
		});

		// Test 3: Zurück zum ursprünglichen Zustand
		console.log("🧪 Test 3: Zurück zum ursprünglichen Zustand...");
		modeToggle.checked = initialChecked;
		modeToggle.dispatchEvent(changeEvent);

		setTimeout(() => {
			const finalEditMode = body.classList.contains("edit-mode");
			const finalViewMode = body.classList.contains("view-mode");

			console.log("Final:", {
				checked: modeToggle.checked,
				editMode: finalEditMode,
				viewMode: finalViewMode,
			});

			// Bewertung
			const success = finalEditMode === initialEditMode;
			console.log(success ? "✅ Test ERFOLGREICH!" : "❌ Test FEHLGESCHLAGEN!");

			// Zusätzliche Prüfungen
			testInputFieldBehavior();
		}, 200);
	}, 200);
}

function testInputFieldBehavior() {
	console.log("🧪 Test 4: Input-Feld-Verhalten...");

	const testInput = document.querySelector(
		"#aircraft-1, input[id^='aircraft-']"
	);
	if (!testInput) {
		console.warn("⚠️ Kein Test-Input-Feld gefunden");
		return;
	}

	const body = document.body;
	const modeToggle = document.getElementById("modeToggle");

	// View-Modus setzen
	modeToggle.checked = false;
	modeToggle.dispatchEvent(new Event("change", { bubbles: true }));

	setTimeout(() => {
		const viewModeStyles = window.getComputedStyle(testInput);
		console.log("View-Modus Input-Feld:", {
			pointerEvents: viewModeStyles.pointerEvents,
			backgroundColor: viewModeStyles.backgroundColor,
			borderColor: viewModeStyles.borderColor,
			disabled: testInput.disabled,
		});

		// Edit-Modus setzen
		modeToggle.checked = true;
		modeToggle.dispatchEvent(new Event("change", { bubbles: true }));

		setTimeout(() => {
			const editModeStyles = window.getComputedStyle(testInput);
			console.log("Edit-Modus Input-Feld:", {
				pointerEvents: editModeStyles.pointerEvents,
				backgroundColor: editModeStyles.backgroundColor,
				borderColor: editModeStyles.borderColor,
				disabled: testInput.disabled,
			});

			console.log("🏁 Alle Tests abgeschlossen!");
		}, 200);
	}, 200);
}

// Globale Test-Funktionen
window.testModeToggle = testModeToggleFunctionality;
window.testInputBehavior = testInputFieldBehavior;
