# Brief Claude Code — Collecte des endpoints par canton

## Contexte
Rhiza a un catalogue de 110 sources de données géospatiales et statistiques suisses (D3.2 SWICE).
Les URLs sont documentées pour Fribourg. Il faut trouver les endpoints équivalents pour les autres cantons.

## Fichier d'entrée
`rhiza-sources-seed.json` — 110 sources avec métadonnées, disponibilité par protocole (WMS/WFS/DL) par niveau (Confédération/Canton/Commune), et matrice de disponibilité par canton.

## Travail demandé

### Priorité 1 — Endpoints WFS cantonaux
Pour les sources ayant `availability.canton.wfs = true`, trouver les endpoints WFS des portails cantonaux.

Portails cantonaux connus :
- FR : geo.fr.ch (déjà documenté)
- VD : geodonnees.vd.ch / geo.vd.ch
- GE : ge.ch/sitg / geoportal.ch/ge
- BE : geoportal.apps.be.ch
- VS : geodata.vs.ch
- NE : sitn.ne.ch
- JU : geo.jura.ch
- Fédéral : geodienste.ch (fédéré, certaines sources multi-cantons)

Pattern type pour geo.fr.ch :
```
https://geo.fr.ch/ags/services/OpenData/{NomCouche}/MapServer/WFSServer
```

### Priorité 2 — 7 sources publiques sans URL
- S028 : Itinéraire cyclable recommandé → chercher geodienste.ch ou geo.fr.ch
- S049 : Canton of Fribourg → chercher fr.ch portail données
- S050 : City of Fribourg → chercher ville-fribourg.ch
- S053 : CFC → chercher source ouverte
- S068 : empa → chercher empa.ch données ouvertes
- S087 : Ville de Fribourg zones 30 → chercher geo.fr.ch ou ville-fribourg.ch
- S103 : OFEV/Canton FR STEP → chercher portail cantonal

### Priorité 3 — URLs de téléchargement fédérales
Pour les sources avec `availability.confederation.dl = true` mais sans URL, vérifier :
- opendata.swiss
- data.geo.admin.ch
- bfs.admin.ch (OFS)

## Format de sortie attendu
Enrichir le JSON avec un champ `urls` par source :
```json
{
  "id": "S026",
  "urls": {
    "FR": { "wfs": "https://...", "wms": "https://..." },
    "VD": { "wfs": "https://...", "wms": "https://..." },
    "federation": { "dl": "https://..." }
  }
}
```

## Règles
- Ne pas inventer d'URLs — vérifier que chaque endpoint répond
- Documenter les sources introuvables avec `"status": "not_found"`
- Prioriser VD (prochain terrain Rhiza après FR)
