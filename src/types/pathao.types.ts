export interface PathaoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface PathaoStore {
  id: number;
  name: string;
  address: string;
}

export interface PathaoCreateOrderRequest {
  store_id: number;
  merchant_order_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  delivery_type: number;       // 48 = Normal
  item_type: number;           // 2 = Parcel
  item_weight: number;         // in KG
  amount_to_collect: number;
  item_quantity: number;
}

export interface PathaoCreateOrderResponse {
  consignment_id: string;
  tracking_url: string;
}

export interface PathaoCreateOrderRequest {
  store_id?: number; // make optional
  merchant_order_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  delivery_type: number;
  item_type: number;
  item_weight: number;
  amount_to_collect: number;
  item_quantity: number;
}