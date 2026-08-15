import { prisma } from "../lib/prisma";

export type PackagingSettingsInput = {
  averagePackagingCost: number;
};

export const DEFAULT_PACKAGING_SETTINGS: PackagingSettingsInput = {
  averagePackagingCost: 10,
};

/**
 * Get packaging settings (always the single record with id=1)
 */
export async function getPackagingSettings(): Promise<PackagingSettingsInput> {
  const record = await prisma.packagingSettings.findUnique({
    where: { id: 1 },
  });
  if (!record) {
    // If no record exists, create default
    return await createDefaultPackagingSettings();
  }
  return {
    averagePackagingCost: record.averagePackagingCost,
  };
}

/**
 * Create default record if missing
 */
async function createDefaultPackagingSettings(): Promise<PackagingSettingsInput> {
  const created = await prisma.packagingSettings.create({
    data: DEFAULT_PACKAGING_SETTINGS,
  });
  return {
    averagePackagingCost: created.averagePackagingCost,
  };
}

/**
 * Update packaging settings
 */
export async function updatePackagingSettings(
  data: PackagingSettingsInput,
): Promise<PackagingSettingsInput> {
  const updated = await prisma.packagingSettings.upsert({
    where: { id: 1 },
    update: {
      averagePackagingCost: data.averagePackagingCost,
    },
    create: {
      id: 1,
      averagePackagingCost: data.averagePackagingCost,
    },
  });
  return {
    averagePackagingCost: updated.averagePackagingCost,
  };
}

/**
 * Validate incoming payload
 */
export function validatePackagingSettingsPayload(data: any): string | null {
  if (data === null || typeof data !== "object") {
    return "Invalid payload: must be an object";
  }
  const cost = data.averagePackagingCost;
  if (cost === undefined || cost === null) {
    return "averagePackagingCost is required";
  }
  if (typeof cost !== "number" || isNaN(cost)) {
    return "averagePackagingCost must be a number";
  }
  if (cost < 0) {
    return "averagePackagingCost cannot be negative";
  }
  return null;
}
