// Registrar o plugin ChartDataLabels
Chart.register(ChartDataLabels);

const el = id => document.getElementById(id);

// URLs atualizadas para as abas corretas
const URL_FILA = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSqltus8b2SYt7WPDLHHPJwM8BTqOTCgoyaLwvyhOEbaRLHQbocDMTqYoMjE-muww/pub?gid=1716569787&single=true&output=csv";
const URL_AGENDAMENTOS_VIVVER = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSqltus8b2SYt7WPDLHHPJwM8BTqOTCgoyaLwvyhOEbaRLHQbocDMTqYoMjE-muww/pub?gid=1546152833&single=true&output=csv";
const URL_FATURADO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSqltus8b2SYt7WPDLHHPJwM8BTqOTCgoyaLwvyhOEbaRLHQbocDMTqYoMjE-muww/pub?gid=252919053&single=true&output=csv";
const URL_FINANCEIRO = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSqltus8b2SYt7WPDLHHPJwM8BTqOTCgoyaLwvyhOEbaRLHQbocDMTqYoMjE-muww/pub?gid=269446681&single=true&output=csv";
const URL_AGENDADOS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSqltus8b2SYt7WPDLHHPJwM8BTqOTCgoyaLwvyhOEbaRLHQbocDMTqYoMjE-muww/pub?gid=928357470&single=true&output=csv";

const MONTHS_ORDER = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MONTH_HEADER_MAP = {
  "JANEIRO": "jan",
  "FEVEREIRO": "fev",
  "MARCO": "mar",
  "MARÇO": "mar",
  "ABRIL": "abr",
  "MAIO": "mai",
  "JUNHO": "jun",
  "JULHO": "jul",
  "AGOSTO": "ago",
  "SETEMBRO": "set",
  "OUTUBRO": "out",
  "NOVEMBRO": "nov",
  "DEZEMBRO": "dez"
};

const GRUPOS_SIGTAP = {
  "03": "03 - Procedimentos clínicos",
  "04": "04 - Procedimentos cirúrgicos"
};

let dadosFila = [];
let dadosAgendamentosVivver = [];
let dadosFaturado = [];      // Nova base FATURADO (quantidade)
let dadosFinanceiro = [];    // Nova base FINANCEIRO (R$)
let dadosAgendados = [];

let gruposSet = new Set();
let especialidadesSet = new Set();

let especialidadeToGrupos = new Map();
let especialidadeToSubgrupos = new Map();

let allPeriodos = [];
let currentYearShort = "25";
let latestDataCorte = "";

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

function normalizeText(v) {
  return String(v ?? "").trim();
}

function normalizeKey(v) {
  return normalizeText(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

function escapeHtml(t) {
  return String(t ?? "").replace(/[&<>"]/g, m => {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    if (m === '"') return "&quot;";
    return m;
  });
}

function truncateLabel(t, max = 30) {
  const s = String(t ?? "");
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function formatMoney(v) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMoneyCompact(v) {
  const n = Number(v || 0);
  if (n >= 1000000) return "R$ " + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "R$ " + (n / 1000).toFixed(1) + " mil";
  return formatMoney(n);
}

function parseNumberBR(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let s = String(value).trim();
  if (!s || /^sem dados$/i.test(s) || s === "-" || s === "NT") return 0;
  s = s.replace(/\s/g, "").replace(/R\$/gi, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  s = s.replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function monthNameToShort(name) {
  const key = normalizeKey(name);
  return MONTH_HEADER_MAP[key] || "";
}

function normalizePeriodo(label) {
  let s = normalizeText(label).toLowerCase();
  if (!s) return "";
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").replace(/\./g, "").replace(/-/g, "/");
  const ptMap = { janeiro:"jan", fevereiro:"fev", marco:"mar", abril:"abr", maio:"mai", junho:"jun", julho:"jul", agosto:"ago", setembro:"set", outubro:"out", novembro:"nov", dezembro:"dez" };
  for (const [full, short] of Object.entries(ptMap)) {
    if (s.startsWith(full)) {
      const rest = s.slice(full.length);
      const yearMatch = rest.match(/\/?(\d{2,4})$/);
      const yy = yearMatch ? String(yearMatch[1]).slice(-2) : currentYearShort;
      return `${short}/${yy}`;
    }
  }
  const shortMatch = s.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/?(\d{2,4})$/i);
  if (shortMatch) return `${shortMatch[1].toLowerCase()}/${String(shortMatch[2]).slice(-2)}`;
  const numericMatch = s.match(/^(\d{1,2})\/?(\d{2,4})$/);
  if (numericMatch) {
    const m = parseInt(numericMatch[1], 10);
    const yy = String(numericMatch[2]).slice(-2);
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

function sortPeriodos(list) {
  return [...new Set((list || []).map(normalizePeriodo).filter(Boolean))]
    .sort((a, b) => periodoSortValue(a) - periodoSortValue(b));
}

function getField(row, aliases = []) {
  const keys = Object.keys(row || {});
  for (const alias of aliases) {
    if (alias in row) return row[alias];
    const found = keys.find(k => normalizeKey(k) === normalizeKey(alias));
    if (found) return row[found];
  }
  return "";
}

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
  return dataRows
    .map(row => {
      const obj = {};
      headers.forEach((header, idx) => { if (header) obj[header] = row?.[idx] ?? ""; });
      return obj;
    })
    .filter(obj => Object.values(obj).some(v => normalizeText(v) !== ""));
}

function extractGrupoCodigo(grupoTexto) {
  const match = String(grupoTexto || "").match(/^(\d{2})/);
  return match ? match[1] : "";
}

function extractSubgrupoCodigo(subgrupoTexto) {
  const match = String(subgrupoTexto || "").match(/^(\d{4})/);
  return match ? match[1] : "";
}

function addMapSet(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function getDominantYearShort(periodos) {
  const years = {};
  (periodos || []).forEach(p => {
    const norm = normalizePeriodo(p);
    const match = norm.match(/\/(\d{2})$/);
    if (match) years[match[1]] = (years[match[1]] || 0) + 1;
  });
  const sorted = Object.entries(years).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "25";
}

function aggregateBy(items, keyFn, valFn) {
  const map = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + valFn(item));
  });
  return map;
}

async function loadAllData() {
  const loadingEl = el("loading");
  if (loadingEl) loadingEl.classList.add("on");
  try {
    console.log("Iniciando carregamento dos dados...");
    const [filaRaw, agVivverRaw, faturadoRaw, financeiroRaw, agendadosRaw] = await Promise.all([
      loadCSVSmart(URL_FILA, ["Código do Procedimento", "Especialidade", "Descrição do Procedimento", "Grupo", "Subgrupo", "TOTAL", "Data Corte/ Fila de Espera"]),
      loadCSVSmart(URL_AGENDAMENTOS_VIVVER, ["CÓDIGO DO PROCEDIMENTO", "PROCEDIMENTO DESCRIÇÃO", "GRUPO", "SUBGRUPO", "ESTABELECIMENTO", "ESPECIALIDADE", "COMPLEXIDADE", "MÊS", "FAL", "REC", "OFERTA"]),
      loadCSVSmart(URL_FATURADO, ["Procedimento Descrição", "GRUPO", "SUB GRUPO", "ESTABELECIMENTO", "Especialidade Descrição", "Código Especialidade", "CÓDIGO DO PROCEDIMENTO", "jan/25", "fev/25", "mar/25", "abr/25", "mai/25", "jun/25", "jul/25", "ago/25", "set/25", "out/25", "nov/25", "dez/25", "Total geral"]),
      loadCSVSmart(URL_FINANCEIRO, ["PROCEDIMENTO DESCRIÇÃO", "GRUPO", "SUBGRUPO", "ESTABELECIMENTO", "ESPECIALIDADE", "CÓDIGO ESPECIALIDADE", "CÓDIGO PROCEDIMENTO", "jan/25", "fev/25", "mar/25", "abr/25", "mai/25", "jun/25", "jul/25", "ago/25", "set/25", "out/25", "nov/25", "dez/25", "Total geral"]),
      loadCSVSmart(URL_AGENDADOS, ["ESTABELECIMENTO", "ESPECIALIDADE", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"])
    ]);

    console.log("Dados carregados:", { fila: filaRaw.length, vivver: agVivverRaw.length, faturado: faturadoRaw.length, financeiro: financeiroRaw.length, agendados: agendadosRaw.length });

    const candidatePeriods = agVivverRaw.map(r => getField(r, ["MÊS"]));
    currentYearShort = getDominantYearShort(candidatePeriods);

    gruposSet = new Set();
    especialidadesSet = new Set();
    especialidadeToGrupos = new Map();
    especialidadeToSubgrupos = new Map();

    let latestDateValue = "";
    let latestDateSortValue = -1;

    dadosFila = filaRaw.map(r => {
      const especialidade = normalizeText(getField(r, ["Especialidade", "ESPECIALIDADE"]));
      const grupoRaw = normalizeText(getField(r, ["Grupo", "GRUPO"]));
      const subgrupoRaw = normalizeText(getField(r, ["Subgrupo", "SUBGRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const subgrupoCodigo = extractSubgrupoCodigo(subgrupoRaw);
      const dataCorteRaw = normalizeText(getField(r, ["Data Corte/ Fila de Espera", "DATA CORTE/ FILA DE ESPERA"]));
      const dataCorteNorm = normalizePeriodo(dataCorteRaw);
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      if (dataCorteNorm) {
        const sortVal = periodoSortValue(dataCorteNorm);
        if (sortVal > latestDateSortValue) { latestDateSortValue = sortVal; latestDateValue = dataCorteNorm; }
      }
      return {
        codigo: normalizeText(getField(r, ["Código do Procedimento", "CÓDIGO DO PROCEDIMENTO"])),
        especialidade,
        descricao: normalizeText(getField(r, ["Descrição do Procedimento", "PROCEDIMENTO DESCRIÇÃO"])),
        grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""),
        grupoCodigo,
        subgrupo: subgrupoRaw,
        subgrupoCodigo,
        complexidade: normalizeText(getField(r, ["Complexidade- Sigtap", "COMPLEXIDADE"])),
        fila: parseNumberBR(getField(r, ["TOTAL", "Total"])),
        dataCorte: dataCorteNorm
      };
    }).filter(d => d.especialidade || d.descricao);

    latestDataCorte = latestDateValue || "Não disponível";
    const dataCorteElement = el("dataCorteInfo");
    if (dataCorteElement) dataCorteElement.innerHTML = `<i class="fa-regular fa-calendar"></i> Data de corte: ${latestDataCorte}`;

    dadosAgendamentosVivver = agVivverRaw.map(r => {
      const especialidade = normalizeText(getField(r, ["ESPECIALIDADE", "Especialidade"]));
      const estabelecimento = normalizeText(getField(r, ["ESTABELECIMENTO", "PRESTADOR", "Estabelecimento"]));
      const grupoRaw = normalizeText(getField(r, ["GRUPO"]));
      const subgrupoRaw = normalizeText(getField(r, ["SUBGRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const subgrupoCodigo = extractSubgrupoCodigo(subgrupoRaw);
      let recepcionados = parseNumberBR(getField(r, ["REC"]));
      let faltosos = parseNumberBR(getField(r, ["FAL"]));
      let oferta = parseNumberBR(getField(r, ["OFERTA"]));
      if ((recepcionados > 0 || faltosos > 0) && oferta !== recepcionados + faltosos) oferta = recepcionados + faltosos;
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      return {
        codigo: normalizeText(getField(r, ["CÓDIGO DO PROCEDIMENTO"])),
        descricao: normalizeText(getField(r, ["PROCEDIMENTO DESCRIÇÃO"])),
        especialidade,
        estabelecimento,
        grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""),
        grupoCodigo,
        subgrupo: subgrupoRaw,
        subgrupoCodigo,
        complexidade: normalizeText(getField(r, ["COMPLEXIDADE"])),
        mes: normalizePeriodo(getField(r, ["MÊS"])),
        faltosos,
        recepcionados,
        oferta
      };
    }).filter(d => d.especialidade || d.descricao);

    // Processamento da aba FATURADO (quantidade)
    dadosFaturado = [];
    faturadoRaw.forEach(row => {
      const especialidade = normalizeText(getField(row, ["Especialidade Descrição", "ESPECIALIDADE"]));
      const estabelecimento = normalizeText(getField(row, ["ESTABELECIMENTO"]));
      const grupoRaw = normalizeText(getField(row, ["GRUPO"]));
      const subgrupoRaw = normalizeText(getField(row, ["SUB GRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const codigoProcedimento = normalizeText(getField(row, ["CÓDIGO DO PROCEDIMENTO"]));
      const descricaoProcedimento = normalizeText(getField(row, ["Procedimento Descrição"]));
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      for (let i = 0; i < MONTHS_ORDER.length; i++) {
        const mesAno = `${MONTHS_ORDER[i]}/${currentYearShort}`;
        const valor = parseNumberBR(row[`${MONTHS_ORDER[i]}/${currentYearShort}`]);
        if (valor > 0) {
          dadosFaturado.push({
            especialidade,
            estabelecimento,
            grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""),
            grupoCodigo,
            subgrupo: subgrupoRaw,
            codigoProcedimento,
            descricaoProcedimento,
            mes: mesAno,
            faturadoQtd: valor
          });
        }
      }
    });

    // Processamento da aba FINANCEIRO (valores em R$)
    dadosFinanceiro = [];
    financeiroRaw.forEach(row => {
      const especialidade = normalizeText(getField(row, ["ESPECIALIDADE"]));
      const estabelecimento = normalizeText(getField(row, ["ESTABELECIMENTO"]));
      const grupoRaw = normalizeText(getField(row, ["GRUPO"]));
      const subgrupoRaw = normalizeText(getField(row, ["SUBGRUPO"]));
      const grupoCodigo = extractGrupoCodigo(grupoRaw);
      const codigoProcedimento = normalizeText(getField(row, ["CÓDIGO PROCEDIMENTO"]));
      const descricaoProcedimento = normalizeText(getField(row, ["PROCEDIMENTO DESCRIÇÃO"]));
      if (especialidade) especialidadesSet.add(especialidade);
      if (grupoCodigo) gruposSet.add(grupoCodigo);
      addMapSet(especialidadeToGrupos, especialidade, grupoCodigo);
      addMapSet(especialidadeToSubgrupos, especialidade, subgrupoRaw);
      for (let i = 0; i < MONTHS_ORDER.length; i++) {
        const mesAno = `${MONTHS_ORDER[i]}/${currentYearShort}`;
        const valor = parseNumberBR(row[`${MONTHS_ORDER[i]}/${currentYearShort}`]);
        if (valor > 0) {
          dadosFinanceiro.push({
            especialidade,
            estabelecimento,
            grupo: grupoRaw || (GRUPOS_SIGTAP[grupoCodigo] || ""),
            grupoCodigo,
            subgrupo: subgrupoRaw,
            codigoProcedimento,
            descricaoProcedimento,
            mes: mesAno,
            financeiroValor: valor
          });
        }
      }
    });

    dadosAgendados = [];
    agendadosRaw.forEach(r => {
      const estabelecimento = normalizeText(getField(r, ["ESTABELECIMENTO", "Estabelecimento"]));
      const especialidade = normalizeText(getField(r, ["ESPECIALIDADE", "Especialidade"]));
      if (!estabelecimento && !especialidade) return;
      if (especialidade) especialidadesSet.add(especialidade);
      Object.keys(r).forEach(col => {
        const shortMonth = monthNameToShort(col);
        if (!shortMonth) return;
        const value = parseNumberBR(r[col]);
        if (value <= 0) return;
        dadosAgendados.push({ estabelecimento, especialidade, mes: `${shortMonth}/${currentYearShort}`, agendados: value });
      });
    });

    allPeriodos = sortPeriodos([
      ...dadosFila.map(d => d.dataCorte),
      ...dadosAgendamentosVivver.map(d => d.mes),
      ...dadosFaturado.map(d => d.mes),
      ...dadosFinanceiro.map(d => d.mes),
      ...dadosAgendados.map(d => d.mes)
    ]);

    console.log("Períodos encontrados:", allPeriodos);
    populateFilters();
    updateLastUpdate();
    applyFilters();
    toast("Dados carregados com sucesso!", "success");
  } catch (e) {
    console.error("Erro detalhado:", e);
    toast(`Erro ao carregar dados: ${e.message}`, "error");
  } finally {
    if (loadingEl) loadingEl.classList.remove("on");
  }
}

function updateLastUpdate() {
  const now = new Date();
  const last = el("lastUpdate");
  if (last) last.textContent = `Última atualização: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`;
}

function populateFilters() {
  const grupoSelect = el("grupoSelect");
  if (grupoSelect) grupoSelect.innerHTML = '<option value="">Todos os grupos</option>' + [...gruposSet].sort().map(cod => `<option value="${escapeHtml(cod)}">${escapeHtml(GRUPOS_SIGTAP[cod] || cod)}</option>`).join("");
  const periodoSelect = el("periodoSelect");
  if (periodoSelect) periodoSelect.innerHTML = '<option value="">Todos os meses</option>' + allPeriodos.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  const tableMonthFilterFisico = el("tableMonthFilterFisico");
  if (tableMonthFilterFisico) tableMonthFilterFisico.innerHTML = '<option value="">Todos os meses</option>' + allPeriodos.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  const tabelaMonthFilterEspec = el("tabelaMonthFilterEspec");
  if (tabelaMonthFilterEspec) tabelaMonthFilterEspec.innerHTML = '<option value="">Todos os meses</option>' + allPeriodos.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
  buildSubgrupoList();
  buildEspecialidadeList();
}

function getVisibleSubgrupos() {
  const grupo = el("grupoSelect")?.value || "";
  let subgrupos = new Set();
  [...dadosFila, ...dadosAgendamentosVivver].forEach(d => {
    if (!d.subgrupo) return;
    if (grupo && d.grupoCodigo !== grupo) return;
    subgrupos.add(d.subgrupo);
  });
  return [...subgrupos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function getVisibleEspecialidades() {
  return [...especialidadesSet].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function buildSubgrupoList() {
  const list = el("msListSub");
  if (!list) return;
  const arr = getVisibleSubgrupos();
  selectedSubgrupos.forEach(s => { if (!arr.includes(s)) selectedSubgrupos.delete(s); });
  list.innerHTML = arr.length ? arr.map(sub => `<div class="ms-item" data-value="${escapeHtml(sub)}"><input type="checkbox" value="${escapeHtml(sub)}" ${selectedSubgrupos.has(sub) ? "checked" : ""}><span>${escapeHtml(sub)}</span></div>`).join("") : '<div class="ms-empty">Nenhum subgrupo</div>';
  list.querySelectorAll(".ms-item").forEach(item => {
    const cb = item.querySelector("input");
    cb.addEventListener("change", () => { if (cb.checked) selectedSubgrupos.add(cb.value); else selectedSubgrupos.delete(cb.value); updateMsLabelSub(); applyFilters(); });
    item.addEventListener("click", e => { if (e.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change")); } });
  });
  updateMsLabelSub();
}

function buildEspecialidadeList() {
  const list = el("msListEsp");
  if (!list) return;
  const arr = getVisibleEspecialidades();
  selectedEspecialidades.forEach(s => { if (!arr.includes(s)) selectedEspecialidades.delete(s); });
  list.innerHTML = arr.length ? arr.map(item => `<div class="ms-item" data-value="${escapeHtml(item)}"><input type="checkbox" value="${escapeHtml(item)}" ${selectedEspecialidades.has(item) ? "checked" : ""}><span>${escapeHtml(item)}</span></div>`).join("") : '<div class="ms-empty">Nenhuma especialidade</div>';
  list.querySelectorAll(".ms-item").forEach(item => {
    const cb = item.querySelector("input");
    cb.addEventListener("change", () => { if (cb.checked) selectedEspecialidades.add(cb.value); else selectedEspecialidades.delete(cb.value); updateMsLabelEsp(); applyFilters(); });
    item.addEventListener("click", e => { if (e.target !== cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event("change")); } });
  });
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
  if (hasGroupFields) {
    grupoMatch = !grupo || item.grupoCodigo === grupo;
    subgrupoMatch = !selectedSubgrupos.size || selectedSubgrupos.has(item.subgrupo);
  } else {
    grupoMatch = especialidadeMatchesGrupo(item.especialidade, grupo);
    subgrupoMatch = especialidadeMatchesSubgrupos(item.especialidade, selectedSubgrupos);
  }
  return especialidadeMatch && periodoMatch && grupoMatch && subgrupoMatch;
}
function matchFinanceiro(item) { const periodo = el("periodoSelect")?.value || ""; return !periodo || item.mes === periodo; }

function createGaugeChart(canvasId, percent, color) {
  const canvas = el(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (charts[canvasId]) { charts[canvasId].destroy(); delete charts[canvasId]; }
  const pctVal = Math.min(Math.max(percent, 0), 100);
  charts[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: { datasets: [{ data: [50,30,20], backgroundColor: ["rgba(220,38,38,.45)","rgba(217,119,6,.45)","rgba(5,150,105,.45)"], borderWidth:0, hoverOffset:0, weight:1 }, { data: [pctVal, 100-pctVal], backgroundColor: [color, "rgba(226,232,240,0.0)"], borderWidth:0, borderRadius:8, hoverOffset:0, weight:2 }] },
    options: { rotation: -90, circumference: 180, cutout: "68%", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } }, animation: { animateRotate: true, duration: 900 } }
  });
}

function applyFilters() {
  console.log("Aplicando filtros...");
  const filteredFila = dadosFila.filter(d => matchBaseWithDimensions(d, true));
  const filteredAgVivver = dadosAgendamentosVivver.filter(d => matchBaseWithDimensions(d, true));
  const filteredAgendados = dadosAgendados.filter(d => matchBaseWithDimensions(d, false));
  const filteredFaturado = dadosFaturado.filter(d => matchBaseWithDimensions(d, true));
  const filteredFinanceiro = dadosFinanceiro.filter(d => matchBaseWithDimensions(d, true));

  const totalFila = filteredFila.reduce((s, d) => s + d.fila, 0);
  const totalRecepcionados = filteredAgVivver.reduce((s, d) => s + d.recepcionados, 0);
  const totalFaltosos = filteredAgVivver.reduce((s, d) => s + d.faltosos, 0);
  const totalAgendados = filteredAgendados.reduce((s, d) => s + d.agendados, 0);
  const totalFaturadosQtd = filteredFaturado.reduce((s, d) => s + d.faturadoQtd, 0);
  const totalFinanceiro = filteredFinanceiro.reduce((s, d) => s + d.financeiroValor, 0);

  const kFila = el("kFila"); if (kFila) kFila.innerText = totalFila.toLocaleString("pt-BR");
  const kRecepcionados = el("kRecepcionados"); if (kRecepcionados) kRecepcionados.innerText = totalRecepcionados.toLocaleString("pt-BR");
  const kFaltosos = el("kFaltosos"); if (kFaltosos) kFaltosos.innerText = totalFaltosos.toLocaleString("pt-BR");
  const kAgendadosTotal = el("kAgendadosTotal"); if (kAgendadosTotal) kAgendadosTotal.innerText = totalAgendados.toLocaleString("pt-BR");
  const kFaturadosQtd = el("kFaturadosQtd"); if (kFaturadosQtd) kFaturadosQtd.innerText = totalFaturadosQtd.toLocaleString("pt-BR");
  const kFinanceiro = el("kFinanceiro"); if (kFinanceiro) kFinanceiro.innerText = formatMoney(totalFinanceiro);

  const agVivverTotal = filteredAgVivver.reduce((s, d) => s + d.oferta, 0);
  const recepcionadosGauge = filteredAgVivver.reduce((s, d) => s + d.recepcionados, 0);
  const faltososGauge = filteredAgVivver.reduce((s, d) => s + d.faltosos, 0);
  const taxaFaturamento = totalAgendados > 0 ? (totalFaturadosQtd / totalAgendados) * 100 : 0;
  const taxaAbsenteismo = agVivverTotal > 0 ? (faltososGauge / agVivverTotal) * 100 : 0;

  const subAgendados = el("subAgendados"); if (subAgendados) subAgendados.textContent = `Base agendados | ${totalAgendados.toLocaleString("pt-BR")} procedimentos`;
  const subRecepcionados = el("subRecepcionados"); if (subRecepcionados) subRecepcionados.textContent = `${agVivverTotal > 0 ? ((totalRecepcionados / agVivverTotal) * 100).toFixed(1) : "0.0"}% da oferta convertida em recepção`;
  const subFaltosos = el("subFaltosos"); if (subFaltosos) subFaltosos.textContent = `${taxaAbsenteismo.toFixed(1)}% sobre a oferta do Vivver`;
  const subFaturadosQtd = el("subFaturadosQtd"); if (subFaturadosQtd) subFaturadosQtd.textContent = `${taxaFaturamento.toFixed(1)}% dos agendados convertidos`;
  const subFinanceiro = el("subFinanceiro"); if (subFinanceiro) subFinanceiro.textContent = `Base financeira consolidada no escopo de período`;

  let fatColor, fatBadgeBg, fatBadgeColor, fatBadgeText;
  if (taxaFaturamento >= 80) { fatColor = "#059669"; fatBadgeBg = "rgba(5,150,105,.20)"; fatBadgeColor = "#065f46"; fatBadgeText = "✓ Ótimo"; }
  else if (taxaFaturamento >= 50) { fatColor = "#d97706"; fatBadgeBg = "rgba(217,119,6,.18)"; fatBadgeColor = "#92400e"; fatBadgeText = "⚠ Regular"; }
  else { fatColor = "#dc2626"; fatBadgeBg = "rgba(220,38,38,.16)"; fatBadgeColor = "#991b1b"; fatBadgeText = "✗ Crítico"; }
  const gaugeFatPct = el("gaugeFatPct"); if (gaugeFatPct) { gaugeFatPct.textContent = taxaFaturamento.toFixed(1) + "%"; gaugeFatPct.style.color = fatColor; }
  const fatBadge = el("gaugeFatBadge"); if (fatBadge) { fatBadge.textContent = fatBadgeText; fatBadge.style.background = fatBadgeBg; fatBadge.style.color = fatBadgeColor; fatBadge.style.border = `1px solid ${fatColor}55`; }
  const gFatAg = el("gFatAg"); if (gFatAg) gFatAg.textContent = totalAgendados.toLocaleString("pt-BR");
  const gFatFat = el("gFatFat"); if (gFatFat) gFatFat.textContent = totalFaturadosQtd.toLocaleString("pt-BR");
  const gFatDiff = el("gFatDiff"); if (gFatDiff) gFatDiff.textContent = Math.max(0, totalAgendados - totalFaturadosQtd).toLocaleString("pt-BR");
  createGaugeChart("cGaugeFat", taxaFaturamento, fatColor);

  let absColor, absBadgeBg, absBadgeColor, absBadgeText;
  if (taxaAbsenteismo <= 10) { absColor = "#059669"; absBadgeBg = "rgba(5,150,105,.20)"; absBadgeColor = "#065f46"; absBadgeText = "✓ Excelente"; }
  else if (taxaAbsenteismo <= 20) { absColor = "#3b82f6"; absBadgeBg = "rgba(59,130,246,.18)"; absBadgeColor = "#1d4ed8"; absBadgeText = "✓ Bom"; }
  else if (taxaAbsenteismo <= 35) { absColor = "#d97706"; absBadgeBg = "rgba(217,119,6,.18)"; absBadgeColor = "#92400e"; absBadgeText = "⚠ Atenção"; }
  else { absColor = "#dc2626"; absBadgeBg = "rgba(220,38,38,.16)"; absBadgeColor = "#991b1b"; absBadgeText = "✗ Crítico"; }
  const gaugeAbsPct = el("gaugeAbsPct"); if (gaugeAbsPct) { gaugeAbsPct.textContent = taxaAbsenteismo.toFixed(1) + "%"; gaugeAbsPct.style.color = absColor; }
  const absBadge = el("gaugeAbsBadge"); if (absBadge) { absBadge.textContent = absBadgeText; absBadge.style.background = absBadgeBg; absBadge.style.color = absBadgeColor; absBadge.style.border = `1px solid ${absColor}55`; }
  const gAbsAg = el("gAbsAg"); if (gAbsAg) gAbsAg.textContent = agVivverTotal.toLocaleString("pt-BR");
  const gAbsRec = el("gAbsRec"); if (gAbsRec) gAbsRec.textContent = recepcionadosGauge.toLocaleString("pt-BR");
  const gAbsAus = el("gAbsAus"); if (gAbsAus) gAbsAus.textContent = faltososGauge.toLocaleString("pt-BR");
  createGaugeChart("cGaugeAbs", taxaAbsenteismo, absColor);

  renderVisaoGeral(filteredFila, filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro);
  renderFinanceiro(filteredFinanceiro);
  renderFisicoFinanceiro(filteredAgendados, filteredFaturado, filteredFinanceiro);
  renderEstabelecimento(filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro);
  renderAgendamentosVivver(filteredAgVivver);
  renderFila(filteredFila);
}

function renderSimpleRankingTable(tbodyId, dataMap, isMoney = false) {
  const tbody = el(tbodyId);
  if (!tbody) return;
  const arr = [...dataMap.entries()].sort((a, b) => b[1] - a[1]);
  if (!arr.length) { tbody.innerHTML = `<tr><td colspan="2">Nenhum dado disponível</td></tr>`; return; }
  tbody.innerHTML = arr.map(([name, value]) => `<tr><td title="${escapeHtml(name)}">${escapeHtml(truncateLabel(name, 55))}</td><td class="text-right font-700">${isMoney ? formatMoney(value) : value.toLocaleString("pt-BR")}</td></tr>`).join("");
}

function renderPercentReferenceTable(tbodyId, valueMap, referenceMap, color = "#0b5e42") {
  const tbody = el(tbodyId);
  if (!tbody) return;
  const arr = [...valueMap.entries()].sort((a, b) => b[1] - a[1]);
  if (!arr.length) { tbody.innerHTML = `<tr><td colspan="3">Nenhum dado disponível</td></tr>`; return; }
  const maxValue = arr[0][1] || 1;
  tbody.innerHTML = arr.map(([name, value]) => { const ref = referenceMap.get(name) || 0; const percent = ref > 0 ? ((value / ref) * 100) : 0; const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0; return `<tr><td title="${escapeHtml(name)}">${escapeHtml(truncateLabel(name, 45))}</td><td class="text-right font-700">${value.toLocaleString("pt-BR")}</td><td><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${barWidth}%; background: linear-gradient(90deg, ${color}, ${color}dd);">${percent > 0 ? `<span>${percent.toFixed(1)}%</span>` : ""}</div></div></td></tr>`; }).join("");
}

function renderPercentageTotalTable(tbodyId, dataMap, color = "#0b5e42") {
  const tbody = el(tbodyId);
  if (!tbody) return;
  const arr = [...dataMap.entries()].sort((a, b) => b[1] - a[1]);
  const total = arr.reduce((s, [,v]) => s + v, 0);
  const maxValue = arr[0]?.[1] || 1;
  if (!arr.length) { tbody.innerHTML = `<tr><td colspan="3">Nenhum dado disponível</td></tr>`; return; }
  tbody.innerHTML = arr.map(([name, value]) => { const percent = total > 0 ? (value / total) * 100 : 0; const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0; return `<tr><td title="${escapeHtml(name)}">${escapeHtml(truncateLabel(name, 55))}</td><td class="text-right font-700">${value.toLocaleString("pt-BR")}</td><td><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${barWidth}%; background: linear-gradient(90deg, ${color}, ${color}dd);">${percent > 0 ? `<span>${percent.toFixed(1)}%</span>` : ""}</div></div></td></tr>`; }).join("");
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function makeHorizontalBarChart(id, labels, values, color, datasetLabel, isMoney = false, dataLabelFontSize = 11) {
  const canvas = el(id);
  if (!canvas) return;
  destroyChart(id);
  charts[id] = new Chart(canvas.getContext("2d"), {
    type: "bar", data: { labels, datasets: [{ label: datasetLabel, data: values, backgroundColor: color, borderRadius: 8, barPercentage: 0.72, categoryPercentage: 0.82 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: "y", layout: { padding: { top: 8, right: 24, bottom: 8, left: 8 } }, plugins: { legend: { display: true, position: "top", labels: { font: { weight: "bold", size: 12 } } }, tooltip: { callbacks: { label: ctx => isMoney ? formatMoney(ctx.raw) : ctx.raw.toLocaleString("pt-BR") } }, datalabels: { color: "#ffffff", font: { weight: "bold", size: dataLabelFontSize }, anchor: "center", align: "center", formatter: value => { if (!value) return ""; return isMoney ? formatMoneyCompact(value) : value.toLocaleString("pt-BR"); } } }, scales: { x: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.10)" }, ticks: { font: { weight: "bold", size: 10 }, callback: value => isMoney ? formatMoneyCompact(value) : value.toLocaleString("pt-BR") } }, y: { grid: { display: false }, ticks: { font: { weight: "bold", size: 10 } } } } }
  });
}

function makeDoughnutChartWithPercentages(id, labels, values, colors) {
  const canvas = el(id);
  if (!canvas) return;
  destroyChart(id);
  const total = values.reduce((a, b) => a + b, 0);
  charts[id] = new Chart(canvas.getContext("2d"), {
    type: "doughnut", data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { font: { weight: "bold", size: 11 }, generateLabels: chart => { const data = chart.data; return data.labels.map((label, i) => ({ text: `${label}: ${(data.datasets[0].data[i] || 0).toLocaleString("pt-BR")} (${total > 0 ? (((data.datasets[0].data[i] || 0) / total) * 100).toFixed(1) : "0.0"}%)`, fillStyle: data.datasets[0].backgroundColor[i], hidden: false, index: i })); } } }, tooltip: { callbacks: { label: ctx => { const value = ctx.raw || 0; const percent = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0"; return `${ctx.label}: ${value.toLocaleString("pt-BR")} (${percent}%)`; } } }, datalabels: { color: "#fff", font: { weight: "bold", size: 13 }, formatter: value => { if (!value || total <= 0) return ""; const p = (value / total) * 100; return p >= 5 ? `${p.toFixed(1)}%` : ""; } } } }
  });
}

function makeLineChart(id, labels, datasets, yMoney = false, withDataLabels = true) {
  const canvas = el(id);
  if (!canvas) return;
  destroyChart(id);
  charts[id] = new Chart(canvas.getContext("2d"), {
    type: "line", data: { labels, datasets },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, layout: { padding: { top: 28, right: 24, bottom: 12, left: 12 } }, plugins: { legend: { position: "top", labels: { font: { weight: "bold", size: 12 }, usePointStyle: true, pointStyle: "circle", boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => { const val = ctx.raw || 0; return yMoney ? `${ctx.dataset.label}: ${formatMoney(val)}` : `${ctx.dataset.label}: ${val.toLocaleString("pt-BR")}`; } } }, datalabels: { display: withDataLabels, color: ctx => ctx.dataset.borderColor || "#1F2937", font: { weight: "bold", size: 10 }, align: "top", anchor: "end", offset: 8, clamp: true, formatter: value => { if (!value) return ""; return yMoney ? formatMoneyCompact(value) : value.toLocaleString("pt-BR"); } } }, scales: { x: { grid: { display: false }, ticks: { font: { weight: "bold" }, maxRotation: 0, autoSkip: false } }, y: { beginAtZero: true, grace: "10%", grid: { color: "rgba(148,163,184,0.12)" }, ticks: { font: { weight: "bold" }, callback: value => yMoney ? formatMoneyCompact(value) : value.toLocaleString("pt-BR") } } } }
  });
}

function getPeriodsFromFilteredData(...groups) {
  const arr = []; groups.flat().forEach(item => { if (item.mes) arr.push(item.mes); if (item.dataCorte) arr.push(item.dataCorte); });
  const periods = sortPeriodos(arr);
  return periods.length ? periods : allPeriodos;
}

function renderMixedEvolutionChart(periods, filaPorMes, ofertaPorMes, recepcionadosPorMes, faltososPorMes) {
  const canvas = el("cEvolucao");
  if (!canvas) return;
  destroyChart("cEvolucao");
  charts.cEvolucao = new Chart(canvas.getContext("2d"), {
    data: { labels: periods, datasets: [{ type: "bar", label: "Ofertas", data: periods.map(p => ofertaPorMes.get(p) || 0), backgroundColor: "rgba(37,99,235,0.22)", borderColor: "#2563eb", borderWidth: 1.5, borderRadius: 10, yAxisID: "y", order: 4 }, { type: "line", label: "Fila de Espera", data: periods.map(p => filaPorMes.get(p) || 0), borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.10)", borderWidth: 3, fill: false, tension: 0.28, pointBackgroundColor: "#ffffff", pointBorderColor: "#dc2626", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8, yAxisID: "y1", order: 1 }, { type: "line", label: "Recepcionados", data: periods.map(p => recepcionadosPorMes.get(p) || 0), borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.10)", borderWidth: 3, fill: false, tension: 0.28, pointBackgroundColor: "#ffffff", pointBorderColor: "#059669", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8, yAxisID: "y", order: 2 }, { type: "line", label: "Faltosos", data: periods.map(p => faltososPorMes.get(p) || 0), borderColor: "#d97706", backgroundColor: "rgba(217,119,6,0.10)", borderWidth: 3, fill: false, tension: 0.28, pointBackgroundColor: "#ffffff", pointBorderColor: "#d97706", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8, yAxisID: "y", order: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, layout: { padding: { top: 24, right: 16, bottom: 10, left: 10 } }, plugins: { legend: { position: "top", labels: { usePointStyle: true, pointStyle: "circle", font: { weight: "bold", size: 12 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.raw || 0).toLocaleString("pt-BR")}` } }, datalabels: { color: ctx => ctx.dataset.borderColor || "#111827", font: { weight: "bold", size: 10 }, formatter: value => { if (!value) return ""; return value.toLocaleString("pt-BR"); }, align: ctx => ctx.dataset.type === "bar" ? "end" : "top", anchor: ctx => ctx.dataset.type === "bar" ? "end" : "end", offset: 6, clamp: true } }, scales: { x: { grid: { display: false }, ticks: { font: { weight: "bold" }, maxRotation: 0, autoSkip: false } }, y: { beginAtZero: true, position: "left", grace: "10%", grid: { display: false }, ticks: { font: { weight: "bold" }, callback: value => value.toLocaleString("pt-BR") }, title: { display: true, text: "Oferta / Recepcionados / Faltosos", font: { weight: "bold" } } }, y1: { beginAtZero: true, position: "right", grace: "10%", grid: { display: false, drawOnChartArea: false }, ticks: { font: { weight: "bold" }, callback: value => value.toLocaleString("pt-BR") }, title: { display: true, text: "Fila de Espera", font: { weight: "bold" } } } } }
  });
}

function renderAgendadasPorEspecialidadeEstabTable(filteredAgendados) {
  const tbody = el("tableAgendadasPorEspecEstabBody");
  if (!tbody) return;
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
  let grandTotal = 0; rows.forEach(row => { estabelecimentosFixos.forEach(estab => { totalsByEstab[estab] += row.valores[estab]; }); grandTotal += row.total; });
  tbody.innerHTML = rows.map(r => `<tr><td title="${escapeHtml(r.especialidade)}">${escapeHtml(truncateLabel(r.especialidade, 35))}</td><td>${escapeHtml(r.mes)}</td><td class="text-right">${r.valores["Belo Horizonte"].toLocaleString("pt-BR")}</td><td class="text-right">${r.valores["Centro Materno Infantil"].toLocaleString("pt-BR")}</td><td class="text-right">${r.valores["Hospital Municipal de Contagem"].toLocaleString("pt-BR")}</td><td class="text-right">${r.valores["Hospital São José"].toLocaleString("pt-BR")}</td><td class="text-right">${r.valores["Hospital Santa Rita"].toLocaleString("pt-BR")}</td><td class="text-right font-800" style="background:#f0fdfa;">${r.total.toLocaleString("pt-BR")}</td></tr>`).join("") + `<tr class="total-row"><td colspan="2" class="font-800">TOTAL GERAL</td><td class="text-right font-800">${totalsByEstab["Belo Horizonte"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${totalsByEstab["Centro Materno Infantil"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${totalsByEstab["Hospital Municipal de Contagem"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${totalsByEstab["Hospital São José"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${totalsByEstab["Hospital Santa Rita"].toLocaleString("pt-BR")}</td><td class="text-right font-800">${grandTotal.toLocaleString("pt-BR")}</td></tr>`;
}

function renderAgendadosVsFaturadosChart(periods, agendadosValues, faturadosValues) {
  const canvas = el("cAgendadosVsFaturadosMes");
  if (!canvas) return;
  destroyChart("cAgendadosVsFaturadosMes");
  const datasets = [];
  if (currentChartFilter !== "faturados") datasets.push({ label: "Agendados", data: agendadosValues, backgroundColor: "#b6923e", borderRadius: 8 });
  if (currentChartFilter !== "agendados") datasets.push({ label: "Faturados", data: faturadosValues, backgroundColor: "#059669", borderRadius: 8 });
  charts.cAgendadosVsFaturadosMes = new Chart(canvas.getContext("2d"), { type: "bar", data: { labels: periods, datasets }, options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 12, right: 20, bottom: 10, left: 10 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.raw || 0).toLocaleString("pt-BR")}` } }, datalabels: { color: "#fff", font: { weight: "bold", size: 11 }, formatter: value => value ? value.toLocaleString("pt-BR") : "", anchor: "center", align: "center" } }, scales: { x: { grid: { display: false }, ticks: { font: { weight: "bold" } } }, y: { beginAtZero: true, grace: "10%", grid: { color: "rgba(148,163,184,0.10)" }, ticks: { font: { weight: "bold" } } } } } });
}

function setupChartLegendClick(periods, agendadosValues, faturadosValues) {
  const legendContainer = el("legendAgendadosFaturados");
  if (!legendContainer) return;
  const legendItems = legendContainer.querySelectorAll(".legend-item");
  if (legendItems.length !== 2) return;
  const agendadosItem = legendItems[0], faturadosItem = legendItems[1];
  const newAgendadosItem = agendadosItem.cloneNode(true), newFaturadosItem = faturadosItem.cloneNode(true);
  agendadosItem.parentNode.replaceChild(newAgendadosItem, agendadosItem);
  faturadosItem.parentNode.replaceChild(newFaturadosItem, faturadosItem);
  newAgendadosItem.style.cursor = "pointer";
  newFaturadosItem.style.cursor = "pointer";
  function updateLegendActiveStyle() { newAgendadosItem.classList.remove("active-filter"); newFaturadosItem.classList.remove("active-filter"); if (currentChartFilter === "agendados") newAgendadosItem.classList.add("active-filter"); else if (currentChartFilter === "faturados") newFaturadosItem.classList.add("active-filter"); }
  newAgendadosItem.addEventListener("click", (e) => { e.stopPropagation(); currentChartFilter = currentChartFilter === "agendados" ? null : "agendados"; renderAgendadosVsFaturadosChart(periods, agendadosValues, faturadosValues); updateLegendActiveStyle(); });
  newFaturadosItem.addEventListener("click", (e) => { e.stopPropagation(); currentChartFilter = currentChartFilter === "faturados" ? null : "faturados"; renderAgendadosVsFaturadosChart(periods, agendadosValues, faturadosValues); updateLegendActiveStyle(); });
  updateLegendActiveStyle();
}

function renderVisaoGeral(filteredFila, filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro) {
  const periods = getPeriodsFromFilteredData(filteredFila, filteredAgVivver, filteredAgendados, filteredFaturado, filteredFinanceiro);
  const filaPorMes = aggregateBy(filteredFila, d => d.dataCorte, d => d.fila);
  const ofertaPorMes = aggregateBy(filteredAgVivver, d => d.mes, d => d.oferta);
  const recepcionadosPorMes = aggregateBy(filteredAgVivver, d => d.mes, d => d.recepcionados);
  const faltososPorMes = aggregateBy(filteredAgVivver, d => d.mes, d => d.faltosos);
  renderMixedEvolutionChart(periods, filaPorMes, ofertaPorMes, recepcionadosPorMes, faltososPorMes);
  const agendadosPorMes = aggregateBy(filteredAgendados, d => d.mes, d => d.agendados);
  const faturadosQtdPorMes = aggregateBy(filteredFaturado, d => d.mes, d => d.faturadoQtd);
  const financeiroPorMes = aggregateBy(filteredFinanceiro, d => d.mes, d => d.financeiroValor);
  const agendadosValues = periods.map(p => agendadosPorMes.get(p) || 0);
  const faturadosValues = periods.map(p => faturadosQtdPorMes.get(p) || 0);
  const agendadosMedia = agendadosValues.reduce((a, b) => a + b, 0) / (agendadosValues.filter(v => v > 0).length || 1);
  const faturadosMedia = faturadosValues.reduce((a, b) => a + b, 0) / (faturadosValues.filter(v => v > 0).length || 1);
  const legendContainer = el("legendAgendadosFaturados");
  if (legendContainer) { legendContainer.innerHTML = `<div class="legend-item"><div class="legend-color agendados"></div><span>Agendados</span><span style="font-weight:900;color:var(--primary-dark)">(Média: ${Math.round(agendadosMedia).toLocaleString("pt-BR")})</span></div><div class="legend-item"><div class="legend-color faturados"></div><span>Faturados</span><span style="font-weight:900;color:var(--primary-dark)">(Média: ${Math.round(faturadosMedia).toLocaleString("pt-BR")})</span></div>`; setupChartLegendClick(periods, agendadosValues, faturadosValues); }
  renderAgendadosVsFaturadosChart(periods, agendadosValues, faturadosValues);
  makeLineChart("cReceitaFinanceiraMes", periods, [{ label: "Receita Financeira", data: periods.map(p => financeiroPorMes.get(p) || 0), borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.10)", borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: "#ffffff", pointBorderColor: "#059669", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8 }], true, true);
  const financeiroEstab = aggregateBy(filteredFinanceiro, d => d.estabelecimento, d => d.financeiroValor);
  const topFinanceiroEstab = [...financeiroEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  makeHorizontalBarChart("cFatEstabelecimento", topFinanceiroEstab.map(([k]) => truncateLabel(k, 28)), topFinanceiroEstab.map(([,v]) => v), "#059669", "Financeiro", true);
  const totalOferta = filteredAgVivver.reduce((s, d) => s + d.oferta, 0);
  const totalRecepcionados = filteredAgVivver.reduce((s, d) => s + d.recepcionados, 0);
  const totalFaltosos = filteredAgVivver.reduce((s, d) => s + d.faltosos, 0);
  makeDoughnutChartWithPercentages("cFunil", ["Ofertas", "Recepcionados", "Faltosos"], [totalOferta, totalRecepcionados, totalFaltosos], ["#2563eb", "#059669", "#d97706"]);
  renderAgendadasPorEspecialidadeEstabTable(filteredAgendados);
  const searchInput = el("tabelaSearchEspec");
  const monthSelect = el("tabelaMonthFilterEspec");
  if (searchInput && !searchInput.dataset.bound) { searchInput.dataset.bound = "1"; searchInput.addEventListener("input", () => renderAgendadasPorEspecialidadeEstabTable(filteredAgendados)); }
  if (monthSelect && !monthSelect.dataset.bound) { monthSelect.dataset.bound = "1"; monthSelect.addEventListener("change", () => renderAgendadasPorEspecialidadeEstabTable(filteredAgendados)); }
}

function renderFinanceiro(filteredFinanceiro) {
  const periods = getPeriodsFromFilteredData(filteredFinanceiro);
  const financeiroPorMes = aggregateBy(filteredFinanceiro, d => d.mes, d => d.financeiroValor);
  const financeiroEstab = aggregateBy(filteredFinanceiro, d => d.estabelecimento, d => d.financeiroValor);
  makeLineChart("cFaturamentoMensal", periods, [{ label: "Financeiro", data: periods.map(p => financeiroPorMes.get(p) || 0), borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.10)", borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: "#ffffff", pointBorderColor: "#059669", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8 }], true, true);
  const topEstab = [...financeiroEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  makeHorizontalBarChart("cFatEstabelecimentoFinanceiro", topEstab.map(([k]) => truncateLabel(k, 28)), topEstab.map(([,v]) => v), "#059669", "Financeiro por Estabelecimento", true);
  renderFinTable(filteredFinanceiro);
}

function renderFinTable(filteredFinanceiro) {
  const wrap = el("finTableWrap");
  if (!wrap) return;
  if (!filteredFinanceiro.length) { wrap.innerHTML = "<div style='padding:20px;text-align:center'>Nenhum dado financeiro</div>"; return; }
  const periods = getPeriodsFromFilteredData(filteredFinanceiro);
  const map = new Map();
  filteredFinanceiro.forEach(d => { const estab = d.estabelecimento || "Não informado"; if (!map.has(estab)) map.set(estab, {}); map.get(estab)[d.mes] = (map.get(estab)[d.mes] || 0) + d.financeiroValor; });
  const rows = [...map.entries()].map(([estab, vals]) => ({ estabelecimento: estab, valores: vals, total: periods.reduce((s, p) => s + (vals[p] || 0), 0) })).sort((a, b) => b.total - a.total);
  const totalsByMonth = {}; periods.forEach(p => totalsByMonth[p] = 0); rows.forEach(r => periods.forEach(p => totalsByMonth[p] += (r.valores[p] || 0))); const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  wrap.innerHTML = `<table class="fin-table"><thead><tr><th>Estabelecimento</th>${periods.map(p => `<th>${escapeHtml(p)}</th>`).join("")}<th>Total</th></tr></thead><tbody>${rows.map(r => `<tr><td title="${escapeHtml(r.estabelecimento)}">${escapeHtml(r.estabelecimento)}</td>${periods.map(p => `<td>${(r.valores[p] || 0) > 0 ? formatMoney(r.valores[p]) : "<span class='nt-value'>NT</span>"}</td>`).join("")}<td><strong>${formatMoney(r.total)}</strong></td></tr>`).join("")}<tr class="total-row"><td><strong>TOTAL GERAL</strong></td>${periods.map(p => `<td><strong>${formatMoney(totalsByMonth[p])}</strong></td>`).join("")}<td><strong>${formatMoney(grandTotal)}</strong></td></tr></tbody></table>`;
}

function renderFisicoFinanceiro(filteredAgendados, filteredFaturado, filteredFinanceiro) {
  const map = new Map();
  const addRow = (estabelecimento, mes) => { const key = `${estabelecimento}||${mes}`; if (!map.has(key)) map.set(key, { estabelecimento, mes, agendados: 0, faturadosQtd: 0, financeiroValor: 0 }); return map.get(key); };
  filteredAgendados.forEach(d => { const row = addRow(d.estabelecimento || "Não informado", d.mes); row.agendados += d.agendados; });
  filteredFaturado.forEach(d => { const row = addRow(d.estabelecimento || "Não informado", d.mes); row.faturadosQtd += d.faturadoQtd; });
  filteredFinanceiro.forEach(d => { const row = addRow(d.estabelecimento || "Não informado", d.mes); row.financeiroValor += d.financeiroValor; });
  currentTableDataFisico = [...map.values()].sort((a, b) => b.financeiroValor - a.financeiroValor);
  renderTableBodyFisico();
}

function renderTableBodyFisico() {
  const tbody = el("tBodyFisico");
  if (!tbody) return;
  const q = (el("tSearchFisico")?.value || "").toLowerCase();
  const month = currentTableMonthFilterFisico;
  let rows = [...currentTableDataFisico];
  if (month) rows = rows.filter(r => r.mes === month);
  if (q) rows = rows.filter(r => `${r.estabelecimento} ${r.mes}`.toLowerCase().includes(q));
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5">Nenhum dado disponível</td></tr>'; const tInfoFisico = el("tInfoFisico"); if (tInfoFisico) tInfoFisico.innerText = "0 registros"; return; }
  tbody.innerHTML = rows.map(r => `<tr><td title="${escapeHtml(r.estabelecimento)}">${escapeHtml(truncateLabel(r.estabelecimento, 60))}</td><td>${escapeHtml(r.mes || "-")}</td><td class="text-right">${r.agendados.toLocaleString("pt-BR")}</td><td class="text-right">${r.faturadosQtd.toLocaleString("pt-BR")}</td><td class="text-right">${formatMoney(r.financeiroValor)}</td></tr>`).join("");
  const tInfoFisico = el("tInfoFisico"); if (tInfoFisico) tInfoFisico.innerText = `${rows.length.toLocaleString("pt-BR")} registros`;
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
  const faturadosQtdEstab = aggregateBy(filteredFaturado, d => d.estabelecimento, d => d.faturadoQtd);
  const financeiroEstab = aggregateBy(filteredFinanceiro, d => d.estabelecimento, d => d.financeiroValor);
  const topAgendados = [...agendadosEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topOfertas = [...ofertasEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topRecep = [...recepcionadosEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topFalt = [...faltososEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topFatQtd = [...faturadosQtdEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topFinanceiro = [...financeiroEstab.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  makeHorizontalBarChart("cAgendadasPorEstab", topAgendados.map(([k]) => truncateLabel(k, 28)), topAgendados.map(([,v]) => v), "#b6923e", "Agendadas");
  makeHorizontalBarChart("cOfertasPorEstab", topOfertas.map(([k]) => truncateLabel(k, 28)), topOfertas.map(([,v]) => v), "#d97706", "Ofertas");
  makeHorizontalBarChart("cRecepcionadosPorEstab", topRecep.map(([k]) => truncateLabel(k, 28)), topRecep.map(([,v]) => v), "#059669", "Recepcionados");
  makeHorizontalBarChart("cFaltososPorEstab", topFalt.map(([k]) => truncateLabel(k, 28)), topFalt.map(([,v]) => v), "#dc2626", "Faltosos");
  makeHorizontalBarChart("cFaturadosPorEstab", topFatQtd.map(([k]) => truncateLabel(k, 28)), topFatQtd.map(([,v]) => v), "#2563eb", "Faturados");
  makeHorizontalBarChart("cFinanceiroPorEstab", topFinanceiro.map(([k]) => truncateLabel(k, 28)), topFinanceiro.map(([,v]) => v), "#059669", "Financeiro", true);
}

function renderAgendamentosVivver(filteredAgVivver) {
  const ofertasEsp = aggregateBy(filteredAgVivver, d => d.especialidade, d => d.oferta);
  const recepEsp = aggregateBy(filteredAgVivver, d => d.especialidade, d => d.recepcionados);
  const faltEsp = aggregateBy(filteredAgVivver, d => d.especialidade, d => d.faltosos);
  renderSimpleRankingTable("tableOfertasBody", ofertasEsp, false);
  renderPercentReferenceTable("tableRecepcionadosVivverBody", recepEsp, ofertasEsp, "#059669");
  renderPercentReferenceTable("tableFaltososVivverBody", faltEsp, ofertasEsp, "#dc2626");
}

function renderFila(filteredFila) {
  const filaEspecialidade = aggregateBy(filteredFila, d => d.especialidade, d => d.fila);
  const filaProcedimento = aggregateBy(filteredFila, d => d.descricao, d => d.fila);
  const filaComplexidade = aggregateBy(filteredFila, d => d.complexidade, d => d.fila);
  const filaSubgrupo = aggregateBy(filteredFila, d => d.subgrupo, d => d.fila);
  const filaMes = aggregateBy(filteredFila, d => d.dataCorte, d => d.fila);
  renderPercentageTotalTable("tableFilaEspecialidadeBody", filaEspecialidade, "#2563eb");
  renderPercentageTotalTable("tableFilaProcedimentoBody", filaProcedimento, "#059669");
  renderPercentageTotalTable("tableFilaComplexidadeBody", filaComplexidade, "#8b5cf6");
  renderPercentageTotalTable("tableFilaSubgrupoBody", filaSubgrupo, "#d97706");
  const complexArr = [...filaComplexidade.entries()].sort((a, b) => b[1] - a[1]);
  makeDoughnutChartWithPercentages("cFilaComplexidadeRosca", complexArr.map(([k]) => truncateLabel(k || "Sem Dados", 28)), complexArr.map(([,v]) => v), ["#8b5cf6", "#ec4899", "#10b981", "#d97706", "#dc2626", "#3b82f6", "#059669"]);
  const periods = [...filaMes.keys()].sort((a, b) => periodoSortValue(a) - periodoSortValue(b));
  const values = periods.map(p => filaMes.get(p) || 0);
  const trendLabels = [...periods];
  const trendDataReal = [...values];
  const last3 = values.slice(-3);
  let growth = 0;
  if (last3.length >= 2) growth = (last3[last3.length - 1] - last3[0]) / (last3.length - 1);
  const lastValue = values[values.length - 1] || 0;
  const projectionData = Array(periods.length).fill(null);
  for (let i = 1; i <= 3; i++) { trendLabels.push(`Proj. ${i}`); projectionData.push(Math.max(0, Math.round(lastValue + growth * i))); }
  destroyChart("cTendenciaFila");
  const cTendenciaFila = el("cTendenciaFila");
  if (cTendenciaFila) {
    charts.cTendenciaFila = new Chart(cTendenciaFila.getContext("2d"), {
      type: "line", data: { labels: trendLabels, datasets: [{ label: "Fila Real", data: [...trendDataReal, ...Array(3).fill(null)], borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.10)", borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: "#ffffff", pointBorderColor: "#dc2626", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8 }, { label: "Projeção", data: projectionData, borderColor: "#d97706", borderDash: [6, 4], borderWidth: 3, backgroundColor: "rgba(217,119,6,0.05)", fill: false, tension: 0.3, pointBackgroundColor: "#ffffff", pointBorderColor: "#d97706", pointBorderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 24, right: 20, bottom: 10, left: 10 } }, plugins: { legend: { position: "top", labels: { font: { weight: "bold" } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.raw || 0).toLocaleString("pt-BR")}` } }, datalabels: { display: true, color: ctx => ctx.dataset.borderColor || "#1F2937", font: { weight: "bold", size: 10 }, formatter: value => value ? value.toLocaleString("pt-BR") : "", align: "top", anchor: "end", offset: 6, clamp: true } }, scales: { x: { grid: { display: false }, ticks: { font: { weight: "bold" } } }, y: { beginAtZero: true, grace: "10%", grid: { color: "rgba(148,163,184,0.12)" }, ticks: { font: { weight: "bold" } } } } }
    });
  }
}

function exportExcel() {
  if (!currentTableDataFisico.length) { toast("Sem dados para exportar", "info"); return; }
  const data = currentTableDataFisico.map(r => ({ Estabelecimento: r.estabelecimento, Mes: r.mes, Agendados: r.agendados, Total_Faturado: r.faturadosQtd, Total_Financeiro: r.financeiroValor }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
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
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      selectedSubgrupos.clear(); selectedEspecialidades.clear();
      const grupoSelect = el("grupoSelect"); if (grupoSelect) grupoSelect.value = "";
      const periodoSelect = el("periodoSelect"); if (periodoSelect) periodoSelect.value = "";
      const tableMonthFilterFisico = el("tableMonthFilterFisico"); if (tableMonthFilterFisico) tableMonthFilterFisico.value = "";
      const tabelaMonthFilterEspec = el("tabelaMonthFilterEspec"); if (tabelaMonthFilterEspec) tabelaMonthFilterEspec.value = "";
      const msSearchSub = el("msSearchSub"); if (msSearchSub) msSearchSub.value = "";
      const msSearchEsp = el("msSearchEsp"); if (msSearchEsp) msSearchEsp.value = "";
      const tSearchFisico = el("tSearchFisico"); if (tSearchFisico) tSearchFisico.value = "";
      const tabelaSearchEspec = el("tabelaSearchEspec"); if (tabelaSearchEspec) tabelaSearchEspec.value = "";
      currentTableMonthFilterFisico = "";
      buildSubgrupoList(); buildEspecialidadeList(); applyFilters();
      toast("Filtros limpos", "info");
    });
  }
  const grupoSelect = el("grupoSelect"); if (grupoSelect) grupoSelect.addEventListener("change", () => { buildSubgrupoList(); applyFilters(); });
  const periodoSelect = el("periodoSelect"); if (periodoSelect) periodoSelect.addEventListener("change", applyFilters);
  const tableMonthFilterFisico = el("tableMonthFilterFisico"); if (tableMonthFilterFisico) tableMonthFilterFisico.addEventListener("change", e => { currentTableMonthFilterFisico = e.target.value || ""; renderTableBodyFisico(); });
  const tSearchFisico = el("tSearchFisico"); if (tSearchFisico) tSearchFisico.addEventListener("input", renderTableBodyFisico);
  document.addEventListener("click", () => closeAllDropdowns());
  const msDropdownSub = el("msDropdownSub"); if (msDropdownSub) msDropdownSub.addEventListener("click", e => e.stopPropagation());
  const msDropdownEsp = el("msDropdownEsp"); if (msDropdownEsp) msDropdownEsp.addEventListener("click", e => e.stopPropagation());
});
