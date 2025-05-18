import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { config } from "dotenv";
import morgan from "morgan";
import authRouter from "./routes/auth.routes.js";

// Import other routers here
import productRouter from "./routes/product.route.js";
import userRouter from "./routes/user.route.js";
import categoryRouter from "./routes/category.route.js";
import reviewRouter from "./routes/review.route.js";
import couponRouter from "./routes/coupon.route.js";
import orderRouter from "./routes/order.route.js";
import wishlistRouter from "./routes/wishlist.route.js";
import cartRouter from "./routes/cart.route.js";
import guestRouter from "./routes/guest.route.js";
import salesRouter from "./routes/sales.route.js";

config();

const app = express();

// Middlewares
app.use(morgan("dev"));
app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
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

// Routes
app.use("/api/auth", authRouter);
app.use("/api/products", productRouter);
app.use("/api/users", userRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/coupons", couponRouter);
app.use("/api/orders", orderRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/cart", cartRouter);
app.use("/api/guest", guestRouter);
app.use("/api/sales", salesRouter);

// Root endpoint
app.get("/", (req, res) => {
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
