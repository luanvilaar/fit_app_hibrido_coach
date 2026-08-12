# Snapshot: antes de `20260811100000_prescription_block_catalog`

## Escopo

Registrar a extensão do catálogo de blocos de prescrição para `metcon` e
`gymnastics-conditioning`. A migration mantém as categorias legadas e atualiza
`block_kind_allows_empty_items` para que os blocos de texto livre possam receber
movimentos opcionais do catálogo.

## Rollback

O rollback correspondente restaura o constraint anterior e a lista anterior de
categorias que aceitam blocos sem exercícios.
