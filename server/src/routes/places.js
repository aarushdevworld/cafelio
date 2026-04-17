import express from "express";
import { searchCitySuggestions } from "../services/geocode.js";

const router = express.Router();

router.get("/suggest", async (req, res, next) => {
  try {
    const suggestions = await searchCitySuggestions({
      q: req.query.q,
      limit: req.query.limit
    });

    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

export default router;
