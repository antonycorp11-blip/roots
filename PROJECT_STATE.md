# Bunker Loop — estado do projeto

## Arquitetura

- Vite + TypeScript + Canvas 2D, sem imagens ou runtime externo. `model.ts` define dados/seed; `simulation.ts` executa tarefas, caminho, estrutura e sistemas; `art.ts` reúne a arte procedural; `render.ts` compõe o mundo; `main.ts` controla entrada, HUD, loop e save.
- Simulação em passo fixo de 1/30 s; renderização por `requestAnimationFrame`. Mapa 64×32 com células de 44 px; apenas região visível é desenhada. Save versionado em `localStorage`.

## Implementado

- Mundo lateral procedural determinístico; câmera, minimapa, zoom, toque, pinça, orientação horizontal no celular.
- Trabalhador animado com deslocamento por BFS, fila cancelável, escavação, construção, reparo e custos reservados.
- Parede, viga, porta, gerador, ventilador, reservatório e despensa; dano de explosão, risco estrutural simplificado, oxigênio, combustível, comida e água básicos.
- Preparação de sete dias, explosão, sobrevivência inicial, morte, reinício temporal e save/continue local. Testes de seed, tarefas, materiais, caminhos, dano e ventilação.
- Arte revista: ruínas e entrada na superfície, solo em camadas sem blocos chapados de rocha, corte de salas com vigas/lâmpadas/tubos, máquinas detalhadas e personagem articulado com caminhada, escavação, piscar e descanso. Solo estático em cache por célula.

## Pendente

- Redes espaciais reais de energia, água e ar; compartimentos vedados, múltiplos personagens, relações sociais, eventos dinâmicos e árvore de conhecimento detalhada.
- Construção de cabos/tubulações, colapso progressivo, plantas salvas, UI de histórico e balanceamento de campanha.
- QA visual/interativo em navegadores desktop e mobile reais.

## Decisões / próximos passos

- As máquinas atuais afetam recursos globalmente; o próximo avanço deve ser conectividade por compartimentos e redes, não mais cards cosméticos.
- Conhecimentos estão registrados no save, mas ainda não desbloqueiam projetos.
- Executar: `npm install`, `npm run dev`. Verificar: `npm test`, `npm run build`.
