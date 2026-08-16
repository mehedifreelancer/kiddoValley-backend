import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🌱 Seeding started...");

  // ----- Users -----
  const superPass = await bcrypt.hash("Super@123", 10);
  await prisma.user.upsert({
    where: { email: "super@admin.com" },
    update: {},
    create: {
      username: "superadmin",
      name: "Super Admin",
      email: "super@admin.com",
      password: superPass,
      role: "super_admin",
      isActive: true,
    },
  });

  const adminPass = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      username: "admin",
      name: "Admin User",
      email: "admin@example.com",
      password: adminPass,
      role: "admin",
      isActive: true,
    },
  });

  const daPass = await bcrypt.hash("da123", 10);
  await prisma.user.upsert({
    where: { email: "data@accountant.com" },
    update: {},
    create: {
      username: "data_accountant",
      name: "Data Accountant",
      email: "data@accountant.com",
      password: daPass,
      role: "data_accountant",
      isActive: true,
    },
  });

  const modPass = await bcrypt.hash("mod123", 10);
  await prisma.user.upsert({
    where: { email: "moderator@example.com" },
    update: {},
    create: {
      username: "moderator",
      name: "Moderator User",
      email: "moderator@example.com",
      password: modPass,
      role: "moderator",
      isActive: true,
    },
  });
  console.log("✅ Users seeded");

  // ----- Category -----
  const category = await prisma.category.upsert({
    where: { slug: "books" },
    update: {},
    create: { name: "Books", slug: "books" },
  });
  console.log("✅ Category seeded");

  // ----- Product -----
  const product = await prisma.product.upsert({
    where: { slug: "mina-book" },
    update: {
      thumbnail: "https://picsum.photos/id/20/400/300",
    },
    create: {
      name: "মীনা বই",
      slug: "mina-book",
      categoryId: category.id,
      description: "<p>মীনা ও তার বন্ধুদের গল্প</p>",
      thumbnail: "https://picsum.photos/id/20/400/300",
      isPublished: true,
    },
  });
  console.log("✅ Product seeded");

  // ----- Variant -----
  const variant = await prisma.variant.upsert({
    where: { sku: "kdv-mina-book" },
    update: {},
    create: {
      sku: "kdv-mina-book",
      barcode: "8901234567890",
      productId: product.id,
      attributes: {},
      isImported: false,
    },
  });
  console.log("✅ Variant seeded");

  // ----- Stock -----
  const existingStock = await prisma.stock.findFirst({
    where: { variantId: variant.id, batchNo: "1" },
  });
  if (!existingStock) {
    const stock = await prisma.stock.create({
      data: {
        variantId: variant.id,
        batchNo: "1",
        buyingOrMakingPrice: 150,
        sellingPrice: 200,
        discountPercent: 0,
        currentQty: 100,
      },
    });
    console.log("✅ Stock seeded");

    await prisma.stockMovement.create({
      data: {
        stockId: stock.id,
        productId: product.id,
        type: "PURCHASE",
        quantity: 100,
        reason: "Initial stock",
      },
    });
    console.log("✅ StockMovement seeded");
  } else {
    console.log("⚠️ Stock already exists, skipping");
  }

  // ----- Attributes -----
  await prisma.productAttribute.upsert({
    where: { name: "Color" },
    update: {},
    create: { name: "Color", values: ["Red", "Green", "Blue"] },
  });
  await prisma.productAttribute.upsert({
    where: { name: "Size" },
    update: {},
    create: { name: "Size", values: ["S", "M", "L", "XL"] },
  });
  await prisma.productAttribute.upsert({
    where: { name: "Language" },
    update: {},
    create: { name: "Language", values: ["Bangla", "English"] },
  });
  console.log("✅ Attributes seeded");

  // ----- Settings -----
  await prisma.setting.upsert({
    where: { key: "store_name" },
    update: {},
    create: {
      key: "store_name",
      value: "Kiddo Valley Supermarket",
      type: "string",
    },
  });
  await prisma.setting.upsert({
    where: { key: "tax_rate" },
    update: {},
    create: { key: "tax_rate", value: "5", type: "number" },
  });
  console.log("✅ Settings seeded");

  // ----- 8. Delivery Settings (default) -----
  await prisma.deliverySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      weightTiers: [
        { maxKg: 0.5, insideDhaka: 60, suburbs: 80, outsideDhaka: 110 },
        { maxKg: 1, insideDhaka: 70, suburbs: 100, outsideDhaka: 130 },
        { maxKg: 2, insideDhaka: 90, suburbs: 130, outsideDhaka: 170 },
      ],
      overweightInsideDhaka: 15,
      overweightSuburbs: 20,
      overweightOutsideDhaka: 25,
      codPercentage: 1,
      deliveryDiscountPercent: 0,
    },
  });
  console.log("✅ Delivery Settings seeded");

  // ----- 9. Packaging Settings (default) -----
  await prisma.packagingSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      averagePackagingCost: 0,
    },
  });
  console.log("✅ Packaging Settings seeded");

  // ----- 10. Transaction Categories -----
  const txCategories = [
    {
      name: "asset_purchase",
      type: "out",
      description: "Fixed asset purchase",
    },
    { name: "employee_bill", type: "out", description: "Employee salary/bill" },
    {
      name: "raw_materials",
      type: "out",
      description: "Raw materials purchase",
    },
    { name: "office_expense", type: "out", description: "Office expense" },
    { name: "utility_bill", type: "out", description: "Utility bills" },
    { name: "rent", type: "out", description: "Rent payment" },
    { name: "salary", type: "out", description: "Salary payment" },
    {
      name: "asset_sale",
      type: "in",
      description: "Income from selling assets",
    },
    { name: "capital_in", type: "in", description: "Owner capital injection" },
    { name: "owner_withdraw", type: "out", description: "Owner withdrawal" },
    { name: "take_loan", type: "in", description: "Loan taken" },
    { name: "return_loan", type: "out", description: "Loan repayment" },
  ];
  for (const cat of txCategories) {
    await prisma.transactionCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log("✅ Transaction Categories seeded");

  console.log("🌱 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
