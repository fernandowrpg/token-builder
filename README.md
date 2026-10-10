# Token Builder

Criador de tokens para VTTs (Roll20, Foundry VTT) que roda inteiro no navegador.

- Camadas de imagem com escala, proporção, rotação, espelhamento e modos de mesclagem
- Transposição: partes da imagem passam por cima da moldura (linha de corte ou pincel)
- Matiz, saturação, brilho, contraste e colorização por camada e por moldura
- Galeria com 144 molduras geradas por código (temas de fantasia × formatos) e cadastro de molduras próprias
- Exportação em PNG ou WebP com transparência, de 140 a 2048 px
- Projeto e molduras salvos localmente no navegador; funciona offline como PWA

## Desenvolvimento

```bash
npm install
npm run dev
```

`npm run build` gera a pasta `docs/`, publicada pelo GitHub Pages (Settings → Pages → branch `main`, pasta `/docs`). Rode o build e faça commit de `docs/` a cada versão.
