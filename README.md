# Sistema Financeiro Belleza

## Publicar no GitHub Pages

Esta versão estática usa os arquivos `index.html`, `style.css` e `script.js` na raiz do repositório. Para publicá-la:

1. Envie os arquivos estáticos e o `.gitignore` ao seu repositório. Não envie `financeiro.db`.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Escolha a branch principal e a pasta **/(root)** e salve.
5. Acesse o endereço informado pelo GitHub Pages, normalmente `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

## Onde os dados são guardados

No GitHub Pages, os lançamentos são calculados e armazenados no `localStorage` do navegador. Eles continuam disponíveis no mesmo navegador e dispositivo depois que a página é fechada, mas não são sincronizados entre usuários, navegadores ou dispositivos. Limpar os dados do navegador também pode apagá-los.

O banco `financeiro.db` e a aplicação Flask continuam separados e não são acessados pela versão do GitHub Pages. Os registros existentes no SQLite não são copiados automaticamente para esta versão.

O arquivo `.gitignore` evita adicionar o banco SQLite por engano com o Git. Não envie nem publique `financeiro.db`: ele pode conter dados financeiros privados. Se já tiver sido enviado ao GitHub, remova-o também do repositório antes de ativar o Pages.

Para executar o backend Flask localmente, mantenha `app.py`, `templates/` e `static/`, instale as dependências e inicie o servidor:

```bash
python -m pip install -r requirements.txt
python app.py
```

Depois, acesse `http://127.0.0.1:5000`. O GitHub Pages não executa Flask nem conecta essa versão ao SQLite; para compartilhar os mesmos dados entre dispositivos, o backend precisa ser hospedado separadamente.
