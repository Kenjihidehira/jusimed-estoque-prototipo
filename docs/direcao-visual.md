# Direção visual e verificação

## Referência atual

O layout nasceu do tema empresarial do projeto local **Patrimônio Ops Control** (`app/demo/enterprise.css` e `components/patrimonio/DashboardView.tsx`) e foi consolidado em uma base própria, sem incorporar marcas ou imagens corporativas do Patrimônio Ops. As cores são aproximadas do logotipo público da Jusimed e **não substituem um manual oficial de marca**.

## Organização do CSS

| Arquivo | Conteúdo |
| --- | --- |
| `src/styles.css` | Tokens (cores, estados, raio, altura de controle, foco), base, cabeçalho e menu, página, botões, campos, painéis, tabelas, situações, mensagens, modal, Operação e Leitura de código |
| `src/analytics.css` | Dashboard |
| `src/modules.css` | Cadastro/importação, inventário, situações e transferências |
| `src/orders.css` | Pedidos, etapas, reservas, conferência e expedição |

As antigas camadas `patrimonio-theme.css` e `jusimed-theme.css`, que sobrescreviam `styles.css` em sequência, foram incorporadas aos tokens. Uma única família tipográfica (Inter) e uma pilha monoespaçada do sistema substituem as três fontes externas anteriores.

| Elemento | Aplicação no protótipo |
| --- | --- |
| Paleta | Azul `#293a78` para ação e marca; vermelho `#c73543` somente em detalhes de marca (faixa superior, seção ativa) e bloqueio; superfícies claras `#f5f6f9` / `#fff` |
| Estados | Verde = regular/concluído, âmbar = atenção (validade, reserva parcial, divergência), vermelho = bloqueio/erro, azul = informativo. Sempre com texto, não só cor |
| Tipografia | Corpo de 14 px, rótulos de 12–13 px, nenhum texto abaixo de 12 px; cinzas de apoio com contraste ≥ 4,5:1 |
| Controles | Altura de 40 px no desktop e 44 px no celular; foco visível com anel azul |
| Tabelas | Físico e Disponível em colunas próprias, comprometido detalhado (pedido, interna, bloqueio, quarentena); no celular viram cartões compactos sem rolagem horizontal |

## Conferência visual

1. **Navegação:** cabeçalho fixo com logotipo, identificação de protótipo e menu horizontal. Cada área tem endereço próprio (`#/estoque`, `#/pedidos`…), então voltar/avançar do navegador funciona. Até 1200 px o menu vira um painel com alvos de 44 px, fechamento por seleção, toque fora ou Esc e retorno do foco ao botão. Até 360 px as opções ficam em uma coluna.
2. **Dashboard:** faixa de contexto discreta, seis KPIs clicáveis, composição do saldo físico (disponível, reserva de pedidos, reserva interna, bloqueio, quarentena e vencido) e pendências de pedidos com a próxima ação. No celular, as análises complementares ficam atrás de um botão.
3. **Estoque e ficha do lote:** lista com painel de detalhe (modelo *split view* / lista-detalhe). A partir de 1280 px a ficha fica ao lado da tabela, fixa e com rolagem própria; abaixo disso ocupa a tela, com "Voltar à lista". A ficha segue o modelo de página de objeto: cabeçalho com identificação e situação, fatos do lote, saldo e seções de pedidos, movimentações, contagens e alterações.
4. **Pedidos:** barra de quatro etapas, motivos específicos para a expedição bloqueada, progresso na lista e aviso de reserva parcial.
5. **Importação:** etapas explícitas (arquivo → validação → confirmação), validade visível na prévia, linhas com erro destacadas e filtro “só linhas com erro”.
6. **Inventário:** sem saldo esperado antes do registro; depois, situação da contagem e efeito do ajuste antes de aplicar.
7. **Responsividade:** verificada em 1440, 1280, 1220, 1150, 1100, 390 e 320 px, sem rolagem horizontal da página.

## Limites da referência

O Patrimônio Ops trabalha com ativos, custódia, núcleos e manutenção. Esta proposta trabalha com produtos, lotes, validade e locais. Os indicadores foram adaptados ao domínio médico; resultados, datas e movimentações continuam fictícios.
