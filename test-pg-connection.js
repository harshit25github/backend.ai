import pool from './src/config/database.js';

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');

    // Test connection
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully!');
    console.log('Current time:', result.rows[0].current_time);

    // Test tables
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('chat_contexts', 'chat_messages')
    `);

    console.log('📋 Available tables:', tables.rows.map(row => row.table_name));

    if (tables.rows.length === 0) {
      console.log('⚠️ Tables not found. Please run:');
      console.log('psql -d chat_context_db -f database/schema.sql');
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n🔧 Please check:');
    console.log('1. PostgreSQL is running');
    console.log('2. Database "chat_context_db" exists');
    console.log('3. Environment variables are set');
    console.log('4. Run: createdb chat_context_db');
    console.log('5. Run: psql -d chat_context_db -f database/schema.sql');
  } finally {
    await pool.end();
  }
}

testConnection();
