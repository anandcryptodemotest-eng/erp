import { createServiceMiddleware } from "@erp/auth";

export const middleware = createServiceMiddleware("hr");
export const config = { matcher: ["/api/:path*"] };
