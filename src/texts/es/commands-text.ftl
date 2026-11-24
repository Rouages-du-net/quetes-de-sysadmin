### Comandos de texto (src/engine/commands/text.ts): grep, head, tail,
### wc, sort, uniq, cut, less.

# { $command }: el comando (grep, wc…)
text-without-input = { $command }: hace falta un archivo (o texto que llegue por una tubería |)
grep-usage = Uso: grep patrón archivo (p. ej. grep pimienta libro.txt)
# Diferencia deliberada: el grep real no dice nada cuando no encuentra nada.
grep-nothing = (ninguna línea contiene «{ $pattern }»)
cut-fields = cut: debe indicar una lista de campos con -f (p. ej. cut -d " " -f 1)
cut-separator = cut: el delimitador debe ser un solo carácter

awk-usage =
    usage: awk [-F value] [-v var=value] [--] 'program text' [file ...]
    (Ejemplo: awk '{"{"}print $1{"}"}' access.log; mira man awk)

## diff (GNU diffutils, mensajes en español)

# { $operand }: el último argumento dado
diff-usage =
    diff: falta un operando después de '{ $operand }'
    diff: Pruebe 'diff --help' para más información.
diff-missing = diff: { $target }: No existe el fichero o el directorio
# { $a }, { $b }: las dos rutas comparadas
diff-under-directories = Subdirectorios comunes: { $a } y { $b }
diff-types = El fichero { $a } es un directorio mientras que el fichero { $b } es un archivo regular
diff-different = Los archivos { $a } y { $b } son distintos
# { $place }: una carpeta; { $name }: lo que solo existe allí
diff-only = Sólo en { $place }: { $name }
