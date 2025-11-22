const params = new URLSearchParams(window.location.search);
const jobId = params.get("job_id");

const elTitle = document.getElementById("title");
const elMetaBasic = document.getElementById("meta-basic");
const elMetaPred = document.getElementById("meta-pred");
const elMainSummary = document.getElementById("main-summary");
const elCmp = document.getElementById("cmp");
const elHist = document.getElementById("hist");
const elPerf = document.getElementById("perf");
const elBaseline = document.getElementById("baseline");
const elTokens = document.getElementById("tokens");
const elRaw = document.getElementById("raw-json");

if (!jobId) {
  elTitle.textContent = "缺少 job_id";
} else {
  loadDetail(jobId);
}

function fmtPct(val) {
  if (val === null || val === undefined) return "-";
  return `${(val * 100).toFixed(2)}%`;
}

function setMeta(meta, data) {
  meta.innerHTML = `
    <div><span class="label">Symbol</span>${data.symbol || "-"}</div>
    <div><span class="label">公司</span>${data.company || "-"}</div>
    <div><span class="label">Sector</span>${data.sector || "-"}</div>
    <div><span class="label">日期</span>${data.call_date || "-"}</div>
    <div><span class="label">Fiscal</span>FY${data.fiscal_year || "-"} Q${data.fiscal_quarter || "-"}</div>
    <div><span class="label">Post Return</span>${data.post_return != null ? fmtPct(data.post_return) : "未計算"}</div>
  `;
}

function setPred(meta, data) {
  const tokenUsage = data.token_usage || data.agent_result?.raw?.token_usage || {};
  const cost = tokenUsage.cost_usd != null ? `$${tokenUsage.cost_usd.toFixed(4)}` : "未知";
  meta.innerHTML = `
    <div><span class="label">Prediction</span>${data.prediction || "-"}</div>
    <div><span class="label">Confidence</span>${data.confidence != null ? (data.confidence * 100).toFixed(0) + "%" : "-"}</div>
    <div><span class="label">Correct?</span>${data.correct === null ? "未計算" : data.correct ? "✔" : "✖"}</div>
    <div><span class="label">API Cost</span>${cost}</div>
  `;
}

function renderNotes(key, notes) {
  if (!notes) return "";
  return `<strong>${key}</strong>\n${notes}`;
}

async function loadDetail(id) {
  elTitle.textContent = "載入中...";
  try {
    const res = await fetch(`/api/call/${id}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    elTitle.textContent = `${data.symbol || ""} 詳細分析`;
    setMeta(elMetaBasic, data);
    setPred(elMetaPred, data);

    const agent = data.agent_result || {};
    const notes = agent.raw?.notes || {};
    const summary = agent.summary || agent.prediction || "-";
    elMainSummary.innerHTML = `<p>${summary}</p>`;

    const clean = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      return ["n/a", "na", "none"].includes(s.toLowerCase()) ? null : s;
    };

    elCmp.textContent = clean(notes.peers) || "尚未產生（可能缺少 Neo4j 資料）";
    elHist.textContent = clean(notes.past) || "尚未產生（可能缺少 Neo4j 資料）";
    elPerf.textContent = clean(notes.financials) || "尚未產生（可能缺少 Neo4j 資料）";

    elBaseline.textContent = "Baseline 尚未接入（預留欄位）";

    const tokenUsage = data.token_usage || agent.raw?.token_usage || {};
    const tokensToShow = tokenUsage.cost_usd != null ? { cost_usd: tokenUsage.cost_usd, ...tokenUsage } : tokenUsage;
    elTokens.textContent = Object.keys(tokensToShow || {}).length ? JSON.stringify(tokensToShow, null, 2) : "N/A";

    elRaw.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error(err);
    elTitle.textContent = `載入失敗：${err.message}`;
  }
}
