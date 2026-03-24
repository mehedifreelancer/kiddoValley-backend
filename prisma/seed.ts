import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('🌱 Starting seeding...');

  // Create admin user with username
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kiddovalley.com' },
    update: {},
    create: {
      username: 'admin',
      name: 'Admin User',
      email: 'admin@kiddovalley.com',
      password: adminPassword,
      role: 'admin',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.username, admin.email);

  // Create cashier user with username
  const cashierPassword = await bcrypt.hash('cashier123', 10);
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@kiddovalley.com' },
    update: {},
    create: {
      username: 'cashier',
      name: 'Cashier User',
      email: 'cashier@kiddovalley.com',
      password: cashierPassword,
      role: 'cashier',
      isActive: true,
    },
  });
  console.log('✅ Cashier user created:', cashier.username, cashier.email);

  // Create categories
  const categories = [
    { name: 'Baby Products', slug: 'baby-products' },
    { name: 'Dairy', slug: 'dairy' },
    { name: 'Beverages', slug: 'beverages' },
    { name: 'Snacks', slug: 'snacks' },
    { name: 'Household', slug: 'household' },
    { name: 'Personal Care', slug: 'personal-care' },
    { name: 'Fruits', slug: 'fruits' },
    { name: 'Vegetables', slug: 'vegetables' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Categories created');

  // Create sample products with images
  const babyCategory = await prisma.category.findUnique({
    where: { slug: 'baby-products' }
  });
  const dairyCategory = await prisma.category.findUnique({
    where: { slug: 'dairy' }
  });
  const beveragesCategory = await prisma.category.findUnique({
    where: { slug: 'beverages' }
  });
  const snacksCategory = await prisma.category.findUnique({
    where: { slug: 'snacks' }
  });
  const householdCategory = await prisma.category.findUnique({
    where: { slug: 'household' }
  });
  const personalCareCategory = await prisma.category.findUnique({
    where: { slug: 'personal-care' }
  });

  // Baby Products
  if (babyCategory) {
    await prisma.product.upsert({
      where: { barcode: '8901234567890' },
      update: {},
      create: {
        barcode: '8901234567890',
        name: 'Baby Diapers Large',
        slug: 'baby-diapers-large',
        categoryId: babyCategory.id,
        buyingPrice: 450,
        sellingPrice: 550,
        isForceOrder: true,
        forceOrderPriority: 1,
        stockQuantity: 100,
        images: [
          { imgUrl: 'https://picsum.photos/id/20/400/300' },
          { imgUrl: 'https://picsum.photos/id/21/400/300' },
          { imgUrl: 'https://picsum.photos/id/22/400/300' }
        ]
      },
    });
    console.log('✅ Baby Diapers created');

    await prisma.product.upsert({
      where: { barcode: '8901234567891' },
      update: {},
      create: {
        barcode: '8901234567891',
        name: 'Baby Lotion Gentle Care',
        slug: 'baby-lotion-gentle-care',
        categoryId: babyCategory.id,
        buyingPrice: 180,
        sellingPrice: 250,
        isForceOrder: false,
        stockQuantity: 75,
        images: [
          { imgUrl: 'https://picsum.photos/id/23/400/300' },
          { imgUrl: 'https://picsum.photos/id/24/400/300' }
        ]
      },
    });
    console.log('✅ Baby Lotion created');

    await prisma.product.upsert({
      where: { barcode: '8901234567892' },
      update: {},
      create: {
        barcode: '8901234567892',
        name: 'Baby Shampoo Mild',
        slug: 'baby-shampoo-mild',
        categoryId: babyCategory.id,
        buyingPrice: 220,
        sellingPrice: 320,
        isForceOrder: true,
        forceOrderPriority: 2,
        stockQuantity: 60,
        images: [
          { imgUrl: 'https://picsum.photos/id/25/400/300' },
          { imgUrl: 'https://picsum.photos/id/26/400/300' },
          { imgUrl: 'https://picsum.photos/id/27/400/300' }
        ]
      },
    });
    console.log('✅ Baby Shampoo created');
  }

  // Dairy Products
  if (dairyCategory) {
    await prisma.product.upsert({
      where: { barcode: '8901234567893' },
      update: {},
      create: {
        barcode: '8901234567893',
        name: 'Fresh Milk 1L',
        slug: 'fresh-milk-1l',
        categoryId: dairyCategory.id,
        buyingPrice: 55,
        sellingPrice: 75,
        isForceOrder: false,
        stockQuantity: 200,
        images: [
          { imgUrl: 'https://picsum.photos/id/28/400/300' },
          { imgUrl: 'https://picsum.photos/id/29/400/300' }
        ]
      },
    });
    console.log('✅ Fresh Milk created');

    await prisma.product.upsert({
      where: { barcode: '8901234567894' },
      update: {},
      create: {
        barcode: '8901234567894',
        name: 'Butter 100g',
        slug: 'butter-100g',
        categoryId: dairyCategory.id,
        buyingPrice: 45,
        sellingPrice: 65,
        isForceOrder: false,
        stockQuantity: 150,
        images: [
          { imgUrl: 'https://picsum.photos/id/30/400/300' },
          { imgUrl: 'https://picsum.photos/id/31/400/300' }
        ]
      },
    });
    console.log('✅ Butter created');

    await prisma.product.upsert({
      where: { barcode: '8901234567895' },
      update: {},
      create: {
        barcode: '8901234567895',
        name: 'Yogurt Probiotic',
        slug: 'yogurt-probiotic',
        categoryId: dairyCategory.id,
        buyingPrice: 35,
        sellingPrice: 50,
        isForceOrder: false,
        stockQuantity: 120,
        images: [
          { imgUrl: 'https://picsum.photos/id/32/400/300' },
          { imgUrl: 'https://picsum.photos/id/33/400/300' }
        ]
      },
    });
    console.log('✅ Yogurt created');
  }

  // Beverages
  if (beveragesCategory) {
    await prisma.product.upsert({
      where: { barcode: '8901234567896' },
      update: {},
      create: {
        barcode: '8901234567896',
        name: 'Coca Cola 500ml',
        slug: 'coca-cola-500ml',
        categoryId: beveragesCategory.id,
        buyingPrice: 35,
        sellingPrice: 50,
        isForceOrder: true,
        forceOrderPriority: 1,
        stockQuantity: 300,
        images: [
          { imgUrl: 'https://picsum.photos/id/34/400/300' },
          { imgUrl: 'https://picsum.photos/id/35/400/300' }
        ]
      },
    });
    console.log('✅ Coca Cola created');

    await prisma.product.upsert({
      where: { barcode: '8901234567897' },
      update: {},
      create: {
        barcode: '8901234567897',
        name: 'Orange Juice 1L',
        slug: 'orange-juice-1l',
        categoryId: beveragesCategory.id,
        buyingPrice: 80,
        sellingPrice: 120,
        isForceOrder: false,
        stockQuantity: 90,
        images: [
          { imgUrl: 'https://picsum.photos/id/36/400/300' },
          { imgUrl: 'https://picsum.photos/id/37/400/300' }
        ]
      },
    });
    console.log('✅ Orange Juice created');
  }

  // Snacks
  if (snacksCategory) {
    await prisma.product.upsert({
      where: { barcode: '8901234567898' },
      update: {},
      create: {
        barcode: '8901234567898',
        name: 'Potato Chips 50g',
        slug: 'potato-chips-50g',
        categoryId: snacksCategory.id,
        buyingPrice: 20,
        sellingPrice: 30,
        isForceOrder: false,
        stockQuantity: 500,
        images: [
          { imgUrl: 'https://picsum.photos/id/38/400/300' },
          { imgUrl: 'https://picsum.photos/id/39/400/300' }
        ]
      },
    });
    console.log('✅ Potato Chips created');

    await prisma.product.upsert({
      where: { barcode: '8901234567899' },
      update: {},
      create: {
        barcode: '8901234567899',
        name: 'Chocolate Bar',
        slug: 'chocolate-bar',
        categoryId: snacksCategory.id,
        buyingPrice: 40,
        sellingPrice: 60,
        isForceOrder: true,
        forceOrderPriority: 2,
        stockQuantity: 250,
        images: [
          { imgUrl: 'https://picsum.photos/id/40/400/300' },
          { imgUrl: 'https://picsum.photos/id/41/400/300' }
        ]
      },
    });
    console.log('✅ Chocolate Bar created');
  }

  // Household
  if (householdCategory) {
    await prisma.product.upsert({
      where: { barcode: '8901234567800' },
      update: {},
      create: {
        barcode: '8901234567800',
        name: 'Detergent Powder 1kg',
        slug: 'detergent-powder-1kg',
        categoryId: householdCategory.id,
        buyingPrice: 120,
        sellingPrice: 180,
        isForceOrder: false,
        stockQuantity: 80,
        images: [
          { imgUrl: 'https://picsum.photos/id/42/400/300' },
          { imgUrl: 'https://picsum.photos/id/43/400/300' }
        ]
      },
    });
    console.log('✅ Detergent Powder created');
  }

  // Personal Care
  if (personalCareCategory) {
    await prisma.product.upsert({
      where: { barcode: '8901234567801' },
      update: {},
      create: {
        barcode: '8901234567801',
        name: 'Shampoo Anti-Dandruff',
        slug: 'shampoo-anti-dandruff',
        categoryId: personalCareCategory.id,
        buyingPrice: 180,
        sellingPrice: 280,
        isForceOrder: true,
        forceOrderPriority: 3,
        stockQuantity: 120,
        images: [
          { imgUrl: 'https://picsum.photos/id/44/400/300' },
          { imgUrl: 'https://picsum.photos/id/45/400/300' }
        ]
      },
    });
    console.log('✅ Shampoo created');

    await prisma.product.upsert({
      where: { barcode: '8901234567802' },
      update: {},
      create: {
        barcode: '8901234567802',
        name: 'Toothpaste 100g',
        slug: 'toothpaste-100g',
        categoryId: personalCareCategory.id,
        buyingPrice: 45,
        sellingPrice: 70,
        isForceOrder: false,
        stockQuantity: 200,
        images: [
          { imgUrl: 'https://picsum.photos/id/46/400/300' },
          { imgUrl: 'https://picsum.photos/id/47/400/300' }
        ]
      },
    });
    console.log('✅ Toothpaste created');
  }

  console.log('🌱 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });