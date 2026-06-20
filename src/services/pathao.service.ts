import axios from "axios";
import {
  PathaoTokenResponse,
  PathaoStore,
  PathaoCreateOrderRequest,
  PathaoCreateOrderResponse,
} from "../types/pathao.types";

const BASE_URL = process.env.PATHAO_BASE_URL || "https://courier-api-sandbox.pathao.com";
const CLIENT_ID = process.env.PATHAO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.PATHAO_CLIENT_SECRET || "";
const USERNAME = process.env.PATHAO_USERNAME || "";
const PASSWORD = process.env.PATHAO_PASSWORD || "";
const GRANT_TYPE = process.env.PATHAO_GRANT_TYPE || "password";

class PathaoService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private storeId: number | null = null;

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const url = `${BASE_URL}/merchant/v1/oauth/token`;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: USERNAME,
      password: PASSWORD,
      grant_type: GRANT_TYPE,
    });

    console.log(`🌐 Pathao token request: ${url}`);
    console.log(`📦 Body: ${params.toString()}`);

    try {
      const response = await axios.post(url, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
        console.error("💡 Check your internet/DNS or firewall.");
      } else {
        console.error(error.message);
      }
      throw new Error(`Pathao token error: ${error.message}`);
    }
  }

  private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
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
    const stores = await this.request<{ data: PathaoStore[] }>("GET", "merchant/v1/stores");
    if (!stores.data || stores.data.length === 0) throw new Error("No stores found");
    this.storeId = stores.data[0].id;
    return this.storeId;
  }

  async createOrder(payload: PathaoCreateOrderRequest): Promise<PathaoCreateOrderResponse> {
    let storeId = payload.store_id;
    if (!storeId) {
      storeId = await this.getStoreId();
    }
    const fullPayload = { ...payload, store_id: storeId };
    const result = await this.request<{ data: PathaoCreateOrderResponse }>(
      "POST",
      "merchant/v1/orders",
      fullPayload
    );
    return result.data;
  }
}

export default new PathaoService();