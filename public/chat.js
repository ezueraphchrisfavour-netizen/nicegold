const token =
  localStorage.getItem("nicegold_token");

if (!token) {
  window.location.href = "/";
}

const state = {
  user: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  searchTimer: null,
  socket: null
};

const $ = id =>
  document.getElementById(id);

/* =========================
   ELEMENTS
========================= */

const chatLoader =
  $("chatLoader");

const profileAvatar =
  $("profileAvatar");

const profileName =
  $("profileName");

const profileUsername =
  $("profileUsername");

const profileOnline =
  $("profileOnline");

const conversationList =
  $("conversationList");

const conversationEmpty =
  $("conversationEmpty");

const conversationCount =
  $("conversationCount");

const newChatButton =
  $("newChatButton");

const newChatModal =
  $("newChatModal");

const closeNewChat =
  $("closeNewChat");

const userSearchInput =
  $("userSearchInput");

const userSearchResults =
  $("userSearchResults");

const activeAvatar =
  $("activeAvatar");

const activeName =
  $("activeName");

const activeUsername =
  $("activeUsername");

const activeStatus =
  $("activeStatus");

const activeOnline =
  $("activeOnline");

const welcomeChat =
  $("welcomeChat");

const messagesArea =
  $("messagesArea");

const messageInput =
  $("messageInput");

const sendButton =
  $("sendButton");

const attachmentButton =
  $("attachmentButton");

const voiceButton =
  $("voiceButton");

const logoutButton =
  $("logoutButton");

const mobileBackButton =
  $("mobileBackButton");

const conversationSearch =
  $("conversationSearch");

/* =========================
   API
========================= */

async function api(
  url,
  options = {}
) {
  const headers = {
    ...(options.headers || {}),
    Authorization:
      `Bearer ${token}`
  };

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  const response =
    await fetch(url, {
      ...options,
      headers
    });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {
      ok: false,
      message:
        "Invalid server response."
    };
  }

  if (
    response.status === 401
  ) {
    localStorage.removeItem(
      "nicegold_token"
    );

    localStorage.removeItem(
      "nicegold_user"
    );

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
   SOCKET.IO
========================= */

function connectSocket() {
  if (
    typeof io !== "function"
  ) {
    console.warn(
      "Socket.IO client is not available."
    );
    return;
  }

  state.socket =
    io({
      auth: {
        token
      }
    });

  state.socket.on(
    "connect",
    () => {
      console.log(
        "NICEGOLD CHAT realtime connected."
      );

      if (
        state.activeConversation
      ) {
        joinConversationRoom(
          state.activeConversation.id
        );
      }
    }
  );

  state.socket.on(
    "disconnect",
    () => {
      console.log(
        "NICEGOLD CHAT realtime disconnected."
      );
    }
  );

  state.socket.on(
    "socket:ready",
    data => {
      console.log(
        "Socket ready:",
        data
      );
    }
  );

  state.socket.on(
    "message:new",
    message => {
      receiveRealtimeMessage(
        message
      );
    }
  );

  state.socket.on(
    "message:notification",
    payload => {
      if (!payload) return;

      const message =
        payload.message;

      if (!message) return;

      if (
        state.activeConversation &&
        message.conversationId ===
          state.activeConversation.id
      ) {
        receiveRealtimeMessage(
          message
        );
      }

      refreshConversationList();
    }
  );
}

function joinConversationRoom(
  conversationId
) {
  if (
    !state.socket ||
    !state.socket.connected ||
    !conversationId
  ) {
    return;
  }

  state.socket.emit(
    "conversation:join",
    conversationId
  );
}

function receiveRealtimeMessage(
  message
) {
  if (!message) return;

  if (
    !state.activeConversation ||
    message.conversationId !==
      state.activeConversation.id
  ) {
    refreshConversationList();
    return;
  }

  const exists =
    state.messages.some(
      item =>
        item.id === message.id
    );

  if (exists) return;

  state.messages.push(
    message
  );

  renderMessages(true);

  markMessageRead(
    message
  );

  refreshConversationList();
}

/* =========================
   AVATAR
========================= */

function avatarFallback(
  name = "?"
) {
  return (
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg"
           width="200"
           height="200"
           viewBox="0 0 200 200">
        <rect width="200"
              height="200"
              rx="100"
              fill="#252525"/>
        <text x="100"
              y="118"
              text-anchor="middle"
              font-size="80"
              font-family="Arial"
              fill="#eeeeee">
          ${String(name)
            .charAt(0)
            .toUpperCase()}
        </text>
      </svg>
    `)
  );
}

function setAvatar(
  element,
  user
) {
  if (!element) return;

  element.src =
    user?.avatar ||
    avatarFallback(
      user?.displayName ||
      user?.username ||
      "?"
    );

  element.onerror =
    () => {
      element.onerror = null;

      element.src =
        avatarFallback(
          user?.displayName ||
          user?.username ||
          "?"
        );
    };
}

/* =========================
   PROFILE
========================= */

async function loadProfile() {
  const data =
    await api("/api/auth/me");

  if (!data) return;

  state.user =
    data.user;

  localStorage.setItem(
    "nicegold_user",
    JSON.stringify(
      state.user
    )
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
   LOAD CONVERSATIONS
========================= */

async function loadConversations() {
  try {
    const data =
      await api(
        "/api/conversations"
      );

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

async function refreshConversationList() {
  try {
    await loadConversations();
  } catch {}
}

/* =========================
   RENDER CONVERSATIONS
========================= */

function renderConversations() {
  conversationList.innerHTML = "";

  conversationCount.textContent =
    state.conversations.length;

  if (
    state.conversations.length === 0
  ) {
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
        document.createElement(
          "button"
        );

      item.type = "button";

      item.className =
        "conversation-item";

      if (
        state.activeConversation &&
        state.activeConversation.id ===
          conversation.id
      ) {
        item.classList.add(
          "active"
        );
      }

      const avatar =
        document.createElement(
          "img"
        );

      avatar.className =
        "avatar avatar-conversation";

      setAvatar(
        avatar,
        user
      );

      const online =
        document.createElement(
          "span"
        );

      online.className =
        "online-dot conversation-online";

      online.style.display =
        user.online
          ? "block"
          : "none";

      const avatarWrap =
        document.createElement(
          "div"
        );

      avatarWrap.className =
        "conversation-avatar";

      avatarWrap.appendChild(
        avatar
      );

      avatarWrap.appendChild(
        online
      );

      const details =
        document.createElement(
          "div"
        );

      details.className =
        "conversation-details";

      const name =
        document.createElement(
          "strong"
        );

      name.textContent =
        user.displayName ||
        user.username;

      const preview =
        document.createElement(
          "span"
        );

      if (
        conversation.lastMessage
      ) {
        preview.textContent =
          conversation.lastMessage
            .text ||
          (
            conversation.lastMessage
              .type === "image"
              ? "📷 Image"
              : "Message"
          );
      } else {
        preview.textContent =
          "Start chatting";
      }

      details.appendChild(
        name
      );

      details.appendChild(
        preview
      );

      item.appendChild(
        avatarWrap
      );

      item.appendChild(
        details
      );

      item.addEventListener(
        "click",
        () =>
          openConversation(
            conversation
          )
      );

      conversationList.appendChild(
        item
      );
    }
  );
}

/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages(
  conversationId
) {
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
      message =>
        markMessageRead(
          message
        )
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
   RENDER MESSAGES
========================= */

function renderMessages(
  animateLatest = false
) {
  if (!messagesArea) return;

  messagesArea.innerHTML = "";

  if (
    !state.messages.length
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "message-empty";

    empty.innerHTML = `
      <div class="message-empty-icon">💬</div>
      <strong>No messages yet</strong>
      <span>Send a message to start the conversation.</span>
    `;

    messagesArea.appendChild(
      empty
    );

    return;
  }

  const list =
    document.createElement(
      "div"
    );

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

  messagesArea.appendChild(
    list
  );

  requestAnimationFrame(
    () => {
      messagesArea.scrollTop =
        messagesArea.scrollHeight;
    }
  );
}

function createMessageElement(
  message,
  animate = false
) {
  const mine =
    state.user &&
    message.senderId ===
      state.user.id;

  const row =
    document.createElement(
      "div"
    );

  row.className =
    mine
      ? "message-row message-row-sent"
      : "message-row message-row-received";

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    mine
      ? "message-bubble message-bubble-sent"
      : "message-bubble message-bubble-received";

  if (animate) {
    bubble.classList.add(
      "message-pop"
    );
  }

  if (message.deleted) {
    bubble.classList.add(
      "message-deleted"
    );
  }

  const text =
    document.createElement(
      "div"
    );

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

  bubble.appendChild(
    text
  );

  const meta =
    document.createElement(
      "div"
    );

  meta.className =
    "message-meta";

  const time =
    document.createElement(
      "span"
    );

  time.className =
    "message-time";

  time.textContent =
    formatMessageTime(
      message.createdAt
    );

  meta.appendChild(
    time
  );

  if (mine) {
    const ticks =
      document.createElement(
        "span"
      );

    ticks.className =
      "message-ticks";

    ticks.textContent =
      getMessageTicks(
        message
      );

    meta.appendChild(
      ticks
    );
  }

  bubble.appendChild(
    meta
  );

  row.appendChild(
    bubble
  );

  return row;
}

function getMessageTicks(
  message
) {
  if (
    message.readBy &&
    state.activeConversation
  ) {
    const readByOther =
      message.readBy.some(
        id =>
          id !==
          state.user?.id
      );

    if (readByOther) {
      return "✓✓";
    }
  }

  return "✓";
}

function formatMessageTime(
  value
) {
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

function showMessageError(
  message
) {
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
   OPEN CONVERSATION
========================= */

async function openConversation(
  conversation
) {
  state.activeConversation =
    conversation;

  const user =
    conversation.user;

  if (!user) return;

  activeName.textContent =
    user.displayName ||
    user.username;

  if (activeUsername) {
    activeUsername.textContent =
      `@${user.username}`;
  }

  activeStatus.textContent =
    user.online
      ? "online"
      : formatLastSeen(
          user.lastSeen
        );

  setAvatar(
    activeAvatar,
    user
  );

  activeOnline.style.display =
    user.online
      ? "block"
      : "none";

  document.body.classList.add(
    "chat-open"
  );

  joinConversationRoom(
    conversation.id
  );

  await loadMessages(
    conversation.id
  );

  renderConversations();

  messageInput.focus();
}

/* =========================
   READ RECEIPTS
========================= */

function markMessageRead(
  message
) {
  if (
    !state.socket ||
    !state.socket.connected ||
    !message ||
    !message.id ||
    message.senderId ===
      state.user?.id
  ) {
    return;
  }

  state.socket.emit(
    "message:read",
    {
      messageId:
        message.id
    }
  );
}

/* =========================
   NEW CHAT MODAL
========================= */

function openNewChat() {
  newChatModal.hidden =
    false;

  userSearchInput.value = "";

  userSearchResults.innerHTML = `
    <div class="search-placeholder">
      <span>👤</span>
      <p>
        Search for someone to chat with.
      </p>
    </div>
  `;

  setTimeout(
    () =>
      userSearchInput.focus(),
    80
  );
}

function closeNewChatModal() {
  newChatModal.hidden =
    true;
}

/* =========================
   SEARCH USERS
========================= */

async function searchUsers(
  query
) {
  const cleanQuery =
    query.trim();

  if (!cleanQuery) {
    userSearchResults.innerHTML = `
      <div class="search-placeholder">
        <span>👤</span>
        <p>
          Search for someone to chat with.
        </p>
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
        ${escapeHtml(
          error.message
        )}
      </div>
    `;
  }
}

function renderUserResults(
  users
) {
  if (!users.length) {
    userSearchResults.innerHTML = `
      <div class="search-placeholder">
        <span>🔎</span>
        <p>
          No NICEGOLD users found.
        </p>
      </div>
    `;

    return;
  }

  userSearchResults.innerHTML =
    "";

  users.forEach(
    user => {
      const button =
        document.createElement(
          "button"
        );

      button.type = "button";

      button.className =
        "user-result";

      const avatar =
        document.createElement(
          "img"
        );

      avatar.className =
        "avatar avatar-result";

      setAvatar(
        avatar,
        user
      );

      const info =
        document.createElement(
          "div"
        );

      info.className =
        "user-result-info";

      const name =
        document.createElement(
          "strong"
        );

      name.textContent =
        user.displayName ||
        user.username;

      const username =
        document.createElement(
          "span"
        );

      username.textContent =
        `@${user.username}`;

      const status =
        document.createElement(
          "small"
        );

      status.textContent =
        user.online
          ? "Online"
          : "Offline";

      info.appendChild(
        name
      );

      info.appendChild(
        username
      );

      info.appendChild(
        status
      );

      button.appendChild(
        avatar
      );

      button.appendChild(
        info
      );

      button.addEventListener(
        "click",
        () =>
          startConversation(
            user
          )
      );

      userSearchResults.appendChild(
        button
      );
    }
  );
}

/* =========================
   START CONVERSATION
========================= */

async function startConversation(
  user
) {
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
          body:
            JSON.stringify({
              userId:
                user.id
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
        ${escapeHtml(
          error.message
        )}
      </div>
    `;
  }
}

/* =========================
   SEND MESSAGE
========================= */

async function sendMessage() {
  if (
    !state.activeConversation
  ) {
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

  sendButton.disabled =
    true;

  try {
    const data =
      await api(
        `/api/conversations/${encodeURIComponent(
          state.activeConversation.id
        )}/messages`,
        {
          method: "POST",
          body:
            JSON.stringify({
              text,
              type: "text"
            })
        }
      );

    if (!data) return;

    const message =
      data.message;

    if (message) {
      const exists =
        state.messages.some(
          item =>
            item.id ===
            message.id
        );

      if (!exists) {
        state.messages.push(
          message
        );

        renderMessages(
          true
        );
      }
    }

    messageInput.value = "";

    autoResizeTextarea();

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
   SEARCH CONVERSATIONS
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
      .forEach(
        item => {
          const text =
            item.textContent
              .toLowerCase();

          item.style.display =
            !query ||
            text.includes(
              query
            )
              ? ""
              : "none";
        }
      );
  }
);

/* =========================
   HELPERS
========================= */

function escapeHtml(
  value
) {
  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function formatLastSeen(
  value
) {
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

/* =========================
   LOGOUT
========================= */

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
   EVENTS
========================= */

newChatButton.addEventListener(
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
  autoResizeTextarea
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
