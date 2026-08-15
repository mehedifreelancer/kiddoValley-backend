// backend/src/services/ai/groq.service.ts
import axios from "axios";

const GROQ_API_KEY = process.env.GROQ_API_KEY; // ✅ এখন backend .env এ, frontend bundle এ যাবে না
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqParsedData {
  accountName: string;
  recipientName: string;
  recipientPhone: string;
  recipientPhone2: string;
  recipientAddress: string;
  gender: "male" | "female" | "other" | "";
  hasBaby: boolean;
  preferredToy: string;
  locationType: "inside_dhaka" | "suburbs" | "outside_dhaka";
}

export const parseWithGroq = async (text: string): Promise<GroqParsedData> => {
  const prompt = `
You are a data extraction assistant. Extract the following fields from the customer message.

Rules:
- 'accountName': The name of the account holder (the person who owns the account or made the order).
  - Look for full names (with titles like Mr., Mrs., Md., মোঃ, or Bengali names).
  - If there are two distinct full names in the text, the first one (or the one with a title) is the accountName.
  - If there is only one distinct full name, use it for both accountName and recipientName.
- 'recipientName': The name of the person who will receive the parcel.
  - If two names exist, this is the second name (usually the one associated with the delivery address).
  - If only one name, set this to the same as accountName.
- 'gender': Detect from the accountName (if present), otherwise from recipientName. Use common patterns: names ending with 'a', 'bibi', 'begum' are female; 'md', 'mohammad' are male; if unsure, return 'other'.
- 'recipientPhone': Primary phone (11 digits starting with 01). Return as a JSON STRING (in double quotes), never as a number — e.g. "01634857120", not 1634857120. Clean to digits only.
- 'recipientPhone2': Secondary phone (if present). Return as a JSON STRING, never as a number. Clean to digits.- 'recipientAddress': Full delivery address (after name and phone numbers).
- 'hasBaby': true if text mentions baby/child/kids/toddler.
- 'preferredToy': extract phrase if mentioned, else empty.
- 'locationType': Determine the Pathao delivery zone for this address, from our ISD (Inside Dhaka) warehouse. Choose exactly one of: "inside_dhaka", "suburbs", "outside_dhaka".
  - "inside_dhaka": address contains "Dhaka", "ঢাকা", or any area within Dhaka city proper (like Gulshan, Mirpur, Dhanmondi, Uttara, Mohammadpur, Badda, Banani, Motijheel, etc.)
  - "suburbs": address falls within any of these 4 official Pathao "Suburb" districts and their upazilas/thanas/localities (do NOT treat these as inside_dhaka):
    - Gazipur district: Gazipur, গাজীপুর, Joydebpur, জয়দেবপুর, Tongi, টঙ্গী, Mawna, মাওনা, Sreepur, শ্রীপুর, Kaliakair, কালিয়াকৈর, Kaliganj, কালীগঞ্জ, Kapasia, কাপাসিয়া, Board Bazar, বোর্ড বাজার
    - Narayanganj district: Narayanganj, নারায়ণগঞ্জ, Fatullah, ফতুল্লা, Siddhirganj, সিদ্ধিরগঞ্জ, Bandar, বন্দর, Sonargaon, সোনারগাঁও, Araihazar, আড়াইহাজার, Rupganj, রূপগঞ্জ, Tarabo, তারাবো
    - Savar area: Savar, সাভার, Ashulia, আশুলিয়া
    - Keraniganj: Keraniganj, কেরানীগঞ্জ (North and South)
  - "outside_dhaka": any other district/area (e.g. Manikganj, Tangail, Chittagong, Sirajganj, Rangpur, Barisal, etc.), or if address is unclear/not detectable.

Return ONLY a valid JSON object with these exact keys: accountName, recipientName, recipientPhone, recipientPhone2, recipientAddress, gender, hasBaby, preferredToy, locationType.
Do not include any extra text.

Examples:
1. Single name, inside Dhaka: "Alomgir 01323874187 ব্যাংকার্স কমপ্লেক্স ২, ঢাকা"
   → {"accountName":"Alomgir","recipientName":"Alomgir", ..., "locationType":"inside_dhaka"}
2. Two names, outside Dhaka: "Mrs. Ananna Alomgir 01323874187 ... Rangpur"
   → {"accountName":"Mrs. Ananna","recipientName":"Alomgir", ..., "locationType":"outside_dhaka"}
3. Bengali address, outside Dhaka: "শিব্বির আহমেদ রিজুয়ান 01634857120 ... সিরাজগঞ্জ"
   → {"accountName":"শিব্বির আহমেদ","recipientName":"রিজুয়ান", ..., "locationType":"outside_dhaka"}
4. Greater Dhaka suburb district: "Chakpara, Sreepur, Mawna, Gazipur"
   → {"accountName":"","recipientName":"", ..., "recipientAddress":"Chakpara, Sreepur, Mawna, Gazipur", "locationType":"suburbs"}
5. Narayanganj suburb: "Md. Rafiq 01711223344 Fatullah, Narayanganj"
   → {"accountName":"Md. Rafiq","recipientName":"Md. Rafiq", ..., "locationType":"suburbs"}
6. Savar suburb: "Karim 01911223344 Ashulia, Savar"
   → {"accountName":"Karim","recipientName":"Karim", ..., "locationType":"suburbs"}

Now extract from:
${text}
`;

  try {
    const response = await axios.post(
      GROQ_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const content = response.data.choices[0]?.message?.content || "";
    const parsed = JSON.parse(content);

    const validLocationTypes = ["inside_dhaka", "suburbs", "outside_dhaka"];
    const locationType = validLocationTypes.includes(parsed.locationType)
      ? parsed.locationType
      : "outside_dhaka";

    return {
      accountName: parsed.accountName || "",
      recipientName: parsed.recipientName || "",
      recipientPhone: parsed.recipientPhone || "",
      recipientPhone2: parsed.recipientPhone2 || "",
      recipientAddress: parsed.recipientAddress || "",
      gender: parsed.gender || "",
      hasBaby: parsed.hasBaby || false,
      preferredToy: parsed.preferredToy || "",
      locationType,
    };
  } catch (error: any) {
    console.error("Groq API error:", error.response?.data || error.message);
    throw new Error("Failed to parse customer text with Groq");
  }
};

export const detectLocationOnly = async (
  address: string,
): Promise<GroqParsedData["locationType"]> => {
  const parsed = await parseWithGroq(address);
  return parsed.locationType;
};
