# Pedidos → reserva → separação → expedição

Fluxo local demonstrativo, disponível no menu **Pedidos** (`#/pedidos`). Não integra ERP, prontuário, faturamento ou transportadora. Hospital e responsável são campos informados, sem autenticação. Use exemplos fictícios e não cadastre dados de pacientes.

## Orientação na tela

- O detalhe do pedido mostra uma barra de quatro etapas (criado, reserva, conferência, expedição) com a quantidade concluída em cada uma e a etapa atual destacada.
- A lista mostra, para cada pedido aberto, reservado/solicitado e conferido/reservado.
- Cada item indica “x / y un. reservadas” e, quando falta saldo, se ainda há lote elegível na unidade.
- Com a expedição bloqueada, a seção 3 lista exatamente o que falta (reservar N un. de um produto, conferir N un. de um lote, lote que deixou de ser elegível). Com tudo pronto, o botão indica se falta a referência de transporte ou a confirmação.
- A reserva parcial gera um aviso de atenção com a quantidade que falta, e não uma mensagem de sucesso.
- O cancelamento informa quantas unidades serão liberadas e só é habilitado com o motivo preenchido.

## Criar um pedido

Informe referência única, hospital/destino, procedimento ou finalidade, data necessária, unidade de origem, responsável e produtos com quantidades inteiras positivas. A referência continua única mesmo após cancelamento. A data de um novo pedido deve ser hoje ou futura. Não duplique um produto nas linhas: agrupe sua quantidade.

A criação não altera estoque. Nesta versão um pedido tem uma única unidade de origem; para atender de outra unidade, faça a transferência e o recebimento previamente, ou crie um pedido separado. Dados principais não são editados após criar: cancele com motivo e registre nova referência para corrigir.

## Reservar lotes

**Reservar por validade** prioriza o menor vencimento elegível na unidade. O lote precisa estar válido hoje e na data necessária. Apenas saldo disponível é utilizado; reservado, bloqueado e quarentena não são reaproveitados. Também é possível escolher lote e localização manualmente.

Se a demanda exceder o disponível, o sistema reserva o possível e apresenta o que falta. Repetir a reserva automática apenas tenta completar a quantidade pendente. Ela não duplica reservas existentes.

O campo Reservado em Estoque representa o total interno + pedidos. Uma reserva interna antiga não é convertida automaticamente em reserva de pedido. A tela de situações informa a divisão e impede reduzir o total abaixo do comprometido com pedidos. Para trocar um lote, libere a reserva no pedido com motivo e reserve novamente; sua conferência é descartada.

## Separar e conferir

Selecione uma posição reservada, informe o código interno do produto, o lote e a quantidade conferida nessa leitura. Código de produto e lote são verificados separadamente: um código de produto genérico não prova o lote. Enter no campo de produto avança para lote; Enter no lote avança para quantidade.

O leitor USB/Bluetooth deve funcionar como teclado. A câmera preenche o código do produto usando a infraestrutura existente; precisa de permissão e contexto seguro. Não há decodificação de campos GS1/UDI ou integração proprietária validada. Câmera e bipador físico ainda devem ser testados nos equipamentos reais.

Cada conferência acrescenta quantidade até o limite reservado. Reiniciar conferência zera a contagem do lote sem alterar o estoque. Acrescentar reserva ao mesmo lote já conferido exige reconferência. O pedido só fica pronto com todos os itens integralmente reservados, conferidos e válidos.

## Expedir

Informe a referência de expedição/transporte e confirme volumes e hospital. O sistema revalida os lotes e aplica a expedição completa: reduz físico e reserva vinculada, registra uma saída por lote com pedido e referência de transporte e encerra o pedido.

Essa operação não usa a função genérica de Saída, pois aquela só pode consumir saldo disponível. A expedição consome exclusivamente as reservas do próprio pedido, preservando reservas internas e de outros pedidos. Pedido encerrado não permite uma segunda baixa ou cancelamento.

Expedido significa saída do estoque. Não significa entregue, consumido ou faturado. Não há expedição parcial, consignação nem retorno automatizado nesta versão.

## Cancelamento e estados

Pedido aberto pode ser cancelado com justificativa. Todas as suas reservas são liberadas sem mudar o físico e sem afetar outros pedidos. O pedido e o registro local do motivo permanecem disponíveis no filtro Encerrados.

| Estado | Condição |
| --- | --- |
| Pendente | Nenhum lote reservado |
| Reserva parcial | Há reserva, mas falta quantidade solicitada |
| Em separação | Reserva completa; conferência ainda incompleta |
| Revisar reserva | Uma reserva deixou de ser elegível, por exemplo por vencimento |
| Pronto para expedir | Reserva e conferência completas, lotes válidos |
| Expedido | Saída concluída, referência e horário registrados |
| Cancelado | Reservas liberadas e motivo registrado |

## Integridade e validação

A base local foi migrada para versão 3, preservando saldos, reservas internas, contagens e movimentações anteriores. Nenhum pedido é criado automaticamente na migração. Reservar, liberar e expedir incrementam a revisão da posição, invalidando contagens físicas anteriores. Ajustes de inventário não podem reduzir o físico abaixo do comprometido.

Foram testados conflitos de reserva, seleção por validade, lotes de outra unidade, conferência errada, baixa repetida, cancelamento, integração com contagens e indicadores. O fluxo foi exercitado pela interface em desktop e mobile com dados de demonstração. A proteção é local; uso multiusuário exige transações no servidor, autenticação, permissões e controles de concorrência. Duas abas ou dispositivos não têm coordenação de escrita.
