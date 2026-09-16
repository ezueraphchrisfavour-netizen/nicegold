(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const form = $("auth-form");
  const authTitle = $("auth-title");
  const authSubtitle = $("auth-subtitle");
  const authButton = $("auth-button");
  const switchAuth = $("switch-auth");
  const message = $("auth-message");

  const nameGroup = $("name-group");
  const displayNameInput = $("displayName");

  const usernameInput = $("username");
  const usernameGroup = $("username-group");

  const phoneGroup = $("phone-group");
  const phoneInput = $("phone");

  const avatarGroup = $("avatar-group");
  const avatarInput = $("avatar");
  const avatarPreview = $("avatar-preview");
  const removeAvatar = $("remove-avatar");

  let registerMode = false;
  let avatarFile = null;

  function showLoader(show) {
    const loader = $("loader");

    if (!loader) return;

    if (show) {
      loader.style.display = "flex";
      loader.style.opacity = "1";
    } else {
      loader.style.opacity = "0";

      setTimeout(() => {
        loader.style.display = "none";
      }, 250);
    }
  }

  function showMessage(text, type = "info") {
    if (!message) return;

    message.textContent = text;

    if (type === "success") {
      message.style.color = "#36df83";
    } else if (type === "error") {
      message.style.color = "#ff6874";
    } else {
      message.style.color = "#9eb0ca";
    }
  }

  function setRequired(element, required) {
    if (!element) return;

    if (required) {
      element.setAttribute("required", "");
    } else {
      element.removeAttribute("required");
    }
  }

  function setMode(register) {
    registerMode = register;

    if (registerMode) {
      authTitle.textContent = "Create your account";

      authSubtitle.textContent =
        "Join NICEGOLD CHAT and start connecting.";

      authButton.textContent = "Create Account";

      switchAuth.textContent =
        "Already have an account? Login";

      nameGroup.classList.remove("hidden");
      phoneGroup.classList.remove("hidden");
      avatarGroup.classList.remove("hidden");

      setRequired(displayNameInput, true);
      setRequired(phoneInput, false);

      displayNameInput.focus();

    } else {
      authTitle.textContent = "Welcome back";

      authSubtitle.textContent =
        "Login to continue to NICEGOLD CHAT.";

      authButton.textContent = "Login";

      switchAuth.textContent =
        "Create a new account";

      nameGroup.classList.add("hidden");
      phoneGroup.classList.add("hidden");
      avatarGroup.classList.add("hidden");

      setRequired(displayNameInput, false);
      setRequired(phoneInput, false);

      displayNameInput.value = "";
      phoneInput.value = "";

      clearAvatar();
    }

    showMessage("");
  }

  function clearAvatar() {
    avatarFile = null;

    if (avatarInput) {
      avatarInput.value = "";
    }

    if (removeAvatar) {
      removeAvatar.hidden = true;
    }

    if (avatarPreview) {
      avatarPreview.innerHTML = "<span>+</span>";
    }
  }

  if (avatarInput) {
    avatarInput.addEventListener("change", () => {
      const file = avatarInput.files?.[0];

      if (!file) {
        clearAvatar();
        return;
      }

      const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (!allowed.includes(file.type)) {
        showMessage(
          "Please choose a JPG, PNG, or WEBP image.",
          "error"
        );

        clearAvatar();
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showMessage(
          "Profile picture must be 5MB or smaller.",
          "error"
        );

        clearAvatar();
        return;
      }

      avatarFile = file;

      const reader = new FileReader();

      reader.onload = () => {
        if (!avatarPreview) return;

        avatarPreview.innerHTML = "";

        const img = document.createElement("img");

        img.src = reader.result;
        img.alt = "Profile preview";

        avatarPreview.appendChild(img);

        if (removeAvatar) {
          removeAvatar.hidden = false;
        }
      };

      reader.readAsDataURL(file);

      showMessage("");
    });
  }

  if (removeAvatar) {
    removeAvatar.addEventListener("click", clearAvatar);
  }

  if (switchAuth) {
    switchAuth.addEventListener("click", () => {
      setMode(!registerMode);
    });
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = usernameInput.value.trim();
      const password = $("password").value;

      if (!username || !password) {
        showMessage(
          "Please enter your username and password.",
          "error"
        );
        return;
      }

      if (registerMode && !displayNameInput.value.trim()) {
        showMessage(
          "Please enter your name.",
          "error"
        );
        displayNameInput.focus();
        return;
      }

      authButton.disabled = true;

      authButton.textContent = registerMode
        ? "Creating account..."
        : "Logging in...";

      showMessage(
        registerMode
          ? "Creating your account..."
          : "Signing you in..."
      );

      try {
        let response;

        if (registerMode) {
          const formData = new FormData();

          formData.append(
            "displayName",
            displayNameInput.value.trim()
          );

          formData.append(
            "username",
            username
          );

          formData.append(
            "phone",
            phoneInput.value.trim()
          );

          formData.append(
            "password",
            password
          );

          if (avatarFile) {
            formData.append(
              "avatar",
              avatarFile
            );
          }

          response = await fetch(
            "/api/auth/register",
            {
              method: "POST",
              body: formData,
              credentials: "include"
            }
          );

        } else {

          response = await fetch(
            "/api/auth/login",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              credentials: "include",
              body: JSON.stringify({
                identity: username,
                password
              })
            }
          );
        }

        let data = {};

        try {
          data = await response.json();
        } catch {
          throw new Error(
            "The server returned an invalid response."
          );
        }

        if (!response.ok || !data.ok) {
          throw new Error(
            data.message ||
            data.error ||
            "Authentication failed."
          );
        }

        if (!data.token) {
          throw new Error(
            "The server did not return a login token."
          );
        }

        localStorage.setItem(
          "nicegold_token",
          data.token
        );

        if (data.user) {
          localStorage.setItem(
            "nicegold_user",
            JSON.stringify(data.user)
          );
        }

        showMessage(
          registerMode
            ? "Account created successfully."
            : "Login successful.",
          "success"
        );

        setTimeout(() => {
          window.location.replace("/chat.html");
        }, 500);

      } catch (error) {
        console.error("NICEGOLD AUTH ERROR:", error);

        showMessage(
          error.message ||
          "Unable to complete authentication.",
          "error"
        );

        authButton.disabled = false;

        authButton.textContent = registerMode
          ? "Create Account"
          : "Login";
      }
    });
  }

  showLoader(false);
  setMode(false);

})();
