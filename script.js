// Registrar o plugin ChartDataLabels
Chart.register(ChartDataLabels);

const el = id => document.getElementById(id);

const SPREADSHEET_ID = "1yX5uIgoUNqXJDG6hYxOLjZfYueviAa6M";

const URL_FILA = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=1716569787`;
const URL_FILA_RETROATIVA = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=506350386`;
const URL_AGENDAMENTOS_VIVVER = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=1546152833`;
const URL_FATURADO = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=252919053`;
const URL_FINANCEIRO = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=269446681`;
const URL_AGENDADOS = "https://docs.google.com/spreadsheets/d/1ax8ZpVRSZnDkTm_T1GY37ybSgrlP_8Rk/export?format=csv&gid=429397138";

const MONTHS_ORDER = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const GRUPOS_SIGTAP = {
  "03": "03 - Procedimentos clínicos",
  "04": "04 - Procedimentos cirúrgicos"
};

let dadosFila = [];
let dadosFilaRetroativa = [];
let dadosAgendamentosVivver = [];
let dadosFaturado = [];
let dadosFinanceiro = [];
let dadosAgendados = [];

let gruposSet = new Set();
let especialidadesSet = new Set();
let subgruposSet = new Set();

let especialidadeToGrupos = new Map();
let especialidadeToSubgrupos = new Map();

let allPeriodos = [];
let currentYearShort = null;
let latestDataCorte = "";
let latestDataCorteRetroativa = "";

let selectedSubgrupos = new Set();
let selectedEspecialidades = new Set();

let charts = {};
let currentTableDataFisico = [];
let currentSortColumnFisico = 0;
let currentSortDirectionFisico = "asc";
let currentTableMonthFilterFisico = "";
let currentChartFilter = null;

function toast(msg, type = "info") {
  const box = el("toastBox");
  if (!box) return;
  const d = document.createElement("div");
  d.className = `toast ${type}`;
  let icon = "circle-info";
  if (type === "success") icon = "circle-check";
  if (type === "error") icon = "triangle-exclamation";
  d.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${msg}`;
  box.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

function normalizeText(v) { return String(v ?? "").trim(); }
function normalizeKey(v) { return normalizeText(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase().trim(); }
function escapeHtml(t) { return String(t ?? "").replace(/[&<>"]/g, m => { if (m === "&") return "&amp;"; if (m === "<") return "&lt;"; if (m === ">") return "&gt;"; if (m === '"') return "&quot;"; return m; }); }
function truncateLabel(t, max = 30) { const s = String(t ?? ""); return s.length > max ? s.slice(0, max - 3) + "..." : s; }
function formatMoney(v) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function formatMoneyCompact(v) { const n = Number(v || 0); if (n >= 1000000) return "R$ " + (n / 1000000).toFixed(1) + "M"; if (n >= 1000) return "R$ " + (n / 1000).toFixed(1) + " mil"; return formatMoney(n); }

function parseNumberBR(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let s = String(value).trim();
  if (!s || /^sem dados$/i.test(s) || s === "-" || s === "NT") return 0;
  s = s.replace(/\s/g, "").replace(/R\$/gi, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) { s = s.replace(/\./g, "").replace(",", "."); }
    else { s = s.replace(/,/g, ""); }
  } else if (hasComma) { s = s.replace(/\./g, "").replace(",", "."); }
  else { s = s.replace(/,/g, ""); }
  s = s.replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizePeriodo(label) {
  let s = normalizeText(label).toLowerCase();
  if (!s) return "";
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").replace(/\./g, "").replace(/-/g, "/");
  let extractedYear = null;
  const yearMatch = s.match(/\/(\d{2,4})$/);
  if (yearMatch) {
    const yearNum = parseInt(yearMatch[1], 10);
    if (yearNum >= 100) { extractedYear = String(yearNum).slice(-2); }
    else { extractedYear = String(yearNum).padStart(2, '0'); }
    s = s.replace(/\/(\d{2,4})$/, '');
  }
  for (let i = 0; i < MONTHS_FULL.length; i++) {
    if (s.startsWith(MONTHS_FULL[i])) {
      const yy = extractedYear || currentYearShort || "25";
      return `${MONTHS_ORDER[i]}/${yy}`;
    }
  }
  const shortMatch = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i);
  if (shortMatch) {
    const yy = extractedYear || currentYearShort || "25";
    return `${shortMatch[1].toLowerCase()}/${yy}`;
  }
  const fullMatch = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2,4})$/i);
  if (fullMatch) {
    let yy = String(fullMatch[2]).slice(-2);
    if (yy.length === 1) yy = "0" + yy;
    return `${fullMatch[1].toLowerCase()}/${yy}`;
  }
  const numericMatch = s.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (numericMatch) {
    const m = parseInt(numericMatch[1], 10);
    let yy = String(numericMatch[2]).slice(-2);
    if (m >= 1 && m <= 12) return `${MONTHS_ORDER[m - 1]}/${yy}`;
  }
  return "";
}

function periodoSortValue(label) {
  const p = normalizePeriodo(label);
  const match = p.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{2})$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const mesIndex = MONTHS_ORDER.indexOf(match[1].toLowerCase());
  const ano = 2000 + parseInt(match[2], 10);
  return ano * 100 + mesIndex;
}

function sortPeriodos(list) { return [...new Set((list || []).map(normalizePeriodo).filter(Boolean))].sort((a, b) => periodoSortValue(a) - periodoSortValue(b)); }
function getField(row, aliases = []) { const keys = Object.keys(row || {}); for (const alias of aliases) { if (alias in row) return row[alias]; const found = keys.find(k => normalizeKey(k) === normalizeKey(alias)); if (found) return row[found]; } return ""; }

function detectHeaderIndex(rows, expectedHeaders = []) {
  if (!rows?.length) return -1;
  for (let i = 0; i < rows.length; i++) {
    const row = (rows[i] || []).map(v => normalizeKey(v));
    const score = expectedHeaders.filter(h => row.some(col => col === normalizeKey(h))).length;
    if (score >= Math.max(2, Math.ceil(expectedHeaders.length * 0.5))) return i;
  }
  return -1;
}

async function loadCSVSmart(url, expectedHeaders = []) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
  const text = await response.text();
  const parsed = Papa.parse(text, { skipEmptyLines: false });
  const rawRows = parsed.data || [];
  const headerIndex = detectHeaderIndex(rawRows, expectedHeaders);
  if (headerIndex === -1) throw new Error("Cabeçalho CSV não localizado.");
  const headers = (rawRows[headerIndex] || []).map(h => normalizeText(h));
  const dataRows = rawRows.slice(headerIndex + 1);
  return dataRows.map(row => { const obj = {}; headers.forEach((header, idx) => { if (header) obj[header] = row?.[idx] ?? ""; }); return obj; }).filter(obj => Object.values(obj).some(v => normalizeText(v) !== ""));
}

function extractGrupoCodigo(grupoTexto) { const match = String(grupoTexto || "").match(/^(\d{2})/); return match ? match[1] : ""; }
function extractSubgrupoCodigo(subgrupoTexto) { const match = String(subgrupoTexto || "").match(/^(\d{4})/); return match ? match[1] : ""; }
function addMapSet(map, key, value) { if (!key || !value) return; if (!map.has(key)) map.set(key, new Set()); map.get(key).add(value); }

function getDominantYearShort(periodos) {
  const years = {};
  (periodos || []).forEach(p => {
    const norm = normalizePeriodo(p);
    const match = norm.match(/\/(\d{2})$/);
    if (match) { const year = match[1]; years[year] = (years[year] || 0) + 1; }
  });
  if (Object.keys(years).length === 0) return "25";
  const sorted = Object.entries(years).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

function aggregateBy(items, keyFn, valFn) { const map = new Map(); items.forEach(item => { const key = keyFn(item); if (!key) return; map.set(key, (map.get(key) || 0) + valFn(item)); }); return map; }

async function loadAllData() {
  const loadingEl = el("loading");
  if (loadingEl) loadingEl.classList.add("on");
  try {
    console.log("Iniciando carregamento dos dados...");
    const [filaRaw, filaRetroativaRaw, agVivverRaw, faturadoRaw, financeiroRaw, agendadosRaw] = await Promise.all([
      loadCSVSmart(URL_FILA, ["Código do Procedimento", "Especialidade", "Descrição do Procedimento", "Grupo", "Subgrupo", "TOTAL", "Data Corte"]),
      loadCSVSmart(URL_FILA_RETROATIVA, ["Código do Procedimento", "Especialidade", "Descrição do Procedimento", "Grupo", "Subgrupo", "Complexidade- Sigtap", "TOTAL", "Data Corte/ Fila de Espera"]),
      loadCSVSmart(URL_AGENDAMENTOS_VIVVER, ["CÓDIGO DO PROCEDIMENTO", "PROCEDIMENTO DESCRIÇÃO", "GRUPO", "SUBGRUPO", "ESTABELECIMENTO", "ESPECIALIDADE", "COMPLEXIDADE", "MÊS", "FAL", "REC", "OFERTA"]),
      loadCSVSmart(URL_FATURADO, ["Procedimento Descrição", "GRUPO", "SUB GRUPO", "ESTABELECIMENTO", "Especialidade Descrição"]),
      loadCSVSmart(URL_FINANCEIRO, ["PROCEDIMENTO DESCRIÇÃO", "GRUPO", "SUBGRUPO", "ESTABELECIMENTO", "ESPECIALIDADE"]),
      loadCSVSmart(URL_AGENDADOS, ["ESTABELECIMENTO", "ESPECIALIDADE", "Grupo Sigtap", "Sub Grupo Sigtap"])
    ]);
    console.log("Dados carregados:", { 
      fila: filaRaw.length, 
      filaRetroativa: filaRetroativaRaw.length, 
      vivver: agVivverRaw.length, 
      faturado: faturadoRaw.length, 
      financeiro: financeiroRaw.length, 
      agendados: agendadosRaw.length 
    });

    const allRawPeriods = [];
    filaRaw.forEach(row => { const dataCorte = normalizeText(getField(row, ["Data Corte/ Fila de Espera", "DATA CORTE/ FILA DE ESPERA", "Data Corte"])); if (dataCorte) allRawPeriods.push(dataCorte); });
    filaRetroativaRaw.forEach(row => { const dataCorte = normalizeText(getField(row, ["Data Corte/ Fila de Espera", "DATA CORTE/ FILA DE ESPERA", "Data Corte"])); if (dataCorte) allRawPeriods.push(dataCorte); });
    agVivverRaw.forEach(row => { const mes = normalizeText(getField(row, ["MÊS"])); if (mes) allRawPeriods.push(mes); });
    agendadosRaw.forEach(row => { Object.keys(row).forEach(col => { const colLower = col.toLowerCase(); const hasMonth = MONTHS_FULL.some(month => colLower.includes(month)) || MONTHS_ORDER.some(month => colLower === month); if (hasMonth) { const yearMatch = col.match(/(\d{4})/); if (yearMatch) { allRawPeriods.push(`${col}/${yearMatch[1]}`); } else { allRawPeriods.push(col); } } }); });
    
    const detectedYear = getDominantYearShort(allRawPeriods);
    currentYearShort = detectedYear || "25";
    console.log(`Ano detectado: 20${currentYearShort}`);

    gruposSet = new Set(); especialidadesSet = new Set(); subgruposSet = new Set(); especialidadeToGrupos = new Map(); especialidadeToSubgrupos = new Map();

    let latestDateValue = ""; let latestDateSortValue = -1;
    dadosFila = filaRaw.map(r => {
      const especialidade = normalizeText(getField(r, ["Especialidade", "ESPECIALIDADE"]));
      const estabelecimento = normalizeText(getField(r, ["PRESTADOR", "ESTABELECIMENTO", "Estabelecimento"]));
      const grupoRaw = normalizeText(getField(r, ["Grupo", "GRUPO"]));
      const subgrupoRaw = normalizeText(getField(r, ["Subgrupo", "SUBGRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const subgrupoCodigo = extractSubgrupoCodigo(subgrupoRaw);
      const dataCorteRaw = normalizeText(getField(r, ["Data Corte/ Fila de Espera", "DATA CORTE/ FILA DE ESPERA", "Data Corte"]));
      const dataCorteNorm = normalizePeriodo(dataCorteRaw);
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      if (subgrupoRaw) subgruposSet.add(subgrupoRaw);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      if (dataCorteNorm) { const sortVal = periodoSortValue(dataCorteNorm); if (sortVal > latestDateSortValue) { latestDateSortValue = sortVal; latestDateValue = dataCorteNorm; } }
      return { codigo: normalizeText(getField(r, ["Código do Procedimento", "CÓDIGO DO PROCEDIMENTO"])), especialidade, descricao: normalizeText(getField(r, ["Descrição do Procedimento", "PROCEDIMENTO DESCRIÇÃO"])), grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""), grupoCodigo, subgrupo: subgrupoRaw, subgrupoCodigo, complexidade: normalizeText(getField(r, ["Complexidade- Sigtap", "COMPLEXIDADE"])), estabelecimento, fila: parseNumberBR(getField(r, ["TOTAL", "Total"])), dataCorte: dataCorteNorm, origem: "principal" };
    }).filter(d => d.especialidade || d.descricao);
    latestDataCorte = latestDateValue || "Não disponível";

    let latestDateRetroativaValue = ""; let latestDateRetroativaSortValue = -1;
    dadosFilaRetroativa = filaRetroativaRaw.map(r => {
      const especialidade = normalizeText(getField(r, ["Especialidade", "ESPECIALIDADE"]));
      const estabelecimento = normalizeText(getField(r, ["PRESTADOR", "ESTABELECIMENTO", "Estabelecimento"]));
      const grupoRaw = normalizeText(getField(r, ["Grupo", "GRUPO"]));
      const subgrupoRaw = normalizeText(getField(r, ["Subgrupo", "SUBGRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const subgrupoCodigo = extractSubgrupoCodigo(subgrupoRaw);
      const dataCorteRaw = normalizeText(getField(r, ["Data Corte/ Fila de Espera", "DATA CORTE/ FILA DE ESPERA", "Data Corte"]));
      const dataCorteNorm = normalizePeriodo(dataCorteRaw);
      const complexidade = normalizeText(getField(r, ["Complexidade- Sigtap", "COMPLEXIDADE"]));
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      if (subgrupoRaw) subgruposSet.add(subgrupoRaw);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      if (dataCorteNorm) { const sortVal = periodoSortValue(dataCorteNorm); if (sortVal > latestDateRetroativaSortValue) { latestDateRetroativaSortValue = sortVal; latestDateRetroativaValue = dataCorteNorm; } }
      return { codigo: normalizeText(getField(r, ["Código do Procedimento", "CÓDIGO DO PROCEDIMENTO"])), especialidade, descricao: normalizeText(getField(r, ["Descrição do Procedimento", "PROCEDIMENTO DESCRIÇÃO"])), grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""), grupoCodigo, subgrupo: subgrupoRaw, subgrupoCodigo, complexidade, estabelecimento, fila: parseNumberBR(getField(r, ["TOTAL", "Total"])), dataCorte: dataCorteNorm, origem: "retroativa" };
    }).filter(d => d.especialidade || d.descricao);
    latestDataCorteRetroativa = latestDateRetroativaValue || "Não disponível";

    const dataCorteElement = el("dataCorteInfo");
    if (dataCorteElement) dataCorteElement.innerHTML = `<i class="fa-regular fa-calendar"></i> Data de corte: ${latestDataCorte}`;
    const dataCorteRetroativaElement = el("dataCorteRetroativaInfo");
    if (dataCorteRetroativaElement) dataCorteRetroativaElement.innerHTML = `<i class="fa-regular fa-calendar"></i> Data de corte: ${latestDataCorteRetroativa}`;
    const dataCorteRetroativaCardElement = el("dataCorteRetroativaInfoCard");
    if (dataCorteRetroativaCardElement) dataCorteRetroativaCardElement.innerHTML = `<i class="fa-regular fa-calendar"></i> Data de corte: ${latestDataCorteRetroativa}`;

    dadosAgendamentosVivver = agVivverRaw.map(r => {
      const especialidade = normalizeText(getField(r, ["ESPECIALIDADE", "Especialidade"]));
      const estabelecimento = normalizeText(getField(r, ["ESTABELECIMENTO", "PRESTADOR", "Estabelecimento"]));
      const grupoRaw = normalizeText(getField(r, ["GRUPO"]));
      const subgrupoRaw = normalizeText(getField(r, ["SUBGRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const subgrupoCodigo = extractSubgrupoCodigo(subgrupoRaw);
      const mesRaw = normalizeText(getField(r, ["MÊS"]));
      let mesNorm = normalizePeriodo(mesRaw);
      if (mesNorm && !mesNorm.includes("/")) mesNorm = `${mesNorm}/${currentYearShort}`;
      let recepcionados = parseNumberBR(getField(r, ["REC"]));
      let faltosos = parseNumberBR(getField(r, ["FAL"]));
      let oferta = parseNumberBR(getField(r, ["OFERTA"]));
      if ((recepcionados > 0 || faltosos > 0) && oferta !== recepcionados + faltosos) oferta = recepcionados + faltosos;
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      if (subgrupoRaw) subgruposSet.add(subgrupoRaw);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      return { codigo: normalizeText(getField(r, ["CÓDIGO DO PROCEDIMENTO"])), descricao: normalizeText(getField(r, ["PROCEDIMENTO DESCRIÇÃO"])), especialidade, estabelecimento, grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""), grupoCodigo, subgrupo: subgrupoRaw, subgrupoCodigo, complexidade: normalizeText(getField(r, ["COMPLEXIDADE"])), mes: mesNorm, faltosos, recepcionados, oferta };
    }).filter(d => d.especialidade || d.descricao);

    dadosFaturado = [];
    const monthColumns = [...MONTHS_ORDER];
    faturadoRaw.forEach(row => {
      const especialidade = normalizeText(getField(row, ["Especialidade Descrição", "ESPECIALIDADE"]));
      const estabelecimento = normalizeText(getField(row, ["ESTABELECIMENTO", "Estabelecimento"]));
      const grupoRaw = normalizeText(getField(row, ["GRUPO"]));
      const subgrupoRaw = normalizeText(getField(row, ["SUB GRUPO", "SUBGRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const descricao = normalizeText(getField(row, ["Procedimento Descrição", "PROCEDIMENTO DESCRIÇÃO"]));
      const codigo = normalizeText(getField(row, ["CÓDIGO DO PROCEDIMENTO", "Código do Procedimento"]));
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      if (subgrupoRaw) subgruposSet.add(subgrupoRaw);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      for (let i = 0; i < monthColumns.length; i++) {
        const monthKey = monthColumns[i];
        const monthValue = parseNumberBR(getField(row, [monthKey, `${monthKey}/${currentYearShort}`, `${monthKey}/25`, monthKey.toUpperCase()]));
        if (monthValue > 0) { const mesFormatado = `${monthColumns[i]}/${currentYearShort}`; dadosFaturado.push({ codigo, descricao, especialidade, estabelecimento: estabelecimento || "Não informado", grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""), grupoCodigo, subgrupo: subgrupoRaw, subgrupoCodigo: extractSubgrupoCodigo(subgrupoRaw), mes: mesFormatado, quantidade: monthValue }); }
      }
    });

    dadosFinanceiro = [];
    financeiroRaw.forEach(row => {
      const especialidade = normalizeText(getField(row, ["ESPECIALIDADE", "Especialidade"]));
      const estabelecimento = normalizeText(getField(row, ["ESTABELECIMENTO", "Estabelecimento"]));
      const grupoRaw = normalizeText(getField(row, ["GRUPO"]));
      const subgrupoRaw = normalizeText(getField(row, ["SUBGRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const descricao = normalizeText(getField(row, ["PROCEDIMENTO DESCRIÇÃO"]));
      const codigo = normalizeText(getField(row, ["CÓDIGO PROCEDIMENTO", "CÓDIGO DO PROCEDIMENTO"]));
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      if (subgrupoRaw) subgruposSet.add(subgrupoRaw);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      for (let i = 0; i < monthColumns.length; i++) {
        const monthKey = monthColumns[i];
        const monthValue = parseNumberBR(getField(row, [monthKey, `${monthKey}/${currentYearShort}`, monthKey.toUpperCase()]));
        if (monthValue > 0) { const mesFormatado = `${monthColumns[i]}/${currentYearShort}`; dadosFinanceiro.push({ codigo, descricao, especialidade, estabelecimento: estabelecimento || "Não informado", grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""), grupoCodigo, subgrupo: subgrupoRaw, subgrupoCodigo: extractSubgrupoCodigo(subgrupoRaw), mes: mesFormatado, valor: monthValue }); }
      }
    });

    dadosAgendados = [];
    agendadosRaw.forEach(row => {
      const estabelecimento = normalizeText(getField(row, ["ESTABELECIMENTO", "Estabelecimento"]));
      const especialidade = normalizeText(getField(row, ["ESPECIALIDADE", "Especialidade"]));
      const grupoSigtap = normalizeText(getField(row, ["Grupo Sigtap", "GRUPO SIGTAP"]));
      const subGrupoSigtap = normalizeText(getField(row, ["Sub Grupo Sigtap", "SUB GRUPO SIGTAP"]));
      
      if (!estabelecimento && !especialidade) return;
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoSigtap) gruposSet.add(extractGrupoCodigo(grupoSigtap));
      if (subGrupoSigtap) subgruposSet.add(subGrupoSigtap);
      
      const monthMap = { "janeiro": "jan", "fevereiro": "fev", "março": "mar", "abril": "abr", "maio": "mai", "junho": "jun", "julho": "jul", "agosto": "ago", "setembro": "set", "outubro": "out", "novembro": "nov", "dezembro": "dez" };
      
      Object.keys(row).forEach(col => {
        const colLower = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let shortMonth = null;
        let extractedYear = null;
        
        const yearMatch = col.match(/(\d{4})/);
        if (yearMatch) extractedYear = yearMatch[1].slice(-2);
        
        for (const [full, short] of Object.entries(monthMap)) { 
          if (colLower === full || colLower === short || colLower.includes(full) || colLower.includes(short)) { 
            shortMonth = short; 
            break; 
          }
        }
        
        if (!shortMonth) return;
        
        const value = parseNumberBR(row[col]);
        if (value <= 0) return;
        
        const yearToUse = extractedYear || currentYearShort;
        if (!yearToUse) return;
        
        dadosAgendados.push({ 
          estabelecimento: estabelecimento || "Não informado", 
          especialidade, 
          mes: `${shortMonth}/${yearToUse}`, 
          agendados: value,
          grupo: grupoSigtap,
          grupoCodigo: extractGrupoCodigo(grupoSigtap),
          subgrupo: subGrupoSigtap,
          subgrupoCodigo: extractSubgrupoCodigo(subGrupoSigtap)
        });
      });
    });

    const allPeriodsCollected = [...dadosFila.map(d => d.dataCorte), ...dadosFilaRetroativa.map(d => d.dataCorte), ...dadosAgendamentosVivver.map(d => d.mes), ...dadosFaturado.map(d => d.mes), ...dadosFinanceiro.map(d => d.mes), ...dadosAgendados.map(d => d.mes)].filter(Boolean);
    allPeriodos = sortPeriodos(allPeriodsCollected);
    console.log("Períodos encontrados:", allPeriodos);
    console.log("Especialidades:", [...especialidadesSet].length);
    console.log("Fila principal registros:", dadosFila.length);
    console.log("Fila retroativa registros:", dadosFilaRetroativa.length);
    console.log("Ano atual usado:", currentYearShort);

    populateFilters();
    updateLastUpdate();
    applyFilters();
    toast("Dados carregados com sucesso!", "success");
  } catch (e) { console.error("Erro detalhado:", e); toast(`Erro ao carregar dados: ${e.message}`, "error"); }
  finally { if (loadingEl) loadingEl.classList.remove("on"); }
}

function updateLastUpdate() { const now = new Date(); const last = el("lastUpdate"); if (last) last.textContent = `Última atualização: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`; }

function populateFilters() {
  const grupoSelect = el("grupoSelect");
  if (grupoSelect) grupoSelect.innerHTML = '<option value="">Todos os grupos</option>' + [...gruposSet].sort().map(cod => `<option value="${escapeHtml(cod)}">${escapeHtml(GRUPOS_SIGTAP[cod] || cod)}</option>`).join("");
  const periodoSelect = el("periodoSelect");
  if (periodoSelect) periodoSelect.innerHTML = '<option value="">Todos os meses</option>' + allPeriodos.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  const tableMonthFilterFisico = el("tableMonthFilterFisico");
  if (tableMonthFilterFisico) tableMonthFilterFisico.innerHTML = '<option value="">Todos os meses</option>' + allPeriodos.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  const tabelaMonthFilterEspec = el("tabelaMonthFilterEspec");
  if (tabelaMonthFilterEspec) tabelaMonthFilterEspec.innerHTML = '<option value="">Todos os meses</option>' + allPeriodos.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  buildSubgrupoList(); buildEspecialidadeList();
}

function getVisibleSubgrupos() {
  const grupo = el("grupoSelect")?.value || "";
  const allFilaData = [...dadosFila, ...dadosFilaRetroativa];
  let subgrupos = new Set();
  [...allFilaData, ...dadosAgendamentosVivver, ...dadosFaturado, ...dadosFinanceiro, ...dadosAgendados].forEach(d => { if (!d.subgrupo) return; if (grupo && d.grupoCodigo !== grupo) return; subgrupos.add(d.subgrupo); });
  return [...subgrupos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function getVisibleEspecialidades() { return [...especialidadesSet].sort((a, b) => a.localeCompare(b, "pt-BR")); }

function buildSubgrupoList() {
  const list = el("msListSub"); if (!list) return;
  const arr = getVisibleSubgrupos();
  selectedSubgrupos.forEach(s => { if (!arr.includes(s)) selectedSubgrupos.delete(s); });
  list.innerHTML = arr.length ? arr.map(sub => `<div class="ms-item" data-value="${escapeHtml(sub)}"><input type="checkbox" value="${escapeHtml(sub)}" ${selectedSubgrupos.has(sub) ? "checked" : ""}><span>${escapeHtml(sub)}</span></div>`).join("") : '<div class="ms-empty">Nenhum subgrupo</div>';
  list.querySelectorAll(".ms-item").forEach(item => { const cb = item.querySelector("input"); cb.addEventListener("change", () => { if (cb.checked) selectedSubgrupos.add(cb.value); else selectedSubgrupos.delete(cb.value); updateMsLabelSub(); applyFilters(); }); item.addEventListener("click", e => { if (e.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change")); } }); });
  updateMsLabelSub();
}

function buildEspecialidadeList() {
  const list = el("msListEsp"); if (!list) return;
  const arr = getVisibleEspecialidades();
  selectedEspecialidades.forEach(s => { if (!arr.includes(s)) selectedEspecialidades.delete(s); });
  list.innerHTML = arr.length ? arr.map(item => `<div class="ms-item" data-value="${escapeHtml(item)}"><input type="checkbox" value="${escapeHtml(item)}" ${selectedEspecialidades.has(item) ? "checked" : ""}><span>${escapeHtml(item)}</span></div>`).join("") : '<div class="ms-empty">Nenhuma especialidade</div>';
  list.querySelectorAll(".ms-item").forEach(item => { const cb = item.querySelector("input"); cb.addEventListener("change", () => { if (cb.checked) selectedEspecialidades.add(cb.value); else selectedEspecialidades.delete(cb.value); updateMsLabelEsp(); applyFilters(); }); item.addEventListener("click", e => { if (e.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change")); } }); });
  updateMsLabelEsp();
}

function updateMsLabelSub() { const label = el("msLabelSub"); if (label) label.textContent = selectedSubgrupos.size ? `${selectedSubgrupos.size} selecionado(s)` : "Todos"; }
function updateMsLabelEsp() { const label = el("msLabelEsp"); if (label) label.textContent = selectedEspecialidades.size ? `${selectedEspecialidades.size} selecionado(s)` : "Todos"; }
function closeAllDropdowns() { ["Sub", "Esp"].forEach(suf => { const dd = el(`msDropdown${suf}`); const tr = el(`msTrigger${suf}`); if (dd) dd.classList.remove("open"); if (tr) tr.classList.remove("open"); }); }
function toggleMsDropdownSub(e) { e.stopPropagation(); const dd = el("msDropdownSub"); const tr = el("msTriggerSub"); if (!dd || !tr) return; const willOpen = !dd.classList.contains("open"); closeAllDropdowns(); if (willOpen) { dd.classList.add("open"); tr.classList.add("open"); } }
function toggleMsDropdownEsp(e) { e.stopPropagation(); const dd = el("msDropdownEsp"); const tr = el("msTriggerEsp"); if (!dd || !tr) return; const willOpen = !dd.classList.contains("open"); closeAllDropdowns(); if (willOpen) { dd.classList.add("open"); tr.classList.add("open"); } }
function selectAllSub(e) { e.preventDefault(); selectedSubgrupos = new Set(getVisibleSubgrupos()); buildSubgrupoList(); applyFilters(); }
function clearSubSelection(e) { e.preventDefault(); selectedSubgrupos.clear(); buildSubgrupoList(); applyFilters(); }
function selectAllEsp(e) { e.preventDefault(); selectedEspecialidades = new Set(getVisibleEspecialidades()); buildEspecialidadeList(); applyFilters(); }
function clearEspSelection(e) { e.preventDefault(); selectedEspecialidades.clear(); buildEspecialidadeList(); applyFilters(); }
function filterMsListSub() { const q = (el("msSearchSub")?.value || "").toLowerCase(); const list = el("msListSub"); if (!list) return; list.querySelectorAll(".ms-item").forEach(item => { const text = item.querySelector("span")?.textContent?.toLowerCase() || ""; item.style.display = text.includes(q) ? "" : "none"; }); }
function filterMsListEsp() { const q = (el("msSearchEsp")?.value || "").toLowerCase(); const list = el("msListEsp"); if (!list) return; list.querySelectorAll(".ms-item").forEach(item => { const text = item.querySelector("span")?.textContent?.toLowerCase() || ""; item.style.display = text.includes(q) ? "" : "none"; }); }

function especialidadeMatchesGrupo(especialidade, grupoCodigo) { if (!grupoCodigo) return true; const set = especialidadeToGrupos.get(especialidade); return set ? set.has(grupoCodigo) : false; }
function especialidadeMatchesSubgrupos(especialidade, selectedSubs) { if (!selectedSubs.size) return true; const set = especialidadeToSubgrupos.get(especialidade); if (!set) return false; for (const s of selectedSubs) if (set.has(s)) return true; return false; }

function matchBaseWithDimensions(item, hasGroupFields = true) {
  const grupo = el("grupoSelect")?.value || "";
  const periodo = el("periodoSelect")?.value || "";
  const especialidadeMatch = !selectedEspecialidades.size || selectedEspecialidades.has(item.especialidade);
  const periodoMatch = !periodo || item.mes === periodo || item.dataCorte === periodo;
  let grupoMatch = true, subgrupoMatch = true;
  if (hasGroupFields && item.grupoCodigo !== undefined) { grupoMatch = !grupo || item.grupoCodigo === grupo; subgrupoMatch = !selectedSubgrupos.size || selectedSubgrupos.has(item.subgrupo); }
  else { grupoMatch = especialidadeMatchesGrupo(item.especialidade, grupo); subgrupoMatch = especialidadeMatchesSubgrupos(item.especialidade, selectedSubgrupos); }
  return especialidadeMatch && periodoMatch && grupoMatch && subgrupoMatch;
}
function matchFaturadoFinanceiro(item) { const grupo = el("grupoSelect")?.value || ""; const periodo = el("periodoSelect")?.value || ""; const especialidadeMatch = !selectedEspecialidades.size || selectedEspecialidades.has(item.especialidade); const periodoMatch = !periodo || item.mes === periodo; const grupoMatch = !grupo || item.grupoCodigo === grupo; const subgrupoMatch = !selectedSubgrupos.size || selectedSubgrupos.has(item.subgrupo); return especialidadeMatch && periodoMatch && grupoMatch && subgrupoMatch; }

function createGaugeChart(canvasId, percent, color) {
  const canvas = el(canvasId); if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (charts[canvasId]) { charts[canvasId].destroy(); delete charts[canvasId]; }
  const pctVal = Math.min(Math.max(percent, 0), 100);
  charts[canvasId] = new Chart(ctx, { type: "doughnut", data: { datasets: [{ data: [50, 30, 20], backgroundColor: ["rgba(220,38,38,.45)", "rgba(217,119,6,.45)", "rgba(5,150,105,.45)"], borderWidth: 0, hoverOffset: 0, weight: 1 }, { data: [pctVal, 100 - pctVal], backgroundColor: [color, "rgba(226,232,240,0.0)"], borderWidth: 0, borderRadius: 8, hoverOffset: 0, weight: 2 }] }, options: { rotation: -90, circumference: 180, cutout: "68%", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } }, animation: { animateRotate: true, duration: 900 } } });
}

function applyFilters() {
  console.log("Aplicando filtros...");
  const filteredFila = dadosFila.filter(d => matchBaseWithDimensions(d, true));
  const filteredAgVivver = dadosAgendamentosVivver.filter(d => matchBaseWithDimensions(d, true));
  const filteredAgendados = dadosAgendados.filter(d => matchBaseWithDimensions(d, true));
  const filteredFaturado = dadosFaturado.filter(d => matchFaturadoFinanceiro(d));
  const filteredFinanceiro = dadosFinanceiro.filter(d => matchFaturadoFinanceiro(d));

  console.log("Dados filtrados - Fila:", filteredFila.length, "Agendamentos Vivver:", filteredAgVivver.length);

  const totalFila = filteredFila.reduce((s, d) => s + d.fila, 0);
  const totalRecepcionados = filteredAgVivver.reduce((s, d) => s + d.recepcionados, 0);
  const totalFaltosos = filteredAgVivver.reduce((s, d) => s + d.faltosos, 0);
  const totalAgendados = filteredAgendados.reduce((s, d) => s + d.agendados, 0);
  const totalFaturadosQtd = filteredFaturado.reduce((s, d) => s + d.quantidade, 0);
  const totalFinanceiro = filteredFinanceiro.reduce((s, d) => s + d.valor, 0);
  
  const totalFilaRetroativa = dadosFilaRetroativa.reduce((s, d) => s + d.fila, 0);
  const kFilaRetroativaCard = el("kFilaRetroativaCard");
  if (kFilaRetroativaCard) kFilaRetroativaCard.innerText = totalFilaRetroativa.toLocaleString("pt-BR");

  if (el("kFila")) el("kFila").innerText = totalFila.toLocaleString("pt-BR");
  if (el("kRecepcionados")) el("kRecepcionados").innerText = totalRecepcionados.toLocaleString("pt-BR");
  if (el("kFaltosos")) el("kFaltosos").innerText = totalFaltosos.toLocaleString("pt-BR");
  if (el("kAgendadosTotal")) el("kAgendadosTotal").innerText = totalAgendados.toLocaleString("pt-BR");
  if (el("kFaturadosQtd")) el("kFaturadosQtd").innerText = totalFaturadosQtd.toLocaleString("pt-BR");
  if (el("kFinanceiro")) el("kFinanceiro").innerText = formatMoney(totalFinanceiro);

  const agVivverTotal = filteredAgVivver.reduce((s, d) => s + d.oferta, 0);
  const recepcionadosGauge = filteredAgVivver.reduce((s, d) => s + d.recepcionados, 0);
  const faltososGauge = filteredAgVivver.reduce((s, d) => s + d.faltosos, 0);
  const taxaFaturamento = totalAgendados > 0 ? (totalFaturadosQtd / totalAgendados) * 100 : 0;
  const taxaAbsenteismo = agVivverTotal > 0 ? (faltososGauge / agVivverTotal) * 100 : 0;

  if (el("subAgendados")) el("subAgendados").textContent = `Base agendados | ${totalAgendados.toLocaleString("pt-BR")} procedimentos`;
  if (el("subRecepcionados")) el("subRecepcionados").textContent = `${agVivverTotal > 0 ? ((totalRecepcionados / agVivverTotal) * 100).toFixed(1) : "0.0"}% da oferta convertida em recepção`;
  if (el("subFaltosos")) el("subFaltosos").textContent = `${taxaAbsenteismo.toFixed(1)}% sobre a oferta do Vivver`;
  if (el("subFaturadosQtd")) el("subFaturadosQtd").textContent = `${taxaFaturamento.toFixed(1)}% dos agendados convertidos`;
  if (el("subFinanceiro")) el("subFinanceiro").textContent = `Base financeira consolidada no escopo de período`;

  let fatColor, fatBadgeBg, fatBadgeColor, fatBadgeText;
  if (taxaFaturamento >= 80) { fatColor = "#059669"; fatBadgeBg = "rgba(5,150,105,.20)"; fatBadgeColor = "#065f46"; fatBadgeText = "✓ Ótimo"; }
  else if (taxaFaturamento >= 50) { fatColor = "#d97706"; fatBadgeBg = "rgba(217,119,6,.18)"; fatBadgeColor = "#92400e"; fatBadgeText = "⚠ Regular"; }
  else { fatColor = "#dc2626"; fatBadgeBg = "rgba(220,38,38,.16)"; fatBadgeColor = "#991b1b"; fatBadgeText = "✗ Crítico"; }
  if (el("gaugeFatPct")) { el("gaugeFatPct").textContent = taxaFaturamento.toFixed(1) + "%"; el("gaugeFatPct").style.color = fatColor; }
  if (el("gaugeFatBadge")) { el("gaugeFatBadge").textContent = fatBadgeText; el("gaugeFatBadge").style.background = fatBadgeBg; el("gaugeFatBadge").style.color = fatBadgeColor; el("gaugeFatBadge").style.border = `1px solid ${fatColor}55`; }
  if (el("gFatAg")) el("gFatAg").textContent = totalAgendados.toLocaleString("pt-BR");
  if (el("gFatFat")) el("gFatFat").textContent = totalFaturadosQtd.toLocaleString("pt-BR");
  if (el("gFatDiff")) el("gFatDiff").textContent = Math.max(0, totalAgendados - totalFaturadosQtd).toLocaleString("pt-BR");
  createGaugeChart("cGaugeFat", taxaFaturamento, fatColor);

  let absColor, absBadgeBg, absBadgeColor, absBadgeText;
  if (taxaAbsenteismo <= 10) { absColor = "#059669"; absBadgeBg = "rgba(5,150,105,.20)"; absBadgeColor = "#065f46"; absBadgeText = "✓ Excelente"; }
  else if (taxaAbsenteismo <= 20) { absColor = "#3b82f6"; absBadgeBg = "rgba(59,130,246,.18)"; absBadgeColor = "#1d4ed8"; absBadgeText = "✓ Bom"; }
  else if (taxaAbsenteismo <= 35) { absColor = "#d97706"; absBadgeBg = "rgba(217,119,6,.18)"; absBadgeColor = "#92400e"; absBadgeText = "⚠ Atenção"; }
  else { absColor = "#dc2626"; absBadgeBg = "rgba(220,38,38,.16)"; absBadgeColor = "#991b1b"; absBadgeText = "✗ Crítico"; }
  if (el("gaugeAbsPct")) { el("gaugeAbsPct").textContent = taxaAbsenteismo.toFixed(1) + "%"; el("gaugeAbsPct").style.color = absColor; }
  if (el("gaugeAbsBadge")) { el("gaugeAbsBadge").textContent = absBadgeText; el("gaugeAbsBadge").style.background = absBadgeBg; el("gaugeAbsBadge").style.color = absBadgeColor; el("gaugeAbsBadge").style.border = `1px solid ${absColor}55`; }
  if (el("gAbsAg")) el("gAbsAg").textContent = agVivverTotal.toLocaleString("pt-BR");
  if (el("gAbsRec")) el("gAbsRec").textContent = recepcionadosGauge.toLocaleString("pt-BR");
  if (el("gAbsAus")) el("gAbsAus").textContent = faltososGauge.toLocaleString("pt-BR");
  createGaugeChart("cGaugeAbs", taxaAbsenteismo, absColor);

  renderVisaoGeral(filteredFila, filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro);
  renderFinanceiro(filteredFinanceiro);
  renderFisicoFinanceiro(filteredAgendados, filteredFaturado, filteredFinanceiro);
  renderEstabelecimento(filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro);
  renderAgendamentosVivver(filteredAgVivver);
  renderFila(filteredFila);
  renderFilaRetroativa();
}

function renderSimpleRankingTable(tbodyId, dataMap, isMoney = false) {
  const tbody = el(tbodyId); if (!tbody) return;
  const arr = [...dataMap.entries()].sort((a, b) => b[1] - a[1]);
  if (!arr.length) { tbody.innerHTML = `<tr><td colspan="2">Nenhum dado disponível</td></tr>`; return; }
  tbody.innerHTML = arr.map(([name, value]) => `<tr><td title="${escapeHtml(name)}">${escapeHtml(truncateLabel(name, 55))}</td><td class="text-right font-700">${isMoney ? formatMoney(value) : value.toLocaleString("pt-BR")}</td></tr>`).join("");
}

function renderPercentReferenceTable(tbodyId, valueMap, referenceMap, color = "#0b5e42") {
  const tbody = el(tbodyId); if (!tbody) return;
  const arr = [...valueMap.entries()].sort((a, b) => b[1] - a[1]);
  if (!arr.length) { tbody.innerHTML = `<tr><td colspan="3">Nenhum dado disponível</td></tr>`; return; }
  const maxValue = arr[0][1] || 1;
  tbody.innerHTML = arr.map(([name, value]) => { 
    const ref = referenceMap.get(name) || 0; 
    const percent = ref > 0 ? ((value / ref) * 100) : 0; 
    const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
    const percentDisplay = percent > 0 ? `${percent.toFixed(1)}%` : "0%";
    // Determina se a barra é muito pequena para mostrar o texto dentro
    const isBarTooSmall = barWidth < 15;
    return `<tr>
      <td title="${escapeHtml(name)}">${escapeHtml(truncateLabel(name, 45))}</td>
      <td class="text-right font-700">${value.toLocaleString("pt-BR")}</td>
      <td>
        <div class="progress-bar-container" style="position: relative;">
          <div class="progress-bar-fill" style="width:${barWidth}%; background: linear-gradient(90deg, ${color}, ${color}dd);">
            ${!isBarTooSmall ? `<span style="color: white;">${percentDisplay}</span>` : ''}
          </div>
          ${isBarTooSmall ? `<span style="position: absolute; left: ${Math.max(barWidth + 5, 0)}%; top: 50%; transform: translateY(-50%); color: #1f2937; font-size: 11px; font-weight: 700; white-space: nowrap;">${percentDisplay}</span>` : ''}
        </div>
      </td>
    </tr>`; 
  }).join("");
}

function renderPercentageTotalTable(tbodyId, dataMap, color = "#0b5e42") {
  const tbody = el(tbodyId); if (!tbody) return;
  const arr = [...dataMap.entries()].sort((a, b) => b[1] - a[1]);
  const total = arr.reduce((s, [,v]) => s + v, 0);
  const maxValue = arr[0]?.[1] || 1;
  if (!arr.length) { tbody.innerHTML = `<tr><td colspan="3">Nenhum dado disponível</td></tr>`; return; }
  tbody.innerHTML = arr.map(([name, value]) => { const percent = total > 0 ? (value / total) * 100 : 0; const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0; const percentDisplay = percent > 0 ? `${percent.toFixed(1)}%` : "0%"; return `<tr><td title="${escapeHtml(name)}">${escapeHtml(truncateLabel(name, 55))}</td><td class="text-right font-700">${value.toLocaleString("pt-BR")}</td><td><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${barWidth}%; background: linear-gradient(90deg, ${color}, ${color}dd);"><span style="${barWidth < 15 ? 'position:absolute;left:100%;margin-left:8px;color:#111' : ''}">${percentDisplay}</span></div></div></td></tr>`; }).join("");
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function makeHorizontalBarChart(id, labels, values, color, datasetLabel, isMoney = false, dataLabelFontSize = 13) {
  const canvas = el(id); if (!canvas) return;
  destroyChart(id);
  charts[id] = new Chart(canvas.getContext("2d"), { 
    type: "bar", 
    data: { 
      labels, 
      datasets: [{ 
        label: datasetLabel, 
        data: values, 
        backgroundColor: color, 
        borderRadius: 8, 
        barPercentage: 0.72, 
        categoryPercentage: 0.82 
      }] 
    }, 
    options: { 
      responsive: true, 
      maintainAspectRatio: false, 
      indexAxis: "y", 
      layout: { padding: { top: 8, right: 24, bottom: 8, left: 8 } }, 
      plugins: { 
        legend: { display: true, position: "top", labels: { font: { weight: "bold", size: 13 } } }, 
        tooltip: { callbacks: { label: ctx => isMoney ? formatMoney(ctx.raw) : ctx.raw.toLocaleString("pt-BR") } }, 
        datalabels: { 
          color: function(context) {
            // Se o valor for muito pequeno (menos de 5% do máximo), coloca texto escuro fora da barra
            const value = context.dataset.data[context.dataIndex];
            const maxValue = Math.max(...context.dataset.data);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return percentage < 12 ? "#1f2937" : "#ffffff";
          },
          font: { weight: "bold", size: dataLabelFontSize }, 
          anchor: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const maxValue = Math.max(...context.dataset.data);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            // Se a barra for muito pequena, ancora o texto no final da barra (fora)
            return percentage < 12 ? "end" : "center";
          },
          align: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const maxValue = Math.max(...context.dataset.data);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            // Se a barra for pequena, alinha o texto à direita (fora da barra)
            return percentage < 12 ? "right" : "center";
          },
          offset: function(context) {
            const value = context.dataset.data[context.dataIndex];
            const maxValue = Math.max(...context.dataset.data);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            // Dá um espaçamento extra quando o texto está fora da barra
            return percentage < 12 ? 8 : 0;
          },
          formatter: value => { 
            if (!value) return ""; 
            return isMoney ? formatMoneyCompact(value) : value.toLocaleString("pt-BR"); 
          } 
        } 
      }, 
      scales: { 
        x: { 
          beginAtZero: true, 
          grid: { color: "rgba(148,163,184,0.10)" }, 
          ticks: { font: { weight: "bold", size: 11 }, callback: value => isMoney ? formatMoneyCompact(value) : value.toLocaleString("pt-BR") } 
        }, 
        y: { grid: { display: false }, ticks: { font: { weight: "bold", size: 11 } } } 
      } 
    } 
  });
}

function renderAgendadasPorEspecialidadeEstabTable(filteredAgendados) {
  const tbody = el("tableAgendadasPorEspecEstabBody"); if (!tbody) return;
  const searchTerm = (el("tabelaSearchEspec")?.value || "").toLowerCase();
  const monthFilter = el("tabelaMonthFilterEspec")?.value || "";
  if (!filteredAgendados.length) { tbody.innerHTML = '<tr><td colspan="8">Nenhum dado disponível</td></tr>'; return; }
  const estabelecimentosFixos = ["Belo Horizonte", "Centro Materno Infantil", "Hospital Municipal de Contagem", "Hospital São José", "Hospital Santa Rita"];
  const normalizeEstabName = name => { const nameLower = String(name || "").toLowerCase(); if (nameLower.includes("belo horizonte") || nameLower.includes("bh")) return "Belo Horizonte"; if (nameLower.includes("centro materno") || nameLower.includes("materno infantil")) return "Centro Materno Infantil"; if (nameLower.includes("contagem")) return "Hospital Municipal de Contagem"; if (nameLower.includes("são josé") || nameLower.includes("sao jose")) return "Hospital São José"; if (nameLower.includes("santa rita")) return "Hospital Santa Rita"; return name; };
  const map = new Map();
  filteredAgendados.forEach(d => { if (!d.especialidade) return; const key = `${d.especialidade}||${d.mes}`; if (!map.has(key)) map.set(key, { especialidade: d.especialidade, mes: d.mes, valores: { "Belo Horizonte": 0, "Centro Materno Infantil": 0, "Hospital Municipal de Contagem": 0, "Hospital São José": 0, "Hospital Santa Rita": 0 }, total: 0 }); const item = map.get(key); const estabNormalizado = normalizeEstabName(d.estabelecimento); if (estabelecimentosFixos.includes(estabNormalizado)) item.valores[estabNormalizado] += d.agendados; item.total += d.agendados; });
  let rows = [...map.values()].sort((a, b) => { if (a.especialidade !== b.especialidade) return a.especialidade.localeCompare(b.especialidade, "pt-BR"); return periodoSortValue(a.mes) - periodoSortValue(b.mes); });
  if (monthFilter) rows = rows.filter(r => r.mes === monthFilter);
  if (searchTerm) rows = rows.filter(r => r.especialidade.toLowerCase().includes(searchTerm));
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8">Nenhum dado encontrado com os filtros aplicados</td></tr>'; return; }
  const totalsByEstab = { "Belo Horizonte": 0, "Centro Materno Infantil": 0, "Hospital Municipal de Contagem": 0, "Hospital São José": 0, "Hospital Santa Rita": 0 };
  let grandTotal = 0;
  rows.forEach(row => { estabelecimentosFixos.forEach(estab => { totalsByEstab[estab] += row.valores[estab]; }); grandTotal += row.total; });
  tbody.innerHTML = rows.map(r => `<tr><td title="${escapeHtml(r.especialidade)}">${escapeHtml(truncateLabel(r.especialidade, 35))}</td><td>${escapeHtml(r.mes)}</td><td class="text-right">${r.valores["Belo Horizonte"].toLocaleString("pt-BR")}</td><td class="text-right">${r.valores["Centro Materno Infantil"].toLocaleString("pt-BR")}</td><td class="text-right">${r.valores["Hospital Municipal de Contagem"].toLocaleString("pt-BR")}</td><td class="text-right">${r.valores["Hospital São José"].toLocaleString("pt-BR")}</td><td class="text-right">${r.valores["Hospital Santa Rita"].toLocaleString("pt-BR")}</td><td class="text-right font-800" style="background:#f0fdfa;">${r.total.toLocaleString("pt-BR")}</td></tr>`).join("") + `<tr class="total-row"><td colspan="2" class="font-800">TOTAL GERAL</td><td class="text-right font-800">${totalsByEstab["Belo Horizonte"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${totalsByEstab["Centro Materno Infantil"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${totalsByEstab["Hospital Municipal de Contagem"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${totalsByEstab["Hospital São José"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${totalsByEstab["Hospital Santa Rita"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${grandTotal.toLocaleString("pt-BR")}</td></tr>`;
}

function renderAgendadosVsFaturadosChart(periods, agendadosValues, faturadosValues) {
  const canvas = el("cAgendadosVsFaturadosMes"); if (!canvas) return;
  destroyChart("cAgendadosVsFaturadosMes");
  const datasets = [];
  if (currentChartFilter !== "faturados") datasets.push({ label: "Agendados", data: agendadosValues, backgroundColor: "#b6923e", borderRadius: 8 });
  if (currentChartFilter !== "agendados") datasets.push({ label: "Faturados", data: faturadosValues, backgroundColor: "#059669", borderRadius: 8 });
  if (datasets.length === 0) datasets.push({ label: "Agendados", data: agendadosValues, backgroundColor: "#b6923e", borderRadius: 8 });
  charts.cAgendadosVsFaturadosMes = new Chart(canvas.getContext("2d"), { type: "bar", data: { labels: periods, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 12, right: 20, bottom: 10, left: 10 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.raw || 0).toLocaleString("pt-BR")}` } }, datalabels: { color: "#fff", font: { weight: "bold", size: 12 }, formatter: value => value ? value.toLocaleString("pt-BR") : "", anchor: "center", align: "center" } }, scales: { x: { grid: { display: false }, ticks: { font: { weight: "bold" } } }, y: { beginAtZero: true, grace: "10%", grid: { color: "rgba(148,163,184,0.10)" }, ticks: { font: { weight: "bold" } } } } } });
}

function setupChartLegendClick(periods, agendadosValues, faturadosValues) {
  const legendContainer = el("legendAgendadosFaturados"); if (!legendContainer) return;
  const legendItems = legendContainer.querySelectorAll(".legend-item"); if (legendItems.length !== 2) return;
  const agendadosItem = legendItems[0], faturadosItem = legendItems[1];
  const newAgendadosItem = agendadosItem.cloneNode(true), newFaturadosItem = faturadosItem.cloneNode(true);
  agendadosItem.parentNode.replaceChild(newAgendadosItem, agendadosItem);
  faturadosItem.parentNode.replaceChild(newFaturadosItem, faturadosItem);
  newAgendadosItem.style.cursor = "pointer"; newFaturadosItem.style.cursor = "pointer";
  function updateLegendActiveStyle() { newAgendadosItem.classList.remove("active-filter"); newFaturadosItem.classList.remove("active-filter"); if (currentChartFilter === "agendados") newAgendadosItem.classList.add("active-filter"); else if (currentChartFilter === "faturados") newFaturadosItem.classList.add("active-filter"); }
  newAgendadosItem.addEventListener("click", (e) => { e.stopPropagation(); currentChartFilter = currentChartFilter === "agendados" ? null : "agendados"; renderAgendadosVsFaturadosChart(periods, agendadosValues, faturadosValues); updateLegendActiveStyle(); });
  newFaturadosItem.addEventListener("click", (e) => { e.stopPropagation(); currentChartFilter = currentChartFilter === "faturados" ? null : "faturados"; renderAgendadosVsFaturadosChart(periods, agendadosValues, faturadosValues); updateLegendActiveStyle(); });
  updateLegendActiveStyle();
}

function renderVisaoGeral(filteredFila, filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro) {
  const combinedFilaData = [...filteredFila, ...dadosFilaRetroativa];
  const allPeriodsFromData = getPeriodsFromFilteredData(combinedFilaData, filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro);
  const periods = allPeriodsFromData.length ? allPeriodsFromData : [];
  
  console.log("Períodos para visão geral (incluindo dados retroativos):", periods);
  
  const filaPorMes = aggregateBy(combinedFilaData, d => d.dataCorte, d => d.fila);
  const ofertaPorMes = aggregateBy(filteredAgVivver, d => d.mes, d => d.oferta);
  const recepcionadosPorMes = aggregateBy(filteredAgVivver, d => d.mes, d => d.recepcionados);
  const faltososPorMes = aggregateBy(filteredAgVivver, d => d.mes, d => d.faltosos);
  
  renderMixedEvolutionChart(periods, filaPorMes, ofertaPorMes, recepcionadosPorMes, faltososPorMes);
  
  const agendadosPorMes = aggregateBy(filteredAgendados, d => d.mes, d => d.agendados);
  const faturadosQtdPorMes = aggregateBy(filteredFaturado, d => d.mes, d => d.quantidade);
  const financeiroPorMes = aggregateBy(filteredFinanceiro, d => d.mes, d => d.valor);
  const agendadosValues = periods.map(p => agendadosPorMes.get(p) || 0);
  const faturadosValues = periods.map(p => faturadosQtdPorMes.get(p) || 0);
  const agendadosMedia = agendadosValues.reduce((a, b) => a + b, 0) / (agendadosValues.filter(v => v > 0).length || 1);
  const faturadosMedia = faturadosValues.reduce((a, b) => a + b, 0) / (faturadosValues.filter(v => v > 0).length || 1);
  const legendContainer = el("legendAgendadosFaturados");
  if (legendContainer) { legendContainer.innerHTML = `<div class="legend-item"><div class="legend-color agendados"></div><span>Agendados</span><span style="font-weight:900;color:var(--primary-dark)">(Média: ${Math.round(agendadosMedia).toLocaleString("pt-BR")})</span></div><div class="legend-item"><div class="legend-color faturados"></div><span>Faturados</span><span style="font-weight:900;color:var(--primary-dark)">(Média: ${Math.round(faturadosMedia).toLocaleString("pt-BR")})</span></div>`; setupChartLegendClick(periods, agendadosValues, faturadosValues); }
  renderAgendadosVsFaturadosChart(periods, agendadosValues, faturadosValues);
  makeLineChart("cReceitaFinanceiraMes", periods, [{ label: "Receita Financeira", data: periods.map(p => financeiroPorMes.get(p) || 0), borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.10)", borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: "#ffffff", pointBorderColor: "#059669", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8 }], true, true);
  const financeiroEstab = aggregateBy(filteredFinanceiro, d => d.estabelecimento, d => d.valor);
  const topFinanceiroEstab = [...financeiroEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  makeHorizontalBarChart("cFatEstabelecimento", topFinanceiroEstab.map(([k]) => truncateLabel(k, 28)), topFinanceiroEstab.map(([,v]) => v), "#059669", "Financeiro", true, 12);
  const totalOferta = filteredAgVivver.reduce((s, d) => s + d.oferta, 0);
  const totalRecepcionados = filteredAgVivver.reduce((s, d) => s + d.recepcionados, 0);
  const totalFaltosos = filteredAgVivver.reduce((s, d) => s + d.faltosos, 0);
  makeDoughnutChartWithPercentages("cFunil", ["Ofertas", "Recepcionados", "Faltosos"], [totalOferta, totalRecepcionados, totalFaltosos], ["#2563eb", "#059669", "#d97706"]);
  renderAgendadasPorEspecialidadeEstabTable(filteredAgendados);
  const searchInput = el("tabelaSearchEspec"), monthSelect = el("tabelaMonthFilterEspec");
  if (searchInput && !searchInput.dataset.bound) { searchInput.dataset.bound = "1"; searchInput.addEventListener("input", () => renderAgendadasPorEspecialidadeEstabTable(filteredAgendados)); }
  if (monthSelect && !monthSelect.dataset.bound) { monthSelect.dataset.bound = "1"; monthSelect.addEventListener("change", () => renderAgendadasPorEspecialidadeEstabTable(filteredAgendados)); }
}

function renderFinanceiro(filteredFinanceiro) {
  const periods = getPeriodsFromFilteredData(filteredFinanceiro);
  const financeiroPorMes = aggregateBy(filteredFinanceiro, d => d.mes, d => d.valor);
  const financeiroEstab = aggregateBy(filteredFinanceiro, d => d.estabelecimento, d => d.valor);
  
  const totalGeral = filteredFinanceiro.reduce((s, d) => s + d.valor, 0);
  const mediaMensal = periods.length > 0 ? totalGeral / periods.length : 0;
  let maiorValor = 0, maiorMes = "";
  for (const [mes, valor] of financeiroPorMes.entries()) {
      if (valor > maiorValor) { maiorValor = valor; maiorMes = mes; }
  }
  
  if (el("finTotalGeral")) el("finTotalGeral").innerText = formatMoney(totalGeral);
  if (el("finMediaMensal")) el("finMediaMensal").innerText = formatMoney(mediaMensal);
  if (el("finMaiorMes")) el("finMaiorMes").innerText = formatMoney(maiorValor);
  if (el("finMaiorMesLabel")) el("finMaiorMesLabel").innerText = maiorMes || "-";

  makeLineChart("cFaturamentoMensal", periods, [{ label: "Financeiro", data: periods.map(p => financeiroPorMes.get(p) || 0), borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.10)", borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: "#ffffff", pointBorderColor: "#059669", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8 }], true, true);
  const topEstab = [...financeiroEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  makeHorizontalBarChart("cFatEstabelecimentoFinanceiro", topEstab.map(([k]) => truncateLabel(k, 28)), topEstab.map(([,v]) => v), "#059669", "Financeiro por Estabelecimento", true, 12);
  renderFinTable(filteredFinanceiro);
}

function renderFinTable(filteredFinanceiro) {
  const wrap = el("finTableWrap"); if (!wrap) return;
  if (!filteredFinanceiro.length) { wrap.innerHTML = "<div style='padding:20px;text-align:center'>Nenhum dado financeiro</div>"; return; }
  const periods = getPeriodsFromFilteredData(filteredFinanceiro);
  const map = new Map();
  filteredFinanceiro.forEach(d => { const estab = d.estabelecimento || "Não informado"; if (!map.has(estab)) map.set(estab, {}); map.get(estab)[d.mes] = (map.get(estab)[d.mes] || 0) + d.valor; });
  const rows = [...map.entries()].map(([estab, vals]) => ({ estabelecimento: estab, valores: vals, total: periods.reduce((s, p) => s + (vals[p] || 0), 0) })).sort((a, b) => b.total - a.total);
  const totalsByMonth = {}; periods.forEach(p => totalsByMonth[p] = 0); rows.forEach(r => periods.forEach(p => totalsByMonth[p] += (r.valores[p] || 0))); const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  wrap.innerHTML = `<table class="fin-table"><thead><tr><th>Estabelecimento</th>${periods.map(p => `<th>${escapeHtml(p)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${rows.map(r => `<tr><td title="${escapeHtml(r.estabelecimento)}">${escapeHtml(r.estabelecimento)}</td>${periods.map(p => `<td>${(r.valores[p] || 0) > 0 ? formatMoney(r.valores[p]) : "<span class='nt-value'>NT</span>"}</td>`).join("")}<td><strong>${formatMoney(r.total)}</strong></td></tr>`).join("")}<tr class="total-row"><td><strong>TOTAL GERAL</strong></td>${periods.map(p => `<td><strong>${formatMoney(totalsByMonth[p])}</strong></td>`).join("")}<td><strong>${formatMoney(grandTotal)}</strong></td></tr></tbody></table>`;
}

function renderFisicoFinanceiro(filteredAgendados, filteredFaturado, filteredFinanceiro) {
  const map = new Map();
  const addRow = (estabelecimento, mes) => { const key = `${estabelecimento}||${mes}`; if (!map.has(key)) map.set(key, { estabelecimento, mes, agendados: 0, faturadosQtd: 0, financeiroValor: 0 }); return map.get(key); };
  filteredAgendados.forEach(d => { const row = addRow(d.estabelecimento || "Não informado", d.mes); row.agendados += d.agendados; });
  filteredFaturado.forEach(d => { const row = addRow(d.estabelecimento || "Não informado", d.mes); row.faturadosQtd += d.quantidade; });
  filteredFinanceiro.forEach(d => { const row = addRow(d.estabelecimento || "Não informado", d.mes); row.financeiroValor += d.valor; });
  currentTableDataFisico = [...map.values()].sort((a, b) => b.financeiroValor - a.financeiroValor);
  
  const estabelecimentosMap = new Map();
  currentTableDataFisico.forEach(item => {
      const estab = item.estabelecimento;
      if (!estabelecimentosMap.has(estab)) estabelecimentosMap.set(estab, { agendados: 0, faturadosQtd: 0, financeiroValor: 0 });
      const data = estabelecimentosMap.get(estab);
      data.agendados += item.agendados;
      data.faturadosQtd += item.faturadosQtd;
      data.financeiroValor += item.financeiroValor;
  });
  const topEstabs = [...estabelecimentosMap.entries()].sort((a, b) => b[1].financeiroValor - a[1].financeiroValor).slice(0, 15);
  const labels = topEstabs.map(([k]) => truncateLabel(k, 28));
  const agendadosData = topEstabs.map(([,v]) => v.agendados);
  const faturadosData = topEstabs.map(([,v]) => v.faturadosQtd);
  const financeiroData = topEstabs.map(([,v]) => v.financeiroValor);
  
  makeHorizontalBarChart("cComparativoQtd", labels, agendadosData, "#b6923e", "Agendados", false, 12);
  
  const canvasCompFin = el("cComparativoFinanceiro");
  if (canvasCompFin) {
      destroyChart("cComparativoFinanceiro");
      charts.cComparativoFinanceiro = new Chart(canvasCompFin.getContext("2d"), {
          type: "bar", data: { labels: labels, datasets: [{ label: "Financeiro (R$)", data: financeiroData, backgroundColor: "#059669", borderRadius: 8, yAxisID: "y1" }, { label: "Total Faturado (Qtd)", data: faturadosData, backgroundColor: "#2563eb", borderRadius: 8, yAxisID: "y" }] },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { tooltip: { callbacks: { label: ctx => { if (ctx.dataset.label === "Financeiro (R$)") return formatMoney(ctx.raw); return `${ctx.dataset.label}: ${ctx.raw.toLocaleString("pt-BR")}`; } } }, datalabels: { color: "#fff", font: { weight: "bold", size: 11 }, formatter: (value, ctx) => { if (!value) return ""; if (ctx.dataset.label === "Financeiro (R$)") return formatMoneyCompact(value); return value.toLocaleString("pt-BR"); }, anchor: "center", align: "center" } }, scales: { y: { beginAtZero: true, title: { display: true, text: "Quantidade Faturada" }, ticks: { callback: value => value.toLocaleString("pt-BR") }, grid: { display: false } }, y1: { position: "right", beginAtZero: true, title: { display: true, text: "Financeiro (R$)" }, ticks: { callback: value => formatMoneyCompact(value) }, grid: { drawOnChartArea: false, display: false } }, x: { grid: { display: false } } } }
      });
  }
  
  renderTableBodyFisico();
}

function renderTableBodyFisico() {
  const tbody = el("tBodyFisico"); if (!tbody) return;
  const q = (el("tSearchFisico")?.value || "").toLowerCase();
  const month = currentTableMonthFilterFisico;
  let rows = [...currentTableDataFisico];
  if (month) rows = rows.filter(r => r.mes === month);
  if (q) rows = rows.filter(r => `${r.estabelecimento} ${r.mes}`.toLowerCase().includes(q));
  if (!rows.length) { 
    tbody.innerHTML = '<tr><td colspan="5">Nenhum dado disponível</td></tr>'; 
    const tInfoFisico = el("tInfoFisico"); 
    if (tInfoFisico) tInfoFisico.innerText = "0 registros"; 
    return; 
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td title="${escapeHtml(r.estabelecimento)}">${escapeHtml(truncateLabel(r.estabelecimento, 60))}</td>
      <td>${escapeHtml(r.mes || "-")}</td>
      <td class="text-right">${r.agendados.toLocaleString("pt-BR")}</td>
      <td class="text-right">${r.faturadosQtd.toLocaleString("pt-BR")}</td>
      <td class="text-right">${formatMoney(r.financeiroValor)}</td>
    </tr>
  `).join("");
  const tInfoFisico = el("tInfoFisico"); 
  if (tInfoFisico) tInfoFisico.innerText = `${rows.length.toLocaleString("pt-BR")} registros`;
}

function sortTableFisico(colIndex) {
  const columns = ["estabelecimento", "mes", "agendados", "faturadosQtd", "financeiroValor"];
  if (currentSortColumnFisico === colIndex) currentSortDirectionFisico = currentSortDirectionFisico === "asc" ? "desc" : "asc";
  else { currentSortColumnFisico = colIndex; currentSortDirectionFisico = "asc"; }
  const col = columns[colIndex];
  currentTableDataFisico.sort((a, b) => { let va = a[col], vb = b[col]; if (col === "mes") { va = periodoSortValue(va); vb = periodoSortValue(vb); } else if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); } if (va < vb) return currentSortDirectionFisico === "asc" ? -1 : 1; if (va > vb) return currentSortDirectionFisico === "asc" ? 1 : -1; return 0; });
  renderTableBodyFisico();
}

function renderEstabelecimento(filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro) {
  const agendadosEstab = aggregateBy(filteredAgendados, d => d.estabelecimento, d => d.agendados);
  const ofertasEstab = aggregateBy(filteredAgVivver, d => d.estabelecimento, d => d.oferta);
  const recepcionadosEstab = aggregateBy(filteredAgVivver, d => d.estabelecimento, d => d.recepcionados);
  const faltososEstab = aggregateBy(filteredAgVivver, d => d.estabelecimento, d => d.faltosos);
  const faturadosQtdEstab = aggregateBy(filteredFaturado, d => d.estabelecimento, d => d.quantidade);
  const financeiroEstab = aggregateBy(filteredFinanceiro, d => d.estabelecimento, d => d.valor);
  const topAgendados = [...agendadosEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topOfertas = [...ofertasEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topRecep = [...recepcionadosEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topFalt = [...faltososEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topFatQtd = [...faturadosQtdEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topFinanceiro = [...financeiroEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  makeHorizontalBarChart("cAgendadasPorEstab", topAgendados.map(([k]) => truncateLabel(k, 28)), topAgendados.map(([,v]) => v), "#b6923e", "Agendadas", false, 13);
  makeHorizontalBarChart("cOfertasPorEstab", topOfertas.map(([k]) => truncateLabel(k, 28)), topOfertas.map(([,v]) => v), "#d97706", "Ofertas", false, 13);
  makeHorizontalBarChart("cRecepcionadosPorEstab", topRecep.map(([k]) => truncateLabel(k, 28)), topRecep.map(([,v]) => v), "#059669", "Recepcionados", false, 13);
  makeHorizontalBarChart("cFaltososPorEstab", topFalt.map(([k]) => truncateLabel(k, 28)), topFalt.map(([,v]) => v), "#dc2626", "Faltosos", false, 13);
  makeHorizontalBarChart("cFaturadosPorEstab", topFatQtd.map(([k]) => truncateLabel(k, 28)), topFatQtd.map(([,v]) => v), "#2563eb", "Faturados", false, 13);
  makeHorizontalBarChart("cFinanceiroPorEstab", topFinanceiro.map(([k]) => truncateLabel(k, 28)), topFinanceiro.map(([,v]) => v), "#059669", "Financeiro", true, 13);
}

function renderAgendamentosVivver(filteredAgVivver) {
  const ofertasEsp = aggregateBy(filteredAgVivver, d => d.especialidade, d => d.oferta);
  const recepEsp = aggregateBy(filteredAgVivver, d => d.especialidade, d => d.recepcionados);
  const faltEsp = aggregateBy(filteredAgVivver, d => d.especialidade, d => d.faltosos);
  
  const consolidatedOfertas = new Map();
  filteredAgVivver.forEach(d => {
      if (!d.especialidade) return;
      if (!consolidatedOfertas.has(d.especialidade)) consolidatedOfertas.set(d.especialidade, { rec: 0, fal: 0, total: 0 });
      const data = consolidatedOfertas.get(d.especialidade);
      data.rec += d.recepcionados;
      data.fal += d.faltosos;
      data.total += d.oferta;
  });
  const tbodyOfertas = el("tableOfertasConsolidadasBody");
  if (tbodyOfertas) {
      const sorted = [...consolidatedOfertas.entries()].sort((a, b) => b[1].total - a[1].total);
      if (sorted.length) tbodyOfertas.innerHTML = sorted.map(([esp, vals]) => `<tr><td title="${escapeHtml(esp)}">${escapeHtml(truncateLabel(esp, 45))}</td><td class="text-right">${vals.rec.toLocaleString("pt-BR")}</td><td class="text-right">${vals.fal.toLocaleString("pt-BR")}</td><td class="text-right font-700">${vals.total.toLocaleString("pt-BR")}</td></tr>`).join("");
      else tbodyOfertas.innerHTML = '<tr><td colspan="4">Nenhum dado disponível</td></tr>';
  }
  
  const recepSub = aggregateBy(filteredAgVivver, d => d.subgrupo, d => d.recepcionados);
  const faltSub = aggregateBy(filteredAgVivver, d => d.subgrupo, d => d.faltosos);
  const ofertaSub = aggregateBy(filteredAgVivver, d => d.subgrupo, d => d.oferta);
  
  renderPercentReferenceTable("tableRecepcionadosSubgrupoBody", recepSub, ofertaSub, "#059669");
  renderPercentReferenceTable("tableFaltososSubgrupoBody", faltSub, ofertaSub, "#dc2626");
  renderPercentReferenceTable("tableRecepcionadosVivverBody", recepEsp, ofertasEsp, "#059669");
  renderPercentReferenceTable("tableFaltososVivverBody", faltEsp, ofertasEsp, "#dc2626");
}

function renderFila(filteredFila) {
  const filaEspecialidade = aggregateBy(filteredFila, d => d.especialidade, d => d.fila);
  const filaProcedimento = aggregateBy(filteredFila, d => d.descricao, d => d.fila);
  const filaComplexidade = aggregateBy(filteredFila, d => d.complexidade, d => d.fila);
  const filaSubgrupo = aggregateBy(filteredFila, d => d.subgrupo, d => d.fila);
  
  renderPercentageTotalTable("tableFilaSubgrupoBody", filaSubgrupo, "#d97706");
  renderPercentageTotalTable("tableFilaEspecialidadeBody", filaEspecialidade, "#2563eb");
  renderPercentageTotalTable("tableFilaProcedimentoBody", filaProcedimento, "#059669");
  renderPercentageTotalTable("tableFilaComplexidadeBody", filaComplexidade, "#8b5cf6");
  
  const complexArr = [...filaComplexidade.entries()].sort((a, b) => b[1] - a[1]);
  makeDoughnutChartWithPercentages("cFilaComplexidadeRosca", complexArr.map(([k]) => truncateLabel(k || "Sem Dados", 28)), complexArr.map(([,v]) => v), ["#8b5cf6", "#ec4899", "#10b981", "#d97706", "#dc2626", "#3b82f6", "#059669"]);
}

function renderFilaRetroativa() {
  let filteredRetroativa = dadosFilaRetroativa.filter(d => {
      const grupo = el("grupoSelect")?.value || "";
      const periodo = el("periodoSelect")?.value || "";
      const especialidadeMatch = !selectedEspecialidades.size || selectedEspecialidades.has(d.especialidade);
      const periodoMatch = !periodo || d.dataCorte === periodo;
      let grupoMatch = !grupo || d.grupoCodigo === grupo;
      let subgrupoMatch = !selectedSubgrupos.size || selectedSubgrupos.has(d.subgrupo);
      return especialidadeMatch && periodoMatch && grupoMatch && subgrupoMatch;
  });
  
  const totalFilaRetroativa = filteredRetroativa.reduce((s, d) => s + d.fila, 0);
  const kFilaRetroativa = el("kFilaRetroativa");
  if (kFilaRetroativa) kFilaRetroativa.innerText = totalFilaRetroativa.toLocaleString("pt-BR");
  
  const procedimentosUnicos = new Set();
  filteredRetroativa.forEach(d => {
    if (d.codigo && d.codigo.trim() !== "") {
      procedimentosUnicos.add(d.codigo);
    } else if (d.descricao && d.descricao.trim() !== "") {
      procedimentosUnicos.add(d.descricao);
    }
  });
  
  const totalProcedimentos = procedimentosUnicos.size;
  let mediaPorProcedimento = 0;
  
  if (totalProcedimentos > 0) {
    mediaPorProcedimento = totalFilaRetroativa / totalProcedimentos;
  } else if (filteredRetroativa.length > 0) {
    mediaPorProcedimento = totalFilaRetroativa / filteredRetroativa.length;
  }
  
  const mediaElement = el("mediaPorProcedimento");
  if (mediaElement) {
    mediaElement.innerText = mediaPorProcedimento.toFixed(2);
  }
  
  const filaRetroativaSubgrupo = aggregateBy(filteredRetroativa, d => d.subgrupo, d => d.fila);
  const filaRetroativaProcedimento = aggregateBy(filteredRetroativa, d => d.descricao, d => d.fila);
  
  renderPercentageTotalTable("tableFilaRetroativaSubgrupoBody", filaRetroativaSubgrupo, "#d97706");
  renderPercentageTotalTable("tableFilaRetroativaProcedimentoBody", filaRetroativaProcedimento, "#a855f7");
  
  const filaPorMes = aggregateBy(filteredRetroativa, d => d.dataCorte, d => d.fila);
  const periods = getPeriodsFromFilteredData(filteredRetroativa);
  const lineData = periods.map(p => filaPorMes.get(p) || 0);
  const canvasLine = el("cEvolucaoFilaRetroativa");
  if (canvasLine) {
      destroyChart("cEvolucaoFilaRetroativa");
      charts.cEvolucaoFilaRetroativa = new Chart(canvasLine.getContext("2d"), {
          type: "line", data: { labels: periods, datasets: [{ label: "Fila Retroativa", data: lineData, borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.10)", borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: "#ffffff", pointBorderColor: "#059669", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.raw || 0).toLocaleString("pt-BR")}` } }, datalabels: { color: "#111827", font: { weight: "bold", size: 11 }, formatter: value => value ? value.toLocaleString("pt-BR") : "", align: "top", offset: 6 } }, scales: { y: { beginAtZero: true, title: { display: true, text: "Quantidade" } } } }
      });
  }
  
  const tbodyCompleta = el("tableFilaRetroativaCompletaBody");
  if (tbodyCompleta) {
    const searchTerm = (el("searchFilaRetroativa")?.value || "").toLowerCase();
    let sortedData = [...filteredRetroativa].sort((a, b) => b.fila - a.fila);
    
    if (searchTerm) {
      sortedData = sortedData.filter(d => 
        (d.especialidade && d.especialidade.toLowerCase().includes(searchTerm)) ||
        (d.descricao && d.descricao.toLowerCase().includes(searchTerm)) ||
        (d.codigo && d.codigo.toLowerCase().includes(searchTerm))
      );
    }
    
    tbodyCompleta.innerHTML = sortedData.map(d => `
      <tr>
        <td>${escapeHtml(d.codigo || "-")}</td>
        <td title="${escapeHtml(d.especialidade)}">${escapeHtml(truncateLabel(d.especialidade, 40))}</td>
        <td title="${escapeHtml(d.descricao)}">${escapeHtml(truncateLabel(d.descricao, 50))}</td>
        <td>${escapeHtml(d.grupo || "-")}</td>
        <td>${escapeHtml(d.subgrupo || "-")}</td>
        <td>${escapeHtml(d.complexidade || "-")}</td>
        <td class="text-right font-700">${d.fila.toLocaleString("pt-BR")}</td>
        <td>${escapeHtml(d.dataCorte || "-")}</td>
      </tr>
    `).join("");
  }
  
  const searchInput = el("searchFilaRetroativa");
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "1";
    searchInput.addEventListener("input", () => renderFilaRetroativa());
  }
}

function exportExcel() {
  if (!currentTableDataFisico.length) { toast("Sem dados para exportar", "info"); return; }
  const data = currentTableDataFisico.map(r => ({ Estabelecimento: r.estabelecimento, Mes: r.mes, Agendados: r.agendados, Total_Faturado: r.faturadosQtd, Total_Financeiro: r.financeiroValor }));
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 45 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, "Fisico_Financeiro");
  XLSX.writeFile(wb, `painel_cirurgia_eletiva_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast("Excel exportado com sucesso!", "success");
}

function switchTab(id, btn) {
  document.querySelectorAll(".tabContent").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  const tabContent = el(`tab-${id}`);
  if (tabContent) tabContent.classList.add("active");
  if (btn) btn.classList.add("active");
  setTimeout(() => { Object.values(charts).forEach(chart => chart?.resize?.()); }, 120);
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM carregado, inicializando painel...");
  loadAllData();
  const btnRefresh = el("btnRefresh"); if (btnRefresh) btnRefresh.addEventListener("click", loadAllData);
  const btnExcel = el("btnExcel"); if (btnExcel) btnExcel.addEventListener("click", exportExcel);
  const btnClear = el("btnClear");
  if (btnClear) { btnClear.addEventListener("click", () => { selectedSubgrupos.clear(); selectedEspecialidades.clear(); const grupoSelect = el("grupoSelect"); if (grupoSelect) grupoSelect.value = ""; const periodoSelect = el("periodoSelect"); if (periodoSelect) periodoSelect.value = ""; const tableMonthFilterFisico = el("tableMonthFilterFisico"); if (tableMonthFilterFisico) tableMonthFilterFisico.value = ""; const tabelaMonthFilterEspec = el("tabelaMonthFilterEspec"); if (tabelaMonthFilterEspec) tabelaMonthFilterEspec.value = ""; const msSearchSub = el("msSearchSub"); if (msSearchSub) msSearchSub.value = ""; const msSearchEsp = el("msSearchEsp"); if (msSearchEsp) msSearchEsp.value = ""; const tSearchFisico = el("tSearchFisico"); if (tSearchFisico) tSearchFisico.value = ""; const tabelaSearchEspec = el("tabelaSearchEspec"); if (tabelaSearchEspec) tabelaSearchEspec.value = ""; const searchFilaRetroativa = el("searchFilaRetroativa"); if (searchFilaRetroativa) searchFilaRetroativa.value = ""; currentTableMonthFilterFisico = ""; currentChartFilter = null; buildSubgrupoList(); buildEspecialidadeList(); applyFilters(); toast("Filtros limpos", "info"); }); }
  const grupoSelect = el("grupoSelect"); if (grupoSelect) grupoSelect.addEventListener("change", () => { buildSubgrupoList(); applyFilters(); });
  const periodoSelect = el("periodoSelect"); if (periodoSelect) periodoSelect.addEventListener("change", () => { applyFilters(); });
  const tableMonthFilterFisico = el("tableMonthFilterFisico"); if (tableMonthFilterFisico) tableMonthFilterFisico.addEventListener("change", e => { currentTableMonthFilterFisico = e.target.value || ""; renderTableBodyFisico(); });
  const tSearchFisico = el("tSearchFisico"); if (tSearchFisico) tSearchFisico.addEventListener("input", renderTableBodyFisico);
  document.addEventListener("click", () => closeAllDropdowns());
  const msDropdownSub = el("msDropdownSub"); if (msDropdownSub) msDropdownSub.addEventListener("click", e => e.stopPropagation());
  const msDropdownEsp = el("msDropdownEsp"); if (msDropdownEsp) msDropdownEsp.addEventListener("click", e => e.stopPropagation());
});
