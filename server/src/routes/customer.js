
const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const { generateAIReply } = require("../services/aiService");

// =====================================
// 1. SEND CUSTOMER MESSAGE
// =====================================

router.post("/messages", async (req, res) => {
  try {
    const { name, phone, message } = req.body;

    if (!name || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, phone and message are required",
      });
    }

    const externalCustomerId = phone.trim();

    // Find or create customer
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        {
          external_customer_id: externalCustomerId,
          brand_id: "verdant-co",
          name: name.trim(),
          phone: phone.trim(),
        },
        {
          onConflict: "brand_id,external_customer_id",
        }
      )
      .select()
      .single();

    if (customerError) throw customerError;

    // Find existing open conversation
    let { data: conversation, error: conversationError } =
      await supabase
        .from("conversations")
        .select("*")
        .eq("customer_id", customer.id)
        .eq("status", "open")
        .maybeSingle();

    if (conversationError) throw conversationError;

    // Create conversation if none exists
    if (!conversation) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          customer_id: customer.id,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      conversation = data;
    }

    // Save customer message
    const { data: savedMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_type: "customer",
        message_text: message.trim(),
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // Generate AI draft with fallback
let aiReply;
let isFallback = false;

try {
  aiReply = await generateAIReply(message.trim());

  if (!aiReply || !aiReply.trim()) {
    throw new Error("Gemini returned an empty response");
  }

  console.log("Gemini draft generated successfully");
} catch (aiError) {
  console.error("Gemini error:", aiError.message);

  isFallback = true;

  aiReply =
    "Thank you for contacting Verdant & Co. We have received your message. Our support team will review your request and get back to you shortly.";
}

// Save AI or fallback draft
const { data: savedDraft, error: draftError } = await supabase
  .from("ai_drafts")
  .insert({
    message_id: savedMessage.id,
    draft_text: aiReply,
    status: "pending",
  })
  .select()
  .single();

if (draftError) {
  console.error("AI draft database error:", draftError);
  throw draftError;
}

console.log("AI draft saved successfully:", savedDraft.id);
    // Update conversation time
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);

    if (updateError) throw updateError;

    // Send success response
    return res.status(201).json({
      success: true,
      message: "Your message has been sent successfully",
      aiStatus: isFallback ? "fallback" : "generated",
    });

  } catch (error) {
    console.error("Customer message error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to send message",
    });
  }
});


// =====================================
// 2. FETCH CUSTOMER MESSAGES
// =====================================

router.get("/:customerId/messages", async (req, res) => {
  try {
    const { data: conversation, error: conversationError } =
      await supabase
        .from("conversations")
        .select("id")
        .eq("customer_id", req.params.customerId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (conversationError) throw conversationError;

    if (!conversation) {
      return res.status(200).json({
        success: true,
        messages: [],
      });
    }

    // Fetch customer messages and agent replies only.
    // AI drafts are not selected.
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id,sender_type,message_text,created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    return res.status(200).json({
      success: true,
      messages,
    });

  } catch (error) {
    console.error("Customer fetch error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch messages",
    });
  }
});

module.exports = router;
