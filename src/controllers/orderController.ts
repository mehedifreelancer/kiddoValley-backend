import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

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

      // After successful order, you can call external services (WhatsApp, Pathao)
      // await sendWhatsAppNotification(...);
      // await createPathaoOrder(...);

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
