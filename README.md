# Verdant & Co. – AI-Powered Customer Support

## Project Overview
A customer support application where customers can submit messages and agents can review AI-generated reply suggestions, edit them, and approve replies before they are sent.

**Tech Stack:** React.js, Node.js, Express.js, Supabase (PostgreSQL & Authentication), Gemini AI.

## 1. Run Locally

**Prerequisites:** Node.js and npm.

1. Clone the repository:
   ```bash
   git clone https://github.com/softsand00/Verdant-Co_Assignment.git
   cd Verdant-Co_Assignment
   ```

2. Install dependencies:
   ```bash
   cd server
   npm install
   cd ../client
   npm install
   ```

3. Configure environment variables:
   - `server/.env`: `PORT`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `WEBHOOK_SECRET`, `GEMINI_API_KEY`
   - `client/.env`: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

4. Start the backend (from `server`):
   ```bash
   node src/server.js
   ```

5. Start the frontend (from `client`, in another terminal):
   ```bash
   npm run dev
   ```

## 2. Main Decisions and Scope

- Used Supabase PostgreSQL to store customers, conversations, messages, and AI drafts.
- Used a webhook with HMAC signature validation to receive customer messages.
- Used Gemini AI with a knowledge-base prompt to generate suggested replies.
- AI replies remain drafts until an agent edits and approves them.
- Implemented customer and agent views with Supabase authentication for agent sign-in.
- Used a fallback reply when AI generation fails or the API quota is exhausted.

**Not implemented due to time constraints:** Backend API authentication middleware, a production message queue with automatic retries, automated monitoring/alerts, and real WhatsApp integration.

## 3. AI Tool Usage and One Mistake

Used Gemini AI to generate customer support reply suggestions based on the provided knowledge base. AI assistance also helped during development and debugging.

One issue encountered was Gemini API quota exhaustion (HTTP 429). Initially, the retry logic retried quota errors unnecessarily. I corrected it so quota errors immediately use the fallback reply instead of retrying.

## 4. Architecture Questions

**Q1. A customer message arrives at 2 AM, but the system fails. What should the agent see the next morning, and how would they find out?**

The message should be stored in a durable queue or database with a pending/failed status. The agent dashboard should display failed or unprocessed messages, with an indication that AI generation or processing failed. Automatic retries and alerts through email or monitoring tools would notify the team. The agent could then retry processing or respond manually. This is a proposed production improvement.

**Q2. How would you scale this to 20 brands, each with its own knowledge base and agents? What would you change first and why?**

I would first introduce multi-tenant architecture using a unique `brand_id` across customers, conversations, messages, and drafts. Each brand would have its own knowledge base and agent access permissions. The AI service would load the correct brand-specific knowledge base for every request. This would ensure data isolation and make it easier to add more brands without duplicating the application.

---

**Repository:** https://github.com/softsand00/Verdant-Co_Assignment.git
