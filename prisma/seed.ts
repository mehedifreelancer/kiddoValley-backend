import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🌱 Starting seeding...");

  // Create admin user with username
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@kiddovalley.com" },
    update: {},
    create: {
      username: "admin",
      name: "Admin User",
      email: "admin@kiddovalley.com",
      password: adminPassword,
      role: "admin",
      isActive: true,
    },
  });
  console.log("✅ Admin user created:", admin.username, admin.email);

  // Create cashier user with username
  const cashierPassword = await bcrypt.hash("cashier123", 10);
  const cashier = await prisma.user.upsert({
    where: { email: "cashier@kiddovalley.com" },
    update: {},
    create: {
      username: "cashier",
      name: "Cashier User",
      email: "cashier@kiddovalley.com",
      password: cashierPassword,
      role: "cashier",
      isActive: true,
    },
  });
  console.log("✅ Cashier user created:", cashier.username, cashier.email);

  // Create categories
  const categories = [
    { name: "Baby Products", slug: "baby-products" },
    { name: "Dairy", slug: "dairy" },
    { name: "Beverages", slug: "beverages" },
    { name: "Snacks", slug: "snacks" },
    { name: "Household", slug: "household" },
    { name: "Personal Care", slug: "personal-care" },
    { name: "Fruits", slug: "fruits" },
    { name: "Vegetables", slug: "vegetables" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log("✅ Categories created");

  // Get category references
  const babyCategory = await prisma.category.findUnique({
    where: { slug: "baby-products" },
  });
  const dairyCategory = await prisma.category.findUnique({
    where: { slug: "dairy" },
  });
  const beveragesCategory = await prisma.category.findUnique({
    where: { slug: "beverages" },
  });
  const snacksCategory = await prisma.category.findUnique({
    where: { slug: "snacks" },
  });
  const householdCategory = await prisma.category.findUnique({
    where: { slug: "household" },
  });
  const personalCareCategory = await prisma.category.findUnique({
    where: { slug: "personal-care" },
  });
  const fruitsCategory = await prisma.category.findUnique({
    where: { slug: "fruits" },
  });
  const vegetablesCategory = await prisma.category.findUnique({
    where: { slug: "vegetables" },
  });

  // Helper function to create product and barcode together
  async function createProductWithBarcode(
    productData: any,
    barcodeTitle: string,
  ) {
    const product = await prisma.product.upsert({
      where: { barcode: productData.barcode },
      update: {},
      create: productData,
    });

    // Create barcode record
    await prisma.barcode.upsert({
      where: { barcode: product.barcode },
      update: {},
      create: {
        title: barcodeTitle,
        barcode: product.barcode,
      },
    });

    return product;
  }

  // Baby Products
  if (babyCategory) {
    await createProductWithBarcode(
      {
        barcode: "8901234567890",
        name: "Baby Diapers Large",
        slug: "baby-diapers-large",
        categoryId: babyCategory.id,
        buyingPrice: 450,
        sellingPrice: 550,
        isForceOrder: true,
        forceOrderPriority: 1,
        description:
          "<p>High-quality baby diapers for large size. Soft and comfortable.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/20/400/300" },
          { imgUrl: "https://picsum.photos/id/21/400/300" },
          { imgUrl: "https://picsum.photos/id/22/400/300" },
        ],
      },
      "Baby Diapers Large",
    );
    console.log("✅ Baby Diapers created");

    await createProductWithBarcode(
      {
        barcode: "8901234567891",
        name: "Baby Lotion Gentle Care",
        slug: "baby-lotion-gentle-care",
        categoryId: babyCategory.id,
        buyingPrice: 180,
        sellingPrice: 250,
        isForceOrder: false,
        forceOrderPriority: 0,
        description:
          "<p>Gentle care baby lotion for soft skin. Hypoallergenic.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/23/400/300" },
          { imgUrl: "https://picsum.photos/id/24/400/300" },
        ],
      },
      "Baby Lotion Gentle Care",
    );
    console.log("✅ Baby Lotion created");

    await createProductWithBarcode(
      {
        barcode: "8901234567892",
        name: "Baby Shampoo Mild",
        slug: "baby-shampoo-mild",
        categoryId: babyCategory.id,
        buyingPrice: 220,
        sellingPrice: 320,
        isForceOrder: true,
        forceOrderPriority: 2,
        description:
          "<p>Mild baby shampoo with natural ingredients. Tear-free formula.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/25/400/300" },
          { imgUrl: "https://picsum.photos/id/26/400/300" },
          { imgUrl: "https://picsum.photos/id/27/400/300" },
        ],
      },
      "Baby Shampoo Mild",
    );
    console.log("✅ Baby Shampoo created");
  }

  // Dairy Products
  if (dairyCategory) {
    await createProductWithBarcode(
      {
        barcode: "8901234567893",
        name: "Fresh Milk 1L",
        slug: "fresh-milk-1l",
        categoryId: dairyCategory.id,
        buyingPrice: 55,
        sellingPrice: 75,
        isForceOrder: false,
        forceOrderPriority: 0,
        description:
          "<p>Fresh pasteurized milk. Rich in calcium and protein.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/28/400/300" },
          { imgUrl: "https://picsum.photos/id/29/400/300" },
        ],
      },
      "Fresh Milk 1L",
    );
    console.log("✅ Fresh Milk created");

    await createProductWithBarcode(
      {
        barcode: "8901234567894",
        name: "Butter 100g",
        slug: "butter-100g",
        categoryId: dairyCategory.id,
        buyingPrice: 45,
        sellingPrice: 65,
        isForceOrder: false,
        forceOrderPriority: 0,
        description:
          "<p>Creamy butter made from fresh milk. Perfect for toast.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/30/400/300" },
          { imgUrl: "https://picsum.photos/id/31/400/300" },
        ],
      },
      "Butter 100g",
    );
    console.log("✅ Butter created");

    await createProductWithBarcode(
      {
        barcode: "8901234567895",
        name: "Yogurt Probiotic",
        slug: "yogurt-probiotic",
        categoryId: dairyCategory.id,
        buyingPrice: 35,
        sellingPrice: 50,
        isForceOrder: false,
        forceOrderPriority: 0,
        description:
          "<p>Probiotic yogurt for gut health. Contains live cultures.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/32/400/300" },
          { imgUrl: "https://picsum.photos/id/33/400/300" },
        ],
      },
      "Yogurt Probiotic",
    );
    console.log("✅ Yogurt created");
  }

  // Beverages
  if (beveragesCategory) {
    await createProductWithBarcode(
      {
        barcode: "8901234567896",
        name: "Coca Cola 500ml",
        slug: "coca-cola-500ml",
        categoryId: beveragesCategory.id,
        buyingPrice: 35,
        sellingPrice: 50,
        isForceOrder: true,
        forceOrderPriority: 1,
        description: "<p>Refreshing Coca Cola. Best served chilled.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/34/400/300" },
          { imgUrl: "https://picsum.photos/id/35/400/300" },
        ],
      },
      "Coca Cola 500ml",
    );
    console.log("✅ Coca Cola created");

    await createProductWithBarcode(
      {
        barcode: "8901234567897",
        name: "Orange Juice 1L",
        slug: "orange-juice-1l",
        categoryId: beveragesCategory.id,
        buyingPrice: 80,
        sellingPrice: 120,
        isForceOrder: false,
        forceOrderPriority: 0,
        description: "<p>Fresh orange juice. No added sugar.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/36/400/300" },
          { imgUrl: "https://picsum.photos/id/37/400/300" },
        ],
      },
      "Orange Juice 1L",
    );
    console.log("✅ Orange Juice created");
  }

  // Snacks
  if (snacksCategory) {
    await createProductWithBarcode(
      {
        barcode: "8901234567898",
        name: "Potato Chips 50g",
        slug: "potato-chips-50g",
        categoryId: snacksCategory.id,
        buyingPrice: 20,
        sellingPrice: 30,
        isForceOrder: false,
        forceOrderPriority: 0,
        description: "<p>Crunchy potato chips. Classic salted flavor.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/38/400/300" },
          { imgUrl: "https://picsum.photos/id/39/400/300" },
        ],
      },
      "Potato Chips 50g",
    );
    console.log("✅ Potato Chips created");

    await createProductWithBarcode(
      {
        barcode: "8901234567899",
        name: "Chocolate Bar",
        slug: "chocolate-bar",
        categoryId: snacksCategory.id,
        buyingPrice: 40,
        sellingPrice: 60,
        isForceOrder: true,
        forceOrderPriority: 2,
        description: "<p>Delicious chocolate bar. Made with premium cocoa.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/40/400/300" },
          { imgUrl: "https://picsum.photos/id/41/400/300" },
        ],
      },
      "Chocolate Bar",
    );
    console.log("✅ Chocolate Bar created");
  }

  // Household
  if (householdCategory) {
    await createProductWithBarcode(
      {
        barcode: "8901234567800",
        name: "Detergent Powder 1kg",
        slug: "detergent-powder-1kg",
        categoryId: householdCategory.id,
        buyingPrice: 120,
        sellingPrice: 180,
        isForceOrder: false,
        forceOrderPriority: 0,
        description: "<p>Powerful detergent powder. Removes tough stains.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/42/400/300" },
          { imgUrl: "https://picsum.photos/id/43/400/300" },
        ],
      },
      "Detergent Powder 1kg",
    );
    console.log("✅ Detergent Powder created");
  }

  // Personal Care
  if (personalCareCategory) {
    await createProductWithBarcode(
      {
        barcode: "8901234567801",
        name: "Shampoo Anti-Dandruff",
        slug: "shampoo-anti-dandruff",
        categoryId: personalCareCategory.id,
        buyingPrice: 180,
        sellingPrice: 280,
        isForceOrder: true,
        forceOrderPriority: 3,
        description:
          "<p>Anti-dandruff shampoo. Removes dandruff effectively.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/44/400/300" },
          { imgUrl: "https://picsum.photos/id/45/400/300" },
        ],
      },
      "Shampoo Anti-Dandruff",
    );
    console.log("✅ Shampoo created");

    await createProductWithBarcode(
      {
        barcode: "8901234567802",
        name: "Toothpaste 100g",
        slug: "toothpaste-100g",
        categoryId: personalCareCategory.id,
        buyingPrice: 45,
        sellingPrice: 70,
        isForceOrder: false,
        forceOrderPriority: 0,
        description: "<p>Cavity protection toothpaste. Fresh mint flavor.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/46/400/300" },
          { imgUrl: "https://picsum.photos/id/47/400/300" },
        ],
      },
      "Toothpaste 100g",
    );
    console.log("✅ Toothpaste created");
  }

  // Fruits
  if (fruitsCategory) {
    await createProductWithBarcode(
      {
        barcode: "8901234567803",
        name: "Fresh Apple",
        slug: "fresh-apple",
        categoryId: fruitsCategory.id,
        buyingPrice: 80,
        sellingPrice: 120,
        isForceOrder: false,
        forceOrderPriority: 0,
        description: "<p>Fresh red apples. Sweet and crispy.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/48/400/300" },
          { imgUrl: "https://picsum.photos/id/49/400/300" },
        ],
      },
      "Fresh Apple",
    );
    console.log("✅ Apple created");
  }

  // Vegetables
  if (vegetablesCategory) {
    await createProductWithBarcode(
      {
        barcode: "8901234567804",
        name: "Fresh Tomato",
        slug: "fresh-tomato",
        categoryId: vegetablesCategory.id,
        buyingPrice: 40,
        sellingPrice: 60,
        isForceOrder: false,
        forceOrderPriority: 0,
        description: "<p>Fresh ripe tomatoes. Perfect for salads.</p>",
        images: [
          { imgUrl: "https://picsum.photos/id/50/400/300" },
          { imgUrl: "https://picsum.photos/id/51/400/300" },
        ],
      },
      "Fresh Tomato",
    );
    console.log("✅ Tomato created");
  }

  // Suppliers - Fixed version
  const suppliers = [
    {
      name: "BabyCare Ltd",
      contactPerson: "Rahul Sharma",
      phone: "9876543210",
      email: "rahul@babycare.com",
      address: "Mumbai",
      gstNumber: "27AAACA1234A1Z5",
    },
    {
      name: "Dairy Fresh",
      contactPerson: "Amit Patel",
      phone: "9876543211",
      email: "amit@dairyfresh.com",
      address: "Delhi",
      gstNumber: "07AAACA5678B2Z6",
    },
    {
      name: "Beverage Co",
      contactPerson: "Suresh Kumar",
      phone: "9876543212",
      email: "suresh@beverage.com",
      address: "Bangalore",
      gstNumber: "29AAACA9012C3Z7",
    },
  ];

  for (const supplier of suppliers) {
    // Check if supplier exists by email
    const existingSupplier = await prisma.supplier.findFirst({
      where: { email: supplier.email },
    });

    if (existingSupplier) {
      await prisma.supplier.update({
        where: { id: existingSupplier.id },
        data: supplier,
      });
    } else {
      await prisma.supplier.create({
        data: supplier,
      });
    }
  }
  console.log("✅ Suppliers created");

  // Settings
  const settings = [
    { key: "store_name", value: "Kiddo Valley Supermarket", type: "string" },
    { key: "store_phone", value: "+8801234567890", type: "string" },
    { key: "store_email", value: "info@kiddovalley.com", type: "string" },
    { key: "store_address", value: "123 Main Street, City", type: "string" },
    { key: "tax_rate", value: "5", type: "number" },
    { key: "currency", value: "BDT", type: "string" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log("✅ Settings created");

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
