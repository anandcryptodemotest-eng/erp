import { createServiceMiddleware } from "@erp/auth";

export const middleware = createServiceMiddleware("delivery");
export const config = { matcher: ["/api/:path*"] };
