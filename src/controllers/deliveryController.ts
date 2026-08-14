// controllers/deliveryController.ts

import { Request, Response } from "express";

// ============================================================
// Pathao-র rate card (screenshot থেকে confirmed)
// ============================================================
// 🏠 Pickup location সবসময় Inside Dhaka — hardcoded, কারণ শপের একটাই
// warehouse আছে এবং সেটা Dhaka-র ভেতরে। তাই শুধু ISD→ISD এবং ISD→OSD
// row দুটোই ব্যবহার হচ্ছে (Suburbs pickup/delivery প্রযোজ্য না)।

// ⚠️ শুধু 2kg পর্যন্ত confirmed rate আছে (screenshot-এ এই পর্যন্তই ছিল)।
// 2kg-এর বেশি হলে OVERWEIGHT_PER_KG দিয়ে extrapolate করা হচ্ছে —
// এই rate টা confirm করা হয়নি, দরকার হলে Pathao-র higher-weight rate card
// থেকে নিশ্চিত হয়ে বসিয়ে দিন।
interface WeightTier {
  maxKg: number; // এই ওজন পর্যন্ত (inclusive) এই tier প্রযোজ্য
  label: string; // শুধু readability/debug এর জন্য
  insideDhaka: number;
  outsideDhaka: number;
}

const WEIGHT_TIERS: WeightTier[] = [
  { maxKg: 0.5, label: "0-500gm", insideDhaka: 60, outsideDhaka: 110 }, // confirmed
  { maxKg: 1, label: "500gm-1kg", insideDhaka: 70, outsideDhaka: 130 }, // confirmed
  { maxKg: 2, label: "1kg-2kg", insideDhaka: 90, outsideDhaka: 170 }, // confirmed
];

// 2kg-এর বেশি হলে প্রতি অতিরিক্ত কেজিতে যা যোগ হবে (⚠️ unconfirmed placeholder)
const OVERWEIGHT_PER_KG = { insideDhaka: 15, outsideDhaka: 25 }; // TODO: confirm

const findTier = (weightKg: number): WeightTier => {
  const tier = WEIGHT_TIERS.find((t) => weightKg <= t.maxKg);
  return tier ?? WEIGHT_TIERS[WEIGHT_TIERS.length - 1];
};

// ============================================================
// কাস্টম ডেলিভারি চার্জ ক্যালকুলেটর (Pathao-র bracket অনুসরণ করে)
// ============================================================
export const calculateDeliveryCharge = (req: Request, res: Response) => {
  try {
    const { location, weight, productPrice = 0, isCod = true } = req.body;

    if (!location || weight === undefined || weight === null) {
      return res.status(400).json({
        success: false,
        message: "location and weight are required",
      });
    }

    // 🔧 floating-point precision fix: 0.2 + 0.3 কখনো কখনো
    // 0.5000000000000001 হয়ে যায়, যেটা bracket boundary ভুলভাবে ক্রস করে।
    // দুই দশমিক ঘর পর্যন্ত round করে নেওয়া হলো।
    const parsedWeight = Math.round((parseFloat(weight) || 0) * 100) / 100;

    const isInsideDhaka = location === "inside_dhaka";
    const lastTier = WEIGHT_TIERS[WEIGHT_TIERS.length - 1];

    let baseCharge: number;
    let weightCharge = 0;

    if (parsedWeight <= lastTier.maxKg) {
      // সরাসরি bracket lookup — Pathao-র structure অনুযায়ী
      const tier = findTier(parsedWeight);
      baseCharge = isInsideDhaka ? tier.insideDhaka : tier.outsideDhaka;
    } else {
      // সর্বোচ্চ confirmed bracket (2kg) পার হয়ে গেলে, তার উপরে প্রতি কেজি অতিরিক্ত চার্জ (⚠️ unconfirmed rate)
      baseCharge = isInsideDhaka ? lastTier.insideDhaka : lastTier.outsideDhaka;
      const extraWeight = Math.ceil(parsedWeight - lastTier.maxKg);
      const perKg = isInsideDhaka
        ? OVERWEIGHT_PER_KG.insideDhaka
        : OVERWEIGHT_PER_KG.outsideDhaka;
      weightCharge = extraWeight * perKg;
    }

    // COD চার্জ (অপরিবর্তিত)
    let codCharge = 0;
    const parsedPrice = parseFloat(productPrice) || 0;
    if (isCod && parsedPrice > 0) {
      codCharge = parsedPrice * 0.01; // 1%
    }

    const totalCharge = baseCharge + weightCharge + codCharge;

    res.json({
      success: true,
      data: {
        baseCharge,
        weightCharge,
        codCharge: parseFloat(codCharge.toFixed(2)),
        totalCharge: parseFloat(totalCharge.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error("Delivery charge calculation error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to calculate delivery charge",
    });
  }
};
