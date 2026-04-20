import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

const statements = [
  "ALTER TABLE `simulation_scenarios` ADD COLUMN `backgroundSvg` MEDIUMTEXT",
  "ALTER TABLE `simulation_scenarios` ADD COLUMN `backgroundLayers` json",
  "ALTER TABLE `simulation_scenarios` ADD COLUMN `backgroundOpacity` decimal(4,2) DEFAULT '0.35'",
  "ALTER TABLE `simulation_scenarios` ADD COLUMN `backgroundOffsetX` decimal(10,2) DEFAULT '0'",
  "ALTER TABLE `simulation_scenarios` ADD COLUMN `backgroundOffsetY` decimal(10,2) DEFAULT '0'",
  "ALTER TABLE `simulation_scenarios` ADD COLUMN `backgroundScale` decimal(10,4) DEFAULT '1.0000'",
  "ALTER TABLE `simulation_scenarios` ADD COLUMN `backgroundFileName` varchar(255)",
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log('✓', sql.substring(0, 60));
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠ already exists, skip:', sql.substring(0, 60));
    } else {
      console.error('✗', err.message);
    }
  }
}

await conn.end();
console.log('Migration complete.');
