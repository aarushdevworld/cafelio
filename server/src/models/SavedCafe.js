import mongoose from "mongoose";

const savedCafeSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    cafeId: { type: String, required: true },
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, default: "" },
    distance: { type: Number, default: null },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    openingHours: { type: String, default: "" },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    review: { type: String, default: "" },
    source: { type: String, default: "openstreetmap" }
  },
  { timestamps: true }
);

savedCafeSchema.index({ userId: 1, cafeId: 1 }, { unique: true });

export default mongoose.model("SavedCafe", savedCafeSchema);
