/**
 * DEVSHREE — INITIAL MOCK DATA
 * Represents the 4 core product categories, detailed vector product graphics,
 * catalog items, and store metadata for Devshree Hardware & Home Improvement.
 */

// Function to encode SVG cleanly to Data URI
function svgUri(svgString) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.replace(/\s+/g, ' ').trim())}`;
}

// 1. Havells 16A Switch & Socket Graphic
const imgHavellsSwitch = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="hvl-bg" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#EBF1F7"/>
    </radialGradient>
    <filter id="hvl-sh" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#142B45" flood-opacity="0.12"/>
    </filter>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="50%" stop-color="#E2E8F0"/>
      <stop offset="100%" stop-color="#CBD5E1"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#hvl-bg)"/>
  <!-- Modular Faceplate -->
  <rect x="70" y="80" width="260" height="240" rx="16" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2" filter="url(#hvl-sh)"/>
  <rect x="85" y="95" width="230" height="210" rx="8" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
  <!-- Switch 16A (Left) -->
  <rect x="105" y="125" width="65" height="150" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
  <rect x="110" y="130" width="55" height="70" rx="4" fill="url(#metal)"/>
  <circle cx="137" cy="145" r="3.5" fill="#EF4444"/> <!-- Red Indicator LED -->
  <line x1="120" y1="230" x2="155" y2="230" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
  <!-- 3-Pin Socket (Right) -->
  <rect x="195" y="125" width="105" height="150" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>
  <circle cx="247" cy="160" r="14" fill="#334155"/> <!-- Ground pin -->
  <circle cx="225" cy="210" r="10" fill="#334155"/> <!-- Neutral -->
  <circle cx="270" cy="210" r="10" fill="#334155"/> <!-- Phase -->
  <circle cx="247" cy="160" r="8" fill="#0F172A"/>
  <circle cx="225" cy="210" r="6" fill="#0F172A"/>
  <circle cx="270" cy="210" r="6" fill="#0F172A"/>
  <!-- Brand text -->
  <text x="200" y="300" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="11" font-weight="800" fill="#2463A6" letter-spacing="1.5">HAVELLS CORAL 16A</text>
  <rect x="150" y="45" width="100" height="22" rx="11" fill="#EBF3FC"/>
  <text x="200" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#2463A6">ISI MARKED 16A</text>
</svg>`);

// 2. Polycab Copper Wire Coil Graphic
const imgPolycabWire = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="ply-bg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F1F5F9"/>
    </radialGradient>
    <filter id="ply-sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#B91C1C" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#ply-bg)"/>
  <!-- Outer Coil Layers -->
  <ellipse cx="200" cy="205" rx="140" ry="110" fill="#DC2626" filter="url(#ply-sh)"/>
  <ellipse cx="200" cy="200" rx="135" ry="105" fill="#EF4444"/>
  <ellipse cx="200" cy="195" rx="120" ry="92" fill="#B91C1C"/>
  <ellipse cx="200" cy="190" rx="108" ry="80" fill="#DC2626"/>
  <!-- Coil Center Hole -->
  <ellipse cx="200" cy="190" rx="60" ry="42" fill="#F1F5F9" stroke="#991B1B" stroke-width="3"/>
  <!-- Exposed Copper Core -->
  <path d="M 90 160 Q 60 130 50 90" fill="none" stroke="#DC2626" stroke-width="12" stroke-linecap="round"/>
  <path d="M 50 90 Q 48 75 42 55" fill="none" stroke="#D97706" stroke-width="6" stroke-linecap="round"/>
  <circle cx="42" cy="55" r="4" fill="#F59E0B"/>
  <!-- Center Product Brand Card -->
  <rect x="140" y="155" width="120" height="70" rx="6" fill="#FFFFFF" stroke="#DC2626" stroke-width="2"/>
  <text x="200" y="180" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="12" font-weight="900" fill="#DC2626" letter-spacing="1">POLYCAB</text>
  <text x="200" y="196" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9.5" font-weight="700" fill="#1E293B">2.5 SQ.MM FR</text>
  <text x="200" y="212" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="8.5" font-weight="600" fill="#64748B">90 METRES COIL</text>
  <rect x="135" y="40" width="130" height="24" rx="12" fill="#FEF2F2"/>
  <text x="200" y="56" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#DC2626">100% PURE COPPER</text>
</svg>`);

// 3. Schneider Electric MCB Graphic
const imgSchneiderMCB = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="sch-bg" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#EDF6EE"/>
    </radialGradient>
    <filter id="sch-sh">
      <feDropShadow dx="0" dy="12" stdDeviation="15" flood-color="#15803D" flood-opacity="0.15"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#sch-bg)"/>
  <!-- MCB Dual Pole Modular Body -->
  <rect x="130" y="70" width="140" height="260" rx="10" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2" filter="url(#sch-sh)"/>
  <line x1="200" y1="70" x2="200" y2="330" stroke="#E2E8F0" stroke-width="2"/>
  <!-- Terminal Ports Top -->
  <circle cx="165" cy="100" r="14" fill="#334155"/>
  <circle cx="235" cy="100" r="14" fill="#334155"/>
  <circle cx="165" cy="100" r="7" fill="#64748B"/>
  <circle cx="235" cy="100" r="7" fill="#64748B"/>
  <!-- Switch Knobs (Green Schneider theme) -->
  <rect x="150" y="160" width="30" height="75" rx="5" fill="#16A34A"/>
  <rect x="220" y="160" width="30" height="75" rx="5" fill="#16A34A"/>
  <!-- Connecting bridge -->
  <rect x="160" y="185" width="80" height="22" rx="4" fill="#15803D"/>
  <text x="200" y="200" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="800" fill="#FFFFFF">I - ON</text>
  <!-- VisiTrip window -->
  <rect x="155" y="250" width="20" height="12" rx="2" fill="#EF4444"/>
  <rect x="225" y="250" width="20" height="12" rx="2" fill="#EF4444"/>
  <!-- Brand text -->
  <text x="200" y="295" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="11" font-weight="900" fill="#16A34A" letter-spacing="1">Schneider</text>
  <text x="200" y="315" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9" font-weight="700" fill="#475569">Acti9 C32 DP</text>
  <rect x="140" y="35" width="120" height="22" rx="11" fill="#DCFCE7"/>
  <text x="200" y="50" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#16A34A">32A DOUBLE POLE</text>
</svg>`);

// 4. Philips LED Bulb Graphic
const imgPhilipsBulb = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="bulb-glow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="60%" stop-color="#FEF08A" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#EBF4FE"/>
    </radialGradient>
    <linearGradient id="bulb-base" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#94A3B8"/>
      <stop offset="50%" stop-color="#F1F5F9"/>
      <stop offset="100%" stop-color="#64748B"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bulb-glow)"/>
  <!-- Light Glow Circles -->
  <circle cx="200" cy="165" r="105" fill="#FEF9C3" fill-opacity="0.45"/>
  <!-- Frosted Glass Dome -->
  <circle cx="200" cy="160" r="75" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
  <!-- Heat Sink Body -->
  <path d="M 145 190 Q 155 260 170 270 L 230 270 Q 245 260 255 190 Z" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
  <line x1="160" y1="210" x2="240" y2="210" stroke="#E2E8F0" stroke-width="1.5"/>
  <line x1="165" y1="235" x2="235" y2="235" stroke="#E2E8F0" stroke-width="1.5"/>
  <text x="200" y="255" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="11" font-weight="800" fill="#2463A6">PHILIPS 9W</text>
  <!-- B22 Metal Cap Base -->
  <rect x="175" y="270" width="50" height="28" fill="url(#bulb-base)" stroke="#64748B" stroke-width="1.5"/>
  <line x1="175" y1="280" x2="225" y2="280" stroke="#475569" stroke-width="1.5"/>
  <line x1="175" y1="290" x2="225" y2="290" stroke="#475569" stroke-width="1.5"/>
  <!-- B22 side pins -->
  <circle cx="172" cy="284" r="3.5" fill="#475569"/>
  <circle cx="228" cy="284" r="3.5" fill="#475569"/>
  <rect x="145" y="45" width="110" height="22" rx="11" fill="#FEF9C3"/>
  <text x="200" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#854D0E">COOL DAYLIGHT B22</text>
</svg>`);

// 5. Godrej Classic Brass Padlock Graphic
const imgGodrejLock = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="35%" stop-color="#D97706"/>
      <stop offset="70%" stop-color="#B45309"/>
      <stop offset="100%" stop-color="#78350F"/>
    </linearGradient>
    <linearGradient id="shackle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#94A3B8"/>
      <stop offset="45%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <filter id="lock-sh">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#78350F" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="#FDFBF7"/>
  <!-- Hardened Steel Shackle -->
  <path d="M 140 190 L 140 120 C 140 60 260 60 260 120 L 260 190" fill="none" stroke="url(#shackle)" stroke-width="26" stroke-linecap="round"/>
  <!-- Solid Extruded Brass Lock Body -->
  <rect x="110" y="175" width="180" height="155" rx="20" fill="url(#brass)" stroke="#78350F" stroke-width="3" filter="url(#lock-sh)"/>
  <circle cx="130" cy="195" r="5" fill="#451A03"/>
  <circle cx="270" cy="195" r="5" fill="#451A03"/>
  <!-- Keyhole & Rivet detailing -->
  <circle cx="200" cy="245" r="14" fill="#291204"/>
  <polygon points="196,245 204,245 207,275 193,275" fill="#291204"/>
  <!-- Godrej brand engraving -->
  <rect x="135" y="290" width="130" height="24" rx="4" fill="#451A03" fill-opacity="0.4"/>
  <text x="200" y="306" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="11" font-weight="900" fill="#FEF3C7" letter-spacing="2">GODREJ 65mm</text>
  <rect x="135" y="30" width="130" height="22" rx="11" fill="#FEF3C7"/>
  <text x="200" y="45" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#B45309">SOLID BRASS 6-LEVER</text>
</svg>`);

// 6. Dorset Stainless Steel Hinges Graphic
const imgDorsetHinges = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="ss-brush" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="30%" stop-color="#E2E8F0"/>
      <stop offset="70%" stop-color="#CBD5E1"/>
      <stop offset="100%" stop-color="#94A3B8"/>
    </linearGradient>
    <filter id="hng-sh">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#142B45" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="#F8FAFC"/>
  <!-- Left Leaf -->
  <rect x="80" y="90" width="105" height="220" rx="4" fill="url(#ss-brush)" stroke="#94A3B8" stroke-width="2" filter="url(#hng-sh)"/>
  <!-- Right Leaf -->
  <rect x="215" y="90" width="105" height="220" rx="4" fill="url(#ss-brush)" stroke="#94A3B8" stroke-width="2" filter="url(#hng-sh)"/>
  <!-- Center Barrel Knuckle -->
  <rect x="185" y="80" width="30" height="240" rx="8" fill="#64748B" stroke="#334155" stroke-width="2"/>
  <circle cx="200" cy="80" r="14" fill="#94A3B8"/>
  <circle cx="200" cy="320" r="14" fill="#94A3B8"/>
  <!-- Screw countersink holes -->
  <circle cx="130" cy="130" r="9" fill="#475569" stroke="#94A3B8" stroke-width="2"/>
  <circle cx="130" cy="200" r="9" fill="#475569" stroke="#94A3B8" stroke-width="2"/>
  <circle cx="130" cy="270" r="9" fill="#475569" stroke="#94A3B8" stroke-width="2"/>
  <circle cx="270" cy="130" r="9" fill="#475569" stroke="#94A3B8" stroke-width="2"/>
  <circle cx="270" cy="200" r="9" fill="#475569" stroke="#94A3B8" stroke-width="2"/>
  <circle cx="270" cy="270" r="9" fill="#475569" stroke="#94A3B8" stroke-width="2"/>
  <!-- Brand marking -->
  <text x="200" y="360" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="12" font-weight="800" fill="#142B45" letter-spacing="1">DORSET SS-304 (4" x 3")</text>
  <rect x="140" y="45" width="120" height="22" rx="11" fill="#E2E8F0"/>
  <text x="200" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#334155">BALL BEARING HINGE</text>
</svg>`);

// 7. Taparia 10-Inch Adjustable Spanner Graphic
const imgTapariaSpanner = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#E2E8F0"/>
      <stop offset="80%" stop-color="#94A3B8"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="#F8FAFC"/>
  <g transform="translate(40, 20) rotate(25 160 160)">
    <!-- Long Handle -->
    <rect x="145" y="110" width="30" height="200" rx="8" fill="url(#chrome)" stroke="#334155" stroke-width="2"/>
    <!-- Handle Hanging Hole -->
    <circle cx="160" cy="285" r="9" fill="#F8FAFC" stroke="#334155" stroke-width="2"/>
    <!-- Spanner Fixed Jaw Head -->
    <path d="M 125 110 L 125 50 Q 160 30 195 50 L 195 110 Z" fill="url(#chrome)" stroke="#334155" stroke-width="2"/>
    <!-- Adjustable jaw opening gap -->
    <rect x="140" y="45" width="40" height="45" fill="#F8FAFC" stroke="#334155" stroke-width="1.5"/>
    <!-- Knurled worm gear -->
    <rect x="142" y="85" width="36" height="18" rx="2" fill="#334155"/>
    <!-- Brand Emboss -->
    <text x="160" y="180" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="900" fill="#1E293B" transform="rotate(-90 160 180)">TAPARIA 1171-10</text>
  </g>
  <rect x="135" y="40" width="130" height="22" rx="11" fill="#FEF3C7"/>
  <text x="200" y="55" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#B45309">FORGED CARBON STEEL</text>
</svg>`);

// 8. Finolex 1-Inch Heavy Duty CPVC Ball Valve Graphic
const imgFinolexValve = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="vlv-bg" cx="50%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#ECFDF5"/>
    </radialGradient>
    <linearGradient id="cpvc-cream" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FEF9C3"/>
      <stop offset="60%" stop-color="#FEF08A"/>
      <stop offset="100%" stop-color="#FDE047"/>
    </linearGradient>
    <filter id="vlv-sh">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#047857" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#vlv-bg)"/>
  <!-- CPVC Pipe Sockets (Left & Right) -->
  <rect x="65" y="180" width="80" height="70" rx="8" fill="url(#cpvc-cream)" stroke="#CA8A04" stroke-width="2"/>
  <rect x="255" y="180" width="80" height="70" rx="8" fill="url(#cpvc-cream)" stroke="#CA8A04" stroke-width="2"/>
  <!-- Center Spherical Body -->
  <circle cx="200" cy="215" r="58" fill="url(#cpvc-cream)" stroke="#CA8A04" stroke-width="2.5" filter="url(#vlv-sh)"/>
  <!-- Brass Stem Collar -->
  <rect x="185" y="135" width="30" height="30" fill="#D97706" stroke="#92400E" stroke-width="1.5"/>
  <!-- Red Quarter-Turn Ergonomic Handle -->
  <rect x="140" y="105" width="160" height="34" rx="10" fill="#DC2626" stroke="#991B1B" stroke-width="2"/>
  <circle cx="200" cy="122" r="8" fill="#F8FAFC"/>
  <!-- Brand text -->
  <text x="200" y="222" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="11" font-weight="900" fill="#854D0E">FINOLEX 1"</text>
  <text x="200" y="238" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="8.5" font-weight="700" fill="#713F12">CPVC BALL VALVE</text>
  <rect x="135" y="45" width="130" height="22" rx="11" fill="#DCFCE7"/>
  <text x="200" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#047857">PRESSURE SDR 11</text>
</svg>`);

// 9. Hindware Chrome Bib Tap Graphic
const imgHindwareTap = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="tap-chrome" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="35%" stop-color="#E2E8F0"/>
      <stop offset="70%" stop-color="#94A3B8"/>
      <stop offset="100%" stop-color="#64748B"/>
    </linearGradient>
    <filter id="tap-sh">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#0284C7" flood-opacity="0.14"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="#F0F9FF"/>
  <!-- Wall Mounting Flange (Left) -->
  <circle cx="100" cy="200" r="38" fill="url(#tap-chrome)" stroke="#475569" stroke-width="2"/>
  <!-- Horizontal Inlet Neck -->
  <rect x="100" y="185" width="85" height="30" fill="url(#tap-chrome)" stroke="#475569" stroke-width="2"/>
  <!-- Tap Body & Spout (Graceful Curve) -->
  <path d="M 175 185 L 235 185 Q 265 185 265 235 L 265 265" fill="none" stroke="url(#tap-chrome)" stroke-width="32" stroke-linecap="round" filter="url(#tap-sh)"/>
  <!-- Aerator Nozzle -->
  <rect x="250" y="265" width="30" height="15" rx="3" fill="#334155"/>
  <!-- Quarter-Turn Handle Lever (Top) -->
  <rect x="195" y="130" width="20" height="40" fill="url(#tap-chrome)" stroke="#475569" stroke-width="1.5"/>
  <rect x="170" y="115" width="70" height="20" rx="6" fill="#0284C7" stroke="#0369A1" stroke-width="2"/>
  <!-- Water Droplet Accent -->
  <circle cx="265" cy="305" r="6" fill="#38BDF8"/>
  <text x="200" y="360" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="12" font-weight="800" fill="#0369A1">HINDWARE CONTONA BIB TAP</text>
  <rect x="140" y="45" width="120" height="22" rx="11" fill="#E0F2FE"/>
  <text x="200" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#0369A1">FORGED BRASS BODY</text>
</svg>`);

// 10. Astral CPVC Pro Pipe Graphic
const imgAstralPipe = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <linearGradient id="ast-p" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FEFCE8"/>
      <stop offset="45%" stop-color="#FEF08A"/>
      <stop offset="100%" stop-color="#EAB308"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="#F8FAFC"/>
  <!-- Multi-layered Pipes Bundle -->
  <g transform="translate(60, 100) rotate(22 140 100)">
    <!-- Pipe 1 -->
    <rect x="0" y="40" width="320" height="38" rx="6" fill="url(#ast-p)" stroke="#CA8A04" stroke-width="2"/>
    <line x1="0" y1="58" x2="320" y2="58" stroke="#E11D48" stroke-width="4"/> <!-- Red Identification Line -->
    <text x="160" y="70" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="9" font-weight="800" fill="#854D0E">ASTRAL CPVC PRO SDR 11 &bull; POTABLE WATER</text>
    
    <!-- Pipe 2 -->
    <rect x="10" y="85" width="300" height="38" rx="6" fill="url(#ast-p)" stroke="#CA8A04" stroke-width="2"/>
    <line x1="10" y1="103" x2="310" y2="103" stroke="#E11D48" stroke-width="4"/>
    
    <!-- Pipe 3 -->
    <rect x="20" y="130" width="280" height="38" rx="6" fill="url(#ast-p)" stroke="#CA8A04" stroke-width="2"/>
    <line x1="20" y1="148" x2="300" y2="148" stroke="#E11D48" stroke-width="4"/>
  </g>
  <rect x="135" y="40" width="130" height="22" rx="11" fill="#FEF3C7"/>
  <text x="200" y="55" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#B45309">HOT &amp; COLD RATED</text>
</svg>`);

// 11. Asian Paints Apex Ultima Pail Graphic
const imgAsianPaintsUltima = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="ap-bg" cx="50%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F5EEFA"/>
    </radialGradient>
    <linearGradient id="ap-can" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6B21A8"/>
      <stop offset="50%" stop-color="#9333EA"/>
      <stop offset="100%" stop-color="#581C87"/>
    </linearGradient>
    <filter id="ap-sh">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#7E22CE" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#ap-bg)"/>
  <!-- Pail Metal Handle -->
  <path d="M 120 180 C 120 100 280 100 280 180" fill="none" stroke="#94A3B8" stroke-width="4" stroke-linecap="round"/>
  <!-- Pail Lid -->
  <ellipse cx="200" cy="160" rx="90" ry="16" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
  <!-- Bucket Body -->
  <path d="M 115 160 L 130 310 Q 200 325 270 310 L 285 160 Z" fill="url(#ap-can)" stroke="#581C87" stroke-width="2" filter="url(#ap-sh)"/>
  <!-- Center White Brand Label -->
  <rect x="135" y="200" width="130" height="85" rx="8" fill="#FFFFFF"/>
  <circle cx="200" cy="225" r="14" fill="#E11D48"/> <!-- Asian Paints Red Sun Motif -->
  <text x="200" y="252" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10.5" font-weight="900" fill="#581C87" letter-spacing="1">ASIAN PAINTS</text>
  <text x="200" y="268" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="800" fill="#EA580C">APEX ULTIMA</text>
  <text x="200" y="280" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="8" font-weight="600" fill="#64748B">EXTERIOR EMULSION</text>
  <rect x="140" y="45" width="120" height="22" rx="11" fill="#F3E8FF"/>
  <text x="200" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#7E22CE">7 YEARS WARRANTY</text>
</svg>`);

// 12. Berger Royale Luxury Emulsion Pail Graphic
const imgBergerRoyale = svgUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <defs>
    <radialGradient id="bgr-bg" cx="50%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#FEF2F2"/>
    </radialGradient>
    <linearGradient id="bgr-can" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="40%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
    <filter id="bgr-sh">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#0284C7" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="400" height="400" fill="url(#bgr-bg)"/>
  <!-- Pail Lid with Gold Ring -->
  <ellipse cx="200" cy="150" rx="95" ry="18" fill="#F59E0B" stroke="#B45309" stroke-width="2"/>
  <ellipse cx="200" cy="148" rx="88" ry="14" fill="#FFFFFF"/>
  <!-- Bucket Body -->
  <path d="M 110 150 L 125 315 Q 200 330 275 315 L 290 150 Z" fill="url(#bgr-can)" stroke="#0369A1" stroke-width="2" filter="url(#bgr-sh)"/>
  <!-- Luxury Golden Crest Label -->
  <rect x="135" y="190" width="130" height="95" rx="8" fill="#FFFFFF" stroke="#F59E0B" stroke-width="2"/>
  <text x="200" y="215" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="12" font-weight="900" fill="#0369A1" letter-spacing="1">BERGER</text>
  <text x="200" y="235" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="12" font-weight="800" fill="#D97706">ROYALE</text>
  <text x="200" y="252" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="8.5" font-weight="600" fill="#475569">LUXURY INTERIOR</text>
  <text x="200" y="268" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="8.5" font-weight="700" fill="#16A34A">&bull; WASHABLE TEFLON &bull;</text>
  <rect x="140" y="45" width="120" height="22" rx="11" fill="#FEF3C7"/>
  <text x="200" y="60" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="10" font-weight="700" fill="#B45309">10 LITRES DRUM</text>
</svg>`);

// Category Icons (SVGs)
const electricalIcon = `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>`;
const hardwareIcon = `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`;
const plumbingIcon = `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/><circle cx="12" cy="12" r="3"/>`;
const paintIcon = `<path d="M19 11V4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7m14 0a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4m14 0H5m4 4v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5"/>`;

export const MOCK_CATEGORIES = [
  {
    id: 'cat-electrical',
    name: 'Electrical Products',
    slug: 'electrical-products',
    description: 'Wires, copper cables, modular switches, sockets, MCBs, distribution accessories, and LED lights.',
    productCount: 42,
    badgeClass: 'electrical',
    image: 'assets/images/cat_electrical.jpg',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${electricalIcon}</svg>`
  },
  {
    id: 'cat-hardware',
    name: 'Hardware Products',
    slug: 'hardware-products',
    description: 'Solid brass & SS padlocks, heavy-duty door hinges, spanners, fasteners, and professional tools.',
    productCount: 38,
    badgeClass: 'hardware',
    image: 'assets/images/cat_hardware.jpg',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${hardwareIcon}</svg>`
  },
  {
    id: 'cat-plumbing',
    name: 'Plumbing Products',
    slug: 'plumbing-products',
    description: 'CPVC & UPVC pipes, brass ball valves, chrome bib taps, solvent cements, and sanitary fittings.',
    productCount: 29,
    badgeClass: 'plumbing',
    image: 'assets/images/cat_plumbing.jpg',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${plumbingIcon}</svg>`
  },
  {
    id: 'cat-paints',
    name: 'Wall Paints',
    slug: 'wall-paints',
    description: 'Luxury interior emulsions, weather-proof exterior paints, acrylic wall putties, and primers.',
    productCount: 34,
    badgeClass: 'paints',
    image: 'assets/images/cat_paints.jpg',
    iconSvg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paintIcon}</svg>`
  }
];

export const MOCK_PRODUCTS = [
  // --- 1. Electrical Products ---
  {
    id: 'prod-elec-01',
    name: 'Havells Coral 16A Modular Switch & Socket Combo',
    slug: 'havells-coral-16a-switch-socket-combo',
    sku: '001',
    categoryId: 'cat-electrical',
    categoryName: 'Electrical Products',
    brand: 'Havells',
    price: 349,
    compareAtPrice: 460,
    stock: 85,
    featured: true,
    isBestseller: true,
    isNew: false,
    rating: 4.8,
    reviewCount: 38,
    image: imgHavellsSwitch,
    description: 'Heavy duty 16 Amp modular switch and 3-pin shuttered socket combo designed for geysers, ACs, and power appliances. Manufactured with flame retardant polycarbonate material and silver cadmium contacts for extended durability.',
    specifications: {
      'Current Rating': '16 Amp',
      'Operating Voltage': '240V AC, 50Hz',
      'Material': 'UV Stabilized Flame Retardant Polycarbonate',
      'Contact Material': 'Silver Cadmium Oxide',
      'Warranty': '10 Years Manufacturer Warranty'
    }
  },
  {
    id: 'prod-elec-02',
    name: 'Polycab 2.5 Sq.mm Flame Retardant (FR) Copper Wire (90m Coil)',
    slug: 'polycab-2-5-sqmm-fr-copper-wire-90m',
    sku: '002',
    categoryId: 'cat-electrical',
    categoryName: 'Electrical Products',
    brand: 'Polycab',
    price: 2899,
    compareAtPrice: 3450,
    stock: 24,
    featured: true,
    isBestseller: true,
    isNew: false,
    rating: 4.9,
    reviewCount: 52,
    image: imgPolycabWire,
    description: 'High conductivity electrolytic grade copper conductor wire insulated with specially formulated Flame Retardant PVC compound. Ideal for concealed house wiring with 100% conductivity compliance.',
    specifications: {
      'Conductor Size': '2.5 Sq.mm',
      'Length': '90 Metres',
      'Voltage Grade': 'Up to 1100V',
      'Insulation': 'FR Grade Lead-Free PVC',
      'Standard': 'IS: 694 Certified'
    }
  },
  {
    id: 'prod-elec-03',
    name: 'Schneider Electric Acti9 32A Double Pole MCB (C-Curve)',
    slug: 'schneider-acti9-32a-double-pole-mcb',
    sku: '003',
    categoryId: 'cat-electrical',
    categoryName: 'Electrical Products',
    brand: 'Schneider Electric',
    price: 820,
    compareAtPrice: 1050,
    stock: 18,
    featured: false,
    isBestseller: false,
    isNew: true,
    rating: 4.7,
    reviewCount: 19,
    image: imgSchneiderMCB,
    description: 'Miniature Circuit Breaker offering overload and short-circuit protection for heavy domestic appliances and distribution sub-circuits. Features VisiTrip indicator for rapid faulty circuit identification.',
    specifications: {
      'Poles': '2 Pole (DP)',
      'Rated Current': '32A',
      'Curve Code': 'C',
      'Breaking Capacity': '10kA at 415V AC',
      'Mounting': 'DIN Rail Compatible'
    }
  },
  {
    id: 'prod-elec-04',
    name: 'Philips 9W B22 Cool Daylight Smart LED Bulb (Pack of 4)',
    slug: 'philips-9w-b22-cool-daylight-led-bulb-pack-4',
    sku: '004',
    categoryId: 'cat-electrical',
    categoryName: 'Electrical Products',
    brand: 'Philips',
    price: 499,
    compareAtPrice: 720,
    stock: 60,
    featured: true,
    isBestseller: false,
    isNew: true,
    rating: 4.6,
    reviewCount: 44,
    image: imgPhilipsBulb,
    description: 'Energy-efficient LED bulb pack with EyeComfort technology providing non-flicker 6500K cool daylight illumination with up to 85% energy savings over traditional incandescent bulbs.',
    specifications: {
      'Wattage': '9W (Equivalent to 75W Incandescent)',
      'Base Cap': 'B22 Indian Standard',
      'Color Temp': '6500K Cool Daylight',
      'Lumens': '900 Lumens',
      'Life Expectancy': '15,000 Hours'
    }
  },

  // --- 2. Hardware Products ---
  {
    id: 'prod-hard-01',
    name: 'Godrej Classic 6-Lever Brass Padlock (65mm) with 3 Keys',
    slug: 'godrej-classic-6-lever-brass-padlock-65mm',
    sku: '005',
    categoryId: 'cat-hardware',
    categoryName: 'Hardware Products',
    brand: 'Godrej',
    price: 749,
    compareAtPrice: 920,
    stock: 45,
    featured: true,
    isBestseller: true,
    isNew: false,
    rating: 4.9,
    reviewCount: 63,
    image: imgGodrejLock,
    description: 'Solid brass body security lock engineered with 6 precision brass levers, hardened steel shackle, and drill-resistant mechanism for main entrance gates and commercial shutters.',
    specifications: {
      'Body Material': 'Extruded Solid Brass',
      'Shackle Material': 'Hardened Electroplated Steel',
      'Shackle Diameter': '9.5 mm',
      'Keys Included': '3 Nickel Plated Brass Keys',
      'Mechanism': '6 Lever Locking'
    }
  },
  {
    id: 'prod-hard-02',
    name: 'Dorset Stainless Steel Heavy Duty Butt Hinges (4" x 3") - Pack of 4',
    slug: 'dorset-ss-heavy-duty-butt-hinges-4x3-pack-4',
    sku: '006',
    categoryId: 'cat-hardware',
    categoryName: 'Hardware Products',
    brand: 'Dorset',
    price: 640,
    compareAtPrice: 850,
    stock: 35,
    featured: false,
    isBestseller: false,
    isNew: true,
    rating: 4.7,
    reviewCount: 22,
    image: imgDorsetHinges,
    description: 'Architectural grade SS-304 butt hinges with two ball bearings for smooth, squeak-free operation on wooden doors weighing up to 65 kg.',
    specifications: {
      'Dimensions': '102 mm x 76 mm x 2.5 mm (4" x 3")',
      'Grade': 'AISI 304 Stainless Steel',
      'Bearing Type': 'Twin Sealed Ball Bearings',
      'Package Contents': '4 Hinges with SS Screws',
      'Finish': 'Satin Brush'
    }
  },
  {
    id: 'prod-hard-03',
    name: 'Taparia 10-Inch Adjustable Chrome Plated Spanner (1171-10)',
    slug: 'taparia-10-inch-adjustable-spanner-1171-10',
    sku: '007',
    categoryId: 'cat-hardware',
    categoryName: 'Hardware Products',
    brand: 'Taparia',
    price: 430,
    compareAtPrice: 520,
    stock: 50,
    featured: true,
    isBestseller: true,
    isNew: false,
    rating: 4.8,
    reviewCount: 31,
    image: imgTapariaSpanner,
    description: 'Drop forged from high grade carbon steel and heat treated for maximum strength. Features laser-marked millimeter jaw scale for precise fastener sizing.',
    specifications: {
      'Length': '255 mm (10 Inch)',
      'Jaw Opening': 'Up to 30 mm',
      'Material': 'Drop-forged Carbon Steel',
      'Finish': 'Phosphate & Heavy Chrome Plated',
      'Standard': 'IS: 6149-1984'
    }
  },

  // --- 3. Plumbing Products ---
  {
    id: 'prod-plumb-01',
    name: 'Finolex 1-Inch Heavy Duty CPVC Brass Ball Valve',
    slug: 'finolex-1-inch-cpvc-brass-ball-valve',
    sku: '008',
    categoryId: 'cat-plumbing',
    categoryName: 'Plumbing Products',
    brand: 'Finolex',
    price: 480,
    compareAtPrice: 590,
    stock: 40,
    featured: true,
    isBestseller: true,
    isNew: false,
    rating: 4.8,
    reviewCount: 27,
    image: imgFinolexValve,
    description: 'Pressure tested full bore CPVC ball valve with solid brass stem and ergonomic handle for leak-proof residential hot and cold water distribution pipelines.',
    specifications: {
      'Diameter': '1 Inch (25 mm)',
      'Material': 'High Molecular CPVC with Brass Stem',
      'Max Temp': 'Up to 93°C (200°F)',
      'Pressure Rating': 'SDR 11 - 28 Bar at 23°C',
      'Joint Type': 'Solvent Cement Weld Socket'
    }
  },
  {
    id: 'prod-plumb-02',
    name: 'Hindware Contona Chrome Plated Brass Bib Tap with Wall Flange',
    slug: 'hindware-contona-cp-brass-bib-tap-flange',
    sku: '009',
    categoryId: 'cat-plumbing',
    categoryName: 'Plumbing Products',
    brand: 'Hindware',
    price: 699,
    compareAtPrice: 950,
    stock: 22,
    featured: true,
    isBestseller: false,
    isNew: false,
    rating: 4.7,
    reviewCount: 29,
    image: imgHindwareTap,
    description: 'Forged brass body bib tap coated with 3-tier chrome electroplating. Built with quarter-turn ceramic disc cartridge for drip-free longevity in bathrooms and kitchens.',
    specifications: {
      'Inlet Size': '1/2 Inch BSP Male Thread',
      'Body Material': 'Virgin Ingot Brass (CuZn39Pb3)',
      'Cartridge': 'High-precision Ceramic Disc',
      'Coating': 'Robotic Chrome (0.3µm) over Nickel (10µm)',
      'Warranty': '7 Years Brand Warranty'
    }
  },
  {
    id: 'prod-plumb-03',
    name: 'Astral CPVC Pro 3/4-Inch SDR 11 Pipe (3 Metres / 10 Feet)',
    slug: 'astral-cpvc-pro-3-4-inch-pipe-3m',
    sku: '010',
    categoryId: 'cat-plumbing',
    categoryName: 'Plumbing Products',
    brand: 'Astral',
    price: 385,
    compareAtPrice: 460,
    stock: 75,
    featured: false,
    isBestseller: true,
    isNew: false,
    rating: 4.9,
    reviewCount: 41,
    image: imgAstralPipe,
    description: 'NSF certified potable water CPVC pipe engineered with chlorinated polyvinyl chloride for zero calcification, superior burst strength, and bacteriostatic resistance.',
    specifications: {
      'Size': '3/4 Inch (20 mm)',
      'Length': '3 Metres (10 Feet)',
      'Standard': 'IS 15778 / ASTM D2846',
      'Pressure Class': 'Class 1 (SDR 11)',
      'Application': 'Hot and Cold Potable Water Systems'
    }
  },

  // --- 4. Wall Paints ---
  {
    id: 'prod-paint-01',
    name: 'Asian Paints Apex Ultima Exterior Emulsion (4 Litres - Brilliant White)',
    slug: 'asian-paints-apex-ultima-exterior-emulsion-4l-white',
    sku: '011',
    categoryId: 'cat-paints',
    categoryName: 'Wall Paints',
    brand: 'Asian Paints',
    price: 1849,
    compareAtPrice: 2280,
    stock: 30,
    featured: true,
    isBestseller: true,
    isNew: false,
    rating: 4.9,
    reviewCount: 57,
    image: imgAsianPaintsUltima,
    description: 'High performance 100% acrylic exterior paint with advanced silicone additives and Colour Stay technology. Resists tropical rainfall, extreme UV fading, and algal growth.',
    specifications: {
      'Volume': '4 Litres',
      'Paint Finish': 'Rich Sheen',
      'Coverage': '55 - 65 sq.ft / Litre for 2 Coats',
      'Drying Time': 'Surface dry in 30 mins; Recoat after 4 hrs',
      'Warranty': '7 Years Performance Warranty'
    }
  },
  {
    id: 'prod-paint-02',
    name: 'Berger Royale Luxury Interior Emulsion (10 Litres - Soft Off-White)',
    slug: 'berger-royale-luxury-interior-emulsion-10l',
    sku: '012',
    categoryId: 'cat-paints',
    categoryName: 'Wall Paints',
    brand: 'Berger',
    price: 3699,
    compareAtPrice: 4450,
    stock: 16,
    featured: true,
    isBestseller: false,
    isNew: true,
    rating: 4.8,
    reviewCount: 33,
    image: imgBergerRoyale,
    description: 'Teflon surface protector enriched luxury interior emulsion offering washable, stain-resistant smooth wall finish with ultra-low VOC and pleasant green fragrance.',
    specifications: {
      'Volume': '10 Litres',
      'Paint Finish': 'Silky Smooth Satin Sheen',
      'Washability': 'High Scrub Resistance (Class 1)',
      'Coverage': '140 - 160 sq.ft / Litre for 1 Coat',
      'VOC Level': 'Below 25 gm/Litre (Eco-Friendly)'
    }
  }
];

export const MOCK_REVIEWS = [
  {
    id: 'rev-01',
    name: 'Rajesh Sharma',
    role: 'Licensed Electrical Contractor, Ahmedabad',
    stars: 5,
    text: 'Procured Polycab wiring bundles and Schneider MCBs for a 12-unit residential project. The 100% genuine ISI verified materials arrived on schedule with proper GST input invoices. Devshree is our go-to partner.',
    verified: true
  },
  {
    id: 'rev-02',
    name: 'Manoj Patel',
    role: 'Civil Contractor & Homebuilder, Gandhinagar',
    stars: 5,
    text: 'Sourcing Astral CPVC and Finolex ball valves in bulk has never been this transparent. Prices are consistently competitive compared to local wholesale yards, and packaging prevents transit dents.',
    verified: true
  },
  {
    id: 'rev-03',
    name: 'Anjali Desai',
    role: 'Independent Interior Designer, Vadodara',
    stars: 5,
    text: 'Ordered Asian Paints Apex Ultima along with Dorset brass hardware. The product descriptions on the site gave exact coverage specifications which helped calculate our client requirement accurately.',
    verified: true
  }
];

export const STORE_INFO = {
  name: 'Devshree Hardware & Electricals',
  brandName: 'DEVSHREE',
  tagline: 'Everything You Need to Build Better',
  phone: '+91 88661 30409',
  phoneAlt: '+91 88661 30409',
  email: 'support@devshree.in',
  salesEmail: 'sales@devshree.in',
  address: 'B-13, Jainam Apartment, Opposite Nageshwar Derasar, Jamnagar Road, Rajkot - 360006, Gujarat',
  gstin: '24BRVPB8736M1Z3',
  hours: {
    weekdays: 'Monday – Saturday: 9:00 AM – 8:00 PM',
    sunday: 'Sunday: 10:00 AM – 4:00 PM'
  },
  deliveryText: 'Free express dispatch across India on orders above ₹1,999'
};
