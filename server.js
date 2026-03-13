require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // para servir frontend (opcional)

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==================== ROTAS DE MATÉRIAS ====================

// Listar todas as matérias
app.get('/api/materias', async (req, res) => {
    const { data, error } = await supabase
        .from('materias')
        .select('*')
        .order('nome');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Criar nova matéria
app.post('/api/materias', async (req, res) => {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const { data, error } = await supabase
        .from('materias')
        .insert([{ nome: nome.toUpperCase() }])
        .select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// Excluir matéria (e estudos em cascata)
app.delete('/api/materias/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('materias')
        .delete()
        .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
});

// ==================== ROTAS DE ESTUDOS ====================

// Listar estudos (com filtros opcionais)
app.get('/api/estudos', async (req, res) => {
    const { mes, ano, materia_id } = req.query;
    let query = supabase
        .from('estudos')
        .select(`
            *,
            materias ( nome )
        `)
        .order('data_estudo', { ascending: false });

    if (mes && ano) {
        const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const end = `${ano}-${String(mes).padStart(2, '0')}-31`;
        query = query.gte('data_estudo', start).lte('data_estudo', end);
    }

    if (materia_id) {
        query = query.eq('materia_id', materia_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Mapear para incluir materia_nome
    const result = data.map(item => ({
        ...item,
        materia_nome: item.materias?.nome
    }));
    res.json(result);
});

// Buscar um estudo por ID
app.get('/api/estudos/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('estudos')
        .select(`
            *,
            materias ( nome )
        `)
        .eq('id', id)
        .single();
    if (error) return res.status(404).json({ error: 'Estudo não encontrado' });
    data.materia_nome = data.materias?.nome;
    delete data.materias;
    res.json(data);
});

// Criar novo estudo
app.post('/api/estudos', async (req, res) => {
    const {
        materia_id,
        unidade,
        conteudo,
        data_estudo,
        quantidade,
        total_acertos,
        data_revisao,
        concluido = false
    } = req.body;

    if (!materia_id || !conteudo || !data_estudo) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const { data, error } = await supabase
        .from('estudos')
        .insert([{
            materia_id,
            unidade,
            conteudo: conteudo.toUpperCase(),
            data_estudo,
            quantidade,
            total_acertos,
            data_revisao,
            concluido
        }])
        .select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data[0]);
});

// Atualizar estudo
app.put('/api/estudos/:id', async (req, res) => {
    const { id } = req.params;
    const {
        materia_id,
        unidade,
        conteudo,
        data_estudo,
        quantidade,
        total_acertos,
        data_revisao,
        concluido
    } = req.body;

    const updateData = {};
    if (materia_id !== undefined) updateData.materia_id = materia_id;
    if (unidade !== undefined) updateData.unidade = unidade?.toUpperCase();
    if (conteudo !== undefined) updateData.conteudo = conteudo?.toUpperCase();
    if (data_estudo !== undefined) updateData.data_estudo = data_estudo;
    if (quantidade !== undefined) updateData.quantidade = quantidade;
    if (total_acertos !== undefined) updateData.total_acertos = total_acertos;
    if (data_revisao !== undefined) updateData.data_revisao = data_revisao;
    if (concluido !== undefined) updateData.concluido = concluido;

    const { data, error } = await supabase
        .from('estudos')
        .update(updateData)
        .eq('id', id)
        .select();
    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(404).json({ error: 'Estudo não encontrado' });
    res.json(data[0]);
});

// Atualização parcial (PATCH) - usada para toggle do checkbox
app.patch('/api/estudos/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
        .from('estudos')
        .update(updates)
        .eq('id', id)
        .select();
    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(404).json({ error: 'Estudo não encontrado' });
    res.json(data[0]);
});

// Excluir estudo
app.delete('/api/estudos/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('estudos')
        .delete()
        .eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(204).send();
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
