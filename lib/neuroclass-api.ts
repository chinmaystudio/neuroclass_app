import { neuroClassApiBaseUrl, supabase } from "@/lib/supabase";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

export async function neuroClassApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your NeuroClass session has expired. Please sign in again.");

  const response = await fetch(`${neuroClassApiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "NeuroClass could not complete that secure request.");
  return payload;
}

export async function neuroClassMultipart<T>(path: string, form: FormData): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your NeuroClass session has expired. Please sign in again.");
  const response = await fetch(`${neuroClassApiBaseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "NeuroClass could not complete that secure request.");
  return payload;
}

export function newIdempotencyKey(): string {
  return `nc-mobile-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
