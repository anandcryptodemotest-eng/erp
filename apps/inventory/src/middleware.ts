import { createServiceMiddleware } from "@erp/auth";

export const middleware = createServiceMiddleware("inventory");
export const config = { matcher: ["/api/:path*"] };
