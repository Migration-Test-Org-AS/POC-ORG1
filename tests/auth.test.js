import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto, pbkdf2Sync } from "node:crypto";
import { ACCOUNTS_STORAGE_KEY, createLocalAccounts, LocalAccountError } from "../auth.js";

const password = "Made-up-demo-42";

function makeStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("signup normalizes usernames and stores a native salted hash, never plaintext", async () => {
  const storage = makeStorage();
  const accounts = createLocalAccounts(storage, webcrypto);
  assert.equal(await accounts.signup("  Demo.User  ", password, password), "demo.user");
  assert.equal(accounts.getCurrentUser(), "demo.user");
  const raw = storage.getItem(ACCOUNTS_STORAGE_KEY);
  assert.equal(raw.includes(password), false);
  const saved = JSON.parse(raw).accounts[0];
  assert.equal(saved.salt.length, 32);
  assert.equal(saved.passwordHash, pbkdf2Sync(
    password, Buffer.from(saved.salt, "hex"), 600_000, 32, "sha256",
  ).toString("hex"));
  assert.deepEqual(accounts.getTasks(), []);
});

test("invalid signup input and mismatched passwords do not create accounts", async () => {
  const storage = makeStorage();
  const accounts = createLocalAccounts(storage, webcrypto);
  for (const username of ["ab", "", null, "contains spaces", "a".repeat(33), ".starts.with.dot"]) {
    await assert.rejects(accounts.signup(username, password, password), LocalAccountError);
  }
  for (const invalid of ["short", "", "        ", null, "a".repeat(129)]) {
    await assert.rejects(accounts.signup("demo", invalid, invalid), LocalAccountError);
  }
  await assert.rejects(accounts.signup("demo", password, "different"), /do not match/);
  assert.equal(storage.getItem(ACCOUNTS_STORAGE_KEY), null);
  assert.equal(accounts.getCurrentUser(), null);
});

test("duplicate usernames are rejected case-insensitively without overwriting tasks", async () => {
  const storage = makeStorage();
  const accounts = createLocalAccounts(storage, webcrypto);
  await accounts.signup("demo", password, password);
  const task = accounts.addTask("Keep this task");
  const before = storage.getItem(ACCOUNTS_STORAGE_KEY);
  await assert.rejects(accounts.signup(" DEMO ", password, password), /already exists/);
  assert.equal(storage.getItem(ACCOUNTS_STORAGE_KEY), before);
  assert.deepEqual(accounts.getTasks(), [task]);
});

test("logout and a new page session require login and restore saved task state", async () => {
  const storage = makeStorage();
  const accounts = createLocalAccounts(storage, webcrypto);
  await accounts.signup("demo", password, password);
  const first = accounts.addTask("First");
  const second = accounts.addTask("Second");
  accounts.toggleTask(first.id);
  accounts.removeTask(second.id);
  accounts.logout();
  assert.equal(accounts.getCurrentUser(), null);
  assert.throws(() => accounts.getTasks(), /Log in/);
  assert.throws(() => accounts.addTask("Not logged in"), /Log in/);
  const reloaded = createLocalAccounts(storage, webcrypto);
  assert.equal(reloaded.getCurrentUser(), null);
  await reloaded.login("DEMO", password);
  assert.deepEqual(reloaded.getTasks(), [{ ...first, completed: true }]);
  assert.notEqual(reloaded.addTask("New task").id, first.id);
});

test("wrong and missing credentials do not log in or change stored data", async () => {
  const storage = makeStorage();
  const accounts = createLocalAccounts(storage, webcrypto);
  await accounts.signup("demo", password, password);
  accounts.logout();
  const before = storage.getItem(ACCOUNTS_STORAGE_KEY);
  await assert.rejects(accounts.login("demo", "Wrong-demo-password"), /Incorrect username or password/);
  await assert.rejects(accounts.login("missing", password), /Incorrect username or password/);
  assert.equal(accounts.getCurrentUser(), null);
  assert.equal(storage.getItem(ACCOUNTS_STORAGE_KEY), before);
});

test("accounts have independent tasks and unique salts even with the same password", async () => {
  const storage = makeStorage();
  const accounts = createLocalAccounts(storage, webcrypto);
  await accounts.signup("first", password, password);
  const firstTask = accounts.addTask("Only for first");
  accounts.logout();
  await accounts.signup("second", password, password);
  assert.deepEqual(accounts.getTasks(), []);
  const secondTask = accounts.addTask("Only for second");
  const saved = JSON.parse(storage.getItem(ACCOUNTS_STORAGE_KEY)).accounts;
  assert.notEqual(saved[0].salt, saved[1].salt);
  assert.notEqual(saved[0].passwordHash, saved[1].passwordHash);
  accounts.logout();
  await accounts.login("first", password);
  assert.deepEqual(accounts.getTasks(), [firstTask]);
  accounts.logout();
  await accounts.login("second", password);
  assert.deepEqual(accounts.getTasks(), [secondTask]);
});

test("failed account writes do not create an account or a login session", async () => {
  const storage = makeStorage();
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  const accounts = createLocalAccounts(storage, webcrypto);
  await assert.rejects(accounts.signup("demo", password, password), /not saved/);
  assert.equal(storage.getItem(ACCOUNTS_STORAGE_KEY), null);
  assert.equal(accounts.getCurrentUser(), null);
});

test("failed task writes preserve saved tasks, completion, and deletion state", async () => {
  const storage = makeStorage();
  const accounts = createLocalAccounts(storage, webcrypto);
  await accounts.signup("demo", password, password);
  const task = accounts.addTask("Saved");
  const before = storage.getItem(ACCOUNTS_STORAGE_KEY);
  storage.setItem = () => { throw new Error("Storage blocked"); };
  assert.throws(() => accounts.addTask("Unsaved"), /not saved/);
  assert.throws(() => accounts.toggleTask(task.id), /not saved/);
  assert.throws(() => accounts.removeTask(task.id), /not saved/);
  assert.equal(storage.getItem(ACCOUNTS_STORAGE_KEY), before);
  assert.deepEqual(accounts.getTasks(), [task]);
});

test("blocked storage, corrupt JSON, and unknown versions fail explicitly", () => {
  assert.throws(() => createLocalAccounts({
    getItem() { throw new Error("Access denied"); },
  }, webcrypto), /Cannot read/);
  for (const raw of ["{bad", "null", '{"version":2,"accounts":[]}', '{"version":1,"accounts":{}}']) {
    const storage = makeStorage();
    storage.setItem(ACCOUNTS_STORAGE_KEY, raw);
    assert.throws(() => createLocalAccounts(storage, webcrypto), LocalAccountError);
    assert.equal(storage.getItem(ACCOUNTS_STORAGE_KEY), raw);
  }
});

test("malformed account credentials and tasks are preserved and rejected", () => {
  const valid = { username: "demo", salt: "a".repeat(32), passwordHash: "b".repeat(64), tasks: [] };
  for (const account of [
    null, { ...valid, username: "Invalid User" }, { ...valid, salt: "bad" },
    { ...valid, passwordHash: "plaintext" }, { ...valid, tasks: null },
    { ...valid, tasks: undefined },
    { ...valid, tasks: [{ id: 1, text: "", completed: false }] },
  ]) {
    const storage = makeStorage();
    const raw = JSON.stringify({ version: 1, accounts: [account] });
    storage.setItem(ACCOUNTS_STORAGE_KEY, raw);
    assert.throws(() => createLocalAccounts(storage, webcrypto), LocalAccountError);
    assert.equal(storage.getItem(ACCOUNTS_STORAGE_KEY), raw);
  }
});

test("unavailable or failing cryptography reports failure without storing accounts", async () => {
  for (const cryptography of [
    {}, { getRandomValues() { throw new Error("Random unavailable"); }, subtle: {} },
    { getRandomValues: (value) => webcrypto.getRandomValues(value),
      subtle: { async importKey() { throw new Error("Crypto unavailable"); } } },
  ]) {
    const storage = makeStorage();
    const accounts = createLocalAccounts(storage, cryptography);
    await assert.rejects(accounts.signup("demo", password, password), LocalAccountError);
    assert.equal(storage.getItem(ACCOUNTS_STORAGE_KEY), null);
    assert.equal(accounts.getCurrentUser(), null);
  }
});

test("concurrent signup rechecks usernames after asynchronous password derivation", async () => {
  const storage = makeStorage();
  const first = createLocalAccounts(storage, webcrypto);
  const second = createLocalAccounts(storage, webcrypto);
  const results = await Promise.allSettled([
    first.signup("demo", password, password), second.signup("demo", password, password),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(JSON.parse(storage.getItem(ACCOUNTS_STORAGE_KEY)).accounts.length, 1);
});

test("separate page sessions read the latest tasks before each write", async () => {
  const storage = makeStorage();
  const first = createLocalAccounts(storage, webcrypto);
  await first.signup("demo", password, password);
  const second = createLocalAccounts(storage, webcrypto);
  await second.login("demo", password);
  first.addTask("From first page");
  second.addTask("From second page");
  assert.deepEqual(first.getTasks().map((task) => task.text), ["From first page", "From second page"]);
});

test("removing an active account blocks stale sessions instead of recreating it", async () => {
  const storage = makeStorage();
  const accounts = createLocalAccounts(storage, webcrypto);
  await accounts.signup("demo", password, password);
  storage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify({ version: 1, accounts: [] }));
  assert.throws(() => accounts.getTasks(), /changed or was removed/);
  assert.throws(() => accounts.addTask("Stale"), /changed or was removed/);
  assert.deepEqual(JSON.parse(storage.getItem(ACCOUNTS_STORAGE_KEY)).accounts, []);
});
