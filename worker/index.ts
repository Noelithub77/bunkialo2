import { handleRequest } from "./app";

export { UserSession } from "./session-object";

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<CloudflareBindings>;
