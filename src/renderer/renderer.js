const api = window.designhubWorker;
const baseUrl = "https://designhub-factory.sms890522.workers.dev";
const code = document.querySelector("#code");
const pair = document.querySelector("#pair");
const openSite = document.querySelector("#openSite");
const pairing = document.querySelector("#pairing");
const connected = document.querySelector("#connected");
const status = document.querySelector("#status");
const detail = document.querySelector("#detail");
const dot = document.querySelector("#dot");
const message = document.querySelector("#message");
const connectedText = document.querySelector("#connectedText");
const toggle = document.querySelector("#toggle");

function showStatus(next) {
  const online = Boolean(next?.connected);
  status.textContent = next?.running ? (online ? "자동화 실행 중" : "서버 연결 대기") : "일시정지";
  detail.textContent = next?.lastError || (next?.deviceName ? `${next.deviceName} · Codex ${next.codexStatus === "connected" ? "연결됨" : "로그인 확인 필요"}` : "홈페이지에서 연결 코드를 만든 뒤 입력하세요.");
  dot.classList.toggle("online", online);
  pairing.hidden = Boolean(next?.deviceName);
  connected.hidden = !next?.deviceName;
  if (next?.deviceName) connectedText.textContent = "프로그램을 켜두면 홈페이지의 예약 작업을 자동으로 처리합니다.";
  toggle.textContent = next?.running ? "일시정지" : "다시 시작";
}

pair.addEventListener("click", async () => {
  const normalized = code.value.replace(/\s+/g, "").toUpperCase();
  if (normalized.length !== 8) { message.textContent = "8자리 연결 코드를 입력해주세요."; return; }
  pair.disabled = true; message.textContent = "기기를 연결하는 중...";
  try { await api.pair({ code: normalized }); message.textContent = "연결되었습니다."; } catch (error) { message.textContent = error?.message || "연결에 실패했습니다."; } finally { pair.disabled = false; }
});
openSite.addEventListener("click", () => window.open(baseUrl, "_blank"));
toggle.addEventListener("click", async () => { const next = await api.getStatus(); if (next.running) await api.stop(); else await api.start(); });
document.querySelector("#disconnect").addEventListener("click", async () => { if (confirm("이 컴퓨터의 자동화를 해제할까요?")) await api.disconnect(); });
api.onStatus(showStatus);
api.getStatus().then(showStatus);
