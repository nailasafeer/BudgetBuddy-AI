// BudgetBuddy AI — Assistant Page Logic

function addChatBubble(text, sender) {
  const log = document.getElementById("chat-log");
  const bubble = document.createElement("div");

  bubble.className = `chat-bubble ${sender}`;
  bubble.textContent = cleanChatText(text);

  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}


async function loadChatHistory() {
  try {
    const response = await fetch(
      `${API_BASE}/api/chat/history`,
      {
        method: "GET",
        headers: authHeaders()
      }
    );

    const data = await response.json();

    if (response.status === 401 || response.status === 422) {
      redirectToLogin();
      return;
    }

    if (!response.ok) {
      throw new Error(
        data.error || data.msg || "Could not load chat history"
      );
    }

    const chatLog = document.getElementById("chat-log");
    chatLog.innerHTML = "";

    (data.messages || []).forEach(message => {
      const sender =
        message.role === "assistant" ? "bot" : "user";

      addChatBubble(message.content, sender);
    });
  } catch (error) {
    console.error("Chat history error:", error);
  }
}


async function sendChat() {
  const input = document.getElementById("chat-input");
  const sendButton = document.getElementById("chat-send");
  const question = input.value.trim();

  if (!question) return;
  if (sendButton.disabled) return;

  addChatBubble(question, "user");
  input.value = "";
  sendButton.disabled = true;

  try {
    const response = await fetch(
      `${API_BASE}/api/chat`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ question })
      }
    );

    const data = await response.json();

    if (response.status === 401 || response.status === 422) {
      localStorage.removeItem("budgetbuddy_token");
      window.location.href = "login.html";
      return;
    }

    if (!response.ok) {
      addChatBubble(
        data.error || data.msg || "Could not get an answer",
        "bot"
      );
      return;
    }

    addChatBubble(data.answer, "bot");
  } catch (error) {
    console.error("Chat error:", error);
    addChatBubble(
      "Cannot connect to the backend server.",
      "bot"
    );
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}


document
  .getElementById("chat-send")
  .addEventListener("click", (event) => {
    event.preventDefault();
    sendChat();
  });


document
  .getElementById("chat-input")
  .addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendChat();
    }
  });


document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.getElementById("chat-input").value =
      chip.textContent.replace(/^\S+\s/, "");

    sendChat();
  });
});


loadChatHistory();


function cleanChatText(text) {
  if (!text) return "";

  return String(text)
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\|[-:\s|]+\|/g, "")
    .replace(/\|/g, " ")
    .replace(/-{3,}/g, "")
    .replace(/\s+-\s+/g, ". ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}