export interface WeightTier {
  maxKg: number;
  insideDhaka: number;
  suburbs: number;   // 🆕
  outsideDhaka: number;
}

export interface DeliverySettings {
  weightTiers: WeightTier[];
  overweightPerKg: {
    insideDhaka: number;
    suburbs: number;  // 🆕
    outsideDhaka: number;
  };
  codPercentage: number;
  deliveryDiscountPercent: number;
}