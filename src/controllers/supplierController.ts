import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const supplierController = {
  async getSuppliers(req: Request, res: Response) {
    const search = (req.query.search as string) || "";
    const where = search ? { name: { contains: search } } : {};
    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: suppliers });
  },

  async getSupplier(req: Request, res: Response) {
    const id = parseInt(req.params.id);
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier)
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    res.json({ success: true, data: supplier });
  },

  async createSupplier(req: Request, res: Response) {
    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      gstNumber,
      paymentTerms,
    } = req.body;
    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactPerson,
        phone,
        email,
        address,
        gstNumber,
        paymentTerms,
      },
    });
    res.status(201).json({ success: true, data: supplier });
  },

  async updateSupplier(req: Request, res: Response) {
    const id = parseInt(req.params.id);
    const {
      name,
      contactPerson,
      phone,
      email,
      address,
      gstNumber,
      paymentTerms,
    } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        contactPerson,
        phone,
        email,
        address,
        gstNumber,
        paymentTerms,
      },
    });
    res.json({ success: true, data: supplier });
  },

  async deleteSupplier(req: Request, res: Response) {
    const id = parseInt(req.params.id);
    await prisma.supplier.delete({ where: { id } });
    res.json({ success: true, message: "Supplier deleted" });
  },
};
