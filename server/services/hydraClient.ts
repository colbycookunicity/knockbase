const HYDRA_API_URL = process.env.HYDRA_API_URL || "https://hydraqa.unicity.net/v6-test";

interface HydraErrorResponse {
  error?: string;
  code?: string;
  message?: string;
}

export class HydraError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "HydraError";
  }
}

const HYDRA_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED: "Too many requests. Please wait before trying again.",
  INVALID_OTP: "Invalid or expired verification code.",
  OTP_EXPIRED: "Invalid or expired verification code.",
  OTP_NOT_FOUND: "No verification code found. Please request a new one.",
};

function getHydraUserMessage(code: string): string {
  return HYDRA_ERROR_MESSAGES[code] || "Verification failed. Please try again.";
}

export async function requestOtp(email: string): Promise<void> {
  const res = await fetch(`${HYDRA_API_URL}/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as HydraErrorResponse;
    const code = body.code || body.error || "UNKNOWN";
    throw new HydraError(code, getHydraUserMessage(code));
  }
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const res = await fetch(`${HYDRA_API_URL}/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as HydraErrorResponse;
    const errorCode = body.code || body.error || "UNKNOWN";
    throw new HydraError(errorCode, getHydraUserMessage(errorCode));
  }

  return true;
}
