
import React, { useEffect, useState } from "react";
import "./App.css";
import supabase from "./supabaseClient";

const API_URL = "http://localhost:5000";

function App() {
  const [view, setView] = useState("customer");

  // Agent authentication states
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Agent dashboard states
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [editedReplies, setEditedReplies] = useState({});
  const [agentMessage, setAgentMessage] = useState("");

  // Customer states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerMessages, setCustomerMessages] = useState([]);
  const [customerText, setCustomerText] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Check existing agent session
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session error:", error);
      }

      setSession(data?.session || null);
      setAuthLoading(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Agent login
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setLoginLoading(true);
      setLoginError("");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      setSession(data.session);
      setPassword("");
      setAgentMessage("Login successful!");
    } catch (error) {
      console.error("Login error:", error);
      setLoginError(error.message || "Unable to login.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Agent logout
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAgentMessage(error.message);
      return;
    }

    setSession(null);
    setView("customer");
    setPassword("");
    setConversations([]);
    setSelectedConversation(null);
    setAgentMessage("");
  };

  // Fetch agent conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/conversations`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to fetch conversations");
      }

      const data = result.conversations || [];
      setConversations(data);

      if (data.length > 0) {
        setSelectedConversation((previous) =>
          data.find((item) => item.id === previous?.id) || data[0]
        );
      } else {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error("Conversation error:", error);
      setAgentMessage("Unable to load conversations.");
    }
  };

  // Load conversations only after agent login
  useEffect(() => {
    if (view === "agent" && session) {
      fetchConversations();
    }
  }, [view, session]);

  // Fetch customer chat history
  const fetchCustomerMessages = async (id) => {
    try {
      const response = await fetch(
        `${API_URL}/api/customer/${id}/messages`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      setCustomerMessages(result.messages || []);
    } catch (error) {
      console.error(error);
      setCustomerMessage("Unable to load your messages.");
    }
  };

  // Send customer message
  const sendCustomerMessage = async (e) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim() || !customerText.trim()) {
      setCustomerMessage("Please enter your name, phone and message.");
      return;
    }

    try {
      setLoading(true);
      setCustomerMessage("");

      const response = await fetch(`${API_URL}/api/customer/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          message: customerText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Message could not be sent");
      }

      setCustomerText("");
      setCustomerMessage(
        "Message sent successfully! Our team will respond soon."
      );

      // Find customer ID for loading chat history
      const conversationsResponse = await fetch(
        `${API_URL}/api/conversations`
      );

      const conversationsResult = await conversationsResponse.json();

      const customerConversation =
        conversationsResult.conversations?.find(
          (item) => item.customers?.phone === phone.trim()
        );

      if (customerConversation) {
        setCustomerId(customerConversation.customers.id);
        await fetchCustomerMessages(customerConversation.customers.id);
      }
    } catch (error) {
      console.error(error);
      setCustomerMessage(error.message || "Unable to send message.");
    } finally {
      setLoading(false);
    }
  };

  // Approve edited AI reply
  const approveReply = async (draftId, reply) => {
    try {
      setAgentMessage("");

      const response = await fetch(
        `${API_URL}/api/approve-reply/${draftId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reply }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Approval failed");
      }

      setAgentMessage("Reply approved successfully!");

      await fetchConversations();

      if (customerId) {
        await fetchCustomerMessages(customerId);
      }
    } catch (error) {
      console.error(error);
      setAgentMessage(error.message || "Unable to approve reply.");
    }
  };

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="dashboard-header">
        <div>
          <h1>Verdant & Co.</h1>
          <p>Customer Support Portal</p>
        </div>

        <div className="view-toggle">
          <button
            className={view === "customer" ? "selected" : ""}
            onClick={() => setView("customer")}
          >
            Customer View
          </button>

          <button
            className={view === "agent" ? "selected" : ""}
            onClick={() => {
              setView("agent");
              setLoginError("");
              setAgentMessage("");
            }}
          >
            Agent View
          </button>
        </div>
      </header>

      {/* CUSTOMER VIEW */}
      {view === "customer" && (
        <main className="customer-page">
          <div className="customer-card">
            <h2>How can we help you?</h2>
            <p>
              Send your message to the Verdant & Co. support team.
            </p>

            <form onSubmit={sendCustomerMessage}>
              <label>Your Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <label>Phone Number</label>
              <input
                type="tel"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              <label>Your Message</label>
              <textarea
                placeholder="Type your message..."
                value={customerText}
                onChange={(e) => setCustomerText(e.target.value)}
                required
              />

              <button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>

            {customerMessage && (
              <p className="notice">{customerMessage}</p>
            )}
          </div>

          {customerId && (
            <div className="customer-card chat-history">
              <h2>Your Conversation</h2>

              {customerMessages.map((item) => (
                <div
                  key={item.id}
                  className={`message ${
                    item.sender_type === "agent"
                      ? "agent-message"
                      : "customer-message"
                  }`}
                >
                  <strong>
                    {item.sender_type === "customer"
                      ? "You"
                      : "Support Team"}
                  </strong>
                  <p>{item.message_text}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* AGENT VIEW */}
      {view === "agent" && (
        authLoading ? (
          <main className="customer-page">
            <p>Checking agent login...</p>
          </main>
        ) : !session ? (
          <main className="customer-page">
            <div className="customer-card">
              <h2>Agent Login</h2>
              <p>Sign in to access the support dashboard.</p>

              <form onSubmit={handleLogin}>
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter agent email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button type="submit" disabled={loginLoading}>
                  {loginLoading ? "Logging in..." : "Login"}
                </button>
              </form>

              {loginError && (
                <p className="notice">{loginError}</p>
              )}
            </div>
          </main>
        ) : (
          <main className="dashboard">
            <aside className="sidebar">
              <div className="sidebar-heading">
                <h2>Conversations</h2>
                <button onClick={fetchConversations}>Refresh</button>
              </div>
               
             
              <p>Logged in: {session.user.email}</p>
    <div className="sidebar-heading-2"><button onClick={handleLogout}>Logout</button></div>
              



              {conversations.length === 0 && (
                <p>No conversations available.</p>
              )}

              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`customer-item ${
                    selectedConversation?.id === conversation.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <h3>
                    {conversation.customers?.name || "Customer"}
                  </h3>
                  <p>{conversation.customers?.phone || ""}</p>
                  <span>{conversation.status}</span>
                </div>
              ))}
            </aside>

            <section className="chat-section">
              {agentMessage && (
                <p className="notice">{agentMessage}</p>
              )}

              {selectedConversation ? (
                <>
                  <div className="chat-header">
                    <h2>{selectedConversation.customers?.name}</h2>
                    <p>{selectedConversation.customers?.phone}</p>
                  </div>

                  {selectedConversation.messages?.map((item) => {
                    const draft = item.ai_drafts;

                    return (
                      <div className="message-card" key={item.id}>
                        <div
                          className={`message ${
                            item.sender_type === "agent"
                              ? "agent-message"
                              : "customer-message"
                          }`}
                        >
                          <strong>
                            {item.sender_type === "customer"
                              ? "Customer"
                              : "Agent"}
                          </strong>
                          <p>{item.message_text}</p>
                        </div>

                        {draft && (
                          <div className="ai-draft">
                            <h4>AI Suggested Reply</h4>

                            {draft.status === "pending" ? (
                              <>
                                <textarea
                                  value={
                                    editedReplies[draft.id] ??
                                    draft.draft_text
                                  }
                                  onChange={(e) =>
                                    setEditedReplies((previous) => ({
                                      ...previous,
                                      [draft.id]: e.target.value,
                                    }))
                                  }
                                />

                                <button
                                  onClick={() =>
                                    approveReply(
                                      draft.id,
                                      editedReplies[draft.id] ??
                                        draft.draft_text
                                    )
                                  }
                                >
                                  Approve Reply
                                </button>
                              </>
                            ) : (
                              <>
                                <p>{draft.draft_text}</p>
                                <span className="approved-label">
                                  Approved
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="empty-state">
                  <h2>No conversation selected</h2>
                  <p>Select a customer to view messages.</p>
                </div>
              )}
            </section>
          </main>
        )
      )}
    </div>
  );
}

export default App;
