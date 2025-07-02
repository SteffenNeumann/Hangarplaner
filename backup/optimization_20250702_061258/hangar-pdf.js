/**
 * hangar-pdf.js
 * Enthält Funktionalität für PDF-Export im HangarPlanner
 */

/**
 * Exportiert den aktuellen Hangarplan als PDF
 */
function exportToPDF() {
    const filename = document.getElementById('pdfFilename').value || 'Hangar_Plan';
    const includeNotes = document.getElementById('includeNotes').checked;
    const landscapeMode = document.getElementById('landscapeMode').checked;
    
    // Erstelle eine Kopie des hangarGrid für den Export
    const originalGrid = document.getElementById('hangarGrid');
    const exportContainer = document.createElement('div');
    exportContainer.className = 'pdf-content';
    
    // Füge Titel hinzu
    const title = document.createElement('h1');
    title.textContent = document.getElementById('projectName').value || 'Hangar Plan';
    title.style.fontSize = '24px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '15px';
    title.style.textAlign = 'center';
    title.style.color = '#2D3142';
    exportContainer.appendChild(title);
    
    // Datum hinzufügen
    const dateElement = document.createElement('p');
    dateElement.textContent = 'Date: ' + new Date().toLocaleDateString();
    dateElement.style.fontSize = '14px';
    dateElement.style.marginBottom = '20px';
    dateElement.style.textAlign = 'center';
    dateElement.style.color = '#4F5D75';
    exportContainer.appendChild(dateElement);
    
    // Grid-Container erstellen mit angepasstem Layout für PDF
    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    
    // Angepasste Spaltenanzahl je nach Modus und Anzahl der Kacheln
    const visibleCells = Array.from(originalGrid.children).filter(cell => !cell.classList.contains('hidden'));
    const cellCount = visibleCells.length;
    
    // Bestimme optimale Spaltenanzahl basierend auf Anzahl der sichtbaren Zellen
    let columns;
    if (landscapeMode) {
        columns = cellCount <= 2 ? cellCount : cellCount <= 4 ? 2 : cellCount <= 6 ? 3 : 4;
    } else {
        columns = cellCount <= 2 ? cellCount : 2; // Im Hochformat maximal 2 Spalten
    }
    
    gridContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    gridContainer.style.gap = '10px';
    gridContainer.style.width = '100%';
    gridContainer.style.maxWidth = landscapeMode ? '1000px' : '800px';
    gridContainer.style.margin = '0 auto';
    
    // Nur sichtbare Kacheln kopieren
    visibleCells.forEach(cell => {
        const cellClone = cell.cloneNode(true);
        cellClone.style.breakInside = 'avoid';
        cellClone.style.pageBreakInside = 'avoid';
        cellClone.style.width = '100%';
        
        // Vereinfache und optimiere für PDF
        const headerElement = cellClone.querySelector('[class*="bg-industrial-medium"]');
        if (headerElement) {
            headerElement.style.backgroundColor = '#4F5D75';
            headerElement.style.color = 'white';
            headerElement.style.padding = '8px';
            headerElement.style.borderTopLeftRadius = '8px';
            headerElement.style.borderTopRightRadius = '8px';
            
            // Position-Anzeige optimieren
            const positionElement = headerElement.querySelector('[class*="text-xs text-white"]');
            if (positionElement) {
                positionElement.style.fontSize = '11px';
                positionElement.style.whiteSpace = 'nowrap';
            }
            
            // Input-Felder für bessere PDF-Darstellung optimieren
            const inputs = headerElement.querySelectorAll('input');
            inputs.forEach(input => {
                input.style.width = input.classList.contains('w-10') ? '30px' : '90px';
                input.style.backgroundColor = '#3A4154';
                input.style.padding = '2px 4px';
                input.style.fontSize = '11px';
            });
        }
        
        // Status Lichter
        const statusLights = cellClone.querySelectorAll('.status-light');
        statusLights.forEach(light => {
            if (!light.classList.contains('active')) {
                light.style.display = 'none'; // Nur aktiven Status anzeigen
            } else {
                light.style.boxShadow = 'none';
                light.style.transform = 'none'; // Entferne Skalierung
            }
        });
        
        // Aircraft ID optimieren
        const aircraftId = cellClone.querySelector('.aircraft-id');
        if (aircraftId) {
            aircraftId.style.fontSize = '16px';
            aircraftId.style.padding = '4px 0';
            aircraftId.style.borderBottomWidth = '1px';
        }
        
        // Info-Grid optimieren
        const infoGrid = cellClone.querySelector('.info-grid');
        if (infoGrid) {
            infoGrid.style.fontSize = '12px';
            infoGrid.style.gap = '3px';
            infoGrid.style.maxWidth = '100%';
        }
        
        // Entferne Notizbereich wenn nicht gewünscht
        if (!includeNotes) {
            const notesContainer = cellClone.querySelector('.notes-container');
            if (notesContainer) notesContainer.remove();
        } else {
            // Notizen optimieren
            const notesContainer = cellClone.querySelector('.notes-container');
            if (notesContainer) {
                notesContainer.style.minHeight = '40px';
                const notesLabel = notesContainer.querySelector('label');
                if (notesLabel) notesLabel.style.fontSize = '11px';
                const textarea = notesContainer.querySelector('textarea');
                if (textarea) {
                    textarea.style.fontSize = '11px';
                    textarea.style.minHeight = '30px';
                }
            }
        }
        
        // Entferne Status-Selector aus dem Export
        const statusSelector = cellClone.querySelector('select');
        if (statusSelector) statusSelector.parentElement.remove();
        
        // Hauptbereich für PDF optimieren
        const mainArea = cellClone.querySelector('.p-4');
        if (mainArea) {
            mainArea.style.backgroundColor = 'white';
            mainArea.style.color = 'black';
            mainArea.style.borderBottomLeftRadius = '8px';
            mainArea.style.borderBottomRightRadius = '8px';
            mainArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            mainArea.style.padding = '8px 10px';
        }
        
        gridContainer.appendChild(cellClone);
    });
    
    exportContainer.appendChild(gridContainer);
    
    // Sekundären Grid hinzufügen, falls sichtbar
    const secondaryGrid = document.getElementById('secondaryHangarGrid');
    if (secondaryGrid && secondaryGrid.style.display !== 'none' && secondaryGrid.children.length > 0) {
        // Horizontale Trennlinie hinzufügen
        const divider = document.createElement('hr');
        divider.style.margin = '20px 0';
        divider.style.borderTop = '2px solid #4F5D75';
        divider.style.width = '100%';
        exportContainer.appendChild(divider);
        
        // Sekundäre Kacheln Überschrift
        const secondarySectionTitle = document.createElement('h2');
        secondarySectionTitle.textContent = 'Secondary Section';
        secondarySectionTitle.style.fontSize = '20px';
        secondarySectionTitle.style.margin = '15px 0';
        secondarySectionTitle.style.color = '#2D3142';
        exportContainer.appendChild(secondarySectionTitle);
        
        // Sekundärer Grid-Container
        const secondaryGridContainer = document.createElement('div');
        secondaryGridContainer.style.display = 'grid';
        secondaryGridContainer.style.gridTemplateColumns = gridContainer.style.gridTemplateColumns;
        secondaryGridContainer.style.gap = '10px';
        secondaryGridContainer.style.width = '100%';
        secondaryGridContainer.style.maxWidth = gridContainer.style.maxWidth;
        secondaryGridContainer.style.margin = '0 auto';
        
        // Nur sichtbare sekundäre Kacheln kopieren
        const visibleSecondaryCells = Array.from(secondaryGrid.children).filter(cell => !cell.classList.contains('hidden'));
        visibleSecondaryCells.forEach(cell => {
            const cellClone = cell.cloneNode(true);
            // Die gleiche Styling-Logik wie für primäre Kacheln anwenden
            cellClone.style.breakInside = 'avoid';
            cellClone.style.pageBreakInside = 'avoid';
            cellClone.style.width = '100%';
            
            // Alle gleichen Optimierungen wie bei primären Kacheln anwenden
            const headerElement = cellClone.querySelector('[class*="bg-industrial-medium"]');
            if (headerElement) {
                headerElement.style.backgroundColor = '#4F5D75';
                headerElement.style.color = 'white';
                headerElement.style.padding = '8px';
                headerElement.style.borderTopLeftRadius = '8px';
                headerElement.style.borderTopRightRadius = '8px';
                
                const positionElement = headerElement.querySelector('[class*="text-xs text-white"]');
                if (positionElement) {
                    positionElement.style.fontSize = '11px';
                    positionElement.style.whiteSpace = 'nowrap';
                }
                
                const inputs = headerElement.querySelectorAll('input');
                inputs.forEach(input => {
                    input.style.width = input.classList.contains('w-10') ? '30px' : '90px';
                    input.style.backgroundColor = '#3A4154';
                    input.style.padding = '2px 4px';
                    input.style.fontSize = '11px';
                });
            }
            
            const statusLights = cellClone.querySelectorAll('.status-light');
            statusLights.forEach(light => {
                if (!light.classList.contains('active')) {
                    light.style.display = 'none'; // Nur aktiven Status anzeigen
                } else {
                    light.style.boxShadow = 'none';
                    light.style.transform = 'none'; // Entferne Skalierung
                }
            });
            
            const aircraftId = cellClone.querySelector('.aircraft-id');
            if (aircraftId) {
                aircraftId.style.fontSize = '16px';
                aircraftId.style.padding = '4px 0';
                aircraftId.style.borderBottomWidth = '1px';
            }
            
            const infoGrid = cellClone.querySelector('.info-grid');
            if (infoGrid) {
                infoGrid.style.fontSize = '12px';
                infoGrid.style.gap = '3px';
                infoGrid.style.maxWidth = '100%';
            }
            
            if (!includeNotes) {
                const notesContainer = cellClone.querySelector('.notes-container');
                if (notesContainer) notesContainer.remove();
            } else {
                const notesContainer = cellClone.querySelector('.notes-container');
                if (notesContainer) {
                    notesContainer.style.minHeight = '40px';
                    const notesLabel = notesContainer.querySelector('label');
                    if (notesLabel) notesLabel.style.fontSize = '11px';
                    const textarea = notesContainer.querySelector('textarea');
                    if (textarea) {
                        textarea.style.fontSize = '11px';
                        textarea.style.minHeight = '30px';
                    }
                }
            }
            
            const statusSelector = cellClone.querySelector('select');
            if (statusSelector) statusSelector.parentElement.remove();
            
            const mainArea = cellClone.querySelector('.p-4');
            if (mainArea) {
                mainArea.style.backgroundColor = 'white';
                mainArea.style.color = 'black';
                mainArea.style.borderBottomLeftRadius = '8px';
                mainArea.style.borderBottomRightRadius = '8px';
                mainArea.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                mainArea.style.padding = '8px 10px';
            }
            
            secondaryGridContainer.appendChild(cellClone);
        });
        
        exportContainer.appendChild(secondaryGridContainer);
    }
    
    // Styles für den Export
    exportContainer.style.padding = '20px';
    exportContainer.style.backgroundColor = 'white';
    exportContainer.style.width = '100%';
    exportContainer.style.margin = '0 auto';
    exportContainer.style.maxWidth = landscapeMode ? '1100px' : '900px';
    
    // Footer mit Seitenzahl
    const footerElement = document.createElement('div');
    footerElement.style.marginTop = '30px';
    footerElement.style.textAlign = 'center';
    footerElement.style.fontSize = '10px';
    footerElement.style.color = '#4F5D75';
    footerElement.textContent = `© ${new Date().getFullYear()} HangarPlanner`;
    exportContainer.appendChild(footerElement);
    
    // Konfiguriere und generiere PDF
    const options = {
        margin: [10, 10],
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            logging: false,
            letterRendering: true,
            useCORS: true,
            allowTaint: true,
            width: landscapeMode ? 1100 : 900
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: landscapeMode ? 'landscape' : 'portrait',
            compress: true,
            precision: 2
        }
    };
    
    // Benachrichtigung anzeigen
    window.showNotification("PDF wird erstellt...", "info");
    
    // Erzeuge und downloade PDF
    html2pdf()
        .from(exportContainer)
        .set(options)
        .save()
        .then(() => {
            window.showNotification("PDF erfolgreich erstellt!", "success");
        })
        .catch(error => {
            console.error("PDF-Export fehlgeschlagen:", error);
            window.showNotification("PDF-Export fehlgeschlagen: " + error.message, "error");
        });
}

// Da wir jetzt die direkte PDF-Generation verwenden, benötigen wir die anderen
// Hilfsfunktionen nicht mehr und können sie entfernen oder leer lassen

// Exportiere die Funktion als globales Objekt
window.hangarPDF = {
    exportToPDF
};
