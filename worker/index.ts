import { handleRequest } from "./app";

export { DesktopDirectory } from "./desktop/desktop-directory";
export { UserSession } from "./session-object";

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<CloudflareBindings>;
