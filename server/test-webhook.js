
const crypto = require("crypto");

const uniqueId = Date.now();

const payload = {
    event_id: `evt-${uniqueId}`,
    type: "message.received",
    brand_id: "verdant-co",
    timestamp: new Date().toISOString(),

    customer: {
        id: "customer-001",
        name: "Aisha Khan",
        phone: "+919800000001"
    },

    message: {
        id: `msg-${uniqueId}`,
        type: "text",
        text: "Can I return an unopened product within 7 days?"
    }
};

async function testWebhook() {
    const rawBody = JSON.stringify(payload);

    const signature = crypto
        .createHmac("sha256", "verdant-demo-secret-2026")
        .update(rawBody)
        .digest("hex");

    const response = await fetch("http://localhost:5000/webhook", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Signature": `sha256=${signature}`
        },
        body: rawBody
    });

    const result = await response.json();

    console.log("Status:", response.status);
    console.log("Response:", result);
}

testWebhook().catch(console.error);
