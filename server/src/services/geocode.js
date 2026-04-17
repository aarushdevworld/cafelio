const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CITY_TYPES = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "administrative"
]);
const CURATED_CITIES = [
  { id: "curated-new-delhi", title: "New Delhi", subtitle: "India", lat: 28.6138954, lng: 77.2090057, aliases: ["delhi", "new delhi"] },
  { id: "curated-delhi", title: "Delhi", subtitle: "India", lat: 28.6328027, lng: 77.2197713, aliases: ["delhi"] },
  { id: "curated-chandigarh", title: "Chandigarh", subtitle: "India", lat: 30.7334421, lng: 76.7797143, aliases: ["chandigarh"] },
  { id: "curated-mumbai", title: "Mumbai", subtitle: "Maharashtra, India", lat: 19.0785451, lng: 72.878176, aliases: ["mumbai", "bombay"] },
  { id: "curated-bengaluru", title: "Bengaluru", subtitle: "Karnataka, India", lat: 12.9767936, lng: 77.590082, aliases: ["bengaluru", "bangalore"] },
  { id: "curated-hyderabad", title: "Hyderabad", subtitle: "Telangana, India", lat: 17.360589, lng: 78.4740613, aliases: ["hyderabad"] },
  { id: "curated-chennai", title: "Chennai", subtitle: "Tamil Nadu, India", lat: 13.0836939, lng: 80.270186, aliases: ["chennai", "madras"] },
  { id: "curated-kolkata", title: "Kolkata", subtitle: "West Bengal, India", lat: 22.5726459, lng: 88.3638953, aliases: ["kolkata", "calcutta"] },
  { id: "curated-pune", title: "Pune", subtitle: "Maharashtra, India", lat: 18.521428, lng: 73.8544541, aliases: ["pune"] },
  { id: "curated-ahmedabad", title: "Ahmedabad", subtitle: "Gujarat, India", lat: 23.0216238, lng: 72.5797068, aliases: ["ahmedabad"] },
  { id: "curated-jaipur", title: "Jaipur", subtitle: "Rajasthan, India", lat: 26.9154576, lng: 75.8189817, aliases: ["jaipur"] },
  { id: "curated-lucknow", title: "Lucknow", subtitle: "Uttar Pradesh, India", lat: 26.8381, lng: 80.9346001, aliases: ["lucknow"] },
  { id: "curated-noida", title: "Noida", subtitle: "Uttar Pradesh, India", lat: 28.5706333, lng: 77.3272147, aliases: ["noida"] },
  { id: "curated-gurugram", title: "Gurugram", subtitle: "Haryana, India", lat: 28.4646148, lng: 77.0299194, aliases: ["gurugram", "gurgaon"] },
  { id: "curated-london", title: "London", subtitle: "England, United Kingdom", lat: 51.5074456, lng: -0.1277653, aliases: ["london"] },
  { id: "curated-dubai", title: "Dubai", subtitle: "United Arab Emirates", lat: 25.0742823, lng: 55.1885387, aliases: ["dubai"] },
  { id: "curated-new-york", title: "New York", subtitle: "New York, United States", lat: 40.7127281, lng: -74.0060152, aliases: ["new york", "nyc"] },
  { id: "curated-paris", title: "Paris", subtitle: "France", lat: 48.8534951, lng: 2.3483915, aliases: ["paris"] },
  { id: "curated-tokyo", title: "Tokyo", subtitle: "Japan", lat: 35.6768601, lng: 139.7638947, aliases: ["tokyo"] }
];

const normalized = (value) => String(value || "").trim().toLowerCase();

const curatedMatches = (query) => {
  const normalizedQuery = normalized(query);

  return CURATED_CITIES
    .filter((city) => {
      const searchable = [city.title, city.subtitle, ...city.aliases].map(normalized);
      return searchable.some((item) => item.startsWith(normalizedQuery) || item.includes(normalizedQuery));
    })
    .map((city) => ({
      id: city.id,
      title: city.title,
      subtitle: city.subtitle,
      label: `${city.title}, ${city.subtitle}`,
      lat: city.lat,
      lng: city.lng,
      type: "city"
    }));
};

const labelForPlace = (place) => {
  const address = place.address || {};
  const title =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    place.name ||
    place.display_name?.split(",")[0] ||
    "Selected city";
  const detail = [
    address.state,
    address.country
  ]
    .filter(Boolean)
    .filter((part, index, parts) => normalized(part) !== normalized(title) && parts.indexOf(part) === index)
    .join(", ");

  return {
    title,
    subtitle: detail || place.display_name || "",
    label: detail ? `${title}, ${detail}` : title
  };
};

export const searchCitySuggestions = async ({ q, limit = 6 }) => {
  const query = String(q || "").trim();
  const maxResults = Math.min(Math.max(Number(limit) || 6, 1), 8);

  if (query.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(maxResults),
    dedupe: "1",
    featuretype: "city"
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      "Accept": "application/json",
      "Accept-Language": "en",
      "User-Agent": "Cafelio local MERN app"
    }
  });

  if (!response.ok) {
    const error = new Error("City suggestions are temporarily unavailable.");
    error.status = 502;
    throw error;
  }

  const places = await response.json();

  const remoteSuggestions = places
    .filter((place) => CITY_TYPES.has(place.type) || place.class === "boundary" || place.class === "place")
    .map((place) => {
      const label = labelForPlace(place);

      return {
        id: String(place.place_id),
        title: label.title,
        subtitle: label.subtitle,
        label: label.label,
        lat: Number(place.lat),
        lng: Number(place.lon),
        type: place.type || "city"
      };
    })
    .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));

  const unique = new Map();

  [...curatedMatches(query), ...remoteSuggestions].forEach((place) => {
    const key = `${normalized(place.title)}-${Math.round(place.lat * 100)}-${Math.round(place.lng * 100)}`;
    if (!unique.has(key)) {
      unique.set(key, place);
    }
  });

  return Array.from(unique.values()).slice(0, maxResults);
};
