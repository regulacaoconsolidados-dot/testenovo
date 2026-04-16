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
  if (btnClear) { btnClear.addEventListener("click", () => { 
    selectedSubgrupos.clear(); 
    selectedEspecialidades.clear(); 
    const grupoSelect = el("grupoSelect"); if (grupoSelect) grupoSelect.value = ""; 
    const periodoSelect = el("periodoSelect"); if (periodoSelect) periodoSelect.value = ""; 
    const tableMonthFilterFisico = el("tableMonthFilterFisico"); if (tableMonthFilterFisico) tableMonthFilterFisico.value = ""; 
    const tabelaMonthFilterEspec = el("tabelaMonthFilterEspec"); if (tabelaMonthFilterEspec) tabelaMonthFilterEspec.value = ""; 
    const msSearchSub = el("msSearchSub"); if (msSearchSub) msSearchSub.value = ""; 
    const msSearchEsp = el("msSearchEsp"); if (msSearchEsp) msSearchEsp.value = ""; 
    const tSearchFisico = el("tSearchFisico"); if (tSearchFisico) tSearchFisico.value = ""; 
    const tabelaSearchEspec = el("tabelaSearchEspec"); if (tabelaSearchEspec) tabelaSearchEspec.value = ""; 
    const searchFilaRetroativa = el("searchFilaRetroativa"); if (searchFilaRetroativa) searchFilaRetroativa.value = ""; 
    currentTableMonthFilterFisico = ""; 
    currentChartFilter = null; 
    buildSubgrupoList(); 
    buildEspecialidadeList(); 
    applyFilters(); 
    toast("Filtros limpos", "info"); 
  }); }
  const grupoSelect = el("grupoSelect"); if (grupoSelect) grupoSelect.addEventListener("change", () => { buildSubgrupoList(); applyFilters(); });
  const periodoSelect = el("periodoSelect"); if (periodoSelect) periodoSelect.addEventListener("change", () => { applyFilters(); });
  const tableMonthFilterFisico = el("tableMonthFilterFisico"); if (tableMonthFilterFisico) tableMonthFilterFisico.addEventListener("change", e => { currentTableMonthFilterFisico = e.target.value || ""; renderTableBodyFisico(); });
  const tSearchFisico = el("tSearchFisico"); if (tSearchFisico) tSearchFisico.addEventListener("input", renderTableBodyFisico);
  document.addEventListener("click", () => closeAllDropdowns());
  const msDropdownSub = el("msDropdownSub"); if (msDropdownSub) msDropdownSub.addEventListener("click", e => e.stopPropagation());
  const msDropdownEsp = el("msDropdownEsp"); if (msDropdownEsp) msDropdownEsp.addEventListener("click", e => e.stopPropagation());
});
