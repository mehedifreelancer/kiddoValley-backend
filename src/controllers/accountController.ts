import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  calculateCashBalance,
  calculateSalesFinancials,
} from "../utils/financials";

// ==================== Transaction Category CRUD ====================
export const accountController = {
  // ----- Get all categories (with pagination & search) -----
  async getCategories(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where = search
        ? { name: { contains: search, mode: "insensitive" } }
        : {};

      const [data, total] = await Promise.all([
        prisma.transactionCategory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: "asc" },
        }),
        prisma.transactionCategory.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("Get categories error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ----- Create category -----
  async createCategory(req: Request, res: Response) {
    try {
      const { name, type, description } = req.body;
      if (!name || !type) {
        return res.status(400).json({
          success: false,
          message: "Name and type are required",
        });
      }
      if (!["in", "out"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Type must be 'in' or 'out'",
        });
      }

      const existing = await prisma.transactionCategory.findUnique({
        where: { name },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Category name already exists",
        });
      }

      const category = await prisma.transactionCategory.create({
        data: { name, type, description },
      });

      res.status(201).json({ success: true, data: category });
    } catch (error: any) {
      console.error("Create category error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ----- Update category -----
  async updateCategory(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, type, description } = req.body;

      if (type && !["in", "out"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Type must be 'in' or 'out'",
        });
      }

      const category = await prisma.transactionCategory.update({
        where: { id },
        data: { name, type, description },
      });
      res.json({ success: true, data: category });
    } catch (error: any) {
      console.error("Update category error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ----- Delete category -----
  async deleteCategory(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      // Check if any transaction uses this category
      const count = await prisma.transaction.count({
        where: { categoryId: id },
      });
      if (count > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete category with existing transactions",
        });
      }
      await prisma.transactionCategory.delete({ where: { id } });
      res.json({ success: true, message: "Category deleted" });
    } catch (error: any) {
      console.error("Delete category error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ==================== Transaction CRUD ====================

  // ----- Get all transactions (with filters) -----
  async getTransactions(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined;
      const type = req.query.type as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (search) {
        where.OR = [
          { note: { contains: search, mode: "insensitive" } },
          { category: { name: { contains: search, mode: "insensitive" } } },
        ];
      }
      if (categoryId) where.categoryId = categoryId;
      if (type) where.category = { type };
      if (startDate) where.date = { gte: new Date(startDate) };
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date = { ...(where.date || {}), lte: end };
      }

      const [data, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          include: { category: true },
          orderBy: { date: "desc" },
        }),
        prisma.transaction.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("Get transactions error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ----- Create transaction -----
  async createTransaction(req: Request, res: Response) {
    try {
      const { categoryId, amount, note, date } = req.body;
      const adminId = (req as any).admin?.id;

      if (!categoryId || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Category and positive amount are required",
        });
      }

      // Check if category exists
      const category = await prisma.transactionCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Invalid category",
        });
      }

      // Check cash balance for 'out' transactions (optional but recommended)
      if (category.type === "out") {
        // ✅ sales সহ পুরো ব্যবসার cash balance — orders + transactions একসাথে
        const currentCash = await calculateCashBalance();
        if (currentCash < amount) {
          return res.status(400).json({
            success: false,
            message: `Insufficient cash balance. Current cash: ${currentCash.toFixed(2)}. You can add money via 'Add Capital' or 'Return Loan' first.`,
          });
        }
      }

      const transaction = await prisma.transaction.create({
        data: {
          categoryId,
          amount,
          note,
          date: date ? new Date(date) : new Date(),
          createdBy: adminId,
        },
        include: { category: true },
      });

      res.status(201).json({ success: true, data: transaction });
    } catch (error: any) {
      console.error("Create transaction error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ----- Update transaction -----
  async updateTransaction(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { categoryId, amount, note, date } = req.body;

      // Validate
      if (amount && amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be positive",
        });
      }

      const transaction = await prisma.transaction.update({
        where: { id },
        data: {
          categoryId,
          amount,
          note,
          date: date ? new Date(date) : undefined,
        },
        include: { category: true },
      });
      res.json({ success: true, data: transaction });
    } catch (error: any) {
      console.error("Update transaction error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ----- Delete transaction -----
  async deleteTransaction(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await prisma.transaction.delete({ where: { id } });
      res.json({ success: true, message: "Transaction deleted" });
    } catch (error: any) {
      console.error("Delete transaction error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ----- Get dashboard summary -----
  async getDashboardSummary(req: Request, res: Response) {
    try {
      // 1. Cash balance — ✅ orders (sales) + transactions একসাথে, single source
      const cashBalance = await calculateCashBalance();

      // 2. Stock value (as example – if you have stock valuation)
      const stockResult = await prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(currentQty * buyingOrMakingPrice), 0) as total FROM stocks
      `;
      const stockValue = stockResult[0]?.total || 0;

      // 3. Profit/Loss for current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      // ✅ Sells Report / Annual Report-এর মতোই একই function দিয়ে এই মাসের
      // sales net profit বের করা হচ্ছে (gross profit - delivery - packaging - refund)
      const { salesNetProfit: totalSalesNetProfit } =
        await calculateSalesFinancials(startOfMonth, endOfMonth);

      // Income transactions (sales কখনো transaction row হয় না, তাই এখানে
      // "sales_revenue" exclude করার কোনো দরকার নেই — সবই genuinely non-sales)
      const incomeTransactions = await prisma.transaction.aggregate({
        where: {
          category: { type: "in" },
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      });

      // Expense transactions (non-sales expenses)
      const expenseTransactions = await prisma.transaction.aggregate({
        where: {
          category: { type: "out" },
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      });

      const totalIncome = incomeTransactions._sum.amount || 0;
      const totalExpense = expenseTransactions._sum.amount || 0;
      const profit = totalSalesNetProfit + totalIncome - totalExpense;

      res.json({
        success: true,
        data: {
          cashBalance,
          stockValue,
          profit,
          month: `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`,
        },
      });
    } catch (error: any) {
      console.error("Dashboard summary error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // ----- Get all categories (no pagination – for dropdown) -----
  async getAllCategories(req: Request, res: Response) {
    try {
      const categories = await prisma.transactionCategory.findMany({
        orderBy: { name: "asc" },
      });
      res.json({ success: true, data: categories });
    } catch (error: any) {
      console.error("Get all categories error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // ==================== Asset CRUD ====================
  async getAssets(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where = search
        ? { name: { contains: search, mode: "insensitive" } }
        : {};

      const [data, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.asset.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createAsset(req: Request, res: Response) {
    try {
      const { name, value, purchaseDate, description, deductFromCash } =
        req.body;

      if (!name || value === undefined || value <= 0) {
        return res.status(400).json({
          success: false,
          message: "Name and positive value are required",
        });
      }

      // যদি ক্যাশ থেকে ডিডাক্ট করতে চায়
      if (deductFromCash) {
        // ১. ক্যাশ ব্যালেন্স চেক
        const currentCash = await calculateCashBalance();

        if (currentCash < value) {
          return res.status(400).json({
            success: false,
            message: `Insufficient cash balance. Current cash: ${currentCash.toFixed(2)}. Please add cash first.`,
          });
        }

        // ২. ক্যাটাগরি খুঁজুন / তৈরি করুন
        let assetCategory = await prisma.transactionCategory.findFirst({
          where: { name: "asset_purchase" },
        });
        if (!assetCategory) {
          assetCategory = await prisma.transactionCategory.create({
            data: {
              name: "asset_purchase",
              type: "out",
              description: "Fixed asset purchase (e.g., machinery, vehicle)",
            },
          });
        }

        // ৩. ট্রানজেকশন + অ্যাসেট তৈরি (Prisma Transaction)
        const result = await prisma.$transaction(async (tx) => {
          const asset = await tx.asset.create({
            data: {
              name,
              value,
              purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
              description,
            },
          });

          await tx.transaction.create({
            data: {
              categoryId: assetCategory.id,
              amount: value,
              note: `Asset purchased: ${name}`,
              date: purchaseDate ? new Date(purchaseDate) : new Date(),
              createdBy: (req as any).admin?.id,
            },
          });

          return asset;
        });

        res.status(201).json({
          success: true,
          data: result,
          message: "Asset created and cash deducted",
        });
      } else {
        // শুধু অ্যাসেট তৈরি (ট্রানজেকশন ছাড়া)
        const asset = await prisma.asset.create({
          data: {
            name,
            value,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
            description,
          },
        });
        res.status(201).json({
          success: true,
          data: asset,
          message: "Asset created without cash deduction",
        });
      }
    } catch (error: any) {
      console.error("Create asset error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateAsset(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, value, purchaseDate, description } = req.body;
      const asset = await prisma.asset.update({
        where: { id },
        data: {
          name,
          value,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          description,
        },
      });
      res.json({ success: true, data: asset });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteAsset(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await prisma.asset.delete({ where: { id } });
      res.json({ success: true, message: "Asset deleted" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ==================== Sell Asset ====================
  async sellAsset(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { sellPrice, date } = req.body;

      if (sellPrice === undefined || sellPrice < 0) {
        return res.status(400).json({
          success: false,
          message: "Valid sell price is required (must be >= 0)",
        });
      }

      const asset = await prisma.asset.findUnique({ where: { id } });
      if (!asset) {
        return res
          .status(404)
          .json({ success: false, message: "Asset not found" });
      }

      // সেল ক্যাটাগরি খুঁজুন / তৈরি করুন
      let saleCategory = await prisma.transactionCategory.findFirst({
        where: { name: "asset_sale" },
      });
      if (!saleCategory) {
        saleCategory = await prisma.transactionCategory.create({
          data: {
            name: "asset_sale",
            type: "in",
            description: "Income from selling fixed assets",
          },
        });
      }

      const bookValue = asset.value;
      const gainLoss = sellPrice - bookValue;

      await prisma.$transaction(async (tx) => {
        // ট্রানজেকশন (ক্যাশ ইন)
        await tx.transaction.create({
          data: {
            categoryId: saleCategory.id,
            amount: sellPrice,
            note: `Asset sold: ${asset.name} (Book value: ${bookValue.toFixed(2)}, Sold for: ${sellPrice.toFixed(2)})`,
            date: date ? new Date(date) : new Date(),
            createdBy: (req as any).admin?.id,
          },
        });
        // অ্যাসেট ডিলিট
        await tx.asset.delete({ where: { id } });
      });

      res.json({
        success: true,
        message: `Asset sold for ${sellPrice.toFixed(2)}. ${gainLoss >= 0 ? "Gain" : "Loss"}: ${Math.abs(gainLoss).toFixed(2)}`,
        data: { bookValue, sellPrice, gainLoss },
      });
    } catch (error: any) {
      console.error("Sell asset error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ==================== Balance Summary (Cash + Stock + Asset) ====================
  // মূলধন (Capital)        = Stock Value + Asset Value  (cash-এর সাথে সম্পর্কহীন)
  // ক্যাশ ব্যালেন্স (Cash)   = sales cash-in (orders থেকে) + non-sales transaction net
  // নিট লাভ (Net Profit)   = Sales net profit (Sells Report-এর মতো, delivery/packaging/
  //                           refund বাদ দিয়ে) − non-sales operating expense
  // মোট সম্পদ (Total Assets) = Cash + Stock + Asset (শুধু overview-র জন্য)
  //
  // ✅ এখন এই একই formula Sells Report, Annual Report আর এখানে — সব জায়গায়
  // financials.ts-এর একই helper থেকে আসছে, তাই কোনো mismatch থাকবে না।
  async getBalanceSummary(req: Request, res: Response) {
    try {
      // ===== 1. Cash Balance (sales cash-in + non-sales transaction net) =====
      const cashBalance = await calculateCashBalance();

      // ===== 2. Stock/Inventory Value =====
      const stockResult = await prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(currentQty * buyingOrMakingPrice), 0) as total FROM stocks
      `;
      const stockValue = stockResult[0]?.total || 0;

      // ===== 3. Fixed Asset Value =====
      const assetResult = await prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(value), 0) as total FROM assets
      `;
      const assetValue = assetResult[0]?.total || 0;

      // ===== 4. ✅ মূলধন (Capital) = Stock + Asset ONLY (cash বাদ) =====
      const totalCapital = stockValue + assetValue;

      // ===== 5. Sales financials (all-time) — Sells Report-এর মতো একই হিসাব =====
      const { totalSalesAmount, totalRefunds, salesNetProfit } =
        await calculateSalesFinancials();
      const totalRevenue = totalSalesAmount; // শুধু info card-এ দেখানোর জন্য

      // ===== 6. Total COGS (Cost of Goods Sold) — শুধু info card-এ দেখানোর জন্য =====
      const cogsResult = await prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(si.quantity * s.buyingOrMakingPrice), 0) as total
        FROM sold_items si
        JOIN stocks s ON si.stockId = s.id
        JOIN orders o ON si.orderId = o.id
        WHERE o.orderStatus IN ('confirmed', 'packed', 'delivered')
      `;
      const totalCOGS = cogsResult[0]?.total || 0;

      // ===== 7. Non-sales Operating Expenses (employee_bill, rent ইত্যাদি) =====
      const expenseResult = await prisma.$queryRaw<{ total: number }[]>`
        SELECT COALESCE(SUM(t.amount), 0) as total 
        FROM transactions t
        JOIN transaction_categories tc ON t.categoryId = tc.id
        WHERE tc.type = 'out' 
        AND tc.name IN ('employee_bill', 'office_expense', 'utility_bill', 'rent', 'salary')
      `;
      const totalExpense = expenseResult[0]?.total || 0;

      // ===== 8. ✅ Net Profit = Sales Net Profit (delivery/packaging/refund আগেই বাদ) − Operating Expenses =====
      const netProfit = salesNetProfit - totalExpense;

      // ===== 9. Total Assets = Cash + Stock + Asset (overview snapshot) =====
      const totalAssets = cashBalance + stockValue + assetValue;

      res.json({
        success: true,
        data: {
          cashBalance,
          stockValue,
          assetValue,
          totalCapital, // ✅ মূলধন = stock + asset
          totalAssets, // ✅ মোট সম্পদ = cash + stock + asset
          totalRevenue,
          totalRefunds, // 🆕 info-এর জন্য
          totalCOGS,
          totalExpense,
          netProfit,
        },
      });
    } catch (error: any) {
      console.error("Balance summary error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ==================== Owner Capital In/Out ====================
  async addCapital(req: Request, res: Response) {
    try {
      const { amount, note, date } = req.body;
      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Positive amount is required" });
      }

      let category = await prisma.transactionCategory.findFirst({
        where: { name: "owner_capital" },
      });
      if (!category) {
        category = await prisma.transactionCategory.create({
          data: {
            name: "owner_capital",
            type: "in",
            description: "Capital invested by owner",
          },
        });
      }

      const transaction = await prisma.transaction.create({
        data: {
          categoryId: category.id,
          amount,
          note: note || "Owner capital added",
          date: date ? new Date(date) : new Date(),
          createdBy: (req as any).admin?.id,
        },
        include: { category: true },
      });

      res.status(201).json({ success: true, data: transaction });
    } catch (error: any) {
      console.error("Add capital error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async withdrawCapital(req: Request, res: Response) {
    try {
      const { amount, note, date } = req.body;
      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Positive amount is required" });
      }

      // Check cash balance before withdrawal
      const currentCash = await calculateCashBalance();
      if (currentCash < amount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient cash balance. Current cash: ${currentCash.toFixed(2)}.`,
        });
      }

      let category = await prisma.transactionCategory.findFirst({
        where: { name: "owner_withdrawal" },
      });
      if (!category) {
        category = await prisma.transactionCategory.create({
          data: {
            name: "owner_withdrawal",
            type: "out",
            description: "Capital withdrawn by owner",
          },
        });
      }

      const transaction = await prisma.transaction.create({
        data: {
          categoryId: category.id,
          amount,
          note: note || "Owner capital withdrawn",
          date: date ? new Date(date) : new Date(),
          createdBy: (req as any).admin?.id,
        },
        include: { category: true },
      });

      res.status(201).json({ success: true, data: transaction });
    } catch (error: any) {
      console.error("Withdraw capital error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // ==================== Employee Bill CRUD ====================
  async getEmployeeBills(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where = search
        ? { name: { contains: search, mode: "insensitive" } }
        : {};

      const [data, total] = await Promise.all([
        prisma.employeeBill.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.employeeBill.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createEmployeeBill(req: Request, res: Response) {
    try {
      const { name, amount, date, description } = req.body;
      if (!name || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Name and positive amount required",
        });
      }

      // Check cash balance
      const currentCash = await calculateCashBalance();
      if (currentCash < amount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient cash balance. Current cash: ${currentCash.toFixed(2)}.`,
        });
      }

      // Get or create category "employee_bill"
      let category = await prisma.transactionCategory.findFirst({
        where: { name: "employee_bill" },
      });
      if (!category) {
        category = await prisma.transactionCategory.create({
          data: {
            name: "employee_bill",
            type: "out",
            description: "Employee salary/bill",
          },
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const bill = await tx.employeeBill.create({
          data: {
            name,
            amount,
            date: date ? new Date(date) : new Date(),
            description,
          },
        });

        await tx.transaction.create({
          data: {
            categoryId: category.id,
            amount,
            note: `Employee bill: ${name}`,
            date: date ? new Date(date) : new Date(),
            createdBy: (req as any).admin?.id,
          },
        });

        return bill;
      });

      res.status(201).json({
        success: true,
        data: result,
        message: "Employee bill created and cash deducted",
      });
    } catch (error: any) {
      console.error("Create employee bill error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateEmployeeBill(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, amount, date, description } = req.body;

      const existing = await prisma.employeeBill.findUnique({ where: { id } });
      if (!existing)
        return res.status(404).json({ success: false, message: "Not found" });

      const diff =
        (amount !== undefined ? amount : existing.amount) - existing.amount;

      // If amount changed, adjust cash
      if (diff !== 0) {
        const currentCash = await calculateCashBalance();
        if (diff > 0 && currentCash < diff) {
          return res.status(400).json({
            success: false,
            message: `Insufficient cash balance. Need: ${diff.toFixed(2)}, available: ${currentCash.toFixed(2)}`,
          });
        }

        // Create adjustment transaction
        let category = await prisma.transactionCategory.findFirst({
          where: { name: "employee_bill_adjustment" },
        });
        if (!category) {
          category = await prisma.transactionCategory.create({
            data: {
              name: "employee_bill_adjustment",
              type: diff > 0 ? "out" : "in",
              description: "Employee bill adjustment",
            },
          });
        }

        await prisma.transaction.create({
          data: {
            categoryId: category.id,
            amount: Math.abs(diff),
            note: `Employee bill "${existing.name}" amount adjusted from ${existing.amount} to ${amount}`,
            date: date ? new Date(date) : new Date(),
            createdBy: (req as any).admin?.id,
          },
        });
      }

      const updated = await prisma.employeeBill.update({
        where: { id },
        data: {
          name: name !== undefined ? name : existing.name,
          amount: amount !== undefined ? amount : existing.amount,
          date: date ? new Date(date) : existing.date,
          description:
            description !== undefined ? description : existing.description,
        },
      });

      res.json({
        success: true,
        data: updated,
        message: "Employee bill updated",
      });
    } catch (error: any) {
      console.error("Update employee bill error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteEmployeeBill(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const existing = await prisma.employeeBill.findUnique({ where: { id } });
      if (!existing)
        return res.status(404).json({ success: false, message: "Not found" });

      // Refund cash
      let category = await prisma.transactionCategory.findFirst({
        where: { name: "employee_bill_refund" },
      });
      if (!category) {
        category = await prisma.transactionCategory.create({
          data: {
            name: "employee_bill_refund",
            type: "in",
            description: "Employee bill refund (deletion)",
          },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            categoryId: category.id,
            amount: existing.amount,
            note: `Employee bill "${existing.name}" deleted - refund`,
            date: new Date(),
            createdBy: (req as any).admin?.id,
          },
        });
        await tx.employeeBill.delete({ where: { id } });
      });

      res.json({
        success: true,
        message: "Employee bill deleted and cash refunded",
      });
    } catch (error: any) {
      console.error("Delete employee bill error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ==================== Raw Material CRUD ====================
  async getRawMaterials(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const skip = (page - 1) * limit;

      const where = search
        ? { name: { contains: search, mode: "insensitive" } }
        : {};

      const [data, total] = await Promise.all([
        prisma.rawMaterial.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.rawMaterial.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createRawMaterial(req: Request, res: Response) {
    try {
      const { name, amount, date, description } = req.body;
      if (!name || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Name and positive amount required",
        });
      }

      // Check cash
      const currentCash = await calculateCashBalance();
      if (currentCash < amount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient cash balance. Current: ${currentCash.toFixed(2)}`,
        });
      }

      let category = await prisma.transactionCategory.findFirst({
        where: { name: "raw_materials" },
      });
      if (!category) {
        category = await prisma.transactionCategory.create({
          data: {
            name: "raw_materials",
            type: "out",
            description: "Raw materials purchase",
          },
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const material = await tx.rawMaterial.create({
          data: {
            name,
            amount,
            date: date ? new Date(date) : new Date(),
            description,
          },
        });

        await tx.transaction.create({
          data: {
            categoryId: category.id,
            amount,
            note: `Raw material: ${name}`,
            date: date ? new Date(date) : new Date(),
            createdBy: (req as any).admin?.id,
          },
        });

        return material;
      });

      res.status(201).json({
        success: true,
        data: result,
        message: "Raw material created and cash deducted",
      });
    } catch (error: any) {
      console.error("Create raw material error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateRawMaterial(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, amount, date, description } = req.body;

      const existing = await prisma.rawMaterial.findUnique({ where: { id } });
      if (!existing)
        return res.status(404).json({ success: false, message: "Not found" });

      const diff =
        (amount !== undefined ? amount : existing.amount) - existing.amount;

      if (diff !== 0) {
        const currentCash = await calculateCashBalance();
        if (diff > 0 && currentCash < diff) {
          return res.status(400).json({
            success: false,
            message: `Insufficient cash. Need: ${diff.toFixed(2)}`,
          });
        }

        let category = await prisma.transactionCategory.findFirst({
          where: { name: "raw_materials_adjustment" },
        });
        if (!category) {
          category = await prisma.transactionCategory.create({
            data: {
              name: "raw_materials_adjustment",
              type: diff > 0 ? "out" : "in",
              description: "Raw material adjustment",
            },
          });
        }

        await prisma.transaction.create({
          data: {
            categoryId: category.id,
            amount: Math.abs(diff),
            note: `Raw material "${existing.name}" adjusted from ${existing.amount} to ${amount}`,
            date: date ? new Date(date) : new Date(),
            createdBy: (req as any).admin?.id,
          },
        });
      }

      const updated = await prisma.rawMaterial.update({
        where: { id },
        data: {
          name: name !== undefined ? name : existing.name,
          amount: amount !== undefined ? amount : existing.amount,
          date: date ? new Date(date) : existing.date,
          description:
            description !== undefined ? description : existing.description,
        },
      });

      res.json({
        success: true,
        data: updated,
        message: "Raw material updated",
      });
    } catch (error: any) {
      console.error("Update raw material error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async deleteRawMaterial(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const existing = await prisma.rawMaterial.findUnique({ where: { id } });
      if (!existing)
        return res.status(404).json({ success: false, message: "Not found" });

      let category = await prisma.transactionCategory.findFirst({
        where: { name: "raw_materials_refund" },
      });
      if (!category) {
        category = await prisma.transactionCategory.create({
          data: {
            name: "raw_materials_refund",
            type: "in",
            description: "Raw material refund (deletion)",
          },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            categoryId: category.id,
            amount: existing.amount,
            note: `Raw material "${existing.name}" deleted - refund`,
            date: new Date(),
            createdBy: (req as any).admin?.id,
          },
        });
        await tx.rawMaterial.delete({ where: { id } });
      });

      res.json({
        success: true,
        message: "Raw material deleted and cash refunded",
      });
    } catch (error: any) {
      console.error("Delete raw material error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
