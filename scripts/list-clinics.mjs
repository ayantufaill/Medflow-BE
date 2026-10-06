import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://medflow:MedflowPass123!@localhost:5432/medflow_db',
});

await client.connect();
const result = await client.query(
  'select "ClinicNum", "Description", "GroupNum" from clinic order by "ClinicNum"',
);
console.log(JSON.stringify(result.rows, null, 2));
await client.end();
