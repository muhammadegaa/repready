// Email through Resend's HTTP API. Without RESEND_API_KEY nothing leaves the machine: the message is logged, so local runs and tests are safe.
export type Mail = { to: string; subject: string; text: string };

const FROM = () => process.env.MAIL_FROM ?? "RepReady <onboarding@resend.dev>";

export async function sendMail(m: Mail): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // The body is shown only outside production: it can hold a sign-in or reset link.
    console.log(`[mail not sent: RESEND_API_KEY is not set] to=${m.to} subject=${m.subject}${process.env.NODE_ENV === "production" ? "" : `\n${m.text}`}`);
    return { sent: false, error: "No email provider is configured." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: [m.to], subject: m.subject, text: m.text }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`[mail] Resend ${res.status} sending from ${FROM()}: ${detail}`);
      return { sent: false, error: `Email provider returned ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: (e as Error).message };
  }
}

// Confirming staff email addresses is switched on with REQUIRE_EMAIL_CONFIRMATION=1 once a sending domain is verified.
// Off, the banner is hidden and the morning digest goes to every coach address.
export const requireEmailConfirmation = () => process.env.REQUIRE_EMAIL_CONFIRMATION === "1";
