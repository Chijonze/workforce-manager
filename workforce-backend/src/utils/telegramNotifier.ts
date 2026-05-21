import { Request } from "express";

type LoginUser = {
  name?: string;
  email?: string;
  role?: string;
};

const getClientIp = (req?: Request) => {
  if (!req) return "Unknown";

  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket.remoteAddress || "Unknown";
};

const escapeTelegramText = (value?: string) => {
  return value?.replace(/[<>&]/g, (character) => {
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    return "&amp;";
  }) || "Unknown";
};

export const notifyTelegramLogin = async (user: LoginUser, req?: Request) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return;
  }

  const timestamp = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: process.env.TELEGRAM_ALERT_TIMEZONE || "Africa/Lagos",
  }).format(new Date());

  const message = [
    "<b>User login detected</b>",
    `Name: ${escapeTelegramText(user.name)}`,
    `Email: ${escapeTelegramText(user.email)}`,
    `Role: ${escapeTelegramText(user.role)}`,
    `IP: ${escapeTelegramText(getClientIp(req))}`,
    `Time: ${escapeTelegramText(timestamp)}`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`Telegram login notification failed with status ${response.status}`);
    }
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `Telegram login notification failed: ${error.message}`
        : "Telegram login notification failed"
    );
  } finally {
    clearTimeout(timeout);
  }
};
