const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/diary_test_db',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  end: () => pool.end(),
};
