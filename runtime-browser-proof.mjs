import { writeFileSync } from "node:fs";

const pages = await fetch("http://127.0.0.1:9224/json").then((response) => response.json());
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("No Chrome page target found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "Browser evaluation failed");
  return result.result.value;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
await command("Page.enable");
await command("Runtime.enable");
await wait(1500);

let bodyText = await evaluate("document.body.innerText");
if (!bodyText.includes("Runtime Proof Case")) {
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => /new case|create case/i.test(item.textContent));
    if (!button) throw new Error('Create case button not found: ' + document.body.innerText.slice(0, 500));
    button.click();
  })()`);
  await wait(300);
  await evaluate(`(() => {
    const input = [...document.querySelectorAll('input')].find((item) => /case name/i.test(item.placeholder || '') || /name/i.test(item.name || '')) || document.querySelector('input');
    if (!input) throw new Error('Case name input not found');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Runtime Proof Case');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(100);
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => /^create$/i.test(item.textContent.trim()) || /^save$/i.test(item.textContent.trim()));
    if (!button) throw new Error('Case submit button not found');
    button.click();
  })()`);
  await wait(1000);
  await evaluate(`(() => {
    const card = [...document.querySelectorAll('*')].find((item) => item.children.length === 0 && item.textContent.trim() === 'Runtime Proof Case');
    if (!card) throw new Error('Created case card not found');
    (card.closest('[class*="cursor-pointer"]') || card.closest('button') || card).click();
  })()`);
  await wait(1000);
}

const before = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Open Sequence Group Manager');
  if (!button) return { found: false, body: document.body.innerText.slice(0, 1000) };
  const style = getComputedStyle(button);
  const rect = button.getBoundingClientRect();
  return { found: true, display: style.display, visibility: style.visibility, opacity: style.opacity, width: rect.width, height: rect.height, inViewport: rect.top >= 0 && rect.bottom <= innerHeight };
})()`);
if (!before.found || before.display === "none" || before.visibility === "hidden" || before.width === 0 || before.height === 0) {
  throw new Error(`Manager button is not visibly rendered: ${JSON.stringify(before)}`);
}

await evaluate(`[...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Open Sequence Group Manager').click()`);
await wait(300);
const opened = await evaluate(`(() => {
  const heading = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].find((item) => item.textContent.trim() === 'Sequence Groups');
  const dialog = heading?.closest('.fixed.inset-0');
  return { heading: Boolean(heading), dialog: Boolean(dialog), visible: Boolean(dialog && getComputedStyle(dialog).display !== 'none') };
})()`);
if (!opened.heading || !opened.dialog || !opened.visible) throw new Error(`Manager modal did not visibly open: ${JSON.stringify(opened)}`);

const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync("runtime-sequence-group-manager.png", Buffer.from(screenshot.data, "base64"));

const splitAvailable = await evaluate(`(() => {
  const close = [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Close' && item.closest('.fixed.inset-0')?.querySelector('h3')?.textContent.trim() === 'Sequence Groups');
  if (!close) throw new Error('Manager close button not found');
  close.click();
  return true;
})()`);
await wait(300);
const afterClose = await evaluate(`![...document.querySelectorAll('.fixed.inset-0 h3')].some((item) => item.textContent.trim() === 'Sequence Groups')`);
await evaluate(`[...document.querySelectorAll('button')].find((item) => item.textContent.includes('Open AI Workspace')).click()`);
await wait(300);
const splitRendered = await evaluate(`document.body.innerText.includes('Reasoning Package — Split Case Files')`);

console.log(JSON.stringify({ before, opened, closed: afterClose, splitAvailable: splitAvailable && splitRendered, url: await evaluate("location.href") }, null, 2));
socket.close();
