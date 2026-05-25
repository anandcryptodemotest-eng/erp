import { createServiceMiddleware } from "@erp/auth";

export const middleware = createServiceMiddleware("accounting");
export const config = { matcher: ["/api/:path*"] };
