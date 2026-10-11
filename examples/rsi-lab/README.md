# Anatomía de la automejora recursiva

Del Transformer al sistema que mejora cómo se mejora. Una experiencia interactiva en un laboratorio
isométrico oscuro que recorre tres escalas (laboratorio, modelo, tensores) para responder:

> ¿Qué tendría que cambiar en un sistema de IA para que su próxima versión también pudiera producir
> mejores mejoras?

Todo el texto visible está en español. Los números de la escena se calculan en la propia página
(o están citados, o marcados como simulación conceptual): no hay activaciones ni cadenas de
pensamiento de modelos reales.

## Abrir

Abrir `rsi-lab.html` en un navegador (doble clic). Es un único archivo de unos 650 KB: no necesita
servidor, red ni credenciales. Abre en el modo **Aprender paso a paso**, con la pestaña **Guía**
del panel lateral a la vista.

La pantalla tiene pocos controles a la vista:

- **Arriba**: el título, un menú con los 10 capítulos, «Panel» y «?».
- **Abajo**: ◀, ▶ (reproducción automática), ▶| (siguiente) y la línea de tiempo.
- **Sobre la escena**: la columna «¿Qué cambió?» a la izquierda y, si el paso la usa, una ventana
  de datos con su botón ×. Los botones de cámara y escala aparecen sólo al mover el ratón sobre la
  escena.

Sonido, velocidades, modo Explorar, reinicio y atajos están en la pestaña **Ajustes** del panel.

Al abrir, una presentación breve explica qué es el laboratorio, qué muestra, qué permite y qué no
es. Se cierra con «Empezar» o × (o al avanzar), y vuelve a aparecer con un clic en el piso del
laboratorio.

Reconstruir la página después de cambiar las fuentes (Node 20 o posterior, sin dependencias):

```sh
node examples/rsi-lab/build.mjs
```

## Recorrido

La duración no es fija: se calcula a partir del texto de cada paso. Cada bloque de lectura dura
`palabras / ppm · 60 + 2,5 s` (mínimo 6 s), y la animación de la operación se suma aparte, con su
propio control de velocidad. A 140 palabras por minuto la lección completa se estima en
**76 min** (92 min a 110 ppm, 66 min a 170 ppm). La estimación se recalcula en la página con el
texto vigente, que depende de los parámetros elegidos.

| # | Capítulo | Escala | Qué se calcula en la página | Pasos | Min a 140 ppm |
|---|---|---|---|---|---|
| 1 | El laboratorio y sus tres bucles | laboratorio | un fallo real del gestor de contexto v0 sobre una tarea del banco | 19 | 9,8 |
| 2 | De tokens a representaciones | modelo | tokenización, X₀ = E[id] + P[t] (cambiar un token recalcula todo) | 8 | 5,0 |
| 3 | Atención causal por dentro | tensores | Q, K, V como productos de matrices, QKᵀ/√d_k + M, softmax, Z = AV | 13 | 9,2 |
| 4 | Bloque completo y siguiente token | modelo | bloque pre-LN, GELU, logits, argmax/temperatura, caché KV e invalidación | 15 | 8,7 |
| 5 | Cómo cambian realmente los parámetros | modelo | pérdida, gradiente, diferencias finitas, SGD y Adam sobre la cabeza de salida | 16 | 8,2 |
| 6 | Algoritmos que pueden contribuir a la mejora | laboratorio | A reflexión con pruebas, B REINFORCE (+ PPO), C búsqueda evolutiva de programas | 20 | 10,9 |
| 7 | Una automejora concreta del agente | laboratorio | banco de tareas, v0→v1 mejora, v1→v2 regresión, v1→v3 sin diferencia concluyente | 13 | 7,5 |
| 8 | Dónde aparece la recursión | laboratorio | dos ciclos trazados del bucle real; A (analista fijo en v0) frente a B (analista = versión activa), 12 semillas | 14 | 7,7 |
| 9 | Conexión con investigaciones reales | laboratorio | fichas de Gödel Machine, Darwin Gödel Machine y AlphaEvolve (resultados citados) | 4 | 3,2 |
| 10 | Límites del bucle y cierre | laboratorio | mesa de límites, cinco fallos, vuelta a la última versión válida, cadena causal completa | 13 | 6,3 |

Son 76 escenas y 135 pasos de lectura. Cada paso declara en la franja «Qué cambia / qué permanece
fijo» si cambian el contexto, los parámetros, el código, los datos, el evaluador o la
infraestructura, con palabras simples. La huella de θ (FNV-1a de los 2048 parámetros) sólo se
muestra en los capítulos 4 y 5, donde importa, y en Explorar.

## Modo Aprender y narrador escrito

No hay voz: todo se entiende con el sonido apagado. Cada paso explica una sola idea y tiene cuatro
fases:

1. **Orientación**: dónde mirar, qué información guarda el objeto y qué operación va a ocurrir. La
   escena queda quieta mientras se lee; los objetos nombrados se resaltan y el resto se atenúa.
2. **Ver la operación**: se anima sólo esa operación.
3. **Interpretación**: qué cambió, qué significa y qué queda fijo.
4. **Continuar**.

En la Guía:

- «↻ Repetir» vuelve a animar la operación con su sonido.
- «Más simple» da una explicación propia de cada concepto, no una plantilla.
- «Un ejemplo» muestra números pequeños con su procedencia.
- Cada explicación desplegada se cierra con su ×.
- Cada término con subrayado punteado abre el glosario (82 entradas: definición, ejemplo y dónde
  está en la escena).
- Cada nombre de objeto marcado con ◉ lo señala en la escena.
- Debajo queda el historial de texto del capítulo.

Cuando se activa ▶, cada fase espera su tiempo de lectura antes de pasar a la siguiente. Mientras
tanto el reloj avanza y una barra bajo el texto muestra cuánto falta. Con el panel oculto no hay
nada que leer, así que cada fase espera sólo 2,5 s.

Inspeccionar una celda o un módulo, cambiar un parámetro, mover la cámara o abrir una explicación
pausa la lección sin perder el punto. Al continuar, el texto se recalcula con los valores nuevos.

La pestaña Guía mide 400 px (340 px entre 760 y 1100 px), con texto de 15,5 px (15 px en
pantallas medianas y estrechas), apenas mayor que el resto de la interfaz. En pantallas estrechas la lectura pasa a una sección debajo de la
escena. En Aprender se ocultan las huellas, las comprobaciones y los detalles del renderer: siguen
en la pestaña Referencias. El narrador escrito es la Guía del panel: **N** (o «Panel») lo oculta y
lo vuelve a mostrar.

### Ventanas de datos

Las fórmulas, registros y tablas de cada paso aparecen en ventanas sobre la escena:

- **×** las pliega a una pestaña con su título, y un clic en el título las vuelve a abrir;
- la ventana cerrada sigue cerrada en los pasos siguientes;
- **V** pliega o despliega todas;
- en Ajustes se puede pedir que no se abran solas.

La mesa de control de cada escena empieza plegada. Reúne los parámetros de esa escena (por
ejemplo, la cabeza y la fila en el capítulo 3, o η en el 5): al cambiar uno, los cálculos, la
escena y el texto de la Guía se rehacen con el valor nuevo. Su primera línea lo explica.

## Controles

| Tecla | Acción |
|---|---|
| Espacio | reproducción automática / pausa |
| → o Intro | siguiente: «Ver la operación» o «Continuar» |
| ← | fase anterior, con sus parámetros |
| R | repetir esta operación |
| N o I | mostrar u ocultar el panel (y con él el narrador) |
| V | plegar o desplegar las ventanas de datos |
| X | silenciar o reactivar los sonidos al instante |
| [ / ] | capítulo anterior / siguiente |
| + / − | acercar / alejar |
| Q / E, W / S | girar / inclinar la cámara |
| C | volver a la cámara guiada |
| M | alternar Aprender / Explorar |
| Esc | cerrar el rótulo o volver a la escala anterior |
| 0 | reiniciar |

Con el ratón:

- arrastrar mueve la vista, sin tope; la rueda acerca y aleja;
- el botón derecho (o Mayús) + arrastrar gira la cámara, entre 0° y 90° de acimut;
- un clic en un módulo, una matriz o una celda muestra encima su nombre y qué hace (o el valor de
  la celda). «Detalles en el panel» abre la ficha completa: entradas y salidas recorribles,
  operandos y procedencia de cada número. Esc, ×, un clic en una zona vacía o un segundo clic en
  el mismo objeto cierran el rótulo y devuelven la vista sin nada seleccionado.

En Ajustes, «animación» sólo cambia la velocidad de los movimientos y «lectura» cambia el tiempo de
lectura en la reproducción automática. Con «reducir movimiento» del sistema, cada operación salta a
su resultado sin interpolar.

## Sonido

Los sonidos están apagados al abrir. «Activar sonidos», en Ajustes, crea el `AudioContext` de Web
Audio desde ese clic. Hay control de volumen y silencio inmediato (X), y las preferencias se recuerdan en el
navegador. No hay música ni voz.

Cada operación visible emite **un** sonido por señal. Se descartan las repeticiones a menos de
90 ms y se limitan las voces simultáneas. Pausar, cambiar de capítulo, reiniciar u ocultar la
pestaña cancela lo programado y apaga lo activo con un fundido corto. Buscar en la línea de tiempo
no reproduce sonidos intermedios, y «Repetir» los vuelve a habilitar.

| Familia | Cuándo suena | Cómo suena |
|---|---|---|
| Entrada de un token | un token entra a la secuencia o se elige el siguiente | clic breve y seco |
| Lectura de una tabla | embedding, posición, versión del archivo | dos destellos agudos iguales |
| Producto de matrices | Q, K, V, QKᵀ, A·V, W_O, W_U | cuatro pulsos regulares |
| Suma o acumulación | conexión residual, mezcla de vectores | golpes graves redondos que terminan en una nota |
| Normalización | softmax, LayerNorm | tono que vibra y se estabiliza |
| Bloqueo o descarte | máscara causal, líneas descartadas por un gestor | golpe sordo y apagado |
| Transferencia | un dato pasa de un módulo a otro | barrido suave de ruido |
| Gradiente | cómo responde la pérdida a cada parámetro | deslizamiento descendente |
| Actualización | un parámetro aprendible cambia | doble pulso de timbre áspero |
| Evaluación terminada | terminan pruebas o tareas | nota corta de madera |
| Promoción | una candidata pasa a ser la activa | dos notas ascendentes |
| Rechazo o regresión | una candidata no cumple el criterio | dos notas descendentes suaves |

Por qué esta paleta:

- Cada sonido es breve (49–393 ms) y de volumen moderado, para no competir con la lectura.
- Las familias se distinguen por el ritmo (número de pulsos), la altura y el timbre, no sólo por la
  altura. Así se reconocen aunque se confundan las notas.
- Las operaciones que se repiten mucho (tokens, tablas, máscaras) son las más cortas y discretas.
  Las que cierran una decisión (promover, rechazar) son las más melódicas.
- Subir o bajar es una **convención** para reconocer la operación, declarada en la leyenda: no
  representa el signo de un gradiente ni una medición. La leyenda de la Guía permite escuchar cada
  sonido.

Los sonidos se sintetizan con osciladores y ruido filtrado: no hay archivos de audio.

## Una fuente de eventos para texto, resaltado y sonido

Cada operación narrada declara sus señales con
`{ id, op, label, targets, step, phase, data }`. Un bus único las reparte a cuatro destinos:

- el sonido;
- la etiqueta de operación sobre la escena;
- el destello de los objetos afectados;
- el registro que lee la QA.

Las señales se arman sólo al ejecutar o repetir una operación y se disparan desde el reloj de la
lección. `pose()` y `render()` nunca producen sonido. Por eso un paso que se ve, se lee y se
escucha corresponde siempre al mismo evento.

## Procedencia de los números

Cada panel y cada ejemplo lleva una etiqueta:

- **resultado calculado**: se calcula en la página con código de `model/` y se comprueba en
  `verify.mjs` o con «Verificación en vivo», en la pestaña Referencias.
- **resultado citado**: cifras de artículos (capítulo 9), con fuente, fecha, tipo de evidencia y
  límites.
- **ejemplo ilustrativo**: vocabulario inventado, propuestas guionadas, analogías.
- **simulación conceptual**: el bucle de automejora y sus límites. Las ejecuciones sobre el banco
  de tareas y el criterio estadístico son reales. Las reglas del proponente y las tareas son
  inventadas.

## Estructura

```
rsi-lab/
├── rsi-lab.html         página construida, autónoma
├── build.mjs            empaquetador mínimo de módulos ES → un solo HTML
├── verify.mjs           69 comprobaciones en Node (modelos, presupuesto, ruta de datos, guion)
├── qa.mjs               capturas de los 135 pasos (orientación y resultado) y errores de consola
├── qa-interact.mjs      55 comprobaciones de interacción (Playwright)
├── qa-audio.mjs         16 comprobaciones de señales de audio y disciplina de eventos (17 con --reduced)
├── model/               modelos puros, sin DOM: se ejecutan igual en Node y en el navegador
│   ├── rng.mjs          mulberry32, normal de Irwin–Hall, huella FNV-1a
│   ├── linalg.mjs       matrices como listas de filas, con comprobación de dimensiones
│   ├── tokenizer.mjs    vocabulario de juguete de 16 símbolos
│   ├── transformer.mjs  decodificador de 2 bloques, caché KV
│   ├── train.mjs        pérdida, gradiente analítico, SGD, Adam
│   ├── reflection.mjs   estación A
│   ├── rl.mjs           estación B: REINFORCE con baseline, PPO
│   ├── evo.mjs          estación C: programas de prioridad para empaquetado, archivo MAP-Elites
│   ├── agent.mjs        banco de tareas, gestores de contexto v0–v3, bootstrap pareado
│   ├── loop.mjs         bucle de automejora: analista, reglas del proponente, contabilidad, puerta de datos
│   └── limits.mjs       controles y escenarios de fallo
└── view/
    ├── engine.mjs       motor SVG isométrico: cámara, orden de pintado jerárquico, etiquetas
    ├── director.mjs     capítulos → escenas → eventos, cámara guiada, animación hasta un evento
    ├── names.mjs        nombre y descripción breve de cada objeto que se puede tocar
    ├── lesson.mjs       modo Aprender: pasos, fases, lectura automática, historial, Guía
    ├── bus.mjs          fuente única de eventos semánticos
    ├── sound.mjs        paleta Web Audio, preferencias, límites de superposición
    ├── guide/           guion de los 10 capítulos (n01–n10) y glosario (concepts.mjs)
    ├── store.mjs        estado del usuario y cálculos memorizados
    ├── lab.mjs, rack.mjs, tensors.mjs, stations.mjs, shapes.mjs, matrix.mjs   geometría
    ├── main.mjs, ui.mjs, inspector.mjs, checks.mjs   interfaz
    └── ch/c01.mjs … c10.mjs   un archivo por capítulo
```

La separación es estado → cálculo → render. `model/` no conoce la vista. Cada escena define una
pose determinista `pose(ctx, t, evento)`, y el render nunca modifica el modelo. Saltar a cualquier
paso reconstruye su estado desde los parámetros, sin reproducir los anteriores.

### Alcance gráfico

La escena es **SVG + HTML**. El motor proyecta una cámara isométrica orientable dentro de un
cuadrante: 0°–90° de acimut y 18°–62° de elevación. La geometría sólo dibuja las caras visibles
desde ese cuadrante. No hay WebGL, sombreadores ni iluminación física. Los pulsos, destellos y
transiciones son atributos SVG interpolados.

Del kit de Anatomy se usa `kit/iso-kit.mjs` sin modificarlo: proyección isométrica, sólidos
sombreados, biseles, tornillos, costuras, texto sobre caras y tokens de color `ISO_CSS`. Las
matrices pequeñas, las fórmulas y los objetos seleccionables encajan bien en SVG, y cada celda
puede llevar su tooltip.

## Modelos y decisiones

- **Transformer de juguete** (elección didáctica, no réplica de un modelo real):
  - vocabulario 16, secuencia 6 (máximo 10), d_model 8;
  - 2 cabezas con d_k 4, 2 bloques, MLP 8→32→8;
  - pre-LayerNorm `H = X + MHA(LN(X))`, `Y = H + MLP(LN(H))`, GELU con aproximación tanh,
    LayerNorm final;
  - `logits = LN_f(y_n)·W_U + b_U`.

  Tiene 2048 parámetros aleatorios con semilla 7: sus predicciones no implican comprensión. El
  texto separa siempre **parámetros** (θ, fijos salvo en el capítulo 5), **activaciones** (lo
  calculado para esta entrada), **coeficientes de atención** (A, una activación, no un parámetro) y
  el **código, las herramientas y el contexto** del agente.
- **Inicialización reproducible**: la normal se aproxima sumando 12 uniformes (Irwin–Hall). Sólo
  usa sumas exactas en IEEE-754, así Node y los navegadores producen los mismos bits (huella
  `f0b9c189`). Box–Muller usa log/sin/cos, cuyos últimos bits varían entre motores.
- **Entrenamiento real de una parte** (cambio de escala declarado en la escena):
  - El cuerpo queda congelado. Se entrenan los 160 parámetros de la cabeza (γ_f, β_f, W_U, b_U)
    con `L = −log p_y`.
  - El gradiente analítico se compara con diferencias finitas centrales en los 160 parámetros.
  - Adam usa β1 = 0,9, β2 = 0,999, ε = 10⁻⁸ y corrección de sesgo.
  - Hay seis ejemplos de entrenamiento y cuatro de validación, disjuntos. La validación nunca
    entra en un gradiente.
  - η = 0,5 sobreajusta, η = 1,2 empeora algunos pasos y luego converge, η = 3 diverge.
- **Estación A**: los tres intentos de código son propuestas guionadas. Las pruebas se ejecutan de
  verdad, y la nota de reflexión es una plantilla, no texto de un LLM. θ no cambia.
- **Estación B**: política softmax sobre 4 estrategias de lectura de registros. REINFORCE usa un
  baseline calculado antes de cada lote, independiente de las acciones del lote. PPO usa ε = 0,2 y
  4 épocas, con el gradiente comprobado por diferencias finitas.
- **Estación C**: búsqueda evolutiva de expresiones de prioridad para empaquetar objetos.
  - El presupuesto total es fijo: 192 evaluaciones.
  - Usa un archivo de diversidad por celdas.
  - La comparación final se hace en 24 secuencias reservadas.
- **Banco de tareas del agente** (capítulo 7): tareas sintéticas de depuración a partir de
  registros, con cuatro familias de causa, señuelos, reintentos y cadenas.
  - El solucionador es simbólico y sólo ve el contexto que el gestor deja pasar, con un
    presupuesto de 64 tokens.
  - Las particiones son disjuntas: desarrollo (16), validación (40), prueba reservada (60) y
    auditoría (40).
  - Éxito en validación: v0 7,5 %, v1 80 %, v2 15 %, v3 77,5 %. v1 → v3 no es concluyente (IC95
    bootstrap pareado de Δéxito: −0,175 a 0,125).
  - Con puerta de corrección, una candidata se rechaza si el IC95 de Δéxito queda entero por debajo
    de 0, y sólo se promueve si queda entero por encima.

### Quién produce las modificaciones

El Transformer **no** genera los cambios del agente. `propose()` es un **proponente de reglas
programadas**. Lee el diagnóstico que quedó visible en los informes de fallo y aplica una de seis
reglas: presupuesto, tipo, recorte, señuelo, duplicados o mutación aleatoria si no ve ningún
diagnóstico. La escena lo rotula así, y no anima tokens convirtiéndose en un parche. En un sistema
real, un modelo de lenguaje podría ocupar ese lugar; aquí el Transformer se estudia por separado.

### El bucle y la autorreferencia (capítulos 8 y 10, simulación conceptual)

θ queda congelado. Cada ciclo hace lo siguiente:

1. Corre 16 tareas de desarrollo con la versión activa.
2. Los informes de fallo pasan por el gestor de contexto del **analista**.
3. Lo que quede visible es la entrada del proponente.
4. La candidata se evalúa frente a la activa en las mismas tareas de validación.

En el **modo A** el analista queda fijo en v0. En el **modo B** el analista es la versión activa:
una versión promovida participa en la siguiente propuesta. Esa es la autorreferencia.

El capítulo 8 traza dos ciclos reales de la semilla 2, modo B. Es un caso didáctico, rotulado
así:

- **Ciclo 1**: con v0 el analista ve 0 de 4 diagnósticos. La propuesta es una mutación aleatoria
  («peso INFO: 0 → −1»). Se promueve (Δ +0,25, IC95 [0,07; 0,42]).
- **Ciclo 2**: el analista es esa versión y ve 4 de 4 diagnósticos. Se dispara la regla
  «presupuesto» y la propuesta «seleccionar por puntuación» se promueve (+0,35).

La conclusión A/B sale de las 24 corridas, no de este caso.

### Protocolo de presupuesto

- **Unidad**: una ejecución de una tarea del banco (una llamada a `runTask`). No es tiempo, FLOPs
  ni dinero.
- **Presupuesto de búsqueda** = desarrollo + validación, incluida la reevaluación de la versión
  activa en cada comparación. Por defecto son 1600 ejecuciones, el mismo máximo para A y B.
- **Aparte**: la auditoría (40 por versión medida) y la prueba final (60 por versión evaluada al
  terminar). Se informan, pero no salen del límite de búsqueda.
- **Reserva**: un ciclo empieza sólo si lo que queda cubre `16 + 2 × nVal`. No hay lotes parciales.
  Si la candidata es inválida, la reserva de validación se libera sin ejecutarse. Si la estrategia
  cambia `nVal`, se cobra el `nVal` efectivo.
- **Sin caché**: cada evaluación se ejecuta y se cobra.
- **Contabilidad central**: un único libro (`makeLedger`) cobra antes de ejecutar y lanza un error
  si la búsqueda superara el límite. `verify.mjs` lo contrasta con un observador independiente
  enganchado en `runTask`.

Resultado con 12 semillas y el mismo límite de 1600:

- Gasto de búsqueda observado entre 1536 y 1600. «Mismo presupuesto máximo» no es «mismo gasto
  observado».
- B termina con mejor prueba final en 7 semillas, igual en 5 y peor en 0.
- Prueba final media: A 42,9 %, B 54,3 %.
- El coste por mejora se informa como «no aplicable» cuando una corrida no logra mejoras.

Estas cifras dependen de reglas inventadas para la demostración.

### Separación de datos

Una puerta (`makeGate`) decide qué consumidor puede ejecutar qué partición:

| Consumidor | Partición |
|---|---|
| ejecutor | desarrollo |
| selector | validación |
| auditor | auditoría |
| evaluador final | prueba, sólo en la fase «final», después de fijar la versión elegida |

El proponente sólo recibe informes de desarrollo.

La auditoría participa en la selección cuando se usa para volver a una versión anterior
(capítulo 10), y la escena lo dice. El único número independiente es el de la prueba final.

Es una **separación lógica dentro del mismo programa**, comprobada en la ruta real de `runLoop`,
`propose`, el gestor de contexto y los evaluadores. No es una barrera de seguridad: código
malicioso en la misma página podría saltarla.

### Límites

Cada control tiene un efecto definido en `model/limits.mjs`: presupuesto de búsqueda, ruido del
evaluador, diversidad de tareas, coste de validación, diversidad de candidatos y criterio.

Los escenarios (base, sobreajuste a la validación, métrica imperfecta, pérdida de diversidad,
regresión fuera del dominio y agotamiento del presupuesto) son combinaciones de esos controles.
El texto de cada uno se deriva de su corrida, y `verify.mjs` comprueba que lo narrado se cumple.

## Verificación ejecutada

Lo siguiente se ejecutó en este repositorio con Node 22 y Chromium headless (Playwright, con
renderizado por software). Las comprobaciones son de tres tipos:

- las que ya existían y se volvieron a correr;
- las nuevas de esta revisión (presupuesto, ruta de datos, causalidad, guion, audio);
- lo que sólo se inspeccionó.

**Comprobaciones en Node**

- `node examples/rsi-lab/verify.mjs`: **69/69**. Las 45 originales siguen, incluidas:
  - dimensiones de los intermedios y máscara causal (peso futuro exactamente 0);
  - filas de A que suman 1, y caché KV igual a recomputar;
  - gradiente frente a diferencias finitas, y Adam frente a una referencia escalar;
  - θ sin cambios fuera del capítulo 5.
- Nuevas, de **presupuesto**:
  - libro = ejecuciones observadas en `runTask` en 24 corridas, y búsqueda ≤ límite;
  - semilla 12 con límite 900;
  - límites pequeños (0, 50, 95, 96, 150, 200, 333) sin lotes parciales;
  - `nVal` cambiante cobrado como 2 × nVal, y candidatas inválidas que liberan la validación.
- Nuevas, de **ruta de datos**:
  - la prueba se ejecuta sólo después de fijar la versión (orden observado);
  - el proponente recibe sólo desarrollo, y el registro de accesos cumple la política;
  - la puerta rechaza la prueba durante la búsqueda;
  - contrafactual: cambiar sólo la prueba reservada no cambia propuestas, promociones ni versión
    elegida.
- Nuevas, de **causalidad**:
  - el analista v0 no ve diagnósticos y v1 sí;
  - sin diagnóstico la propuesta es aleatoria, y borrar el texto del diagnóstico la vuelve
    aleatoria;
  - en A no hay propuestas dirigidas y en B sí.
- Nuevas, del **guion**:
  - cada evento de cada escena tiene un paso;
  - los textos se generan sin «undefined» ni «NaN» con dos configuraciones de parámetros;
  - ningún bloque supera 75 palabras;
  - cada término enlazado tiene entrada en el glosario;
  - cada ejemplo corre y declara su procedencia;
  - cada señal usa una familia de sonido definida.

**Comprobaciones en el navegador**

- «Verificación en vivo» (pestaña Referencias): 14 comprobaciones recalculadas en el navegador. Incluyen la
  ruta real (`runLoop` con observador de `runTask`). Todas son correctas.
- `node examples/rsi-lab/qa-interact.mjs`: **55/55** (53/53 con `--reduced`, donde no hay
  animación que congelar). Cubre:
  - interfaz mínima: tres botones arriba, tres abajo y ninguna leyenda fija sobre la escena;
  - ▶ hace avanzar el reloj y la barra de lectura enseguida; con el panel oculto no espera la
    lectura;
  - × pliega una ventana de datos y la deja plegada en el paso siguiente; V pliega todas;
  - el clic en un módulo o una celda muestra su rótulo encima, sin cambiar de pestaña; un clic en
    una zona vacía o la × devuelven la vista inicial;
  - la presentación inicial y su reaparición con un clic en el piso del laboratorio;
  - arrastrar desplaza sin tope, también con zoom y el panel abierto; botón derecho gira;
  - menú de capítulos y pestaña Ajustes (sonido, ritmo, ventanas, reinicio, atajos);
  - fases orientación → operación → resultado, ← y → con sus parámetros;
  - abrir el glosario a mitad de una operación la congela, y «Seguir la operación» la completa;
  - «Repetir» que vuelve a emitir sus eventos una vez;
  - «más simple» y «ejemplo» con procedencia;
  - reproducción automática con espera mínima de lectura, y pausa que congela el punto;
  - inspección de celdas y módulos que pausa, y verificación en vivo;
  - cámara y «Volver a la explicación»;
  - N que oculta y muestra el panel con el narrador;
  - texto recalculado al cambiar la cabeza, un token o η;
  - reinicio, y sin desplazamiento horizontal.
- `node examples/rsi-lab/qa-audio.mjs`: **16/16** (17/17 con `--reduced`). Renderiza cada familia
  en un `OfflineAudioContext` y mide pico, duración, rampas sin clic, pulsos, centroide espectral
  y contorno. Las familias difieren entre sí: la distancia mínima es 0,53, entre actualización y
  evaluación. También comprueba que:
  - el contexto se activa sólo con el clic;
  - el texto es idéntico con o sin sonido;
  - hay un sonido por señal, sin duplicados;
  - buscar en la línea de tiempo no suena;
  - pausar y ocultar la pestaña cancelan;
  - «Repetir» vuelve a sonar una vez;
  - X silencia.
- `node examples/rsi-lab/qa.mjs`: 221 capturas por tamaño (la orientación de los 135 pasos y el
  resultado de los 86 que tienen una operación), sin errores ni avisos de consola a 1440×900,
  900×700 y 390×844, y con movimiento reducido.

**Inspección manual y límites de lo verificado**

- Revisé a mano las hojas de contactos por capítulo y capturas a tamaño completo de los pasos
  principales (atención en el capítulo 3, ciclos trazados del 8, escritorio y móvil). Esa revisión
  visual no es exhaustiva ni automática, y se hizo sobre capturas de Chromium headless: no hubo
  inspección en un navegador con pantalla ni en dispositivos reales.
- **El audio no se evaluó perceptivamente**: en este entorno no hay salida de sonido. Lo verificado
  son las señales generadas y la disciplina de eventos.

`qa.mjs`, `qa-interact.mjs` y `qa-audio.mjs` necesitan Playwright y Chromium, que no son
dependencias del repositorio: buscan Playwright instalado globalmente y aceptan la ruta del
navegador en `CHROME_PATH`. Las capturas van a `shots/`, que está en `.gitignore`.

## Simplificaciones y limitaciones

- El Transformer es de juguete y sus parámetros son aleatorios: muestra el mecanismo, no el
  comportamiento de un modelo entrenado. Sólo se entrena la cabeza de salida.
- Las propuestas de código de los capítulos 6 y 7 están escritas de antemano (etiquetadas
  «propuestas guionadas»). El proponente del bucle sigue reglas programadas, no un LLM. Lo que sí
  se ejecuta son las pruebas, el banco de tareas y las estadísticas.
- El solucionador del banco es simbólico. «Éxito» mide si la evidencia necesaria sobrevivió al
  gestor de contexto, no la capacidad de un modelo.
- La separación de datos es lógica, no una barrera de seguridad.
- Las cifras del capítulo 9 se contrastaron con los resúmenes y anuncios publicados (arXiv,
  DeepMind). Desde el entorno de construcción no se pudieron descargar los PDF.
- Sólo tema oscuro. La cámara se limita a un cuadrante (acimut 0°–90°, elevación 18°–62°).
- Durante una rotación cada fotograma reconstruye la escena SVG. En Chromium headless con
  renderizado por software costó entre 23 y 46 ms de mediana por fotograma, y las matrices densas
  se ocultan mientras se arrastra si un fotograma supera 24 ms. No se midió en GPU ni en
  dispositivos móviles reales.
- Probado sólo en Chromium. Firefox y Safari no se probaron.
- En pantallas estrechas (≤ 760 px) la lectura pasa debajo de la escena y la mesa de control se
  pliega. Es una adaptación funcional, menos cuidada que la de escritorio.
- No se ejecutó la auditoría geométrica del kit (`scripts/` de Anatomy), pensada para las figuras
  del repositorio.

## Fuentes

- Vaswani et al., [«Attention Is All You Need»](https://arxiv.org/abs/1706.03762) (2017).
- Radford et al., [«Language Models are Unsupervised Multitask Learners»](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) (2019).
- Hendrycks y Gimpel, [«Gaussian Error Linear Units (GELUs)»](https://arxiv.org/abs/1606.08415) (2016).
- Kingma y Ba, [«Adam: A Method for Stochastic Optimization»](https://arxiv.org/abs/1412.6980) (2014).
- Schulman et al., [«Proximal Policy Optimization Algorithms»](https://arxiv.org/abs/1707.06347) (2017).
- Shinn et al., [«Reflexion: Language Agents with Verbal Reinforcement Learning»](https://arxiv.org/abs/2303.11366) (2023).
- Schmidhuber, [«Gödel Machines: Self-Referential Universal Problem Solvers Making Provably Optimal Self-Improvements»](https://arxiv.org/abs/cs/0309048) (2003).
- Zhang et al., [«Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents»](https://arxiv.org/abs/2505.22954) (2025).
- Novikov et al., [«AlphaEvolve: A coding agent for scientific and algorithmic discovery»](https://arxiv.org/abs/2506.13131) (2025).
