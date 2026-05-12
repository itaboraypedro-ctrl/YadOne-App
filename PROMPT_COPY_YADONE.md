# PROMPT — Substituição de Copy Yadone

Cole isso no Claude Code em **plan mode**.

---

## REGRA ABSOLUTA

**Você vai trocar APENAS texto.** Nenhuma outra alteração é permitida.

Proibido:
- Mudar classes CSS ou Tailwind
- Mudar estrutura de tags HTML/JSX
- Mudar ordem de seções
- Mudar imagens ou caminhos de imagem
- Mudar links ou hrefs
- Mudar animações ou efeitos
- Adicionar ou remover componentes
- Mudar espaçamentos, cores, fontes
- Mudar qualquer coisa que não seja o conteúdo textual visível

Se encontrar uma frase e a frase nova estiver no COPY_YADONE_SITE.md, troca. Se não tiver instrução sobre aquele texto, **não toca**.

---

## Objetivo

Substituir a copy do site Yadone com base no arquivo `COPY_YADONE_SITE.md`.

---

## Como executar

### Passo 1 — Leia os arquivos
Leia na seguinte ordem:
1. `COPY_YADONE_SITE.md` — a copy nova completa
2. Todos os arquivos `.tsx` e `.jsx` da pasta `src/` ou `app/` que contêm texto visível do site

### Passo 2 — Mapeie antes de alterar
Para cada seção do `COPY_YADONE_SITE.md`, identifique:
- Qual arquivo contém o texto atual
- Qual linha aproximada
- Qual é o texto atual vs o texto novo

Monte uma tabela de mapeamento e me mostre **antes de alterar qualquer arquivo**.

Formato da tabela:
```
Arquivo | Texto atual | Texto novo
--------|-------------|----------
Hero h1 | "Atenda cada cliente como se fosse o único." | "Cuide do seu paciente como a rede grande nunca vai conseguir."
...
```

### Passo 3 — Aguarde aprovação
Só avance após confirmação.

### Passo 4 — Execute as substituições
Faça as trocas arquivo por arquivo. Para cada arquivo modificado:
- Mostre apenas as linhas alteradas (antes e depois)
- Confirme que nenhuma classe, tag ou estrutura foi modificada

### Passo 5 — Verificação final
Após todas as trocas:
- Rode `npx tsc --noEmit` — deve passar sem erros
- Liste todos os arquivos que foram modificados
- Confirme que a estrutura HTML/JSX está idêntica à original

---

## Substituições críticas (atenção especial)

### Meta tags (geralmente em layout.tsx ou head)
- title: `Yadone — Cuide do seu paciente como a rede grande nunca vai conseguir`
- meta-description: `Acompanhamos cada paciente da sua farmácia depois da compra. Lembramos do tratamento, avisamos quando o remédio acaba e trazemos o cliente de volta. Não com a rede.`

### Navbar
- Item "Preços" → trocar para "Resultados"
- Botão: manter "Agendar demo" → trocar para "Comece hoje mesmo"

### Hero
- h1: `Cuide do seu paciente como a rede grande nunca vai conseguir.`
- Subtítulo (parágrafo abaixo do h1): `Acompanhamos cada paciente da sua farmácia depois da compra. Lembramos do tratamento, avisamos quando o remédio está acabando e o trazemos de volta para comprar com você — não com a rede.`
- Adicionar linha de apoio abaixo do CTA: `Tudo pelo WhatsApp. Sem app novo pra ninguém baixar.`
- Botão CTA: `Comece hoje mesmo →`

### Tabela comparativa
A tabela atual (Bot Genérico vs Yadone) será **substituída** por nova tabela (Sem Yadone vs Com Yadone).
Atenção: trocar apenas o conteúdo das células. Manter a estrutura HTML da tabela intacta (tags table/thead/tbody/tr/td).

Nova tabela — 7 linhas:
| Sem Yadone | Com Yadone |
|---|---|
| O paciente comprou. Saiu. Não voltou. Você nem sabe que ele sumiu. | Você sabe exatamente quem comprou, o que comprou e quando o tratamento vai acabar. |
| O remédio acabou em casa. Ele esqueceu. Foi onde apareceu primeiro. | 3 dias antes do tratamento acabar, ele recebe um áudio com a voz da sua farmácia. |
| Cliente fiel virou cliente perdido. Em silêncio. | Cliente fiel vira receita previsível. Todo mês. |
| Você lembra dos 10 clientes que mais aparecem. Os outros 2.000? Não. | Você lembra de cada um. Nome, tratamento, última compra, o que falou da família. |
| A farmácia fecha às 22h. As dúvidas dos pacientes não. | Às 23h, 4h, domingo de manhã. Sempre tem alguém respondendo com a sua voz. |
| Você acha que o cliente voltou. Não tem certeza. | Você vê no painel: quem voltou, quem está em risco, quanto voltou pro caixa. |
| Você compete por atenção com quem tem 800 farmacêuticos e bilhões em marketing. | Você ganha por proximidade — porque a sua farmácia lembrou primeiro. |

Linha abaixo da tabela (manter tag existente, trocar texto):
`Bot responde. Yadone cuida.`

### Seção de Big Numbers
Trocar os 3 números e seus textos por:

**Número 1:**
- Valor: `30%`
- Texto: `dos brasileiros com doença crônica abandonam o tratamento contínuo`
- Fonte (linha pequena abaixo): `Fonte: Revista Saúde Pública 2016 / Ministério da Saúde`

**Número 2:**
- Valor: `60%`
- Texto: `dos pacientes acima de 40 anos com doença crônica não aderem corretamente ao tratamento`
- Fonte: `Fonte: Estudo do Sul do Brasil — Remondi, Cabrera & Souza`

**Número 3:**
- Valor: `5 a 7×`
- Texto: `mais caro conquistar um cliente novo do que manter um atual`
- Fonte: `Fonte: Princípio universal de retenção (Philip Kotler)`

Atenção: se não houver tag de "fonte" na estrutura atual, **não adicione**. Coloque o texto de fonte junto ao parágrafo já existente, em tamanho menor se houver classe pra isso, ou simplesmente como texto após o parágrafo.

### Seção de Recursos — título
- Atual: `Cada recurso existe para uma razão: você vender mais.`
- Novo: `Cada recurso existe para uma razão: o paciente voltar.`

### Seção de Dados — título
- Atual: `Decida com dados. Não com achismo.`
- Novo: `Os números são consequência. O cuidado é a causa.`

### Seção CTA Final — texto removido
Localizar e remover apenas o texto (não a tag):
- `Sem contrato. Sem fidelidade. 30 minutos.`
- `Projeto piloto · Vagas limitadas`

Substituir por:
- `Atendemos farmácias em todo o Brasil. Cadastro rápido. Nosso time entra em contato em até 24h.`

Botão CTA final:
- Atual: `Agendar demonstração gratuita→`
- Novo: `Comece hoje mesmo →`

---

## O que NÃO está no COPY_YADONE_SITE.md e portanto NÃO deve ser tocado

- Textos internos dos mockups de conversa do WhatsApp (as bolhas de mensagem)
- Textos dos cards do dashboard (taxa de retenção, churn, etc.)
- Footer (exceto se tiver "Agendar demo" — trocar por "Comece hoje mesmo")
- Qualquer texto de termos, privacidade, exclusão de dados

---

## Antes de implementar

1. Leia o COPY_YADONE_SITE.md completo
2. Mapeie todos os arquivos que precisam ser alterados
3. Monte a tabela de mapeamento
4. Pergunte se pode prosseguir
