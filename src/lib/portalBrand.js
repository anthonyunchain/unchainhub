// Per-client visual branding for the Client Portal 2.0.
//
// A "brand" overrides the portal's CSS variables (colors, fonts, radii) and
// swaps the topbar wordmark, scoped to the portal page only — the rest of the
// hub is untouched. Resolve by the client's company name (normalised), so a
// new branded client only needs an entry here.
//
// The portal reads its colors from a small set of CSS variables defined in
// src/index.css (--bg, --card, --ink, --muted, --subtle, --divider, --brand,
// --brand-muted, --card-shadow, --urgent-bg, --urgent-text). A brand supplies
// a `light` and `dark` map for those, plus font families and a logo.

const BRANDS = {
  // We Love Finland — olive / sage / paper, Chelsea Market + Inter.
  // Design system sampled from welovefinland.fi.
  welovefinland: {
    name: 'We Love Finland',
    logo:     '/portal-brands/welovefinland/logo-full.png',       // dark mark — on paper grounds
    logoDark: '/portal-brands/welovefinland/logo-full-paper.png', // cream mark — on olive grounds
    fonts: {
      sans:    "'Inter', 'Helvetica Neue', Arial, sans-serif",
      display: "'Chelsea Market', 'Comic Sans MS', cursive",
    },
    light: {
      '--bg':           '#F4F4EC', // paper
      '--card':         '#FBFBF4', // paper-2 (a hair lighter)
      '--ink':          '#1A1A17', // warm near-black
      '--muted':        '#6E6F5E', // ink-3 / metadata
      '--subtle':       '#8A8B76', // stone
      '--divider':      '#DEDCCE', // hairline border
      '--brand':        '#44503C', // olive
      '--brand-muted':  '#E7E9DD', // faint olive fill (active/soft surfaces)
      '--card-shadow':  '0 1px 2px rgba(26,26,23,0.05), 0 1px 1px rgba(26,26,23,0.03)',
      '--urgent-bg':    '#F6E7E2',
      '--urgent-text':  '#A8493C', // danger
    },
    dark: {
      '--bg':           '#23271F', // deep warm olive ground
      '--card':         '#2C3128',
      '--ink':          '#F1F1E6', // paper
      '--muted':        '#A7AB94',
      '--subtle':       '#8A8B76',
      '--divider':      '#3A4033',
      '--brand':        '#5A664E', // olive-500 — dark enough for white text on active pills
      '--brand-muted':  'rgba(199,203,166,0.16)',
      '--card-shadow':  '0 2px 12px rgba(0,0,0,0.40)',
      '--urgent-bg':    '#3A1A14',
      '--urgent-text':  '#E5A599',
    },
  },
};

function normalize(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Resolve the brand for a client, or null for the default Unchain look.
 * @param {{company_name?: string}} client
 */
export function resolvePortalBrand(client) {
  const slug = normalize(client?.company_name);
  const brand = BRANDS[slug];
  return brand ? { slug, ...brand } : null;
}

/**
 * Build the inline style object to apply on the portal root: the brand's
 * color map for the current mode, plus the font variables the portal reads.
 * Returns {} when there is no brand (default look is left to index.css).
 */
export function portalBrandStyle(brand, dark) {
  if (!brand) return {};
  return {
    ...(dark ? brand.dark : brand.light),
    '--portal-sans':    brand.fonts.sans,
    '--portal-display': brand.fonts.display,
  };
}
