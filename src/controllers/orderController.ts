import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import pathaoService from "../services/pathao.service"; // ✅ import Pathao service

function generateInvoiceNo(): string {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

interface OrderItemInput {
  stockId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export const orderController = {
  async createOrder(req: Request, res: Response) {
    try {
      const {
        customerName,
        customerPhone,
        customerPhone2,
        customerAddress,
        deliveryDate,
        items,
        subtotal,
        discountTotal,
        total,
      } = req.body as {
        customerName: string;
        customerPhone: string;
        customerPhone2?: string;
        customerAddress: string;
        deliveryDate?: string;
        items: OrderItemInput[];
        subtotal: number;
        discountTotal: number;
        total: number;
      };

      // Validation
      if (!customerName || !customerPhone || !customerAddress) {
        return res.status(400).json({
          success: false,
          message: "Customer name, phone and address are required",
        });
      }
      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Order must contain at least one item",
        });
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1️⃣ Reduce stock for each ordered item and collect data for movement
        const stockUpdates = await Promise.all(
          items.map(async (item: OrderItemInput) => {
            // Fetch stock with variant included
            const stock = await tx.stock.findUnique({
              where: { id: item.stockId },
              include: { variant: true },
            });
            if (!stock) {
              throw new Error(`Stock with id ${item.stockId} not found`);
            }
            if (stock.currentQty < item.quantity) {
              throw new Error(
                `Insufficient stock for batch ${stock.batchNo}. Available: ${stock.currentQty}`,
              );
            }
            // Update stock quantity
            const updatedStock = await tx.stock.update({
              where: { id: item.stockId },
              data: { currentQty: { decrement: item.quantity } },
            });
            return { stock, updatedStock, item };
          }),
        );

        // 2️⃣ Prepare sold items data
        const soldItemsData = stockUpdates.map(({ stock, item }) => ({
          productId: stock.variant.productId,
          variantId: stock.variant.id,
          stockId: item.stockId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }));

        // 3️⃣ Create the order
        const order = await tx.order.create({
          data: {
            invoiceNo: generateInvoiceNo(),
            subtotal,
            discount: discountTotal,
            total,
            customerName,
            customerPhone,
            customerPhone2,
            customerAddress,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            paymentStatus: "paid",
          },
        });

        // 4️⃣ Create SoldItem records
        for (const sold of soldItemsData) {
          await tx.soldItem.create({
            data: {
              orderId: order.id,
              productId: sold.productId,
              variantId: sold.variantId,
              stockId: sold.stockId,
              quantity: sold.quantity,
              unitPrice: sold.unitPrice,
              totalPrice: sold.totalPrice,
            },
          });
        }

        // 5️⃣ Create StockMovement records (tracking stock reduction)
        for (const { stock, item } of stockUpdates) {
          await tx.stockMovement.create({
            data: {
              stockId: item.stockId,
              productId: stock.variant.productId,
              type: "SALE",
              quantity: -item.quantity,
              reason: `Order #${order.invoiceNo} placed by ${customerName}`,
              referenceId: order.id,
              createdBy: (req as any).admin?.id,
            },
          });
        }

        return order;
      });

      // ✅ AFTER order is successfully created – create Pathao courier order (non‑blocking)
      // We pass the order data to Pathao. If it fails, we log but don't stop the response.
      const pathaoPayload = {
        merchant_order_id: String(result.id),
        recipient_name: customerName,
        recipient_phone: customerPhone,
        recipient_address: customerAddress,
        delivery_type: 48, // Normal delivery
        item_type: 2,      // Parcel
        item_weight: 0.5,  // Default weight – you can calculate from items
        amount_to_collect: total,
        item_quantity: items.length,
      };

      // ⚠️ Hardcoded store ID from user input (8941100311400) – you can remove and use dynamic store fetch if needed.
      // The service will fetch the store ID dynamically unless you override it.
      // If you want to use a fixed store ID, modify the service or pass it here.
      try {
        const pathaoResult = await pathaoService.createOrder(pathaoPayload);
        console.log("✅ Pathao order created:", pathaoResult.consignment_id);
        // Optionally save consignment_id to the order record (if you add a column)
        // await prisma.order.update({ where: { id: result.id }, data: { pathaoConsignmentId: pathaoResult.consignment_id } });
      } catch (pathaoError: any) {
        // Log error but DO NOT block the order response
        console.error("❌ Pathao order creation failed (non-blocking):", pathaoError.message);
        // You could also send a notification to admin about the failure.
      }

      res.status(201).json({
        success: true,
        data: result,
        message: "Order created successfully",
      });
    } catch (error: any) {
      console.error("Create order error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};