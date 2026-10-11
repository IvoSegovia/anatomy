# Anatomía de la automejora recursiva

Del Transformer al sistema que mejora cómo se mejora. Una experiencia interactiva en un laboratorio
isométrico oscuro que recorre tres escalas (laboratorio, modelo, tensores) para responder:

> ¿Qué tendría que cambiar en un sistema de IA para que su próxima versión también pudiera producir
> mejores mejoras?

Todo el texto visible está en español. Los números de la escena se calculan en la propia página
(o están citados, o marcados como simulación conceptual): no hay activaciones ni cadenas de
pensamiento de modelos reales.

## Abrir

Abrir `rsi-lab.html` en un navegador (doble clic). Es un único archivo de unos 420 KB: no necesita
servidor, red ni credenciales. Pulsar ▶ o la barra espaciadora para empezar el recorrido guiado
(11 min 10 s a velocidad 1×), o «Explorar» para mover la cámara y los controles libremente.

Reconstruir la página después de cambiar las fuentes (Node 20 o posterior, sin dependencias):

```sh
node examples/rsi-lab/build.mjs
```

## Recorrido

| # | Capítulo | Escala | Qué se calcula en la página | Min |
|---|---|---|---|---|
| 1 | El laboratorio y sus tres bucles | laboratorio | un fallo real del gestor de contexto v0 sobre una tarea del banco | 1,2 |
| 2 | De tokens a representaciones | modelo | tokenización, X₀ = E[id] + P[t] (cambiar un token recalcula todo) | 0,8 |
| 3 | Atención causal por dentro | tensores | Q, K, V como cubos de producto de matrices, QKᵀ/√d_k + M, softmax, Z = AV | 1,2 |
| 4 | Bloque completo y siguiente token | modelo | bloque pre-LN, GELU, logits, argmax/temperatura, caché KV e invalidación | 1,1 |
| 5 | Cómo cambian realmente los pesos | modelo | pérdida, gradiente, diferencias finitas, SGD y Adam sobre la cabeza de salida | 1,2 |
| 6 | Algoritmos que pueden contribuir a la mejora | laboratorio | A reflexión con pruebas, B REINFORCE (+ PPO), C búsqueda evolutiva de programas | 1,2 |
| 7 | Una automejora concreta del agente | laboratorio | banco de tareas, v0→v1 mejora, v1→v2 regresión, v1→v3 sin diferencia concluyente | 1,4 |
| 8 | Dónde aparece la recursión | laboratorio | bucle A (proponente fijo) frente a B (las versiones promovidas participan), 12 semillas | 1,1 |
| 9 | Conexión con investigaciones reales | laboratorio | fichas de Gödel Machine, Darwin Gödel Machine y AlphaEvolve (resultados citados) | 0,7 |
| 10 | Límites del bucle y cierre | laboratorio | mesa de límites, seis escenarios de fallo, vuelta a la última versión válida | 1,4 |

Cada paso declara en la franja «¿Qué cambió?» si cambian el contexto, los pesos, el código, los
datos, el evaluador o la infraestructura, y la huella de θ (FNV-1a de los 2048 parámetros) muestra
cuándo los pesos del modelo cambian de verdad: sólo en el capítulo 5.

## Controles

| Tecla | Acción |
|---|---|
| Espacio | reproducir / pausar |
| → / ← | avanzar un evento / volver al estado guardado anterior |
| [ / ] | capítulo anterior / siguiente |
| Q / E, W / S | girar / inclinar la cámara |
| + / − | acercar / alejar |
| R | volver a la cámara guiada |
| I | mostrar u ocultar el inspector |
| M | alternar recorrido / exploración |
| Esc | volver a la escala anterior |
| 0 | reiniciar |

Ratón: arrastrar gira, Mayús + arrastrar o botón derecho desplaza, la rueda acerca. Clic en un
módulo, matriz o celda: el inspector muestra su función, entradas y salidas (recorribles), la
operación con sus operandos y la procedencia de cada número. La velocidad de reproducción sólo
cambia el ritmo de la animación; el presupuesto de cómputo y la tasa de aprendizaje son controles
aparte en la mesa de control de cada escena. Con «reducir movimiento» del sistema, la escena salta
de evento en evento sin interpolar.

## Procedencia de los números

Cada panel lleva una etiqueta:

- **cálculo local verificable**: se calcula en la página con código de `model/` y se comprueba en
  `verify.mjs` o en la pestaña Verificación del inspector.
- **resultado externo citado**: cifras de artículos (capítulo 9), con fuente, fecha, tipo de
  evidencia y límites.
- **dato ilustrativo / simulación conceptual**: vocabulario inventado, propuestas guionadas, reglas
  declaradas del proponente del bucle. Las ejecuciones sobre el banco de tareas y el criterio
  estadístico sí son reales.

## Estructura

```
rsi-lab/
├── rsi-lab.html         página construida, autónoma
├── build.mjs            empaquetador mínimo de módulos ES → un solo HTML
├── verify.mjs           45 comprobaciones numéricas en Node
├── qa.mjs               capturas de los 75 pasos y errores de consola (Playwright)
├── qa-interact.mjs      21 comprobaciones de interacción (Playwright)
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
│   ├── loop.mjs         bucle de automejora (modos A y B)
│   └── limits.mjs       controles y escenarios de fallo
└── view/
    ├── engine.mjs       motor SVG isométrico: cámara, orden de pintado jerárquico, etiquetas
    ├── director.mjs     capítulos → pasos → eventos, historial de estados, cámara guiada
    ├── store.mjs        estado del usuario y cálculos memorizados
    ├── lab.mjs, rack.mjs, tensors.mjs, stations.mjs, shapes.mjs, matrix.mjs   geometría
    ├── main.mjs, ui.mjs, inspector.mjs, checks.mjs   interfaz
    └── ch/c01.mjs … c10.mjs   un archivo por capítulo
```

La separación es estado → cálculo → render: `model/` no conoce la vista, cada paso define una pose
determinista `pose(ctx, t, evento)` y el render nunca modifica el modelo. Saltar a cualquier paso
reconstruye su estado desde los parámetros, sin reproducir los anteriores.

Del kit de Anatomy se usa `kit/iso-kit.mjs` (proyección isométrica, sólidos sombreados, biseles,
tornillos, costuras, texto sobre caras, tokens de color `ISO_CSS`) sin modificarlo. No se usa el
modo 3D ni WebGL: las matrices pequeñas, las fórmulas y los objetos seleccionables encajan mejor en
SVG + HTML, y cada celda puede llevar su tooltip.

## Modelos y decisiones

- **Transformer de juguete** (elección didáctica, no réplica de un modelo real): vocabulario 16,
  secuencia 6 (máximo 10), d_model 8, 2 cabezas con d_k 4, 2 bloques, MLP 8→32→8, pre-LayerNorm
  `H = X + MHA(LN(X))`, `Y = H + MLP(LN(H))`, GELU con aproximación tanh, LayerNorm final,
  `logits = LN_f(y_n)·W_U + b_U`. 2048 parámetros aleatorios con semilla 7: sus predicciones no
  implican comprensión.
- **Inicialización reproducible**: la normal se aproxima sumando 12 uniformes (Irwin–Hall). Sólo
  usa sumas exactas en IEEE-754, así Node y los navegadores producen los mismos bits (huella
  `f0b9c189`); Box–Muller usa log/sin/cos, cuyos últimos bits varían entre motores.
- **Entrenamiento real de una parte** (cambio de escala declarado en la escena): el cuerpo queda
  congelado y se entrenan los 160 parámetros de la cabeza (γ_f, β_f, W_U, b_U) con
  `L = −log p_y`. El gradiente analítico se compara con diferencias finitas centrales en los 160
  parámetros. Adam con β1 = 0,9, β2 = 0,999, ε = 10⁻⁸ y corrección de sesgo. Seis ejemplos de
  entrenamiento y cuatro de validación, disjuntos; la validación nunca entra en un gradiente.
  η = 0,5 sobreajusta (la validación mínima está en el paso 7), η = 1,2 empeora algunos pasos y
  luego converge, η = 3 diverge.
- **Estación A**: los tres intentos de código son propuestas guionadas; las pruebas se ejecutan de
  verdad y la nota de reflexión es una plantilla, no texto de un LLM. θ no cambia.
- **Estación B**: política softmax sobre 4 estrategias de lectura de registros; REINFORCE con un
  baseline calculado antes de cada lote (media móvil de lotes anteriores, independiente de las
  acciones del lote). PPO con ε = 0,2 y 4 épocas, gradiente comprobado por diferencias finitas.
- **Estación C**: búsqueda evolutiva de expresiones de prioridad para empaquetar objetos de tamaño
  20–70 en máquinas de capacidad 100; presupuesto total fijo de 192 evaluaciones; el control
  «secuencias por candidata» reparte ese presupuesto; archivo de diversidad por celdas; comparación
  final en 24 secuencias reservadas.
- **Banco de tareas del agente** (capítulo 7): tareas sintéticas de depuración a partir de
  registros, con cuatro familias de causa, señuelos, reintentos y cadenas tempranas o tardías. El
  modelo base está congelado; el solucionador es simbólico (reglas por palabras clave) y sólo ve
  el contexto que el gestor deja pasar con un presupuesto de 64 tokens. Particiones disjuntas:
  desarrollo (16), validación (40), prueba reservada (60, se usa una vez) y auditoría (40, sólo
  para la escena 10). Éxito en validación: v0 7,5 %, v1 80 %, v2 15 %, v3 77,5 %; v1 → v3 no es
  concluyente (IC95 bootstrap pareado de Δéxito: −0,175 a 0,125). Métrica compuesta
  `éxito − λ·coste/64` (λ = 0,1 por defecto, ajustable) con puerta de corrección: se rechaza la
  candidata cuyo IC95 de Δéxito queda entero por debajo de 0, y sólo se promueve si queda entero por
  encima; el resto se archiva sin promover.
- **Bucle de automejora** (capítulos 8 y 10, simulación conceptual): estado
  `S_t = (θ_t, código_t, memoria_t, estrategia_t)` con θ congelado. En el modo B la versión
  promovida pasa a leer los informes de fallo a través de su propio gestor de contexto (la
  autorreferencia) y puede cambiar la estrategia de experimentación. A y B usan el mismo flujo
  aleatorio para padres y mutaciones y el mismo presupuesto de 900 ejecuciones de tareas (lo
  gastado queda entre 856 y 896, porque un ciclo que no cabe en lo que resta no empieza y en B la
  estrategia cambia el coste de validación por candidata). Con 12 semillas, B termina con mejor
  auditoría en 6, igual en 5 y peor en 1.
- **Límites**: cada control tiene un efecto definido en `model/limits.mjs` (presupuesto, ruido del
  evaluador, diversidad de tareas, coste de validación, diversidad de candidatos, criterio). Los
  seis escenarios son combinaciones de esos controles; en el caso límite la puntuación visible
  sube mientras la auditoría baja, y volver a la última versión válida la recupera.

## Verificación ejecutada

Lo siguiente se ejecutó en este repositorio con Node 22.22 y Chromium headless (Playwright,
renderizado por software):

- `node examples/rsi-lab/verify.mjs`: **45/45**. Incluye dimensiones de los 39 intermedios, máscara
  causal (peso futuro exactamente 0), filas de A que suman 1 (error ≤ 2,3·10⁻¹⁶), caché KV igual a
  recomputar e invalidación, θ sin cambios en inferencia y reflexión, gradiente frente a
  diferencias finitas (error relativo máximo 1,6·10⁻⁸), Adam frente a una referencia escalar
  independiente, particiones disjuntas, presupuestos comparables, acceso del proponente a la prueba
  bloqueado, bootstrap y bucle reproducibles.
- Pestaña Verificación del inspector: 13 comprobaciones recalculadas en el navegador, todas
  correctas.
- `node examples/rsi-lab/qa-interact.mjs`: **21/21** (reproducir, pausar, avanzar un evento,
  retroceder al estado guardado, capítulos, tooltip y clic en celdas, fichas con entradas y salidas
  recorribles, girar, zoom, volver a la cámara guiada, exploración, recálculo al cambiar un token
  sin cambiar θ, η desde la mesa de control, reiniciar, inspector, sin desplazamiento horizontal).
  También con `--reduced`.
- `node examples/rsi-lab/qa.mjs`: los 75 pasos sin errores ni avisos de consola a 1440×900,
  900×700 y 390×844, y con movimiento reducido. Revisé a mano las hojas de contactos y capturas a
  tamaño completo de los pasos principales; esa revisión visual no es exhaustiva ni automática.

`qa.mjs` y `qa-interact.mjs` necesitan Playwright y Chromium, que no son dependencias del
repositorio: buscan Playwright instalado globalmente y aceptan la ruta del navegador en
`CHROME_PATH`. Las capturas van a `shots/`, que está en `.gitignore`.

## Simplificaciones y limitaciones

- El Transformer es de juguete y sus pesos son aleatorios: muestra el mecanismo, no el
  comportamiento de un modelo entrenado. Sólo se entrena la cabeza de salida.
- Las propuestas de código de los capítulos 6 y 7 están escritas de antemano (etiquetadas
  «propuestas guionadas»); el proponente del bucle sigue reglas declaradas, no un LLM. Lo que sí se
  ejecuta son las pruebas, el banco de tareas y las estadísticas.
- El solucionador del banco es simbólico, de modo que «éxito» mide si la evidencia necesaria
  sobrevivió al gestor de contexto, no la capacidad de un modelo.
- Las cifras del capítulo 9 se contrastaron con los resúmenes y anuncios publicados (arXiv,
  DeepMind); desde el entorno de construcción no se pudieron descargar los PDF.
- Sólo tema oscuro. La cámara gira entre 0° y 90° de acimut y entre 18° y 62° de elevación: la
  geometría se dibuja con caras visibles desde ese cuadrante.
- Los pulsos y transiciones son SVG; no hay sombreadores WebGL. Durante una rotación cada
  fotograma reconstruye la escena: en Chromium headless con renderizado por software costó entre
  23 y 46 ms de mediana por fotograma, y las matrices densas se ocultan mientras se arrastra si un
  fotograma supera 24 ms. No se midió en GPU ni en dispositivos móviles reales.
- Probado sólo en Chromium. Firefox y Safari no se probaron.
- En pantallas estrechas (≤ 760 px) los planos legibles pasan a una hoja inferior y la mesa de
  control se pliega: es una adaptación funcional, menos cuidada que la de escritorio.
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
