import fs from 'fs';
import path from 'path';

// Delete a single file from the uploads folder
export const deleteFile = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Delete multiple files
export const deleteFiles = (filePaths: string[]): { success: number; failed: number } => {
  let success = 0;
  let failed = 0;

  for (const filePath of filePaths) {
    if (deleteFile(filePath)) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
};

// Extract filename from URL and get full path
export const getImagePathFromUrl = (imageUrl: string): string => {
  // Example URL: http://localhost:4000/uploads/product-images/filename.jpg
  const filename = imageUrl.split('/').pop();
  return path.join(process.cwd(), 'public/uploads/product-images', filename || '');
};

// Get all image paths from product images array
export const getImagePathsFromProduct = (images: any[]): string[] => {
  return images
    .map(img => img.imgUrl)
    .filter(url => url)
    .map(url => getImagePathFromUrl(url));
};