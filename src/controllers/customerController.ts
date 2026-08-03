import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const customerController = {
  // GET all customers (with optional search)
  async getCustomers(req: Request, res: Response) {
    try {
      const search = (req.query.search as string) || "";
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { phone: { contains: search } },
          { address: { contains: search } },
        ];
      }
      const customers = await prisma.customerInfo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          orders: {
            select: { id: true, invoiceNo: true, total: true, createdAt: true },
          },
        },
      });
      res.json({ success: true, data: customers });
    } catch (error: any) {
      console.error("Get customers error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // GET single customer by phone
  async getCustomer(req: Request, res: Response) {
    try {
      const { phone } = req.params;
      const customer = await prisma.customerInfo.findUnique({
        where: { phone },
        include: { orders: true },
      });
      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "Customer not found" });
      }
      res.json({ success: true, data: customer });
    } catch (error: any) {
      console.error("Get customer error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ CREATE customer
  async createCustomer(req: Request, res: Response) {
    try {
      const {
        phone,
        name,
        address,
        secondaryPhone,
        gender,
        hasBaby,
        preferredToy,
      } = req.body;

      if (!phone || !name || !address) {
        return res.status(400).json({
          success: false,
          message: "Phone, name and address are required",
        });
      }

      // Check if customer already exists
      const existing = await prisma.customerInfo.findUnique({
        where: { phone },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Customer with this phone already exists",
        });
      }

      const customer = await prisma.customerInfo.create({
        data: {
          phone,
          name,
          address,
          secondaryPhone,
          gender,
          hasBaby,
          preferredToy,
        },
      });
      res.status(201).json({ success: true, data: customer });
    } catch (error: any) {
      console.error("Create customer error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // UPDATE customer
  async updateCustomer(req: Request, res: Response) {
    try {
      const { phone } = req.params;
      const { name, address, secondaryPhone, gender, hasBaby, preferredToy } =
        req.body;

      const existing = await prisma.customerInfo.findUnique({
        where: { phone },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Customer not found" });
      }

      const updated = await prisma.customerInfo.update({
        where: { phone },
        data: {
          name: name || existing.name,
          address: address || existing.address,
          secondaryPhone:
            secondaryPhone !== undefined
              ? secondaryPhone
              : existing.secondaryPhone,
          gender: gender !== undefined ? gender : existing.gender,
          hasBaby: hasBaby !== undefined ? hasBaby : existing.hasBaby,
          preferredToy:
            preferredToy !== undefined ? preferredToy : existing.preferredToy,
        },
      });
      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error("Update customer error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // DELETE customer (only if no orders)
  async deleteCustomer(req: Request, res: Response) {
    try {
      const { phone } = req.params;
      const orders = await prisma.order.count({
        where: { orderedByPhone: phone },
      });
      if (orders > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot delete customer with existing orders. Delete orders first.",
        });
      }
      await prisma.customerInfo.delete({ where: { phone } });
      res.json({ success: true, message: "Customer deleted" });
    } catch (error: any) {
      console.error("Delete customer error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
