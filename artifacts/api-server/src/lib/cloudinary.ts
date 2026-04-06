import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env["CLOUDINARY_CLOUD_NAME"],
  api_key: process.env["CLOUDINARY_API_KEY"],
  api_secret: process.env["CLOUDINARY_API_SECRET"],
});

export async function uploadAvatarToCloudinary(
  buffer: Buffer,
  mimetype: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "animeflex/avatars",
        resource_type: "image",
        format: "webp",
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error("Cloudinary upload failed"));
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
