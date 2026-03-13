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

// Inicializa cliente Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Teste de conexão básico (opcional)
(async () => {
  const { error } = await supabase.from('subjects').select('count', { count: 'exact', head: true });
  if (error) {
    console.error('❌ Erro ao conectar ao Supabase:', error.message);
  } else {
    console.log('✅ Conectado ao Supabase com sucesso');
  }
})();

// ==================== ROTAS DA API ====================

// GET /api/studies
app.get('/api/studies', async (req, res) => {
  try {
    const { mes, ano } = req.query;
    console.log(`📥 GET /api/studies - mes: ${mes}, ano: ${ano}`);

    let query = supabase.from('studies').select('*');

    if (mes !== undefined && ano !== undefined) {
      const month = parseInt(mes) + 1;
      const year = parseInt(ano);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
      console.log(`Filtrando datas de ${startDate} até ${endDate}`);
      query = query.gte('data_estudo', startDate).lte('data_estudo', endDate);
    }

    const { data, error } = await query.order('data_estudo', { ascending: false });

    if (error) {
      console.error('❌ Erro na consulta Supabase:', error);
      throw error;
    }

    console.log(`✅ Retornando ${data.length} estudos`);
    res.json(data);
  } catch (error) {
    console.error('❌ Erro em GET /api/studies:', error);
    res.status(500).json({ error: error.message, details: error });
  }
});

// POST /api/studies
app.post('/api/studies', async (req, res) => {
  try {
    console.log('📥 POST /api/studies - body:', req.body);
    const { data, error } = await supabase
      .from('studies')
      .insert([req.body])
      .select()
      .single();
    if (error) throw error;
    console.log('✅ Estudo criado com ID:', data.id);
    res.status(201).json(data);
  } catch (error) {
    console.error('❌ Erro em POST /api/studies:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/studies/:id
app.put('/api/studies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 PUT /api/studies/${id} - body:`, req.body);
    const { data, error } = await supabase
      .from('studies')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    console.log('✅ Estudo atualizado:', data.id);
    res.json(data);
  } catch (error) {
    console.error('❌ Erro em PUT /api/studies/:id', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/studies/:id
app.delete('/api/studies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 DELETE /api/studies/${id}`);
    const { error } = await supabase
      .from('studies')
      .delete()
      .eq('id', id);
    if (error) throw error;
    console.log('✅ Estudo deletado:', id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro em DELETE /api/studies/:id', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/subjects
app.get('/api/subjects', async (req, res) => {
  try {
    console.log('📥 GET /api/subjects');
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('nome');
    if (error) throw error;
    console.log('✅ Retornando', data.length, 'matérias');
    res.json(data);
  } catch (error) {
    console.error('❌ Erro em GET /api/subjects:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subjects
app.post('/api/subjects', async (req, res) => {
  try {
    const { nome } = req.body;
    console.log('📥 POST /api/subjects - nome:', nome);
    const { data, error } = await supabase
      .from('subjects')
      .insert([{ nome }])
      .select()
      .single();
    if (error) throw error;
    console.log('✅ Matéria criada com ID:', data.id);
    res.status(201).json(data);
  } catch (error) {
    console.error('❌ Erro em POST /api/subjects:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/subjects/:id
app.delete('/api/subjects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 DELETE /api/subjects/${id}`);
    // Deleta estudos relacionados
    await supabase.from('studies').delete().eq('materia_id', id);
    // Deleta matéria
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);
    if (error) throw error;
    console.log('✅ Matéria deletada:', id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro em DELETE /api/subjects/:id', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rota padrão (caso não seja API nem arquivo estático)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
  console.log(`📁 Servindo arquivos estáticos de: ${path.join(__dirname, 'public')}`);
});
