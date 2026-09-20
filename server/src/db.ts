import "./env.js";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as seed from "./seedData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.isAbsolute(process.env.DB_PATH ?? "")
  ? (process.env.DB_PATH as string)
  : path.join(__dirname, "..", process.env.DB_PATH ?? "data.sqlite");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS readings (
    machine_id TEXT PRIMARY KEY,
    temperature REAL, pressure REAL, speed REAL, vibration REAL, recorded_at TEXT
  );

  CREATE TABLE IF NOT EXISTS standard_values (
    machine_id TEXT NOT NULL,
    parameter TEXT NOT NULL,
    label TEXT NOT NULL,
    correct_value REAL NOT NULL,
    min REAL NOT NULL,
    max REAL NOT NULL,
    unit TEXT NOT NULL,
    PRIMARY KEY (machine_id, parameter)
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    parameter TEXT NOT NULL,
    label TEXT NOT NULL,
    expected_min REAL, expected_max REAL, actual_value REAL, unit TEXT,
    severity TEXT, emergency INTEGER, status TEXT, recommended_action TEXT,
    downtime_minutes REAL, cost_per_minute REAL,
    downtime_start TEXT, downtime_end TEXT, date TEXT,
    acknowledged INTEGER, maintenance_notified INTEGER
  );

  CREATE TABLE IF NOT EXISTS product_defects (
    product_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    defect_type TEXT, target_value REAL, actual_value REAL, unit TEXT,
    reworked_quantity INTEGER, scrapped_quantity INTEGER, recorded_at TEXT,
    temperature REAL, pressure REAL, speed REAL, vibration REAL,
    confidence REAL, location TEXT,
    review_status TEXT NOT NULL DEFAULT 'auto',
    source TEXT NOT NULL DEFAULT 'seed'
  );

  CREATE TABLE IF NOT EXISTS production_points (
    time TEXT PRIMARY KEY, production INTEGER, good INTEGER, defective INTEGER
  );

  CREATE TABLE IF NOT EXISTS defect_distribution (
    category TEXT PRIMARY KEY, units INTEGER
  );

  CREATE TABLE IF NOT EXISTS class_metrics (
    category TEXT PRIMARY KEY, precision REAL, recall REAL, f1 REAL, support INTEGER
  );

  CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
  );
`);

// Migration for DBs created before review_status existed -- CREATE TABLE
// IF NOT EXISTS above won't add a column to an already-existing table.
const defectColumns = db.prepare("PRAGMA table_info(product_defects)").all() as Array<{ name: string }>;
if (!defectColumns.some((c) => c.name === "review_status")) {
  db.exec("ALTER TABLE product_defects ADD COLUMN review_status TEXT NOT NULL DEFAULT 'auto'");
  db.prepare("UPDATE product_defects SET review_status = 'pending_review' WHERE confidence < 0.75 AND review_status = 'auto'").run();
  console.log("[db] Migrated product_defects: added review_status");
}
if (!defectColumns.some((c) => c.name === "source")) {
  db.exec("ALTER TABLE product_defects ADD COLUMN source TEXT NOT NULL DEFAULT 'seed'");
  console.log("[db] Migrated product_defects: added source");
}

function isSeeded(): boolean {
  const row = db.prepare("SELECT COUNT(*) as n FROM machines").get() as { n: number };
  return row.n > 0;
}

function seedDatabase() {
  const insertMachine = db.prepare("INSERT INTO machines (id, name, status) VALUES (@id, @name, @status)");
  const insertReading = db.prepare(
    "INSERT INTO readings (machine_id, temperature, pressure, speed, vibration, recorded_at) VALUES (@machineId, @temperature, @pressure, @speed, @vibration, @recordedAt)"
  );
  const insertStandard = db.prepare(
    "INSERT INTO standard_values (machine_id, parameter, label, correct_value, min, max, unit) VALUES (@machineId, @parameter, @label, @correctValue, @min, @max, @unit)"
  );
  const insertIncident = db.prepare(`
    INSERT INTO incidents (id, machine_id, parameter, label, expected_min, expected_max, actual_value, unit, severity, emergency, status, recommended_action, downtime_minutes, cost_per_minute, downtime_start, downtime_end, date, acknowledged, maintenance_notified)
    VALUES (@id, @machineId, @parameter, @label, @expectedMin, @expectedMax, @actualValue, @unit, @severity, @emergency, @status, @recommendedAction, @downtimeMinutes, @costPerMinute, @downtimeStart, @downtimeEnd, @date, @acknowledged, @maintenanceNotified)
  `);
  const insertDefect = db.prepare(`
    INSERT INTO product_defects (product_id, machine_id, defect_type, target_value, actual_value, unit, reworked_quantity, scrapped_quantity, recorded_at, temperature, pressure, speed, vibration, confidence, location, review_status)
    VALUES (@productId, @machineId, @defectType, @targetValue, @actualValue, @unit, @reworkedQuantity, @scrappedQuantity, @recordedAt, @temperature, @pressure, @speed, @vibration, @confidence, @location, @reviewStatus)
  `);
  const insertProduction = db.prepare("INSERT INTO production_points (time, production, good, defective) VALUES (@time, @production, @good, @defective)");
  const insertDistribution = db.prepare("INSERT INTO defect_distribution (category, units) VALUES (@category, @units)");
  const insertClassMetric = db.prepare(
    "INSERT INTO class_metrics (category, precision, recall, f1, support) VALUES (@category, @precision, @recall, @f1, @support)"
  );
  const insertKv = db.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?)");

  const seedAll = db.transaction(() => {
    seed.MACHINES.forEach((m) => insertMachine.run(m));
    seed.MACHINE_READINGS.forEach((r) => insertReading.run(r));
    seed.STANDARD_VALUES.forEach((s) => insertStandard.run(s));
    seed.INCIDENTS.forEach((i) =>
      insertIncident.run({ ...i, emergency: i.emergency ? 1 : 0, acknowledged: i.acknowledged ? 1 : 0, maintenanceNotified: i.maintenanceNotified ? 1 : 0, downtimeStart: i.downtimeStart ?? null, downtimeEnd: i.downtimeEnd ?? null })
    );
    seed.PRODUCT_DEFECTS.forEach((d) =>
      insertDefect.run({
        ...d,
        temperature: d.machineParametersAtProduction.temperature,
        pressure: d.machineParametersAtProduction.pressure,
        speed: d.machineParametersAtProduction.speed,
        vibration: d.machineParametersAtProduction.vibration,
      })
    );
    seed.PRODUCTION_TREND.forEach((p) => insertProduction.run(p));
    seed.DEFECT_DISTRIBUTION.forEach((d) => insertDistribution.run(d));
    seed.CLASS_METRICS.forEach((c) => insertClassMetric.run(c));

    insertKv.run("confusion_labels", JSON.stringify(seed.CONFUSION_LABELS));
    insertKv.run("confusion_matrix", JSON.stringify(seed.CONFUSION_MATRIX));
    insertKv.run("robustness_conditions", JSON.stringify(seed.ROBUSTNESS_CONDITIONS));
    insertKv.run("far_frr_curve", JSON.stringify(seed.FAR_FRR_CURVE));
    insertKv.run("cost_config", JSON.stringify(seed.COST_CONFIG));
    insertKv.run("heatmap_hours", JSON.stringify(seed.HEATMAP_HOURS));
    insertKv.run("heatmap_rows", JSON.stringify(seed.HEATMAP_ROWS));
  });

  seedAll();
}

if (!isSeeded()) {
  seedDatabase();
  console.log("[db] Seeded database at", dbPath);
} else {
  console.log("[db] Using existing database at", dbPath);
}

export function getKv<T>(key: string): T {
  const row = db.prepare("SELECT value FROM kv_store WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) throw new Error(`kv_store key not found: ${key}`);
  return JSON.parse(row.value) as T;
}

export function setKv(key: string, value: unknown) {
  db.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
}
