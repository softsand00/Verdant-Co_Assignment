
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// POST /api/approve-reply/:draftId
router.post("/:draftId", async (req, res) => {
    try {
        const { draftId } = req.params;
        const { reply } = req.body;

        if (!reply || !reply.trim()) {
            return res.status(400).json({
                success: false,
                message: "Reply cannot be empty"
            });
        }

        // 1. Get AI draft
        const { data: draft, error: draftError } = await supabase
            .from("ai_drafts")
            .select("id, message_id, status")
            .eq("id", draftId)
            .single();

        if (draftError) throw draftError;

        if (draft.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "This draft is already approved"
            });
        }

        // 2. Find original customer message
        const { data: originalMessage, error: messageError } =
            await supabase
                .from("messages")
                .select("conversation_id")
                .eq("id", draft.message_id)
                .single();

        if (messageError) throw messageError;

        // 3. Save approved agent reply
        const { data: agentMessage, error: agentError } =
            await supabase
                .from("messages")
                .insert({
                    conversation_id: originalMessage.conversation_id,
                    sender_type: "agent",
                    message_text: reply.trim()
                })
                .select()
                .single();

        if (agentError) throw agentError;

        // 4. Update AI draft
        const { error: updateError } = await supabase
            .from("ai_drafts")
            .update({
                draft_text: reply.trim(),
                status: "approved",
                approved_at: new Date().toISOString()
            })
            .eq("id", draftId);

        if (updateError) throw updateError;

        // 5. Update conversation activity
        const { error: conversationError } = await supabase
            .from("conversations")
            .update({
                updated_at: new Date().toISOString()
            })
            .eq("id", originalMessage.conversation_id);

        if (conversationError) throw conversationError;

        return res.status(200).json({
            success: true,
            message: "Reply approved successfully",
            agent_message: agentMessage
        });

    } catch (error) {
        console.error("Approve reply error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to approve reply"
        });
    }
});

module.exports = router;
