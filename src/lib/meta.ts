export const site = 'https://floodpulse.peng.ly';
export const source = 'https://github.com/NotAFlightRisk/floodpulse';
export const official = 'https://check-for-flooding.service.gov.uk';
export const name = 'floodpulse';
export const title = `${name} | Live river levels and flood warnings across England`;
export const description =
  'Every Environment Agency river gauge in England on one live map, each read against its own normal range, with flood warnings, rainfall and five days of history.';
export const imageAlt =
  'A map of England with every river gauge marked rising, falling or steady, beside a carved gauge scale';

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
