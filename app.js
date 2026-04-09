/**
 * Summit Internet — Address Search & Plan Recommendation
 *
 * Loads pre-parsed JSON from the ownership KMZ data and powers:
 *   1. Fuzzy address autocomplete
 *   2. Property lookup (area_tax → acres, account type)
 *   3. Personalized plan recommendation
 */

// ── Plan Definitions ──────────────────────────────────────────────────────

const PLANS = {
  basecamp: {
    id: 'basecamp',
    name: 'Basecamp',
    price: '$49/mo',
    tagline: 'Your home, reliably connected',
    description: 'Everything you need to stay connected — great for condos, apartments, and smaller homes.',
    anchor: '#plans',
  },
  ridgeline: {
    id: 'ridgeline',
    name: 'Ridgeline',
    price: '$79/mo',
    tagline: 'Work, learn, and play — all at once',
    description: 'Built for busy families and remote workers who need multiple things happening at once.',
    anchor: '#plans',
  },
  peak: {
    id: 'peak',
    name: 'Peak',
    price: '$109/mo',
    tagline: 'Premium coverage, every corner',
    description: 'Maximum whole-home coverage with advanced smart home controls and 24/7 support.',
    anchor: '#plans',
  },
  outdoors: {
    id: 'outdoors',
    name: 'Summit Outdoors',
    price: '$149/mo',
    tagline: 'Your whole property, fully connected',
    description: 'Everything in Peak, plus outdoor WiFi for your deck, yard, outbuildings, and beyond.',
    anchor: '#plans',
  },
};

// ── Recommendation Logic ───────────────────────────────────────────────────

/**
 * Given parcel data, returns { plan, reason, isOutdoorCandidate, acreage }
 */
function recommendPlan(parcel) {
  if (!parcel) {
    return {
      plan: PLANS.ridgeline,
      reason: "We found your address in our service area. Based on typical homes in the area, Ridgeline is a great starting point — you can always upgrade.",
      isOutdoorCandidate: false,
      acreage: null,
    };
  }

  const { ac: acreage, at: acctType } = parcel;
  const isCommercial = /commercial|com vacant/i.test(acctType || '');
  const isLargeProperty = acreage != null && acreage >= 0.5;
  const isVeryLarge = acreage != null && acreage >= 1.5;
  const isSmall = acreage != null && acreage < 0.15;

  if (isCommercial) {
    return {
      plan: PLANS.peak,
      reason: "This looks like a commercial property. Peak gives you maximum coverage, unlimited devices, and the advanced controls businesses need. Ask us about our commercial pricing.",
      isOutdoorCandidate: isLargeProperty,
      acreage,
    };
  }

  if (isVeryLarge) {
    return {
      plan: PLANS.outdoors,
      reason: `Your property is ${formatAcres(acreage)} — Summit Outdoors is built for large properties like yours. You'll get seamless WiFi from the living room to the barn, guest house, or back pasture.`,
      isOutdoorCandidate: true,
      acreage,
    };
  }

  if (isLargeProperty) {
    return {
      plan: PLANS.outdoors,
      reason: `At ${formatAcres(acreage)}, your property has room for outdoor life — and your WiFi should follow you there. Summit Outdoors adds weatherproof outdoor access points so your deck, patio, and yard stay connected.`,
      isOutdoorCandidate: true,
      acreage,
    };
  }

  if (isSmall) {
    return {
      plan: PLANS.basecamp,
      reason: "For a compact home or condo, Basecamp gives you everything you need — reliable whole-home WiFi without paying for coverage you don't need.",
      isOutdoorCandidate: false,
      acreage,
    };
  }

  // Mid-size residential (0.15 – 0.5 acres)
  if (acreage != null && acreage < 0.25) {
    return {
      plan: PLANS.ridgeline,
      reason: `For your home (${formatAcres(acreage)}), Ridgeline covers your whole space comfortably and handles families, remote work, and streaming without breaking a sweat.`,
      isOutdoorCandidate: false,
      acreage,
    };
  }

  // 0.25 – 0.5 acres
  return {
    plan: PLANS.peak,
    reason: `Your property (${formatAcres(acreage)}) has enough space that Peak's maximum mesh coverage is the right fit — every room and every corner, no dead spots.`,
    isOutdoorCandidate: false,
    acreage,
  };
}

function formatAcres(ac) {
  if (ac == null) return 'your property';
  if (ac < 0.1) return `${Math.round(ac * 43560).toLocaleString()} sq ft`;
  return `${ac.toFixed(2)} acres`;
}

// ── Data Loading ───────────────────────────────────────────────────────────

let addressData = null; // [{a, p, t}]
let parcelData  = null; // {pidn: {ac, at, vm}}

async function loadData() {
  if (addressData && parcelData) return;
  try {
    const [aRes, pRes] = await Promise.all([
      fetch('public/data/addresses.json'),
      fetch('public/data/parcels.json'),
    ]);
    addressData = await aRes.json();
    parcelData  = await pRes.json();
  } catch (err) {
    console.error('Failed to load address data:', err);
  }
}

// ── Fuzzy Address Search ──────────────────────────────────────────────────

/**
 * Normalizes a string for matching: uppercase, collapse whitespace,
 * strip punctuation except digits, letters, spaces.
 */
function normalize(s) {
  return s.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Returns up to `limit` address matches for the query string.
 * Strategy: all query tokens must appear in the normalized address.
 * Results are sorted: starts-with first, then contains.
 */
function searchAddresses(query, limit = 8) {
  if (!addressData || query.length < 3) return [];
  const norm = normalize(query);
  const tokens = norm.split(' ').filter(t => t.length > 0);
  if (tokens.length === 0) return [];

  const startsWith = [];
  const contains   = [];

  for (const item of addressData) {
    const addr = normalize(item.a);
    if (tokens.every(t => addr.includes(t))) {
      if (addr.startsWith(tokens[0])) {
        startsWith.push(item);
      } else {
        contains.push(item);
      }
      if (startsWith.length + contains.length >= limit * 3) break;
    }
  }

  return [...startsWith, ...contains].slice(0, limit);
}

// ── Search UI Component ────────────────────────────────────────────────────

class AddressSearch {
  /**
   * @param {HTMLInputElement} input
   * @param {HTMLElement} suggestionsEl
   * @param {HTMLButtonElement} button
   * @param {Function} onSelect  called with (addressItem, parcel, recommendation)
   */
  constructor(input, suggestionsEl, button, onSelect) {
    this.input   = input;
    this.suggestionsEl = suggestionsEl;
    this.button  = button;
    this.onSelect = onSelect;
    this.selected = null;
    this.highlightedIndex = -1;
    this.currentResults = [];

    this._bind();
  }

  _bind() {
    this.input.addEventListener('input', () => this._onInput());
    this.input.addEventListener('keydown', (e) => this._onKeydown(e));
    this.input.addEventListener('blur', () => {
      // Delay so clicks on suggestions register
      setTimeout(() => this._hideSuggestions(), 180);
    });
    this.input.addEventListener('focus', () => {
      if (this.input.value.length >= 3) this._onInput();
    });
    this.button.addEventListener('click', () => this._onSearch());
  }

  async _onInput() {
    await loadData();
    const q = this.input.value.trim();
    if (q.length < 3) { this._hideSuggestions(); return; }

    this.currentResults = searchAddresses(q);
    this._renderSuggestions(this.currentResults);
  }

  _renderSuggestions(results) {
    const el = this.suggestionsEl;
    el.innerHTML = '';
    this.highlightedIndex = -1;

    if (results.length === 0) {
      el.hidden = true;
      this.input.setAttribute('aria-expanded', 'false');
      return;
    }

    results.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.setAttribute('role', 'option');
      div.setAttribute('aria-selected', 'false');
      div.dataset.index = i;
      div.innerHTML = `
        <svg class="sug-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M8 9C9.1 9 10 8.1 10 7C10 5.9 9.1 5 8 5C6.9 5 6 5.9 6 7C6 8.1 6.9 9 8 9Z" stroke="currentColor" stroke-width="1.2"/>
          <path d="M8 2C5.2 2 3 4.2 3 7C3 10.5 8 14 8 14C8 14 13 10.5 13 7C13 4.2 10.8 2 8 2Z" stroke="currentColor" stroke-width="1.2"/>
        </svg>
        <span>${this._highlight(item.a, this.input.value)}</span>`;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._selectItem(item);
      });
      el.appendChild(div);
    });

    el.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  _highlight(address, query) {
    // Highlight matching tokens in address
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return address;
    try {
      return address.replace(new RegExp(`(${escaped.split(/\s+/).join('|')})`, 'gi'),
        '<strong>$1</strong>');
    } catch {
      return address;
    }
  }

  _onKeydown(e) {
    if (!this.currentResults.length) {
      if (e.key === 'Enter') this._onSearch();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._moveHighlight(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._moveHighlight(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.highlightedIndex >= 0) {
        this._selectItem(this.currentResults[this.highlightedIndex]);
      } else {
        this._onSearch();
      }
    } else if (e.key === 'Escape') {
      this._hideSuggestions();
    }
  }

  _moveHighlight(dir) {
    const items = this.suggestionsEl.querySelectorAll('.suggestion-item');
    if (!items.length) return;
    this.highlightedIndex = Math.max(-1,
      Math.min(items.length - 1, this.highlightedIndex + dir));
    items.forEach((el, i) => {
      const active = i === this.highlightedIndex;
      el.setAttribute('aria-selected', active);
      if (active) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  async _onSearch() {
    const q = this.input.value.trim();
    if (!q) return;
    await loadData();
    const results = searchAddresses(q, 1);
    if (results.length > 0) {
      this._selectItem(results[0]);
    } else {
      this._selectItem(null, q);
    }
  }

  _selectItem(item, rawQuery) {
    this._hideSuggestions();
    if (!item) {
      this.onSelect(null, null, null, rawQuery || this.input.value);
      return;
    }
    this.input.value = item.a;
    const parcel = parcelData ? parcelData[item.p] : null;
    const rec = recommendPlan(parcel);
    this.onSelect(item, parcel, rec);
  }

  _hideSuggestions() {
    this.suggestionsEl.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.currentResults = [];
    this.highlightedIndex = -1;
  }
}

// ── Result Renderers ───────────────────────────────────────────────────────

function buildPropertyChips(rec, parcel) {
  const chips = [];

  if (rec.acreage != null) {
    chips.push(`<span class="prop-chip prop-chip-blue">${formatAcres(rec.acreage)}</span>`);
  }

  if (parcel?.at) {
    chips.push(`<span class="prop-chip prop-chip-blue">${parcel.at}</span>`);
  }

  if (rec.isOutdoorCandidate) {
    chips.push(`<span class="prop-chip prop-chip-green">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 14L2 8C2 4.7 4.7 2 8 2C11.3 2 14 4.7 14 8L8 14Z" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      Outdoor WiFi candidate
    </span>`);
  }

  return chips.join('');
}

/**
 * Renders the hero result card (dark glass card below hero)
 */
function renderHeroResult(addressItem, parcel, rec) {
  const resultSection = document.getElementById('address-result');
  const resultCard = document.getElementById('result-card');
  if (!resultSection || !resultCard) return;

  if (!addressItem) {
    resultCard.innerHTML = `
      <div class="result-not-found">
        <strong>Address not found in our service area database</strong>
        <p>We may still serve your location — <a href="#check-address" style="color:var(--sky)">contact us</a> to confirm availability.</p>
      </div>`;
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  const otherPlans = Object.values(PLANS)
    .filter(p => p.id !== rec.plan.id)
    .map(p => `<a href="${p.anchor}" data-plan-link="${p.id}">${p.name}</a>`)
    .join('');

  resultCard.innerHTML = `
    <div class="result-header">
      <div class="result-address-block">
        <h3>${addressItem.a}</h3>
        <p>Teton County, Wyoming · In our service area</p>
        <div class="result-prop-chips">
          ${buildPropertyChips(rec, parcel)}
        </div>
      </div>
    </div>
    <div class="result-recommendation">
      <p class="result-rec-label">Recommended Plan</p>
      <p class="result-rec-name">${rec.plan.name} — ${rec.plan.price}</p>
      <p class="result-rec-reason">${rec.reason}</p>
      <div class="result-rec-actions">
        <a href="${rec.plan.anchor}" class="btn btn-primary btn-sm" data-plan-link="${rec.plan.id}">
          Get ${rec.plan.name}
        </a>
        <a href="#plans" class="btn btn-outline btn-sm">See all plans</a>
      </div>
    </div>
    <div class="result-other-plans">
      <p class="result-other-label">Other plans available at this address:</p>
      <div class="result-other-links">${otherPlans}</div>
    </div>`;

  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Renders the inline result in the "Check Address" section
 */
function renderInlineResult(addressItem, parcel, rec, rawQuery) {
  const el = document.getElementById('check-result');
  if (!el) return;

  if (!addressItem) {
    el.innerHTML = `
      <div class="inline-not-found">
        <strong>Address not found</strong>
        <p>We couldn't find "${rawQuery || ''}" in Teton County. We may still serve your area — give us a call to confirm.</p>
      </div>`;
    return;
  }

  const otherPlans = Object.values(PLANS)
    .filter(p => p.id !== rec.plan.id)
    .map(p => `<a href="${p.anchor}" data-plan-link="${p.id}">${p.name}</a>`)
    .join('');

  el.innerHTML = `
    <div class="inline-result">
      <p class="rec-label">Recommended for ${addressItem.a.split(',')[0]}</p>
      <p class="rec-name">${rec.plan.name} <span style="opacity:.6;font-family:var(--font-sans);font-size:1rem;font-weight:400">${rec.plan.price}</span></p>
      <p class="rec-reason">${rec.reason}</p>
      <div class="result-prop-chips prop-chips">
        ${buildPropertyChips(rec, parcel)}
      </div>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.25rem;">
        <a href="${rec.plan.anchor}" class="btn btn-primary btn-sm" data-plan-link="${rec.plan.id}">
          Get ${rec.plan.name}
        </a>
        <a href="#plans" class="btn btn-sm" style="background:rgba(255,255,255,.12);color:#fff;">
          See all plans
        </a>
      </div>
      <p style="font-size:.8125rem;color:rgba(255,255,255,.4);margin-top:1rem;">
        All plans are available at this address. &nbsp;
        ${otherPlans.length ? `<span style="color:rgba(255,255,255,.5)">Other options: ${otherPlans}</span>` : ''}
      </p>
    </div>`;
}

// ── Plan Card Highlighting ──────────────────────────────────────────────────

function highlightRecommendedPlan(planId) {
  document.querySelectorAll('.plan-card').forEach(card => {
    card.classList.remove('plan-recommended');
    const existingBanner = card.querySelector('.plan-recommended-banner');
    if (existingBanner) existingBanner.remove();
  });

  const card = document.querySelector(`.plan-card[data-plan="${planId}"]`);
  if (!card) return;

  card.classList.add('plan-recommended');
  const banner = document.createElement('div');
  banner.className = 'plan-recommended-banner';
  banner.textContent = 'Recommended for You';
  card.insertBefore(banner, card.firstChild);

  // Remove existing popular badge on Peak if another plan is recommended
  if (planId !== 'peak') {
    const peakBadge = document.querySelector('.plan-card[data-plan="peak"] .plan-popular-badge');
    if (peakBadge) peakBadge.style.display = 'none';
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

function init() {
  // Hero search
  const heroInput = document.getElementById('hero-address-input');
  const heroSuggestions = document.getElementById('address-suggestions');
  const heroBtn = document.getElementById('search-btn');

  if (heroInput && heroSuggestions && heroBtn) {
    new AddressSearch(heroInput, heroSuggestions, heroBtn, (item, parcel, rec, rawQuery) => {
      renderHeroResult(item, parcel, rec, rawQuery);
      if (rec) highlightRecommendedPlan(rec.plan.id);
    });
  }

  // Check Address section search
  const checkInput = document.getElementById('check-address-input');
  const checkSuggestions = document.getElementById('check-suggestions');
  const checkBtn = document.getElementById('check-btn');

  if (checkInput && checkSuggestions && checkBtn) {
    new AddressSearch(checkInput, checkSuggestions, checkBtn, (item, parcel, rec, rawQuery) => {
      renderInlineResult(item, parcel, rec, rawQuery);
      if (rec) highlightRecommendedPlan(rec.plan.id);
    });
  }

  // Preload data in the background after a short delay
  setTimeout(loadData, 1500);
}

document.addEventListener('DOMContentLoaded', init);
