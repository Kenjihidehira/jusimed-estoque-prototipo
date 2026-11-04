# Patrimônio Ops como referência deste protótipo

O projeto de referência é o **Patrimônio Ops Control**, na pasta irmã `work/patrimonio-ops-control`. Esta adaptação permanece em `work/nexo-estoque-prototipo`; o código, banco e publicação do Patrimônio Ops não foram alterados.

## Padrões aplicados

| Patrimônio Ops | Adaptação para estoque médico |
| --- | --- |
| Navegação e cabeçalho de gestão | Menu superior com dashboard, operação, inventário por lote, leitura, movimentações e alertas |
| Paleta empresarial azul, superfícies claras e divisórias discretas | Consolidada nos tokens de `src/styles.css` (ver [direção visual](direcao-visual.md)) |
| Contexto do ambiente e origem dos indicadores | Faixa “Cenário da proposta”, com aviso de dados fictícios |
| Indicadores executivos clicáveis | Seis indicadores que abrem inventário, alertas ou histórico |
| “Atenção da gestão” com pendências objetivas | Lotes a vencer, vencidos e produtos abaixo do mínimo |
| Tendência de movimentações e cobertura dos controles | Contagem mensal de eventos e preenchimento de lote, validade e localização |
| Consulta por câmera e leitor em modo teclado | Câmera demonstrativa e campo focado para bipador USB/Bluetooth com Enter |

## Regras de adaptação

- O Patrimônio Ops controla **bens patrimoniais** por ativo, responsável, núcleo e situação. Este protótipo controla **posições de estoque** por produto, lote, validade e local.
- Custódia, depreciação, manutenção, número patrimonial e baixa de ativo não foram copiados como indicadores de estoque médico.
- Nenhuma marca ou imagem corporativa de Gazin ou Dados CX foi incorporada. O logotipo público da Jusimed foi incluído apenas para apresentar este conceito independente e não oficial.
- O Patrimônio Ops possui autenticação, autorização, auditoria e dados em servidor. **Essas capacidades de produção não existem neste protótipo**. A proposta Jusimed agora demonstra importação XLSX/CSV validada e histórico local, mas o navegador ainda guarda somente dados fictícios, sem autoria autenticada ou auditoria imutável.
- As fórmulas do dashboard médico estão em [analytics.md](analytics.md). Métricas financeiras e de giro continuam indisponíveis até haver custos e histórico confiável.

## Para evoluir além do protótipo

Reaproveitar princípios de arquitetura do Patrimônio Ops — validação no servidor, separação de fontes de dados, importação em duas etapas, permissões independentes e auditoria — depois de mapear a planilha, etiquetas e regras reais da empresa. Copiar diretamente entidades patrimoniais para o estoque médico geraria regras incorretas.
