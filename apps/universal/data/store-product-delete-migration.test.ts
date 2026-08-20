import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationsDir = resolve(__dirname, "../../../supabase/migrations");
const migration = readFileSync(resolve(migrationsDir, "20260820100000_store_product_delete.sql"), "utf8");
const rollback = readFileSync(
  resolve(__dirname, "../../../supabase/rollback/20260820100000_store_product_delete.sql"),
  "utf8"
);

/**
 * Estas asserções olham SQL, não formatação: comentários de linha saem e todo espaço
 * em branco vira um espaço único, dos dois lados da comparação. Assim reindentar ou
 * quebrar uma linha da migration não derruba o teste, e um `-- for delete` em prosa
 * não é confundido com uma policy real.
 *
 * Não há literal contendo `--` nestes dois arquivos (os UUIDs e o sufixo
 * `-excluido-` usam traço simples), então remover de `--` até o fim da linha é seguro.
 */
const sql = (source: string): string =>
  source
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const migrationSql = sql(migration);
const rollbackSql = sql(rollback);

const section = (source: string, from: string, to: string): string =>
  sql(source.slice(source.indexOf(from), source.indexOf(to)));

const deleteFunction = section(
  migration,
  "create or replace function public.delete_store_product(",
  "comment on function public.delete_store_product(uuid)"
);
const updateFunction = section(
  migration,
  "create or replace function public.update_store_training_program(",
  "comment on function public.update_store_training_program("
);
const historyFunction = section(
  migration,
  "create or replace function public.store_product_has_history(",
  "comment on function public.store_product_has_history(uuid)"
);

/** Posição de um statement no SQL normalizado; -1 quando ausente. */
const positionOf = (source: string, statement: string): number => source.indexOf(sql(statement));

describe("contrato da migration de exclusão de produtos", () => {
  it("decide hard delete pela ausência de pedido, acesso, versão e entrega", () => {
    // As quatro tabelas consultadas são exatamente as quatro FKs "on delete restrict"
    // contra store_products — nem uma a menos (deixaria passar um DELETE ilegal) nem
    // uma a mais (forçaria soft-delete sem necessidade).
    const referencedTables = [
      ...historyFunction.matchAll(/exists \(select 1 from public\.(\w+) where product_id = p_product_id\)/g),
    ].map((match) => match[1]);

    expect(referencedTables.slice().sort()).toEqual([
      "store_order_items",
      "store_program_versions",
      "training_program_access",
      "training_program_deliveries",
    ]);
    // Composição por OR: qualquer uma das quatro referências, sozinha, força soft-delete.
    expect(historyFunction.match(/\bor exists \(/g)).toHaveLength(3);
    expect(historyFunction).not.toMatch(/\band exists \(/);

    // O DELETE físico vive dentro do ramo "sem histórico" e em nenhum outro lugar.
    expect(deleteFunction).toContain(
      sql(`if not public.store_product_has_history(p_product_id) then
             delete from public.store_products where id = p_product_id;
             return product_row;
           end if;`)
    );
  });

  it("faz soft-delete quando existe histórico, sem violar as FKs on delete restrict", () => {
    expect(migrationSql).toContain(sql("alter table public.store_products add column if not exists deleted_at timestamptz;"));
    // O soft-delete marca a exclusão e libera o slug no mesmo UPDATE.
    expect(deleteFunction).toContain(
      sql(`update public.store_products
           set deleted_at = now(),
               slug = previous_row.slug || '-excluido-' || replace(p_product_id::text, '-', '')
           where id = p_product_id
           returning * into product_row;`)
    );
    // O slug original é preservado na auditoria — é o que o rollback usa para restaurar.
    expect(deleteFunction).toContain(
      sql(`insert into public.store_product_audit (product_id, actor_id, action, previous_value, new_value)
           values (p_product_id, auth.uid(), 'PRODUCT_DELETED', to_jsonb(previous_row), to_jsonb(product_row));`)
    );
    // O produto com histórico nunca é apagado: a única linha de DELETE está no ramo sem histórico.
    expect(deleteFunction.match(/delete from public\.store_products/g)).toHaveLength(1);
    // Reexclusão é idempotente, não erro.
    expect(deleteFunction).toContain(sql("if product_row.deleted_at is not null then return product_row; end if;"));
  });

  it("restringe a exclusão ao coach dono do produto e exige sessão", () => {
    expect(deleteFunction).toContain("security definer");
    expect(deleteFunction).toContain(sql("if auth.uid() is null then"));
    expect(deleteFunction).toContain(
      sql(`select * into product_row
           from public.store_products
           where id = p_product_id
             and (seller_coach_id = auth.uid() or public.is_platform_owner())
           for update;`)
    );
    expect(migrationSql).toContain(sql("grant execute on function public.delete_store_product(uuid) to authenticated;"));
    // A função de histórico é detalhe interno: nenhum cliente pode chamá-la.
    expect(migrationSql).toContain(sql("revoke all on function public.store_product_has_history(uuid) from public;"));
    expect(migrationSql).not.toContain("grant execute on function public.store_product_has_history");
  });

  it("não abre nenhuma policy de escrita em store_products", () => {
    // Verifica os comandos das policies declaradas, em vez de procurar o texto
    // "for delete" — que também casaria com um comentário em prosa.
    const policyCommands = [
      ...migrationSql.matchAll(/create policy "[^"]+" on public\.store_products for (\w+)/g),
    ].map((match) => match[1]);

    expect(policyCommands).toEqual(["select"]);
    expect(migrationSql).not.toMatch(/create policy "[^"]+" on public\.store_products for (delete|insert|update|all)/);
  });

  it("remove o conceito de arquivar do catálogo de RPCs", () => {
    expect(migrationSql).toContain(sql("drop function if exists public.archive_store_product(uuid);"));
    expect(migrationSql).not.toContain("set status = 'archived'");
  });

  it("converte explicitamente os produtos legados archived em rascunho auditado", () => {
    expect(migrationSql).toContain(
      sql(`with converted as (
             update public.store_products
             set status = 'draft'
             where status = 'archived'
             returning id, seller_coach_id, title, status
           )`)
    );
    expect(migrationSql).toContain(sql("insert into public.store_product_audit"));
    expect(migrationSql).toContain("'PRODUCT_ARCHIVED_CONVERTED_TO_DRAFT'");
  });

  it("preserva o status vigente ao editar e bloqueia apenas produto excluído", () => {
    expect(updateFunction).not.toContain("status = 'draft'");
    expect(updateFunction).not.toContain("previous_row.status = 'archived'");
    expect(updateFunction).toContain(
      sql("if previous_row.id is null or previous_row.deleted_at is not null then")
    );
  });

  it("indexa a FK de entregas e não cria índice redundante em store_products", () => {
    // store_product_has_history roda por linha em list_coach_store_products; sem este
    // índice o EXISTS de entregas cai em seq scan (as outras três FKs já são indexadas).
    expect(migrationSql).toContain(
      sql("create index if not exists training_program_deliveries_product_idx on public.training_program_deliveries(product_id);")
    );
    // Nenhum índice parcial duplicando store_products_seller_idx (mesmas colunas, mesma ordem).
    const createdIndexes = [
      ...migrationSql.matchAll(/create (?:unique )?index (?:if not exists )?(\w+) on public\.\w+/g),
    ].map((match) => match[1]);

    expect(createdIndexes).toEqual(["training_program_deliveries_product_idx"]);
    expect(migrationSql).not.toContain("store_products_not_deleted_idx");
  });

  it("estende o guarda de deleted_at às RPCs de escrita que criam estado a partir do produto", () => {
    // O soft-delete não mexe em status: localizar o produto só por status deixaria
    // um produto excluído entregável, submetível e aprovável.
    expect(migrationSql).toContain(
      sql("select * into product_row from public.store_products where id = p_product_id and status = 'published' and deleted_at is null;")
    );
    expect(migrationSql).toContain(
      sql("select * into product_row from public.store_products where id = p_product_id and seller_coach_id = auth.uid() and deleted_at is null;")
    );
    expect(migrationSql).toContain(
      sql("select * into product_row from public.store_products where id = p_product_id and status = 'review' and deleted_at is null for update;")
    );
    // Nenhum lookup sobrevive filtrando apenas por status.
    expect(migrationSql).not.toContain(sql("where id = p_product_id and status = 'published';"));
    expect(migrationSql).not.toContain(sql("where id = p_product_id and status = 'review' for update;"));

    for (const signature of [
      "public.create_training_program_delivery(uuid, uuid, uuid, date)",
      "public.submit_store_product_review(uuid)",
      "public.approve_store_product(uuid)",
    ]) {
      expect(migrationSql).toContain(sql(`revoke all on function ${signature} from public;`));
      expect(migrationSql).toContain(sql(`grant execute on function ${signature} to authenticated;`));
    }
  });

  it("esconde produto excluído da vitrine, do catálogo do coach, da moderação e da RLS", () => {
    const coachList = section(
      migration,
      "create function public.list_coach_store_products()",
      "comment on function public.list_coach_store_products()"
    );

    expect(coachList).toContain(
      sql("where (product_row.seller_coach_id = auth.uid() or public.is_platform_owner()) and product_row.deleted_at is null")
    );
    expect(coachList).toContain(sql("public.store_product_has_history(product_row.id)"));
    expect(migrationSql).toContain(sql("where product_row.status = 'published' and product_row.deleted_at is null"));
    expect(migrationSql).toContain(sql("where product_row.slug = lower(btrim(p_slug)) and product_row.deleted_at is null"));
    expect(migrationSql).toContain(sql("and product_row.status = 'review' and product_row.deleted_at is null"));
    expect(migrationSql).toContain(
      sql(`using (
             (deleted_at is null and (status = 'published' or seller_coach_id = auth.uid()))
             or public.is_platform_owner()
           );`)
    );
  });

  it("recarrega o schema cache do PostgREST no fim da migration", () => {
    expect(migration.trimEnd().endsWith("notify pgrst, 'reload schema';")).toBe(true);
  });

  it("tem rollback que desfaz coluna, funções, índice e leituras", () => {
    expect(rollbackSql).toContain(sql("drop function if exists public.delete_store_product(uuid);"));
    expect(rollbackSql).toContain(sql("drop function if exists public.store_product_has_history(uuid);"));
    expect(rollbackSql).toContain(sql("drop index if exists public.training_program_deliveries_product_idx;"));
    expect(rollbackSql).toContain(sql("alter table public.store_products drop column if exists deleted_at;"));
    expect(rollbackSql).toContain(sql("create or replace function public.archive_store_product(p_product_id uuid)"));
    // Editar volta a rebaixar o produto para rascunho.
    expect(rollbackSql).toContain(sql("status = 'draft' where id = p_product_id"));
  });

  it("tem rollback que devolve a 'archived' exatamente os produtos convertidos pela migration", () => {
    expect(rollbackSql).toContain(
      sql(`update public.store_products
           set status = 'archived'
           where status = 'draft'
             and id in (
               select product_id from public.store_product_audit
               where action = 'PRODUCT_ARCHIVED_CONVERTED_TO_DRAFT'
             );`)
    );
  });

  it("tem rollback que restaura o slug original antes de apagar a auditoria que o guarda", () => {
    // A auditoria PRODUCT_DELETED é a única cópia sobrevivente do slug pré-mutilação:
    // apagá-la antes de restaurar deixaria o produto de volta no catálogo com
    // '<slug>-excluido-<uuid>' permanente.
    expect(rollbackSql).toContain(
      sql(`update public.store_products product_row
           set slug = deletion.original_slug
           from (
             select distinct on (audit_row.product_id)
               audit_row.product_id,
               audit_row.previous_value->>'slug' as original_slug
             from public.store_product_audit audit_row
             where audit_row.action = 'PRODUCT_DELETED'
               and audit_row.previous_value->>'slug' is not null
             order by audit_row.product_id, audit_row.created_at asc
           ) deletion
           where deletion.product_id = product_row.id
             and product_row.deleted_at is not null;`)
    );

    const restoreAt = positionOf(rollbackSql, "set slug = deletion.original_slug");
    const purgeAt = positionOf(rollbackSql, "delete from public.store_product_audit where action = 'PRODUCT_DELETED';");
    const dropColumnAt = positionOf(rollbackSql, "alter table public.store_products drop column if exists deleted_at;");

    expect(restoreAt).toBeGreaterThan(-1);
    expect(purgeAt).toBeGreaterThan(-1);
    expect(restoreAt).toBeLessThan(purgeAt);
    // A restauração ainda depende de deleted_at para escolher as linhas certas.
    expect(restoreAt).toBeLessThan(dropColumnAt);
  });

  it("tem rollback que devolve as RPCs de escrita sem o guarda, antes de a coluna sumir", () => {
    const restoredDelivery = section(
      rollback,
      "create or replace function public.create_training_program_delivery(",
      "comment on function public.create_training_program_delivery(uuid, uuid, uuid, date) is null;"
    );

    expect(restoredDelivery).toContain(
      sql("select * into product_row from public.store_products where id = p_product_id and status = 'published';")
    );
    expect(restoredDelivery).not.toContain("deleted_at");

    const restoreRpcAt = positionOf(rollbackSql, "create or replace function public.create_training_program_delivery(");
    const dropColumnAt = positionOf(rollbackSql, "alter table public.store_products drop column if exists deleted_at;");

    expect(restoreRpcAt).toBeGreaterThan(-1);
    expect(restoreRpcAt).toBeLessThan(dropColumnAt);

    expect(rollbackSql).toContain(
      sql("select * into product_row from public.store_products where id = p_product_id and seller_coach_id = auth.uid();")
    );
    expect(rollbackSql).toContain(
      sql("select * into product_row from public.store_products where id = p_product_id and status = 'review' for update;")
    );
  });
});
