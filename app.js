import { ACCOUNTS_STORAGE_KEY, createLocalAccounts, LocalAccountError } from "./auth.js";

let accounts;
let authMode = "login";
const authPanel = document.querySelector("#auth-panel");
const todoPanel = document.querySelector("#todo-panel");
const authForm = document.querySelector("#auth-form");
const username = document.querySelector("#username");
const password = document.querySelector("#password");
const confirmation = document.querySelector("#confirm-password");
const authSubmit = document.querySelector("#auth-submit");
const authError = document.querySelector("#auth-error");
const appError = document.querySelector("#app-error");
const sessionStatus = document.querySelector("#session-status");
const form = document.querySelector("#task-form");
const input = document.querySelector("#task-input");
const error = document.querySelector("#task-error");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const count = document.querySelector("#task-count");

function updateSummary() {
  const remaining = taskList.querySelectorAll('input[type="checkbox"]:not(:checked)').length;
  count.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;
  emptyState.hidden = taskList.children.length > 0;
}

function showError(element, failure) {
  const expected = failure instanceof LocalAccountError
    || failure instanceof TypeError || failure instanceof RangeError;
  if (!expected) {
    console.error(failure);
  }
  element.textContent = expected ? failure.message : "An unexpected error occurred. Please reload and try again.";
  element.hidden = false;
}

function hideError(element) {
  element.textContent = "";
  element.hidden = true;
}

function createTaskElement(task) {
  const item = document.createElement("li");
  item.className = "task";
  item.classList.toggle("is-complete", task.completed);

  const label = document.createElement("label");
  label.className = "task-label";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.completed;
  const text = document.createElement("span");
  text.className = "task-text";
  text.textContent = task.text;
  label.append(checkbox, text);

  checkbox.addEventListener("change", () => {
    try {
      const updatedTask = accounts.toggleTask(task.id);
      checkbox.checked = updatedTask.completed;
      item.classList.toggle("is-complete", updatedTask.completed);
      hideError(error);
      updateSummary();
    } catch (failure) {
      checkbox.checked = !checkbox.checked;
      showError(error, failure);
    }
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete task: ${task.text}`);
  deleteButton.addEventListener("click", () => {
    try {
      const nextFocus = item.nextElementSibling?.querySelector("input")
        ?? item.previousElementSibling?.querySelector("input")
        ?? input;
      accounts.removeTask(task.id);
      item.remove();
      hideError(error);
      updateSummary();
      nextFocus.focus();
    } catch (failure) {
      showError(error, failure);
    }
  });

  item.append(label, deleteButton);
  return item;
}

function clearError() {
  hideError(error);
  input.removeAttribute("aria-invalid");
}

function renderTasks() {
  const tasks = accounts.getTasks();
  taskList.replaceChildren(...tasks.map(createTaskElement));
  updateSummary();
}

function showAuth() {
  todoPanel.hidden = true;
  authPanel.hidden = false;
  taskList.replaceChildren();
  updateSummary();
  document.querySelector("#current-user").textContent = "";
  input.value = "";
  authForm.reset();
  clearError();
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  document.querySelector("#auth-title").textContent = signup ? "Create a demo account" : "Welcome back";
  document.querySelector("#auth-description").textContent = signup
    ? "Your personal task list, saved only in this browser."
    : "Log in to your demo account to see your saved tasks.";
  document.querySelector("#confirmation-field").hidden = !signup;
  confirmation.disabled = !signup;
  confirmation.required = signup;
  password.autocomplete = signup ? "new-password" : "current-password";
  password.value = "";
  confirmation.value = "";
  authSubmit.textContent = signup ? "Create demo account" : "Log in";
  for (const button of document.querySelectorAll("[data-auth-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.authMode === mode));
  }
  hideError(authError);
  username.focus();
}

function setAuthBusy(busy) {
  for (const control of authPanel.querySelectorAll("input, button")) {
    control.disabled = busy;
  }
  confirmation.disabled = busy || authMode !== "signup";
  authSubmit.textContent = busy
    ? (authMode === "signup" ? "Creating account..." : "Logging in...")
    : (authMode === "signup" ? "Create demo account" : "Log in");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const enteredUsername = username.value;
  const enteredPassword = password.value;
  const enteredConfirmation = confirmation.value;
  hideError(authError);
  hideError(appError);
  setAuthBusy(true);
  try {
    const signedInUser = authMode === "signup"
      ? await accounts.signup(enteredUsername, enteredPassword, enteredConfirmation)
      : await accounts.login(enteredUsername, enteredPassword);
    renderTasks();
    document.querySelector("#current-user").textContent = signedInUser;
    authPanel.hidden = true;
    todoPanel.hidden = false;
    authForm.reset();
    sessionStatus.textContent = `Signed in as ${signedInUser}. Tasks are saved only in this browser.`;
  } catch (failure) {
    accounts.logout();
    showAuth();
    username.value = enteredUsername;
    showError(authError, failure);
  } finally {
    setAuthBusy(false);
    (todoPanel.hidden ? username : input).focus();
  }
});

for (const button of document.querySelectorAll("[data-auth-mode]")) {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
}

document.querySelector("#logout").addEventListener("click", () => {
  accounts.logout();
  showAuth();
  setAuthMode("login");
  hideError(appError);
  sessionStatus.textContent = "Logged out. Your demo tasks remain saved in this browser.";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (input.value.trim() === "") {
    error.textContent = "Enter a task before adding it.";
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }

  try {
    const task = accounts.addTask(input.value);
    taskList.append(createTaskElement(task));
    input.value = "";
    clearError();
    updateSummary();
    input.focus();
  } catch (failure) {
    showError(error, failure);
  }
});

input.addEventListener("input", clearError);
authForm.addEventListener("input", () => hideError(authError));
window.addEventListener("storage", (event) => {
  if (event.key !== ACCOUNTS_STORAGE_KEY && event.key !== null) {
    return;
  }
  if (!accounts?.getCurrentUser()) {
    return;
  }
  try {
    renderTasks();
    hideError(appError);
  } catch (failure) {
    accounts.logout();
    showAuth();
    setAuthMode("login");
    sessionStatus.textContent = "Logged out because saved demo data changed.";
    showError(appError, failure);
  }
});

try {
  accounts = createLocalAccounts(window.localStorage);
} catch (failure) {
  setAuthBusy(true);
  showError(appError, failure instanceof LocalAccountError ? failure
    : new LocalAccountError("Browser storage is unavailable. Allow storage for this site and reload.", { cause: failure }));
}
updateSummary();
