import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// ----- File filter (shared) -----
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.",
      ),
    );
  }
};

// ============================================
// 1. PRODUCT IMAGES – memory storage + helper
// ============================================
const productStorage = multer.memoryStorage();

export const upload = multer({
  storage: productStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

// Middleware for product images (max 10 images) – kept for backward compatibility
export const uploadProductImages = upload.array("images", 10);

// Helper to save a single product image to disk
export const saveImageToDisk = (file: Express.Multer.File): string => {
  const uploadDir = path.join(process.cwd(), "public/uploads/product-images");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const uniqueId = uuidv4();
  const timestamp = Date.now();
  const extension = path.extname(file.originalname);
  const filename = `${timestamp}-${uniqueId}${extension}`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, file.buffer);
  return filename;
};

// Helper for multiple product images
export const saveImagesToDisk = (files: Express.Multer.File[]): string[] => {
  return files.map((file) => saveImageToDisk(file));
};

// ============================================
// 2. PRODUCT THUMBNAIL – memory storage (same as product images)
// ============================================
const productThumbnailStorage = multer.memoryStorage();

export const uploadProductThumbnail = multer({
  storage: productThumbnailStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
}).single("thumbnail");

// ============================================
// 3. LOGO – disk storage (direct save)
// ============================================
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "public/uploads/logo");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${unique}${ext}`);
  },
});

export const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter,
});

// ============================================
// 4. SLIDER BANNER (old slider) – disk storage
// ============================================
const sliderStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "public/uploads/banner-slider-images");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `slider-${unique}${ext}`);
  },
});

export const uploadSliderImage = multer({
  storage: sliderStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

// ============================================
// 5. HERO SLIDER (new) – disk storage
// ============================================
const heroSliderStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), "public/uploads/hero-slider");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `hero-${unique}${ext}`);
  },
});

export const uploadHeroSliderImage = multer({
  storage: heroSliderStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});
