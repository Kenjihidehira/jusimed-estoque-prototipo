# Cadastro, situações e inventário físico

Esta versão implementa os três módulos priorizados para apresentação. Dados continuam locais e fictícios. A planilha real da empresa ainda não foi recebida; o modelo abaixo é uma proposta de entrada, não uma integração validada com o processo atual.

## Onde encontrar

| Menu | Fluxo |
| --- | --- |
| Cadastro → Produtos | Criar e editar produto, código, especialidade, mínimo global, fabricante e fornecedor |
| Cadastro → Novo lote | Criar uma posição por produto, lote, local e validade, com saldo inicial |
| Cadastro → Importar planilha | Três etapas indicadas na tela: escolher .xlsx/.csv, validar (prévia com validade, linhas com erro destacadas e filtro “só linhas com erro”) e confirmar somente se todas as linhas forem válidas |
| Estoque | Buscar e filtrar por situação; ver físico, disponível e comprometido (reserva de pedido, reserva interna, bloqueio, quarentena); confirmar transferências e consultar o histórico geral |
| Estoque → ficha do lote | Selecionar uma posição abre a ficha ao lado da lista (a partir de 1280 px) ou em tela cheia: lote, validade, local, campo de UDI (ainda não registrado), composição do saldo, situações com motivo, pedidos vinculados, movimentações, contagens e alterações daquela posição |
| Inventário físico | Localizar etiqueta, contar sem ver o esperado, justificar diferenças e revisar o efeito do ajuste antes de aplicar |
| Dashboard | Acompanhar disponível e a composição do saldo físico, trânsito, divergências e pendências de pedidos com a próxima ação |

Cada área tem endereço próprio no navegador (por exemplo `#/estoque`), o que permite voltar e avançar e abrir uma área diretamente. A ficha de uma posição também tem endereço (`#/estoque/<id>`): Alertas, Operação, Leitura de código, as prioridades do Dashboard e o registro de alterações levam direto a ela, e a partir da ficha é possível abrir o pedido vinculado. Esc ou "Voltar à lista" fecham a ficha.

A ficha é uma visão de consulta e rastreabilidade da posição. Ela reúne o que o protótipo já registra; não substitui uma consulta de recall com dados de pacientes, que esta versão não guarda.

## Modelo de importação

Baixe o CSV na interface. Também é possível colar CSV para validar ou importar uma aba de um arquivo Excel. O processamento ocorre no navegador, sem envio a servidor.

| Coluna | Regra |
| --- | --- |
| codigo | Código interno do produto; texto no Excel para preservar zeros à esquerda |
| produto | Nome obrigatório |
| especialidade | Categoria obrigatória |
| minimo | Inteiro não negativo; mínimo global por produto |
| fabricante | Opcional |
| fornecedor | Opcional |
| lote | Obrigatório; texto no Excel |
| local | Obrigatório; convenção sugerida: `Curitiba · A3-01-01` |
| validade | Data real de Excel ou texto `AAAA-MM-DD` / `DD/MM/AAAA` |
| quantidade | Inteiro não negativo, em unidades |

Limites: 5 MB por arquivo e 2.000 linhas de dados por aba. A prévia mostra até 100 linhas, mas valida todas. CSV deve estar em UTF-8 e pode usar vírgula ou ponto e vírgula. Não há conversão entre caixa e unidade, nem interpretação de macros ou fórmulas de negócio da planilha.

A importação é aditiva: cadastra produtos e posições novos. Quando o código já existe, os dados de cadastro precisam ser consistentes. Posições já existentes geram erro, inclusive ao importar o mesmo arquivo outra vez. Para acrescentar saldo a uma posição existente, use Entrada. Nenhuma linha é aplicada enquanto houver erro; a confirmação revalida a base atual.

## Disponibilidade e transferências

Uma posição com 10 unidades, 2 reservadas, 1 bloqueada e 1 em quarentena tem 6 disponíveis. Essas três quantidades são partes distintas do físico. Lotes vencidos têm disponibilidade zero, independentemente das situações.

Alterações de situação registram motivo. Há reservas internas quantitativas e reservas vinculadas a pedidos de hospitais. O total reservado inclui ambas; reservas vinculadas só podem ser liberadas em Pedidos. Veja o [fluxo de pedidos](pedidos-expedicao.md). Transferir uma unidade reduz o físico na origem e acrescenta uma unidade em trânsito. Ao confirmar recebimento, ela sai do trânsito e entra em quarentena no destino. A conferência e liberação são ações separadas.

## Inventário físico

1. Localize por código interno ou lote, digitando ou usando leitor em modo teclado com Enter. A câmera usa o mesmo fluxo quando o navegador e o aparelho permitem.
2. Confira produto, lote e localização. Códigos com várias posições exigem escolha explícita.
3. Conte todo o físico, incluindo reservado, bloqueado e quarentena. O formulário não exibe o esperado antes de registrar.
4. Informe justificativa se houver diferença. O registro fica pendente e não altera o estoque.
5. Na conferência aparecem esperado, contado, diferença e a situação (Divergente, Sem divergência ou Desatualizada), além do efeito do ajuste (“o físico passa de X para Y”). **Aplicar ajuste** (ou **Confirmar contagem**, quando não há diferença) é a revisão simulada: ajusta o físico e registra o movimento de ajuste; rejeitar preserva o saldo. O botão fica desabilitado, com o motivo, quando o saldo mudou após a contagem ou a contagem é menor que o comprometido.

Uma mudança posterior no saldo ou nas situações invalida a aplicação da contagem. Nesse caso, rejeite e conte novamente. Uma contagem menor que o total comprometido também exige revisão das situações antes de nova contagem.

## Persistência e limites

Os dados anteriores são migrados sem mudar suas quantidades; reservas, bloqueios e quarentena ausentes começam em zero. Novas demonstrações já incluem situações de exemplo. O histórico local registra alterações, mas não é imutável nem tem autoria autenticada. O protótipo não coordena concorrência entre abas, usuários ou dispositivos. A contagem cega é uma conveniência de tela, não um controle de acesso: o usuário ainda pode consultar o saldo em Estoque.

Antes de operar dados reais, são necessários banco compartilhado, autenticação, permissões, transações no servidor, revisão por pessoa autorizada, backups e validação com a planilha e as etiquetas reais. Câmera e bipador físico ainda precisam ser testados no ambiente da empresa.
