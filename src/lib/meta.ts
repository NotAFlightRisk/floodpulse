export const site = 'https://floodpulse.peng.ly';
export const source = 'https://github.com/NotAFlightRisk/floodpulse';
export const official = 'https://check-for-flooding.service.gov.uk';
export const name = 'floodpulse';
export const title = `${name} | Live river levels and flood warnings across England`;
export const description =
  "England's rivers on one live map, every stretch coloured by its Environment Agency gauge against that gauge's own normal range, with flood warnings, rainfall and five days of history.";
export const imageAlt =
  "A map of England's rivers, each stretch coloured by how high its gauge is running against normal";

/** Tells search engines what the site's called and what it is */
export const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name,
  url: site,
  applicationCategory: 'UtilitiesApplication',
  description,
  isAccessibleForFree: true,
  operatingSystem: 'Any'
});
