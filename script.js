(function() {
  'use strict';

  // Dados estáticos de Telefones Úteis e Links Importantes
  const TELEFONES_DATA = {
    title: 'Telefones Úteis',
    icon: 'fa-phone-alt',
    links: [
      { text: 'Telefones Ceaps', url: 'https://compartilhacmc-commits.github.io/arquivosfixos/CEAPS_TELEFONES.html' },
      { text: 'Telefones Iria Diniz', url: 'https://compartilhacmc-commits.github.io/arquivosfixos/TELEFONES_IRIA_DINIZ.html' },
      { text: 'Telefones CCE´s e Outros', url: 'https://compartilhacmc-commits.github.io/arquivosfixos/TELEFONES_CCE_OUTROS.html' },
      { text: 'Telefones Diversos', url: 'https://compartilhacmc-commits.github.io/arquivosfixos/TELEFONES_DIVERSOS.html' },
      { text: 'Telefones – Todas as Unidades', url: 'https://compartilhacmc-commits.github.io/arquivosfixos/TELEFONES_UNIDADES_DE_CONTAGEM.html' },
      { text: 'Telefones Todos os Distritos', url: 'https://compartilhacmc-commits.github.io/arquivosfixos/DISTRITOS_CONTATOS.html' },
      { text: 'Telefones Upas', url: 'https://compartilhacmc-commits.github.io/arquivosfixos/UPA_TELEFONES.html' }
    ]
  };

  const IMPORTANTES_DATA = {
    title: 'Links Importantes',
    icon: 'fa-link',
    links: [
      { text: 'Sistema Vivver', url: 'https://www.contagem-mg.vivver.com/desktop' },
      { text: 'Notas Técnicas Diretoria de Regulação', url: 'https://portal.contagem.mg.gov.br/nota-tecnica' },
      { text: 'Prefeitura de Contagem', url: 'https://portal.contagem.mg.gov.br/' },
      { text: 'Portal da Secretaria de Saude Contagem', url: 'https://portal.contagem.mg.gov.br/secretaria-de-saude' },
      { text: 'Portal do Servidor', url: 'https://portal.contagem.mg.gov.br/portal/paginas-dinamicas-categoria/15/' },
      { text: 'Aplicativos /Contagem', url: 'https://geoprocessamento.contagem.mg.gov.br/portal/apps/sites/#/geocontagem' },
      { text: 'Aqui tem /Remédio', url: 'https://geoprocessamento.contagem.mg.gov.br/portal/apps/experiencebuilder/experience/?id=1cc51ed1bb7546e092ecad2935cc425d' },
      { text: 'Endereço das /Unidades', url: 'https://portal.contagem.mg.gov.br/atencao-primaria' },
      { text: 'Equipamentos da Saúde de Contagem', url: 'https://geoprocessamento.contagem.mg.gov.br/portal/apps/webappviewer/index.html?id=a29dd6c9d5944c51998c3ffa1efe0c70' },
      { text: 'CadWeb', url: 'https://cadastro.saude.gov.br/segcartao/?contextType=external&username=string&contextValue=%2Foam&password=sercure_string&challenge_url=https%3A%2F%2Fcadastro.saude.gov.br%2Fsegcartao&request_id=-8519814493389994660&authn_try_count=0&locale=es_ES&resource_url' },
      { text: 'Pesquisa do CNS', url: 'https://cnesadm.datasus.gov.br/cnesadm/publico/usuarios/cadastro' },
      { text: 'Pesquisa por endereço', url: 'https://app.powerbi.com/view?r=eyJrIjoiYTRiZDcyZWYtMzAwNS00NmYyLTk3N2EtYWEwYTk2NTFhMmY1IiwidCI6ImFlODYzMzdlLTU3NWUtNDMzMC05NDc2LTkzZGU2ODJiMDAyMCJ9' },
      { text: 'E gestor', url: 'https://egestoraps.saude.gov.br/' },
      { text: 'Cnes', url: 'https://cnes.datasus.gov.br/pages/estabelecimentos/consulta.jsp' },
      { text: 'Tabela Sigtap', url: 'http://sigtap.datasus.gov.br/tabela-unificada/app/sec/inicio.jsp' },
      { text: 'Siscan', url: 'https://siscan.saude.gov.br/login.jsf' },
      { text: 'Esus Notifica', url: 'https://notifica.saude.gov.br/login' },
      { text: 'CRM', url: 'https://crmmg.org.br/' }
    ]
  };

  function criarSection(data) {
    const section = document.createElement('section');
    section.className = 'category-section';
    section.innerHTML = `
      <h2 class="category-title"><i class="fas ${data.icon}"></i> ${data.title}</h2>
      <div class="links-grid">
        ${data.links.map(link => `
          <a href="${link.url}" class="link-button" target="_blank" rel="noopener">
            <i class="fas fa-external-link-alt"></i>
            <span>${link.text}</span>
          </a>
        `).join('')}
      </div>
    `;
    return section;
  }

  // Injeta os blocos fixos em todas as abas
  function injectPermanentSections() {
    const containers = document.querySelectorAll('.tab-content .categories-grid');
    containers.forEach(grid => {
      // Verifica se já foram adicionados para evitar duplicação
      if (!grid.querySelector('[data-permanent="telefones"]')) {
        const telefonesSection = criarSection(TELEFONES_DATA);
        telefonesSection.setAttribute('data-permanent', 'telefones');
        grid.appendChild(telefonesSection);
      }
      if (!grid.querySelector('[data-permanent="importantes"]')) {
        const importantesSection = criarSection(IMPORTANTES_DATA);
        importantesSection.setAttribute('data-permanent', 'importantes');
        grid.appendChild(importantesSection);
      }
    });
  }

  // Sistema de abas
  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    function switchTab(tabId) {
      contents.forEach(c => c.classList.remove('active'));
      tabBtns.forEach(b => b.classList.remove('active'));

      const target = document.getElementById(`tab-${tabId}`);
      const activeBtn = Array.from(tabBtns).find(b => b.dataset.tab === tabId);
      if (target) target.classList.add('active');
      if (activeBtn) activeBtn.classList.add('active');
    }

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
      });
    });
  }

  // Busca GLOBAL (centralizada) que filtra em todas as abas dinamicamente
  function initGlobalSearch() {
    const globalSearchInput = document.querySelector('.global-search-input');
    if (!globalSearchInput) return;

    function performGlobalSearch() {
      const term = globalSearchInput.value.toLowerCase().trim();
      const allTabContents = document.querySelectorAll('.tab-content');
      
      // Se não houver termo, mostra todas as seções e links normalmente
      if (term === '') {
        allTabContents.forEach(tabContent => {
          const sections = tabContent.querySelectorAll('.category-section');
          const allLinks = tabContent.querySelectorAll('.link-button');
          sections.forEach(s => s.style.display = 'block');
          allLinks.forEach(l => l.style.display = 'flex');
        });
        return;
      }

      // Itera sobre cada aba para aplicar o filtro
      allTabContents.forEach(tabContent => {
        const sections = tabContent.querySelectorAll('.category-section');
        let tabHasVisibleItems = false;

        sections.forEach(section => {
          const title = section.querySelector('.category-title')?.textContent.toLowerCase() || '';
          const links = section.querySelectorAll('.link-button');
          let sectionHasVisible = false;

          links.forEach(link => {
            const text = link.textContent.toLowerCase();
            if (text.includes(term) || title.includes(term)) {
              link.style.display = 'flex';
              sectionHasVisible = true;
              tabHasVisibleItems = true;
            } else {
              link.style.display = 'none';
            }
          });

          // Mostra a seção se ela tiver links visíveis ou o título corresponder
          section.style.display = (sectionHasVisible || title.includes(term)) ? 'block' : 'none';
        });

        // Opcional: você pode esconder abas vazias, mas por enquanto mantemos
        // Apenas garantimos que se não houver itens, a aba fica sem conteúdo visível
      });
    }

    globalSearchInput.addEventListener('input', performGlobalSearch);
    globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        globalSearchInput.value = '';
        performGlobalSearch();
        globalSearchInput.blur();
      }
    });
  }

  // Efeito sutil nos botões
  function initButtonEffects() {
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.link-button');
      if (btn && !btn.classList.contains('disabled')) {
        btn.style.transform = 'scale(0.98)';
        setTimeout(() => btn.style.transform = '', 120);
      }
    });
  }

  // Inicialização
  function init() {
    injectPermanentSections();
    initTabs();
    initGlobalSearch(); // Substitui a busca por aba
    initButtonEffects();
    console.log('✅ Portal Ferramentas Administrativas carregado com sucesso!');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
