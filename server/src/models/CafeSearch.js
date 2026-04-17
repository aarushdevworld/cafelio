import mongoose from "mongoose";

const cafeSearchSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radius: { type: Number, required: true },
    resultCount: { type: Number, required: true },
    source: { type: String, default: "openstreetmap" }
  },
  { timestamps: true }
);

export default mongoose.model("CafeSearch", cafeSearchSchema);
