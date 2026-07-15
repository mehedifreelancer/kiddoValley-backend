import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import pathaoService from "../services/pathao.service";
import axios from "axios";

function generateInvoiceNo(): string {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

interface OrderItemInput {
  stockId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// ----- Helper: get or create customer -----
const getOrCreateCustomer = async (
  phone: string,
  name: string,
  address: string,
  secondaryPhone?: string,
  gender?: string,
  hasBaby?: boolean,
  preferredToy?: string,
) => {
  let customer = await prisma.customerInfo.findUnique({ where: { phone } });
  if (!customer) {
    customer = await prisma.customerInfo.create({
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
  } else {
    // Update if info changed
    await prisma.customerInfo.update({
      where: { phone },
      data: { name, address, secondaryPhone, gender, hasBaby, preferredToy },
    });
  }
  return customer;
};

// ----- Helper: send email using your existing public endpoint -----
const sendOrderEmail = async (order: any) => {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const emailPayload = {
    to: process.env.ADMIN_EMAIL || "admin@example.com",
    subject: `Order #${order.invoiceNo} – Confirmed`,
    html: `
      <h2>Order Confirmation</h2>
      <p><strong>Invoice:</strong> ${order.invoiceNo}</p>
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <p><strong>Phone:</strong> ${order.customerPhone}</p>
      <p><strong>Address:</strong> ${order.customerAddress}</p>
      <p><strong>Total:</strong> ${order.total.toFixed(2)} TK</p>
      <p><strong>Delivery Date:</strong> ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "N/A"}</p>
      <hr/>
      <h4>Items</h4>
      <ul>
        ${
          order.soldItems
            ?.map(
              (item: any) =>
                `<li>Product ID: ${item.productId} – Qty: ${item.quantity} – Price: ${item.totalPrice.toFixed(2)} TK</li>`,
            )
            .join("") || "No items"
        }
      </ul>
    `,
  };
  await axios.post(`${baseUrl}/api/public/email/send`, emailPayload);
};

export const orderController = {
  // ---------- 1. Confirm Order (DB only) ----------
  async confirmOrder(req: Request, res: Response) {
    try {
      const {
        customerName,
        customerPhone,
        customerPhone2,
        customerAddress,
        gender,
        hasBaby,
        preferredToy,
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
        gender?: string;
        hasBaby?: boolean;
        preferredToy?: string;
        deliveryDate?: string;
        items: OrderItemInput[];
        subtotal: number;
        discountTotal: number;
        total: number;
      };

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

      // Get or create customer
      const customer = await getOrCreateCustomer(
        customerPhone,
        customerName,
        customerAddress,
        customerPhone2,
        gender,
        hasBaby,
        preferredToy,
      );

      const result = await prisma.$transaction(async (tx) => {
        // Reduce stock
        const stockUpdates = await Promise.all(
          items.map(async (item: OrderItemInput) => {
            const stock = await tx.stock.findUnique({
              where: { id: item.stockId },
              include: { variant: true },
            });
            if (!stock)
              throw new Error(`Stock with id ${item.stockId} not found`);
            if (stock.currentQty < item.quantity) {
              throw new Error(
                `Insufficient stock for batch ${stock.batchNo}. Available: ${stock.currentQty}`,
              );
            }
            const updatedStock = await tx.stock.update({
              where: { id: item.stockId },
              data: { currentQty: { decrement: item.quantity } },
            });
            return { stock, updatedStock, item };
          }),
        );

        const soldItemsData = stockUpdates.map(({ stock, item }) => ({
          productId: stock.variant.productId,
          variantId: stock.variant.id,
          stockId: item.stockId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }));

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
            orderedByPhone: customer.phone,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            paymentStatus: "paid",
            deliveryStatus: "Confirmed",
          },
        });

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

      res.status(201).json({
        success: true,
        data: result,
        message: "Order confirmed (DB only)",
      });
    } catch (error: any) {
      console.error("Confirm order error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // ---------- 2. Confirm & Pack (DB + Pathao + mandatory email) ----------
  async confirmAndPack(req: Request, res: Response) {
    try {
      const {
        customerName,
        customerPhone,
        customerPhone2,
        customerAddress,
        gender,
        hasBaby,
        preferredToy,
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
        gender?: string;
        hasBaby?: boolean;
        preferredToy?: string;
        deliveryDate?: string;
        items: OrderItemInput[];
        subtotal: number;
        discountTotal: number;
        total: number;
      };

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

      // Get or create customer
      const customer = await getOrCreateCustomer(
        customerPhone,
        customerName,
        customerAddress,
        customerPhone2,
        gender,
        hasBaby,
        preferredToy,
      );

      // 1) Create order in DB
      const order = await prisma.$transaction(async (tx) => {
        const stockUpdates = await Promise.all(
          items.map(async (item: OrderItemInput) => {
            const stock = await tx.stock.findUnique({
              where: { id: item.stockId },
              include: { variant: true },
            });
            if (!stock)
              throw new Error(`Stock with id ${item.stockId} not found`);
            if (stock.currentQty < item.quantity) {
              throw new Error(
                `Insufficient stock for batch ${stock.batchNo}. Available: ${stock.currentQty}`,
              );
            }
            const updatedStock = await tx.stock.update({
              where: { id: item.stockId },
              data: { currentQty: { decrement: item.quantity } },
            });
            return { stock, updatedStock, item };
          }),
        );

        const soldItemsData = stockUpdates.map(({ stock, item }) => ({
          productId: stock.variant.productId,
          variantId: stock.variant.id,
          stockId: item.stockId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }));

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
            orderedByPhone: customer.phone,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            paymentStatus: "paid",
            deliveryStatus: "Pending",
          },
        });

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

      // 2) Create Pathao order (non‑blocking)
      const orderId = order.id;
      const pathaoPayload = {
        merchant_order_id: String(orderId),
        recipient_name: customerName,
        recipient_phone: customerPhone,
        recipient_address: customerAddress,
        delivery_type: 48,
        item_type: 2,
        item_weight: 0.5,
        amount_to_collect: total,
        item_quantity: items.length,
      };

      let pathaoResult = null;
      try {
        pathaoResult = await pathaoService.createOrder(pathaoPayload);
        console.log("✅ Pathao order created:", pathaoResult.consignment_id);
      } catch (err: any) {
        console.error("❌ Pathao creation failed:", err.message);
        // Continue – order is still saved
      }

      // 3) Update order with consignment ID if Pathao succeeded
      let updatedOrder = order;
      if (pathaoResult) {
        updatedOrder = await prisma.order.update({
          where: { id: orderId },
          data: {
            pathaoConsignmentId: pathaoResult.consignment_id,
            deliveryStatus: "Pending",
            pathaoLastSyncedAt: new Date(),
          },
          include: { soldItems: true },
        });
      } else {
        const fetched = await prisma.order.findUnique({
          where: { id: orderId },
          include: { soldItems: true },
        });
        if (fetched) updatedOrder = fetched;
      }

      // 4) Send email (mandatory)
      try {
        await sendOrderEmail(updatedOrder);
        console.log(`✅ Email sent for order ${updatedOrder.id}`);
      } catch (emailError: any) {
        console.error(
          `❌ Email failed for order ${updatedOrder.id}:`,
          emailError.message,
        );
        // Do not throw – order is already created and packed
      }

      res.status(201).json({
        success: true,
        data: updatedOrder,
        message: "Order confirmed and packed (email sent)",
      });
    } catch (error: any) {
      console.error("Confirm & Pack error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // ---------- 3. Pack Existing Order (for orders without consignment) ----------
  async packExistingOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID",
        });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { soldItems: true },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (order.pathaoConsignmentId) {
        return res.json({
          success: true,
          data: order,
          message: "Order already has Pathao consignment",
        });
      }

      const totalQuantity = order.soldItems.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0,
      );

      const pathaoPayload = {
        merchant_order_id: String(orderId),
        recipient_name: order.customerName,
        recipient_phone: order.customerPhone,
        recipient_address: order.customerAddress,
        delivery_type: 48,
        item_type: 2,
        item_weight: 0.5,
        amount_to_collect: order.total,
        item_quantity: totalQuantity || 1,
      };

      let pathaoResult = null;
      try {
        pathaoResult = await pathaoService.createOrder(pathaoPayload);
        console.log("✅ Pathao order created:", pathaoResult.consignment_id);
      } catch (err: any) {
        console.error("❌ Pathao creation failed:", err.message);
        return res.status(500).json({
          success: false,
          message: "Pathao order creation failed: " + err.message,
        });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          pathaoConsignmentId: pathaoResult.consignment_id,
          deliveryStatus: "Pending",
          pathaoLastSyncedAt: new Date(),
        },
        include: { soldItems: true },
      });

      res.json({
        success: true,
        data: updatedOrder,
        message: "Order packed successfully",
      });
    } catch (error: any) {
      console.error("Pack existing order error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // ---------- 4. Reprint Order (fetch order data) ----------
  async reprintOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID",
        });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { soldItems: true },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      res.json({ success: true, data: order });
    } catch (error: any) {
      console.error("Reprint order error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // ---------- 5. Update Order (Edit) ----------
  async updateOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID",
        });
      }

      const {
        customerName,
        customerPhone,
        customerPhone2,
        customerAddress,
        deliveryDate,
        gender,
        hasBaby,
        preferredToy,
      } = req.body;

      const existing = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (existing.paymentStatus === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Cannot edit a cancelled order",
        });
      }

      const isEditable =
        !existing.pathaoConsignmentId ||
        existing.deliveryStatus === "Pending" ||
        existing.deliveryStatus === "Assigned";

      if (!isEditable) {
        return res.status(400).json({
          success: false,
          message:
            "Order cannot be edited because it is already packed or in transit",
        });
      }

      // Update customer info if phone changes or other info changes
      if (customerPhone && customerPhone !== existing.customerPhone) {
        await getOrCreateCustomer(
          customerPhone,
          customerName || existing.customerName,
          customerAddress || existing.customerAddress,
          customerPhone2 || existing.customerPhone2 || undefined,
          gender,
          hasBaby,
          preferredToy,
        );
      } else {
        // Update customer info even if phone didn't change
        const customer = await prisma.customerInfo.findUnique({
          where: { phone: existing.customerPhone },
        });
        if (customer) {
          await prisma.customerInfo.update({
            where: { phone: existing.customerPhone },
            data: {
              name: customerName || customer.name,
              address: customerAddress || customer.address,
              secondaryPhone: customerPhone2 || customer.secondaryPhone,
              gender: gender !== undefined ? gender : customer.gender,
              hasBaby: hasBaby !== undefined ? hasBaby : customer.hasBaby,
              preferredToy:
                preferredToy !== undefined
                  ? preferredToy
                  : customer.preferredToy,
            },
          });
        }
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          customerName: customerName || existing.customerName,
          customerPhone: customerPhone || existing.customerPhone,
          customerPhone2:
            customerPhone2 !== undefined
              ? customerPhone2
              : existing.customerPhone2,
          customerAddress: customerAddress || existing.customerAddress,
          deliveryDate: deliveryDate
            ? new Date(deliveryDate)
            : existing.deliveryDate,
          orderedByPhone: customerPhone || existing.customerPhone,
        },
        include: { soldItems: true },
      });

      res.json({
        success: true,
        data: updated,
        message: "Order updated successfully",
      });
    } catch (error: any) {
      console.error("Update order error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // ---------- 6. Cancel Order (with stock restoration) ----------
  async cancelOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID",
        });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { soldItems: true },
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (order.paymentStatus === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Order is already cancelled",
        });
      }

      let pathaoCancelled = false;
      let pathaoErrorMessage = null;

      if (order.pathaoConsignmentId) {
        try {
          await pathaoService.cancelOrder(order.pathaoConsignmentId);
          pathaoCancelled = true;
          console.log(`✅ Pathao order ${order.pathaoConsignmentId} cancelled`);
        } catch (err: any) {
          pathaoErrorMessage = err.message;
          console.error("❌ Pathao cancellation failed:", err.message);
          // Continue – we still cancel in DB and restore stock
        }
      }

      const cancelled = await prisma.$transaction(async (tx) => {
        // Restore stock
        for (const sold of order.soldItems) {
          await tx.stock.update({
            where: { id: sold.stockId },
            data: { currentQty: { increment: sold.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              stockId: sold.stockId,
              productId: sold.productId,
              type: "ADJUSTMENT",
              quantity: sold.quantity,
              reason: `Order #${order.invoiceNo} cancelled – stock restored`,
              referenceId: order.id,
              createdBy: (req as any).admin?.id,
            },
          });
        }

        // Update order status
        const cancelledOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "cancelled",
            deliveryStatus: pathaoCancelled
              ? "Cancelled"
              : "Cancelled (Pathao active)",
          },
          include: { soldItems: true },
        });

        return cancelledOrder;
      });

      let message = "Order cancelled successfully, stock restored.";
      if (!pathaoCancelled && pathaoErrorMessage) {
        message = `Order cancelled and stock restored, but Pathao courier could not be cancelled (${pathaoErrorMessage}). Please contact Pathao if needed.`;
      }

      res.json({ success: true, data: cancelled, message });
    } catch (error: any) {
      console.error("Cancel order error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // ---------- 7. Get Orders (list with pagination) ----------
  async getOrders(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const skip = (page - 1) * limit;
      const where: any = {};

      if (search) {
        where.OR = [
          { invoiceNo: { contains: search } },
          { customerName: { contains: search } },
          { customerPhone: { contains: search } },
          { pathaoConsignmentId: { contains: search } },
        ];
      }

      const total = await prisma.order.count({ where });

      const orders = await prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      });

      res.json({
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("Get orders error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // ---------- 8. Batch Sync Pathao Statuses ----------
  async syncPathaoStatuses(req: Request, res: Response) {
    try {
      const { orderIds } = req.body;
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "orderIds required",
        });
      }

      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds }, pathaoConsignmentId: { not: null } },
      });

      const results = await Promise.all(
        orders.map(async (order) => {
          try {
            const statusData = await pathaoService.getOrderStatus(
              order.pathaoConsignmentId!,
            );
            console.log(
              `📦 Pathao status for ${order.id}:`,
              JSON.stringify(statusData, null, 2),
            );

            const deliveryStatus =
              statusData.order_status ||
              statusData.order_status_slug ||
              "Pending";

            await prisma.order.update({
              where: { id: order.id },
              data: {
                deliveryStatus: deliveryStatus,
                pathaoInvoiceId: statusData.invoice_id || null,
                pathaoLastSyncedAt: new Date(),
              },
            });

            return {
              orderId: order.id,
              success: true,
              status: deliveryStatus,
            };
          } catch (err: any) {
            console.error(`❌ Failed to sync order ${order.id}:`, err.message);
            return { orderId: order.id, success: false, error: err.message };
          }
        }),
      );

      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error("Batch sync error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};
