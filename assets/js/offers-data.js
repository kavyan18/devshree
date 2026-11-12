/**
 * Devshree Architectural Hardware & Supplies — Promotional Offers & Hero Carousel Data
 * Stores and manages dynamic promotional slides displayed on the homepage top autoscrolling bar.
 */

const CUSTOM_OFFERS_KEY = 'devshree_custom_offers';

const DEFAULT_OFFERS = [
  {
    id: 'offer-power-tools',
    title: 'Heavy-Duty Power Tools & Industrial Machines',
    tagBadge: 'Festive pricing',
    tagSpec: 'Up to 40% off',
    subtext: 'Starting from ₹849*',
    description: 'Bosch, Stanley & Taparia professional drills, angle grinders & precision sets with official manufacturer warranty.',
    image: 'assets/images/cat_hardware.jpg',
    perks: ['Instant dispatch', 'ISI marked', 'UPI & COD available'],
    ctaText: 'Shop Power Tools',
    ctaLink: '#bestsellers-section',
    categoryFilter: 'cat-hardware',
    active: true,
    order: 1
  },
  {
    id: 'offer-copper-wires',
    title: 'Polycab & Finolex Certified Pure Copper Wires',
    tagBadge: 'Contractor special',
    tagSpec: '15% GST input rebate',
    subtext: 'From ₹1,420 / 90m Coil',
    description: 'Flame retardant concealed wiring bundles, Havells designer switchboards & MCB protection.',
    image: 'assets/images/cat_electrical.jpg',
    perks: ['Bulk rates', 'Official tax invoice', 'Free delivery over ₹1,999'],
    ctaText: 'Explore Electrical Deals',
    ctaLink: '#bestsellers-section',
    categoryFilter: 'cat-electrical',
    active: true,
    order: 2
  },
  {
    id: 'offer-asian-paints',
    title: 'Asian Paints Royale Luxury & Apex Weatherproof',
    tagBadge: 'Interior & exterior',
    tagSpec: 'Up to 30% off',
    subtext: 'Tins starting at ₹420*',
    description: 'Silky interior sheens, waterproof exterior acrylic coats, primers & smooth wall putties.',
    image: 'assets/images/cat_paints.jpg',
    perks: ['10-year weatherproof', 'Machine color tinting', 'High stain resistance'],
    ctaText: 'Shop Paints',
    ctaLink: '#bestsellers-section',
    categoryFilter: 'cat-paints',
    active: true,
    order: 3
  },
  {
    id: 'offer-supreme-cpvc',
    title: 'Supreme CPVC Pipes & Brass Quarter-Turn Faucets',
    tagBadge: 'Plumbing systems',
    tagSpec: 'Up to 35% off',
    subtext: 'Starting at ₹310*',
    description: 'High-pressure SDR-11 pipes, leak-proof solvent cements & solid chrome-plated bib taps.',
    image: 'assets/images/cat_plumbing.jpg',
    perks: ['Zero-leak joint technology', 'Hot & cold water rated', 'Technical sizing support'],
    ctaText: 'Shop Plumbing',
    ctaLink: '#bestsellers-section',
    categoryFilter: 'cat-plumbing',
    active: true,
    order: 4
  }
];

/**
 * Retrieve active offers from localStorage or fallback to defaults
 * @returns {Array} List of offer slides
 */
function getActiveOffers() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CUSTOM_OFFERS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(o => o && o.title);
      }
    }
  } catch (err) {
    console.warn('[Offers Data] Failed to load cached offers:', err);
  }
  return DEFAULT_OFFERS.slice();
}

/**
 * Persist offers to localStorage
 * @param {Array} offers
 */
function saveActiveOffers(offers) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CUSTOM_OFFERS_KEY, JSON.stringify(offers));
    }
  } catch (err) {
    console.warn('[Offers Data] Failed to persist offers:', err);
  }
}

/**
 * Reset offers to the store default promotional slides
 */
function resetOffersToDefault() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CUSTOM_OFFERS_KEY);
    }
  } catch (err) {
    console.warn('[Offers Data] Failed to reset offers:', err);
  }
  return DEFAULT_OFFERS.slice();
}

// Attach to browser global window object
if (typeof window !== 'undefined') {
  window.CUSTOM_OFFERS_KEY = CUSTOM_OFFERS_KEY;
  window.DEFAULT_OFFERS = DEFAULT_OFFERS;
  window.getActiveOffers = getActiveOffers;
  window.saveActiveOffers = saveActiveOffers;
  window.resetOffersToDefault = resetOffersToDefault;
}

export {
  CUSTOM_OFFERS_KEY,
  DEFAULT_OFFERS,
  getActiveOffers,
  saveActiveOffers,
  resetOffersToDefault
};
