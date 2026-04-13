# YouLatin

Interfaccia web minimale per fare scraping su:

- Dizionario Latino Olivetti (ricerca normale / a tutto testo / forme flesse)
- NihilScio (latino→italiano e italiano→latino)

## Avvio

```bash
npm install
npm start
```

Poi apri `http://localhost:3000`.

## API

- `GET /api/olivetti?word=videbunt&mode=normal|ft|ff`
- `GET /api/olivetti/declension?lemma=VIDEO100`
- `GET /api/nihilscio?word=videbunt&lang=IT_|LA_`

## Deploy su Vercel

Gli endpoint API sono anche esposti come funzioni serverless in `api/`, quindi su Vercel funzionano direttamente:

- `/api/olivetti`
- `/api/olivetti/declension`
- `/api/nihilscio`
