#!/bin/bash

echo "=== HANGARPLANNER DETAILANALYSE ==="
echo "Datum: $(date)"
echo ""

echo "1. LOCALSTORAGE USAGE ANALYSE:"
echo "================================"

# Suche nach localStorage Verwendungen
echo "📦 Direkte localStorage Calls:"
grep -rn "localStorage\." js/ --include="*.js" | grep -v "backup/" | head -20

echo ""
echo "📋 localStorage Keys in Verwendung:"
grep -roh "localStorage\.getItem(['\"][^'\"]*['\"])" js/ --include="*.js" | sort | uniq

echo ""
echo "💾 localStorage Set Operations:"
grep -roh "localStorage\.setItem(['\"][^'\"]*['\"]" js/ --include="*.js" | sort | uniq

echo ""
echo "2. SERVER SYNC ANALYSE:"
echo "======================"

echo "🔄 Fetch Calls zu sync/data.php:"
grep -rn "fetch.*sync/data\.php" js/ --include="*.js"

echo ""
echo "📤 POST Requests:"
grep -rn "method.*POST" js/ --include="*.js"

echo ""
echo "3. KRITISCHE FUNKTIONEN:"
echo "========================"

echo "🔧 collectAllHangarData Definitionen:"
grep -rn "function collectAllHangarData\|collectAllHangarData.*=" js/ --include="*.js"

echo ""
echo "💾 saveFlightTimeValueToLocalStorage Definitionen:"
grep -rn "function saveFlightTimeValueToLocalStorage\|saveFlightTimeValueToLocalStorage.*=" js/ --include="*.js"

echo ""
echo "4. EVENT MANAGER ANALYSE:"
echo "========================="

echo "📡 Event Manager Instanzen:"
grep -rn "EventManager\|eventManager" js/ --include="*.js" | head -10

echo ""
echo "🎯 Event Listener Registrierungen:"
grep -rn "addEventListener" js/ --include="*.js" | wc -l
echo "Event Listener Count gefunden"

echo ""
echo "5. DATENFLUSS-ANALYSE:"
echo "====================="

echo "🔄 Migration Scripts:"
ls -la js/*migration* js/*storage*

echo ""
echo "📊 Display Options Usage:"
grep -rn "displayOptions" js/ --include="*.js" | wc -l
echo "displayOptions Referenzen gefunden"

echo ""
echo "6. KONFLIKTE UND WARNUNGEN:"
echo "==========================="

echo "⚠️ Potentielle Konflikte:"
echo "- Mehrfache localStorage Keys für gleiche Daten"
echo "- Gleichzeitige Server und localStorage Speicherung"
echo "- Event-Handler Überschreibungen"

echo ""
echo "🔍 Deprecated localStorage Keys:"
grep -rn "hangarPlannerSettings\|hangarPlannerData" js/ --include="*.js" | wc -l
echo "Deprecated Key-Verwendungen gefunden"

echo ""
echo "=== ANALYSE ABGESCHLOSSEN ==="
