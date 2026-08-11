export const generateSlug = (text: string): string => {
  const slug = text
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "") // 👈 \p{M} যোগ করা হলো — matra/vowel-sign রাখার জন্য
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return slug || `product-${Date.now()}`;
};
