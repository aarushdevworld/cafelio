const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter"
];
const MAX_RADIUS = 5000;
const MAX_RESULTS = 60;

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const parseNearbyQuery = (query) => {
  const lat = toNumber(query.lat);
  const lng = toNumber(query.lng);
  const radius = Math.min(Math.max(toNumber(query.radius) || 1500, 250), MAX_RADIUS);

  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const error = new Error("Valid lat and lng query parameters are required.");
    error.status = 400;
    throw error;
  }

  return { lat, lng, radius };
};

const distanceBetween = (a, b) => {
  const earthRadius = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

const compactAddress = (tags = {}) => {
  const pieces = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:neighbourhood"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:postcode"]
  ].filter(Boolean);

  return pieces.join(", ");
};

const normalizeCafe = (element, center) => {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;

  if (lat === undefined || lng === undefined) {
    return null;
  }

  const tags = element.tags || {};
  const point = { lat, lng };

  return {
    id: `${element.type}-${element.id}`,
    name: tags.name || tags.brand || "Unnamed cafe",
    lat,
    lng,
    distance: distanceBetween(center, point),
    address: compactAddress(tags),
    phone: tags.phone || tags["contact:phone"] || "",
    website: tags.website || tags["contact:website"] || "",
    openingHours: tags.opening_hours || "",
    cuisine: tags.cuisine || "",
    takeaway: tags.takeaway || "",
    outdoorSeating: tags.outdoor_seating || "",
    internetAccess: tags.internet_access || "",
    source: "openstreetmap"
  };
};

export const fetchNearbyCafes = async ({ lat, lng, radius }) => {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="cafe"](around:${radius},${lat},${lng});
      way["amenity"="cafe"](around:${radius},${lat},${lng});
      relation["amenity"="cafe"](around:${radius},${lat},${lng});
    );
    out center tags;
  `;

  let payload = null;
  let lastError = null;

  for (const url of OVERPASS_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Overpass returned ${response.status}`);
      }

      payload = await response.json();
      break;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!payload) {
    const error = new Error("Cafe search is temporarily unavailable. Please try again in a moment.");
    error.status = 502;
    error.cause = lastError;
    throw error;
  }

  const center = { lat, lng };
  const cafes = (payload.elements || [])
    .map((element) => normalizeCafe(element, center))
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_RESULTS);

  return cafes;
};
