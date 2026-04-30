// ============================================================
// GRÁFICOS - AGENDAMENTOS POR DISTRITO (CORES ORIGINAIS)
// ============================================================

function renderChartPrimeiraConsultaDistrito() {
  const ctx = document.getElementById('chartPrimeiraConsultaDistrito')?.getContext('2d');
  if (!ctx) return;
  const pcData = filteredData.filter(r => r.tipoAtendimento === 'Primeira Consulta');
  const counts = countBy(pcData, r => r.distrito);
  const entries = sortedEntries(counts);
  const labels = entries.map(e => e[0]);
  const data = entries.map(e => e[1]);
  
  destroyChart(chartPrimeiraConsultaDistrito);
  chartPrimeiraConsultaDistrito = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '1ª Consulta',
        data,
        backgroundColor: 'rgba(46,204,113,0.85)',
        borderColor: '#27ae60',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: TOOLTIP_BASE,
        datalabels: {
          anchor: 'center',
          align: 'center',
          color: '#fff',
          font: { family: 'Inter', size: 13, weight: 'bold' },
          formatter: val => val > 0 ? fmt(val) : ''
        }
      },
      scales: {
        x: {
          ticks: { font: { family: 'Inter', size: 10, weight: '600' }, color: '#3d5166', maxRotation: 30 },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { font: { family: 'Inter', size: 10 }, color: '#7a8fa6' },
          grid: { display: false }
        }
      }
    }
  });
}

function renderChartRetornoDistrito() {
  const ctx = document.getElementById('chartRetornoDistrito')?.getContext('2d');
  if (!ctx) return;
  const retData = filteredData.filter(r => r.tipoAtendimento === 'Retorno');
  const counts = countBy(retData, r => r.distrito);
  const entries = sortedEntries(counts);
  const labels = entries.map(e => e[0]);
  const data = entries.map(e => e[1]);
  
  destroyChart(chartRetornoDistrito);
  chartRetornoDistrito = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Retorno',
        data,
        backgroundColor: 'rgba(155,89,182,0.85)',
        borderColor: '#8e44ad',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: TOOLTIP_BASE,
        datalabels: {
          anchor: 'center',
          align: 'center',
          color: '#fff',
          font: { family: 'Inter', size: 13, weight: 'bold' },
          formatter: val => val > 0 ? fmt(val) : ''
        }
      },
      scales: {
        x: {
          ticks: { font: { family: 'Inter', size: 10, weight: '600' }, color: '#3d5166', maxRotation: 30 },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { font: { family: 'Inter', size: 10 }, color: '#7a8fa6' },
          grid: { display: false }
        }
      }
    }
  });
}

function renderChartComparativoDistrito() {
  const ctx = document.getElementById('chartComparativoDistrito')?.getContext('2d');
  if (!ctx) return;
  const distritos = [...new Set(filteredData.map(r => r.distrito).filter(Boolean))].sort();
  const pcCounts = distritos.map(d => filteredData.filter(r => r.distrito === d && r.tipoAtendimento === 'Primeira Consulta').length);
  const retCounts = distritos.map(d => filteredData.filter(r => r.distrito === d && r.tipoAtendimento === 'Retorno').length);
  
  destroyChart(chartComparativoDistrito);
  chartComparativoDistrito = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: distritos,
      datasets: [
        {
          label: '1ª Consulta',
          data: pcCounts,
          backgroundColor: 'rgba(46,204,113,0.85)',
          borderColor: '#27ae60',
          borderWidth: 2,
          borderRadius: 6,
        },
        {
          label: 'Retorno',
          data: retCounts,
          backgroundColor: 'rgba(155,89,182,0.85)',
          borderColor: '#8e44ad',
          borderWidth: 2,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Inter', size: 12, weight: '600' },
            color: '#3d5166',
            usePointStyle: true,
            pointStyleWidth: 10,
          }
        },
        tooltip: TOOLTIP_BASE,
        datalabels: {
          anchor: 'center',
          align: 'center',
          color: '#fff',
          font: { family: 'Inter', size: 11, weight: 'bold' },
          formatter: val => val > 0 ? fmt(val) : ''
        }
      },
      scales: {
        x: {
          ticks: { font: { family: 'Inter', size: 10, weight: '600' }, color: '#3d5166', maxRotation: 35 },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { font: { family: 'Inter', size: 10 }, color: '#7a8fa6' },
          grid: { display: false }
        }
      }
    }
  });
}

function renderChartDistritoRosca() {
  const ctx = document.getElementById('chartDistritoRosca')?.getContext('2d');
  if (!ctx) return;
  const counts = countBy(filteredData, r => r.distrito);
  const entries = sortedEntries(counts);
  const labels = entries.map(e => e[0]);
  const data = entries.map(e => e[1]);
  const total = data.reduce((a,b) => a+b, 0);
  
  destroyChart(chartDistritoRosca);
  chartDistritoRosca = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#e74c3c','#3498db','#e67e22','#2ecc71','#9b59b6','#1abc9c','#f39c12','#e91e63'],
        borderColor: '#fff',
        borderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { family: 'Inter', size: 11, weight: '600' },
            color: '#3d5166',
            padding: 14,
          }
        },
        tooltip: {
          ...TOOLTIP_BASE,
          callbacks: {
            label: ctx => ` ${fmt(ctx.raw)} agendamentos (${total > 0 ? (ctx.raw/total*100).toFixed(1) : 0}%)`
          }
        },
        datalabels: {
          color: '#fff',
          font: { family: 'Inter', size: 11, weight: 'bold' },
          formatter: (val) => total > 0 ? (val/total*100).toFixed(0) + '%' : ''
        },
        centerText: {
          enabled: true,
          value: fmt(total),
          label: 'Total',
          fontSize: 22,
          valueColor: '#1e3a5f',
          labelColor: '#7a8fa6'
        }
      }
    }
  });
}
