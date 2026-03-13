// =====================================================
// JORNADA ACADÊMICA - CONTROLE DE ESTUDOS (COM BACKEND)
// =====================================================

// Configuração da API
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : '/api'; // no mesmo domínio em produção

let state = {
    studies: [],
    subjects: [],
    filterSubject: null,
    filterStatus: '',
    searchTerm: '',
    currentMonth: new Date(),
    isLoading: false
};

let editingId = null;
let deleteId = null;
let currentTab = 0;
const tabs = ['tab-geral', 'tab-questoes', 'tab-revisao'];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    setupConnectionStatus();
    updateMonthDisplay();
    setInterval(checkConnection, 15000);
});

// ==================== CARREGAR DADOS DA API ====================
async function carregarDados() {
    try {
        // Carregar matérias
        const materiasRes = await fetch(`${API_URL}/materias`);
        if (materiasRes.ok) {
            state.subjects = await materiasRes.json();
        } else {
            state.subjects = [];
        }

        // Carregar estudos do mês atual
        const mes = state.currentMonth.getMonth() + 1;
        const ano = state.currentMonth.getFullYear();
        const estudosRes = await fetch(`${API_URL}/estudos?mes=${mes}&ano=${ano}`);
        if (estudosRes.ok) {
            state.studies = await estudosRes.json();
        } else {
            state.studies = [];
        }

        atualizarInterface();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('Erro ao conectar com o servidor', 'error');
    }
}

// ==================== INTERFACE ====================
function atualizarInterface() {
    populateMateriaSelect();
    updateTable();
    updateDashboard();
}

function populateMateriaSelect() {
    const selectForm = document.getElementById('materia');
    if (selectForm) {
        selectForm.innerHTML = '<option value="">Selecione uma matéria</option>';
        state.subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.nome;
            selectForm.appendChild(opt);
        });
    }

    const filterSelect = document.getElementById('filterMateria');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Todas Matérias</option>';
        state.subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.nome;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = state.filterSubject || '';
    }
}

// ==================== FILTROS ====================
function filterStudies() {
    state.searchTerm = document.getElementById('search').value.trim().toLowerCase();
    state.filterSubject = document.getElementById('filterMateria').value || null;
    state.filterStatus = document.getElementById('filterStatus').value;
    updateTable();
}

function changeMonth(direction) {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + direction);
    updateMonthDisplay();
    // Recarrega os estudos do novo mês
    carregarDados();
}

function updateMonthDisplay() {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const monthName = months[state.currentMonth.getMonth()];
    const year = state.currentMonth.getFullYear();
    document.getElementById('currentMonth').textContent = `${monthName} ${year}`;
}

// ==================== TABELA ====================
function updateTable() {
    const tbody = document.getElementById('estudosTableBody');
    if (!tbody) return;

    // Filtro local (já temos os dados do mês)
    let filtered = state.studies.filter(study => {
        if (state.filterSubject && study.materia_id != state.filterSubject) return false;
        
        if (state.searchTerm) {
            const term = state.searchTerm;
            if (!study.materia_nome?.toLowerCase().includes(term) &&
                !study.conteudo.toLowerCase().includes(term) &&
                !(study.unidade && study.unidade.toLowerCase().includes(term))) return false;
        }
        
        if (state.filterStatus) {
            const status = getStudyStatus(study);
            if (status !== state.filterStatus) return false;
        }
        return true;
    });

    filtered.sort((a, b) => (a.data_estudo > b.data_estudo ? -1 : 1));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;">Nenhum estudo encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(study => {
        const status = getStudyStatus(study);
        const statusClass = {
            'finalizado': 'badge finalizado',
            'fora-prazo': 'badge fora-prazo',
            'programado': 'badge programado'
        }[status] || 'badge programado';

        const desempenho = study.quantidade > 0 ? ((study.total_acertos / study.quantidade) * 100).toFixed(0) : '-';
        const precisaRevisao = study.quantidade && study.total_acertos && (desempenho < 85);
        const revisaoText = precisaRevisao ? 'SIM' : 'NÃO';
        const revisaoClass = precisaRevisao ? 'revisao-sim' : 'revisao-nao';
        const rowClass = study.concluido ? 'row-fechada' : '';

        return `
        <tr class="${rowClass}" data-id="${study.id}">
            <td class="checkbox-col">
                <div class="checkbox-wrapper">
                    <input 
                        type="checkbox" 
                        id="check-${study.id}"
                        ${study.concluido ? 'checked' : ''}
                        onchange="toggleFinalizado('${study.id}', this.checked)"
                        class="styled-checkbox"
                    >
                    <label for="check-${study.id}" class="checkbox-label-styled"></label>
                </div>
            </td>
            <td>${study.materia_nome || ''}</td>
            <td>${study.unidade || '-'}</td>
            <td>${study.conteudo}</td>
            <td><span class="${statusClass}">${status.replace('-', ' ').toUpperCase()}</span></td>
            <td>${desempenho}%</td>
            <td class="${revisaoClass}">${revisaoText}</td>
            <td class="actions-cell">
                <button onclick="editStudy(${study.id})" class="action-btn edit">Editar</button>
                <button onclick="openDeleteModal(${study.id})" class="action-btn delete">Excluir</button>
            </td>
        </tr>`;
    }).join('');
}

function getStudyStatus(study) {
    if (study.concluido) return 'finalizado';
    const hoje = new Date().toISOString().split('T')[0];
    if (study.data_estudo < hoje) return 'fora-prazo';
    return 'programado';
}

// ==================== DASHBOARD ====================
function updateDashboard() {
    const hoje = new Date().toISOString().split('T')[0];

    const finalizados = state.studies.filter(s => s.concluido).length;
    const foraPrazo = state.studies.filter(s => !s.concluido && s.data_estudo < hoje).length;
    const programados = state.studies.filter(s => !s.concluido && s.data_estudo >= hoje).length;
    const revisao = state.studies.filter(s => s.data_revisao && s.data_revisao.trim() !== '').length;

    document.getElementById('dashboardFinalizados').textContent = finalizados;
    document.getElementById('dashboardForaPrazo').textContent = foraPrazo;
    document.getElementById('dashboardProgramados').textContent = programados;
    document.getElementById('dashboardRevisao').textContent = revisao;

    // Alerta apenas para fora do prazo
    const cardForaPrazo = document.getElementById('cardForaPrazo');
    atualizarPulseBadge(cardForaPrazo, foraPrazo);
    // Revisão não tem alerta
}

function atualizarPulseBadge(card, count) {
    if (!card) return;
    let badge = card.querySelector('.pulse-badge');
    if (count > 0) {
        card.classList.add('has-alert');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'pulse-badge';
            card.appendChild(badge);
        }
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        card.classList.remove('has-alert');
        if (badge) {
            badge.style.display = 'none';
        }
    }
}

// ==================== MODAIS DE DASHBOARD ====================
function abrirModalDashboard(tipo) {
    let title = '', lista = [], colunas = '';
    const hoje = new Date().toISOString().split('T')[0];

    if (tipo === 'finalizados') {
        title = 'Estudos Finalizados';
        lista = state.studies.filter(s => s.concluido);
        colunas = '<tr><th>Matéria</th><th>Conteúdo</th><th>Data</th></tr>';
    } else if (tipo === 'fora-prazo') {
        title = 'Estudos Fora do Prazo';
        lista = state.studies.filter(s => !s.concluido && s.data_estudo < hoje);
        colunas = '<tr><th>Matéria</th><th>Conteúdo</th><th>Data</th></tr>';
    } else if (tipo === 'programados') {
        title = 'Estudos Programados';
        lista = state.studies.filter(s => !s.concluido && s.data_estudo >= hoje);
        colunas = '<tr><th>Matéria</th><th>Conteúdo</th><th>Data</th></tr>';
    } else if (tipo === 'revisao') {
        title = 'Revisões Agendadas';
        lista = state.studies.filter(s => s.data_revisao && s.data_revisao.trim() !== '');
        colunas = '<tr><th>Matéria</th><th>Conteúdo</th><th>Data Revisão</th></tr>';
    }

    if (lista.length === 0) {
        showToast('Nenhum item encontrado', 'error');
        return;
    }

    const body = document.getElementById('dashboardModalBody');
    let html = '<table style="width:100%;"><thead>' + colunas + '</thead><tbody>';
    lista.forEach(item => {
        if (tipo === 'revisao') {
            html += `<tr><td>${item.materia_nome}</td><td>${item.conteudo}</td><td>${item.data_revisao}</td></tr>`;
        } else {
            html += `<tr><td>${item.materia_nome}</td><td>${item.conteudo}</td><td>${item.data_estudo}</td></tr>`;
        }
    });
    html += '</tbody></table>';
    body.innerHTML = html;

    document.getElementById('dashboardModalTitle').textContent = title;
    document.getElementById('dashboardModal').classList.add('show');
}

function closeDashboardModal() {
    document.getElementById('dashboardModal').classList.remove('show');
}

// ==================== FORMULÁRIO (CRIAR/EDITAR) ====================
function toggleForm() {
    editingId = null;
    currentTab = 0;
    document.getElementById('formTitle').textContent = 'Novo Estudo';
    document.getElementById('studyForm').reset();
    document.getElementById('editId').value = '';
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('data_estudo').value = hoje;
    showTab(currentTab);
    updateNavigationButtons();
    document.getElementById('formModal').classList.add('show');
}

function closeFormModal(canceled = false) {
    document.getElementById('formModal').classList.remove('show');
    if (canceled) showToast('Operação cancelada', 'error');
    editingId = null;
}

async function editStudy(id) {
    try {
        const res = await fetch(`${API_URL}/estudos/${id}`);
        if (!res.ok) throw new Error('Erro ao buscar estudo');
        const study = await res.json();
        
        editingId = id;
        currentTab = 0;

        document.getElementById('formTitle').textContent = 'Editar Estudo';
        document.getElementById('editId').value = study.id;
        document.getElementById('materia').value = study.materia_id;
        document.getElementById('unidade').value = study.unidade || '';
        document.getElementById('conteudo').value = study.conteudo;
        document.getElementById('data_estudo').value = study.data_estudo;
        document.getElementById('quantidade').value = study.quantidade || '';
        document.getElementById('total_acertos').value = study.total_acertos || '';
        document.getElementById('data_revisao').value = study.data_revisao || '';

        showTab(currentTab);
        updateNavigationButtons();
        document.getElementById('formModal').classList.add('show');
    } catch (error) {
        showToast('Erro ao carregar estudo', 'error');
    }
}

async function saveStudy(event) {
    event.preventDefault();

    const materiaSelect = document.getElementById('materia');
    const materiaId = parseInt(materiaSelect.value);
    const materiaNome = materiaSelect.selectedOptions[0]?.text || '';

    if (!materiaId) {
        showToast('Selecione uma matéria', 'error');
        switchTab('tab-geral');
        return;
    }

    const studyData = {
        materia_id: materiaId,
        materia_nome: materiaNome,
        unidade: document.getElementById('unidade').value.trim().toUpperCase(),
        conteudo: document.getElementById('conteudo').value.trim().toUpperCase(),
        data_estudo: document.getElementById('data_estudo').value,
        quantidade: parseInt(document.getElementById('quantidade').value) || null,
        total_acertos: parseInt(document.getElementById('total_acertos').value) || null,
        data_revisao: document.getElementById('data_revisao').value || '',
        concluido: false // será definido pelo checkbox
    };

    // Validações
    if (studyData.quantidade && studyData.total_acertos === null) {
        showToast('Informe o total de acertos', 'error');
        switchTab('tab-questoes');
        return;
    }
    if (studyData.total_acertos && !studyData.quantidade) {
        showToast('Informe a quantidade de questões', 'error');
        switchTab('tab-questoes');
        return;
    }
    if (studyData.quantidade && studyData.total_acertos > studyData.quantidade) {
        showToast('Acertos não podem ser maiores que a quantidade', 'error');
        switchTab('tab-questoes');
        return;
    }

    const editId = document.getElementById('editId').value;

    try {
        let response;
        if (editId) {
            response = await fetch(`${API_URL}/estudos/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studyData)
            });
        } else {
            response = await fetch(`${API_URL}/estudos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studyData)
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao salvar');
        }

        const saved = await response.json();
        closeFormModal();
        showToast(editId ? 'Estudo atualizado!' : 'Estudo cadastrado!', 'success');
        await carregarDados(); // recarrega a lista
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== CHECKBOX FINALIZADO ====================
async function toggleFinalizado(id, checked) {
    try {
        // Primeiro busca o estudo atual
        const res = await fetch(`${API_URL}/estudos/${id}`);
        if (!res.ok) throw new Error('Estudo não encontrado');
        const study = await res.json();

        if (!checked) {
            // Desmarcar: permitido sempre
            await fetch(`${API_URL}/estudos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concluido: false })
            });
            showToast('Estudo marcado como não finalizado', 'success');
            await carregarDados();
            return;
        }

        // Marcando: validar
        if (!study.quantidade || !study.total_acertos) {
            showToast('Você ainda não registrou questões para este conteúdo', 'error');
            await carregarDados(); // re-renderiza para desmarcar
            return;
        }

        const desempenho = (study.total_acertos / study.quantidade) * 100;
        if (desempenho >= 85) {
            await fetch(`${API_URL}/estudos/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concluido: true })
            });
            showToast(`Conteúdo finalizado com ${desempenho.toFixed(0)}%!`, 'success');
            await carregarDados();
        } else {
            if (!study.data_revisao) {
                showToast('Você precisa definir uma data de revisão', 'error');
                await carregarDados(); // desmarca
                return;
            } else {
                await fetch(`${API_URL}/estudos/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ concluido: true })
                });
                const dataRev = study.data_revisao.split('-').reverse().join('/');
                showToast(`Conteúdo finalizado. Revisão marcada para ${dataRev}!`, 'error');
                await carregarDados();
            }
        }
    } catch (error) {
        showToast('Erro ao atualizar status', 'error');
        await carregarDados();
    }
}

// ==================== ABAS DO FORMULÁRIO ====================
function switchTab(tabId) {
    const tabIndex = tabs.indexOf(tabId);
    if (tabIndex !== -1) {
        currentTab = tabIndex;
        showTab(currentTab);
        updateNavigationButtons();
    }
}

function showTab(index) {
    const tabButtons = document.querySelectorAll('#formModal .tab-btn');
    const tabContents = document.querySelectorAll('#formModal .tab-content');
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    if (tabButtons[index]) tabButtons[index].classList.add('active');
    if (tabContents[index]) tabContents[index].classList.add('active');
}

function updateNavigationButtons() {
    const btnPrevious = document.getElementById('btnPrevious');
    const btnNext = document.getElementById('btnNext');
    const btnSave = document.getElementById('btnSave');
    
    if (currentTab > 0) {
        btnPrevious.style.display = 'inline-flex';
    } else {
        btnPrevious.style.display = 'none';
    }
    
    if (currentTab < tabs.length - 1) {
        btnNext.style.display = 'inline-flex';
        btnSave.style.display = 'none';
    } else {
        btnNext.style.display = 'none';
        btnSave.style.display = 'inline-flex';
    }
}

function nextTab() {
    if (currentTab < tabs.length - 1) {
        currentTab++;
        showTab(currentTab);
        updateNavigationButtons();
    }
}

function previousTab() {
    if (currentTab > 0) {
        currentTab--;
        showTab(currentTab);
        updateNavigationButtons();
    }
}

// ==================== GERENCIAR MATÉRIAS ====================
function openNewMateriaModal() {
    document.getElementById('nomeMateria').value = '';
    document.getElementById('newMateriaModal').classList.add('show');
}

function closeNewMateriaModal() {
    document.getElementById('newMateriaModal').classList.remove('show');
}

async function saveNewMateria(event) {
    event.preventDefault();
    const nome = document.getElementById('nomeMateria').value.trim().toUpperCase();
    if (!nome) {
        showToast('Nome da matéria é obrigatório', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/materias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao criar matéria');
        }
        closeNewMateriaModal();
        showToast(`Matéria "${nome}" criada!`, 'success');
        await carregarDados(); // recarrega matérias
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function openManageMateriasModal() {
    try {
        const res = await fetch(`${API_URL}/materias`);
        const materias = await res.json();
        const tbody = document.getElementById('materiasTableBody');
        tbody.innerHTML = materias.map(s => `
            <tr>
                <td>${s.nome}</td>
                <td style="text-align:center;">
                    <button onclick="confirmarExcluirMateria(${s.id}, '${s.nome}')" class="action-btn delete">Excluir</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="2" style="text-align:center;">Nenhuma matéria</td></tr>';
        
        document.getElementById('manageMateriasModal').classList.add('show');
    } catch (error) {
        showToast('Erro ao carregar matérias', 'error');
    }
}

function closeManageMateriasModal() {
    document.getElementById('manageMateriasModal').classList.remove('show');
}

function confirmarExcluirMateria(id, nome) {
    closeManageMateriasModal();
    if (confirm(`Tem certeza que deseja excluir a matéria "${nome}" e todos os seus estudos?`)) {
        excluirMateria(id);
    }
}

async function excluirMateria(id) {
    try {
        const response = await fetch(`${API_URL}/materias/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Erro ao excluir');
        showToast('Matéria excluída com sucesso', 'success');
        await carregarDados(); // recarrega matérias e estudos
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== EXCLUSÃO DE ESTUDO ====================
function openDeleteModal(id) {
    deleteId = id;
    document.getElementById('deleteMessage').textContent = 'Tem certeza que deseja excluir este estudo?';
    document.getElementById('deleteModal').classList.add('show');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
    deleteId = null;
}

async function confirmDelete() {
    if (!deleteId) return;
    try {
        const response = await fetch(`${API_URL}/estudos/${deleteId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Erro ao excluir');
        showToast('Estudo excluído!', 'success');
        await carregarDados();
    } catch (error) {
        showToast(error.message, 'error');
    }
    closeDeleteModal();
}

// ==================== UTILITÁRIOS ====================
function showToast(message, type = 'success') {
    document.querySelectorAll('.floating-message').forEach(m => m.remove());
    const div = document.createElement('div');
    div.className = `floating-message ${type}`;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.animation = 'slideOutBottom 0.3s ease forwards';
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

function setupConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (navigator.onLine) {
        statusElement.className = 'connection-status online';
    } else {
        statusElement.className = 'connection-status offline';
    }
}

function checkConnection() {
    const statusElement = document.getElementById('connectionStatus');
    if (navigator.onLine) {
        statusElement.className = 'connection-status online';
    } else {
        statusElement.className = 'connection-status offline';
    }
}

// ==================== PDF ====================
async function gerarPDF() {
    if (!state.filterSubject) {
        showToast('Selecione uma matéria no filtro para gerar o PDF', 'error');
        return;
    }

    const materia = state.subjects.find(s => s.id == state.filterSubject);
    if (!materia) return;

    try {
        // Buscar todos os estudos da matéria (sem filtro de mês)
        const res = await fetch(`${API_URL}/estudos?materia_id=${materia.id}`);
        if (!res.ok) throw new Error('Erro ao buscar estudos');
        const todosEstudos = await res.json();

        const estudos = todosEstudos.filter(s => 
            s.quantidade > 0 && 
            ((s.total_acertos / s.quantidade) * 100) < 100
        );

        if (estudos.length === 0) {
            showToast('Nenhum estudo com desempenho inferior a 100% para esta matéria', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(materia.nome, doc.internal.pageSize.width / 2, y, { align: 'center' });
        y += 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        estudos.forEach(est => {
            const data = est.data_estudo.split('-').reverse().join('/');
            doc.text(`${est.conteudo} - ${data}`, 14, y);
            y += 8;
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
        });

        doc.save(`estudos_${materia.nome.toLowerCase()}.pdf`);
        showToast('PDF gerado com sucesso!', 'success');
    } catch (error) {
        showToast('Erro ao gerar PDF', 'error');
    }
}
