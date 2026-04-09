#!/usr/bin/env node
/**
 * parse-kml.js
 * Extracts address points and parcel ownership data from the KMZ/KML files
 * and writes compact JSON files for use in the Summit website.
 *
 * Usage: node parse-kml.js
 * Output: public/data/addresses.json, public/data/parcels.json
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Simple KML parser (no dependencies) – extracts SchemaData fields
// ---------------------------------------------------------------------------

function extractPlacemarks(kmlText) {
  const placemarks = [];
  const pmRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let pm;
  while ((pm = pmRegex.exec(kmlText)) !== null) {
    const block = pm[1];
    const fields = {};

    // Extract SimpleData fields
    const sdRegex = /<SimpleData name="([^"]+)">([\s\S]*?)<\/SimpleData>/g;
    let sd;
    while ((sd = sdRegex.exec(block)) !== null) {
      fields[sd[1]] = sd[2].trim();
    }

    // Extract coordinates
    const coordMatch = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (coordMatch) {
      // For Points: single coord pair. For Polygons: take first coord pair.
      const raw = coordMatch[1].trim().split(/\s+/)[0];
      const [lng, lat] = raw.split(',').map(Number);
      fields._lng = lng;
      fields._lat = lat;
    }

    placemarks.push(fields);
  }
  return placemarks;
}

// ---------------------------------------------------------------------------
// Area normalization – returns acres (or null if unknown)
// ---------------------------------------------------------------------------

function toAcres(area_tax) {
  // area_tax is always stored in acres in this dataset regardless of valuemeas.
  // valuemeas describes how the assessed VALUE is calculated (per acre, per unit, etc.)
  // not the unit for the area measurement itself.
  const v = parseFloat(area_tax);
  if (isNaN(v) || v <= 0) return null;
  return v;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const KML_DIR   = path.join(__dirname, 'tmp_kml');
const OUT_DIR   = path.join(__dirname, 'data');

// We extracted the KML earlier; use those paths
const ADDR_KML  = '/tmp/kmz_inspect/ownership/address.kml';
const OWN_KML   = '/tmp/kmz_inspect/ownership/ownership.kml';

fs.mkdirSync(OUT_DIR, { recursive: true });

// --- Parse addresses -------------------------------------------------------
console.log('Parsing address.kml…');
const addrText = fs.readFileSync(ADDR_KML, 'utf8');
const addrRaw  = extractPlacemarks(addrText);

const addresses = addrRaw
  .filter(p => p.st_address && p.pidn && p._lat)
  .map(p => ({
    a: p.st_address.trim(),           // full address string
    p: p.pidn.trim(),                 // parcel ID (links to ownership)
    t: [p._lng, p._lat],              // [lng, lat]
  }));

console.log(`  → ${addresses.length} address points`);
fs.writeFileSync(path.join(OUT_DIR, 'addresses.json'), JSON.stringify(addresses));

// --- Parse ownership -------------------------------------------------------
console.log('Parsing ownership.kml…');
const ownText = fs.readFileSync(OWN_KML, 'utf8');
const ownRaw  = extractPlacemarks(ownText);

const parcels = {};
for (const p of ownRaw) {
  if (!p.pidn) continue;
  const acres = toAcres(p.area_tax);
  parcels[p.pidn.trim()] = {
    ac:  acres,                          // area in acres (null if unknown)
    at:  (p.accttype || '').trim(),      // account type (Residential, Commercial…)
    vm:  (p.valuemeas || '').trim(),     // original valuemeas for reference
  };
}

console.log(`  → ${Object.keys(parcels).length} parcels`);
fs.writeFileSync(path.join(OUT_DIR, 'parcels.json'), JSON.stringify(parcels));

console.log('Done. Output written to public/data/');
