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
    await prisma.customerInfo.update({
      where: { phone },
      data: { name, address, secondaryPhone, gender, hasBaby, preferredToy },
    });
  }
  return customer;
};

// ----- Helper: send email -----
const sendOrderEmail = async (order: any) => {
  const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const emailPayload = {
    to: process.env.ADMIN_EMAIL || "kiddovalley451@gmail.com",
    subject: `Order #${order.invoiceNo} – Confirmed`,
    html: `
      <h2>Order Confirmation</h2>
      <p><strong>Invoice:</strong> ${order.invoiceNo}</p>
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <p><strong>Phone:</strong> ${order.customerPhone}</p>
      <p><strong>Address:</strong> ${order.customerAddress}</p>
      <p><strong>Total:</strong> ${order.total.toFixed(2)} TK</p>
      <p><strong>Delivery Date:</strong> ${
        order.deliveryDate
          ? new Date(order.deliveryDate).toLocaleDateString()
          : "N/A"
      }</p>
      <hr/>
      <h4>Items</h4>
      <ul>
        ${order.soldItems?.map((item: any) => `<li>${item.productName} – Qty: ${item.quantity} – Price: ${item.totalPrice.toFixed(2)} TK</li>`).join("") || "No items"}
      </ul>
    `,
  };
  await axios.post(`${baseUrl}/api/public/email/send`, emailPayload);
};

export const orderController = {
  // -------------------- 1. CREATE ORDER (status 'new', no Pathao) --------------------
  async createOrder(req: Request, res: Response) {
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
      } = req.body;

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

      const customer = await getOrCreateCustomer(
        customerPhone,
        customerName,
        customerAddress,
        customerPhone2,
        gender,
        hasBaby,
        preferredToy,
      );

      const order = await prisma.$transaction(async (tx) => {
        // Stock check and reduce
        const stockUpdates = await Promise.all(
          items.map(async (item: OrderItemInput) => {
            const stock = await tx.stock.findUnique({
              where: { id: item.stockId },
              include: { variant: { include: { product: true } } },
            });
            if (!stock) throw new Error(`Stock ${item.stockId} not found`);
            if (stock.currentQty < item.quantity) {
              throw new Error(
                `Insufficient stock for batch ${stock.batchNo}. Available: ${stock.currentQty}`,
              );
            }
            const updated = await tx.stock.update({
              where: { id: item.stockId },
              data: { currentQty: { decrement: item.quantity } },
            });
            return { stock, updated, item };
          }),
        );

        // Create order
        const newOrder = await tx.order.create({
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
            orderStatus: "new",
            deliveryStatus: null,
            isWebsiteOrder: false,
          },
        });

        // SoldItem (with snapshot)
        for (const { stock, item } of stockUpdates) {
          const variant = stock.variant;
          await tx.soldItem.create({
            data: {
              orderId: newOrder.id,
              productId: variant.productId,
              variantId: variant.id,
              stockId: item.stockId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              productName: variant.product.name,
              variantSku: variant.sku,
              variantAttributes: variant.attributes as any,
            },
          });
        }

        // StockMovement log
        for (const { stock, item } of stockUpdates) {
          await tx.stockMovement.create({
            data: {
              stockId: item.stockId,
              productId: stock.variant.productId,
              type: "SALE",
              quantity: -item.quantity,
              reason: `Order #${newOrder.invoiceNo} created`,
              referenceId: newOrder.id,
              createdBy: (req as any).admin?.id,
            },
          });
        }

        return newOrder;
      });

      try {
        await sendOrderEmail(order);
      } catch (emailError) {
        console.error("Email failed:", emailError);
      }

      res.status(201).json({
        success: true,
        data: order,
        message: "Order created (status: new)",
      });
    } catch (error: any) {
      console.error("Create order error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 2. CONFIRM ORDER (existing order -> 'confirmed' + Pathao) --------------------
  async confirmOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid order ID" });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { soldItems: true },
      });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      if (order.orderStatus !== "new" && order.orderStatus !== "confirmed") {
        return res.status(400).json({
          success: false,
          message: "Only 'new' or 'confirmed' orders can be confirmed",
        });
      }
      if (order.pathaoConsignmentId) {
        return res.status(400).json({
          success: false,
          message: "Order already has Pathao consignment",
        });
      }

      const totalQuantity = order.soldItems.reduce(
        (sum, item) => sum + item.quantity,
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
          message: "Pathao booking failed: " + err.message,
        });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          orderStatus: "confirmed",
          deliveryStatus: "Pending",
          pathaoConsignmentId: pathaoResult.consignment_id,
          pathaoLastSyncedAt: new Date(),
        },
        include: { soldItems: true },
      });

      try {
        await sendOrderEmail(updatedOrder);
      } catch (emailError) {
        console.error("Email failed:", emailError);
      }

      res.json({
        success: true,
        data: updatedOrder,
        message: "Order confirmed and Pathao booked",
      });
    } catch (error: any) {
      console.error("Confirm order error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 3. CREATE + CONFIRM (shortcut) --------------------
  async createAndConfirmOrder(req: Request, res: Response) {
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
      } = req.body;

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

      const customer = await getOrCreateCustomer(
        customerPhone,
        customerName,
        customerAddress,
        customerPhone2,
        gender,
        hasBaby,
        preferredToy,
      );

      // 1) Create order (status 'confirmed')
      const order = await prisma.$transaction(async (tx) => {
        // Stock check and reduce
        const stockUpdates = await Promise.all(
          items.map(async (item: OrderItemInput) => {
            const stock = await tx.stock.findUnique({
              where: { id: item.stockId },
              include: { variant: { include: { product: true } } },
            });
            if (!stock) throw new Error(`Stock ${item.stockId} not found`);
            if (stock.currentQty < item.quantity) {
              throw new Error(`Insufficient stock for batch ${stock.batchNo}`);
            }
            return await tx.stock.update({
              where: { id: item.stockId },
              data: { currentQty: { decrement: item.quantity } },
            });
          }),
        );

        const newOrder = await tx.order.create({
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
            orderStatus: "confirmed",
            deliveryStatus: null,
            isWebsiteOrder: false,
          },
        });

        for (const item of items) {
          const stock = await tx.stock.findUnique({
            where: { id: item.stockId },
            include: { variant: { include: { product: true } } },
          });
          if (!stock) continue;
          await tx.soldItem.create({
            data: {
              orderId: newOrder.id,
              productId: stock.variant.productId,
              variantId: stock.variant.id,
              stockId: item.stockId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              productName: stock.variant.product.name,
              variantSku: stock.variant.sku,
              variantAttributes: stock.variant.attributes as any,
            },
          });
        }

        for (const item of items) {
          const stock = await tx.stock.findUnique({
            where: { id: item.stockId },
            include: { variant: true },
          });
          if (!stock) continue;
          await tx.stockMovement.create({
            data: {
              stockId: item.stockId,
              productId: stock.variant.productId,
              type: "SALE",
              quantity: -item.quantity,
              reason: `Order #${newOrder.invoiceNo} created and confirmed`,
              referenceId: newOrder.id,
              createdBy: (req as any).admin?.id,
            },
          });
        }

        return newOrder;
      });

      // 2) Pathao order creation
      const totalQuantity = items.reduce(
        (sum: number, item: OrderItemInput) => sum + item.quantity,
        0,
      );

      const pathaoPayload = {
        merchant_order_id: String(order.id),
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
      }

      let updatedOrder = order;
      if (pathaoResult) {
        updatedOrder = await prisma.order.update({
          where: { id: order.id },
          data: {
            pathaoConsignmentId: pathaoResult.consignment_id,
            deliveryStatus: "Pending",
            pathaoLastSyncedAt: new Date(),
          },
          include: { soldItems: true },
        });
      } else {
        updatedOrder =
          (await prisma.order.findUnique({
            where: { id: order.id },
            include: { soldItems: true },
          })) || order;
      }

      try {
        await sendOrderEmail(updatedOrder);
      } catch (emailError) {
        console.error("Email failed:", emailError);
      }

      res.status(201).json({
        success: true,
        data: updatedOrder,
        message: pathaoResult
          ? "Order created and confirmed (Pathao booked)"
          : "Order created and confirmed (Pathao failed)",
      });
    } catch (error: any) {
      console.error("Create & confirm error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 4. CANCEL ORDER --------------------
  async cancelOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid order ID" });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { soldItems: true },
      });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      if (order.orderStatus === "cancelled") {
        return res
          .status(400)
          .json({ success: false, message: "Order already cancelled" });
      }

      if (order.pathaoConsignmentId) {
        try {
          await pathaoService.cancelOrder(order.pathaoConsignmentId);
        } catch (err) {
          console.error("Pathao cancel failed:", err);
        }
      }

      const cancelledOrder = await prisma.$transaction(async (tx) => {
        for (const sold of order.soldItems) {
          await tx.stock.update({
            where: { id: sold.stockId! },
            data: { currentQty: { increment: sold.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              stockId: sold.stockId!,
              productId: sold.productId!,
              type: "ADJUSTMENT",
              quantity: sold.quantity,
              reason: `Order #${order.invoiceNo} cancelled – stock restored`,
              referenceId: order.id,
              createdBy: (req as any).admin?.id,
            },
          });
        }

        return await tx.order.update({
          where: { id: orderId },
          data: {
            orderStatus: "cancelled",
            paymentStatus: "cancelled",
            deliveryStatus: order.pathaoConsignmentId
              ? "Cancelled"
              : "Cancelled (No Pathao)",
          },
          include: { soldItems: true },
        });
      });

      res.json({
        success: true,
        data: cancelledOrder,
        message: "Order cancelled",
      });
    } catch (error: any) {
      console.error("Cancel order error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 5. DELETE ORDER (hard delete, only if cancelled) --------------------
  async deleteOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid order ID" });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { soldItems: true },
      });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      if (order.orderStatus !== "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Only cancelled orders can be deleted",
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.soldItem.deleteMany({ where: { orderId: orderId } });
        await tx.order.delete({ where: { id: orderId } });
      });

      res.json({ success: true, message: "Order deleted permanently" });
    } catch (error: any) {
      console.error("Delete order error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 6. GET ORDER DETAILS --------------------
  async getOrderDetails(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid order ID" });
      }

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { soldItems: true, customerInfo: true },
      });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }

      res.json({ success: true, data: order });
    } catch (error: any) {
      console.error("Get order details error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 7. LIST ORDERS (with pagination & search) --------------------
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
        include: { soldItems: true },
      });

      res.json({
        success: true,
        data: orders,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      console.error("Get orders error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 8. WEBSITE ORDER (public) --------------------
  async createWebsiteOrder(req: Request, res: Response) {
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
      } = req.body;

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

      const customer = await getOrCreateCustomer(
        customerPhone,
        customerName,
        customerAddress,
        customerPhone2,
        gender,
        hasBaby,
        preferredToy,
      );

      const isSuspicious = total > 2000;

      const order = await prisma.$transaction(async (tx) => {
        // Stock check and reduce
        const stockUpdates = await Promise.all(
          items.map(async (item: OrderItemInput) => {
            const stock = await tx.stock.findUnique({
              where: { id: item.stockId },
              include: { variant: { include: { product: true } } },
            });
            if (!stock) throw new Error(`Stock ${item.stockId} not found`);
            if (stock.currentQty < item.quantity) {
              throw new Error(`Insufficient stock for batch ${stock.batchNo}`);
            }
            return await tx.stock.update({
              where: { id: item.stockId },
              data: { currentQty: { decrement: item.quantity } },
            });
          }),
        );

        const newOrder = await tx.order.create({
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
            orderStatus: "new",
            deliveryStatus: null,
            isWebsiteOrder: true,
            isSuspicious: isSuspicious,
          },
        });

        for (const item of items) {
          const stock = await tx.stock.findUnique({
            where: { id: item.stockId },
            include: { variant: { include: { product: true } } },
          });
          if (!stock) continue;
          await tx.soldItem.create({
            data: {
              orderId: newOrder.id,
              productId: stock.variant.productId,
              variantId: stock.variant.id,
              stockId: item.stockId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              productName: stock.variant.product.name,
              variantSku: stock.variant.sku,
              variantAttributes: stock.variant.attributes as any,
            },
          });
        }

        for (const item of items) {
          const stock = await tx.stock.findUnique({
            where: { id: item.stockId },
            include: { variant: true },
          });
          if (!stock) continue;
          await tx.stockMovement.create({
            data: {
              stockId: item.stockId,
              productId: stock.variant.productId,
              type: "SALE",
              quantity: -item.quantity,
              reason: `Website order #${newOrder.invoiceNo}`,
              referenceId: newOrder.id,
            },
          });
        }

        return newOrder;
      });

      try {
        await sendOrderEmail(order);
      } catch (emailError) {
        console.error("Email failed:", emailError);
      }

      res.status(201).json({
        success: true,
        data: order,
        message: isSuspicious
          ? "Order placed (suspicious). Admin will contact you."
          : "Order placed successfully.",
      });
    } catch (error: any) {
      console.error("Website order error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 9. CHECK CUSTOMER EXISTS --------------------
  async checkCustomerExists(req: Request, res: Response) {
    try {
      const { phone } = req.query;
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }
      const customer = await prisma.customerInfo.findUnique({
        where: { phone: String(phone) },
      });
      res.json({
        success: true,
        exists: !!customer,
        customer: customer || null,
      });
    } catch (error: any) {
      console.error("Check customer error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // -------------------- 10. UPDATE ORDER (only customer info for 'new' orders) --------------------
  // -------------------- UPDATE ORDER (with items & stock adjustment) --------------------
  async updateOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      if (isNaN(orderId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid order ID" });
      }

      const {
        customerName,
        customerPhone,
        customerPhone2,
        customerAddress,
        deliveryDate,
        items, // অর্ডারের নতুন আইটেম লিস্ট
        subtotal,
        discountTotal,
        total,
      } = req.body;

      // existing order with soldItems
      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { soldItems: true },
      });
      if (!existingOrder) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      if (existingOrder.orderStatus === "cancelled") {
        return res
          .status(400)
          .json({ success: false, message: "Cannot edit a cancelled order" });
      }
      if (existingOrder.orderStatus !== "new") {
        return res
          .status(400)
          .json({ success: false, message: "Only 'new' orders can be edited" });
      }

      // Validate items
      if (!items || items.length === 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Order must contain at least one item",
          });
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1) Restore stock from old sold items
        for (const sold of existingOrder.soldItems) {
          await tx.stock.update({
            where: { id: sold.stockId! },
            data: { currentQty: { increment: sold.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              stockId: sold.stockId!,
              productId: sold.productId!,
              type: "ADJUSTMENT",
              quantity: sold.quantity,
              reason: `Order #${existingOrder.invoiceNo} edited – stock restored`,
              referenceId: orderId,
            },
          });
        }

        // 2) Delete old soldItems
        await tx.soldItem.deleteMany({ where: { orderId: orderId } });

        // 3) Deduct new stock and create new soldItems
        const stockUpdates = await Promise.all(
          items.map(async (item: any) => {
            const stock = await tx.stock.findUnique({
              where: { id: item.stockId },
              include: { variant: { include: { product: true } } },
            });
            if (!stock) throw new Error(`Stock ${item.stockId} not found`);
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

        // Create new soldItems with snapshot
        for (const { stock, item } of stockUpdates) {
          await tx.soldItem.create({
            data: {
              orderId: orderId,
              productId: stock.variant.productId,
              variantId: stock.variant.id,
              stockId: item.stockId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              productName: stock.variant.product.name,
              variantSku: stock.variant.sku,
              variantAttributes: stock.variant.attributes as any,
            },
          });
        }

        // 4) StockMovement for new deductions
        for (const { stock, item } of stockUpdates) {
          await tx.stockMovement.create({
            data: {
              stockId: item.stockId,
              productId: stock.variant.productId,
              type: "SALE",
              quantity: -item.quantity,
              reason: `Order #${existingOrder.invoiceNo} edited – new stock deduction`,
              referenceId: orderId,
            },
          });
        }

        // 5) Update order info (customer, totals)
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            customerName: customerName || existingOrder.customerName,
            customerPhone: customerPhone || existingOrder.customerPhone,
            customerPhone2:
              customerPhone2 !== undefined
                ? customerPhone2
                : existingOrder.customerPhone2,
            customerAddress: customerAddress || existingOrder.customerAddress,
            deliveryDate: deliveryDate
              ? new Date(deliveryDate)
              : existingOrder.deliveryDate,
            subtotal: subtotal || existingOrder.subtotal,
            discount: discountTotal || existingOrder.discount,
            total: total || existingOrder.total,
          },
          include: { soldItems: true },
        });

        return updatedOrder;
      });

      res.json({
        success: true,
        data: result,
        message: "Order updated successfully",
      });
    } catch (error: any) {
      console.error("Update order error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
