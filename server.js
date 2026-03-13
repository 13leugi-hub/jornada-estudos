require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Middleware para log de todas as requisições (opcional, útil para debug)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Servir arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// Inicializa cliente Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==================== ROTAS DA API ====================

// ---- Studies ----

// GET /api/studies?mes=2&ano=2026
app.get('/api/studies', async (req, res) => {
  try {
    const { mes, ano } = req.query;
    let query = supabase.from('studies').select('*');

    if (mes !== undefined && ano !== undefined) {
      // Converte mês (0-11) para número (1-12) e monta intervalo
      const month = parseInt(mes) + 1;
      const year = parseInt(ano);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      // Último dia do mês (simplificado, assume 31 – mas o banco de dados lida com isso)
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
      query = query.gte('data_estudo', startDate).lte('data_estudo', endDate);
    }

    const { data, error } = await query.order('data_estudo', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erro em GET /api/studies:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/studies
app.post('/api/studies', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('studies')
      .insert([req.body])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Erro em POST /api/studies:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/studies/:id
app.put('/api/studies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('studies')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erro em PUT /api/studies/:id', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/studies/:id
app.delete('/api/studies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('studies')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Erro em DELETE /api/studies/:id', error);
    res.status(500).json({ error: error.message });
  }
});

// ---- Subjects ----

// GET /api/subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('nome');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Erro em GET /api/subjects:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subjects
app.post('/api/subjects', async (req, res) => {
  try {
    const { nome } = req.body;
    const { data, error } = await supabase
      .from('subjects')
      .insert([{ nome }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Erro em POST /api/subjects:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/subjects/:id (remove também os estudos vinculados)
app.delete('/api/subjects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Deleta todos os estudos relacionados
    await supabase.from('studies').delete().eq('materia_id', id);
    // Deleta a matéria
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Erro em DELETE /api/subjects/:id', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check (para monitoramento)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
  console.log(`📁 Servindo arquivos estáticos de: ${path.join(__dirname, 'public')}`);
});
