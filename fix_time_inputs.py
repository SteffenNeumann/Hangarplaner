#!/usr/bin/env python3
"""
Skript zur Korrektur aller Zeit-Eingabefelder in index.html
"""

import re

# Lese index.html
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Patterns für arrival-time und departure-time Felder (6-12)
for i in range(6, 13):
    # Korrigiere arrival-time
    pattern_arrival = rf'type="text"\s*id="arrival-time-{i}"'
    replacement_arrival = f'type="time" id="arrival-time-{i}"'
    content = re.sub(pattern_arrival, replacement_arrival, content)
    
    # Korrigiere departure-time
    pattern_departure = rf'type="text"\s*id="departure-time-{i}"'
    replacement_departure = f'type="time" id="departure-time-{i}"'
    content = re.sub(pattern_departure, replacement_departure, content)

# Schreibe die korrigierte Datei
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Alle Zeit-Eingabefelder wurden von type='text' zu type='time' korrigiert.")
