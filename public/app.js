const loader = document.getElementById("loader");

const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authButton = document.getElementById("auth-button");
const switchAuth = document.getElementById("switch-auth");
const authMessage = document.getElementById("auth-message");

const usernameGroup = document.getElementById("username-group");
const phoneGroup = document.getElementById("phone-group");
const avatarGroup = document.getElementById("avatar-group");

const usernameInput = document.getElementById("username");
const phoneInput = document.getElementById("phone");
const passwordInput = document.getElementById("password");

const avatarInput = document.getElementById("avatar");
const avatarPreview = document.getElementById("avatar-preview");
const removeAvatar = document.getElementById("remove-avatar");

let registerMode = false;
let avatarFile = null;

setTimeout(() => {
  loader.classList.add("hidden");
}, 650);

function showMessage(message, type = "info") {
  authMessage.textContent = message;
  authMessage.className = type;
}

function setMode(register) {
  registerMode = register;

  authMessage.textContent = "";
  authMessage.className = "";

  if (registerMode) {
    authTitle.textContent = "Create account";
    authSubtitle.textContent =
      "Join NICEGOLD CHAT and create your profile.";

    usernameGroup.classList.remove("hidden");
    phoneGroup.classList.remove("hidden");
    avatarGroup.classList.remove("hidden");

    usernameInput.required = true;
    phoneInput.required = true;

    passwordInput.autocomplete = "new-password";

    authButton.textContent = "Create Account";
    switchAuth.textContent = "Already have an account? Login";
  } else {
    authTitle.textContent = "Welcome back";
    authSubtitle.textContent =
      "Login to continue to NICEGOLD CHAT.";

    usernameGroup.classList.remove("hidden");
    phoneGroup.classList.add("hidden");
    avatarGroup.classList.add("hidden");

    usernameInput.required = true;
    phoneInput.required = false;

    passwordInput.autocomplete = "current-password";

    authButton.textContent = "Login";
    switchAuth.textContent = "Create a new account";

    clearAvatar();
  }
}

switchAuth.addEventListener("click", () => {
  setMode(!registerMode);
});

avatarInput.addEventListener("change", () => {
  const file = avatarInput.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showMessage("Please select an image file.", "error");
    avatarInput.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showMessage("Profile picture must be 5MB or smaller.", "error");
    avatarInput.value = "";
    return;
  }

  avatarFile = file;

  const reader = new FileReader();

  reader.onload = event => {
    avatarPreview.innerHTML = "";

    const img = document.createElement("img");
    img.src = event.target.result;

    avatarPreview.appendChild(img);

    removeAvatar.hidden = false;
  };

  reader.readAsDataURL(file);
});

removeAvatar.addEventListener("click", clearAvatar);

function clearAvatar() {
  avatarFile = null;
  avatarInput.value = "";
  avatarPreview.innerHTML = "<span>+</span>";
  removeAvatar.hidden = true;
}

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  showMessage("");

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showMessage(
      "Please enter your username and password.",
      "error"
    );
    return;
  }

  authButton.disabled = true;
  authButton.textContent = registerMode
    ? "Creating account..."
    : "Logging in...";

  try {
    let response;

    if (registerMode) {
      const formData = new FormData();

      formData.append("username", username);
      formData.append("phone", phoneInput.value.trim());
      formData.append("password", password);

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData
      });
    } else {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identity: username,
          password
        })
      });
    }

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.message || "Something went wrong."
      );
    }

    localStorage.setItem(
      "nicegold_token",
      data.token
    );

    localStorage.setItem(
      "nicegold_user",
      JSON.stringify(data.user)
    );

    showMessage(
      registerMode
        ? "Account created successfully."
        : "Login successful.",
      "success"
    );

    setTimeout(() => {
      window.location.href = "/chat.html";
    }, 700);

  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    authButton.disabled = false;

    authButton.textContent = registerMode
      ? "Create Account"
      : "Login";
  }
});

setMode(false);
