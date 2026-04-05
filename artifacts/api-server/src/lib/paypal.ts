export const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

export function isPayPalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export async function getPayPalToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret   = process.env.PAYPAL_CLIENT_SECRET!;
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:  `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`PayPal auth failed: ${data.error ?? "unknown"}`);
  return data.access_token;
}

export interface PayPalSubscription {
  id: string;
  status: string;
  plan_id: string;
  start_time: string;
  billing_info?: {
    last_payment?: { amount: { value: string; currency_code: string }; time: string };
    next_billing_time?: string;
    cycle_executions?: Array<{ tenure_type: string; sequence: number; cycles_completed: number }>;
  };
}

export async function fetchSubscription(
  token: string,
  subscriptionId: string
): Promise<PayPalSubscription | null> {
  try {
    const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return await res.json() as PayPalSubscription;
  } catch {
    return null;
  }
}

export interface PayPalReportingTx {
  transaction_info: {
    paypal_reference_id?: string;
    transaction_id: string;
    transaction_amount: { value: string; currency_code: string };
    transaction_status: string;
    transaction_initiation_date: string;
    transaction_subject?: string;
  };
  payer_info?: { payer_name?: { alternate_full_name?: string }; email_address?: string };
}

/** Convert any ISO string to PayPal's required format: 2024-01-01T00:00:00.000+0000 */
function toPayPalDate(iso: string): string {
  return iso.replace("Z", "+0000").replace(/(\.\d{3})?(\+0000)$/, ".000+0000");
}

export async function fetchReportingTransactions(
  token: string,
  startDate: string,
  endDate: string
): Promise<{ rows: PayPalReportingTx[]; error?: string }> {
  const params = new URLSearchParams({
    start_date: toPayPalDate(startDate),
    end_date:   toPayPalDate(endDate),
    fields:     "transaction_info,payer_info",
    page_size:  "500",
  });
  const res = await fetch(`${PAYPAL_BASE}/v1/reporting/transactions?${params}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json() as { transaction_details?: PayPalReportingTx[]; message?: string; name?: string };
  if (!res.ok) {
    const msg = data.message ?? data.name ?? `HTTP ${res.status}`;
    console.warn("[PayPal Reporting] API error:", msg, "params:", params.toString());
    return { rows: [], error: msg };
  }
  return { rows: data.transaction_details ?? [] };
}
