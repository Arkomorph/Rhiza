---
paths:
  - "*.cypher"
---
# Regles Cypher

- Labels en PascalCase : (:Territoire), (:Acteur), (:Flux), (:Decision)
- Relations en SCREAMING_SNAKE_CASE : [:POSSEDE], [:DECIDE_SUR], [:HABITE_UTILISE]
- 3 attributs obligatoires sur TOUTE relation : confidence, source, date
- confidence : 'high' | 'medium' | 'low' | 'inferred'
- Commentaires en francais
- Un fichier par cas d'usage, nomme kebab-case
- Contraintes d'unicite sur le champ nom de chaque label
- Pas d'accents dans les noms de labels (Decision, pas Décision)
