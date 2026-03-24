import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const barcodeController = {
  // Get all barcodes with pagination and search
  async getAll(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;
      const skip = (page - 1) * limit;

      let where: any = {};

      if (search && search.trim() !== '') {
        const searchTerm = search.trim();
        where.OR = [
          { title: { contains: searchTerm } },
          { barcode: { contains: searchTerm } }
        ];
      }

      const [barcodes, total] = await Promise.all([
        prisma.barcode.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.barcode.count({ where })
      ]);

      res.json({
        success: true,
        data: barcodes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      console.error('Get all barcodes error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch barcodes'
      });
    }
  }
};