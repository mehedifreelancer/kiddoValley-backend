// services/deliverySettings.service.ts
import { prisma } from "../lib/prisma";
import { DeliverySettings, WeightTier } from "../types/deliverySettings.types";

// ============================================================
// DEFAULT_DELIVERY_SETTINGS — Pathao-র rate card এর সাথে মেলানো,
// suburbs সহ 3-way (insideDhaka / suburbs / outsideDhaka)
// ============================================================
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  weightTiers: [
    { maxKg: 0.5, insideDhaka: 60, suburbs: 80, outsideDhaka: 110 },
    { maxKg: 1, insideDhaka: 70, suburbs: 100, outsideDhaka: 130 },
    { maxKg: 2, insideDhaka: 90, suburbs: 130, outsideDhaka: 170 },
  ],
  overweightPerKg: {
    insideDhaka: 15,
    suburbs: 20,
    outsideDhaka: 25,
  },
  codPercentage: 1,
  deliveryDiscountPercent: 0,
};

// Simple in-memory cache so we don't hit DB on every calculateDeliveryCharge call
let cachedSettings: DeliverySettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// row.overweightSuburbs Prisma model-এ থাকা লাগবে (migration + generate করা থাকলে ঠিক থাকবে)
const mapRowToSettings = (row: {
  weightTiers: unknown;
  overweightInsideDhaka: number;
  overweightSuburbs: number;
  overweightOutsideDhaka: number;
  codPercentage: number;
  deliveryDiscountPercent: number;
}): DeliverySettings => ({
  weightTiers: (row.weightTiers as WeightTier[]) ?? [],
  overweightPerKg: {
    insideDhaka: row.overweightInsideDhaka,
    suburbs: row.overweightSuburbs,
    outsideDhaka: row.overweightOutsideDhaka,
  },
  codPercentage: row.codPercentage,
  deliveryDiscountPercent: row.deliveryDiscountPercent,
});

export const getDeliverySettings = async (): Promise<DeliverySettings> => {
  const row = await prisma.deliverySettings.findUnique({ where: { id: 1 } });
  if (!row) {
    return DEFAULT_DELIVERY_SETTINGS;
  }
  return mapRowToSettings(row);
};

export const getDeliverySettingsCached =
  async (): Promise<DeliverySettings> => {
    const now = Date.now();
    if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedSettings;
    }
    const settings = await getDeliverySettings();
    cachedSettings = settings;
    cacheTimestamp = now;
    return settings;
  };

export const updateDeliverySettings = async (
  payload: DeliverySettings,
): Promise<DeliverySettings> => {
  const row = await prisma.deliverySettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      weightTiers: payload.weightTiers as any,
      overweightInsideDhaka: payload.overweightPerKg.insideDhaka,
      overweightSuburbs: payload.overweightPerKg.suburbs,
      overweightOutsideDhaka: payload.overweightPerKg.outsideDhaka,
      codPercentage: payload.codPercentage,
      deliveryDiscountPercent: payload.deliveryDiscountPercent,
    },
    update: {
      weightTiers: payload.weightTiers as any,
      overweightInsideDhaka: payload.overweightPerKg.insideDhaka,
      overweightSuburbs: payload.overweightPerKg.suburbs,
      overweightOutsideDhaka: payload.overweightPerKg.outsideDhaka,
      codPercentage: payload.codPercentage,
      deliveryDiscountPercent: payload.deliveryDiscountPercent,
    },
  });

  // Invalidate cache so the next calculateDeliveryCharge call picks up fresh values
  cachedSettings = null;

  return mapRowToSettings(row);
};

// ============================================================
// 🆕 validateDeliverySettingsPayload — webSettingsController.ts এর
// updateDeliverySettings handler এ req.body validate করতে ব্যবহৃত হয়।
// Returns: error message string থাকলে invalid, null থাকলে valid.
// (controller-এ `if (validationError)` দিয়ে চেক হয়, তাই truthy string
// মানে ব্লক করবে, null/falsy মানে পাস করবে।)
// ============================================================
export const validateDeliverySettingsPayload = (
  payload: any,
): string | null => {
  if (!payload || typeof payload !== "object") {
    return "Invalid payload";
  }

  const {
    weightTiers,
    overweightPerKg,
    codPercentage,
    deliveryDiscountPercent,
  } = payload;

  // ---- weightTiers ----
  if (!Array.isArray(weightTiers) || weightTiers.length === 0) {
    return "At least one weight tier is required";
  }

  const sorted = [...weightTiers].sort(
    (a: WeightTier, b: WeightTier) => a.maxKg - b.maxKg,
  );

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];

    if (
      typeof tier.maxKg !== "number" ||
      typeof tier.insideDhaka !== "number" ||
      typeof tier.suburbs !== "number" ||
      typeof tier.outsideDhaka !== "number"
    ) {
      return `Tier ${i + 1} has invalid or missing fields (maxKg, insideDhaka, suburbs, outsideDhaka must be numbers)`;
    }

    if (tier.maxKg <= 0) {
      return `Tier ${i + 1}: max weight must be greater than 0`;
    }

    if (i > 0 && tier.maxKg <= sorted[i - 1].maxKg) {
      return `Tier ${i + 1}: max weight must be greater than the previous tier`;
    }

    if (tier.insideDhaka < 0 || tier.suburbs < 0 || tier.outsideDhaka < 0) {
      return `Tier ${i + 1}: rates cannot be negative`;
    }
  }

  // ---- overweightPerKg ----
  if (
    !overweightPerKg ||
    typeof overweightPerKg.insideDhaka !== "number" ||
    typeof overweightPerKg.suburbs !== "number" ||
    typeof overweightPerKg.outsideDhaka !== "number"
  ) {
    return "overweightPerKg must include numeric insideDhaka, suburbs, and outsideDhaka";
  }
  if (
    overweightPerKg.insideDhaka < 0 ||
    overweightPerKg.suburbs < 0 ||
    overweightPerKg.outsideDhaka < 0
  ) {
    return "Overweight rates cannot be negative";
  }

  // ---- codPercentage ----
  if (
    typeof codPercentage !== "number" ||
    codPercentage < 0 ||
    codPercentage > 100
  ) {
    return "codPercentage must be a number between 0 and 100";
  }

  // ---- deliveryDiscountPercent ----
  if (
    typeof deliveryDiscountPercent !== "number" ||
    deliveryDiscountPercent < 0 ||
    deliveryDiscountPercent > 100
  ) {
    return "deliveryDiscountPercent must be a number between 0 and 100";
  }

  return null;
};
