import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import path from "path";
import fs from "fs";

const SETTINGS_KEY = "web_settings";

// ----- Helpers -----
async function getWebSettings(): Promise<any> {
  const setting = await prisma.setting.findUnique({
    where: { key: SETTINGS_KEY },
  });
  if (!setting) {
    return {
      logoUrl: null,
      socialLinks: { facebook: "", instagram: "", youtube: "", website: "" },
      footerText: "",
    };
  }
  try {
    return JSON.parse(setting.value);
  } catch {
    return {
      logoUrl: null,
      socialLinks: { facebook: "", instagram: "", youtube: "", website: "" },
      footerText: "",
    };
  }
}

async function saveWebSettings(data: any): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(data) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(data), type: "json" },
  });
}

// Helper to delete a file
function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn("Failed to delete file:", filePath, e);
  }
}

// ----- Controller -----
export const webSettingsController = {
  async getSettings(req: Request, res: Response) {
    try {
      const data = await getWebSettings();
      // Ensure logoUrl is absolute if present and relative
      if (data.logoUrl && !data.logoUrl.startsWith("http")) {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        data.logoUrl = `${baseUrl}${data.logoUrl.startsWith("/") ? "" : "/"}${data.logoUrl}`;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Get settings error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch settings" });
    }
  },

  async updateSettings(req: Request, res: Response) {
    let filePath: string | null = null;
    let oldLogoPath: string | null = null;

    try {
      const { socialLinks, footerText } = req.body;
      const file = req.file; // multer already saved to disk if provided
      const baseUrl = `${req.protocol}://${req.get("host")}`;

      // 1. Parse socialLinks early (so we can delete file on error)
      let parsedSocial = {};
      if (socialLinks) {
        try {
          parsedSocial = JSON.parse(socialLinks);
        } catch (parseError) {
          // If file was uploaded, delete it before responding
          if (file) {
            deleteFile(file.path);
          }
          return res.status(400).json({
            success: false,
            message: "Invalid socialLinks JSON",
          });
        }
      }
      const defaultSocial = {
        facebook: "",
        instagram: "",
        youtube: "",
        website: "",
      };
      const social = { ...defaultSocial, ...parsedSocial };

      // 2. Get current settings
      const current = await getWebSettings();

      // 3. Prepare new logo URL and old logo path (if any)
      let newLogoUrl: string | null = null;

      if (file) {
        // Store file path for cleanup on error
        filePath = file.path;
        newLogoUrl = `${baseUrl}/uploads/logo/${file.filename}`;

        // Record old logo path (to delete later after DB success)
        if (current.logoUrl) {
          let relativePath = current.logoUrl;
          if (relativePath.startsWith("http")) {
            try {
              const url = new URL(relativePath);
              relativePath = url.pathname;
            } catch {
              // If parsing fails, assume it's already relative
            }
          }
          // Ensure it starts with '/'
          oldLogoPath = relativePath.startsWith("/")
            ? relativePath
            : `/${relativePath}`;
        }
      }

      // 4. Build updated data
      const updatedData = {
        logoUrl: newLogoUrl || current.logoUrl || null,
        socialLinks: social,
        footerText:
          footerText !== undefined ? footerText : current.footerText || "",
      };

      // Ensure logoUrl is absolute (for response) when no new file
      if (
        !file &&
        updatedData.logoUrl &&
        !updatedData.logoUrl.startsWith("http")
      ) {
        updatedData.logoUrl = `${baseUrl}${updatedData.logoUrl.startsWith("/") ? "" : "/"}${updatedData.logoUrl}`;
      }

      // 5. Save to DB
      await saveWebSettings(updatedData);

      // 6. If DB success and a new file was uploaded, delete old logo
      if (file && oldLogoPath) {
        const fullOldPath = path.join(process.cwd(), "public", oldLogoPath);
        deleteFile(fullOldPath);
      }

      // 7. Return success
      res.json({
        success: true,
        data: updatedData,
        message: "Settings updated successfully",
      });
    } catch (error: any) {
      // On any error, delete the newly uploaded file (if any)
      if (filePath) {
        deleteFile(filePath);
      }
      console.error("Update settings error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update settings",
      });
    }
  },
};
