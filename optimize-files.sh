#!/bin/bash

# HangarPlanner Datei-Bereinigung und Optimierung
# Dieses Skript führt eine schrittweise Bereinigung durch

echo "🔧 HangarPlanner Datei-Optimierung gestartet..."
echo "============================================="

# Backup erstellen
BACKUP_DIR="backup/optimization_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r js/ "$BACKUP_DIR/"
echo "✅ Backup erstellt in: $BACKUP_DIR"

# Phase 1: Sofort löschbare Dateien (nach Bestätigung)
echo ""
echo "🗑️ PHASE 1: Redundante Dateien entfernen"
echo "========================================"

REDUNDANT_FILES=(
    "js/event-manager.js"                # Ersetzt durch improved-event-manager.js
    "js/event-handler-hotfix.js"         # Einmalig verwendeter Hotfix
    "js/debug-position-clone.js"         # Spezifisches Debug-Problem  
    "js/layout-test.js"                  # Test-Code
    "js/localStorage-migration.js"       # Nach Migration nicht mehr benötigt
)

echo "Folgende Dateien werden als redundant eingestuft:"
for file in "${REDUNDANT_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  - $file ($(wc -l < "$file") Zeilen)"
    fi
done

read -p "Möchten Sie diese Dateien löschen? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    for file in "${REDUNDANT_FILES[@]}"; do
        if [ -f "$file" ]; then
            rm "$file"
            echo "  ✅ Gelöscht: $file"
        fi
    done
else
    echo "  ⏭️  Übersprungen"
fi

# Phase 2: Debug-Dateien konsolidieren
echo ""
echo "🔧 PHASE 2: Debug-Dateien konsolidieren"
echo "======================================"

DEBUG_FILES=(
    "js/debug-helpers.js"
    "js/grid-layout-debug.js" 
    "js/initialization-debug.js"
    "js/test-helper.js"
)

TOTAL_DEBUG_LINES=0
for file in "${DEBUG_FILES[@]}"; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        TOTAL_DEBUG_LINES=$((TOTAL_DEBUG_LINES + lines))
        echo "  - $file ($lines Zeilen)"
    fi
done

echo "Gesamt Debug-Code: $TOTAL_DEBUG_LINES Zeilen"
read -p "Debug-Dateien in debug-tools.js konsolidieren? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Erstelle konsolidierte Debug-Datei
    echo "/**" > js/debug-tools.js
    echo " * Konsolidierte Debug-Tools für HangarPlanner" >> js/debug-tools.js
    echo " * Zusammengeführt am $(date)" >> js/debug-tools.js
    echo " */" >> js/debug-tools.js
    echo "" >> js/debug-tools.js
    
    for file in "${DEBUG_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo "// === Inhalt von $file ===" >> js/debug-tools.js
            tail -n +2 "$file" >> js/debug-tools.js  # Ohne erste Zeile (falls Header)
            echo "" >> js/debug-tools.js
            rm "$file"
            echo "  ✅ Konsolidiert: $file"
        fi
    done
    echo "  📦 Erstellt: js/debug-tools.js"
else
    echo "  ⏭️  Übersprungen"
fi

# Phase 3: Konflikt-Resolver konsolidieren
echo ""
echo "⚡ PHASE 3: System-Maintenance konsolidieren"
echo "==========================================="

SYSTEM_FILES=(
    "js/conflict-resolver.js"
    "js/system-repair.js"
    "js/system-validator.js"
    "js/sync-diagnosis.js"
)

TOTAL_SYSTEM_LINES=0
for file in "${SYSTEM_FILES[@]}"; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        TOTAL_SYSTEM_LINES=$((TOTAL_SYSTEM_LINES + lines))
        echo "  - $file ($lines Zeilen)"
    fi
done

echo "Gesamt System-Code: $TOTAL_SYSTEM_LINES Zeilen"
read -p "System-Dateien in system-maintenance.js konsolidieren? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "/**" > js/system-maintenance.js
    echo " * Konsolidierte System-Wartung für HangarPlanner" >> js/system-maintenance.js
    echo " * Zusammengeführt am $(date)" >> js/system-maintenance.js
    echo " */" >> js/system-maintenance.js
    echo "" >> js/system-maintenance.js
    
    for file in "${SYSTEM_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo "// === Inhalt von $file ===" >> js/system-maintenance.js
            tail -n +2 "$file" >> js/system-maintenance.js
            echo "" >> js/system-maintenance.js
            rm "$file"
            echo "  ✅ Konsolidiert: $file"
        fi
    done
    echo "  📦 Erstellt: js/system-maintenance.js"
else
    echo "  ⏭️  Übersprungen"
fi

# Statistik nach Optimierung
echo ""
echo "📊 OPTIMIERUNGS-STATISTIK"
echo "========================="

CURRENT_FILES=$(find js/ -name "*.js" | wc -l)
CURRENT_LINES=$(find js/ -name "*.js" -exec wc -l {} + | tail -1 | awk '{print $1}')

echo "Aktuelle JavaScript-Dateien: $CURRENT_FILES"
echo "Aktuelle Zeilen Code: $CURRENT_LINES"
echo ""

# Index.html Update-Vorschlag
echo "🔄 INDEX.HTML UPDATE ERFORDERLICH"
echo "================================="
echo "Die folgenden Script-Tags sollten aus index.html entfernt werden:"

for file in "${REDUNDANT_FILES[@]}"; do
    filename=$(basename "$file")
    echo "  <script src=\"js/$filename\"></script>"
done

echo ""
echo "Falls Debug-/System-Dateien konsolidiert wurden, entsprechende Tags ersetzen:"
echo "  Durch: <script src=\"js/debug-tools.js\"></script>"  
echo "  Durch: <script src=\"js/system-maintenance.js\"></script>"

echo ""
echo "✅ Optimierung abgeschlossen!"
echo "📁 Backup verfügbar in: $BACKUP_DIR"
echo "⚠️  Bitte index.html manuell anpassen"
