import express from "express";
import CafeSearch from "../models/CafeSearch.js";
import SavedCafe from "../models/SavedCafe.js";
import { isMongoReady } from "../config/db.js";
import { optionalAuth, userScope } from "../middleware/auth.js";
import { fetchNearbyCafes, parseNearbyQuery } from "../services/overpass.js";

const router = express.Router();
const memoryFavorites = new Map();
const memorySearches = [];

router.use(optionalAuth);

const favoritesForUser = (userId) => {
  if (!memoryFavorites.has(userId)) {
    memoryFavorites.set(userId, new Map());
  }

  return memoryFavorites.get(userId);
};

const normalizeRating = (value) => {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  return Math.min(Math.max(Math.round(rating), 0), 5);
};

router.get("/nearby", async (req, res, next) => {
  try {
    const search = parseNearbyQuery(req.query);
    const cafes = await fetchNearbyCafes(search);

    if (isMongoReady()) {
      await CafeSearch.create({
        ...search,
        resultCount: cafes.length
      });
    } else {
      memorySearches.unshift({
        ...search,
        resultCount: cafes.length,
        createdAt: new Date().toISOString()
      });
      memorySearches.splice(10);
    }

    res.json({
      center: { lat: search.lat, lng: search.lng },
      radius: search.radius,
      source: "openstreetmap",
      cafes
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (_req, res, next) => {
  try {
    if (isMongoReady()) {
      const searches = await CafeSearch.find().sort({ createdAt: -1 }).limit(10).lean();
      return res.json({ searches });
    }

    res.json({ searches: memorySearches });
  } catch (error) {
    next(error);
  }
});

router.get("/favorites", async (req, res, next) => {
  try {
    const userId = userScope(req);

    if (isMongoReady()) {
      const favorites = await SavedCafe.find({ userId }).sort({ createdAt: -1 }).lean();
      return res.json({ favorites });
    }

    res.json({ favorites: Array.from(favoritesForUser(userId).values()) });
  } catch (error) {
    next(error);
  }
});

router.post("/favorites", async (req, res, next) => {
  try {
    const cafe = req.body;

    if (!cafe?.id || !cafe?.name || typeof cafe.lat !== "number" || typeof cafe.lng !== "number") {
      return res.status(400).json({ message: "A cafe with id, name, lat, and lng is required." });
    }

    const userId = userScope(req);
    const document = {
      userId,
      cafeId: cafe.id,
      name: cafe.name,
      lat: cafe.lat,
      lng: cafe.lng,
      address: cafe.address || "",
      distance: cafe.distance ?? null,
      phone: cafe.phone || "",
      website: cafe.website || "",
      openingHours: cafe.openingHours || "",
      rating: normalizeRating(cafe.rating),
      review: String(cafe.review || "").trim().slice(0, 1000),
      source: cafe.source || "openstreetmap"
    };

    if (isMongoReady()) {
      const favorite = await SavedCafe.findOneAndUpdate(
        { userId, cafeId: cafe.id },
        document,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
      return res.status(201).json({ favorite });
    }

    favoritesForUser(userId).set(cafe.id, { ...document, createdAt: new Date().toISOString() });
    res.status(201).json({ favorite: favoritesForUser(userId).get(cafe.id) });
  } catch (error) {
    next(error);
  }
});

router.delete("/favorites/:cafeId", async (req, res, next) => {
  try {
    const userId = userScope(req);

    if (isMongoReady()) {
      await SavedCafe.deleteOne({ userId, cafeId: req.params.cafeId });
    } else {
      favoritesForUser(userId).delete(req.params.cafeId);
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.patch("/favorites/:cafeId/review", async (req, res, next) => {
  try {
    const userId = userScope(req);
    const update = {
      rating: normalizeRating(req.body.rating),
      review: String(req.body.review || "").trim().slice(0, 1000)
    };

    if (isMongoReady()) {
      const favorite = await SavedCafe.findOneAndUpdate(
        { userId, cafeId: req.params.cafeId },
        update,
        { new: true }
      ).lean();

      if (!favorite) {
        return res.status(404).json({ message: "Save the cafe before adding a review." });
      }

      return res.json({ favorite });
    }

    const favorites = favoritesForUser(userId);
    const favorite = favorites.get(req.params.cafeId);

    if (!favorite) {
      return res.status(404).json({ message: "Save the cafe before adding a review." });
    }

    favorites.set(req.params.cafeId, { ...favorite, ...update, updatedAt: new Date().toISOString() });
    res.json({ favorite: favorites.get(req.params.cafeId) });
  } catch (error) {
    next(error);
  }
});

export default router;
