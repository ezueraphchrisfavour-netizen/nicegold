const token = localStorage.getItem("nicegold_token");

if (!token) {
  window.location.href = "/";
}

const state = {
  user: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  searchTimer: null,
  socket: null,
  replyTo: null,
  swipe: null
};

const $ = id => document.getElementById(id);

const chatLoader = $("chatLoader");
const profileAvatar = $("profileAvatar");
const profileName = $("profileName");
const profileUsername = $("profileUsername");
const profileOnline = $("profileOnline");

const conversationList = $("conversationList");
const conversationEmpty = $("conversationEmpty");
const conversationCount = $("conversationCount");
const conversationSearch = $("conversationSearch");

const newChatButton = $("newChatButton");
const welcomeNewChat = $("welcomeNewChat");
const newChatModal = $("newChatModal");
const closeNewChat = $("closeNewChat");
const userSearchInput = $("userSearchInput");
const userSearchResults = $("userSearchResults");

const activeAvatar = $("activeAvatar");
const activeName = $("activeName");
const activeUsername = $("activeUsername");
const activeStatus = $("activeStatus");
const activeOnline = $("activeOnline");

const messagesArea = $("messagesArea");
const welcomeChat = $("welcomeChat");

const replyBar = $("replyBar");
const replyBarTitle = $("replyBarTitle");
const replyBarText = $("replyBarText");
const cancelReplyButton = $("cancelReplyButton");

const typingIndicator = $("typingIndicator");

const messageInput = $("messageInput");
const sendButton = $("sendButton");
const attachmentButton = $("attachmentButton");
const voiceButton = $("voiceButton");

const logoutButton = $("logoutButton");
const mobileBackButton = $("mobileBackButton");


/* =========================
   API
========================= */

async function api(url, options = {}) {

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {
      ok: false,
      error: "Invalid server response."
    };
  }

  if (response.status === 401) {
    localStorage.removeItem("nicegold_token");
    localStorage.removeItem("nicegold_user");
    window.location.href = "/";
    return null;
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "Request failed."
    );
  }

  return data;
}


/* =========================
   AVATAR
========================= */

function avatarFallback(name = "?") {

  const letter =
    String(name)
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  return (
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg"
           width="200"
           height="200"
           viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#252525"/>
        <circle cx="100" cy="100" r="100" fill="#202020"/>
        <text x="100"
              y="122"
              text-anchor="middle"
              font-size="82"
              font-family="Arial"
              font-weight="700"
              fill="#eeeeee">${letter}</text>
      </svg>
    `)
  );
}

function setAvatar(element, user) {

  if (!element) return;

  const fallback = avatarFallback(
    user?.displayName ||
    user?.username ||
    "?"
  );

  element.src =
    user?.avatar ||
    fallback;

  element.onerror = () => {
    element.onerror = null;
    element.src = fallback;
  };
}


/* =========================
   SOCKET.IO
========================= */

function connectSocket() {

  if (typeof io !== "function") {
    console.warn("Socket.IO unavailable.");
    return;
  }

  state.socket = io({
    auth: { token }
  });

  state.socket.on("connect", () => {

    console.log(
      "NICEGOLD CHAT realtime connected."
    );

    if (state.activeConversation) {
      joinConversationRoom(
        state.activeConversation.id
      );
    }
  });

  state.socket.on("disconnect", () => {
    console.log(
      "NICEGOLD CHAT realtime disconnected."
    );
  });

  state.socket.on(
    "message:new",
    message => {
      receiveRealtimeMessage(message);
    }
  );

  state.socket.on(
    "message:notification",
    payload => {

      const message =
        payload?.message;

      if (!message) return;

      receiveRealtimeMessage(message);
    }
  );

  state.socket.on(
    "message:read",
    payload => {

      if (!payload) return;

      const message =
        state.messages.find(
          item =>
            item.id === payload.messageId
        );

      if (!message) return;

      if (!Array.isArray(message.readBy)) {
        message.readBy = [];
      }

      const readerId =
        payload.userId ||
        payload.readerId;

      if (
        readerId &&
        !message.readBy.includes(readerId)
      ) {
        message.readBy.push(readerId);
        renderMessages(false);
      }
    }
  );

  state.socket.on(
    "typing:start",
    payload => {

      if (
        payload?.conversationId ===
        state.activeConversation?.id &&
        payload.userId !==
        state.user?.id
      ) {
        showTyping();
      }
    }
  );

  state.socket.on(
    "typing:stop",
    payload => {

      if (
        payload?.conversationId ===
        state.activeConversation?.id
      ) {
        hideTyping();
      }
    }
  );
}

function joinConversationRoom(id) {

  if (
    !state.socket ||
    !state.socket.connected ||
    !id
  ) {
    return;
  }

  state.socket.emit(
    "conversation:join",
    id
  );
}


/* =========================
   PROFILE
========================= */

async function loadProfile() {

  const data =
    await api("/api/auth/me");

  if (!data) return;

  state.user = data.user;

  localStorage.setItem(
    "nicegold_user",
    JSON.stringify(state.user)
  );

  profileName.textContent =
    state.user.displayName ||
    state.user.username;

  profileUsername.textContent =
    `@${state.user.username}`;

  setAvatar(
    profileAvatar,
    state.user
  );

  profileOnline.style.display =
    state.user.online
      ? "block"
      : "none";
}


/* =========================
   CONVERSATIONS
========================= */

async function loadConversations() {

  try {

    const data =
      await api("/api/conversations");

    if (!data) return;

    state.conversations =
      data.conversations || [];

    renderConversations();

  } catch (error) {

    console.error(
      "Conversation load error:",
      error
    );
  }
}

function renderConversations() {

  conversationList.innerHTML = "";

  conversationCount.textContent =
    state.conversations.length;

  if (!state.conversations.length) {

    conversationList.appendChild(
      conversationEmpty
    );

    return;
  }

  state.conversations.forEach(
    conversation => {

      const user =
        conversation.user;

      if (!user) return;

      const item =
        document.createElement("button");

      item.type = "button";
      item.className = "conversation-item";

      if (
        state.activeConversation?.id ===
        conversation.id
      ) {
        item.classList.add("active");
      }

      const avatarWrap =
        document.createElement("div");

      avatarWrap.className =
        "conversation-avatar";

      const avatar =
        document.createElement("img");

      avatar.className =
        "avatar-conversation";

      setAvatar(
        avatar,
        user
      );

      const online =
        document.createElement("span");

      online.className =
        "online-dot conversation-online";

      online.style.display =
        user.online
          ? "block"
          : "none";

      avatarWrap.appendChild(avatar);
      avatarWrap.appendChild(online);

      const details =
        document.createElement("div");

      details.className =
        "conversation-details";

      const name =
        document.createElement("strong");

      name.textContent =
        user.displayName ||
        user.username;

      const preview =
        document.createElement("span");

      if (conversation.lastMessage) {

        const last =
          conversation.lastMessage;

        preview.textContent =
          last.text ||
          (
            last.type === "image"
              ? "📷 Image"
              : "Message"
          );

      } else {

        preview.textContent =
          "Start chatting";
      }

      details.appendChild(name);
      details.appendChild(preview);

      item.appendChild(avatarWrap);
      item.appendChild(details);

      item.addEventListener(
        "click",
        () => openConversation(conversation)
      );

      conversationList.appendChild(item);
    }
  );
}


/* =========================
   OPEN CONVERSATION
========================= */

async function openConversation(conversation) {

  if (!conversation?.user) return;

  state.activeConversation =
    conversation;

  state.messages = [];
  clearReply();

  const user =
    conversation.user;

  activeName.textContent =
    user.displayName ||
    user.username;

  activeUsername.textContent =
    `@${user.username}`;

  activeStatus.textContent =
    user.online
      ? "online"
      : formatLastSeen(
          user.lastSeen
        );

  activeOnline.style.display =
    user.online
      ? "block"
      : "none";

  setAvatar(
    activeAvatar,
    user
  );

  document.body.classList.add(
    "chat-open"
  );

  joinConversationRoom(
    conversation.id
  );

  messagesArea.innerHTML = `
    <div class="message-empty">
      <div class="small-spinner"></div>
      <span>Loading messages...</span>
    </div>
  `;

  await loadMessages(
    conversation.id
  );

  renderConversations();

  setTimeout(
    () => messageInput.focus(),
    100
  );
}


/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages(conversationId) {

  try {

    const data =
      await api(
        `/api/conversations/${encodeURIComponent(
          conversationId
        )}/messages`
      );

    if (!data) return;

    state.messages =
      data.messages || [];

    renderMessages(false);

    state.messages.forEach(
      markMessageRead
    );

  } catch (error) {

    console.error(
      "Message load error:",
      error
    );

    showMessageError(
      error.message
    );
  }
}


/* =========================
   MESSAGE RENDERING
========================= */

function renderMessages(
  animateLatest = false
) {

  if (!messagesArea) return;

  const shouldStick =
    isNearBottom();

  messagesArea.innerHTML = "";

  if (!state.messages.length) {

    messagesArea.innerHTML = `
      <div class="message-empty">
        <div class="message-empty-icon">💬</div>
        <strong>No messages yet</strong>
        <span>Send a message to start the conversation.</span>
      </div>
    `;

    return;
  }

  const list =
    document.createElement("div");

  list.className =
    "message-list";

  state.messages.forEach(
    (message, index) => {

      list.appendChild(
        createMessageElement(
          message,
          animateLatest &&
          index ===
          state.messages.length - 1
        )
      );
    }
  );

  messagesArea.appendChild(list);

  requestAnimationFrame(() => {

    if (shouldStick || animateLatest) {
      messagesArea.scrollTop =
        messagesArea.scrollHeight;
    }
  });
}

function createMessageElement(
  message,
  animate = false
) {

  const mine =
    message.senderId ===
    state.user?.id;

  const row =
    document.createElement("div");

  row.className =
    mine
      ? "message-row message-row-sent"
      : "message-row message-row-received";

  const bubble =
    document.createElement("div");

  bubble.className =
    mine
      ? "message-bubble message-bubble-sent"
      : "message-bubble message-bubble-received";

  bubble.dataset.messageId =
    message.id;

  if (animate) {
    bubble.classList.add("message-pop");
  }

  if (message.deleted) {
    bubble.classList.add("message-deleted");
  }

  const replyIcon =
    document.createElement("div");

  replyIcon.className =
    "swipe-reply-icon";

  replyIcon.textContent = "↩";

  bubble.appendChild(
    replyIcon
  );


  /* ORIGINAL REPLY */

  if (message.replyTo) {

    const original =
      findReplyMessage(
        message.replyTo
      );

    const preview =
      document.createElement("div");

    preview.className =
      "message-reply-preview";

    const title =
      document.createElement("strong");

    title.textContent =
      original?.senderId === state.user?.id
        ? "You"
        : (
            state.activeConversation?.user
              ?.displayName ||
            "Message"
          );

    const originalText =
      document.createElement("span");

    originalText.textContent =
      original?.text ||
      "Original message";

    preview.appendChild(title);
    preview.appendChild(originalText);

    bubble.appendChild(preview);
  }


  /* TEXT */

  const text =
    document.createElement("div");

  text.className =
    "message-text";

  text.textContent =
    message.deleted
      ? "Message deleted"
      : (
          message.text ||
          (
            message.type === "image"
              ? "📷 Image"
              : "Message"
          )
        );

  bubble.appendChild(text);


  /* META */

  const meta =
    document.createElement("div");

  meta.className =
    "message-meta";

  const time =
    document.createElement("span");

  time.className =
    "message-time";

  time.textContent =
    formatMessageTime(
      message.createdAt
    );

  meta.appendChild(time);

  if (mine) {

    const ticks =
      document.createElement("span");

    ticks.className =
      "message-ticks";

    ticks.textContent =
      getMessageTicks(message);

    meta.appendChild(ticks);
  }

  bubble.appendChild(meta);

  row.appendChild(bubble);

  attachSwipeReply(
    bubble,
    message
  );

  bubble.addEventListener(
    "dblclick",
    () => prepareReply(message)
  );

  return row;
}

function findReplyMessage(replyId) {

  if (!replyId) return null;

  return state.messages.find(
    message =>
      message.id === replyId
  );
}

function getMessageTicks(message) {

  if (
    Array.isArray(message.readBy)
  ) {

    const readByOther =
      message.readBy.some(
        id =>
          id !== state.user?.id
      );

    if (readByOther) {
      return "✓✓";
    }
  }

  return "✓";
}


/* =========================
   SWIPE TO REPLY
========================= */

function attachSwipeReply(
  bubble,
  message
) {

  let startX = 0;
  let startY = 0;
  let dragging = false;
  let currentX = 0;

  const threshold = 70;
  const maxSwipe = 105;

  function start(event) {

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    startX = event.clientX;
    startY = event.clientY;
    currentX = 0;
    dragging = true;

    bubble.style.transition =
      "none";

    try {
      bubble.setPointerCapture(
        event.pointerId
      );
    } catch {}
  }

  function move(event) {

    if (!dragging) return;

    const dx =
      event.clientX - startX;

    const dy =
      event.clientY - startY;

    if (
      Math.abs(dy) >
      Math.abs(dx) &&
      Math.abs(dy) > 12
    ) {
      dragging = false;
      bubble.style.transform = "";
      bubble.style.transition = "";
      return;
    }

    if (dx <= 0) return;

    currentX =
      Math.min(
        dx,
        maxSwipe
      );

    bubble.style.transform =
      `translateX(${currentX}px)`;

    const icon =
      bubble.querySelector(
        ".swipe-reply-icon"
      );

    if (icon) {
      icon.style.opacity =
        Math.min(
          currentX / threshold,
          1
        );
    }
  }

  function end() {

    if (!dragging) return;

    dragging = false;

    const icon =
      bubble.querySelector(
        ".swipe-reply-icon"
      );

    if (
      currentX >= threshold
    ) {
      prepareReply(message);
    }

    bubble.style.transform = "";
    bubble.style.transition =
      "transform .15s ease";

    if (icon) {
      icon.style.opacity = "0";
    }

    currentX = 0;
  }

  bubble.addEventListener(
    "pointerdown",
    start
  );

  bubble.addEventListener(
    "pointermove",
    move
  );

  bubble.addEventListener(
    "pointerup",
    end
  );

  bubble.addEventListener(
    "pointercancel",
    end
  );
}


/* =========================
   REPLY
========================= */

function prepareReply(message) {

  if (!message) return;

  state.replyTo = message;

  replyBar.classList.remove(
    "hidden"
  );

  replyBarTitle.textContent =
    message.senderId === state.user?.id
      ? "Replying to yourself"
      : `Replying to ${
          state.activeConversation?.user
            ?.displayName ||
          "message"
        }`;

  replyBarText.textContent =
    message.text ||
    (
      message.type === "image"
        ? "📷 Image"
        : "Message"
    );

  messageInput.focus();
}

function clearReply() {

  state.replyTo = null;

  replyBar.classList.add(
    "hidden"
  );

  replyBarTitle.textContent =
    "Replying";

  replyBarText.textContent =
    "";
}


/* =========================
   REALTIME
========================= */

function receiveRealtimeMessage(message) {

  if (!message) return;

  if (
    state.activeConversation &&
    message.conversationId ===
    state.activeConversation.id
  ) {

    const exists =
      state.messages.some(
        item =>
          item.id === message.id
      );

    if (!exists) {

      state.messages.push(
        message
      );

      renderMessages(true);

      markMessageRead(message);
    }

  } else {

    refreshConversationList();
  }

  refreshConversationList();
}

async function refreshConversationList() {

  try {
    await loadConversations();
  } catch {}
}


/* =========================
   READ RECEIPTS
========================= */

function markMessageRead(message) {

  if (
    !state.socket ||
    !state.socket.connected ||
    !message?.id ||
    message.senderId ===
    state.user?.id
  ) {
    return;
  }

  state.socket.emit(
    "message:read",
    {
      messageId: message.id
    }
  );
}


/* =========================
   SEND
========================= */

async function sendMessage() {

  if (!state.activeConversation) {
    return;
  }

  const text =
    messageInput.value.trim();

  if (!text) return;

  if (text.length > 5000) {
    alert(
      "Message cannot exceed 5000 characters."
    );
    return;
  }

  sendButton.disabled = true;

  try {

    const body = {
      text,
      type: "text"
    };

    if (state.replyTo?.id) {
      body.replyTo =
        state.replyTo.id;
    }

    const data =
      await api(
        `/api/conversations/${encodeURIComponent(
          state.activeConversation.id
        )}/messages`,
        {
          method: "POST",
          body: JSON.stringify(body)
        }
      );

    if (!data) return;

    if (data.message) {

      const exists =
        state.messages.some(
          item =>
            item.id ===
            data.message.id
        );

      if (!exists) {

        state.messages.push(
          data.message
        );

        renderMessages(true);
      }
    }

    messageInput.value = "";

    clearReply();

    autoResizeTextarea();

    stopTyping();

    await refreshConversationList();

  } catch (error) {

    console.error(
      "Send message error:",
      error
    );

    alert(
      error.message ||
      "Unable to send message."
    );

  } finally {

    sendButton.disabled =
      false;

    messageInput.focus();
  }
}


/* =========================
   TYPING
========================= */

let typingTimer = null;

function showTyping() {
  typingIndicator.classList.remove(
    "hidden"
  );
  typingIndicator.style.display =
    "flex";
}

function hideTyping() {
  typingIndicator.classList.add(
    "hidden"
  );
  typingIndicator.style.display =
    "";
}

function sendTyping() {

  if (
    !state.socket ||
    !state.socket.connected ||
    !state.activeConversation
  ) {
    return;
  }

  state.socket.emit(
    "typing:start",
    {
      conversationId:
        state.activeConversation.id
    }
  );

  clearTimeout(typingTimer);

  typingTimer =
    setTimeout(
      stopTyping,
      1200
    );
}

function stopTyping() {

  clearTimeout(
    typingTimer
  );

  if (
    !state.socket ||
    !state.socket.connected ||
    !state.activeConversation
  ) {
    return;
  }

  state.socket.emit(
    "typing:stop",
    {
      conversationId:
        state.activeConversation.id
    }
  );
}


/* =========================
   NEW CHAT
========================= */

function openNewChat() {

  newChatModal.hidden =
    false;

  userSearchInput.value =
    "";

  userSearchResults.innerHTML = `
    <div class="search-placeholder">
      <span>👤</span>
      <p>Search for someone to chat with.</p>
    </div>
  `;

  setTimeout(
    () =>
      userSearchInput.focus(),
    80
  );
}

function closeNewChatModal() {
  newChatModal.hidden = true;
}


/* =========================
   USER SEARCH
========================= */

async function searchUsers(query) {

  const cleanQuery =
    query.trim();

  if (!cleanQuery) {

    userSearchResults.innerHTML = `
      <div class="search-placeholder">
        <span>👤</span>
        <p>Search for someone to chat with.</p>
      </div>
    `;

    return;
  }

  userSearchResults.innerHTML = `
    <div class="search-loading">
      <div class="small-spinner"></div>
      <span>Searching...</span>
    </div>
  `;

  try {

    const data =
      await api(
        `/api/users/search?q=${encodeURIComponent(
          cleanQuery
        )}`
      );

    if (!data) return;

    renderUserResults(
      data.users || []
    );

  } catch (error) {

    userSearchResults.innerHTML = `
      <div class="search-error">
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function renderUserResults(users) {

  if (!users.length) {

    userSearchResults.innerHTML = `
      <div class="search-placeholder">
        <span>🔎</span>
        <p>No NICEGOLD users found.</p>
      </div>
    `;

    return;
  }

  userSearchResults.innerHTML = "";

  users.forEach(user => {

    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "user-result";

    const avatar =
      document.createElement("img");

    avatar.className =
      "avatar-result";

    setAvatar(
      avatar,
      user
    );

    const info =
      document.createElement("div");

    info.className =
      "user-result-info";

    const name =
      document.createElement("strong");

    name.textContent =
      user.displayName ||
      user.username;

    const username =
      document.createElement("span");

    username.textContent =
      `@${user.username}`;

    const status =
      document.createElement("small");

    status.textContent =
      user.online
        ? "Online"
        : "Offline";

    info.appendChild(name);
    info.appendChild(username);
    info.appendChild(status);

    button.appendChild(avatar);
    button.appendChild(info);

    button.addEventListener(
      "click",
      () =>
        startConversation(user)
    );

    userSearchResults.appendChild(
      button
    );
  });
}


/* =========================
   START CONVERSATION
========================= */

async function startConversation(user) {

  try {

    userSearchResults.innerHTML = `
      <div class="search-loading">
        <div class="small-spinner"></div>
        <span>Opening chat...</span>
      </div>
    `;

    const data =
      await api(
        "/api/conversations/direct",
        {
          method: "POST",
          body: JSON.stringify({
            userId: user.id
          })
        }
      );

    if (!data) return;

    closeNewChatModal();

    await loadConversations();

    const conversation =
      state.conversations.find(
        item =>
          item.id ===
          data.conversation.id
      );

    if (conversation) {
      await openConversation(
        conversation
      );
    }

  } catch (error) {

    userSearchResults.innerHTML = `
      <div class="search-error">
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}


/* =========================
   TEXTAREA
========================= */

function autoResizeTextarea() {

  messageInput.style.height =
    "auto";

  messageInput.style.height =
    Math.min(
      messageInput.scrollHeight,
      140
    ) + "px";
}


/* =========================
   SCROLL
========================= */

function isNearBottom() {

  const distance =
    messagesArea.scrollHeight -
    messagesArea.scrollTop -
    messagesArea.clientHeight;

  return distance < 180;
}


/* =========================
   HELPERS
========================= */

function formatMessageTime(value) {

  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function formatLastSeen(value) {

  if (!value) {
    return "offline";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "offline";
  }

  return (
    "last seen " +
    date.toLocaleString()
  );
}

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessageError(message) {

  messagesArea.innerHTML = `
    <div class="message-error">
      ${escapeHtml(
        message ||
        "Unable to load messages."
      )}
    </div>
  `;
}


/* =========================
   CONVERSATION SEARCH
========================= */

conversationSearch.addEventListener(
  "input",
  () => {

    const query =
      conversationSearch.value
        .trim()
        .toLowerCase();

    document
      .querySelectorAll(
        ".conversation-item"
      )
      .forEach(item => {

        const text =
          item.textContent
            .toLowerCase();

        item.style.display =
          !query ||
          text.includes(query)
            ? ""
            : "none";
      });
  }
);


/* =========================
   EVENTS
========================= */

newChatButton.addEventListener(
  "click",
  openNewChat
);

welcomeNewChat.addEventListener(
  "click",
  openNewChat
);

closeNewChat.addEventListener(
  "click",
  closeNewChatModal
);

newChatModal.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      newChatModal
    ) {
      closeNewChatModal();
    }
  }
);

userSearchInput.addEventListener(
  "input",
  () => {

    clearTimeout(
      state.searchTimer
    );

    state.searchTimer =
      setTimeout(
        () =>
          searchUsers(
            userSearchInput.value
          ),
        250
      );
  }
);

sendButton.addEventListener(
  "click",
  sendMessage
);

messageInput.addEventListener(
  "input",
  () => {
    autoResizeTextarea();
    sendTyping();
  }
);

messageInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendMessage();
    }
  }
);

cancelReplyButton.addEventListener(
  "click",
  clearReply
);

attachmentButton.addEventListener(
  "click",
  () => {
    alert(
      "Attachments will be connected in Phase 9."
    );
  }
);

voiceButton.addEventListener(
  "click",
  () => {
    alert(
      "Voice messages will be connected in a later phase."
    );
  }
);

mobileBackButton.addEventListener(
  "click",
  () => {

    document.body.classList.remove(
      "chat-open"
    );

    clearReply();
  }
);

$("chatSearchBtn").addEventListener(
  "click",
  () => {
    alert(
      "Chat search UI is prepared for the next messaging phase."
    );
  }
);

$("chatOptionsBtn").addEventListener(
  "click",
  () => {
    alert(
      "Conversation options will be connected to the privacy and management features."
    );
  }
);

logoutButton.addEventListener(
  "click",
  async () => {

    try {
      await api(
        "/api/auth/logout",
        {
          method: "POST"
        }
      );
    } catch {}

    if (state.socket) {
      state.socket.disconnect();
    }

    localStorage.removeItem(
      "nicegold_token"
    );

    localStorage.removeItem(
      "nicegold_user"
    );

    window.location.href = "/";
  }
);


/* =========================
   LOADER
========================= */

function hideLoader() {

  if (chatLoader) {
    chatLoader.classList.add(
      "hidden"
    );
  }
}


/* =========================
   START
========================= */

async function init() {

  try {

    connectSocket();

    await loadProfile();

    await loadConversations();

  } catch (error) {

    console.error(
      "CHAT INIT ERROR:",
      error
    );

    alert(
      error.message ||
      "Unable to load NICEGOLD CHAT."
    );

  } finally {

    setTimeout(
      hideLoader,
      250
    );
  }
}

init();
