
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

async function generateAIReply(customerMessage) {

    const knowledgeBase = `
    Verdant & Co. Customer Support Knowledge Base:

    Shipping:
    Orders ship within 24 hours, Monday to Saturday.
    Delivery takes 3-5 business days in metro cities
    and 5-8 business days elsewhere in India.

    Address changes:
    Allowed only within 12 hours of ordering
    and before the order is shipped.

    Cancellation:
    Orders can be cancelled before shipping.
    After shipping, customers can refuse delivery.
    Refunds are processed after the parcel returns.

    Returns:
    Returns are allowed within 7 days of delivery
    for unopened and unused products.
    Opened products are accepted only if damaged
    or incorrect.

    Refunds:
    Refunds go to the original payment method
    within 5-7 business days after the returned
    parcel is received.

    COD:
    Available for orders below ₹3000.
    A ₹50 COD fee applies.

    Products:
    All products are fragrance-free and vegan.

    Unknown questions:
    Do not invent answers about Dubai delivery
    or medical/allergy advice.
    Refer these questions to the support team.
    `;

    // Retry Gemini up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {

        try {

            console.log(`Gemini attempt ${attempt}/3`);

            const response = await ai.models.generateContent({
               model: "gemini-3.8-flash",

                contents: `
                    Knowledge Base:
                    ${knowledgeBase}

                    Customer Message:
                    ${customerMessage}

                    Generate a short, friendly and professional
                    customer support reply.

                    Use only the knowledge base.
                    Never invent information.
                    Return only the suggested reply.
                `,

                config: {
                    temperature: 0.2,
                    maxOutputTokens: 250,
                },
            });

            const reply = response.text?.trim();

            if (!reply) {
                throw new Error("Gemini returned an empty response");
            }

            console.log("Gemini reply generated successfully");

            return reply;

        } catch (error) {

            console.error(
                `Gemini attempt ${attempt} failed:`,
                error.message
            );

            const status = error.status || error.error?.code;

            const temporaryError = [429, 500, 503, 504].includes(
                Number(status)
            );

            if (!temporaryError || attempt === 3) {
                throw error;
            }

            // Wait before trying again
            const delay = attempt * 2000;

            console.log(`Retrying after ${delay / 1000} seconds...`);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

module.exports = { generateAIReply };
