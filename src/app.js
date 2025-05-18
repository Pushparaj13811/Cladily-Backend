import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { config } from "dotenv";
import morgan from "morgan";
import authRouter from "./routes/auth.routes.js";

// Import other routers here
import productRouter from "./routes/product.routes.js";
import userRouter from "./routes/user.routes.js";
import categoryRouter from "./routes/category.routes.js";
import reviewRouter from "./routes/review.routes.js";
import couponRouter from "./routes/coupon.routes.js";
import orderRouter from "./routes/order.routes.js";
import wishlistRouter from './routes/wishlist.routes.js'
import cartRouter from "./routes/cart.routes.js";
import salesRouter from "./routes/sales.routes.js";
import addressRouter from "./routes/address.routes.js";

// Import rate limiting middleware and configurations
import { rateLimiter } from "./middlewares/rateLimiter.middleware.js";
import { 
  GLOBAL_LIMITS, 
  PUBLIC_API_LIMITS, 
  AUTH_LIMITS 
} from "./utils/rateLimitWindows.js";

config();

const app = express();

// Middlewares
app.use(morgan("dev"));
app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(
    session({
        secret: "your_secret_key",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
    })
);

// Apply global rate limiting to all routes
app.use(rateLimiter(GLOBAL_LIMITS.DEFAULT));

// Health check endpoint (not rate limited)
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes with specific rate limits
app.use("/api/auth", rateLimiter(AUTH_LIMITS.STANDARD), authRouter);
app.use("/api/products", rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), productRouter);
app.use("/api/user", rateLimiter(PUBLIC_API_LIMITS.STANDARD), userRouter);
app.use("/api/categories", rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), categoryRouter);
app.use("/api/reviews", rateLimiter(PUBLIC_API_LIMITS.STANDARD), reviewRouter);
app.use("/api/coupons", rateLimiter(PUBLIC_API_LIMITS.STANDARD), couponRouter);
app.use("/api/orders", rateLimiter(PUBLIC_API_LIMITS.STANDARD), orderRouter);
app.use("/api/wishlist", rateLimiter(PUBLIC_API_LIMITS.STANDARD), wishlistRouter);
app.use("/api/cart", rateLimiter(PUBLIC_API_LIMITS.STANDARD), cartRouter);
app.use("/api/sales", rateLimiter(PUBLIC_API_LIMITS.STANDARD), salesRouter);
app.use("/api/addresses", rateLimiter(PUBLIC_API_LIMITS.STANDARD), addressRouter);

// Root endpoint
app.get("/", rateLimiter(PUBLIC_API_LIMITS.RELAXED), (req, res) => {
    res.send("Hello from the Cladily API!");
});

// Common error handler
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
    });
});

export { app };
