# Roots of Renewal

Protótipo jogável de estratégia territorial 2D feito com TypeScript, Vite e Canvas 2D, sem assets externos.

## Executar

```bash
npm install
npm run dev
```

Para gerar a versão de produção: `npm run build`.

## Controles

- Posicionamento: escolha uma carta e clique/toque na zona verde; arraste tropas para reposicioná-las.
- Câmera: botão direito ou `Espaço` + arrastar; no celular, arraste uma área vazia. Use scroll ou pinça para zoom.
- Combate: clique/toque em tropas para selecionar e no terreno/inimigo para ordenar. Arraste com o mouse para seleção em grupo.
- Ordens: `Q` avançar, `W` atacar, `E` defender, `R` manter, `T` retornar e `F` centralizar na batalha.
- Reforços: escolha uma carta e marque qualquer terreno aliado seguro. A área disponível cresce com a conquista; inimigos próximos impedem a entrada.
- Construções: escolha uma carta e marque terreno aliado livre, respeitando distância de estruturas e tropas.
- Minimap: clique, toque ou arraste para navegar.
- Zoom: use scroll, pinça, os botões `−`/`+` no minimapa ou as teclas `-`/`+`.

## Arte

Pixel art original definida em `src/game/pixelArt.ts`: silhuetas por classe, paletas por facção e texturas procedurais em cache. Os retratos das cartas usam os mesmos sprites do campo. Não há downloads de imagens.

As frentes começam separadas por quatro linhas neutras. Renda inicial aproximada: 3,5 moedas/s. O limite técnico de segurança é de 240 unidades por facção; desempenho nesse limite ainda precisa de medição em aparelhos reais.
