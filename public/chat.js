const token = localStorage.getItem("nicegold_token");

if (!token) {
  window.location.href = "/auth.html";
}

const state = {
  me: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  replyTo: null,
  socket: null,
  typingTimer: null,
  swipe: null
};

const $ = (id) => document.getElementById(id);

const chatLoader = $("chatLoader");
const conversationList = $("conversationList");
const conversationEmpty = $("conversationEmpty");
const conversationCount = $("conversationCount");
const conversationSearch = $("conversationSearch");

const profileAvatar = $("profileAvatar");
const profileName = $("profileName");
const profileUsername = $("profileUsername");

const chatArea = $("chatArea");
const activeAvatar = $("activeAvatar");
const activeName = $("activeName");
const activeUsername = $("activeUsername");
const activeStatus = $("activeStatus");

const messagesArea = $("messagesArea");
const messageInput = $("messageInput");
const sendButton = $("sendButton");
const attachmentButton = $("attachmentButton");
const voiceButton = $("voiceButton");

const mobileBackButton = $("mobileBackButton");

const replyBar = $("replyBar");
const replyBarName = $("replyBarName");
const replyBarText = $("replyBarText");
const cancelReplyButton = $("cancelReplyButton");

const newChatButton = $("newChatButton");
const newChatModal = $("newChatModal");
const closeNewChat = $("closeNewChat");
const userSearchInput = $("userSearchInput");
const userSearchResults = $("userSearchResults");

function avatarUrl(avatar) {
  if (!avatar) return "/images/default-avatar.png";

  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }

  return avatar.startsWith("/")
    ? avatar
    : `/${avatar}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function apiHeaders(json = true) {
  const headers = {
    Authorization: `Bearer ${token}`
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...apiHeaders(options.body !== undefined),
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    localStorage.removeItem("nicegold_token");
    window.location.href = "/auth.html";
    return;
  }

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.error ||
      data.message ||
      `Request failed: ${response.status}`
    );
  }

  return data;
}

/* =========================================================
   PROFILE
========================================================= */

async function loadProfile() {
  const data = await api("/api/profile");

  state.me = data.user || data.profile || data;

  if (!state.me) return;

  profileName.textContent =
    state.me.displayName ||
    state.me.username ||
    "User";

  profileUsername.textContent =
    state.me.username
      ? `@${state.me.username}`
      : "";

  if (profileAvatar) {
    profileAvatar.src = avatarUrl(state.me.avatar);
    profileAvatar.onerror = () => {
      profileAvatar.removeAttribute("src");
    };
  }
}

/* =========================================================
   SOCKET.IO
========================================================= */

function connectSocket() {
  if (typeof io !== "function") return;

  state.socket = io({
    auth: {
      token
    }
  });

  state.socket.on("connect", () => {
    console.log("NICEGOLD CHAT socket connected");

    if (state.activeConversation?.id) {
      state.socket.emit(
        "conversation:join",
        state.activeConversation.id
      );
    }
  });

  state.socket.on("disconnect", () => {
    console.log("NICEGOLD CHAT socket disconnected");
  });

  state.socket.on("conversation:new", async (payload) => {
    console.log("New conversation:", payload);

    await loadConversations();

    if (
      payload?.conversation?.id &&
      payload.conversation.id ===
        state.activeConversation?.id
    ) {
      await openConversation(
        payload.conversation
      );
    }
  });

  state.socket.on("message:new", async (message) => {
    if (!message?.conversationId) return;

    await loadConversations();

    if (
      state.activeConversation?.id !==
      message.conversationId
    ) {
      return;
    }

    const exists = state.messages.some(
      (item) => item.id === message.id
    );

    if (!exists) {
      state.messages.push(message);
      renderMessages();
    }

    if (
      message.senderId !== state.me?.id &&
      message.senderId !== state.me?.userId
    ) {
      markConversationRead(
        message.conversationId
      );
    }
  });

  state.socket.on("message:notification", async () => {
    await loadConversations();
  });

  state.socket.on("message:read", (payload) => {
    if (
      !state.activeConversation ||
      payload?.conversationId !==
        state.activeConversation.id
    ) {
      return;
    }

    state.messages = state.messages.map(
      (message) => {
        if (message.id !== payload.messageId) {
          return message;
        }

        return {
          ...message,
          readBy: payload.readBy || message.readBy
        };
      }
    );

    renderMessages();
  });
}

/* =========================================================
   CONVERSATIONS
========================================================= */

async function loadConversations() {
  const data = await api("/api/conversations");

  state.conversations =
    Array.isArray(data.conversations)
      ? data.conversations
      : [];

  renderConversationList();
}

function getConversationUser(conversation) {
  /*
    Backend cleanConversation() returns:

    {
      id,
      type,
      name,
      username,
      avatar,
      members,
      lastMessage,
      ...
    }

    Older frontend code expected conversation.user.
    Support both shapes so this remains safe.
  */

  if (conversation?.user) {
    return conversation.user;
  }

  return {
    id: conversation?.members?.find(
      (id) =>
        id !== state.me?.id &&
        id !== state.me?.userId
    ) || null,

    displayName:
      conversation?.name ||
      "Unknown user",

    username:
      conversation?.username ||
      null,

    avatar:
      conversation?.avatar ||
      null
  };
}

function renderConversationList() {
  if (!conversationList) return;

  conversationList.innerHTML = "";

  if (conversationCount) {
    conversationCount.textContent =
      state.conversations.length;
  }

  if (!state.conversations.length) {
    if (conversationEmpty) {
      conversationList.appendChild(
        conversationEmpty
      );
    }

    return;
  }

  state.conversations.forEach(
    (conversation) => {
      const user =
        getConversationUser(
          conversation
        );

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

      const avatar =
        document.createElement("img");

      avatar.className =
        "conversation-avatar avatar-conversation";

      avatar.src =
        avatarUrl(user.avatar);

      avatar.alt =
        user.displayName ||
        user.username ||
        "User";

      avatar.onerror = () => {
        avatar.removeAttribute("src");
      };

      const onlineDot =
        document.createElement("span");

      onlineDot.className =
        "online-dot conversation-online";

      const details =
        document.createElement("div");

      details.className =
        "conversation-details";

      const top =
        document.createElement("div");

      top.className =
        "conversation-top";

      const name =
        document.createElement("strong");

      name.textContent =
        user.displayName ||
        user.username ||
        "Unknown user";

      const time =
        document.createElement("time");

      time.textContent =
        formatTime(
          conversation.lastMessage?.createdAt ||
          conversation.updatedAt
        );

      top.appendChild(name);
      top.appendChild(time);

      const bottom =
        document.createElement("div");

      bottom.className =
        "conversation-bottom";

      const preview =
        document.createElement("span");

      preview.className =
        "conversation-preview";

      preview.textContent =
        conversation.lastMessage?.text ||
        (
          conversation.type === "direct"
            ? "Start a conversation"
            : "No messages yet"
        );

      bottom.appendChild(preview);

      if (conversation.unread > 0) {
        const unread =
          document.createElement("span");

        unread.className =
          "conversation-unread";

        unread.textContent =
          conversation.unread > 99
            ? "99+"
            : conversation.unread;

        bottom.appendChild(unread);
      }

      details.appendChild(top);
      details.appendChild(bottom);

      item.appendChild(avatar);
      item.appendChild(onlineDot);
      item.appendChild(details);

      item.addEventListener(
        "click",
        async () => {
          await openConversation(
            conversation
          );
        }
      );

      conversationList.appendChild(item);
    }
  );
}

/* =========================================================
   OPEN CONVERSATION
========================================================= */

async function openConversation(conversation) {
  if (!conversation?.id) return;

  state.activeConversation =
    conversation;

  state.replyTo = null;
  updateReplyBar();

  const user =
    getConversationUser(
      conversation
    );

  activeName.textContent =
    user.displayName ||
    user.username ||
    "Unknown user";

  activeUsername.textContent =
    user.username
      ? `@${user.username}`
      : "";

  activeStatus.textContent =
    "Online";

  if (activeAvatar) {
    activeAvatar.src =
      avatarUrl(user.avatar);

    activeAvatar.onerror = () => {
      activeAvatar.removeAttribute("src");
    };
  }

  document.body.classList.add(
    "chat-open"
  );

  renderConversationList();

  if (state.socket) {
    state.socket.emit(
      "conversation:join",
      conversation.id
    );
  }

  await loadMessages(
    conversation.id
  );

  await markConversationRead(
    conversation.id
  );
}

/* =========================================================
   MESSAGES
========================================================= */

async function loadMessages(
  conversationId
) {
  const data = await api(
    `/api/conversations/${encodeURIComponent(
      conversationId
    )}/messages`
  );

  state.messages =
    Array.isArray(data.messages)
      ? data.messages
      : [];

  renderMessages();
}

function renderMessages() {
  if (!messagesArea) return;

  messagesArea.innerHTML = "";

  if (!state.messages.length) {
    const empty =
      document.createElement("div");

    empty.className =
      "messages-empty";

    empty.innerHTML = `
      <div class="empty-icon">💬</div>
      <strong>No messages yet</strong>
      <span>Send a message to start the conversation.</span>
    `;

    messagesArea.appendChild(empty);
    return;
  }

  state.messages.forEach(
    (message) => {
      renderMessage(
        message
      );
    }
  );

  requestAnimationFrame(
    scrollMessagesToBottom
  );
}

function renderMessage(message) {
  const myId =
    state.me?.id ||
    state.me?.userId;

  const isMine =
    message.senderId === myId;

  const wrapper =
    document.createElement("div");

  wrapper.className =
    `message-row ${
      isMine ? "sent" : "received"
    }`;

  wrapper.dataset.messageId =
    message.id;

  const bubble =
    document.createElement("div");

  bubble.className =
    `message-bubble ${
      isMine ? "bubble-sent" : "bubble-received"
    }`;

  const reply =
    getReplyMessage(
      message.replyTo
    );

  if (reply) {
    const replyBox =
      document.createElement("div");

    replyBox.className =
      "message-reply-preview";

    replyBox.innerHTML = `
      <strong>
        ${escapeHtml(
          reply.senderName ||
          "Reply"
        )}
      </strong>
      <span>
        ${escapeHtml(
          reply.text ||
          "Message"
        )}
      </span>
    `;

    bubble.appendChild(
      replyBox
    );
  }

  const text =
    document.createElement("div");

  text.className =
    "message-text";

  text.textContent =
    message.deleted
      ? "Message deleted"
      : message.text || "";

  bubble.appendChild(text);

  const meta =
    document.createElement("div");

  meta.className =
    "message-meta";

  const time =
    document.createElement("span");

  time.textContent =
    formatTime(
      message.createdAt
    );

  meta.appendChild(time);

  if (isMine) {
    const ticks =
      document.createElement("span");

    ticks.className =
      "message-ticks";

    const read =
      Array.isArray(
        message.readBy
      ) &&
      message.readBy.some(
        (id) => id !== myId
      );

    ticks.textContent =
      read ? "✓✓" : "✓";

    meta.appendChild(
      ticks
    );
  }

  bubble.appendChild(meta);

  wrapper.appendChild(
    bubble
  );

  messagesArea.appendChild(
    wrapper
  );

  attachSwipeToReply(
    wrapper,
    bubble,
    message
  );
}

function getReplyMessage(
  replyTo
) {
  if (!replyTo) return null;

  if (
    typeof replyTo === "object"
  ) {
    return replyTo;
  }

  return state.messages.find(
    (message) =>
      message.id === replyTo
  ) || null;
}

function scrollMessagesToBottom() {
  if (!messagesArea) return;

  messagesArea.scrollTop =
    messagesArea.scrollHeight;
}

/* =========================================================
   SWIPE TO REPLY
========================================================= */

function attachSwipeToReply(
  wrapper,
  bubble,
  message
) {
  let startX = 0;
  let currentX = 0;
  let dragging = false;

  const threshold = 65;
  const maxSwipe = 95;

  wrapper.addEventListener(
    "pointerdown",
    (event) => {
      startX =
        event.clientX;

      currentX =
        startX;

      dragging = true;

      bubble.style.transition =
        "none";

      try {
        wrapper.setPointerCapture(
          event.pointerId
        );
      } catch {}
    }
  );

  wrapper.addEventListener(
    "pointermove",
    (event) => {
      if (!dragging) return;

      currentX =
        event.clientX;

      const distance =
        currentX - startX;

      if (distance <= 0) return;

      const movement =
        Math.min(
          distance,
          maxSwipe
        );

      bubble.style.transform =
        `translateX(${movement}px)`;

      wrapper.classList.toggle(
        "reply-ready",
        distance >= threshold
      );
    }
  );

  const finishSwipe = () => {
    if (!dragging) return;

    dragging = false;

    const distance =
      currentX - startX;

    bubble.style.transition =
      "transform .18s ease";

    bubble.style.transform =
      "translateX(0)";

    wrapper.classList.remove(
      "reply-ready"
    );

    if (distance >= threshold) {
      setReply(message);
    }
  };

  wrapper.addEventListener(
    "pointerup",
    finishSwipe
  );

  wrapper.addEventListener(
    "pointercancel",
    finishSwipe
  );

  wrapper.addEventListener(
    "pointerleave",
    () => {
      if (dragging) {
        finishSwipe();
      }
    }
  );
}

function setReply(message) {
  state.replyTo =
    message;

  updateReplyBar();

  messageInput.focus();
}

function updateReplyBar() {
  if (!replyBar) return;

  if (!state.replyTo) {
    replyBar.classList.add(
      "hidden"
    );

    return;
  }

  replyBar.classList.remove(
    "hidden"
  );

  const myId =
    state.me?.id ||
    state.me?.userId;

  const senderName =
    state.replyTo.senderId === myId
      ? "You"
      : (
          state.activeConversation?.username
            ? `@${state.activeConversation.username}`
            : state.activeConversation?.name ||
              "User"
        );

  replyBarName.textContent =
    senderName;

  replyBarText.textContent =
    state.replyTo.text ||
    "Message";
}

function cancelReply() {
  state.replyTo = null;
  updateReplyBar();
}

/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {
  if (!state.activeConversation) {
    return;
  }

  const text =
    messageInput.value.trim();

  if (!text) return;

  const conversationId =
    state.activeConversation.id;

  const replyTo =
    state.replyTo?.id ||
    state.replyTo ||
    null;

  sendButton.disabled = true;

  try {
    const data = await api(
      `/api/conversations/${encodeURIComponent(
        conversationId
      )}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          text,
          type: "text",
          replyTo
        })
      }
    );

    messageInput.value = "";
    autoResizeTextarea();

    cancelReply();

    const message =
      data.message;

    if (message) {
      const exists =
        state.messages.some(
          (item) =>
            item.id === message.id
        );

      if (!exists) {
        state.messages.push(
          message
        );
      }
    }

    renderMessages();

    await loadConversations();

    if (state.socket) {
      state.socket.emit(
        "message:new",
        message
      );
    }
  } catch (error) {
    console.error(
      "SEND MESSAGE ERROR:",
      error
    );

    alert(
      error.message ||
      "Unable to send message."
    );
  } finally {
    sendButton.disabled = false;
  }
}

/* =========================================================
   READ RECEIPTS
========================================================= */

async function markConversationRead(
  conversationId
) {
  try {
    await api(
      `/api/conversations/${encodeURIComponent(
        conversationId
      )}/read`,
      {
        method: "POST"
      }
    );
  } catch (error) {
    console.warn(
      "READ RECEIPT:",
      error.message
    );
  }
}

/* =========================================================
   NEW CHAT / USER SEARCH
========================================================= */

function openNewChatModal() {
  newChatModal.classList.remove(
    "hidden"
  );

  userSearchInput.value = "";

  userSearchResults.innerHTML = `
    <div class="search-empty">
      Search for a person to start a chat.
    </div>
  `;

  userSearchInput.focus();
}

function closeNewChatModal() {
  newChatModal.classList.add(
    "hidden"
  );
}

let searchTimer = null;

userSearchInput?.addEventListener(
  "input",
  () => {
    clearTimeout(searchTimer);

    const query =
      userSearchInput.value.trim();

    if (!query) {
      userSearchResults.innerHTML = `
        <div class="search-empty">
          Search for a person to start a chat.
        </div>
      `;

      return;
    }

    searchTimer =
      setTimeout(
        () => searchUsers(query),
        250
      );
  }
);

async function searchUsers(query) {
  try {
    const data =
      await api(
        `/api/users/search?q=${encodeURIComponent(
          query
        )}`
      );

    const users =
      Array.isArray(data.users)
        ? data.users
        : [];

    renderUserSearchResults(
      users
    );
  } catch (error) {
    console.error(
      "USER SEARCH ERROR:",
      error
    );

    userSearchResults.innerHTML = `
      <div class="search-empty">
        ${escapeHtml(
          error.message ||
          "Search failed."
        )}
      </div>
    `;
  }
}

function renderUserSearchResults(
  users
) {
  userSearchResults.innerHTML = "";

  if (!users.length) {
    userSearchResults.innerHTML = `
      <div class="search-empty">
        No users found.
      </div>
    `;

    return;
  }

  users.forEach(
    (user) => {
      const item =
        document.createElement("button");

      item.type = "button";
      item.className =
        "user-search-result";

      item.innerHTML = `
        <img
          class="avatar-result"
          src="${escapeHtml(
            avatarUrl(user.avatar)
          )}"
          alt=""
        >

        <span class="user-result-info">
          <strong>
            ${escapeHtml(
              user.displayName ||
              user.username ||
              "User"
            )}
          </strong>

          <small>
            ${
              user.username
                ? `@${escapeHtml(
                    user.username
                  )}`
                : ""
            }
          </small>
        </span>
      `;

      const image =
        item.querySelector("img");

      image.onerror = () => {
        image.removeAttribute(
          "src"
        );
      };

      item.addEventListener(
        "click",
        () =>
          startDirectChat(
            user
          )
      );

      userSearchResults.appendChild(
        item
      );
    }
  );
}

async function startDirectChat(
  user
) {
  if (!user?.id) {
    alert(
      "This user does not have a valid ID."
    );

    return;
  }

  try {
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

    /*
      IMPORTANT FIX:

      The backend returns:

      {
        ok: true,
        created: true,
        conversation: {
          id,
          type,
          name,
          username,
          avatar,
          members,
          ...
        }
      }

      Do NOT look for conversation.user.
    */

    const createdConversation =
      data.conversation;

    if (!createdConversation?.id) {
      throw new Error(
        "The server did not return a conversation."
      );
    }

    closeNewChatModal();

    /*
      Immediately refresh the sidebar.
      This makes a newly-created conversation
      appear even when there was no previous
      message.
    */
    await loadConversations();

    /*
      Find the conversation returned by
      the backend using its ID.
    */
    let conversation =
      state.conversations.find(
        (item) =>
          item.id ===
          createdConversation.id
      );

    /*
      If the refreshed list somehow doesn't
      contain it yet, use the server response
      directly. This prevents the user from
      being stranded on the search screen.
    */
    if (!conversation) {
      conversation =
        createdConversation;

      state.conversations.unshift(
        conversation
      );

      renderConversationList();
    }

    await openConversation(
      conversation
    );
  } catch (error) {
    console.error(
      "START DIRECT CHAT ERROR:",
      error
    );

    alert(
      error.message ||
      "Unable to start chat."
    );
  }
}

/* =========================================================
   SEARCH EXISTING CONVERSATIONS
========================================================= */

conversationSearch?.addEventListener(
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
      .forEach((item) => {
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

/* =========================================================
   TEXTAREA
========================================================= */

function autoResizeTextarea() {
  if (!messageInput) return;

  messageInput.style.height =
    "auto";

  messageInput.style.height =
    `${Math.min(
      messageInput.scrollHeight,
      140
    )}px`;
}

/* =========================================================
   EVENTS
========================================================= */

sendButton?.addEventListener(
  "click",
  sendMessage
);

messageInput?.addEventListener(
  "input",
  autoResizeTextarea
);

messageInput?.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendMessage();
    }
  }
);

messageInput?.addEventListener(
  "input",
  () => {
    if (
      !state.socket ||
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

    clearTimeout(
      state.typingTimer
    );

    state.typingTimer =
      setTimeout(() => {
        state.socket.emit(
          "typing:stop",
          {
            conversationId:
              state.activeConversation.id
          }
        );
      }, 800);
  }
);

attachmentButton?.addEventListener(
  "click",
  () => {
    alert(
      "Attachments will be connected in Phase 9."
    );
  }
);

voiceButton?.addEventListener(
  "click",
  () => {
    alert(
      "Voice messages will be connected in a later phase."
    );
  }
);

cancelReplyButton?.addEventListener(
  "click",
  cancelReply
);

mobileBackButton?.addEventListener(
  "click",
  () => {
    document.body.classList.remove(
      "chat-open"
    );
  }
);

newChatButton?.addEventListener(
  "click",
  openNewChatModal
);

closeNewChat?.addEventListener(
  "click",
  closeNewChatModal
);

newChatModal?.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      newChatModal
    ) {
      closeNewChatModal();
    }
  }
);

/* =========================================================
   LOGOUT
========================================================= */

$("logoutButton")?.addEventListener(
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

    localStorage.removeItem(
      "nicegold_token"
    );

    window.location.href =
      "/auth.html";
  }
);

/* =========================================================
   LOADER
========================================================= */

function hideLoader() {
  if (chatLoader) {
    chatLoader.classList.add(
      "hidden"
    );
  }
}

/* =========================================================
   INIT
========================================================= */

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
