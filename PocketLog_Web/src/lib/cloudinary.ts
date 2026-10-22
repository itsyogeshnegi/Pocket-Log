import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

export function cloudinaryClient() {
  const config = env();
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) throw new Error("Cloudinary environment is not configured");
  cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET, secure: true, signature_algorithm: "sha256" });
  return cloudinary;
}

