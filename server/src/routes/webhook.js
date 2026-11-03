
const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const supabase = require("../config/supabase");
const { generateAIReply } = require("../services/aiService");

// Verify webhook signature
function verifySignature(rawBody, signature) {
    if (!signature || !signature.startsWith("sha256=")) {
        return false;
    }

    const expectedSignature =
        "sha256=" +
        crypto
            .createHmac("sha256", process.env.WEBHOOK_SECRET)
            .update(rawBody)
            .digest("hex");

    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(signature);

    return (
        expected.length === received.length &&
        crypto.timingSafeEqual(expected, received)
    );
}

// POST /webhook
router.post("/", async (req, res) => {
    try {
        const rawBody = req.body;
        const signature = req.headers["x-signature"];

        // 1. Verify webhook signature
        if (!verifySignature(rawBody, signature)) {
            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature"
            });
        }

        // 2. Parse JSON body
        const body = JSON.parse(rawBody.toString("utf8"));

        const {
            event_id,
            type,
            brand_id,
            timestamp,
            customer,
            message
        } = body;

        // 3. Validate required information
        if (
            !event_id ||
            type !== "message.received" ||
            !brand_id ||
            !timestamp ||
            !customer?.id ||
            !customer?.name ||
            !customer?.phone ||
            message?.type !== "text" ||
            !message?.id ||
            !message?.text?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid message data"
            });
        }

        if (Number.isNaN(Date.parse(timestamp))) {
            return res.status(400).json({
                success: false,
                message: "Invalid timestamp"
            });
        }

        // 4. Check duplicate event
        const { data: existingEvent, error: eventCheckError } =
            await supabase
                .from("webhook_events")
                .select("event_id")
                .eq("event_id", event_id)
                .maybeSingle();

        if (eventCheckError) throw eventCheckError;

        if (existingEvent) {
            return res.status(200).json({
                success: true,
                message: "Event already processed"
            });
        }

        // 5. Save or update customer
        const { data: savedCustomer, error: customerError } =
            await supabase
                .from("customers")
                .upsert(
                    {
                        external_customer_id: customer.id,
                        brand_id,
                        name: customer.name,
                        phone: customer.phone
                    },
                    {
                        onConflict: "brand_id,external_customer_id"
                    }
                )
                .select()
                .single();

        if (customerError) throw customerError;

        // 6. Find existing open conversation
        let { data: conversation, error: conversationError } =
            await supabase
                .from("conversations")
                .select("*")
                .eq("customer_id", savedCustomer.id)
                .eq("status", "open")
                .maybeSingle();

        if (conversationError) throw conversationError;

        // 7. Create conversation if needed
        if (!conversation) {
            const { data: newConversation, error } =
                await supabase
                    .from("conversations")
                    .insert({
                        customer_id: savedCustomer.id,
                        status: "open"
                    })
                    .select()
                    .single();

            if (error) throw error;

            conversation = newConversation;
        }

        // 8. Save customer message
        const { data: savedMessage, error: messageError } =
            await supabase
                .from("messages")
                .insert({
                    conversation_id: conversation.id,
                    external_message_id: message.id,
                    sender_type: "customer",
                    message_text: message.text.trim(),
                    created_at: timestamp
                })
                .select()
                .single();

        if (messageError) throw messageError;

        // 9. Generate AI reply with fallback
        let aiReply;
        let aiStatus = "generated";

        try {
            aiReply = await generateAIReply(
                savedMessage.message_text
            );

            console.log("Gemini draft generated successfully");
        } catch (aiError) {
            console.error("Gemini unavailable:", aiError.message);

            aiStatus = "fallback";

            aiReply =
                "Thank you for contacting Verdant & Co. We have received your message. Our support team will review your request and get back to you shortly.";
        }

        // 10. Save AI draft
        const { data: savedDraft, error: draftError } =
            await supabase
                .from("ai_drafts")
                .insert({
                    message_id: savedMessage.id,
                    draft_text: aiReply,
                    status: "pending"
                })
                .select()
                .single();

        if (draftError) throw draftError;

        // 11. Update conversation activity
        const { error: updateError } = await supabase
            .from("conversations")
            .update({
                updated_at: new Date().toISOString()
            })
            .eq("id", conversation.id);

        if (updateError) throw updateError;

        // 12. Mark event as processed
        const { error: saveEventError } = await supabase
            .from("webhook_events")
            .insert({
                event_id
            });

        if (saveEventError) throw saveEventError;

        // 13. Send success response
        return res.status(200).json({
            success: true,
            message: "Customer message and AI draft saved successfully",
            customer_id: savedCustomer.id,
            conversation_id: conversation.id,
            message_id: savedMessage.id,
            draft_id: savedDraft.id,
            ai_status: aiStatus
        });

    } catch (error) {
        console.error("Webhook error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to process customer message"
        });
    }
});

module.exports = router;
