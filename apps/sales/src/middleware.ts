import { createServiceMiddleware } from "@erp/auth";

export const middleware = createServiceMiddleware("sales");
export const config = { matcher: ["/api/:path*"] };
