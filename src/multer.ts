import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Use memory storage first (don't save to disk yet)
const storage = multer.memoryStorage();

// File filter for images
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.'));
  }
};

// Configure multer for memory storage
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
});

// Middleware for product images (max 10 images)
export const uploadProductImages = upload.array('images', 10);

// Helper function to save image to disk
export const saveImageToDisk = (file: Express.Multer.File): string => {
  const uploadDir = path.join(process.cwd(), 'public/uploads/product-images');
  
  // Ensure directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const uniqueId = uuidv4();
  const timestamp = Date.now();
  const extension = path.extname(file.originalname);
  const filename = `${timestamp}-${uniqueId}${extension}`;
  const filePath = path.join(uploadDir, filename);
  
  // Write file to disk
  fs.writeFileSync(filePath, file.buffer);
  
  return filename;
};

// Helper function to save multiple images
export const saveImagesToDisk = (files: Express.Multer.File[]): string[] => {
  return files.map(file => saveImageToDisk(file));
};