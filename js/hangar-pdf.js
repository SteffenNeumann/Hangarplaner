/**
 * hangar-pdf.js
 * Enthält Funktionalität für PDF-Export im HangarPlanner
 * ÜBERARBEITET: Tabellarische Struktur statt Kachel-Kopien
 */

/**
 * Utility: read a date/time input and return an ISO local datetime (YYYY-MM-DDTHH:mm)
 * Handles values typed as:
 *  - dataset.iso (preferred, set by helpers on blur or picker)
 *  - dd.mm.yy,HH:mm (compact) → parsed via helpers.parseCompactToISOUTC
 *  - HH:mm (time-only) → canonicalized via helpers.canonicalizeDateTimeFieldValue using base date
 *  - or an ISO value already in the input
 */
function readDateTimeISO(inputEl, fieldId){
	if (!inputEl) return "";
	const h = (window.helpers || {});
	// 1) Prefer ISO stored in dataset by our masking logic
	if (inputEl.dataset && inputEl.dataset.iso && typeof h.isISODateTimeLocal === 'function' && h.isISODateTimeLocal(inputEl.dataset.iso)){
		return inputEl.dataset.iso;
	}
	const raw = (inputEl.value || '').trim();
	if (!raw) return "";
	// If it's already ISO
	if (typeof h.isISODateTimeLocal === 'function' && h.isISODateTimeLocal(raw)) return raw;
	// dd.mm.yy,HH:mm
	if (typeof h.isCompactDateTime === 'function' && h.isCompactDateTime(raw) && typeof h.parseCompactToISOUTC === 'function'){
		return h.parseCompactToISOUTC(raw) || "";
	}
	// HH:mm
	if (typeof h.isHHmm === 'function' && h.isHHmm(raw) && typeof h.canonicalizeDateTimeFieldValue === 'function'){
		return h.canonicalizeDateTimeFieldValue(fieldId, raw) || "";
	}
	return "";
}

/**
 * Sammelt alle Daten aus den Kacheln (primär und sekundär)
 */
function collectAllHangarData() {
	const data = {
		primary: [],
		secondary: [],
	};

	// Primäre Kacheln (1-12)
	for (let i = 1; i <= 12; i++) {
		const aircraftField = document.getElementById(`aircraft-${i}`);
		const arrivalField = document.getElementById(`arrival-time-${i}`);
		const departureField = document.getElementById(`departure-time-${i}`);
		const positionField = document.getElementById(`position-${i}`);
		const hangarPosField = document.getElementById(`hangar-position-${i}`);
		const statusField = document.getElementById(`status-${i}`);
		const towField = document.getElementById(`tow-status-${i}`);
		const notesField = document.getElementById(`notes-${i}`);

		// Nur Kacheln mit Aircraft-ID hinzufügen
		if (
			aircraftField &&
			aircraftField.value &&
			aircraftField.value.trim() !== ""
		) {
			const arrivalIso = readDateTimeISO(arrivalField, `arrival-time-${i}`);
			const departureIso = readDateTimeISO(departureField, `departure-time-${i}`);
			data.primary.push({
				id: i,
				aircraft: aircraftField.value.trim(),
				arrival: arrivalIso,
				departure: departureIso,
				position: positionField ? positionField.value : "",
				hangarPosition: hangarPosField ? hangarPosField.value : "",
				status: statusField ? statusField.value : "neutral",
				tow: towField ? towField.value : "neutral",
				notes: notesField ? notesField.value : "",
			});
		}
	}

	// Sekundäre Kacheln (101+)
	for (let i = 101; i <= 120; i++) {
		const aircraftField = document.getElementById(`aircraft-${i}`);
		const arrivalField = document.getElementById(`arrival-time-${i}`);
		const departureField = document.getElementById(`departure-time-${i}`);
		const positionField = document.getElementById(`position-${i}`);
		const hangarPosField = document.getElementById(`hangar-position-${i}`);
		const statusField = document.getElementById(`status-${i}`);
		const towField = document.getElementById(`tow-status-${i}`);
		const notesField = document.getElementById(`notes-${i}`);

		// Nur Kacheln mit Aircraft-ID hinzufügen
		if (
			aircraftField &&
			aircraftField.value &&
			aircraftField.value.trim() !== ""
		) {
			const arrivalIso = readDateTimeISO(arrivalField, `arrival-time-${i}`);
			const departureIso = readDateTimeISO(departureField, `departure-time-${i}`);
			data.secondary.push({
				id: i,
				aircraft: aircraftField.value.trim(),
				arrival: arrivalIso,
				departure: departureIso,
				position: positionField ? positionField.value : "",
				hangarPosition: hangarPosField ? hangarPosField.value : "",
				status: statusField ? statusField.value : "neutral",
				tow: towField ? towField.value : "neutral",
				notes: notesField ? notesField.value : "",
			});
		}
	}

	console.log(
		`📊 Gesammelte Daten: ${data.primary.length} primäre, ${data.secondary.length} sekundäre Einträge`
	);
	return data;
}

/**
 * Erstellt eine Daten-Tabelle für den PDF Export
 */
function createDataTable(data, title, options = {}) {
	const {
		includeNotes = true,
		exportFields = {
			aircraft: true,
			arrival: true,
			departure: true,
			position: true,
			hangarPosition: true,
			status: true,
			towStatus: true,
			notes: true,
		},
	} = options;

	if (!data || data.length === 0) {
		return null;
	}

	// Container
	const container = document.createElement("div");
	container.style.cssText = "margin-bottom: 30px; page-break-inside: avoid;";

	// Titel
	const titleElement = document.createElement("h2");
	titleElement.textContent = title;
	titleElement.style.cssText = `
        margin: 0 0 15px 0;
        font-size: 18px;
        font-weight: bold;
        color: #333;
        border-bottom: 2px solid #4CAF50;
        padding-bottom: 5px;
    `;
	container.appendChild(titleElement);

	// Tabelle
	const table = document.createElement("table");
	table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
        font-size: 11px;
    `;

	// Header
	const thead = document.createElement("thead");
	const headerRow = document.createElement("tr");
	headerRow.style.cssText = "background-color: #4CAF50; color: white;";

	// Dynamische Header basierend auf Feldauswahl
	const headers = [];
	if (exportFields.aircraft) headers.push("AC-ID");
	if (exportFields.arrival) headers.push("Arr");
	if (exportFields.departure) headers.push("Dep");
	if (exportFields.position) headers.push("Pos");
	if (exportFields.hangarPosition) headers.push("Hangar-Pos");
	if (exportFields.status) headers.push("Status");
	if (exportFields.towStatus) headers.push("Tow");
	if (exportFields.notes && includeNotes) headers.push("Notes");

	headers.forEach((header) => {
		const th = document.createElement("th");
		th.textContent = header;
		th.style.cssText = `
            padding: 8px;
            border: 1px solid #ddd;
            text-align: left;
            font-weight: bold;
        `;
		headerRow.appendChild(th);
	});

	// Ensure table text color is readable regardless of theme
	try {
		container.style.color = '#111827';
		table.style.color = '#111827';
		thead.style.color = '#ffffff';
	} catch (e) { /* noop */ }

	thead.appendChild(headerRow);
	table.appendChild(thead);

	// Body
	const tbody = document.createElement("tbody");

	data.forEach((row, index) => {
		const tr = document.createElement("tr");
		tr.style.cssText = `
            background-color: ${index % 2 === 0 ? "#f9f9f9" : "white"};
        `;

		// Erstelle Zellen basierend auf Feldauswahl
		const cells = [];
		if (exportFields.aircraft) cells.push(row.aircraft);
		const toPDF = (v) => {
			const h = (window.helpers || {});
			if (!v) return "";
			// If we were passed ISO, format to compact for PDF
			if (typeof h.isISODateTimeLocal === 'function' && h.isISODateTimeLocal(v) && typeof h.formatDateTimeLocalForPdf === 'function'){
				return h.formatDateTimeLocalForPdf(v);
			}
			// If somehow a compact slipped through, keep it as-is
			if (typeof h.isCompactDateTime === 'function' && h.isCompactDateTime(v)) return v;
			// If it's HH:mm only, just return as-is
			if (typeof h.isHHmm === 'function' && h.isHHmm(v)) return v;
			return v || "";
		};
		if (exportFields.arrival) cells.push(toPDF(row.arrival));
		if (exportFields.departure) cells.push(toPDF(row.departure));
		if (exportFields.position) cells.push(row.position);
		if (exportFields.hangarPosition) cells.push(row.hangarPosition);
		if (exportFields.status) cells.push(getStatusText(row.status));
		if (exportFields.towStatus) cells.push(getTowText(row.tow));
		if (exportFields.notes && includeNotes) cells.push(row.notes);

		cells.forEach((cellText) => {
			const td = document.createElement("td");
			td.textContent = cellText;
			td.style.cssText = `
                padding: 6px 8px;
                border: 1px solid #ddd;
                vertical-align: top;
                word-wrap: break-word;
            `;
			tr.appendChild(td);
		});

		tbody.appendChild(tr);
	});

	table.appendChild(tbody);
	container.appendChild(table);

	return container;
}

/**
 * Hilfsfunktion: Status-Text
 */
function getStatusText(status) {
	const statusMap = {
		neutral: "",
		ready: "Ready",
		maintenance: "MX",
		aog: "AOG",
	};
	return statusMap[status] || status;
}

/**
 * Hilfsfunktion: Tow-Status-Text
 */
function getTowText(tow) {
	const towMap = {
		neutral: "",
		initiated: "Initiated",
		ongoing: "In Progress",
		"on-position": "On Position",
	};
	return towMap[tow] || tow;
}

/**
 * Exportiert den aktuellen Hangarplan als PDF (neue tabellarische Version)
 */
function exportToPDF() {
	const filename =
		document.getElementById("pdfFilename").value || "Hangar_Plan";
	const landscapeMode = document.getElementById("landscapeMode").checked;

	// Temporarily disable dark mode during export to avoid inherited dark styles
	// affecting the hidden export DOM (prevents low-contrast text in PDFs)
	const htmlEl = document.documentElement;
	const bodyEl = document.body || document.querySelector('body');
	const hadDarkHtml = htmlEl && htmlEl.classList.contains('dark-mode');
	const hadDarkBody = bodyEl && bodyEl.classList.contains('dark-mode');
	try {
		if (hadDarkHtml) htmlEl.classList.remove('dark-mode');
		if (hadDarkBody) bodyEl.classList.remove('dark-mode');
	} catch (e) {
		/* noop */
	}

	// Lese Feldauswahl
	const exportFields = {
		aircraft: document.getElementById("exportAircraft").checked,
		arrival: document.getElementById("exportArrival").checked,
		departure: document.getElementById("exportDeparture").checked,
		position: document.getElementById("exportPosition").checked,
		hangarPosition: document.getElementById("exportHangarPosition").checked,
		status: document.getElementById("exportStatus").checked,
		towStatus: document.getElementById("exportTowStatus").checked,
		notes: document.getElementById("exportNotes").checked,
	};

	// Include notes basiert jetzt auf der Feldauswahl
	const includeNotes = exportFields.notes;

	console.log(
		`📄 Starte tabellarischen PDF Export: ${filename}`,
		"Felder:",
		exportFields
	);

	// Sammle alle Daten
	const allData = collectAllHangarData();

	// Erstelle Export-Container
	const exportContainer = document.createElement("div");
	exportContainer.className = "pdf-content pdf-force-light";
	exportContainer.style.cssText = `
        padding: 20px;
        background-color: white !important;
        color: #111827 !important;
        font-family: Arial, sans-serif;
        width: 100%;
        margin: 0 auto;
        max-width: ${landscapeMode ? "1100px" : "900px"};
        color-scheme: light !important;
        filter: none !important;
    `;

	// Inject a local style block to aggressively force light theme inside the export subtree
	const lightStyle = document.createElement('style');
	lightStyle.textContent = `
      .pdf-force-light, .pdf-force-light * { 
        color-scheme: light !important; 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
        background: #ffffff !important; 
        color: #111827 !important; 
        filter: none !important; 
        text-shadow: none !important; 
      }
      .pdf-force-light h1, .pdf-force-light h2, .pdf-force-light p { color: #111827 !important; }
      .pdf-force-light table { border-collapse: collapse; width: 100%; }
      .pdf-force-light th { color: #ffffff !important; background-color: #4CAF50 !important; }
      .pdf-force-light td { color: #111827 !important; border-color: #dddddd !important; }
      .pdf-force-light tbody tr:nth-child(even) { background-color: #f9f9f9 !important; }
    `;
	exportContainer.appendChild(lightStyle);

	// Titel
	const title = document.createElement("h1");
	title.textContent =
		document.getElementById("projectName").value || "Hangar Plan";
	title.style.cssText = `
        font-size: 24px;
        font-weight: bold;
        margin-bottom: 15px;
        text-align: center;
        color: #2D3142;
    `;
	exportContainer.appendChild(title);

	// Datum
	const dateElement = document.createElement("p");
	dateElement.textContent = "Date: " + new Date().toLocaleDateString();
	dateElement.style.cssText = `
        font-size: 14px;
        margin-bottom: 20px;
        text-align: center;
        color: #4F5D75;
    `;
	exportContainer.appendChild(dateElement);

	// Primäre Sektion
	if (allData.primary.length > 0) {
		const primaryTable = createDataTable(allData.primary, "Primary Section", {
			includeNotes,
			exportFields,
		});
		if (primaryTable) {
			exportContainer.appendChild(primaryTable);
		}
	}

	// Sekundäre Sektion
	if (allData.secondary.length > 0) {
		const secondaryTable = createDataTable(
			allData.secondary,
			"Secondary Section",
			{
				includeNotes,
				exportFields,
			}
		);
		if (secondaryTable) {
			exportContainer.appendChild(secondaryTable);
		}
	}

	// Falls keine Daten vorhanden
	if (allData.primary.length === 0 && allData.secondary.length === 0) {
		const noDataMessage = document.createElement("p");
		noDataMessage.textContent = "No aircraft data available for export.";
		noDataMessage.style.cssText = `
            font-size: 16px;
            text-align: center;
            color: #666;
            margin: 40px 0;
        `;
		exportContainer.appendChild(noDataMessage);
	}

	// Footer
	const footerElement = document.createElement("div");
	footerElement.style.cssText = `
        margin-top: 30px;
        text-align: center;
        font-size: 10px;
        color: #4F5D75;
    `;
	footerElement.textContent = `© ${new Date().getFullYear()} HangarPlanner`;
	exportContainer.appendChild(footerElement);

	// PDF-Optionen
	const options = {
		margin: [10, 10],
		filename: `${filename}.pdf`,
		image: { type: "jpeg", quality: 0.98 },
		html2canvas: {
			scale: 2,
			logging: false,
			letterRendering: true,
			useCORS: true,
			allowTaint: true,
			width: landscapeMode ? 1100 : 900,
		},
		jsPDF: {
			unit: "mm",
			format: "a4",
			orientation: landscapeMode ? "landscape" : "portrait",
			compress: true,
			precision: 2,
		},
	};

	// Benachrichtigung und Export
	window.showNotification("PDF wird erstellt...", "info");

	const worker = html2pdf()
		.from(exportContainer)
		.set(options)
		.save();

	worker
		.then(() => {
			window.showNotification("PDF erfolgreich erstellt!", "success");
			console.log("✅ Tabellarischer PDF Export abgeschlossen");
		})
		.catch((error) => {
			console.error("PDF-Export fehlgeschlagen:", error);
			window.showNotification(
				"PDF-Export fehlgeschlagen: " + error.message,
				"error"
			);
		})
		.finally(() => {
			// Restore dark mode state
			try {
				if (hadDarkHtml) htmlEl.classList.add('dark-mode');
				if (hadDarkBody) bodyEl.classList.add('dark-mode');
			} catch (e) { /* noop */ }
		});
}

// Exportiere die Funktion als globales Objekt
window.hangarPDF = {
	exportToPDF,
	collectAllHangarData,
	createDataTable,
};
