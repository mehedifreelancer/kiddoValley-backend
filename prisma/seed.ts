import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🌱 Seeding started...");

  // Users
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
  const cashierPass = await bcrypt.hash("cashier123", 10);
  await prisma.user.upsert({
    where: { email: "cashier@example.com" },
    update: {},
    create: {
      username: "cashier",
      name: "Cashier User",
      email: "cashier@example.com",
      password: cashierPass,
      role: "cashier",
      isActive: true,
    },
  });
  console.log("✅ Users seeded");

  // Category
  const category = await prisma.category.upsert({
    where: { slug: "books" },
    update: {},
    create: { name: "Books", slug: "books" },
  });
  console.log("✅ Category seeded");

  // Product (use upsert to avoid duplicate slug)
  const product = await prisma.product.upsert({
    where: { slug: "mina-book" },
    update: {},
    create: {
      name: "মীনা বই",
      slug: "mina-book",
      categoryId: category.id,
      description: "<p>মীনা ও তার বন্ধুদের গল্প</p>",
      images: [{ imgUrl: "https://picsum.photos/id/20/400/300" }],
      isPublished: true,
    },
  });
  console.log("✅ Product seeded");

  // Variant (use upsert to avoid duplicate SKU)
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

  // Stock – check existence to avoid duplicate creation and movement
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

  // Attributes
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

  // Settings
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