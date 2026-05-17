// src/controllers/attributeController.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const attributeController = {
  // Get all attributes
  async getAll(req: Request, res: Response) {
    try {
      const attributes = await prisma.productAttribute.findMany({
        orderBy: { name: "asc" },
      });
      res.json({ success: true, data: attributes });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get a single attribute by ID
  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const attribute = await prisma.productAttribute.findUnique({
        where: { id },
      });
      if (!attribute) {
        return res
          .status(404)
          .json({ success: false, message: "Attribute not found" });
      }
      res.json({ success: true, data: attribute });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Get a single attribute by name (optional, for other use cases)
  async getByName(req: Request, res: Response) {
    try {
      const { name } = req.params;
      const attribute = await prisma.productAttribute.findUnique({
        where: { name },
      });
      if (!attribute) {
        return res
          .status(404)
          .json({ success: false, message: "Attribute not found" });
      }
      res.json({ success: true, data: attribute });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Create a new attribute
  async create(req: Request, res: Response) {
    try {
      const { name, values } = req.body;
      if (!name || !values || !Array.isArray(values) || values.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Name and non‑empty values array required",
        });
      }
      const existing = await prisma.productAttribute.findUnique({
        where: { name },
      });
      if (existing) {
        return res
          .status(409)
          .json({ success: false, message: "Attribute already exists" });
      }
      const attribute = await prisma.productAttribute.create({
        data: { name, values },
      });
      res.status(201).json({ success: true, data: attribute });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Add a new value to an existing attribute (by ID)
  async addValue(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const { newValue } = req.body;
      if (!newValue) {
        return res
          .status(400)
          .json({ success: false, message: "newValue required" });
      }

      const attribute = await prisma.productAttribute.findUnique({
        where: { id },
      });
      if (!attribute) {
        return res
          .status(404)
          .json({ success: false, message: "Attribute not found" });
      }

      const currentValues = attribute.values as string[];
      if (!currentValues.includes(newValue)) {
        currentValues.push(newValue);
        await prisma.productAttribute.update({
          where: { id },
          data: { values: currentValues },
        });
      }
      res.json({
        success: true,
        message: "Value added",
        data: { ...attribute, values: currentValues },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Update entire attribute (by ID)
  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const { name: newName, values } = req.body;

      // Check if attribute exists
      const existing = await prisma.productAttribute.findUnique({
        where: { id },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Attribute not found" });
      }

      const updateData: any = {};
      if (newName !== undefined) updateData.name = newName;
      if (values !== undefined) updateData.values = values;

      const attribute = await prisma.productAttribute.update({
        where: { id },
        data: updateData,
      });
      res.json({ success: true, data: attribute });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // Delete an attribute (by ID)
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const existing = await prisma.productAttribute.findUnique({
        where: { id },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Attribute not found" });
      }
      await prisma.productAttribute.delete({ where: { id } });
      res.json({ success: true, message: "Attribute deleted" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
