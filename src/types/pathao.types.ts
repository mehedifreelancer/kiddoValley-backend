export interface PathaoTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export interface PathaoStore {
  id: number;
  name: string;
  // other fields...
}

export interface PathaoCreateOrderRequest {
  store_id?: number;
  merchant_order_id?: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_secondary_phone?: string;
  recipient_address: string;
  recipient_city?: number;
  recipient_zone?: number;
  recipient_area?: number;
  delivery_type: number; // 48 for Normal, 12 for On Demand
  item_type: number; // 1 for Document, 2 for Parcel
  special_instruction?: string;
  item_quantity: number;
  item_weight: number; // in KG, min 0.5
  item_description?: string;
  amount_to_collect: number; // 0 for non-COD
}

export interface PathaoCreateOrderResponse {
  consignment_id: string;
  merchant_order_id?: string;
  order_status: string;
  delivery_fee: number;
}

// For cancellation
export interface PathaoCancelResponse {
  message: string;
  type?: string;
  code?: number;
}
