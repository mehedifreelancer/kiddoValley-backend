import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import path from "path";
import fs from "fs";

const SETTINGS_KEY = "web_settings";

// ----- Helpers (with debug logs & safe JSON handling) -----
async function getWebSettings(): Promise<any> {
  console.log(`🔍 Fetching settings with key: "${SETTINGS_KEY}"`);
  const setting = await prisma.setting.findUnique({
    where: { key: SETTINGS_KEY },
  });

  if (!setting) {
    console.warn(
      `⚠️ No setting found for key "${SETTINGS_KEY}", returning default.`,
    );
    return {
      logoUrl: null,
      socialLinks: { facebook: "", instagram: "", youtube: "", website: "" },
      footerText: "",
    };
  }

  console.log(
    `✅ Raw value from DB (length: ${setting.value.length}):`,
    setting.value,
  );

  try {
    const parsed = JSON.parse(setting.value);
    console.log(`✅ Parsed successfully:`, parsed);
    return parsed;
  } catch (error: any) {
    console.error(`❌ Failed to parse JSON:`, error.message);
    // Attempt to repair common truncation (e.g., missing closing braces)
    let repaired = setting.value;
    // If it ends with incomplete string, try to close it
    if (!repaired.endsWith("}")) {
      console.warn(
        `🔧 Attempting to repair JSON by adding missing closing brace...`,
      );
      repaired = repaired + "}";
      try {
        const parsed = JSON.parse(repaired);
        console.log(`✅ Repaired JSON successfully:`, parsed);
        // Optionally save the repaired version back to DB
        await saveWebSettings(parsed);
        return parsed;
      } catch (e2) {
        console.error(`❌ Failed to repair JSON, returning default.`);
      }
    }
    // Fallback default
    return {
      logoUrl: null,
      socialLinks: { facebook: "", instagram: "", youtube: "", website: "" },
      footerText: "",
    };
  }
}

async function saveWebSettings(data: any): Promise<void> {
  const jsonString = JSON.stringify(data);
  // Validate JSON
  try {
    JSON.parse(jsonString);
  } catch (e) {
    throw new Error("Invalid JSON data – cannot save");
  }
  console.log(`💾 Saving settings (length: ${jsonString.length}):`, jsonString);
  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: jsonString },
    create: { key: SETTINGS_KEY, value: jsonString, type: "json" },
  });
  console.log(`✅ Settings saved.`);
}

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
      const { socialLinks, footerText, logoUrl } = req.body;
      const file = req.file;

      // 🔍 DEBUG — remove once confirmed working
      console.log("📥 Content-Type:", req.headers["content-type"]);
      console.log("📥 req.file:", file);
      console.log("📥 req.body keys:", Object.keys(req.body));

      const baseUrl = `${req.protocol}://${req.get("host")}`;

      // 1. Load current settings
      const current = await getWebSettings();

      // 2. Merge social links
      let parsedSocial = current.socialLinks || {
        facebook: "",
        instagram: "",
        youtube: "",
        website: "",
      };
      if (socialLinks) {
        try {
          const incoming = JSON.parse(socialLinks);
          parsedSocial = { ...parsedSocial, ...incoming };
        } catch (parseError) {
          if (file) deleteFile(file.path);
          return res.status(400).json({
            success: false,
            message: "Invalid socialLinks JSON",
          });
        }
      }

      // 3. Merge footer text
      const mergedFooterText =
        footerText !== undefined ? footerText : current.footerText || "";

      // 4. Logo processing
      let newLogoUrl: string | null = current.logoUrl;

      if (logoUrl !== undefined && (logoUrl === "" || logoUrl === "null")) {
        newLogoUrl = null;
        if (current.logoUrl) {
          let relativePath = current.logoUrl;
          if (relativePath.startsWith("http")) {
            try {
              const url = new URL(relativePath);
              relativePath = url.pathname;
            } catch {
              // ignore
            }
          }
          const oldPath = relativePath.startsWith("/")
            ? relativePath
            : `/${relativePath}`;
          const fullOldPath = path.join(process.cwd(), "public", oldPath);
          deleteFile(fullOldPath);
        }
      }

      if (file) {
        filePath = file.path;
        newLogoUrl = `${baseUrl}/uploads/logo/${file.filename}`;
        console.log("✅ New logo URL set to:", newLogoUrl); // 🔍 DEBUG
        if (current.logoUrl) {
          let relativePath = current.logoUrl;
          if (relativePath.startsWith("http")) {
            try {
              const url = new URL(relativePath);
              relativePath = url.pathname;
            } catch {
              // ignore
            }
          }
          oldLogoPath = relativePath.startsWith("/")
            ? relativePath
            : `/${relativePath}`;
        }
      } else {
        console.log("⚠️ No file received in this request"); // 🔍 DEBUG
      }

      const updatedData = {
        logoUrl: newLogoUrl,
        socialLinks: parsedSocial,
        footerText: mergedFooterText,
      };

      await saveWebSettings(updatedData);

      if (file && oldLogoPath) {
        const fullOldPath = path.join(process.cwd(), "public", oldLogoPath);
        deleteFile(fullOldPath);
      }

      const responseData = { ...updatedData };
      if (responseData.logoUrl && !responseData.logoUrl.startsWith("http")) {
        responseData.logoUrl = `${baseUrl}${responseData.logoUrl.startsWith("/") ? "" : "/"}${responseData.logoUrl}`;
      }

      res.json({
        success: true,
        data: responseData,
        message: "Settings updated successfully",
      });
    } catch (error: any) {
      if (filePath) deleteFile(filePath);
      console.error("Update settings error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update settings",
      });
    }
  },

  async getPublicSettings(req: Request, res: Response) {
    try {
      const data = await getWebSettings();
      if (data.logoUrl && !data.logoUrl.startsWith("http")) {
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        data.logoUrl = `${baseUrl}${data.logoUrl.startsWith("/") ? "" : "/"}${data.logoUrl}`;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("Get public settings error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch settings" });
    }
  },
};
