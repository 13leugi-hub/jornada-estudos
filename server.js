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

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Verifica variáveis de ambiente
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas');
  process.exit(1);
}

// Inicializa Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Testa conexão com Supabase (opcional)
(async () => {
  try {
    const { error } = await supabase.from('subjects').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log('✅ Conexão com Supabase OK');
  } catch (err) {
    console.error('❌ Erro ao conectar com Supabase:', err.message);
  }
})();

// ==================== ROTAS ====================

// GET /api/studies
app.get('/api/studies', async (req, res) => {
  try {
    const { mes, ano } = req.query;
    console.log(`Parâmetros recebidos: mes=${mes}, ano=${ano}`);

    let query = supabase.from('studies').select('*');

    if (mes !== undefined && ano !== undefined) {
      const month = parseInt(mes) + 1;
      const year = parseInt(ano);
      if (isNaN(month) || isNaN(year)) {
        return res.status(400).json({ error: 'mes e ano devem ser números' });
      }
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
      console.log(`Filtrando por data entre ${startDate} e ${endDate}`);
      query = query.gte('data_estudo', startDate).lte('data_estudo', endDate);
    }

    const { data, error } = await query.order('data_estudo', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Erro em GET /api/studies:', error);
    res.status(500).json({ error: error.message, details: error.details });
  }
});

// POST /api/studies
app.post('/api/studies', async (req, res) => {
  try {
    console.log('Dados recebidos para criar estudo:', req.body);
    const { data, error } = await supabase
      .from('studies')
      .insert([req.body])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('❌ Erro em POST /api/studies:', error);
    res.status(500).json({ error: error.message, details: error.details });
  }
});

// PUT /api/studies/:id
app.put('/api/studies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Atualizando estudo ${id} com:`, req.body);
    const { data, error } = await supabase
      .from('studies')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('❌ Erro em PUT /api/studies/:id', error);
    res.status(500).json({ error: error.message, details: error.details });
  }
});

// DELETE /api/studies/:id
app.delete('/api/studies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Deletando estudo ${id}`);
    const { error } = await supabase
      .from('studies')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro em DELETE /api/studies/:id', error);
    res.status(500).json({ error: error.message, details: error.details });
  }
});

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
    console.error('❌ Erro em GET /api/subjects:', error);
    res.status(500).json({ error: error.message, details: error.details });
  }
});

// POST /api/subjects
app.post('/api/subjects', async (req, res) => {
  try {
    const { nome } = req.body;
    console.log('Criando nova matéria:', nome);
    const { data, error } = await supabase
      .from('subjects')
      .insert([{ nome }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('❌ Erro em POST /api/subjects:', error);
    res.status(500).json({ error: error.message, details: error.details });
  }
});

// DELETE /api/subjects/:id
app.delete('/api/subjects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Deletando matéria ${id} e seus estudos`);
    await supabase.from('studies').delete().eq('materia_id', id);
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro em DELETE /api/subjects/:id', error);
    res.status(500).json({ error: error.message, details: error.details });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware de erro global (captura erros não tratados)
app.use((err, req, res, next) => {
  console.error('🔥 Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicia servidor
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
  console.log(`📁 Servindo arquivos estáticos de: ${path.join(__dirname, 'public')}`);
  console.log(`🔗 SUPABASE_URL: ${process.env.SUPABASE_URL ? 'definida' : 'NÃO DEFINIDA'}`);
  console.log(`🔑 SUPABASE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'definida' : 'NÃO DEFINIDA'}`);
});
