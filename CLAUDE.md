# Convenções do Projeto Yadone Motor

## Tracking de tempo (OBRIGATÓRIO em toda tarefa)

Para CADA tarefa concluída no STATUS.md, registrar:

- **Iniciada em:** timestamp ao começar a tarefa (formato `YYYY-MM-DD HH:MM` UTC-3 Brasília)
- **Concluída em:** timestamp ao terminar e validar tsc
- **Duração:** cálculo simples (ex: `8min`, `23min`, `1h12min`)

Para subagents paralelos:
- Cada subagent registra seu próprio start/end na sua tarefa
- Adicionar também "Tempo wall-clock do bloco" (do início do primeiro subagent até o fim do último)

No footer do STATUS.md, manter contador acumulado:
> *Tempo total de implementação: Xh Ymin acumulados em N sessões.*

Atualizar esse contador a cada bloco concluído.

## Outras convenções

- npx tsc --noEmit deve passar exit 0 após cada tarefa
- STATUS.md é a única fonte de verdade do progresso
- Decisões técnicas que divergem do spec devem ser documentadas no bloco da tarefa correspondente
- Subagents paralelos usam prefixo "EXECUTE IMEDIATAMENTE / NÃO use EnterPlanMode"
- Quando subagent trava em plan mode, orquestrador executa direto (padrão dos blocos 4-8)

## Arquivos de referência
- STATUS.md — estado atual, tarefas pendentes, decisões globais (ler em toda sessão)
- HISTORY.md — histórico detalhado por tarefa (consultar apenas quando necessário)
