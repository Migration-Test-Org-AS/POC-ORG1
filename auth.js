import { createTodoList } from "./todo.js";

export const ACCOUNTS_STORAGE_KEY = "poc-org1.demo-accounts.v1";
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const iterations = 600_000;

export class LocalAccountError extends Error {}

function normalizeUsername(username) {
  if (typeof username !== "string" || !usernamePattern.test(username.trim().toLowerCase())) {
    throw new LocalAccountError("Use a 3-32 character username with letters, numbers, dots, underscores, or hyphens. Start with a letter or number.");
  }
  return username.trim().toLowerCase();
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8
    || password.length > 128 || password.trim() === "") {
    throw new LocalAccountError("Use a demo password with 8-128 characters. Do not reuse a real password.");
  }
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createLocalAccounts(storage, cryptography = globalThis.crypto) {
  let currentAccount = null;

  function readState() {
    let raw;
    try {
      raw = storage.getItem(ACCOUNTS_STORAGE_KEY);
    } catch (cause) {
      throw new LocalAccountError("Cannot read demo accounts. Allow browser storage for this site and try again.", { cause });
    }
    if (raw === null) {
      return { version: 1, accounts: [] };
    }

    let state;
    try {
      state = JSON.parse(raw);
    } catch (cause) {
      throw new LocalAccountError("Saved demo data is unreadable. It was not reset or overwritten.", { cause });
    }

    const usernames = new Set();
    if (!state || state.version !== 1 || !Array.isArray(state.accounts)) {
      throw new LocalAccountError("Saved demo data has an unsupported format. It was not reset or overwritten.");
    }
    for (const account of state.accounts) {
      if (!account || typeof account.username !== "string"
        || !usernamePattern.test(account.username) || usernames.has(account.username)
        || typeof account.salt !== "string" || !/^[a-f0-9]{32}$/.test(account.salt)
        || typeof account.passwordHash !== "string" || !/^[a-f0-9]{64}$/.test(account.passwordHash)) {
        throw new LocalAccountError("Saved demo accounts are invalid. Stored data was not changed.");
      }
      try {
        if (!Array.isArray(account.tasks)) {
          throw new TypeError("Saved tasks must be a list.");
        }
        createTodoList(account.tasks);
      } catch (cause) {
        throw new LocalAccountError("Saved demo tasks are invalid. Stored data was not changed.", { cause });
      }
      usernames.add(account.username);
    }
    return state;
  }

  function writeState(state) {
    try {
      storage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(state));
    } catch (cause) {
      throw new LocalAccountError("Changes were not saved. Browser storage may be full or blocked. Free space or allow storage and try again.", { cause });
    }
  }

  function requireCrypto() {
    if (!cryptography?.subtle || typeof cryptography.getRandomValues !== "function") {
      throw new LocalAccountError("Password processing needs Web Crypto. Use a modern browser on HTTPS or localhost.");
    }
  }

  async function derivePassword(password, salt) {
    requireCrypto();
    const saltBytes = Uint8Array.from(salt.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
    try {
      const key = await cryptography.subtle.importKey(
        "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
      );
      const hash = await cryptography.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations }, key, 256,
      );
      return toHex(new Uint8Array(hash));
    } catch (cause) {
      throw new LocalAccountError("Password processing failed. No account changes were saved. Try a modern browser on HTTPS or localhost.", { cause });
    }
  }

  function signedInAccount(state) {
    if (!currentAccount) {
      throw new LocalAccountError("Log in to manage your demo tasks.");
    }
    const account = state.accounts.find((item) => item.username === currentAccount.username);
    if (!account || account.salt !== currentAccount.salt
      || account.passwordHash !== currentAccount.passwordHash) {
      throw new LocalAccountError("This demo account changed or was removed in another tab. Log out and log in again.");
    }
    return account;
  }

  function mutateTasks(action) {
    const state = readState();
    const account = signedInAccount(state);
    const todos = createTodoList(account.tasks);
    const result = action(todos);
    account.tasks = todos.getTasks();
    writeState(state);
    return result;
  }

  readState();

  return {
    async signup(username, password, confirmation) {
      username = normalizeUsername(username);
      validatePassword(password);
      if (password !== confirmation) {
        throw new LocalAccountError("The demo passwords do not match.");
      }
      if (readState().accounts.some((account) => account.username === username)) {
        throw new LocalAccountError("That username already exists in this browser. Log in instead.");
      }
      requireCrypto();
      let salt;
      try {
        salt = toHex(cryptography.getRandomValues(new Uint8Array(16)));
      } catch (cause) {
        throw new LocalAccountError("Could not generate a password salt. No account was saved.", { cause });
      }
      const passwordHash = await derivePassword(password, salt);
      const state = readState();
      if (state.accounts.some((account) => account.username === username)) {
        throw new LocalAccountError("That username was just created in another tab. Log in instead.");
      }
      const account = { username, salt, passwordHash, tasks: [] };
      state.accounts.push(account);
      writeState(state);
      currentAccount = { username, salt, passwordHash };
      return username;
    },

    async login(username, password) {
      username = normalizeUsername(username);
      validatePassword(password);
      const account = readState().accounts.find((item) => item.username === username);
      if (!account || await derivePassword(password, account.salt) !== account.passwordHash) {
        throw new LocalAccountError("Incorrect username or password.");
      }
      const latest = readState().accounts.find((item) => item.username === username);
      if (!latest || latest.salt !== account.salt || latest.passwordHash !== account.passwordHash) {
        throw new LocalAccountError("This demo account changed while logging in. Please try again.");
      }
      currentAccount = {
        username: account.username, salt: account.salt, passwordHash: account.passwordHash,
      };
      return username;
    },

    logout() {
      currentAccount = null;
    },

    getCurrentUser() {
      return currentAccount?.username ?? null;
    },

    getTasks() {
      return createTodoList(signedInAccount(readState()).tasks).getTasks();
    },

    addTask(text) {
      return mutateTasks((todos) => todos.add(text));
    },

    toggleTask(id) {
      return mutateTasks((todos) => todos.toggle(id));
    },

    removeTask(id) {
      return mutateTasks((todos) => todos.remove(id));
    },
  };
}
