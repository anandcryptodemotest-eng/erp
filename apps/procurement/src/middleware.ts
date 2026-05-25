import { createServiceMiddleware } from "@erp/auth";

export const middleware = createServiceMiddleware("procurement");
export const config = { matcher: ["/api/:path*"] };
