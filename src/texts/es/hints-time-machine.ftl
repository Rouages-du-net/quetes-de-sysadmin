### Pistas graduales de La Máquina del Tiempo (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el
### comando exacto) y .solution (casi la respuesta). Los nombres de lugares,
### como en names.ftl.

## Capítulo 1 — La Máquina del Tiempo

hint-manuscript-history =
    .lead = La carpeta novela la sigue git. Antes de reparar nada, mira su historial: la lista de sus commits (ayuda_git.txt, man git).
    .solution = cd novela y luego git log (o git log --oneline: un commit por línea).
hint-manuscript-restored =
    .lead = El penúltimo commit es de antes de que pasara el gato. git puede dejar un archivo como estaba en un commit dado (HEAD~1: el commit anterior al último).
    .solution = En novela: git restore --source=HEAD~1 novela.txt (git diff HEAD~1 novela.txt muestra antes el destrozo).
hint-manuscript-saved =
    .lead = Solo está reparada tu copia de trabajo: el último commit sigue conteniendo el galimatías. Prepara el archivo para la próxima instantánea y luego tómala.
    .solution = git add novela.txt y luego git commit -m "Recuperar el capítulo 3"
hint-manuscript-poems =
    .lead = Los poemas no los sigue nada. Convierte la carpeta poemas en un repositorio git y luego toma una primera instantánea de todos los poemas.
    .solution = cd ../poemas, git init, git add . (el punto: toda la carpeta) y luego git commit -m "Primeros poemas"
hint-manuscript-end =
    .lead = Hacen falta las dos cosas: la novela reparada en un commit nuevo, y los tres poemas en un commit de su propio repositorio. git log, en cada carpeta, te dice dónde estás.
    .solution = En novela: git add novela.txt y git commit -m "…"; en poemas: git init, git add . y git commit -m "…"
