
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
const approveReplyRoutes = require("./routes/approveReply");

const conversationRoutes = require("./routes/conversations");
const customerRoutes = require("./routes/customer");

// Import webhook route
const webhookRoutes = require("./routes/webhook");

// Webhook needs the raw request body for signature verification
app.use(
    "/webhook",
    express.raw({ type: "application/json" }),
    webhookRoutes
);

// Normal JSON middleware for other APIs
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Verdant Support Backend is running!");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

app.use("/api/conversations", conversationRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/approve-reply", approveReplyRoutes);