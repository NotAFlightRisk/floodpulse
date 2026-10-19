// Airy 1830 and the National Grid's own projection, from the OS's coordinate guide
const A = 6377563.396;
const B = 6356256.909;
const F0 = 0.9996012717;
const LAT0 = (49 * Math.PI) / 180;
const LON0 = (-2 * Math.PI) / 180;
const N0 = -100_000;
const E0 = 400_000;
const E2 = 1 - (B * B) / (A * A);
const N = (A - B) / (A + B);

const meridian = (lat: number) => {
  const [d, s] = [lat - LAT0, lat + LAT0];
  return (
    B *
    F0 *
    ((1 + N + 1.25 * N ** 2 + 1.25 * N ** 3) * d -
      (3 * N + 3 * N ** 2 + (21 / 8) * N ** 3) * Math.sin(d) * Math.cos(s) +
      ((15 / 8) * N ** 2 + (15 / 8) * N ** 3) * Math.sin(2 * d) * Math.cos(2 * s) -
      (35 / 24) * N ** 3 * Math.sin(3 * d) * Math.cos(3 * s))
  );
};

/** Turns an OS grid reference like TQ3910 into the latitude and longitude of its square's middle */
export function fromGrid(reference: string): [number, number] | undefined {
  const match = /^([A-HJ-Z]{2})(\d{2,10})$/.exec(reference.replace(/\s/g, '').toUpperCase());
  if (!match || match[2].length % 2) return;
  const [first, second] = [...match[1]].map((letter) => {
    const index = letter.charCodeAt(0) - 65;
    return index > 7 ? index - 1 : index;
  });
  const digits = match[2].length / 2;
  const unit = 10 ** (5 - digits);
  const east =
    (((first - 2) % 5) * 5 + (second % 5)) * 100_000 + (+match[2].slice(0, digits) + 0.5) * unit;
  const north =
    (19 - Math.floor(first / 5) * 5 - Math.floor(second / 5)) * 100_000 +
    (+match[2].slice(digits) + 0.5) * unit;

  let lat = LAT0;
  do lat += (north - N0 - meridian(lat)) / (A * F0);
  while (Math.abs(north - N0 - meridian(lat)) >= 0.01);

  const sin = Math.sin(lat);
  const nu = (A * F0) / Math.sqrt(1 - E2 * sin * sin);
  const rho = (A * F0 * (1 - E2)) / (1 - E2 * sin * sin) ** 1.5;
  const eta2 = nu / rho - 1;
  const [tan, sec, de] = [Math.tan(lat), 1 / Math.cos(lat), east - E0];
  const t2 = tan * tan;
  const latitude =
    lat -
    (tan / (2 * rho * nu)) * de ** 2 +
    (tan / (24 * rho * nu ** 3)) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2) * de ** 4 -
    (tan / (720 * rho * nu ** 5)) * (61 + 90 * t2 + 45 * t2 * t2) * de ** 6;
  const longitude =
    LON0 +
    (sec / nu) * de -
    (sec / (6 * nu ** 3)) * (nu / rho + 2 * t2) * de ** 3 +
    (sec / (120 * nu ** 5)) * (5 + 28 * t2 + 24 * t2 * t2) * de ** 5 -
    (sec / (5040 * nu ** 7)) * (61 + 662 * t2 + 1320 * t2 * t2 + 720 * t2 ** 3) * de ** 7;
  // left on OSGB36, which is ~100 m off WGS84 and well inside a 1 km square
  const round = (radians: number) => Math.round(((radians * 180) / Math.PI) * 1e5) / 1e5;
  return [round(latitude), round(longitude)];
}
