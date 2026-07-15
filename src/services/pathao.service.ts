import axios from "axios";
import {
  PathaoTokenResponse,
  PathaoStore,
  PathaoCreateOrderRequest,
  PathaoCreateOrderResponse,
} from "../types/pathao.types";

const BASE_URL = process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com";
const CLIENT_ID = process.env.PATHAO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.PATHAO_CLIENT_SECRET || "";
const USERNAME = process.env.PATHAO_USERNAME || "";
const PASSWORD = process.env.PATHAO_PASSWORD || "";
const GRANT_TYPE = process.env.PATHAO_GRANT_TYPE || "password";
const STORE_ID = process.env.PATHAO_STORE_ID
  ? parseInt(process.env.PATHAO_STORE_ID)
  : null;
const IS_MOCK = process.env.PATHAO_MOCK === "true";

class PathaoService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private storeId: number | null = STORE_ID;

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const url = `${BASE_URL}/aladdin/api/v1/issue-token`;
    const payload = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: GRANT_TYPE,
      username: USERNAME,
      password: PASSWORD,
    };

    console.log(`🌐 Pathao token request: ${url}`);
    console.log(`📦 Body: ${JSON.stringify(payload)}`);

    try {
      const response = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });

      console.log(`✅ Pathao token response: ${response.status}`);
      const data: PathaoTokenResponse = response.data;
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;
      return this.accessToken;
    } catch (error: any) {
      console.error("❌ Pathao token fetch failed:");
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error(`No response: ${error.message}`);
      } else {
        console.error(error.message);
      }
      throw new Error(`Pathao token error: ${error.message}`);
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
    console.log(`🌐 Pathao API request: ${method} ${url}`);

    try {
      const response = await axios({
        method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: body,
        timeout: 15000,
      });

      console.log(`✅ Pathao API response: ${response.status}`);
      return response.data as T;
    } catch (error: any) {
      console.error(`❌ Pathao API error (${method} ${url}):`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        console.error(`No response: ${error.message}`);
      } else {
        console.error(error.message);
      }
      throw new Error(`Pathao API error: ${error.message}`);
    }
  }

  async getStoreId(): Promise<number> {
    if (this.storeId) return this.storeId;
    const stores = await this.request<{ data: PathaoStore[] }>(
      "GET",
      "/aladdin/api/v1/stores",
    );
    if (!stores.data || stores.data.length === 0)
      throw new Error("No stores found");
    this.storeId = stores.data[0].id;
    return this.storeId;
  }

  async createOrder(
    payload: PathaoCreateOrderRequest,
  ): Promise<PathaoCreateOrderResponse> {
    if (IS_MOCK) {
      console.log("🔸 Pathao mock mode – returning fake order.");
      return {
        consignment_id: `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        merchant_order_id: payload.merchant_order_id || "",
        order_status: "Mock",
        delivery_fee: 80,
      };
    }

    let storeId = payload.store_id;
    if (!storeId) {
      storeId = await this.getStoreId();
    }
    const fullPayload = { ...payload, store_id: storeId };
    const result = await this.request<{
      data: PathaoCreateOrderResponse;
      message: string;
      type: string;
      code: number;
    }>("POST", "/aladdin/api/v1/orders", fullPayload);
    return result.data;
  }

  // 🆕 Get order status from Pathao
  async getOrderStatus(consignmentId: string): Promise<any> {
    if (IS_MOCK) {
      return {
        consignment_id: consignmentId,
        merchant_order_id: "mock-123",
        order_status: "Pending",
        order_status_slug: "Pending",
        updated_at: new Date().toISOString().replace("T", " ").slice(0, 19),
        invoice_id: null,
      };
    }
    const result = await this.request<{
      message: string;
      type: string;
      code: number;
      data: {
        consignment_id: string;
        merchant_order_id: string;
        order_status: string;
        order_status_slug: string;
        updated_at: string;
        invoice_id: string | null;
      };
    }>("GET", `/aladdin/api/v1/orders/${consignmentId}/info`);
    return result.data;
  }

  async cancelOrder(
    consignmentId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (IS_MOCK) {
      return { success: true, message: "Mock order cancelled" };
    }
    const result = await this.request<{
      message: string;
      type: string;
      code: number;
    }>("DELETE", `/aladdin/api/v1/orders/${consignmentId}`);
    return { success: true, message: result.message || "Order cancelled" };
  }
}

export default new PathaoService();
