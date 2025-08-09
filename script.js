document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("user-input");
  const chatLog = document.getElementById("chat-box");
  const scrollBtn = document.getElementById("scroll-btn");
  const newChatBtn = document.getElementById("new-chat-btn");
  const conversationList = document.getElementById("conversation-list");

  let conversation = [];
  let currentId = null;
  let firstMessage = "";

  // ===== Onboarding =====
  // Trigger onboarding on CTA click
  const startForgeBtn = document.getElementById("start-forge-btn");
  startForgeBtn?.addEventListener("click", () => {
    open(onboardingModal);
  });

  const onboardingModal = document.getElementById("onboardingModal");
  const paywallModal = document.getElementById("paywallModal");
  const emailModal = document.getElementById("emailModal");
  const startBtn = document.getElementById("vb_start");
  const unlockBtn = document.getElementById("vb_unlock");
  const pdfBtn = document.getElementById("vb_pdf");
  const emailSendBtn = document.getElementById("vb_email_send");
  const emailCancelBtn = document.getElementById("vb_email_cancel");

  let paid = false;

  const forgeBtn = document.getElementById("forge-btn");
  forgeBtn?.addEventListener("click", () => open(onboardingModal));
  let userMsgCount = 0;
  let sentIntroContext = false;

  function getUserProfile() {
    try {
      return JSON.parse(localStorage.getItem("valoranUser") || "null");
    } catch(e){ return null; }
  }
  function saveUserProfile(profile) {
    localStorage.setItem("valoranUser", JSON.stringify(profile));
  }
  function open(el){ el.classList.remove("hidden"); }
  function close(el){ el.classList.add("hidden"); }

  
  startBtn?.addEventListener("click", () => {
    const profile = {
      name: document.getElementById("vb_name").value.trim(),
      age: document.getElementById("vb_age").value.trim(),
      goal: document.getElementById("vb_goal").value,
      challenge: document.getElementById("vb_challenge").value.trim(),
      time: document.getElementById("vb_time").value.trim(),
      email: document.getElementById("vb_email").value.trim()
    };
    saveUserProfile(profile);
    close(onboardingModal);
    // Seed a welcome line in UI (optional, not sent to model)
    addMessage("bot", `Dobrodošel, ${profile.name || "legenda"}. Cilj: ${profile.goal}. Gremo.`);
  });

  // Paywall demo handlers
  unlockBtn?.addEventListener("click", () => {
    paid = true;
    close(paywallModal);
    addMessage("bot", "✅ Dostop odklepjen (demo). Nadaljujeva.");
  });
  pdfBtn?.addEventListener("click", () => {
    close(paywallModal);
    open(emailModal);
  });
  emailCancelBtn?.addEventListener("click", () => close(emailModal));
  emailSendBtn?.addEventListener("click", () => {
    const email = document.getElementById("vb_email_capture").value.trim();
    if (email) {
      const profile = getUserProfile() || {};
      profile.email = email;
      saveUserProfile(profile);
      close(emailModal);
      addMessage("bot", "📩 Poslano (demo): D1 PDF na tvoj email.");
    }
  });


  // NALOŽI SHRANJENE POGOVORE
  function loadConversations() {
    conversationList.innerHTML = "";
    const all = JSON.parse(localStorage.getItem("valoransave") || "{}");
    Object.entries(all).forEach(([id, data]) => {
      const li = document.createElement("li");
      li.textContent = data.title || "Pogovor";
      li.addEventListener("click", () => {
        loadConversation(id, data.messages);
      });
      conversationList.appendChild(li);
    });
  }

  // SHRANI AKTUALNI POGOVOR
  function saveConversation() {
    if (!firstMessage.trim()) return;
    const all = JSON.parse(localStorage.getItem("valoransave") || "{}");
    all[currentId] = {
      title: firstMessage.length > 50 ? firstMessage.slice(0, 50) + "..." : firstMessage,
      messages: conversation
    };
    localStorage.setItem("valoransave", JSON.stringify(all));
    loadConversations();
  }

  // NALOŽI STARI POGOVOR
  function loadConversation(id, messages) {
    currentId = id;
    conversation = [...messages];
    chatLog.innerHTML = "";
    messages.forEach((msg) => {
      addMessage(msg.role === "user" ? "user" : "bot", msg.content);
    });
  }

  // ZAČNI NOV POGOVOR
  newChatBtn.addEventListener("click", () => {
    conversation = [];
    currentId = crypto.randomUUID();
    chatLog.innerHTML = "";
    firstMessage = "";
  });

  // POŠLJI VPRAŠANJE
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    if (!currentId) currentId = crypto.randomUUID();
    if (!firstMessage) firstMessage = message;

    addMessage("user", message);
    let augmented = message;
    if (!sentIntroContext) {
      const p = getUserProfile();
      if (p) {
        const ctx = `\n[KONTEKST]\nIme: ${p.name||""}\nStarost: ${p.age||""}\nCilj: ${p.goal||""}\nIzziv: ${p.challenge||""}\nČas/dan: ${p.time||""} min\n`; 
        augmented = ctx + message;
      }
      sentIntroContext = true;
    }
    conversation.push({ role: "user", content: augmented });
    input.value = "";
    input.focus();
    userMsgCount++;
    if (userMsgCount >= 3 && !paid) {
      open(paywallModal);
      return;
    }


    const botElement = addMessage("bot", "Valoran piše");
    botElement.classList.add("typing");

    try {
      const response = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation })
      });

      if (!response.ok || !response.body) {
        botElement.textContent = "Napaka pri povezavi z AI.";
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let botMsg = "";
      botElement.classList.remove("typing");
      botElement.textContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        botMsg += chunk;
        botElement.textContent = botMsg;
        chatLog.scrollTop = chatLog.scrollHeight;
      }

      conversation.push({ role: "assistant", content: botMsg });
      saveConversation();

    } catch (err) {
      botElement.textContent = "Prišlo je do napake. Poskusi znova.";
      console.error(err);
    }
  });

  // ENTER = POŠLJI, SHIFT+ENTER = NOVA VRSTICA
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event("submit"));
    }
  });

  // SCROLL GUMB
  window.addEventListener("scroll", () => {
    scrollBtn.style.display = window.scrollY > 100 ? "block" : "none";
  });

  scrollBtn.addEventListener("click", () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });

  // DODAJ SPOROČILO V UI
  function addMessage(role, text) {
    const div = document.createElement("div");
    const roleClass = role === "user" ? "user-msg" : "bot-msg";
    div.className = `${roleClass} fade-in`;
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    return div;
  }

  // OB ZAGONU
  loadConversations();
});


