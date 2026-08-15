// controllers/deliveryChargeController.ts

import { Request, Response } from "express";
import { getDeliverySettingsCached } from "../services/deliverySettings.service";
import { WeightTier } from "../types/deliverySettings.types";

type LocationType = "inside_dhaka" | "suburbs" | "outside_dhaka";

const findTier = (weightKg: number, sortedTiers: WeightTier[]): WeightTier => {
  const tier = sortedTiers.find((t) => weightKg <= t.maxKg);
  return tier ?? sortedTiers[sortedTiers.length - 1];
};

const getRateForLocation = (
  tierOrOverweight: {
    insideDhaka: number;
    suburbs: number;
    outsideDhaka: number;
  },
  location: LocationType,
): number => {
  if (location === "inside_dhaka") return tierOrOverweight.insideDhaka;
  if (location === "suburbs") return tierOrOverweight.suburbs;
  return tierOrOverweight.outsideDhaka;
};

export const calculateDeliveryCharge = async (req: Request, res: Response) => {
  try {
    const { location, weight, productPrice = 0, isCod = true } = req.body;

    if (!location || weight === undefined || weight === null) {
      return res.status(400).json({
        success: false,
        message: "location and weight are required",
      });
    }

    if (!["inside_dhaka", "suburbs", "outside_dhaka"].includes(location)) {
      return res.status(400).json({
        success: false,
        message: "location must be inside_dhaka, suburbs, or outside_dhaka",
      });
    }

    const settings = await getDeliverySettingsCached();
    const sortedTiers = [...settings.weightTiers].sort(
      (a, b) => a.maxKg - b.maxKg,
    );
    const lastTier = sortedTiers[sortedTiers.length - 1];

    const parsedWeight = Math.round((parseFloat(weight) || 0) * 100) / 100;
    const loc = location as LocationType;

    let baseCharge: number;
    let weightCharge = 0;

    if (parsedWeight <= lastTier.maxKg) {
      const tier = findTier(parsedWeight, sortedTiers);
      baseCharge = getRateForLocation(tier, loc);
    } else {
      baseCharge = getRateForLocation(lastTier, loc);
      const extraWeight = Math.ceil(parsedWeight - lastTier.maxKg);
      const perKg = getRateForLocation(settings.overweightPerKg, loc);
      weightCharge = extraWeight * perKg;
    }

    // 🔧 FIX: COD charge এখন Total Bill (productPrice + delivery base charge,
    // discount/codCharge ধরার আগে) এর উপর বসছে — শুধু productPrice এর উপর না।
    const parsedPrice = parseFloat(productPrice) || 0;
    const deliverableBaseAmount = parsedPrice + baseCharge + weightCharge;

    let codCharge = 0;
    if (isCod && deliverableBaseAmount > 0) {
      codCharge = deliverableBaseAmount * (settings.codPercentage / 100);
    }

    const subtotal = baseCharge + weightCharge + codCharge;

    const discountAmount = subtotal * (settings.deliveryDiscountPercent / 100);
    const totalCharge = subtotal - discountAmount;

    res.json({
      success: true,
      data: {
        baseCharge,
        weightCharge,
        codCharge: parseFloat(codCharge.toFixed(2)),
        discountApplied: parseFloat(discountAmount.toFixed(2)),
        discountPercent: settings.deliveryDiscountPercent,
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

