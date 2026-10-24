import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import http from "http";

const outDir = path.resolve("tmp/gift-shots");
fs.mkdirSync(outDir, { recursive: true });
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shot(name, url) {
  const file = path.join(outDir, name);
  await new Promise((resolve, reject) => {
    const child = spawn(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=1440,900",
      `--screenshot=${file}`,
      url,
    ], { stdio: "ignore" });
    child.on("exit", (code) => (code === 0 || fs.existsSync(file) ? resolve() : reject(new Error(`chrome ${code}`))));
  });
  console.log("wrote", file, fs.statSync(file).size);
}

const draft = JSON.stringify({
  recipients: [{ name: "Ada", email: "ada@email.com" }],
  message: "For the table tonight.",
  wrap: true,
  assignments: {},
  step: 1,
});

const bootHtml = `<!doctype html><html><body><script>
localStorage.setItem("yodla-gift-draft", ${JSON.stringify(draft)});
location.replace("http://127.0.0.1:4173/gifting.html");
</script></body></html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(bootHtml);
});

await new Promise((r) => server.listen(4179, "127.0.0.1", r));
await shot("step1.png", "http://127.0.0.1:4179/boot.html");
server.close();

// also capture homepage for comparison
await shot("home.png", "http://127.0.0.1:4173/");
