import {
  buildPushHTTPRequest,
  type PushSubscription,
} from "@pushforge/builder";

export type ReminderPush = {
  body: string;
  id: string;
  title: string;
  url: string;
};

const decodeBase64Url = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const encodeBase64Url = (value: Uint8Array): string => {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const publicVapidKeyFromPrivateJwk = (privateKey: string): string => {
  const parsed: unknown = JSON.parse(privateKey);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("x" in parsed) ||
    !("y" in parsed) ||
    typeof parsed.x !== "string" ||
    typeof parsed.y !== "string"
  ) {
    throw new Error("The VAPID secret is invalid.");
  }

  const x = decodeBase64Url(parsed.x);
  const y = decodeBase64Url(parsed.y);
  const publicKey = new Uint8Array(1 + x.length + y.length);
  publicKey[0] = 4;
  publicKey.set(x, 1);
  publicKey.set(y, 1 + x.length);
  return encodeBase64Url(publicKey);
};

export const sendReminderPush = async (params: {
  adminContact: string;
  privateKey: string;
  reminder: ReminderPush;
  subscription: PushSubscription;
}): Promise<Response> => {
  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK: params.privateKey,
    subscription: params.subscription,
    message: {
      adminContact: params.adminContact,
      options: {
        ttl: 24 * 60 * 60,
        topic: params.reminder.id.slice(0, 32),
        urgency: "high",
      },
      payload: {
        body: params.reminder.body,
        data: { url: params.reminder.url },
        icon: "/icons/icon-192.png",
        tag: params.reminder.id,
        title: params.reminder.title,
      },
    },
  });

  return fetch(endpoint, { body, headers, method: "POST" });
};
