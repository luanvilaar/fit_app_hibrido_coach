# Snapshot pré-migration 20260820130000

Antes da aplicação, exporte os vínculos que serão removidos para recuperação auditável:

```sql
select tm.*
from public.team_members tm
join auth.users u on u.id = tm.user_id
where lower(u.email) = 'l.vilaar@gmail.com' and tm.role = 'athlete';
```

Também valide que `platform_owners` contém a conta e que há pelo menos um vínculo `coach`, conforme o ambiente de produção.
