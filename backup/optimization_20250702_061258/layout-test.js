// Quick Layout Test Script
console.log("=== LAYOUT TEST GESTARTET ===");

function testLayout() {
	console.log("1. Prüfe HTML-Struktur...");

	const primaryGrid = document.getElementById("hangarGrid");
	const secondaryGrid = document.getElementById("secondaryHangarGrid");

	console.log("Primary Grid:", primaryGrid);
	console.log("Secondary Grid:", secondaryGrid);

	if (primaryGrid) {
		console.log("Primary Grid Classes:", primaryGrid.className);
		console.log("Primary Grid Children:", primaryGrid.children.length);
	}

	if (secondaryGrid) {
		console.log("Secondary Grid Classes:", secondaryGrid.className);
		console.log("Secondary Grid Children:", secondaryGrid.children.length);
	}

	console.log("2. Prüfe Display Options...");
	if (window.displayOptions) {
		console.log("Display Options Status:", window.displayOptions.current);
		console.log("Wende Layout an...");
		window.displayOptions.applyLayout();
	}

	console.log("3. Prüfe UI Settings...");
	if (window.hangarUI && window.hangarUI.uiSettings) {
		console.log("UI Settings:", {
			tilesCount: window.hangarUI.uiSettings.tilesCount,
			secondaryTilesCount: window.hangarUI.uiSettings.secondaryTilesCount,
			layout: window.hangarUI.uiSettings.layout,
		});
	}

	console.log("=== LAYOUT TEST BEENDET ===");
}

// Test nach kurzer Verzögerung ausführen
setTimeout(testLayout, 2000);

// Export für manuellen Test
window.testLayout = testLayout;
