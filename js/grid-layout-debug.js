// Grid Layout Debug-Skript
console.log('=== Grid Layout Debug ===');

function debugGridLayout() {
    // Check if hangarGrid exists
    const hangarGrid = document.getElementById('hangarGrid');
    const secondaryGrid = document.getElementById('secondaryHangarGrid');
    
    console.log('hangarGrid Element:', hangarGrid);
    console.log('secondaryHangarGrid Element:', secondaryGrid);
    
    if (hangarGrid) {
        console.log('hangarGrid computed styles:', {
            display: getComputedStyle(hangarGrid).display,
            gridTemplateColumns: getComputedStyle(hangarGrid).gridTemplateColumns,
            gap: getComputedStyle(hangarGrid).gap,
            width: getComputedStyle(hangarGrid).width
        });
        
        console.log('hangarGrid inline styles:', {
            display: hangarGrid.style.display,
            gridTemplateColumns: hangarGrid.style.gridTemplateColumns,
            gap: hangarGrid.style.gap,
            width: hangarGrid.style.width
        });
        
        // Check children
        const cells = hangarGrid.querySelectorAll('.hangar-cell');
        console.log(`hangarGrid children count: ${cells.length}`);
        cells.forEach((cell, index) => {
            console.log(`Cell ${index}:`, {
                element: cell,
                visible: !cell.classList.contains('hidden'),
                display: getComputedStyle(cell).display
            });
        });
    }
    
    if (secondaryGrid) {
        console.log('secondaryGrid computed styles:', {
            display: getComputedStyle(secondaryGrid).display,
            gridTemplateColumns: getComputedStyle(secondaryGrid).gridTemplateColumns,
            gap: getComputedStyle(secondaryGrid).gap,
            width: getComputedStyle(secondaryGrid).width
        });
        
        console.log('secondaryGrid inline styles:', {
            display: secondaryGrid.style.display,
            gridTemplateColumns: secondaryGrid.style.gridTemplateColumns,
            gap: secondaryGrid.style.gap,
            width: secondaryGrid.style.width
        });
        
        // Check children
        const secondaryCells = secondaryGrid.querySelectorAll('.hangar-cell');
        console.log(`secondaryGrid children count: ${secondaryCells.length}`);
        secondaryCells.forEach((cell, index) => {
            console.log(`Secondary Cell ${index}:`, {
                element: cell,
                visible: !cell.classList.contains('hidden'),
                display: getComputedStyle(cell).display
            });
        });
    }
    
    // Check if uiSettings exists and is applied
    if (typeof uiSettings !== 'undefined') {
        console.log('uiSettings:', uiSettings);
        console.log('uiSettings.layout:', uiSettings.layout);
        console.log('uiSettings.tilesCount:', uiSettings.tilesCount);
        console.log('uiSettings.secondaryTilesCount:', uiSettings.secondaryTilesCount);
    } else {
        console.log('uiSettings not available');
    }
    
    // Check if grid layout has been applied
    if (hangarGrid && !hangarGrid.style.gridTemplateColumns) {
        console.warn('WARNING: hangarGrid has no gridTemplateColumns set!');
        console.log('Attempting to apply layout...');
        
        // Try to apply default layout
        if (typeof uiSettings !== 'undefined' && uiSettings.apply) {
            uiSettings.apply();
            console.log('uiSettings.apply() called');
        } else {
            // Fallback: set basic grid layout
            hangarGrid.style.gridTemplateColumns = 'repeat(4, minmax(300px, 1fr))';
            console.log('Applied fallback grid layout');
        }
    }
}

// Run debug immediately if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', debugGridLayout);
} else {
    debugGridLayout();
}

// Also run after a short delay to catch any late initialization
setTimeout(debugGridLayout, 1000);

// Export for manual testing
window.debugGridLayout = debugGridLayout;
