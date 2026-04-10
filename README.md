# Summit Internet

Marketing and plan-selection website for Summit Internet, a broadband provider serving Teton County, Wyoming (Jackson Hole area).

Live: [summitlabs.one](https://summitlabs.one)

## What it does

- Displays four experience-tier service plans (Basecamp, Ridgeline, Peak, Summit Outdoors)
- Lets visitors type their address and get an instant plan recommendation based on their property
- Includes an AI "Trail Guide" that writes a personalized, conversational recommendation using Google Gemini

## How the address search works

All ~14,000 Teton County address points and ~12,000 parcel records load as JSON when the page opens. Search runs entirely in the browser — no backend query. Typing filters the address list in real time by checking that every word in your query appears in the address string.

When you select an address, the site looks up the property's acreage and type from the parcel data and applies simple rules to pick a plan:

| Condition | Recommended Plan |
|---|---|
| ≥ 0.5 acres | Summit Outdoors |
| 0.25–0.5 acres | Peak |
| 0.15–0.25 acres | Ridgeline |
| < 0.15 acres | Basecamp |
| Commercial property | Peak |

The AI Trail Guide button sends the address and parcel data to a Vercel serverless function, which calls the Gemini API to write a warm, plain-language version of that recommendation.

## Project structure

```
├── index.html          # Single-page app (vanilla JS, no framework)
├── app.js              # Address search, plan logic, UI
├── styles.css          # All styles
├── api/
│   └── recommend.js    # Vercel serverless function — calls Gemini API
├── data/
│   ├── addresses.json  # 14k address points (generated)
│   └── parcels.json    # 12k parcel records (generated)
├── parse-kml.js        # One-time script: extracts data from ownership.kmz
├── ownership.kmz       # Source GIS data from Teton County
└── vercel.json         # Vercel config
```

## Setup

### Run locally

```bash
npm run dev
# → http://localhost:3000
```

### Regenerate address/parcel data

If you have an updated `ownership.kmz`:

```bash
# Unzip the KMZ and extract the KML files to /tmp/kmz_inspect/ownership/
unzip ownership.kmz -d /tmp/kmz_inspect/ownership/

# Then run the parser
node parse-kml.js
# → writes data/addresses.json and data/parcels.json
```

### Deploy to Vercel

```bash
vercel
```

Set the `GEMINI_API_KEY` environment variable in your Vercel project settings for the AI Trail Guide to work.

## Data source

Property and address data comes from the Teton County, Wyoming public GIS parcel dataset (`ownership.kmz`). The `parse-kml.js` script extracts address points and parcel records (acreage, property type) into compact JSON files for client-side use.

## Plans

| Plan | Price | Best for |
|---|---|---|
| Basecamp | $49/mo | Condos, apartments, smaller homes |
| Ridgeline | $79/mo | Families, remote workers |
| Peak | $109/mo | Maximum whole-home coverage, smart home |
| Summit Outdoors | $149/mo | Large properties, yards, barns, outbuildings |
