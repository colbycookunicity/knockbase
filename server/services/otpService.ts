import crypto from "crypto";
import { db } from "../db";
import { otpChallenges } from "../../shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function createOtp(
  email: string,
  purpose: string = "login",
  expirationMinutes: number = 10
): Promise<string> {
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

  await db.insert(otpChallenges).values({
    email: email.toLowerCase(),
    codeHash,
    purpose,
    attempts: "0",
    expiresAt,
  });

  console.log(`[OTP] Code for ${email}: ${code}`);
  return code;
}

export async function verifyOtp(
  email: string,
  code: string,
  purpose: string = "login"
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase();

  if (
    process.env.NODE_ENV !== "production" &&
    code === "000000"
  ) {
    console.log(`[OTP] Dev bypass used for ${normalizedEmail}`);
    return true;
  }

  const challenges = await db
    .select()
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.email, normalizedEmail),
        eq(otpChallenges.purpose, purpose),
        isNull(otpChallenges.usedAt),
        gt(otpChallenges.expiresAt, new Date())
      )
    )
    .orderBy(otpChallenges.createdAt)
    .limit(1);

  if (challenges.length === 0) {
    return false;
  }

  const challenge = challenges[0];
  const attempts = parseInt(challenge.attempts, 10) + 1;

  if (attempts > 5) {
    await db
      .update(otpChallenges)
      .set({ usedAt: new Date() })
      .where(eq(otpChallenges.id, challenge.id));
    return false;
  }

  const codeHash = hashCode(code);
  if (codeHash !== challenge.codeHash) {
    await db
      .update(otpChallenges)
      .set({ attempts: attempts.toString() })
      .where(eq(otpChallenges.id, challenge.id));
    return false;
  }

  await db
    .update(otpChallenges)
    .set({ usedAt: new Date() })
    .where(eq(otpChallenges.id, challenge.id));

  return true;
}
