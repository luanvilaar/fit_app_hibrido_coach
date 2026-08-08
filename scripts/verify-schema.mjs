#!/usr/bin/env node
// Compara o que as migrations declaram com o que o PostgREST expõe no banco remoto.
//
// Motivação: as migrations deste projeto são aplicadas manualmente pelo SQL Editor do
// Supabase (não há CLI/psql neste ambiente), então nada garante que o banco esteja na
// mesma altura da pasta supabase/migrations. Este script fecha essa lacuna.
//
// Uso:  node scripts/verify-schema.mjs
// Env:  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (lidos de .env na raiz)
//
// ATENÇÃO — o endpoint OpenAPI do PostgREST responde a partir do *schema cache*, não do
// catálogo do Postgres. Um cache defasado produz falso drift: objetos que já existem no
// banco aparecem como ausentes. Se este script acusar divergência, rode primeiro
//   notify pgrst, 'reload schema';
// no SQL Editor e execute de novo antes de concluir que a migration não foi aplicada.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(rootDir, "supabase", "migrations");

function loadRootEnv() {
  const env = {};
  let raw;

  try {
    raw = readFileSync(join(rootDir, ".env"), "utf8");
  } catch {
    return env;
  }

  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }

  return env;
}

// Percorre as migrations em ordem cronológica acumulando o estado declarado.
// Drops removem o objeto: o que foi criado e depois derrubado não é esperado no banco.
function readDeclaredSchema() {
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

  const tables = new Map(); // tabela -> Set<coluna>
  const functions = new Map(); // função -> arquivo que a declarou por último
  const granted = new Set(); // funções com grant execute (as únicas visíveis via PostgREST)

  const columnDefinitionKeywords = ["primary", "unique", "check", "constraint", "foreign", "exclude"];

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    let currentTable = null;
    // Colunas declaradas no corpo de um create table precisam entrar na mesma passada
    // cronológica que renames e drops, senão um rename posterior é desfeito.
    let insideCreateTable = false;

    for (const line of sql.split("\n")) {
      const stripped = line.replace(/--.*$/, "");

      const createTable = stripped.match(/create table (?:if not exists )?public\.(\w+)/i);
      if (createTable) {
        currentTable = createTable[1];
        insideCreateTable = true;
        if (!tables.has(currentTable)) tables.set(currentTable, new Set());
        continue;
      }

      if (insideCreateTable) {
        if (/^\s*\);/.test(stripped)) {
          insideCreateTable = false;
          continue;
        }

        const column = stripped.match(/^\s{2}(\w+)\s+\S/);
        if (column && !columnDefinitionKeywords.includes(column[1].toLowerCase())) {
          tables.get(currentTable).add(column[1]);
        }
        continue;
      }

      const alterTable = stripped.match(/alter table (?:only )?public\.(\w+)/i);
      if (alterTable) {
        currentTable = alterTable[1];
        if (!tables.has(currentTable)) tables.set(currentTable, new Set());
        continue;
      }

      if (currentTable) {
        const addColumn = stripped.match(/add column (?:if not exists )?(\w+)/i);
        if (addColumn) tables.get(currentTable).add(addColumn[1]);

        const dropColumn = stripped.match(/drop column (?:if exists )?(\w+)/i);
        if (dropColumn) tables.get(currentTable).delete(dropColumn[1]);

        const renameColumn = stripped.match(/rename column (\w+) to (\w+)/i);
        if (renameColumn) {
          tables.get(currentTable).delete(renameColumn[1]);
          tables.get(currentTable).add(renameColumn[2]);
        }
      }

      const createFunction = stripped.match(/create (?:or replace )?function public\.(\w+)/i);
      if (createFunction) {
        functions.set(createFunction[1], file);
        currentTable = null;
        continue;
      }

      const dropFunction = stripped.match(/drop function (?:if exists )?public\.(\w+)/i);
      if (dropFunction) functions.delete(dropFunction[1]);

      const grantExecute = stripped.match(/grant execute on function public\.(\w+)/i);
      if (grantExecute) granted.add(grantExecute[1]);
    }
  }

  // Só funções com grant execute são observáveis pelo PostgREST; trigger functions e
  // helpers internos ficam de fora para não virarem falso positivo.
  const observable = new Map();
  for (const [name, file] of functions) {
    if (granted.has(name)) observable.set(name, file);
  }

  return { tables, functions: observable };
}

async function readRemoteSchema(url, key) {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });

  if (!response.ok) {
    throw new Error(`PostgREST respondeu ${response.status} ao expor o OpenAPI.`);
  }

  const openapi = await response.json();
  const paths = Object.keys(openapi.paths ?? {});

  return {
    functions: new Set(paths.filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5))),
    tables: new Map(
      Object.entries(openapi.definitions ?? {}).map(([table, def]) => [
        table,
        new Set(Object.keys(def.properties ?? {}))
      ])
    )
  };
}

async function main() {
  const env = { ...loadRootEnv(), ...process.env };
  const url = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env na raiz).");
    process.exit(2);
  }

  const declared = readDeclaredSchema();
  const remote = await readRemoteSchema(url, key);
  const drift = [];

  for (const [table, columns] of declared.tables) {
    if (!remote.tables.has(table)) {
      drift.push(`tabela ausente: public.${table}`);
      continue;
    }

    const remoteColumns = remote.tables.get(table);
    for (const column of columns) {
      if (!remoteColumns.has(column)) drift.push(`coluna ausente: public.${table}.${column}`);
    }
  }

  for (const [name, file] of declared.functions) {
    if (!remote.functions.has(name)) drift.push(`função ausente: public.${name}()  [${file}]`);
  }

  if (drift.length === 0) {
    console.log(`OK — banco alinhado com supabase/migrations (${declared.tables.size} tabelas, ${declared.functions.size} funções).`);
    return;
  }

  console.log(`DRIFT — ${drift.length} divergência(s) entre supabase/migrations e o banco:\n`);
  for (const item of drift) console.log(`  - ${item}`);
  console.log(
    "\nAntes de aplicar qualquer migration, descarte a hipótese de cache defasado:" +
      "\nrode `notify pgrst, 'reload schema';` no SQL Editor e execute este script de novo."
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(`Falha ao verificar o schema: ${error.message}`);
  process.exit(2);
});
