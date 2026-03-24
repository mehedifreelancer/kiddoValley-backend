import { Request, Response } from 'express';

export const ImageUploadController = {
  // Upload single image
  async uploadSingle(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/product-images/${req.file.filename}`;

      res.json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          filename: req.file.filename,
          url: fileUrl,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload image',
      });
    }
  },

  // Upload multiple images
  async uploadMultiple(req: Request, res: Response) {
    try {
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
      }

      const files = req.files as Express.Multer.File[];
      const uploadedFiles = files.map(file => ({
        filename: file.filename,
        url: `${req.protocol}://${req.get('host')}/uploads/product-images/${file.filename}`,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      }));

      res.json({
        success: true,
        message: `${files.length} image(s) uploaded successfully`,
        data: uploadedFiles,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload images',
      });
    }
  },
};