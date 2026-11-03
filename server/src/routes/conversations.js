
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// GET /api/conversations
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("conversations")
            .select(`
                id,
                status,
                created_at,
                updated_at,
                customers (
                    id,
                    name,
                    phone
                ),
                messages (
                    id,
                    sender_type,
                    message_text,
                    created_at,
                    ai_drafts (
                        id,
                        draft_text,
                        status
                    )
                )
            `)
            .order("updated_at", { ascending: false });

        if (error) throw error;

        return res.status(200).json({
            success: true,
            conversations: data
        });

    } catch (error) {
        console.error("Fetch conversations error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch conversations"
        });
    }
});

module.exports = router;
